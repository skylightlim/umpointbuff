import AsyncStorage from '@react-native-async-storage/async-storage';

const COOKIE_STORAGE_KEY = '@umpoint_cookies';
const DEFAULT_COOKIES = 'cookiesession1=678B2894C4DA0834823DEA7C1C45561A; PHPSESSID=7hmgqd4hntt6s64gnrtr6gug7j';

let memoryCookies: string | null = null;

export async function getSessionCookies(): Promise<string> {
  if (memoryCookies) return memoryCookies;
  try {
    const saved = await AsyncStorage.getItem(COOKIE_STORAGE_KEY);
    memoryCookies = saved || DEFAULT_COOKIES;
  } catch {
    memoryCookies = DEFAULT_COOKIES;
  }
  return memoryCookies;
}

export async function setSessionCookies(cookies: string): Promise<void> {
  const clean = cookies.trim();
  memoryCookies = clean;
  await AsyncStorage.setItem(COOKIE_STORAGE_KEY, clean);
}

export async function clearSession(): Promise<void> {
  memoryCookies = '';
  await AsyncStorage.removeItem(COOKIE_STORAGE_KEY);
}
