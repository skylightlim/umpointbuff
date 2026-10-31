import { TextStyle, useColorScheme } from 'react-native';
import { Easing } from 'react-native-reanimated';

/**
 * Material Design 3 (M3) Semantic Design Tokens
 * Athletic UM Blue & Badminton Court Green with Sniper Amber accent.
 * Strictly adheres to Google Material Design 3 color roles and elevation system.
 */

const light = {
  // Primary - UM Athletic Blue
  primary: '#00639B',
  onPrimary: '#FFFFFF',
  primaryContainer: '#D0E4FF',
  onPrimaryContainer: '#001D32',
  inversePrimary: '#96CCFF',

  // Secondary - Badminton Court Green
  secondary: '#006D44',
  onSecondary: '#FFFFFF',
  secondaryContainer: '#8EF7B4',
  onSecondaryContainer: '#002111',

  // Tertiary - Midnight Sniper Amber
  tertiary: '#7B5800',
  onTertiary: '#FFFFFF',
  tertiaryContainer: '#FFDEA1',
  onTertiaryContainer: '#261900',

  // Surface elevation hierarchy
  surface: '#FAF9FD',
  surfaceDim: '#D7DADF',
  surfaceBright: '#FAF9FD',
  surfaceContainerLowest: '#FFFFFF',
  surfaceContainerLow: '#F2F4F9',
  surfaceContainer: '#ECEEF4',
  surfaceContainerHigh: '#E6E8EE',
  surfaceContainerHighest: '#E0E2E8',
  onSurface: '#181C20',
  onSurfaceVariant: '#42474E',
  inverseSurface: '#2D3136',
  inverseOnSurface: '#EFF1F7',

  // Outlines & Dividers
  outline: '#72777F',
  outlineVariant: '#C2C7CF',
  hairline: '#C2C7CF',

  // Error / Destructive
  error: '#BA1A1A',
  onError: '#FFFFFF',
  errorContainer: '#FFDAD6',
  onErrorContainer: '#410002',

  // Overlays
  scrim: 'rgba(0, 0, 0, 0.4)',
  shadow: 'rgba(24, 28, 32, 0.12)',

  // Backward-compatibility aliases mapped to M3 semantic roles
  bg: '#FAF9FD',
  surfaceRaised: '#F2F4F9',
  fill: '#ECEEF4',
  fillStrong: '#E0E2E8',
  ink: '#181C20',
  ink2: '#42474E',
  ink3: '#72777F',
  tube: '#00639B',
  tubeDeep: '#004B76',
  tubeInk: '#FFFFFF',
  tubeInk2: '#D0E4FF',
  tubeLight: '#ECEEF4',
  tubeLightDeep: '#E0E2E8',
  tint: '#00639B',
  tintSoft: '#D0E4FF',
  onTint: '#FFFFFF',
  gold: '#7B5800',
  goldInk: '#412D00',
  goldSoft: '#FFDEA1',
  cork: '#006D44',
  corkInk: '#002111',
  corkSoft: '#8EF7B4',
  feather: '#FAF9FD',
  smash: '#BA1A1A',
  smashSoft: '#FFDAD6',
  mat: '#00639B',
  courtLine: '#FFFFFF',
};

const dark: typeof light = {
  // Primary
  primary: '#96CCFF',
  onPrimary: '#003353',
  primaryContainer: '#004B76',
  onPrimaryContainer: '#D0E4FF',
  inversePrimary: '#00639B',

  // Secondary
  secondary: '#70DA9A',
  onSecondary: '#003920',
  secondaryContainer: '#005232',
  onSecondaryContainer: '#8EF7B4',

  // Tertiary
  tertiary: '#F5BF46',
  onTertiary: '#412D00',
  tertiaryContainer: '#5D4200',
  onTertiaryContainer: '#FFDEA1',

  // Surface elevation hierarchy
  surface: '#101418',
  surfaceDim: '#101418',
  surfaceBright: '#363A3F',
  surfaceContainerLowest: '#0B0F13',
  surfaceContainerLow: '#181C20',
  surfaceContainer: '#1D2025',
  surfaceContainerHigh: '#272A2F',
  surfaceContainerHighest: '#32353A',
  onSurface: '#E0E2E8',
  onSurfaceVariant: '#C2C7CF',
  inverseSurface: '#E0E2E8',
  inverseOnSurface: '#2D3136',

  // Outlines & Dividers
  outline: '#8C9199',
  outlineVariant: '#42474E',
  hairline: '#42474E',

  // Error / Destructive
  error: '#FFB4AB',
  onError: '#690005',
  errorContainer: '#93000A',
  onErrorContainer: '#FFDAD6',

  // Overlays
  scrim: 'rgba(0, 0, 0, 0.65)',
  shadow: 'rgba(0, 0, 0, 0.5)',

  // Backward-compatibility aliases mapped to M3 semantic roles
  bg: '#101418',
  surfaceRaised: '#181C20',
  fill: '#1D2025',
  fillStrong: '#32353A',
  ink: '#E0E2E8',
  ink2: '#C2C7CF',
  ink3: '#8C9199',
  tube: '#004B76',
  tubeDeep: '#003353',
  tubeInk: '#D0E4FF',
  tubeInk2: '#96CCFF',
  tubeLight: '#1D2025',
  tubeLightDeep: '#181C20',
  tint: '#96CCFF',
  tintSoft: '#004B76',
  onTint: '#003353',
  gold: '#F5BF46',
  goldInk: '#F5BF46',
  goldSoft: '#5D4200',
  cork: '#70DA9A',
  corkInk: '#8EF7B4',
  corkSoft: '#005232',
  feather: '#E0E2E8',
  smash: '#FFB4AB',
  smashSoft: '#93000A',
  mat: '#96CCFF',
  courtLine: '#003920',
};

export type Colors = typeof light;

export function useColors(): Colors {
  return useColorScheme() === 'dark' ? dark : light;
}

/**
 * Material Design 3 Type Scale
 * Clean system typography with proper tracking, line heights, and weights.
 */
export const type = {
  // Display
  displayLarge: { fontSize: 57, lineHeight: 64, letterSpacing: -0.25, fontWeight: '400' },
  displayMedium: { fontSize: 45, lineHeight: 52, letterSpacing: 0, fontWeight: '400' },
  displaySmall: { fontSize: 36, lineHeight: 44, letterSpacing: 0, fontWeight: '400' },

  // Headline
  headlineLarge: { fontSize: 32, lineHeight: 40, letterSpacing: 0, fontWeight: '400' },
  headlineMedium: { fontSize: 28, lineHeight: 36, letterSpacing: 0, fontWeight: '400' },
  headlineSmall: { fontSize: 24, lineHeight: 32, letterSpacing: 0, fontWeight: '400' },

  // Title
  titleLarge: { fontSize: 22, lineHeight: 28, letterSpacing: 0, fontWeight: '500' },
  titleMedium: { fontSize: 16, lineHeight: 24, letterSpacing: 0.15, fontWeight: '500' },
  titleSmall: { fontSize: 14, lineHeight: 20, letterSpacing: 0.1, fontWeight: '500' },

  // Body
  bodyLarge: { fontSize: 16, lineHeight: 24, letterSpacing: 0.5, fontWeight: '400' },
  bodyMedium: { fontSize: 14, lineHeight: 20, letterSpacing: 0.25, fontWeight: '400' },
  bodySmall: { fontSize: 12, lineHeight: 16, letterSpacing: 0.4, fontWeight: '400' },

  // Label
  labelLarge: { fontSize: 14, lineHeight: 20, letterSpacing: 0.1, fontWeight: '500' },
  labelMedium: { fontSize: 12, lineHeight: 16, letterSpacing: 0.5, fontWeight: '500' },
  labelSmall: { fontSize: 11, lineHeight: 16, letterSpacing: 0.5, fontWeight: '500' },

  // Backward-compatibility and sports utility type styles
  largeTitle: { fontSize: 28, lineHeight: 36, letterSpacing: 0, fontWeight: '500' },
  title: { fontSize: 20, lineHeight: 26, letterSpacing: 0.15, fontWeight: '500' },
  headline: { fontSize: 16, lineHeight: 22, letterSpacing: 0.15, fontWeight: '500' },
  body: { fontSize: 15, lineHeight: 22, letterSpacing: 0.25, fontWeight: '400' },
  callout: { fontSize: 14, lineHeight: 20, letterSpacing: 0.1, fontWeight: '500' },
  subhead: { fontSize: 13, lineHeight: 18, letterSpacing: 0.25, fontWeight: '400' },
  footnote: { fontSize: 12, lineHeight: 16, letterSpacing: 0.4, fontWeight: '400' },
  caption: { fontSize: 11, lineHeight: 16, letterSpacing: 0.5, fontWeight: '500' },
  label: { fontSize: 11, lineHeight: 16, letterSpacing: 0.8, textTransform: 'uppercase', fontWeight: '600' },
  clock: { fontSize: 38, lineHeight: 44, letterSpacing: 0, fontWeight: '700', fontVariant: ['tabular-nums'] },
  numeral: { fontSize: 28, lineHeight: 34, letterSpacing: 0, fontWeight: '700', fontVariant: ['tabular-nums'] },
  time: { fontSize: 15, lineHeight: 20, letterSpacing: 0.1, fontWeight: '600', fontVariant: ['tabular-nums'] },
  day: { fontSize: 18, lineHeight: 22, letterSpacing: 0, fontWeight: '600', fontVariant: ['tabular-nums'] },
} satisfies Record<string, TextStyle>;

/**
 * Material Design 3 Shape Tokens
 */
export const shape = {
  none: 0,
  extraSmall: 4,
  small: 8,
  medium: 12,
  large: 16,
  extraLarge: 28,
  full: 9999,
} as const;

/** Radius compatibility map */
export const radius = {
  chamber: shape.medium,
  card: shape.large,
  tube: shape.large,
  sheet: shape.extraLarge,
  capsule: shape.full,
} as const;

/**
 * Material Design 3 Spacing System (8dp Grid)
 */
export const space = {
  xs: 4,
  s: 8,
  m: 12,
  l: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

/**
 * Material Design 3 Elevation
 */
export const elevation = {
  level0: 0,
  level1: 1,
  level2: 3,
  level3: 6,
  level4: 8,
  level5: 12,
} as const;

/**
 * Material Design 3 Motion Curves
 */
export const EASE_STANDARD = Easing.bezier(0.2, 0.0, 0, 1.0);
export const EASE_DECELERATE = Easing.bezier(0.0, 0.0, 0.2, 1.0);
export const EASE_ACCELERATE = Easing.bezier(0.3, 0.0, 1.0, 1.0);
export const EASE_EMPHASIZED = Easing.bezier(0.2, 0.0, 0.0, 1.0);

export const EASE_OUT = EASE_DECELERATE;
export const EASE_IN_OUT = EASE_STANDARD;

export const springs = {
  settle: { duration: 300, dampingRatio: 0.9 },
  sheet: { duration: 320, dampingRatio: 0.92 },
  snap: { duration: 250, dampingRatio: 0.88 },
  land: { duration: 350, dampingRatio: 0.85 },
} as const;
