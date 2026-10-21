import { BookResult, SlotRequest, Sniper, SniperTask } from '../../modules/umpoint-sniper';
import { Booking, CourtId, GridResponse, WeekType } from '../types';
import { requestSignIn, withSession } from './session';
import { fetchBookings, fetchGrid } from './umpointClient';

export const getGrid = (court: CourtId, week: WeekType): Promise<GridResponse> =>
  withSession(() => fetchGrid(court, week));

export const getBookings = (): Promise<Booking[]> => withSession(fetchBookings);

/** Books a slot in the week that is open now — the same Kotlin code the sniper fires at 00:00. */
export async function bookCourt(req: SlotRequest): Promise<BookResult> {
  const res = await Sniper.bookNow(req);
  if (res.status === 'signed_out') requestSignIn();
  return res;
}

/** Arms a snipe for Monday 00:00 MYT of the slot's week. */
export const scheduleSnipe = (req: SlotRequest): SniperTask => Sniper.arm(req);

export const getTasks = (): SniperTask[] => Sniper.tasks();
