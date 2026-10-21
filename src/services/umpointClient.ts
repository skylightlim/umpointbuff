import { Booking, CourtId, GridResponse, GridSlot, SlotStatus, WeekType } from '../types';

export const BASE_URL = 'https://umpoint.um.edu.my';

export const COURTS: Record<CourtId, string> = {
  '1': '21201',
  '2': '21199',
  '3': '21203',
  '4': '21205',
};

/** Courts close at 19:00. UMPoint still draws a 19:00 row, but nothing past 19:00 can be booked. */
export const CLOSING_TIME = '19:00';

const DAY_MS = 86_400_000;
const MYT_OFFSET_MS = 8 * 3_600_000;

/** Thrown when UMPoint bounces a request to its login page. */
export class SessionExpiredError extends Error {
  constructor() {
    super('Your UMPoint session expired.');
  }
}

// ---------------------------------------------------------------- MYT time (any phone time zone)

/** Monday 00:00 MYT of the week holding [epochMs]. */
export function weekStartMs(epochMs: number = Date.now()): number {
  const myt = epochMs + MYT_OFFSET_MS;
  const dayStart = Math.floor(myt / DAY_MS) * DAY_MS;
  const dow = (new Date(dayStart).getUTCDay() + 6) % 7; // 0 = Monday
  return dayStart - dow * DAY_MS - MYT_OFFSET_MS;
}

/** The next moment UMPoint opens a week: the coming Monday 00:00 MYT. */
export function nextRolloverMs(now: number = Date.now()): number {
  return weekStartMs(now) + 7 * DAY_MS;
}

/** DD-MM-YYYY in MYT. */
export function mytDate(epochMs: number = Date.now()): string {
  const d = new Date(epochMs + MYT_OFFSET_MS);
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${d.getUTCFullYear()}`;
}

/** Epoch ms of 00:00 MYT on a DD-MM-YYYY date. */
export function dateMs(date: string): number {
  const [dd, mm, yyyy] = date.split('-').map((x) => parseInt(x, 10));
  return Date.UTC(yyyy, mm - 1, dd) - MYT_OFFSET_MS;
}

export function minutes(t: string): number {
  const [h, m] = t.split(':').map((x) => parseInt(x, 10));
  return h * 60 + m;
}

export function hhmm(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

/** Courts are closed on Saturday and Sunday. */
export function isWeekday(date: string): boolean {
  const dow = new Date(dateMs(date) + MYT_OFFSET_MS).getUTCDay();
  return dow >= 1 && dow <= 5;
}

/** "Mon 26 Oct" for a DD-MM-YYYY date. */
export function dayLabel(date: string): string {
  const d = new Date(dateMs(date) + MYT_OFFSET_MS);
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()];
  const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()];
  return `${day} ${d.getUTCDate()} ${month}`;
}

// ---------------------------------------------------------------- Parsing

function to24(t: string): string {
  const s = t.trim().toLowerCase();
  const pm = s.endsWith('pm');
  const am = s.endsWith('am');
  const [hs, ms] = s.replace(/(am|pm)/g, '').trim().split(':');
  let h = parseInt(hs, 10);
  if (pm && h < 12) h += 12;
  if (am && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${String(parseInt(ms, 10)).padStart(2, '0')}`;
}

const MONTHS: Record<string, string> = {
  Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
  Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
};

/** Same layout rules as the Kotlin parser (modules/umpoint-sniper/.../Umpoint.kt), which has tests. */
export function parseGrid(html: string, court: CourtId, week: WeekType): GridResponse {
  const dates: string[] = [];
  const headerRe = /<td[^>]*>(?:[A-Za-z]+\s*<br\s*\/?>\s*)?(\d{1,2})\s+([A-Za-z]{3}),\s+(\d{4})<\/td>/g;
  let m: RegExpExecArray | null;
  while ((m = headerRe.exec(html)) !== null) {
    dates.push(`${m[1].padStart(2, '0')}-${MONTHS[m[2]] ?? '01'}-${m[3]}`);
  }
  const person = html.match(/var person = '([^']*)'/)?.[1];

  const rows: { start: string; end: string; tr: string }[] = [];
  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  while ((m = trRe.exec(html)) !== null) {
    const t = m[1].match(/<td class="header">(\d{1,2}:\d{2}\s*(?:am|pm))\s*-\s*(\d{1,2}:\d{2}\s*(?:am|pm))<\/td>/i);
    if (t) rows.push({ start: to24(t[1]), end: to24(t[2]), tr: m[1] });
  }

  // Rowspans make later rows skip columns, so fill a matrix the way a browser lays the table out.
  const matrix: ({ status: SlotStatus; id: string } | null)[][] = rows.map(() => dates.map(() => null));
  rows.forEach((row, r) => {
    const tds = [...row.tr.matchAll(/<td([^>]*)>([\s\S]*?)<\/td>/g)].slice(1);
    let next = 0;
    for (let c = 0; c < dates.length; c++) {
      if (matrix[r][c] !== null) continue;
      const td = tds[next++];
      if (!td) break;
      const cls = td[1].match(/class="([^"]*)"/)?.[1] ?? '';
      const id = td[1].match(/id="([^"]*)"/)?.[1] ?? '';
      const span = parseInt(td[1].match(/rowspan="(\d+)"/)?.[1] ?? '1', 10);
      const status: SlotStatus =
        cls.includes('cursorpointer') && id ? 'free'
        : cls.includes('closecols') ? 'closed'
        : person && td[2].includes(person) ? 'mine'
        : 'taken';
      for (let k = 0; k < span && r + k < rows.length; k++) matrix[r + k][c] = { status, id };
    }
  });

  const slots: GridSlot[] = rows.map((row, r) => ({
    time_start: row.start,
    time_end: row.end,
    cells: dates.map((date, c) => ({
      date,
      time_start: row.start,
      time_end: row.end,
      status: matrix[r][c]?.status ?? 'unavailable',
      cell_id: matrix[r][c]?.id ?? '',
    })),
  }));

  return {
    court,
    week,
    dates,
    slots,
    server_today: html.match(/name="initdate"[^>]*value="([^"]*)"/)?.[1] ?? dates[0] ?? '',
  };
}

function cleanText(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

/** The "Confirmed Booking" table on the dashboard. */
export function parseDashboard(html: string): Booking[] {
  const table = html.match(/<table[^>]*>([\s\S]*?)<\/table>/)?.[1] ?? '';
  const bookings: Booking[] = [];
  for (const tr of table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const tds = [...tr[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((x) => cleanText(x[1]));
    if (tds.length < 5 || tds.join(' ').toLowerCase().includes('no record')) continue;
    bookings.push({
      num: tds[0],
      invoice: tds[1],
      facility: tds[2],
      booking_date: tds[3],
      event_date: tds[4],
      cancellable: /btncancel/.test(tr[1]),
    });
  }
  return bookings;
}

// ---------------------------------------------------------------- HTTP
// React Native's fetch on Android shares the WebView's cookie store, so the sign-in sheet's
// session is used automatically — no cookies are handled here.

async function umFetch(path: string, init?: RequestInit): Promise<string> {
  const res = await fetch(`${BASE_URL}${path}`, { credentials: 'include', ...init });
  if (res.url.includes('/login')) throw new SessionExpiredError();
  return res.text();
}

export async function fetchGrid(court: CourtId, week: WeekType): Promise<GridResponse> {
  const thisWeek = weekStartMs();
  const theday = (week === 'this' ? thisWeek : thisWeek + 7 * DAY_MS) / 1000;
  const body = new URLSearchParams({
    act: 'bookweek',
    doproc: '0',
    spid: COURTS[court],
    theday: String(theday),
    calflag: week === 'this' ? 't' : 'n',
    initdate: mytDate(),
    recnum: '0',
    inputo: 'sdbook',
  }).toString();
  const html = await umFetch('/modules/mbook/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  return parseGrid(html, court, week);
}

export async function fetchBookings(): Promise<Booking[]> {
  return parseDashboard(await umFetch('/modules/dashboard/'));
}

/** true if UMPoint still knows this session. */
export async function sessionAlive(): Promise<boolean> {
  try {
    await umFetch('/modules/dashboard/');
    return true;
  } catch (e) {
    if (e instanceof SessionExpiredError) return false;
    throw e;
  }
}
