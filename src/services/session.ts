import { useSyncExternalStore } from 'react';
import { Sniper } from '../../modules/umpoint-sniper';
import { SessionExpiredError, sessionAlive } from './umpointClient';

/**
 * The UMPoint session lives in the WebView cookie store, shared by the sign-in sheet, fetch and
 * the Kotlin sniper. UMPoint drops it after 10–20 idle minutes, so the app quietly signs back in
 * with the Google cookies the sheet left, and only asks the user when that fails.
 */
export type SessionState = 'unknown' | 'signed_in' | 'signed_out' | 'offline';

let state: SessionState = 'unknown';
const listeners = new Set<() => void>();
const signInListeners = new Set<(reason?: string) => void>();

function set(next: SessionState) {
  if (next === state) return;
  state = next;
  listeners.forEach((l) => l());
}

export function useSession(): SessionState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

/** Opens the sign-in sheet (App owns it). */
export function requestSignIn(reason?: string) {
  signInListeners.forEach((l) => l(reason));
}

export function onSignInRequest(l: (reason?: string) => void): () => void {
  signInListeners.add(l);
  return () => signInListeners.delete(l);
}

let renewing: Promise<boolean> | null = null;

/** Makes sure a session exists, renewing it silently if possible. */
export async function ensureSession(): Promise<boolean> {
  renewing ??= (async () => {
    try {
      const r = await Sniper.renewSession();
      set(r === 'needs_sign_in' ? 'signed_out' : 'signed_in');
      return r !== 'needs_sign_in';
    } catch {
      set('offline');
      return false;
    } finally {
      renewing = null;
    }
  })();
  return renewing;
}

export async function refreshSession(): Promise<SessionState> {
  try {
    set((await sessionAlive()) ? 'signed_in' : (await ensureSession()) ? 'signed_in' : 'signed_out');
  } catch {
    set('offline');
  }
  return state;
}

/** Runs [fn]; if UMPoint says the session expired, renews it once and retries. */
export async function withSession<T>(fn: () => Promise<T>): Promise<T> {
  try {
    const out = await fn();
    set('signed_in');
    return out;
  } catch (e) {
    if (!(e instanceof SessionExpiredError)) throw e;
    if (!(await ensureSession())) {
      requestSignIn();
      throw e;
    }
    return fn();
  }
}

export function markSignedIn() {
  Sniper.flushCookies();
  set('signed_in');
}

export async function signOut() {
  await Sniper.clearSession();
  set('signed_out');
}
