import { BookResult, SlotRequest, Sniper, SniperTask } from '../../modules/umpoint-sniper';
import { Booking, CourtId, GridResponse, WeekGrid, WeekType } from '../types';
import { requestSignIn, withSession } from './session';
import { CLOSING_TIME, fetchBookings, fetchGrid, minutes } from './umpointClient';

export const getGrid = (court: CourtId, week: WeekType): Promise<GridResponse> =>
  withSession(() => fetchGrid(court, week));

export const getBookings = (): Promise<Booking[]> => withSession(fetchBookings);

export const COURT_IDS: CourtId[] = ['1', '2', '3', '4'];

/** Every court's grid for the week, fetched together and merged so times come first. */
export async function getWeek(week: WeekType): Promise<WeekGrid> {
  const grids = await withSession(() => Promise.all(COURT_IDS.map((c) => fetchGrid(c, week))));
  const first = grids[0];
  // The 19:00 row UMPoint draws can't be booked: courts close at 19:00.
  const times = first.slots
    .filter((s) => minutes(s.time_start) < minutes(CLOSING_TIME))
    .map((s) => ({ start: s.time_start, end: s.time_end }));
  const status: WeekGrid['status'] = {};
  first.dates.forEach((date, col) => {
    status[date] = {};
    for (const t of times) {
      const byCourt = {} as Record<CourtId, GridResponse['slots'][number]['cells'][number]['status']>;
      grids.forEach((g) => {
        const row = g.slots.find((s) => s.time_start === t.start);
        byCourt[g.court] = row?.cells[col]?.status ?? 'unavailable';
      });
      status[date][t.start] = byCourt;
    }
  });
  return { week, dates: first.dates, times, status, server_today: first.server_today };
}

/** Books a slot in the week that is open now — the same Kotlin code the sniper fires at 00:00. */
export async function bookCourt(req: SlotRequest): Promise<BookResult> {
  const res = await Sniper.bookNow(req);
  if (res.status === 'signed_out') requestSignIn();
  return res;
}

/** Arms a snipe for Monday 00:00 MYT of the slot's week. */
export const scheduleSnipe = (req: SlotRequest): SniperTask => Sniper.arm(req);

export const getTasks = (): SniperTask[] => Sniper.tasks();
