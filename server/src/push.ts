export interface PushEnv {
  DB: D1Database;
  FIREBASE_SERVICE_ACCOUNT?: string;
}

export interface Push {
  /** invite, friend or update. The phone files them under different notification channels. */
  kind: "invite" | "friend" | "update";
  title: string;
  body: string;
  lobby?: string;
}

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

/**
 * Signing costs more CPU than the free plan's 10 ms can comfortably spare, and a quiet worker starts
 * cold on most requests, so the token lives in the database and is signed about once an hour.
 */
async function cachedToken(env: PushEnv, project: string, now: number): Promise<string | null> {
  const row = await env.DB.prepare("SELECT value FROM cache WHERE key = ? AND expires > ?")
    .bind(`fcm:${project}`, now + 60).first<{ value: string }>();
  return row?.value ?? null;
}

const b64url = (bytes: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes))))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** A short-lived Google token, minted from the service account. */
async function accessToken(env: PushEnv, account: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const saved = await cachedToken(env, account.project_id, now);
  if (saved) return saved;
  const der = Uint8Array.from(atob(account.private_key.replace(/-----[^-]+-----|\s/g, "")), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const encode = (o: object) => b64url(new TextEncoder().encode(JSON.stringify(o)));
  const unsigned = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({
    iss: account.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })}`;
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${b64url(signature)}`,
    }),
  });
  if (!res.ok) throw new Error(`Google token: HTTP ${res.status}`);
  const body = (await res.json()) as { access_token: string; expires_in: number };
  await env.DB.prepare("INSERT INTO cache (key, value, expires) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, expires = excluded.expires")
    .bind(`fcm:${account.project_id}`, body.access_token, now + body.expires_in).run();
  return body.access_token;
}

/**
 * Tells phones that something changed. Best effort: a phone that misses this catches up on its next
 * sync, so a failure here must never fail the request that caused it.
 */
export async function sendPush(env: PushEnv, emails: string[], push: Push): Promise<void> {
  if (!env.FIREBASE_SERVICE_ACCOUNT || emails.length === 0) return;
  try {
    const account = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT) as ServiceAccount;
    const marks = emails.map(() => "?").join(",");
    const { results } = await env.DB.prepare(`SELECT token FROM devices WHERE email IN (${marks})`)
      .bind(...emails).all<{ token: string }>();
    if (results.length === 0) return;
    const bearer = await accessToken(env, account);
    await Promise.all(results.map(async ({ token }) => {
      const res = await fetch(`https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`, {
        method: "POST",
        headers: { authorization: `Bearer ${bearer}`, "content-type": "application/json" },
        body: JSON.stringify({
          message: {
            token,
            // Data only, so the phone also syncs its armed snipes; high priority gets through Doze.
            data: { kind: push.kind, title: push.title, body: push.body, lobby: push.lobby ?? "" },
            android: { priority: "HIGH", ttl: "86400s" },
          },
        }),
      });
      // 404 UNREGISTERED: the app was uninstalled or the token rotated.
      if (res.status === 404) await env.DB.prepare("DELETE FROM devices WHERE token = ?").bind(token).run();
      else if (!res.ok) console.error("fcm", res.status);
    }));
  } catch (e) {
    console.error("push failed", e);
  }
}
