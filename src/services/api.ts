import AsyncStorage from '@react-native-async-storage/async-storage';
import { Booking, CourtId, GridResponse, SniperTask, SystemStatus, WeekType } from '../types';
import { getSessionCookies } from './session';
import {
  cancelBookingDirect,
  fetchGridDirect,
  freeSlots,
  getBookingsDirect,
  submitBookingDirect,
} from './umpointClient';

const STORAGE_TASKS = '@umpoint_local_tasks';

// ---------------------------------------------------------------- Core API Methods

export async function getStatus(): Promise<SystemStatus> {
  // MYT date & week boundaries, computed on-device
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const myt = new Date(utc + 3600000 * 8);

  const dayOfWeek = (myt.getDay() + 6) % 7; // 0 = Mon, 6 = Sun
  const monThis = new Date(myt);
  monThis.setDate(myt.getDate() - dayOfWeek);
  monThis.setHours(0, 0, 0, 0);

  const sunThis = new Date(monThis);
  sunThis.setDate(monThis.getDate() + 6);

  const monNext = new Date(monThis);
  monNext.setDate(monThis.getDate() + 7);

  const sunNext = new Date(monNext);
  sunNext.setDate(monNext.getDate() + 6);

  const rolloverSec = Math.floor(monNext.getTime() / 1000);
  const nowSec = Math.floor(Date.now() / 1000);
  const secondsToRollover = Math.max(0, rolloverSec - nowSec);

  const localTasks = await getTasks();

  return {
    current_time_myt: `${myt.getFullYear()}-${(myt.getMonth() + 1).toString().padStart(2, '0')}-${myt.getDate().toString().padStart(2, '0')} ${myt.getHours().toString().padStart(2, '0')}:${myt.getMinutes().toString().padStart(2, '0')}:${myt.getSeconds().toString().padStart(2, '0')}`,
    current_week: {
      start: `${monThis.getDate().toString().padStart(2, '0')}-${(monThis.getMonth() + 1).toString().padStart(2, '0')}-${monThis.getFullYear()}`,
      end: `${sunThis.getDate().toString().padStart(2, '0')}-${(sunThis.getMonth() + 1).toString().padStart(2, '0')}-${sunThis.getFullYear()}`,
    },
    next_week: {
      start: `${monNext.getDate().toString().padStart(2, '0')}-${(monNext.getMonth() + 1).toString().padStart(2, '0')}-${monNext.getFullYear()}`,
      end: `${sunNext.getDate().toString().padStart(2, '0')}-${(sunNext.getMonth() + 1).toString().padStart(2, '0')}-${sunNext.getFullYear()}`,
    },
    rollover_timestamp: rolloverSec,
    seconds_to_rollover: secondsToRollover,
    active_sniper_tasks: localTasks.filter((t) => t.status === 'pending' || t.status === 'waiting_for_rollover').length,
  };
}

export async function getGrid(court: CourtId = '1', week: WeekType = 'this'): Promise<GridResponse> {
  const cookies = await getSessionCookies();
  return fetchGridDirect(court, week, cookies);
}

export async function getBookings(): Promise<Booking[]> {
  const cookies = await getSessionCookies();
  return getBookingsDirect(cookies);
}

export async function cancelBooking(bookingId: string): Promise<{ success: boolean; message: string; remaining: Booking[] }> {
  const cookies = await getSessionCookies();
  return cancelBookingDirect(bookingId, cookies);
}

export async function bookCourt(payload: {
  date: string;
  start: string;
  end: string;
  court: CourtId;
  event: string;
  pax: number;
}): Promise<{ success: boolean; message: string; court: string | null }> {
  // Fetch the grid, find the cell IDs, and submit
  const cookies = await getSessionCookies();
  const grid = await fetchGridDirect(payload.court, 'this', cookies);
  const { ok, busy, cells } = freeSlots(grid, payload.date, payload.start, payload.end);

  if (!ok) {
    return {
      success: false,
      message: `Selected slot is not free: ${busy.join(', ')}`,
      court: null,
    };
  }

  const res = await submitBookingDirect(
    {
      ...payload,
      startCellId: cells[0].cell_id,
      endCellId: cells[cells.length - 1].cell_id,
    },
    cookies
  );

  return {
    success: res.success,
    message: res.message,
    court: payload.court,
  };
}

// ---------------------------------------------------------------- Sniper Tasks

export async function getTasks(): Promise<SniperTask[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_TASKS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function scheduleSnipe(payload: {
  date: string;
  start: string;
  end: string;
  court: CourtId;
  event: string;
  pax: number;
}): Promise<{ success: boolean; message: string; task: SniperTask }> {
  const status = await getStatus();
  const taskId = Math.random().toString(36).substring(2, 9);
  const task: SniperTask = {
    id: taskId,
    date: payload.date,
    start: payload.start,
    end: payload.end,
    court: payload.court,
    event: payload.event,
    pax: payload.pax,
    rollover_time: status.next_week.start + ' 00:00:00',
    status: 'waiting_for_rollover',
    created_at: status.current_time_myt,
    remaining_seconds: status.seconds_to_rollover,
    result: null,
  };

  const tasks = await getTasks();
  tasks.push(task);
  await AsyncStorage.setItem(STORAGE_TASKS, JSON.stringify(tasks));

  return {
    success: true,
    message: `Sniper queued for Monday 00:00:00 MYT rollover on your phone.`,
    task,
  };
}

export async function cancelTask(taskId: string): Promise<{ success: boolean; message: string }> {
  const tasks = await getTasks();
  const updated = tasks.map((t) => (t.id === taskId ? { ...t, status: 'cancelled' as const } : t));
  await AsyncStorage.setItem(STORAGE_TASKS, JSON.stringify(updated));
  return { success: true, message: `Task #${taskId} cancelled.` };
}
