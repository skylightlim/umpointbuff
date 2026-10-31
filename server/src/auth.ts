export interface AuthEnv {
  DB: D1Database;
  ALLOWED_DOMAINS: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  /** Local development only: never set on the deployed worker. */
  DEV_LOGIN?: string;
}

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

export const hashToken = async (token: string) =>
  hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)));

export const emailAllowed = (env: Pick<AuthEnv, "ALLOWED_DOMAINS">, email: string) =>
  env.ALLOWED_DOMAINS.split(",").includes(email.split("@")[1] ?? "");

export interface GoogleClaims {
  aud: string;
  email?: string;
  email_verified?: boolean;
  hd?: string;
  name?: string;
}

/** hd is what proves a Workspace account: a personal Google account can't carry UM's domain in it. */
export function claimsAllowed(claims: GoogleClaims, clientId: string, domains: string): boolean {
  const email = (claims.email ?? "").toLowerCase();
  return claims.aud === clientId && claims.email_verified === true &&
    claims.hd === email.split("@")[1] && emailAllowed({ ALLOWED_DOMAINS: domains }, email);
}

/** Makes the user if they're new and returns a fresh bearer token. */
export async function openSession(env: AuthEnv, email: string, name: string): Promise<string> {
  const token = hex(crypto.getRandomValues(new Uint8Array(32)).buffer);
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare("INSERT INTO users (email, name, created_at) VALUES (?, ?, ?) ON CONFLICT(email) DO UPDATE SET name = excluded.name")
      .bind(email, name, now),
    env.DB.prepare("INSERT INTO sessions (token_hash, email, created_at) VALUES (?, ?, ?)")
      .bind(await hashToken(token), email, now),
  ]);
  return token;
}

export function startGoogle(env: AuthEnv, origin: string, state: string): Response {
  if (!env.GOOGLE_CLIENT_ID) return doneRedirect(origin, state, { error: "not_configured" });
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: `${origin}/auth/callback`,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  }).toString();
  return Response.redirect(url.toString(), 302);
}

/** The app's WebView stops at /auth/done and reads the token from the fragment, which no server sees. */
function doneRedirect(origin: string, state: string, out: { token?: string; error?: string }): Response {
  const query = new URLSearchParams({ state });
  if (out.error) query.set("error", out.error);
  const fragment = out.token ? `#token=${out.token}` : "";
  return Response.redirect(`${origin}/auth/done?${query}${fragment}`, 302);
}

export async function finishGoogle(env: AuthEnv, origin: string, url: URL): Promise<Response> {
  const state = url.searchParams.get("state") ?? "";
  const code = url.searchParams.get("code");
  if (!code || !env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return doneRedirect(origin, state, { error: "cancelled" });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${origin}/auth/callback`,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) return doneRedirect(origin, state, { error: "google" });
  const { id_token } = (await res.json()) as { id_token: string };
  // Fetched straight from Google over TLS with our secret, so its signature needs no second check.
  const base64 = id_token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
  const claims = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)))) as GoogleClaims;
  if (!claimsAllowed(claims, env.GOOGLE_CLIENT_ID, env.ALLOWED_DOMAINS)) return doneRedirect(origin, state, { error: "domain" });
  const email = claims.email!.toLowerCase();
  return doneRedirect(origin, state, { token: await openSession(env, email, claims.name ?? email.split("@")[0]) });
}

export const donePage = () =>
  new Response("<!doctype html><title>UMPoint Badminton</title><p>You can go back to the app.</p>", {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
