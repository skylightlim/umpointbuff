/** Pure booking-calendar rules, matching the app's Umpoint.kt. MYT has no daylight saving. */

const MYT_MS = 8 * 3_600_000;
const DAY_MS = 86_400_000;

/** How long before 00:00 the tender closes: the phones' sniper alarm goes off at 23:50. */
export const CLOSE_BEFORE_MS = 15 * 60_000;
export const MIN_SLOTS = 2;
export const MAX_SLOTS = 6;

const OPENS = 9 * 60;
const CLOSES = 19 * 60;

export const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
export const hhmm = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** The moment UMPoint opens the week holding [date] (DD-MM-YYYY), or null if it isn't a real date. */
export function rolloverFor(date: string): number | null {
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(date);
  if (!m) return null;
  const utc = Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  const d = new Date(utc);
  if (d.getUTCDate() !== Number(m[1]) || d.getUTCMonth() !== Number(m[2]) - 1) return null;
  const sinceMonday = (d.getUTCDay() + 6) % 7;
  return utc - sinceMonday * DAY_MS - MYT_MS;
}

export interface SessionPlan {
  fireAt: number;
  closesAt: number;
  slots: { start: string; end: string }[];
}

/** Checks a requested session against UMPoint's calendar; a string is the reason it can't be. */
export function planSession(date: string, start: string, count: number, now: number): SessionPlan | string {
  const fireAt = rolloverFor(date);
  if (fireAt === null) return "That date isn't valid.";
  const [d, m, y] = date.split("-").map(Number);
  const weekday = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
  // UMPoint refuses same-day bookings, so a week's Monday can't be sniped; weekends are closed.
  if (weekday < 1 || weekday > 4) return "Pick Tuesday to Friday: those are the days a Monday 00:00 snipe can book.";
  if (!/^\d{2}:(00|30)$/.test(start)) return "Sessions start on the hour or half hour.";
  if (!Number.isInteger(count) || count < MIN_SLOTS || count > MAX_SLOTS) {
    return `A session is ${MIN_SLOTS} to ${MAX_SLOTS} half hours.`;
  }
  const from = minutes(start);
  if (from < OPENS || from + count * 30 > CLOSES) return "Courts are open 09:00–19:00.";
  const closesAt = fireAt - CLOSE_BEFORE_MS;
  if (now >= closesAt) return "That week's tender has closed. Pick a later week.";
  return {
    fireAt,
    closesAt,
    slots: Array.from({ length: count }, (_, i) => ({ start: hhmm(from + i * 30), end: hhmm(from + (i + 1) * 30) })),
  };
}
