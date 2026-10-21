import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Press, Txt } from '../ui';
import { radius, space, useColors } from '../theme';
import { requestSignIn, useSession } from '../services/session';
import { SlotStatus } from '../types';

// ---------------------------------------------------------------- Session pill

/** Where the session stands, in every screen's header; tap it to sign in. */
export function SessionPill({ onOpenSettings }: { onOpenSettings?: () => void }) {
  const c = useColors();
  const session = useSession();
  const look =
    session === 'signed_in'
      ? { text: 'Signed in', color: c.mat, bg: c.matSoft }
      : session === 'signed_out'
        ? { text: 'Sign in', color: c.cork, bg: c.corkSoft }
        : session === 'offline'
          ? { text: 'Offline', color: c.ink2, bg: c.fill }
          : { text: 'Checking', color: c.ink3, bg: c.fill };
  return (
    <Press
      onPress={() => (session === 'signed_in' ? onOpenSettings?.() : requestSignIn())}
      style={[styles.pill, { backgroundColor: look.bg }]}
      accessibilityLabel={`UMPoint: ${look.text}`}
    >
      <View style={[styles.dot, { backgroundColor: look.color }]} />
      <Txt variant="footnote" color={look.color} style={{ fontWeight: '600' }}>
        {look.text}
      </Txt>
    </Press>
  );
}

export function ScreenHeader({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <View style={styles.header}>
      <Txt variant="largeTitle" accessibilityRole="header">
        {title}
      </Txt>
      {right}
    </View>
  );
}

// ---------------------------------------------------------------- Courts

/** A court seen from above: the mat, its outline, the net and the short service lines. */
export function CourtTile({
  status,
  selected,
  label,
  onPress,
}: {
  status: SlotStatus;
  selected: boolean;
  label: string;
  onPress?: () => void;
}) {
  const c = useColors();
  const free = status === 'free';
  const bg = free ? c.mat : status === 'mine' ? c.cork : c.taken;
  const line = free || status === 'mine' ? c.courtLine : c.surface;
  const caption = status === 'free' ? 'Free' : status === 'mine' ? 'Yours' : status === 'closed' ? 'Closed' : 'Taken';
  return (
    <Press
      onPress={onPress}
      disabled={!free}
      haptic="selection"
      style={styles.courtWrap}
      accessibilityRole="radio"
      accessibilityLabel={`${label}, ${caption}`}
      accessibilityState={{ selected, disabled: !free }}
    >
      <View
        style={[
          styles.court,
          { backgroundColor: bg, borderColor: selected ? c.ink : 'transparent' },
        ]}
      >
        <View style={[styles.courtOutline, { borderColor: line, opacity: free ? 0.9 : 0.5 }]}>
          <View style={[styles.serviceLine, { top: '36%', backgroundColor: line }]} />
          <View style={[styles.net, { backgroundColor: line }]} />
          <View style={[styles.serviceLine, { bottom: '36%', backgroundColor: line }]} />
          <View style={[styles.centreLine, { top: 0, bottom: '64%', backgroundColor: line }]} />
          <View style={[styles.centreLine, { bottom: 0, top: '64%', backgroundColor: line }]} />
        </View>
        {selected ? (
          <View style={[styles.check, { backgroundColor: c.ink }]}>
            <Ionicons name="checkmark" size={14} color={c.surface} />
          </View>
        ) : null}
      </View>
      <Txt variant="callout" style={{ marginTop: 6 }}>
        {label}
      </Txt>
      <Txt variant="footnote" color={free ? c.mat : status === 'mine' ? c.cork : c.ink3}>
        {caption}
      </Txt>
    </Press>
  );
}

/** The four courts at one time, as small marks in a row. */
export function CourtMarks({ statuses }: { statuses: SlotStatus[] }) {
  const c = useColors();
  return (
    <View style={styles.marks} accessible={false}>
      {statuses.map((s, i) => (
        <View
          key={i}
          style={[
            styles.mark,
            s === 'free'
              ? { backgroundColor: c.mat }
              : s === 'mine'
                ? { backgroundColor: c.cork }
                : { backgroundColor: 'transparent', borderColor: c.taken, borderWidth: 1.5 },
          ]}
        />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------- Toast

type Toast = { id: number; text: string; tone: 'mat' | 'smash' | 'plain' };
const ToastContext = createContext<(text: string, tone?: Toast['tone']) => void>(() => {});

export const useToast = () => useContext(ToastContext);

/** A short line from the top edge after something finishes, instead of a dialog to dismiss. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((text: string, tone: Toast['tone'] = 'mat') => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ id: Date.now(), text, tone });
    timer.current = setTimeout(() => setToast(null), 3200);
  }, []);
  const accent = toast?.tone === 'smash' ? c.smash : toast?.tone === 'plain' ? c.ink2 : c.mat;
  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast ? (
        <Animated.View
          key={toast.id}
          entering={FadeInUp.duration(220)}
          exiting={FadeOutUp.duration(180)}
          style={[styles.toast, { top: insets.top + space.s, backgroundColor: c.surfaceRaised }]}
          accessibilityLiveRegion="polite"
        >
          <View style={[styles.toastBar, { backgroundColor: accent }]} />
          <Txt variant="callout" style={{ flex: 1 }}>
            {toast.text}
          </Txt>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.l,
    paddingTop: space.s,
    paddingBottom: space.m,
  },
  courtWrap: {
    flex: 1,
    alignItems: 'center',
  },
  court: {
    width: '100%',
    aspectRatio: 0.56,
    borderRadius: radius.s,
    borderWidth: 2.5,
    padding: 7,
  },
  courtOutline: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 2,
  },
  net: {
    position: 'absolute',
    left: -4,
    right: -4,
    top: '50%',
    height: 2.5,
    marginTop: -1,
  },
  serviceLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1.5,
  },
  centreLine: {
    position: 'absolute',
    left: '50%',
    width: 1.5,
    marginLeft: -0.75,
  },
  check: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  marks: {
    flexDirection: 'row',
    gap: 4,
  },
  mark: {
    width: 10,
    height: 16,
    borderRadius: 3,
  },
  toast: {
    position: 'absolute',
    left: space.l,
    right: space.l,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    paddingVertical: space.m,
    paddingRight: space.l,
    borderRadius: radius.m,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
    overflow: 'hidden',
  },
  toastBar: {
    width: 4,
    alignSelf: 'stretch',
  },
});
