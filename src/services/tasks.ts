import { useSyncExternalStore } from 'react';
import { SlotRequest, Sniper, SniperTask } from '../../modules/umpoint-sniper';

/**
 * The sniper's tasks live in the Kotlin store; this mirrors them for every screen at once and
 * re-reads every few seconds while anything is watching, since the service changes them at night.
 */
let tasks: SniperTask[] = read();
let snapshot = JSON.stringify(tasks);
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;
let landing: string | null = null;

function read(): SniperTask[] {
  try {
    return Sniper.tasks();
  } catch {
    return [];
  }
}

export function reloadTasks() {
  const next = read();
  const json = JSON.stringify(next);
  if (json === snapshot) return;
  tasks = next;
  snapshot = json;
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  timer ??= setInterval(reloadTasks, 3000);
  return () => {
    listeners.delete(l);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

export function useTasks(): SniperTask[] {
  return useSyncExternalStore(subscribe, () => tasks);
}

export const LIVE: SniperTask['status'][] = ['armed', 'running', 'ringing'];
export const isLive = (t: SniperTask) => LIVE.includes(t.status);

/** Arms a snipe for Monday 00:00 MYT of the slot's week. */
export function armSnipe(req: SlotRequest): SniperTask {
  const task = Sniper.arm(req);
  landing = task.id;
  reloadTasks();
  return task;
}

/** The snipe armed last, once: its shuttle is thrown into the tube the next time the tube shows. */
export function takeLanding(): string | null {
  const id = landing;
  landing = null;
  return id;
}

export function cancelSnipe(id: string) {
  Sniper.cancel(id);
  reloadTasks();
}

export function removeSnipe(id: string) {
  Sniper.remove(id);
  reloadTasks();
}
