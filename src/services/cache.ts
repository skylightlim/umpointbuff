import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Show the last reading at once, then fetch and swap it in — the screen never opens on a
 * spinner once it has been seen before. Storage failures only cost the instant start.
 */
export interface Cached<T> {
  data: T | null;
  /** When `data` was read from UMPoint (epoch ms). */
  updatedAt: number | null;
  refreshing: boolean;
  error: string | null;
  refresh: () => void;
}

type Entry<T> = { data: T; at: number };

const memory = new Map<string, Entry<unknown>>();

async function readEntry<T>(key: string): Promise<Entry<T> | null> {
  const hit = memory.get(key) as Entry<T> | undefined;
  if (hit) return hit;
  try {
    const raw = await AsyncStorage.getItem(`cache:${key}`);
    if (!raw) return null;
    const entry = JSON.parse(raw) as Entry<T>;
    memory.set(key, entry);
    return entry;
  } catch {
    return null;
  }
}

export async function writeCache<T>(key: string, data: T): Promise<void> {
  const entry = { data, at: Date.now() };
  memory.set(key, entry);
  try {
    await AsyncStorage.setItem(`cache:${key}`, JSON.stringify(entry));
  } catch {
    // only the instant start is lost
  }
}

export function useCached<T>(key: string, fetcher: () => Promise<T>): Cached<T> {
  const initial = memory.get(key) as Entry<T> | undefined;
  const [entry, setEntry] = useState<{ key: string; value: Entry<T> | null }>({ key, value: initial ?? null });
  const [refreshing, setRefreshing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  useEffect(() => {
    let current = true;
    readEntry<T>(key).then((cached) => {
      if (current && cached) setEntry((e) => (e.key === key && e.value && e.value.at >= cached.at ? e : { key, value: cached }));
    });
    fetcherRef
      .current()
      .then(
        async (data) => {
          if (!current) return;
          await writeCache(key, data);
          setEntry({ key, value: { data, at: Date.now() } });
          setError(null);
        },
        (err: any) => current && setError(err?.message || 'Could not reach UMPoint.'),
      )
      .finally(() => current && setRefreshing(false));
    return () => {
      current = false;
    };
  }, [key, tick]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    setTick((t) => t + 1);
  }, []);

  const value = entry.key === key ? entry.value : null;
  return { data: value?.data ?? null, updatedAt: value?.at ?? null, refreshing, error, refresh };
}

// ---------------------------------------------------------------- Booking defaults

export interface BookingPrefs {
  event: string;
  pax: number;
}

const PREFS_KEY = 'prefs:booking';
export const DEFAULT_PREFS: BookingPrefs = { event: 'Badminton practice', pax: 4 };

export async function loadPrefs(): Promise<BookingPrefs> {
  try {
    const raw = await AsyncStorage.getItem(PREFS_KEY);
    return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

export async function savePrefs(p: BookingPrefs): Promise<void> {
  try {
    await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    // keeps working with the defaults
  }
}
