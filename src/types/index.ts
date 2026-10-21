export type CourtId = '1' | '2' | '3' | '4';
export type WeekType = 'this' | 'next';
/** mine = booked by the signed-in user; unavailable = not on UMPoint's grid. */
export type SlotStatus = 'free' | 'mine' | 'taken' | 'closed' | 'unavailable';

export interface GridCell {
  date: string;
  time_start: string;
  time_end: string;
  status: SlotStatus;
  cell_id: string;
}

export interface GridSlot {
  time_start: string;
  time_end: string;
  cells: GridCell[];
}

export interface GridResponse {
  court: CourtId;
  week: WeekType;
  dates: string[];
  slots: GridSlot[];
  server_today: string;
}

export interface Booking {
  num: string;
  invoice: string;
  /** "Gelanggang Badminton 1 J2 <event>" as UMPoint shows it. */
  facility: string;
  booking_date: string;
  event_date: string;
  cancellable: boolean;
}
