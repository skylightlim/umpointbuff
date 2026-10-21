import React, { useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  ActivityIndicator,
  LayoutChangeEvent,
  Modal,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextProps,
  View,
  ViewStyle,
} from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { GestureDetector, GestureHandlerRootView, usePanGesture } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { EASE_OUT, radius, space, springs, type, useColors } from '../theme';

// ---------------------------------------------------------------- Text

type Variant = keyof typeof type;

export function Txt({
  variant = 'body',
  color,
  style,
  ...rest
}: TextProps & { variant?: Variant; color?: string }) {
  const c = useColors();
  return <Text {...rest} style={[type[variant], { color: color ?? c.ink }, style]} />;
}

// ---------------------------------------------------------------- Press feedback

/**
 * Every pressable: feedback on press-in (3% scale, 120ms), commit on release. Pressed often,
 * so it stays near-imperceptible.
 */
export function Press({
  onPress,
  disabled,
  style,
  children,
  haptic,
  accessibilityLabel,
  accessibilityRole = 'button',
  accessibilityState,
}: {
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
  haptic?: 'selection' | 'light';
  accessibilityLabel?: string;
  accessibilityRole?: 'button' | 'tab' | 'radio' | 'switch';
  accessibilityState?: { selected?: boolean; disabled?: boolean; checked?: boolean };
}) {
  const scale = useSharedValue(1);
  const scaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return (
    <Pressable
      onPress={() => {
        if (haptic === 'selection') Haptics.selectionAsync();
        if (haptic === 'light') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.();
      }}
      onPressIn={() => scale.set(withTiming(0.97, { duration: 100, easing: EASE_OUT }))}
      onPressOut={() => scale.set(withTiming(1, { duration: 160, easing: EASE_OUT }))}
      disabled={disabled}
      hitSlop={8}
      pressRetentionOffset={16}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      accessibilityState={{ disabled, ...accessibilityState }}
    >
      <Animated.View style={[style, !disabled && scaleStyle]}>{children}</Animated.View>
    </Pressable>
  );
}

// ---------------------------------------------------------------- Buttons

export function Button({
  label,
  onPress,
  tone = 'mat',
  icon,
  loading,
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  tone?: 'mat' | 'smash' | 'plain';
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  const bg = tone === 'mat' ? c.mat : tone === 'smash' ? c.smash : c.fill;
  const fg = tone === 'plain' ? c.ink : c.onAccent;
  return (
    <Press
      onPress={onPress}
      disabled={disabled || loading}
      style={[styles.button, { backgroundColor: bg, opacity: disabled ? 0.45 : 1 }, style]}
      accessibilityLabel={label}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
          <Txt variant="headline" color={fg}>
            {label}
          </Txt>
        </>
      )}
    </Press>
  );
}

// ---------------------------------------------------------------- Surfaces

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  return <View style={[styles.card, { backgroundColor: c.surface }, style]}>{children}</View>;
}

export function SectionTitle({ children, right }: { children: string; right?: React.ReactNode }) {
  const c = useColors();
  return (
    <View style={styles.sectionTitle}>
      <Txt variant="caption" color={c.ink3}>
        {children}
      </Txt>
      {right}
    </View>
  );
}

export function Hairline({ inset = 0 }: { inset?: number }) {
  const c = useColors();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.hairline, marginLeft: inset }} />;
}

// ---------------------------------------------------------------- Segmented control

/** Two or three peers; the thumb slides because it marks a position, not a page. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; badge?: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const c = useColors();
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const thumbW = width / options.length;
  const thumbX = useSharedValue(0);
  useEffect(() => {
    thumbX.set(withTiming(index * thumbW, { duration: 200, easing: EASE_OUT }));
  }, [index, thumbW, thumbX]);
  const thumbStyle = useAnimatedStyle(() => ({ transform: [{ translateX: thumbX.get() }] }));
  return (
    <View
      style={[styles.segmented, { backgroundColor: c.fill }]}
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width - 4)}
      accessibilityRole="tablist"
    >
      {width > 0 ? (
        <Animated.View
          style={[
            styles.segThumb,
            { width: thumbW, backgroundColor: c.surfaceRaised },
            thumbStyle,
          ]}
        />
      ) : null}
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            style={styles.segItem}
            onPress={() => {
              if (!selected) {
                Haptics.selectionAsync();
                onChange(o.value);
              }
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
          >
            <Txt variant="callout" color={selected ? c.ink : c.ink2} style={{ fontWeight: selected ? '600' : '500' }}>
              {o.label}
            </Txt>
            {o.badge ? (
              <View style={[styles.segBadge, { backgroundColor: c.smashSoft }]}>
                <Txt variant="caption" color={c.smash} style={{ fontSize: 9, lineHeight: 11 }}>
                  {o.badge}
                </Txt>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------- Bottom sheet

export type SheetHandle = { open: () => void; close: () => void };

function project(velocity: number, decelerationRate = 0.998) {
  'worklet';
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

function rubberband(overshoot: number, dimension: number, constant = 0.55) {
  'worklet';
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

/**
 * A sheet that rises from the bottom edge and goes back the same way: drag it, flick it,
 * tap the scrim. The release velocity carries into the spring, so there is no seam.
 */
export function Sheet({
  ref,
  onClosed,
  children,
}: {
  ref: React.Ref<SheetHandle>;
  onClosed?: () => void;
  children: React.ReactNode;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  const pendingOpen = useRef(false);
  const height = useSharedValue(1000);
  const y = useSharedValue(1000);
  const startY = useSharedValue(0);

  const finish = () => {
    setMounted(false);
    onClosed?.();
  };

  const close = () => {
    const h = height.get();
    if (reduced) {
      y.set(withTiming(h, { duration: 150 }, (done) => done && scheduleOnRN(finish)));
    } else {
      y.set(withSpring(h, { ...springs.sheet, dampingRatio: 1, overshootClamping: true }, (done) => {
        if (done) scheduleOnRN(finish);
      }));
    }
  };

  useImperativeHandle(ref, () => ({
    open: () => {
      pendingOpen.current = true;
      y.set(10_000); // off-screen until measured, then it rises from its own height
      setMounted(true);
    },
    close,
  }));

  const onLayout = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    height.set(h);
    if (pendingOpen.current) {
      pendingOpen.current = false;
      y.set(h);
      y.set(reduced ? withTiming(0, { duration: 200, easing: EASE_OUT }) : withSpring(0, springs.sheet));
    }
  };

  const pan = usePanGesture({
    activeOffsetY: [-10, 10],
    onActivate: () => {
      'worklet';
      startY.set(y.get()); // grab it where the eye last saw it
    },
    onUpdate: (e) => {
      'worklet';
      const next = startY.get() + e.translationY;
      y.set(next >= 0 ? next : rubberband(next, height.get()));
    },
    onDeactivate: (e) => {
      'worklet';
      const h = height.get();
      if (y.get() + project(e.velocityY) > h * 0.35) {
        y.set(withSpring(h, { ...springs.sheet, dampingRatio: 1, velocity: e.velocityY, overshootClamping: true }, (done) => {
          if (done) scheduleOnRN(finish);
        }));
      } else {
        y.set(withSpring(0, { ...springs.snap, velocity: e.velocityY }));
      }
    },
  });

  const panelStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }] }));
  const scrimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(y.get(), [0, height.get()], [1, 0], Extrapolation.CLAMP),
  }));

  if (!mounted) return null;
  return (
    <Modal transparent visible statusBarTranslucent navigationBarTranslucent animationType="none" onRequestClose={close}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }, scrimStyle]}>
          <Pressable style={{ flex: 1 }} onPress={close} accessibilityLabel="Close" />
        </Animated.View>
        <GestureDetector gesture={pan}>
          <Animated.View
            onLayout={onLayout}
            style={[
              styles.sheet,
              { backgroundColor: c.surface, paddingBottom: insets.bottom + space.l },
              panelStyle,
            ]}
          >
            <View style={[styles.grabber, { backgroundColor: c.hairline }]} />
            {children}
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    borderRadius: radius.m,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.s,
    paddingHorizontal: space.l,
  },
  card: {
    borderRadius: radius.l,
    padding: space.l,
  },
  sectionTitle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space.xs,
    marginBottom: space.s,
  },
  segmented: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 2,
    height: 38,
  },
  segThumb: {
    position: 'absolute',
    top: 2,
    bottom: 2,
    left: 2,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  segItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  segBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 5,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingHorizontal: space.l,
    paddingTop: space.s,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    marginBottom: space.m,
  },
});
