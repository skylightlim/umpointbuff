// The two paths that talk to Google, with Google faked: they can't run for real until the accounts exist.
import assert from "node:assert/strict";
import { generateKeyPairSync, createVerify } from "node:crypto";
import { afterEach, test } from "node:test";
import { finishGoogle, startGoogle } from "../src/auth.ts";
import { sendPush } from "../src/push.ts";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

/** Enough of D1 for these paths: records statements and answers device lookups. */
function fakeDb(tokens: string[] = [], cachedToken: string | null = null) {
  const ran: { sql: string; args: unknown[] }[] = [];
  const statement = (sql: string, args: unknown[] = []) => ({
    sql,
    args,
    bind: (...a: unknown[]) => statement(sql, a),
    first: async () => (cachedToken ? { value: cachedToken } : null),
    all: async () => ({ results: tokens.map((token) => ({ token })) }),
    run: async () => {
      ran.push({ sql, args });
      return { meta: { changes: 1 } };
    },
  });
  return {
    ran,
    prepare: (sql: string) => statement(sql),
    batch: async (list: { sql: string; args: unknown[] }[]) => {
      ran.push(...list);
      return [];
    },
  } as any;
}

function idToken(claims: object) {
  const part = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${part({ alg: "RS256" })}.${part(claims)}.sig`;
}

const env = (db: unknown) => ({ DB: db, ALLOWED_DOMAINS: "siswa.um.edu.my,um.edu.my", GOOGLE_CLIENT_ID: "cid", GOOGLE_CLIENT_SECRET: "sec" }) as any;
const callback = new URL("https://w.dev/auth/callback?code=c&state=s1");

function googleAnswers(claims: object) {
  globalThis.fetch = (async () => new Response(JSON.stringify({ id_token: idToken(claims) }))) as typeof fetch;
}

test("sign-in starts at Google with our callback and the app's state", () => {
  const url = new URL(startGoogle(env(fakeDb()), "https://w.dev", "s1").headers.get("location")!);
  assert.equal(url.origin, "https://accounts.google.com");
  assert.equal(url.searchParams.get("redirect_uri"), "https://w.dev/auth/callback");
  assert.equal(url.searchParams.get("state"), "s1");
  assert.equal(url.searchParams.get("client_id"), "cid");
});

test("a SiswaMail account gets a token in the fragment, and only its hash is stored", async () => {
  const db = fakeDb();
  googleAnswers({ aud: "cid", email: "A@siswa.um.edu.my", email_verified: true, hd: "siswa.um.edu.my", name: "Ann" });
  const location = new URL((await finishGoogle(env(db), "https://w.dev", callback)).headers.get("location")!);
  assert.equal(location.pathname, "/auth/done");
  assert.equal(location.searchParams.get("state"), "s1");
  const token = location.hash.replace("#token=", "");
  assert.match(token, /^[0-9a-f]{64}$/);
  assert.ok(!location.search.includes(token), "the token never goes in the query, which servers can log");
  const stored = JSON.stringify(db.ran);
  assert.ok(stored.includes("a@siswa.um.edu.my"), "the email is stored lower case");
  assert.ok(!stored.includes(token), "the raw token isn't stored");
});

test("a personal Google account is turned away with nothing stored", async () => {
  const db = fakeDb();
  googleAnswers({ aud: "cid", email: "a@gmail.com", email_verified: true, name: "Ann" });
  const location = new URL((await finishGoogle(env(db), "https://w.dev", callback)).headers.get("location")!);
  assert.equal(location.searchParams.get("error"), "domain");
  assert.equal(location.hash, "");
  assert.equal(db.ran.length, 0);
});

test("Google refusing the code ends the sign-in cleanly", async () => {
  globalThis.fetch = (async () => new Response("no", { status: 400 })) as typeof fetch;
  const location = new URL((await finishGoogle(env(fakeDb()), "https://w.dev", callback)).headers.get("location")!);
  assert.equal(location.searchParams.get("error"), "google");
});

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});
const account = JSON.stringify({ project_id: "proj", client_email: "svc@proj.iam", private_key: privateKey });
const push = { kind: "invite", title: "T", body: "B", lobby: "L1" } as const;

test("a push is signed with the service account and sent high priority, data only", async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return url.includes("oauth2") ? new Response(JSON.stringify({ access_token: "tok", expires_in: 3600 })) : new Response("{}");
  }) as typeof fetch;
  await sendPush({ DB: fakeDb(["d1", "d2"]), FIREBASE_SERVICE_ACCOUNT: account }, ["a@siswa.um.edu.my"], push);

  const assertion = new URLSearchParams(String(calls[0].init.body)).get("assertion")!;
  const [head, claims, signature] = assertion.split(".");
  const verify = createVerify("RSA-SHA256");
  verify.update(`${head}.${claims}`);
  assert.ok(verify.verify(publicKey, Buffer.from(signature, "base64url")), "the JWT verifies against the public key");
  const decoded = JSON.parse(Buffer.from(claims, "base64url").toString());
  assert.equal(decoded.iss, "svc@proj.iam");
  assert.equal(decoded.scope, "https://www.googleapis.com/auth/firebase.messaging");

  const sends = calls.filter((c) => c.url.includes("fcm.googleapis.com"));
  assert.equal(sends.length, 2);
  assert.equal(sends[0].url, "https://fcm.googleapis.com/v1/projects/proj/messages:send");
  assert.equal((sends[0].init.headers as Record<string, string>).authorization, "Bearer tok");
  const message = JSON.parse(String(sends[0].init.body)).message;
  assert.equal(message.android.priority, "HIGH");
  assert.equal(message.notification, undefined);
  assert.deepEqual(message.data, { kind: "invite", title: "T", body: "B", lobby: "L1" });
});

test("a dead device token is forgotten", async () => {
  const db = fakeDb(["dead"]);
  globalThis.fetch = (async (url: string) =>
    url.includes("oauth2") ? new Response(JSON.stringify({ access_token: "t", expires_in: 3600 })) : new Response("{}", { status: 404 })) as typeof fetch;
  await sendPush({ DB: db, FIREBASE_SERVICE_ACCOUNT: account }, ["a@siswa.um.edu.my"], push);
  assert.ok(db.ran.some((r: { sql: string; args: unknown[] }) => r.sql.startsWith("DELETE FROM devices") && r.args[0] === "dead"));
});

test("a push failure never reaches the request that caused it", async () => {
  globalThis.fetch = (async () => {
    throw new Error("network down");
  }) as typeof fetch;
  await sendPush({ DB: fakeDb(["d"]), FIREBASE_SERVICE_ACCOUNT: account }, ["a@siswa.um.edu.my"], push);
  await sendPush({ DB: fakeDb(["d"]), FIREBASE_SERVICE_ACCOUNT: "not json" }, ["a@siswa.um.edu.my"], push);
});

test("no keys, no push, no error", async () => {
  globalThis.fetch = (async () => assert.fail("nothing should be sent")) as typeof fetch;
  await sendPush({ DB: fakeDb(["d"]) }, ["a@siswa.um.edu.my"], push);
});

test("a token saved in the database is reused, with no signing and no trip to Google's token endpoint", async () => {
  const urls: string[] = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    urls.push(url);
    assert.equal((init.headers as Record<string, string>).authorization, "Bearer saved");
    return new Response("{}");
  }) as typeof fetch;
  await sendPush({ DB: fakeDb(["d"], "saved"), FIREBASE_SERVICE_ACCOUNT: account }, ["a@siswa.um.edu.my"], push);
  assert.deepEqual(urls, ["https://fcm.googleapis.com/v1/projects/proj/messages:send"]);
});

test("a freshly minted token is saved for the next cold start", async () => {
  const db = fakeDb(["d"]);
  globalThis.fetch = (async (url: string) =>
    url.includes("oauth2") ? new Response(JSON.stringify({ access_token: "fresh", expires_in: 3600 })) : new Response("{}")) as typeof fetch;
  await sendPush({ DB: db, FIREBASE_SERVICE_ACCOUNT: account }, ["a@siswa.um.edu.my"], push);
  const saved = db.ran.find((r: { sql: string }) => r.sql.includes("INTO cache"));
  assert.equal(saved.args[0], "fcm:proj");
  assert.equal(saved.args[1], "fresh");
});
