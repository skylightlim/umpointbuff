import React, { useImperativeHandle, useRef, useState } from 'react';
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
import { Colors, EASE_DECELERATE, EASE_STANDARD, elevation, shape, space, springs, type, useColors } from '../theme';

export type IconName = keyof typeof Ionicons.glyphMap;

// ---------------------------------------------------------------- Typography

type Variant = keyof typeof type;

export function Txt({
  variant = 'bodyMedium',
  color,
  style,
  ...rest
}: TextProps & { variant?: Variant; color?: string }) {
  const c = useColors();
  return <Text {...rest} style={[type[variant], { color: color ?? c.onSurface }, style]} />;
}

// ---------------------------------------------------------------- Press Feedback

/**
 * Material 3 State Layer / Interactive Surface
 * Supports tactile feedback and subtle pressed elevation / opacity.
 */
export function Press({
  onPress,
  onLongPress,
  disabled,
  style,
  children,
  haptic,
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole = 'button',
  accessibilityState,
}: {
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
  haptic?: 'selection' | 'light';
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityRole?: 'button' | 'tab' | 'radio' | 'switch' | 'link';
  accessibilityState?: { selected?: boolean; disabled?: boolean; checked?: boolean; expanded?: boolean };
}) {
  return (
    <Pressable
      onPress={() => {
        if (haptic === 'selection') Haptics.selectionAsync();
        if (haptic === 'light') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.();
      }}
      onLongPress={onLongPress}
      disabled={disabled}
      hitSlop={8}
      pressRetentionOffset={16}
      style={({ pressed }) => [
        style,
        pressed && !disabled && { opacity: 0.76 },
      ]}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityRole={accessibilityRole}
      accessibilityState={{ disabled, ...accessibilityState }}
    >
      {children}
    </Pressable>
  );
}

// ---------------------------------------------------------------- Material 3 Buttons

export type ButtonTone = 'filled' | 'tonal' | 'outlined' | 'text' | 'danger' | 'tube' | 'gold' | 'tint' | 'plain';

function getButtonColors(c: Colors, tone: ButtonTone) {
  switch (tone) {
    case 'tonal':
    case 'tint':
      return { bg: c.secondaryContainer, fg: c.onSecondaryContainer, border: 'transparent' };
    case 'outlined':
      return { bg: 'transparent', fg: c.primary, border: c.outline };
    case 'text':
    case 'plain':
      return { bg: 'transparent', fg: c.primary, border: 'transparent' };
    case 'danger':
      return { bg: c.errorContainer, fg: c.onErrorContainer, border: 'transparent' };
    case 'gold':
      return { bg: c.tertiaryContainer, fg: c.onTertiaryContainer, border: 'transparent' };
    case 'filled':
    case 'tube':
    default:
      return { bg: c.primary, fg: c.onPrimary, border: 'transparent' };
  }
}

/**
 * Material 3 Button
 * Conforms to M3 Button specs: 40dp standard height (or 48dp large), rounded pill shape.
 */
export function Button({
  label,
  onPress,
  tone = 'filled',
  icon,
  loading,
  disabled,
  size = 'l',
  style,
  accessibilityHint,
}: {
  label: string;
  onPress: () => void;
  tone?: ButtonTone;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  size?: 'l' | 'm';
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
}) {
  const c = useColors();
  const { bg, fg, border } = getButtonColors(c, tone);
  const isOutlined = tone === 'outlined';

  return (
    <Press
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.button,
        size === 'm' ? styles.buttonM : styles.buttonL,
        {
          backgroundColor: disabled ? c.surfaceContainerHighest : bg,
          borderColor: disabled ? c.outlineVariant : border,
          borderWidth: isOutlined ? 1 : 0,
          opacity: disabled ? 0.6 : 1,
        },
        style,
      ]}
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
    >
      {loading ? (
        <ActivityIndicator color={disabled ? c.onSurfaceVariant : fg} size="small" />
      ) : (
        <View style={styles.buttonContent}>
          {icon ? <Ionicons name={icon} size={size === 'm' ? 18 : 20} color={disabled ? c.onSurfaceVariant : fg} style={styles.buttonIcon} /> : null}
          <Txt
            variant={size === 'm' ? 'labelMedium' : 'labelLarge'}
            color={disabled ? c.onSurfaceVariant : fg}
            numberOfLines={1}
            style={styles.buttonLabel}
          >
            {label}
          </Txt>
        </View>
      )}
    </Press>
  );
}

/**
 * Material 3 Icon Button
 * 40dp container, 48dp min touch target.
 */
export function IconButton({
  icon,
  onPress,
  label,
  color,
  background,
  variant = 'standard',
  size = 40,
}: {
  icon: IconName;
  onPress: () => void;
  label: string;
  color?: string;
  background?: string;
  variant?: 'standard' | 'filled' | 'tonal' | 'outlined';
  size?: number;
}) {
  const c = useColors();
  const bg =
    background ??
    (variant === 'filled'
      ? c.primary
      : variant === 'tonal'
        ? c.secondaryContainer
        : variant === 'outlined'
          ? 'transparent'
          : 'transparent');
  const fg =
    color ??
    (variant === 'filled'
      ? c.onPrimary
      : variant === 'tonal'
        ? c.onSecondaryContainer
        : c.onSurfaceVariant);
  const border = variant === 'outlined' ? c.outlineVariant : 'transparent';

  return (
    <Press
      onPress={onPress}
      style={[
        styles.iconButton,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bg,
          borderColor: border,
          borderWidth: variant === 'outlined' ? 1 : 0,
        },
      ]}
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={Math.round(size * 0.55)} color={fg} />
    </Press>
  );
}

// ---------------------------------------------------------------- Material 3 Cards

export type CardVariant = 'elevated' | 'filled' | 'outlined';

export function Card({
  variant = 'filled',
  style,
  children,
}: {
  variant?: CardVariant;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const c = useColors();

  const variantStyle: ViewStyle =
    variant === 'elevated'
      ? {
          backgroundColor: c.surfaceContainerLow,
          elevation: elevation.level1,
          shadowColor: c.shadow,
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.15,
          shadowRadius: 3,
        }
      : variant === 'outlined'
        ? {
            backgroundColor: c.surface,
            borderWidth: 1,
            borderColor: c.outlineVariant,
          }
        : {
            backgroundColor: c.surfaceContainer,
          };

  return <View style={[styles.card, variantStyle, style]}>{children}</View>;
}

// ---------------------------------------------------------------- Material 3 List & Groups

export function Group({
  title,
  right,
  footer,
  children,
  style,
}: {
  title?: string;
  right?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  const rows = React.Children.toArray(children).filter(Boolean);

  return (
    <View style={[styles.group, style]}>
      {title ? (
        <View style={styles.groupHeader}>
          <Txt variant="titleSmall" color={c.primary} accessibilityRole="header">
            {title}
          </Txt>
          {right}
        </View>
      ) : null}
      <View style={[styles.groupBody, { backgroundColor: c.surfaceContainerLow, borderColor: c.outlineVariant }]}>
        {rows.map((row, i) => (
          <React.Fragment key={i}>
            {i > 0 ? <Hairline inset={space.l} /> : null}
            {row}
          </React.Fragment>
        ))}
      </View>
      {footer ? (
        typeof footer === 'string' ? (
          <Txt variant="bodySmall" color={c.onSurfaceVariant} style={styles.groupFooter}>
            {footer}
          </Txt>
        ) : (
          <View style={styles.groupFooter}>{footer}</View>
        )
      ) : null}
    </View>
  );
}

export function Row({
  icon,
  iconColor,
  title,
  subtitle,
  value,
  right,
  onPress,
  chevron,
  destructive,
  accessibilityLabel,
}: {
  icon?: IconName;
  iconColor?: string;
  title: string;
  subtitle?: string;
  value?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  destructive?: boolean;
  accessibilityLabel?: string;
}) {
  const c = useColors();
  const body = (
    <View style={styles.row}>
      {icon ? <Ionicons name={icon} size={22} color={iconColor ?? c.onSurfaceVariant} style={styles.rowIcon} /> : null}
      <View style={styles.flex}>
        <Txt variant="bodyLarge" color={destructive ? c.error : c.onSurface}>
          {title}
        </Txt>
        {subtitle ? (
          <Txt variant="bodySmall" color={c.onSurfaceVariant} style={styles.rowSubtitle}>
            {subtitle}
          </Txt>
        ) : null}
      </View>
      {value ? (
        <Txt variant="bodyMedium" color={c.onSurfaceVariant}>
          {value}
        </Txt>
      ) : null}
      {right}
      {chevron ? <Ionicons name="chevron-forward" size={18} color={c.outline} /> : null}
    </View>
  );

  if (!onPress) return body;
  return (
    <Press onPress={onPress} accessibilityLabel={accessibilityLabel ?? title}>
      {body}
    </Press>
  );
}

export function Hairline({ inset = 0, color }: { inset?: number; color?: string }) {
  const c = useColors();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: color ?? c.outlineVariant, marginLeft: inset }} />;
}

// ---------------------------------------------------------------- Material 3 Chips

export function Chip({
  label,
  selected,
  onPress,
  icon,
  style,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  const bg = selected ? c.secondaryContainer : 'transparent';
  const fg = selected ? c.onSecondaryContainer : c.onSurfaceVariant;
  const borderColor = selected ? 'transparent' : c.outlineVariant;

  return (
    <Press
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: bg,
          borderColor: borderColor,
        },
        style,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      {selected ? (
        <Ionicons name="checkmark" size={16} color={fg} style={{ marginRight: 4 }} />
      ) : icon ? (
        <Ionicons name={icon} size={16} color={fg} style={{ marginRight: 4 }} />
      ) : null}
      <Txt variant="labelMedium" color={fg}>
        {label}
      </Txt>
    </Press>
  );
}

// ---------------------------------------------------------------- Material 3 Segmented Button

/**
 * Material 3 Single-Select Segmented Button
 * Connected buttons with border, active segment indicated by secondaryContainer and checkmark.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  style,
}: {
  options: { value: T; label: string; dot?: string; disabled?: boolean }[];
  value: T;
  onChange: (v: T) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();

  return (
    <View style={[styles.segmented, { borderColor: c.outlineVariant }, style]} accessibilityRole="tablist">
      {options.map((o, idx) => {
        const selected = o.value === value;
        const isFirst = idx === 0;
        const isLast = idx === options.length - 1;

        return (
          <Pressable
            key={o.value}
            style={[
              styles.segItem,
              {
                backgroundColor: selected ? c.secondaryContainer : 'transparent',
                borderLeftWidth: idx > 0 ? 1 : 0,
                borderLeftColor: c.outlineVariant,
                borderTopLeftRadius: isFirst ? shape.full : 0,
                borderBottomLeftRadius: isFirst ? shape.full : 0,
                borderTopRightRadius: isLast ? shape.full : 0,
                borderBottomRightRadius: isLast ? shape.full : 0,
                opacity: o.disabled ? 0.38 : 1,
              },
            ]}
            disabled={o.disabled}
            onPress={() => {
              if (!selected) {
                Haptics.selectionAsync();
                onChange(o.value);
              }
            }}
            accessibilityRole="tab"
            accessibilityLabel={o.label}
            accessibilityState={{ selected, disabled: o.disabled }}
          >
            {selected ? (
              <Ionicons name="checkmark" size={16} color={c.onSecondaryContainer} style={{ marginRight: 4 }} />
            ) : null}
            <Txt
              variant="labelLarge"
              color={selected ? c.onSecondaryContainer : c.onSurface}
              style={{ fontWeight: selected ? '600' : '400' }}
              numberOfLines={1}
            >
              {o.label}
            </Txt>
            {o.dot ? <View style={[styles.segDot, { backgroundColor: o.dot }]} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------- Material 3 Tonal Banners / Notes

export function Note({
  tone,
  children,
  style,
}: {
  tone: 'info' | 'warn' | 'error';
  children: string;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  const look =
    tone === 'error'
      ? { bg: c.errorContainer, fg: c.onErrorContainer, icon: 'alert-circle' as const }
      : tone === 'warn'
        ? { bg: c.tertiaryContainer, fg: c.onTertiaryContainer, icon: 'warning' as const }
        : { bg: c.primaryContainer, fg: c.onPrimaryContainer, icon: 'information-circle' as const };

  return (
    <View style={[styles.note, { backgroundColor: look.bg }, style]} accessibilityLiveRegion="polite">
      <Ionicons name={look.icon} size={20} color={look.fg} style={styles.noteIcon} />
      <Txt variant="bodyMedium" color={look.fg} style={styles.flex}>
        {children}
      </Txt>
    </View>
  );
}

// ---------------------------------------------------------------- Material 3 Bottom Sheet

export type SheetHandle = { open: () => void; close: () => void };

function project(velocity: number, decelerationRate = 0.998) {
  'worklet';
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/**
 * Material 3 Modal Bottom Sheet
 * Top corner radius: 28dp (extraLarge), drag handle: 32x4dp.
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
      y.set(withTiming(h, { duration: 160 }, (done) => done && scheduleOnRN(finish)));
    } else {
      y.set(
        withSpring(h, { ...springs.sheet, dampingRatio: 1, overshootClamping: true }, (done) => {
          if (done) scheduleOnRN(finish);
        }),
      );
    }
  };

  useImperativeHandle(ref, () => ({
    open: () => {
      pendingOpen.current = true;
      y.set(10_000);
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
      y.set(reduced ? withTiming(0, { duration: 200, easing: EASE_STANDARD }) : withSpring(0, springs.sheet));
    }
  };

  const pan = usePanGesture({
    activeOffsetY: [-10, 10],
    onActivate: () => {
      'worklet';
      startY.set(y.get());
    },
    onUpdate: (e) => {
      'worklet';
      const next = startY.get() + e.translationY;
      y.set(Math.max(0, next));
    },
    onDeactivate: (e) => {
      'worklet';
      const h = height.get();
      if (y.get() + project(e.velocityY) > h * 0.35) {
        y.set(
          withSpring(h, { ...springs.sheet, dampingRatio: 1, velocity: e.velocityY, overshootClamping: true }, (done) => {
            if (done) scheduleOnRN(finish);
          }),
        );
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
      <GestureHandlerRootView style={styles.flex}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }, scrimStyle]}>
          <Pressable style={styles.flex} onPress={close} accessibilityLabel="Close" />
        </Animated.View>
        <GestureDetector gesture={pan}>
          <Animated.View
            onLayout={onLayout}
            style={[
              styles.sheet,
              { backgroundColor: c.surfaceContainerLow, paddingBottom: insets.bottom + space.l, maxHeight: '92%' },
              panelStyle,
            ]}
          >
            <View style={[styles.grabber, { backgroundColor: c.outlineVariant }]} />
            {children}
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
}

// ---------------------------------------------------------------- Material 3 Full Page

export function Page({
  visible,
  title,
  onClose,
  closeLabel = 'Close',
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  closeLabel?: string;
  children: React.ReactNode;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <View style={[styles.flex, { backgroundColor: c.surface, paddingTop: insets.top }]}>
        <View style={[styles.pageBar, { borderBottomColor: c.outlineVariant, borderBottomWidth: StyleSheet.hairlineWidth }]}>
          <IconButton icon="close" label={closeLabel} onPress={onClose} size={40} />
          <Txt variant="titleLarge" accessibilityRole="header" numberOfLines={1} style={styles.pageTitle}>
            {title}
          </Txt>
          <View style={styles.pageBarSide} />
        </View>
        <View style={styles.flex}>{children}</View>
      </View>
    </Modal>
  );
}

export function SectionTitle({ children }: { children: string }) {
  const c = useColors();
  return (
    <Txt variant="titleSmall" color={c.primary} style={styles.sectionHeader}>
      {children}
    </Txt>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  button: {
    borderRadius: shape.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 64,
  },
  buttonL: {
    minHeight: 48,
    paddingHorizontal: space.xl,
  },
  buttonM: {
    minHeight: 40,
    paddingHorizontal: space.l,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonIcon: {
    marginRight: space.s,
  },
  buttonLabel: {
    flexShrink: 1,
  },
  iconButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    borderRadius: shape.medium,
    padding: space.l,
  },
  group: {
    marginTop: space.l,
    paddingHorizontal: space.l,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.xs,
    marginBottom: space.s,
    minHeight: 20,
  },
  groupBody: {
    borderRadius: shape.large,
    borderWidth: 1,
    overflow: 'hidden',
  },
  groupFooter: {
    paddingHorizontal: space.xs,
    marginTop: space.s,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    paddingHorizontal: space.l,
    paddingVertical: space.m,
    minHeight: 56,
  },
  rowIcon: {
    width: 24,
    textAlign: 'center',
  },
  rowSubtitle: {
    marginTop: 2,
  },
  chip: {
    height: 32,
    borderRadius: shape.small,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.m,
  },
  segmented: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: shape.full,
    height: 40,
    overflow: 'hidden',
  },
  segItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.m,
  },
  segDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginLeft: 6,
  },
  note: {
    flexDirection: 'row',
    gap: space.m,
    paddingVertical: space.m,
    paddingHorizontal: space.l,
    borderRadius: shape.medium,
    alignItems: 'center',
  },
  noteIcon: {
    marginTop: 0,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: shape.extraLarge,
    borderTopRightRadius: shape.extraLarge,
    paddingHorizontal: space.xl,
    paddingTop: space.s,
  },
  grabber: {
    alignSelf: 'center',
    width: 32,
    height: 4,
    borderRadius: 2,
    marginBottom: space.l,
  },
  pageBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.l,
    height: 64,
  },
  pageBarSide: {
    width: 40,
  },
  pageTitle: {
    flex: 1,
    textAlign: 'center',
  },
  sectionHeader: {
    marginBottom: space.s,
    paddingHorizontal: space.xs,
  },
});
