import AsyncStorage from '@react-native-async-storage/async-storage';

const COOKIE_STORAGE_KEY = '@umpoint_cookies';

let memoryCookies: string | null = null;

export async function getSessionCookies(): Promise<string> {
  if (memoryCookies) return memoryCookies;
  try {
    memoryCookies = (await AsyncStorage.getItem(COOKIE_STORAGE_KEY)) || '';
  } catch {
    memoryCookies = '';
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
