import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { RefreshControlProps, StyleSheet, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  Keyframe,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { IconName, Press, Txt } from '../ui';
import { EASE_DECELERATE, elevation, shape, space, useColors } from '../theme';
import { requestSignIn, useSession } from '../services/session';
import { SlotStatus } from '../types';

// ---------------------------------------------------------------- Screen Chrome & Top App Bar

export const TAB_CLEARANCE = 88;

/**
 * Material 3 Account / Session Button
 * Tonal chip indicating Google / UMPoint authentication state.
 */
export function AccountButton({ onOpenSettings }: { onOpenSettings: () => void }) {
  const c = useColors();
  const session = useSession();

  if (session === 'signed_out') {
    return (
      <Press
        onPress={() => requestSignIn()}
        style={[styles.signIn, { backgroundColor: c.primary }]}
        accessibilityLabel="Sign in to UMPoint"
      >
        <Ionicons name="log-in-outline" size={18} color={c.onPrimary} />
        <Txt variant="labelLarge" color={c.onPrimary} style={styles.bold}>
          Sign in
        </Txt>
      </Press>
    );
  }

  const dot = session === 'signed_in' ? c.secondary : session === 'offline' ? c.error : c.outline;
  const label =
    session === 'signed_in' ? 'Settings, signed in' : session === 'offline' ? 'Settings, can’t reach UMPoint' : 'Settings';

  return (
    <Press
      onPress={onOpenSettings}
      style={[styles.account, { backgroundColor: c.surfaceContainerHigh }]}
      accessibilityLabel={label}
    >
      <Ionicons name={session === 'offline' ? 'cloud-offline-outline' : 'person'} size={18} color={c.onSurfaceVariant} />
      <View style={[styles.accountDot, { backgroundColor: dot, borderColor: c.surface }]} />
    </Press>
  );
}

export function SessionPill({ onOpenSettings }: { onOpenSettings: () => void }) {
  return <AccountButton onOpenSettings={onOpenSettings} />;
}

/**
 * Material 3 Top App Bar
 */
export function LargeHeader({ title, right }: { title: string; right?: React.ReactNode }) {
  const c = useColors();
  return (
    <View style={styles.header}>
      <Txt variant="headlineMedium" color={c.onSurface} accessibilityRole="header" numberOfLines={1} style={styles.headerTitle}>
        {title}
      </Txt>
      {right}
    </View>
  );
}

export function ScreenHeader({ title, right }: { title: string; right?: React.ReactNode }) {
  return <LargeHeader title={title} right={right} />;
}

/**
 * Material 3 Scrollable Container with collapsible Top App Bar
 */
export function ScrollScreen({
  title,
  right,
  refreshControl,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  children: React.ReactNode;
}) {
  const c = useColors();
  const scrollY = useSharedValue(0);

  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.set(e.contentOffset.y);
  });

  const barStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.get(), [24, 48], [0, 1], Extrapolation.CLAMP),
    elevation: interpolate(scrollY.get(), [24, 48], [0, elevation.level2], Extrapolation.CLAMP),
  }));

  return (
    <View style={[styles.flex, { backgroundColor: c.surface }]}>
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        refreshControl={refreshControl}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <LargeHeader title={title} right={right} />
        {children}
      </Animated.ScrollView>
      <Animated.View pointerEvents="none" style={[styles.compactBar, { backgroundColor: c.surfaceContainer }, barStyle]}>
        <Txt variant="titleLarge" color={c.onSurface}>{title}</Txt>
      </Animated.View>
    </View>
  );
}

// ---------------------------------------------------------------- Material 3 Court Status & Tiles

const meterColor = (s: SlotStatus | 'armed', c: ReturnType<typeof useColors>) =>
  s === 'free' ? c.secondary : s === 'mine' ? c.tertiary : s === 'armed' ? c.primary : c.outlineVariant;

export function CourtMeter({ statuses }: { statuses: (SlotStatus | 'armed')[] }) {
  const c = useColors();
  return (
    <View style={[styles.meter, { backgroundColor: c.surfaceContainerHighest }]} accessible={false}>
      {statuses.map((s, i) => (
        <View key={i} style={[styles.meterCell, { backgroundColor: meterColor(s, c) }]} />
      ))}
    </View>
  );
}

/**
 * Material 3 Court Tile
 * Clean schematic view of badminton court with M3 state styling.
 */
export function CourtTile({
  status,
  selected,
  court,
  onPress,
}: {
  status: SlotStatus;
  selected: boolean;
  court: string;
  onPress?: () => void;
}) {
  const c = useColors();
  const free = status === 'free';
  const mine = status === 'mine';

  const bg = free
    ? selected
      ? c.secondaryContainer
      : c.surfaceContainerLow
    : mine
      ? c.tertiaryContainer
      : c.surfaceContainerHighest;

  const line = free || mine ? (selected ? c.onSecondaryContainer : c.outline) : c.outlineVariant;
  const caption = free ? 'Free' : mine ? 'Yours' : status === 'closed' ? 'Closed' : 'Taken';

  return (
    <Press
      onPress={onPress}
      disabled={!free}
      haptic="selection"
      style={styles.courtWrap}
      accessibilityRole="radio"
      accessibilityLabel={`Court ${court}, ${caption}`}
      accessibilityState={{ selected, disabled: !free }}
    >
      <View
        style={[
          styles.court,
          {
            backgroundColor: bg,
            borderColor: selected ? c.secondary : c.outlineVariant,
            borderWidth: selected ? 2 : 1,
          },
        ]}
      >
        <View style={[styles.courtOutline, { borderColor: line }]}>
          <View style={[styles.serviceLine, { top: '35%', backgroundColor: line }]} />
          <View style={[styles.net, { backgroundColor: line }]} />
          <View style={[styles.serviceLine, { bottom: '35%', backgroundColor: line }]} />
          <View style={[styles.centreLine, { top: 0, bottom: '65%', backgroundColor: line }]} />
          <View style={[styles.centreLine, { bottom: 0, top: '65%', backgroundColor: line }]} />
        </View>
        {selected ? (
          <View style={[styles.check, { backgroundColor: c.secondary }]}>
            <Ionicons name="checkmark" size={13} color={c.onSecondary} />
          </View>
        ) : null}
      </View>
      <Txt variant="titleSmall" color={free ? c.onSurface : c.outline} style={[styles.courtLabel, selected && styles.bold]}>
        Court {court}
      </Txt>
      <Txt variant="bodySmall" color={free ? (selected ? c.secondary : c.onSurfaceVariant) : mine ? c.tertiary : c.outline}>
        {caption}
      </Txt>
    </Press>
  );
}

// ---------------------------------------------------------------- Material 3 Empty State

export function Empty({
  icon,
  title,
  text,
  action,
}: {
  icon: IconName;
  title: string;
  text: string;
  action?: React.ReactNode;
}) {
  const c = useColors();
  return (
    <View style={styles.emptyContainer}>
      <View style={[styles.emptyIconCircle, { backgroundColor: c.surfaceContainerHighest }]}>
        <Ionicons name={icon} size={36} color={c.onSurfaceVariant} />
      </View>
      <Txt variant="titleMedium" color={c.onSurface} style={styles.emptyTitle}>
        {title}
      </Txt>
      <Txt variant="bodyMedium" color={c.onSurfaceVariant} style={styles.emptyText}>
        {text}
      </Txt>
      {action ? <View style={styles.emptyAction}>{action}</View> : null}
    </View>
  );
}

// ---------------------------------------------------------------- Material 3 Snackbar (Toast)

export type ToastTone = 'booked' | 'armed' | 'plain' | 'error';
type Toast = { id: number; text: string; tone: ToastTone };
const ToastContext = createContext<(text: string, tone?: ToastTone) => void>(() => {});

export const useToast = () => useContext(ToastContext);

const TOAST_IN = new Keyframe({
  0: { opacity: 0, transform: [{ translateY: 16 }, { scale: 0.95 }] },
  100: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }], easing: EASE_DECELERATE },
}).duration(240);

const TOAST_OUT = new Keyframe({
  0: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
  100: { opacity: 0, transform: [{ translateY: 12 }, { scale: 0.98 }], easing: EASE_DECELERATE },
}).duration(180);

const TOAST_ICON: Record<ToastTone, IconName> = {
  booked: 'checkmark-circle',
  armed: 'locate',
  plain: 'information-circle',
  error: 'alert-circle',
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((text: string, tone: ToastTone = 'plain') => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ id: Date.now(), text, tone });
    timer.current = setTimeout(() => setToast(null), tone === 'error' ? 5000 : 3400);
  }, []);

  const iconColor =
    toast?.tone === 'armed'
      ? c.tertiary
      : toast?.tone === 'booked'
        ? c.secondary
        : toast?.tone === 'error'
          ? c.error
          : c.inversePrimary;

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast ? (
        <Animated.View
          key={toast.id}
          entering={TOAST_IN}
          exiting={TOAST_OUT}
          style={[styles.toastWrap, { bottom: Math.max(insets.bottom, 16) + 84 }]}
          pointerEvents="box-none"
        >
          <Press
            onPress={() => setToast(null)}
            style={[styles.toast, { backgroundColor: c.inverseSurface }]}
            accessibilityLabel={`${toast.text}. Dismiss`}
          >
            <Ionicons name={TOAST_ICON[toast.tone]} size={20} color={iconColor} />
            <Txt variant="bodyMedium" color={c.inverseOnSurface} style={styles.toastText} accessibilityLiveRegion="polite">
              {toast.text}
            </Txt>
          </Press>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  bold: {
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.l,
    paddingTop: space.m,
    paddingBottom: space.m,
    minHeight: 64,
  },
  headerTitle: {
    flexShrink: 1,
  },
  scrollContent: {
    paddingBottom: TAB_CLEARANCE + space.xl,
  },
  compactBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  account: {
    width: 40,
    height: 40,
    borderRadius: shape.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountDot: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
  },
  signIn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 40,
    paddingHorizontal: 16,
    borderRadius: shape.full,
  },
  meter: {
    flexDirection: 'row',
    width: 56,
    height: 12,
    borderRadius: shape.full,
    padding: 2,
    gap: 2,
  },
  meterCell: {
    flex: 1,
    borderRadius: shape.full,
  },
  courtWrap: {
    flex: 1,
    alignItems: 'center',
  },
  court: {
    width: '100%',
    aspectRatio: 0.62,
    borderRadius: shape.small,
    padding: 6,
    justifyContent: 'center',
  },
  courtOutline: {
    ...StyleSheet.absoluteFill,
    margin: 6,
    borderWidth: 1.2,
    borderRadius: 2,
  },
  net: {
    position: 'absolute',
    left: -3,
    right: -3,
    top: '50%',
    height: 2,
    marginTop: -1,
  },
  serviceLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
  },
  centreLine: {
    position: 'absolute',
    left: '50%',
    width: 1,
    marginLeft: -0.5,
  },
  check: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  courtLabel: {
    marginTop: space.s,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space.xxxl,
    paddingHorizontal: space.xl,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.l,
  },
  emptyTitle: {
    textAlign: 'center',
    marginBottom: space.s,
  },
  emptyText: {
    textAlign: 'center',
  },
  emptyAction: {
    marginTop: space.l,
  },
  toastWrap: {
    position: 'absolute',
    left: space.l,
    right: space.l,
    alignItems: 'center',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    minHeight: 48,
    paddingVertical: space.m,
    paddingHorizontal: space.l,
    borderRadius: shape.small,
    elevation: elevation.level3,
    maxWidth: 480,
    width: '100%',
  },
  toastText: {
    flex: 1,
  },
});
