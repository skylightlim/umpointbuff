import { NativeModule, requireNativeModule } from 'expo';

export type SniperStatus =
  | 'armed'
  | 'running'
  | 'ringing'
  | 'booked'
  | 'failed'
  | 'dry_run'
  | 'missed'
  | 'cancelled';

export interface SniperTask {
  id: string;
  date: string; // DD-MM-YYYY
  start: string; // HH:MM
  end: string;
  court: string;
  anyCourt: boolean;
  event: string;
  pax: number;
  dryRun: boolean;
  measure: boolean;
  fireAt: number; // epoch ms
  createdAt: number;
  status: SniperStatus;
  message: string | null;
  bookedCourt: string | null;
  updatedAt: number;
}

export interface SlotRequest {
  date: string;
  start: string;
  end: string;
  court: string;
  anyCourt: boolean;
  event: string;
  pax: number;
  dryRun?: boolean;
  measure?: boolean;
  /** Only for test runs; a snipe fires at Monday 00:00 MYT of the slot's week. */
  fireAt?: number;
}

export interface PhoneSetup {
  notifications: boolean;
  exactAlarms: boolean;
  fullScreen: boolean;
  backgroundRestricted: boolean;
}

export interface BookResult {
  status: 'booked' | 'failed' | 'signed_out';
  message: string;
  court: string | null;
}

declare class UmpointSniperModule extends NativeModule {
  userAgent(): string;
  tasks(): string;
  arm(json: string): string;
  cancel(id: string): void;
  remove(id: string): void;
  status(): { running: boolean; needsSignIn: boolean };
  permissions(): PhoneSetup;
  openSettings(which: 'notifications' | 'exactAlarms' | 'fullScreen' | 'app'): void;
  bookNow(json: string): Promise<string>;
  clearSession(): Promise<void>;
  flushCookies(): void;
  readLog(): string;
}

const Native = requireNativeModule<UmpointSniperModule>('UmpointSniper');

/** The on-phone sniper and booking engine (Kotlin, Android only). */
export const Sniper = {
  userAgent: () => Native.userAgent(),
  tasks: (): SniperTask[] => JSON.parse(Native.tasks()),
  arm: (req: SlotRequest): SniperTask => JSON.parse(Native.arm(JSON.stringify(req))),
  cancel: (id: string) => Native.cancel(id),
  remove: (id: string) => Native.remove(id),
  status: () => Native.status(),
  phoneSetup: () => Native.permissions(),
  openSettings: (which: Parameters<UmpointSniperModule['openSettings']>[0]) => Native.openSettings(which),
  bookNow: async (req: SlotRequest): Promise<BookResult> => JSON.parse(await Native.bookNow(JSON.stringify(req))),
  clearSession: () => Native.clearSession(),
  flushCookies: () => Native.flushCookies(),
  readLog: () => Native.readLog(),
};
