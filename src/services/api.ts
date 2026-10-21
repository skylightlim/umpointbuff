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
import { Platform } from 'react-native';

const STORAGE_SERVER_URL = '@umpoint_server_url';
const STORAGE_MODE = '@umpoint_app_mode'; // 'standalone' | 'server'
const STORAGE_TASKS = '@umpoint_local_tasks';

const getInitialDefaultUrl = () => {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return 'http://10.221.34.186:8000';
};

const DEFAULT_URL = getInitialDefaultUrl();

// App Mode: defaults to 'standalone' (100% on-device, no server needed)
export async function getAppMode(): Promise<'standalone' | 'server'> {
  try {
    const mode = await AsyncStorage.getItem(STORAGE_MODE);
    return (mode as 'standalone' | 'server') || 'standalone';
  } catch {
    return 'standalone';
  }
}

export async function setAppMode(mode: 'standalone' | 'server'): Promise<void> {
  await AsyncStorage.setItem(STORAGE_MODE, mode);
}

export async function getServerUrl(): Promise<string> {
  try {
    const saved = await AsyncStorage.getItem(STORAGE_SERVER_URL);
    return saved || DEFAULT_URL;
  } catch {
    return DEFAULT_URL;
  }
}

export async function setServerUrl(url: string): Promise<void> {
  const cleanUrl = url.trim().replace(/\/+$/, '');
  await AsyncStorage.setItem(STORAGE_SERVER_URL, cleanUrl);
}

// ---------------------------------------------------------------- Core API Methods

export async function getStatus(): Promise<SystemStatus> {
  const mode = await getAppMode();
  if (mode === 'server') {
    const baseUrl = await getServerUrl();
    const res = await fetch(`${baseUrl}/api/status`);
    return res.json();
  }

  // Standalone mode: Calculate MYT date & week boundaries on-device
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
    status: 'standalone (direct)',
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
  const mode = await getAppMode();
  if (mode === 'server') {
    const baseUrl = await getServerUrl();
    const res = await fetch(`${baseUrl}/api/grid?court=${court}&week=${week}`);
    return res.json();
  }

  // Standalone mode: fetch directly from UMPoint using stored session cookies
  const cookies = await getSessionCookies();
  return fetchGridDirect(court, week, cookies);
}

export async function getBookings(): Promise<Booking[]> {
  const mode = await getAppMode();
  if (mode === 'server') {
    const baseUrl = await getServerUrl();
    const res = await fetch(`${baseUrl}/api/bookings`);
    const json = await res.json();
    return json.bookings;
  }

  // Standalone mode: fetch directly from UMPoint dashboard
  const cookies = await getSessionCookies();
  return getBookingsDirect(cookies);
}

export async function cancelBooking(bookingId: string): Promise<{ success: boolean; message: string; remaining: Booking[] }> {
  const mode = await getAppMode();
  if (mode === 'server') {
    const baseUrl = await getServerUrl();
    const res = await fetch(`${baseUrl}/api/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ booking_id: bookingId }),
    });
    return res.json();
  }

  // Standalone mode: cancel directly via UMPoint POST
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
  const mode = await getAppMode();
  if (mode === 'server') {
    const baseUrl = await getServerUrl();
    const res = await fetch(`${baseUrl}/api/book`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.json();
  }

  // Standalone mode: fetch grid, find cell IDs, and submit directly
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
  const mode = await getAppMode();
  if (mode === 'server') {
    const baseUrl = await getServerUrl();
    const res = await fetch(`${baseUrl}/api/tasks`);
    const json = await res.json();
    return json.tasks;
  }

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
  const mode = await getAppMode();
  if (mode === 'server') {
    const baseUrl = await getServerUrl();
    const res = await fetch(`${baseUrl}/api/snipe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.json();
  }

  // Standalone mode: save task locally
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
  const mode = await getAppMode();
  if (mode === 'server') {
    const baseUrl = await getServerUrl();
    const res = await fetch(`${baseUrl}/api/tasks/${taskId}`, { method: 'DELETE' });
    return res.json();
  }

  const tasks = await getTasks();
  const updated = tasks.map((t) => (t.id === taskId ? { ...t, status: 'cancelled' as const } : t));
  await AsyncStorage.setItem(STORAGE_TASKS, JSON.stringify(updated));
  return { success: true, message: `Task #${taskId} cancelled.` };
}
