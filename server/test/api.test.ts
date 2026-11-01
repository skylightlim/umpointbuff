// Runs the real worker and a real local D1 through wrangler, because the claim's atomicity lives in SQL.
import assert from "node:assert/strict";
import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";

const PORT = 8799;
const BASE = `http://127.0.0.1:${PORT}`;
const dir = mkdtempSync(join(tmpdir(), "together-"));
let worker: ChildProcess;

function startWorker(port: number, vars: string[]): ChildProcess {
  return spawn("npx", ["wrangler", "dev", "--local", "--port", String(port), "--persist-to", dir, "--inspector-port", String(port + 1000), ...vars], { stdio: "ignore", detached: true });
}

async function waitFor(url: string) {
  for (let i = 0; i < 120; i++) {
    try {
      await fetch(url);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error("worker didn't start");
}

before(async () => {
  const migrate = spawnSync("npx", ["wrangler", "d1", "migrations", "apply", "DB", "--local", "--persist-to", dir], { input: "y\n", encoding: "utf8" });
  assert.equal(migrate.status, 0, migrate.stderr);
  worker = startWorker(PORT, ["--var", "SIGNUPS_PER_HOUR:100000"]);
  await waitFor(`${BASE}/state`);
}, { timeout: 90_000 });

after(() => {
  if (worker.pid) process.kill(-worker.pid);
  rmSync(dir, { recursive: true, force: true });
});

class User {
  token = "";
  code: string;
  constructor(code: string) {
    this.code = code;
  }
  async post(path: string, body: unknown = {}) {
    const res = await fetch(BASE + path, { method: "POST", headers: { authorization: `Bearer ${this.token}` }, body: JSON.stringify(body) });
    return { status: res.status, body: (await res.json()) as any };
  }
  async state() {
    const res = await fetch(`${BASE}/state`, { headers: { authorization: `Bearer ${this.token}` } });
    assert.equal(res.status, 200);
    return (await res.json()) as any;
  }
}

const create = (code: string, name = code, base = BASE) =>
  fetch(`${base}/auth/create`, { method: "POST", body: JSON.stringify({ code, name }) });

let counter = 0;
async function user(name: string): Promise<User> {
  const code = `${name}x${++counter}`;
  const u = new User(code);
  const res = await create(code, name);
  assert.equal(res.status, 200);
  u.token = ((await res.json()) as { token: string }).token;
  return u;
}

async function befriend(a: User, ...others: User[]) {
  for (const b of others) {
    assert.equal((await a.post("/friends/add", { code: b.code })).status, 200);
    assert.equal((await b.post("/friends/respond", { code: a.code, accept: true })).status, 200);
  }
}

/** A Tuesday well past the next rollover, so the test can't land in a closed tender. */
function tuesday(): string {
  const now = new Date(Date.now() + 8 * 3_600_000);
  const toMonday = (8 - now.getUTCDay()) % 7 || 7;
  const d = new Date(now.getTime() + (toMonday + 8) * 86_400_000);
  return `${String(d.getUTCDate()).padStart(2, "0")}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${d.getUTCFullYear()}`;
}

async function lobby(host: User, invited: User[], slots = 4, start = "17:00") {
  const res = await host.post("/lobbies", { date: tuesday(), start, slots, court: "2", event: "Test", pax: 4, invite: invited.map((u) => u.code) });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const all = res.body.lobbies;
  return all[all.length - 1];
}

const find = (state: any, id: string) => state.lobbies.find((l: any) => l.id === id);

test("requests without a valid token are refused", async () => {
  const res = await fetch(`${BASE}/state`, { headers: { authorization: "Bearer nope" } });
  assert.equal(res.status, 401);
});

test("one network can only make so many accounts in an hour", async () => {
  const limited = startWorker(PORT + 1, ["--var", "SIGNUPS_PER_HOUR:2"]);
  const base = `http://127.0.0.1:${PORT + 1}`;
  try {
    await waitFor(`${base}/state`);
    const code = () => `lim${++counter}`;
    assert.equal((await create(code(), "a", base)).status, 200);
    const taken = `lim${counter}`;
    assert.equal((await create(taken, "a", base)).status, 409, "a taken code doesn't use up the allowance");
    assert.equal((await create(code(), "b", base)).status, 200);
    assert.equal((await create(code(), "c", base)).status, 429);
  } finally {
    if (limited.pid) process.kill(-limited.pid);
  }
});

test("Google's routes and signing out are gone", async () => {
  assert.equal((await fetch(`${BASE}/auth/start?state=x`)).status, 401);
  const a = await user("gone");
  assert.equal((await a.post("/session/end")).status, 404);
});

test("a friend code is chosen once: taken and malformed ones are refused", async () => {
  const a = await user("first");
  assert.equal((await create(a.code)).status, 409);
  assert.equal((await create(a.code.toUpperCase())).status, 409, "case doesn't make a second account");
  for (const bad of ["ab", "with space", "a@siswa.um.edu.my", "x".repeat(21)]) {
    assert.equal((await create(bad)).status, 400, bad);
  }
  const me = (await a.state()).me;
  assert.equal(me.code, a.code);
  assert.equal(me.name, "first");
});

test("a recovery key brings the same account back and signs the old phone out", async () => {
  const [a, b] = [await user("ann"), await user("ben")];
  await befriend(a, b);
  const { key } = (await a.state()).me;
  assert.match(key, /^\w{4}-\w{4}-\w{4}-\w{4}$/);

  const res = await fetch(`${BASE}/auth/restore`, { method: "POST", body: JSON.stringify({ key: key.toLowerCase() }) });
  assert.equal(res.status, 200);
  const moved = new User(a.code);
  moved.token = ((await res.json()) as { token: string }).token;
  const state = await moved.state();
  assert.equal(state.me.code, a.code);
  assert.equal(state.me.key, key);
  assert.equal(state.friends[0].code, b.code, "friends come back too");
  assert.equal((await fetch(`${BASE}/state`, { headers: { authorization: `Bearer ${a.token}` } })).status, 401);
});

test("a wrong recovery key is refused without touching the account", async () => {
  const a = await user("ann");
  for (const key of ["0000-0000-0000-0000", "", null]) {
    assert.equal((await fetch(`${BASE}/auth/restore`, { method: "POST", body: JSON.stringify({ key }) })).status, 404);
  }
  assert.ok(await a.state());
});

test("nobody sees anyone else's recovery key", async () => {
  const [host, f] = [await user("host"), await user("f")];
  await befriend(host, f);
  const l = await lobby(host, [f], 2);
  await f.post(`/lobbies/${l.id}/respond`, { accept: true });
  const { key } = (await host.state()).me;
  assert.ok(!JSON.stringify(await f.state()).includes(key));
});

test("a friend request needs the other person's yes, and only real codes can be added", async () => {
  const [a, b] = [await user("ann"), await user("ben")];
  assert.equal((await a.post("/friends/add", { code: "nobodyhasthis" })).status, 404);
  assert.equal((await a.post("/friends/add", { code: a.code })).status, 400);
  await a.post("/friends/add", { code: b.code.toUpperCase() });
  assert.equal((await a.state()).friends[0].status, "outgoing");
  assert.equal((await b.state()).friends[0].status, "incoming");
  // Not friends yet, so ben can't be invited.
  assert.equal((await a.post("/lobbies", { date: tuesday(), start: "12:00", slots: 2, court: "1", invite: [b.code] })).status, 400);
  await b.post("/friends/respond", { code: a.code, accept: true });
  assert.equal((await a.state()).friends[0].status, "accepted");
  await b.post("/friends/remove", { code: a.code });
  assert.deepEqual((await a.state()).friends, []);
});

test("adding someone who already asked you accepts them", async () => {
  const [a, b] = [await user("ann"), await user("ben")];
  await a.post("/friends/add", { code: b.code });
  await b.post("/friends/add", { code: a.code });
  assert.equal((await a.state()).friends[0].status, "accepted");
});

test("creating a session gives the host the first half hour and leaves the rest open", async () => {
  const [host, f] = [await user("host"), await user("f")];
  await befriend(host, f);
  const l = await lobby(host, [f], 4);
  assert.deepEqual(l.slots.map((s: any) => [s.start, s.end]), [["17:00", "17:30"], ["17:30", "18:00"], ["18:00", "18:30"], ["18:30", "19:00"]]);
  assert.equal(l.slots[0].claimedBy, host.code);
  assert.ok(l.slots.slice(1).every((s: any) => s.claimedBy === null));
  assert.ok(find(await f.state(), l.id));
});

test("friends accepting at the same instant get different, consecutive half hours", async () => {
  for (let round = 0; round < 5; round++) {
    const host = await user("host");
    const friends = await Promise.all(Array.from({ length: 8 }, (_, i) => user(`f${i}`)));
    await befriend(host, ...friends);
    const l = await lobby(host, friends, 4);
    const answers = await Promise.all(friends.map((f) => f.post(`/lobbies/${l.id}/respond`, { accept: true })));
    assert.ok(answers.every((a) => a.status === 200));

    const seen = find(await host.state(), l.id);
    const holders = seen.slots.map((s: any) => s.claimedBy);
    assert.equal(holders[0], host.code);
    assert.ok(holders.every(Boolean), "every slot is filled");
    assert.equal(new Set(holders).size, 4, "nobody holds two");
    const responses = seen.invites.filter((i: any) => i.response !== "host");
    assert.equal(responses.filter((i: any) => i.response === "accepted").length, 3);
    assert.equal(responses.filter((i: any) => i.response === "player").length, 5);
    for (const i of responses) {
      assert.equal(i.response === "accepted", holders.includes(i.code), "the response matches who holds a slot");
    }
  }
});

test("tapping accept twice at once still takes only one half hour", async () => {
  const [host, f] = [await user("host"), await user("f")];
  await befriend(host, f);
  const l = await lobby(host, [f], 4);
  await Promise.all(Array.from({ length: 6 }, () => f.post(`/lobbies/${l.id}/respond`, { accept: true })));
  const held = find(await f.state(), l.id).slots.filter((s: any) => s.claimedBy === f.code);
  assert.equal(held.length, 1);
  assert.equal(held[0].idx, 1);
});

test("giving up a half hour reopens it for the next person, without signing anyone up", async () => {
  const [host, a, b, c] = [await user("host"), await user("a"), await user("b"), await user("c")];
  await befriend(host, a, b, c);
  const l = await lobby(host, [a, b, c], 3);
  await a.post(`/lobbies/${l.id}/respond`, { accept: true });
  await b.post(`/lobbies/${l.id}/respond`, { accept: true });
  await c.post(`/lobbies/${l.id}/respond`, { accept: true }); // full, so c just comes to play
  await a.post(`/lobbies/${l.id}/withdraw`);
  let seen = find(await host.state(), l.id);
  assert.equal(seen.slots[1].claimedBy, null, "stays open rather than falling on c");
  assert.equal(seen.slots[2].claimedBy, b.code);
  assert.equal(seen.invites.find((i: any) => i.code === c.code).response, "player");
  await c.post(`/lobbies/${l.id}/respond`, { accept: true });
  seen = find(await host.state(), l.id);
  assert.equal(seen.slots[1].claimedBy, c.code, "the earliest gap fills first, so the session stays unbroken");
  assert.equal(seen.invites.find((i: any) => i.code === a.code).response, "declined");
});

test("someone holding a half hour has to give it up rather than decline", async () => {
  const [host, a] = [await user("host"), await user("a")];
  await befriend(host, a);
  const l = await lobby(host, [a], 2);
  await a.post(`/lobbies/${l.id}/respond`, { accept: true });
  assert.equal((await a.post(`/lobbies/${l.id}/respond`, { accept: false })).status, 409);
  assert.equal(find(await a.state(), l.id).slots[1].claimedBy, a.code);
});

test("declining doesn't stop you changing your mind while it's open", async () => {
  const [host, a] = [await user("host"), await user("a")];
  await befriend(host, a);
  const l = await lobby(host, [a], 2);
  await a.post(`/lobbies/${l.id}/respond`, { accept: false });
  assert.equal(find(await host.state(), l.id).invites.find((i: any) => i.code === a.code).response, "declined");
  await a.post(`/lobbies/${l.id}/respond`, { accept: true });
  assert.equal(find(await host.state(), l.id).slots[1].claimedBy, a.code);
});

test("strangers can't see or touch a session", async () => {
  const [host, a, stranger] = [await user("host"), await user("a"), await user("stranger")];
  await befriend(host, a);
  const l = await lobby(host, [a], 2);
  assert.equal(find(await stranger.state(), l.id), undefined);
  for (const action of ["respond", "withdraw", "cancel", "result", "invite"]) {
    assert.equal((await stranger.post(`/lobbies/${l.id}/${action}`, { accept: true, codes: [a.code], idx: 0, result: "booked" })).status, 404, action);
  }
});

test("members can invite their own friends; people who haven't accepted can't", async () => {
  const [host, a, b, c] = [await user("host"), await user("a"), await user("b"), await user("c")];
  await befriend(host, a);
  await befriend(a, b, c);
  const l = await lobby(host, [a], 3);
  assert.equal((await a.post(`/lobbies/${l.id}/invite`, { codes: [b.code] })).status, 403);
  await a.post(`/lobbies/${l.id}/respond`, { accept: true });
  assert.equal((await a.post(`/lobbies/${l.id}/invite`, { codes: [b.code] })).status, 200);
  assert.ok(find(await b.state(), l.id));
  // The host isn't friends with c, so the host can't pull c in.
  assert.equal((await host.post(`/lobbies/${l.id}/invite`, { codes: [c.code] })).status, 400);
});

test("re-inviting doesn't reset somebody's answer", async () => {
  const [host, a] = [await user("host"), await user("a")];
  await befriend(host, a);
  const l = await lobby(host, [a], 2);
  await a.post(`/lobbies/${l.id}/respond`, { accept: true });
  await host.post(`/lobbies/${l.id}/invite`, { codes: [a.code] });
  assert.equal(find(await host.state(), l.id).invites.find((i: any) => i.code === a.code).response, "accepted");
});

test("only the host calls it off, and then nobody can claim", async () => {
  const [host, a, b] = [await user("host"), await user("a"), await user("b")];
  await befriend(host, a, b);
  const l = await lobby(host, [a, b], 3);
  await a.post(`/lobbies/${l.id}/respond`, { accept: true });
  assert.equal((await a.post(`/lobbies/${l.id}/cancel`)).status, 403);
  assert.equal((await host.post(`/lobbies/${l.id}/cancel`)).status, 200);
  assert.equal(find(await a.state(), l.id).status, "cancelled");
  assert.equal((await b.post(`/lobbies/${l.id}/respond`, { accept: true })).status, 409);
  assert.equal(find(await a.state(), l.id).slots[2].claimedBy, null);
});

test("a phone can report only its own half hour, and only once", async () => {
  const [host, a] = [await user("host"), await user("a")];
  await befriend(host, a);
  const l = await lobby(host, [a], 2);
  await a.post(`/lobbies/${l.id}/respond`, { accept: true });
  await a.post(`/lobbies/${l.id}/result`, { idx: 0, result: "booked" }); // host's slot: ignored
  assert.equal(find(await host.state(), l.id).slots[0].result, null);
  await a.post(`/lobbies/${l.id}/result`, { idx: 1, result: "failed", message: "Court 2 was already taken" });
  await a.post(`/lobbies/${l.id}/result`, { idx: 1, result: "booked" }); // already reported
  const slot = find(await host.state(), l.id).slots[1];
  assert.equal(slot.result, "failed");
  assert.equal(slot.message, "Court 2 was already taken");
});
