export type CourtId = '1' | '2' | '3' | '4';
export type WeekType = 'this' | 'next';
export type SlotStatus = 'free' | 'booked' | 'pending' | 'closed' | 'unavailable';

export interface GridCell {
  date: string;
  time_start: string;
  time_end: string;
  status: SlotStatus;
  cell_id: string;
  text: string;
}

export interface GridSlot {
  time_start: string;
  time_end: string;
  cells: GridCell[];
}

export interface GridResponse {
  court: CourtId;
  court_name: string;
  week: WeekType;
  dates: string[];
  slots: GridSlot[];
  server_today: string;
}

export interface SystemStatus {
  current_time_myt: string;
  current_week: {
    start: string;
    end: string;
  };
  next_week: {
    start: string;
    end: string;
  };
  rollover_timestamp: number;
  seconds_to_rollover: number;
  active_sniper_tasks: number;
}

export interface Booking {
  num: string;
  invoice: string;
  facility: string;
  booking_date: string;
  event_date: string;
  status: string;
  cancel_id: string;
}

export interface SniperTask {
  id: string;
  date: string;
  start: string;
  end: string;
  court: string;
  event: string;
  pax: number;
  rollover_time: string;
  status: 'pending' | 'waiting_for_rollover' | 'executing' | 'completed' | 'failed' | 'cancelled';
  remaining_seconds?: number;
  result?: {
    success: boolean;
    message: string;
    court: string | null;
  } | null;
  created_at: string;
}
