export interface AuthEnv {
  DB: D1Database;
  /** New accounts one network may make in an hour. The worker is open to anyone holding the app. */
  SIGNUPS_PER_HOUR?: string;
}

/** An answer the app shows the user as written. */
export class Refuse extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

export const hashToken = async (token: string) =>
  hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)));

export const cleanCode = (value: unknown) => String(value ?? "").trim().toLowerCase();

export const validCode = (code: string) => /^[a-z0-9]{3,20}$/.test(code);

// Crockford base32: no I, L, O or U, so a key read out over a chat can't be misread.
const KEY_LETTERS = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export function newKey(): string {
  const letters = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => KEY_LETTERS[b & 31]);
  return letters.join("").replace(/(.{4})(?=.)/g, "$1-");
}

export function cleanKey(value: unknown): string {
  const letters = String(value ?? "").toUpperCase().replace(/O/g, "0").replace(/[IL]/g, "1").replace(/[^0-9A-Z]/g, "");
  return letters.replace(/(.{4})(?=.)/g, "$1-");
}

async function openSession(env: AuthEnv, code: string): Promise<string> {
  const token = hex(crypto.getRandomValues(new Uint8Array(32)).buffer);
  await env.DB.prepare("INSERT INTO sessions (token_hash, code, created_at) VALUES (?, ?, ?)")
    .bind(await hashToken(token), code, Date.now()).run();
  return token;
}

/** Only taken attempts skip this, so picking a code that's gone doesn't use up the allowance. */
async function countSignup(env: AuthEnv, req: Request) {
  const network = await hashToken(req.headers.get("cf-connecting-ip") ?? "local");
  const hour = Math.floor(Date.now() / 3_600_000);
  const [, row] = await env.DB.batch<{ n: number }>([
    env.DB.prepare("DELETE FROM signups WHERE hour < ?").bind(hour),
    env.DB.prepare("INSERT INTO signups (network, hour, n) VALUES (?, ?, 1) ON CONFLICT(network, hour) DO UPDATE SET n = n + 1 RETURNING n")
      .bind(network, hour),
  ]);
  if (row.results[0].n > Number(env.SIGNUPS_PER_HOUR ?? 10)) {
    throw new Refuse("Too many new accounts from this network. Try again in an hour.", 429);
  }
}

/** The code is the account's id for good, so no route ever changes it. */
export async function createAccount(env: AuthEnv, req: Request, body: Record<string, unknown>) {
  const code = cleanCode(body.code);
  if (!validCode(code)) throw new Refuse("A friend code is 3 to 20 letters or numbers.");
  const name = String(body.name ?? "").trim().slice(0, 30) || code;
  const taken = new Refuse("That friend code is taken. Try another.", 409);
  if (await env.DB.prepare("SELECT 1 FROM users WHERE code = ?").bind(code).first()) throw taken;
  await countSignup(env, req);
  const inserted = await env.DB.prepare(
    "INSERT INTO users (code, name, recovery_key, created_at) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING RETURNING code",
  ).bind(code, name, newKey(), Date.now()).first();
  if (!inserted) throw taken;
  return { token: await openSession(env, code) };
}

/** Moves the account here and signs out any other phone, so two phones can't both snipe its half hours. */
export async function restoreAccount(env: AuthEnv, body: Record<string, unknown>) {
  const row = await env.DB.prepare("SELECT code FROM users WHERE recovery_key = ?").bind(cleanKey(body.key)).first<{ code: string }>();
  if (!row) throw new Refuse("That recovery key doesn't match any account.", 404);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM devices WHERE code = ?").bind(row.code),
    env.DB.prepare("DELETE FROM sessions WHERE code = ?").bind(row.code),
  ]);
  return { token: await openSession(env, row.code) };
}
