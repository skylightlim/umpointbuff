import { type AuthEnv, cleanCode, createAccount, hashToken, Refuse, restoreAccount } from "./auth";
import { type Push, type PushEnv, sendPush } from "./push";
import { planSession } from "./rules";

type Env = AuthEnv & PushEnv;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

interface Who {
  code: string;
  sessionHash: string;
}

async function authenticate(env: Env, req: Request): Promise<Who> {
  const token = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  const sessionHash = await hashToken(token);
  const row = await env.DB.prepare("SELECT code FROM sessions WHERE token_hash = ?").bind(sessionHash).first<{ code: string }>();
  if (!row) throw new Refuse("This phone needs your recovery key.", 401);
  return { code: row.code, sessionHash };
}

// ---- What a phone sees ------------------------------------------------------------------------

async function stateFor(env: Env, me: string) {
  const now = Date.now();
  const since = now - 14 * 86_400_000;
  const mine = "SELECT lobby_id FROM invites WHERE code = ?1";
  const [meRow, friends, lobbies, slots, invites] = await env.DB.batch<Record<string, string | number | null>>([
    env.DB.prepare("SELECT code, name, recovery_key AS key FROM users WHERE code = ?1").bind(me),
    env.DB.prepare(`
      SELECT f.requester, f.addressee, f.status, u.name
      FROM friendships f
      LEFT JOIN users u ON u.code = CASE WHEN f.requester = ?1 THEN f.addressee ELSE f.requester END
      WHERE f.requester = ?1 OR f.addressee = ?1`).bind(me),
    env.DB.prepare(`
      SELECT l.*, u.name AS host_name FROM lobbies l JOIN users u ON u.code = l.host
      WHERE l.id IN (${mine}) AND l.fire_at > ?2 ORDER BY l.fire_at, l.created_at`).bind(me, since),
    env.DB.prepare(`
      SELECT s.*, u.name FROM slots s
      JOIN lobbies l ON l.id = s.lobby_id LEFT JOIN users u ON u.code = s.claimed_by
      WHERE s.lobby_id IN (${mine}) AND l.fire_at > ?2 ORDER BY s.idx`).bind(me, since),
    env.DB.prepare(`
      SELECT i.lobby_id, i.code, i.response, u.name FROM invites i
      JOIN lobbies l ON l.id = i.lobby_id LEFT JOIN users u ON u.code = i.code
      WHERE i.lobby_id IN (${mine}) AND l.fire_at > ?2`).bind(me, since),
  ]);
  return {
    now,
    me: meRow.results[0],
    friends: friends.results.map((f) => {
      const incoming = f.addressee === me;
      const code = String(incoming ? f.requester : f.addressee);
      return { code, name: f.name, status: f.status === "accepted" ? "accepted" : incoming ? "incoming" : "outgoing" };
    }),
    lobbies: lobbies.results.map((l) => ({
      id: l.id,
      host: l.host,
      hostName: l.host_name,
      date: l.date,
      court: l.court,
      event: l.event,
      pax: l.pax,
      fireAt: l.fire_at,
      closesAt: l.closes_at,
      status: l.status,
      slots: slots.results.filter((s) => s.lobby_id === l.id).map((s) => ({
        idx: s.idx,
        start: s.start,
        end: s.end,
        claimedBy: s.claimed_by,
        name: s.claimed_by ? s.name : null,
        result: s.result,
        message: s.message,
      })),
      invites: invites.results.filter((i) => i.lobby_id === l.id).map((i) => ({
        code: i.code,
        name: i.name,
        response: i.response,
      })),
    })),
  };
}

// ---- Friends ----------------------------------------------------------------------------------

async function addFriend(env: Env, ctx: ExecutionContext, me: string, codeRaw: unknown) {
  const code = cleanCode(codeRaw);
  if (code === me) throw new Refuse("That's your own code.");
  if (!(await env.DB.prepare("SELECT 1 FROM users WHERE code = ?").bind(code).first())) throw new Refuse("Nobody has that friend code.", 404);
  const existing = await env.DB.prepare(
    "SELECT requester, status FROM friendships WHERE (requester = ?1 AND addressee = ?2) OR (requester = ?2 AND addressee = ?1)",
  ).bind(me, code).first<{ requester: string; status: string }>();
  if (existing?.status === "accepted") return;
  // They had already asked you, so adding them back is the same as accepting.
  if (existing && existing.requester === code) return respondFriend(env, ctx, me, code, true);
  if (existing) return;
  await env.DB.prepare("INSERT INTO friendships (requester, addressee, status, created_at) VALUES (?, ?, 'pending', ?)")
    .bind(me, code, Date.now()).run();
  ctx.waitUntil(sendPush(env, [code], {
    kind: "friend",
    title: "Friend request",
    body: `${await nameOf(env, me)} wants to play together.`,
  }));
}

async function respondFriend(env: Env, ctx: ExecutionContext, me: string, codeRaw: unknown, accept: boolean) {
  const code = cleanCode(codeRaw);
  if (!accept) {
    await env.DB.prepare("DELETE FROM friendships WHERE requester = ? AND addressee = ?").bind(code, me).run();
    return;
  }
  const { meta } = await env.DB.prepare(
    "UPDATE friendships SET status = 'accepted' WHERE requester = ? AND addressee = ? AND status = 'pending'",
  ).bind(code, me).run();
  if (meta.changes === 0) return;
  ctx.waitUntil(sendPush(env, [code], {
    kind: "friend",
    title: "Friend request accepted",
    body: `${await nameOf(env, me)} accepted. You can invite them now.`,
  }));
}

async function removeFriend(env: Env, me: string, codeRaw: unknown) {
  await env.DB.prepare("DELETE FROM friendships WHERE (requester = ?1 AND addressee = ?2) OR (requester = ?2 AND addressee = ?1)")
    .bind(me, cleanCode(codeRaw)).run();
}

async function nameOf(env: Env, code: string): Promise<string> {
  const row = await env.DB.prepare("SELECT name FROM users WHERE code = ?").bind(code).first<{ name: string }>();
  return row?.name ?? code;
}

/** Keeps only the people who are [me]'s accepted friends. */
async function onlyFriends(env: Env, me: string, codes: string[]): Promise<string[]> {
  if (codes.length === 0) return [];
  const marks = codes.map((_, i) => `?${i + 2}`).join(",");
  const { results } = await env.DB.prepare(`
    SELECT CASE WHEN requester = ?1 THEN addressee ELSE requester END AS code FROM friendships
    WHERE status = 'accepted' AND ((requester = ?1 AND addressee IN (${marks})) OR (addressee = ?1 AND requester IN (${marks})))`)
    .bind(me, ...codes).all<{ code: string }>();
  return results.map((r) => r.code);
}

// ---- Tenders ----------------------------------------------------------------------------------

interface Lobby {
  id: string;
  host: string;
  date: string;
  court: string;
  fire_at: number;
  closes_at: number;
  status: string;
}

async function lobbyFor(env: Env, id: string, me: string): Promise<Lobby> {
  const lobby = await env.DB.prepare(`
    SELECT l.* FROM lobbies l JOIN invites i ON i.lobby_id = l.id AND i.code = ?2 WHERE l.id = ?1`)
    .bind(id, me).first<Lobby>();
  if (!lobby) throw new Refuse("You weren't invited to that session.", 404);
  return lobby;
}

function requireOpen(lobby: Lobby) {
  if (lobby.status !== "open") throw new Refuse("The host called this session off.", 409);
  if (Date.now() >= lobby.closes_at) throw new Refuse("This session's tender has closed.", 409);
}

/** Everyone the session still concerns, except whoever just acted. */
async function audience(env: Env, id: string, except: string, responses: string[]): Promise<string[]> {
  const marks = responses.map(() => "?").join(",");
  const { results } = await env.DB.prepare(
    `SELECT code FROM invites WHERE lobby_id = ? AND code != ? AND response IN (${marks})`,
  ).bind(id, except, ...responses).all<{ code: string }>();
  return results.map((r) => r.code);
}

const dayLabel = (date: string) => {
  const [d, m, y] = date.split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });
  return `${day} ${d}/${m}`;
};

async function createLobby(env: Env, ctx: ExecutionContext, me: string, body: Record<string, unknown>) {
  const date = String(body.date ?? "");
  const start = String(body.start ?? "");
  const court = String(body.court ?? "");
  if (!["1", "2", "3", "4"].includes(court)) throw new Refuse("Pick a court.");
  const plan = planSession(date, start, Number(body.slots), Date.now());
  if (typeof plan === "string") throw new Refuse(plan);
  const wanted = Array.isArray(body.invite) ? [...new Set(body.invite.map(cleanCode))] : [];
  const invited = await onlyFriends(env, me, wanted);
  if (invited.length === 0) throw new Refuse("Invite at least one friend.");

  const id = crypto.randomUUID().slice(0, 8);
  const now = Date.now();
  const event = String(body.event ?? "").trim().slice(0, 80) || "Badminton practice";
  const pax = Math.min(12, Math.max(1, Number(body.pax) || 4));
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO lobbies (id, host, date, court, event, pax, fire_at, closes_at, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)`)
      .bind(id, me, date, court, event, pax, plan.fireAt, plan.closesAt, now),
    env.DB.prepare("INSERT INTO invites (lobby_id, code, invited_by, response, responded_at) VALUES (?, ?, ?, 'host', ?)")
      .bind(id, me, me, now),
    ...plan.slots.map((s, i) =>
      env.DB.prepare("INSERT INTO slots (lobby_id, idx, start, end, claimed_by, claimed_at) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(id, i, s.start, s.end, i === 0 ? me : null, i === 0 ? now : null)),
    ...invited.map((code) =>
      env.DB.prepare("INSERT INTO invites (lobby_id, code, invited_by, response) VALUES (?, ?, ?, 'pending')").bind(id, code, me)),
  ]);
  const first = plan.slots[0].start;
  const last = plan.slots[plan.slots.length - 1].end;
  ctx.waitUntil(sendPush(env, invited, {
    kind: "invite",
    title: `${await nameOf(env, me)} is booking Court ${court}`,
    body: `${dayLabel(date)}, ${first}–${last}. ${plan.slots.length - 1} half hours need someone to book them.`,
    lobby: id,
  }));
  return id;
}

async function inviteMore(env: Env, ctx: ExecutionContext, me: string, id: string, codes: unknown) {
  const lobby = await lobbyFor(env, id, me);
  requireOpen(lobby);
  const mine = await env.DB.prepare("SELECT response FROM invites WHERE lobby_id = ? AND code = ?").bind(id, me).first<{ response: string }>();
  if (mine?.response !== "host" && mine?.response !== "accepted") throw new Refuse("Only people in the session can invite more.", 403);
  const wanted = Array.isArray(codes) ? [...new Set(codes.map(cleanCode))] : [];
  const friends = await onlyFriends(env, me, wanted);
  if (friends.length === 0) throw new Refuse("Those people aren't your friends yet.");
  const results = await env.DB.batch(friends.map((code) =>
    env.DB.prepare("INSERT INTO invites (lobby_id, code, invited_by, response) VALUES (?, ?, ?, 'pending') ON CONFLICT DO NOTHING RETURNING code")
      .bind(id, code, me)));
  const added = results.flatMap((r) => r.results as { code: string }[]).map((r) => r.code);
  ctx.waitUntil(sendPush(env, added, {
    kind: "invite",
    title: `${await nameOf(env, me)} invited you to play`,
    body: `Court ${lobby.court}, ${dayLabel(lobby.date)}. Open the app to take a half hour.`,
    lobby: id,
  }));
}

/**
 * The open tender. One statement takes the earliest free slot, so when two friends accept in the
 * same instant D1 runs them one after the other and they get consecutive half hours.
 */
async function respond(env: Env, ctx: ExecutionContext, me: string, id: string, accept: boolean) {
  const lobby = await lobbyFor(env, id, me);
  requireOpen(lobby);
  const now = Date.now();
  if (!accept) {
    const held = await env.DB.prepare("SELECT 1 FROM slots WHERE lobby_id = ? AND claimed_by = ?").bind(id, me).first();
    if (held) throw new Refuse("You hold a half hour. Give it up instead.", 409);
    await env.DB.prepare("UPDATE invites SET response = 'declined', responded_at = ? WHERE lobby_id = ? AND code = ? AND response != 'host'")
      .bind(now, id, me).run();
    ctx.waitUntil(sendPush(env, [lobby.host], {
      kind: "update",
      title: `${await nameOf(env, me)} can't make it`,
      body: `Court ${lobby.court}, ${dayLabel(lobby.date)}.`,
      lobby: id,
    }));
    return;
  }
  const [claim] = await env.DB.batch<{ start: string; end: string }>([
    env.DB.prepare(`
      UPDATE slots SET claimed_by = ?2, claimed_at = ?3
      WHERE lobby_id = ?1 AND claimed_by IS NULL
        AND idx = (SELECT MIN(idx) FROM slots WHERE lobby_id = ?1 AND claimed_by IS NULL)
        AND NOT EXISTS (SELECT 1 FROM slots WHERE lobby_id = ?1 AND claimed_by = ?2)
      RETURNING start, end`).bind(id, me, now),
    env.DB.prepare(`
      UPDATE invites SET responded_at = ?3,
        response = CASE WHEN EXISTS (SELECT 1 FROM slots WHERE lobby_id = ?1 AND claimed_by = ?2) THEN 'accepted' ELSE 'player' END
      WHERE lobby_id = ?1 AND code = ?2 AND response != 'host'`).bind(id, me, now),
  ]);
  const taken = claim.results[0];
  const name = await nameOf(env, me);
  if (!taken) {
    // A repeat tap by someone who already holds a slot lands here too, and must stay silent.
    const held = await env.DB.prepare("SELECT 1 FROM slots WHERE lobby_id = ? AND claimed_by = ?").bind(id, me).first();
    if (!held) {
      ctx.waitUntil(sendPush(env, [lobby.host], {
        kind: "update",
        title: `${name} will come and play`,
        body: "Every half hour was already taken, so they aren't booking one.",
        lobby: id,
      }));
    }
    return;
  }
  const left = await env.DB.prepare("SELECT COUNT(*) AS n FROM slots WHERE lobby_id = ? AND claimed_by IS NULL").bind(id).first<{ n: number }>();
  const remaining = left?.n ?? 0;
  ctx.waitUntil(sendPush(env, [lobby.host], {
    kind: "update",
    title: `${name} took ${taken.start}–${taken.end}`,
    body: remaining === 0 ? "Every half hour now has someone booking it." : `${remaining} left to fill.`,
    lobby: id,
  }));
  if (remaining === 0) {
    ctx.waitUntil(audience(env, id, me, ["pending"]).then((pending) => sendPush(env, pending, {
      kind: "update",
      title: "That session is fully covered",
      body: `Court ${lobby.court}, ${dayLabel(lobby.date)}. You can still say you'll come and play.`,
      lobby: id,
    })));
  }
}

/** Gives a half hour back. It goes to whoever accepts next; nobody is signed up for it unasked. */
async function withdraw(env: Env, ctx: ExecutionContext, me: string, id: string) {
  const lobby = await lobbyFor(env, id, me);
  requireOpen(lobby);
  const now = Date.now();
  const [released] = await env.DB.batch<{ start: string; end: string }>([
    env.DB.prepare("UPDATE slots SET claimed_by = NULL, claimed_at = NULL WHERE lobby_id = ? AND claimed_by = ? RETURNING start, end").bind(id, me),
    env.DB.prepare("UPDATE invites SET response = 'declined', responded_at = ? WHERE lobby_id = ? AND code = ? AND response != 'host'").bind(now, id, me),
  ]);
  const slot = released.results[0];
  if (!slot) return;
  const push: Push = {
    kind: "update",
    title: `${slot.start}–${slot.end} is free again`,
    body: `${await nameOf(env, me)} gave it up. Court ${lobby.court}, ${dayLabel(lobby.date)}.`,
    lobby: id,
  };
  ctx.waitUntil(audience(env, id, me, ["host", "pending", "player"]).then((to) => sendPush(env, to, push)));
}

async function cancelLobby(env: Env, ctx: ExecutionContext, me: string, id: string) {
  const lobby = await lobbyFor(env, id, me);
  if (lobby.host !== me) throw new Refuse("Only the host can call it off.", 403);
  if (lobby.status !== "open") return;
  if (Date.now() >= lobby.closes_at) throw new Refuse("It's too close to 00:00 to reach every phone. Cancel your own snipe instead.", 409);
  await env.DB.prepare("UPDATE lobbies SET status = 'cancelled' WHERE id = ?").bind(id).run();
  const push: Push = {
    kind: "update",
    title: "Session called off",
    body: `${await nameOf(env, me)} called off Court ${lobby.court}, ${dayLabel(lobby.date)}. Your snipe for it is cancelled.`,
    lobby: id,
  };
  ctx.waitUntil(audience(env, id, me, ["accepted", "pending", "player"]).then((to) => sendPush(env, to, push)));
}

/** A phone reports what UMPoint did with its half hour. */
async function report(env: Env, ctx: ExecutionContext, me: string, id: string, body: Record<string, unknown>) {
  const lobby = await lobbyFor(env, id, me);
  const result = String(body.result ?? "");
  if (!["booked", "failed", "missed"].includes(result)) throw new Refuse("Unknown result.");
  const message = String(body.message ?? "").slice(0, 200);
  const updated = await env.DB.prepare(`
    UPDATE slots SET result = ?, message = ? WHERE lobby_id = ? AND idx = ? AND claimed_by = ? AND result IS NULL RETURNING start, end`)
    .bind(result, message, id, Number(body.idx), me).first<{ start: string; end: string }>();
  if (!updated) return;
  const name = await nameOf(env, me);
  ctx.waitUntil(audience(env, id, me, ["host", "accepted"]).then((to) => sendPush(env, to, {
    kind: "update",
    title: result === "booked" ? `${name} got ${updated.start}–${updated.end}` : `${name} missed ${updated.start}–${updated.end}`,
    body: `Court ${lobby.court}, ${dayLabel(lobby.date)}.`,
    lobby: id,
  })));
}

// ---- Routes -----------------------------------------------------------------------------------

async function route(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(req.url);
  const { pathname: path } = url;

  const body = (req.method === "POST" ? await req.json().catch(() => ({})) : {}) as Record<string, unknown>;
  if (req.method === "POST" && path === "/auth/create") return json(await createAccount(env, req, body));
  if (req.method === "POST" && path === "/auth/restore") return json(await restoreAccount(env, body));

  const who = await authenticate(env, req);
  const me = who.code;
  const lobby = /^\/lobbies\/([a-z0-9-]+)\/(invite|respond|withdraw|cancel|result)$/.exec(path);

  if (req.method === "GET" && path === "/state") return json(await stateFor(env, me));
  if (req.method !== "POST") throw new Refuse("Not found.", 404);

  if (path === "/device") {
    const token = String(body.token ?? "");
    if (!token) throw new Refuse("No device token.");
    await env.DB.prepare(`INSERT INTO devices (token, code, session_hash, updated_at) VALUES (?, ?, ?, ?)
      ON CONFLICT(token) DO UPDATE SET code = excluded.code, session_hash = excluded.session_hash, updated_at = excluded.updated_at`)
      .bind(token, me, who.sessionHash, Date.now()).run();
    return json({ ok: true });
  }
  if (path === "/friends/add") await addFriend(env, ctx, me, body.code);
  else if (path === "/friends/respond") await respondFriend(env, ctx, me, body.code, body.accept === true);
  else if (path === "/friends/remove") await removeFriend(env, me, body.code);
  else if (path === "/lobbies") await createLobby(env, ctx, me, body);
  else if (lobby?.[2] === "invite") await inviteMore(env, ctx, me, lobby[1], body.codes);
  else if (lobby?.[2] === "respond") await respond(env, ctx, me, lobby[1], body.accept === true);
  else if (lobby?.[2] === "withdraw") await withdraw(env, ctx, me, lobby[1]);
  else if (lobby?.[2] === "cancel") await cancelLobby(env, ctx, me, lobby[1]);
  else if (lobby?.[2] === "result") await report(env, ctx, me, lobby[1], body);
  else throw new Refuse("Not found.", 404);
  // Every change answers with the new state, so the phone applies it the same way as a sync.
  return json(await stateFor(env, me));
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      return await route(req, env, ctx);
    } catch (e) {
      if (e instanceof Refuse) return json({ error: e.message }, e.status);
      console.error(e);
      return json({ error: "Something went wrong on the server." }, 500);
    }
  },
} satisfies ExportedHandler<Env>;
