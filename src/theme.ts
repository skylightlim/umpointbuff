import { TextStyle, useColorScheme } from 'react-native';
import { Easing } from 'react-native-reanimated';

/**
 * The hall, not a dashboard: court-mat green and the white of its lines, cork from the
 * shuttle for what's yours, a smash red for the sniper. Light and dark share the roles.
 */
const light = {
  bg: '#F3F5F2',
  surface: '#FFFFFF',
  surfaceRaised: '#FFFFFF',
  fill: '#E8ECE8',
  ink: '#10241F',
  ink2: '#4D5F59',
  ink3: '#86948F',
  hairline: '#DCE2DE',
  mat: '#155E4B',
  matPressed: '#0F4A3B',
  matSoft: '#DCEBE4',
  courtLine: '#FFFFFF',
  taken: '#CDD5D1',
  cork: '#9A6A3A',
  corkSoft: '#F2E6D7',
  smash: '#C93A3A',
  smashSoft: '#F7E2DF',
  scrim: 'rgba(16, 36, 31, 0.35)',
  onAccent: '#FFFFFF',
};

const dark: typeof light = {
  bg: '#0B1311',
  surface: '#131D1A',
  surfaceRaised: '#1A2622',
  fill: '#1F2C28',
  ink: '#E8F0EC',
  ink2: '#A4B3AD',
  ink3: '#6C7C76',
  hairline: '#24332E',
  mat: '#2E9A74',
  matPressed: '#257D5E',
  matSoft: '#15362C',
  courtLine: '#E6F4EE',
  taken: '#2B3A35',
  cork: '#D9A46C',
  corkSoft: '#3A2C1E',
  smash: '#EF6A62',
  smashSoft: '#3C1E1C',
  scrim: 'rgba(0, 0, 0, 0.55)',
  onAccent: '#FFFFFF',
};

export type Colors = typeof light;

export function useColors(): Colors {
  return useColorScheme() === 'dark' ? dark : light;
}

/** Scoreboard numerals for times and the countdown; everything else is the system face. */
export const NUMERALS = 'BarlowCondensed_600SemiBold';
export const NUMERALS_BOLD = 'BarlowCondensed_700Bold';

/** Size-specific tracking and leading: tight and negative as type grows, open when small. */
export const type = {
  largeTitle: { fontSize: 32, lineHeight: 38, fontWeight: '700', letterSpacing: -0.6 },
  title: { fontSize: 20, lineHeight: 25, fontWeight: '700', letterSpacing: -0.3 },
  headline: { fontSize: 16, lineHeight: 21, fontWeight: '600', letterSpacing: -0.1 },
  body: { fontSize: 15, lineHeight: 21, fontWeight: '400' },
  callout: { fontSize: 14, lineHeight: 19, fontWeight: '500' },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  caption: { fontSize: 11, lineHeight: 14, fontWeight: '600', letterSpacing: 0.6, textTransform: 'uppercase' },
  time: { fontFamily: NUMERALS, fontSize: 24, lineHeight: 26, letterSpacing: 0.2 },
  clock: { fontFamily: NUMERALS_BOLD, fontSize: 60, lineHeight: 62, letterSpacing: 0.5 },
} satisfies Record<string, TextStyle>;

export const space = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32 } as const;
export const radius = { s: 8, m: 12, l: 18, sheet: 28 } as const;

/** Apple's two-parameter springs (Reanimated takes them as-is). */
export const springs = {
  settle: { duration: 400, dampingRatio: 1 },
  sheet: { duration: 320, dampingRatio: 0.86 },
  snap: { duration: 300, dampingRatio: 0.8 },
} as const;

export const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
