import { Booking } from '../types';
import { dateMs, mytDate, weekStartMs } from './umpointClient';

const DAY = 86_400_000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** A booking from UMPoint's dashboard, in the app's own terms. */
export interface BookedSlot {
  date: string; // DD-MM-YYYY
  start: string; // HH:MM
  end: string;
  court: string | null;
  event: string;
  booking: Booking;
}

function to24(t: string): string {
  const m = t.match(/(\d{1,2}):(\d{2})\s*([AP]M)/i);
  if (!m) return t;
  let hour = parseInt(m[1], 10) % 12;
  if (m[3].toUpperCase() === 'PM') hour += 12;
  return `${String(hour).padStart(2, '0')}:${m[2]}`;
}

/** "23/10/2026 12:00 PM - 12:30 PM" and "Gelanggang Badminton 1 J2 <event>"; null if UMPoint changed its format. */
export function parseBooking(b: Booking): BookedSlot | null {
  const when = b.event_date.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2}:\d{2}\s*[AP]M)\s*-\s*(\d{1,2}:\d{2}\s*[AP]M)/i);
  if (!when) return null;
  const what = b.facility.match(/Gelanggang Badminton (\d)(?:\s+J2)?\s*(.*)/i);
  return {
    date: `${when[1]}-${when[2]}-${when[3]}`,
    start: to24(when[4]),
    end: to24(when[5]),
    court: what ? what[1] : null,
    event: what ? what[2] : b.facility,
    booking: b,
  };
}

/** Monday 00:00 MYT of the week a DD-MM-YYYY date falls in. */
export const weekOf = (date: string): number => weekStartMs(dateMs(date));

/** "27–31 Oct", or "29 Sep – 3 Oct" across a month: the courts' Monday to Friday. */
export function weekRange(monday: number): string {
  const [d1, m1] = mytDate(monday).split('-').map(Number);
  const [d2, m2] = mytDate(monday + 4 * DAY).split('-').map(Number);
  return m1 === m2 ? `${d1}–${d2} ${MONTHS[m2 - 1]}` : `${d1} ${MONTHS[m1 - 1]} – ${d2} ${MONTHS[m2 - 1]}`;
}

/** "Mon 26 Oct" for an epoch. */
export function shortDay(ms: number): string {
  const d = new Date(ms + 8 * 3_600_000);
  return `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** "1d 04:12:33" or "04:12:33". */
export function countdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const hms = [Math.floor((s % 86400) / 3600), Math.floor((s % 3600) / 60), s % 60]
    .map((n) => String(n).padStart(2, '0'))
    .join(':');
  const days = Math.floor(s / 86400);
  return days > 0 ? `${days}d ${hms}` : hms;
}

/** "Updated 3 min ago" for a cache stamp. */
export function ago(at: number | null, now: number): string {
  if (!at) return '';
  const min = Math.round((now - at) / 60_000);
  if (min < 1) return 'Updated just now';
  if (min < 60) return `Updated ${min} min ago`;
  return `Updated ${new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}
