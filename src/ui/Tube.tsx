import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useReducedMotion, withSpring, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Press, Txt } from '.';
import { Shuttle, ShuttleState } from './Shuttle';
import { elevation, shape, space, springs, useColors } from '../theme';

export interface Chamber {
  key: string;
  state: ShuttleState;
  day: string;
  time: string;
  detail?: string;
  status: string;
  onPress?: () => void;
  accessibilityLabel: string;
  landing?: boolean;
}

function landingAnimation() {
  'worklet';
  return {
    initialValues: { opacity: 0, transform: [{ translateY: 24 }] },
    animations: {
      opacity: withTiming(1, { duration: 160 }),
      transform: [{ translateY: withSpring(0, springs.land) }],
    },
  };
}

function ChamberView({ chamber, isHero }: { chamber: Chamber; isHero: boolean }) {
  const c = useColors();
  const reduced = useReducedMotion();

  const isArmed = chamber.state === 'armed';
  const isBooked = chamber.state === 'booked';
  const isLost = chamber.state === 'lost';
  const isTest = chamber.state === 'test';
  const isEmpty = chamber.state === 'empty';

  const bg = isArmed
    ? c.tertiaryContainer
    : isBooked
      ? c.secondaryContainer
      : isLost
        ? c.errorContainer
        : isTest
          ? c.primaryContainer
          : c.surface;

  const fg = isArmed
    ? c.onTertiaryContainer
    : isBooked
      ? c.onSecondaryContainer
      : isLost
        ? c.onErrorContainer
        : isTest
          ? c.onPrimaryContainer
          : c.onSurface;

  const fgVariant = isArmed
    ? c.tertiary
    : isBooked
      ? c.secondary
      : isLost
        ? c.error
        : isTest
          ? c.primary
          : c.onSurfaceVariant;

  const border = isArmed
    ? c.tertiary
    : isBooked
      ? c.secondary
      : c.outlineVariant;

  const landing = chamber.landing && !reduced;

  useEffect(() => {
    if (!landing) return;
    const t = setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), 240);
    return () => clearTimeout(t);
  }, [landing]);

  return (
    <Press
      onPress={chamber.onPress}
      disabled={!chamber.onPress}
      style={[
        styles.chamber,
        {
          backgroundColor: bg,
          borderColor: border,
          borderWidth: isArmed || isBooked ? 1.5 : 1,
          borderStyle: isEmpty ? 'dashed' : 'solid',
        },
      ]}
      accessibilityLabel={chamber.accessibilityLabel}
    >
      <View style={styles.chamberTop}>
        <Animated.View entering={landing ? landingAnimation : undefined}>
          <Shuttle state={chamber.state} width={38} onDark={false} />
        </Animated.View>
        <Txt variant="labelSmall" color={fgVariant} numberOfLines={1} style={styles.status}>
          {chamber.status}
        </Txt>
      </View>
      <Txt variant="bodySmall" color={fgVariant} numberOfLines={1} style={styles.chamberDay}>
        {chamber.day}
      </Txt>
      <Txt variant="titleMedium" color={fg} numberOfLines={1} adjustsFontSizeToFit>
        {chamber.time}
      </Txt>
      {chamber.detail ? (
        <Txt variant="bodySmall" color={fgVariant} numberOfLines={1} style={styles.chamberDetail}>
          {chamber.detail}
        </Txt>
      ) : null}
    </Press>
  );
}

/**
 * Material 3 Week Booking & Snipe Card
 */
export function Tube({
  variant = 'navy',
  title,
  range,
  meta,
  children,
  chambers,
}: {
  variant?: 'navy' | 'white';
  title: string;
  range?: string;
  meta?: React.ReactNode;
  children?: React.ReactNode;
  chambers: Chamber[];
}) {
  const c = useColors();
  const isHero = variant === 'navy';
  const rows: Chamber[][] = [];
  chambers.forEach((ch, i) => (i % 2 === 0 ? rows.push([ch]) : rows[rows.length - 1].push(ch)));

  return (
    <View
      style={[
        styles.tubeCard,
        {
          backgroundColor: isHero ? c.surfaceContainerLow : c.surfaceContainer,
          borderColor: c.outlineVariant,
          borderWidth: 1,
          elevation: isHero ? elevation.level2 : elevation.level1,
        },
      ]}
    >
      <View style={styles.body}>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Txt variant="titleMedium" color={c.onSurface} accessibilityRole="header">
              {title}
            </Txt>
            {range ? (
              <Txt variant="bodySmall" color={c.onSurfaceVariant}>
                {range}
              </Txt>
            ) : null}
          </View>
          {meta}
        </View>

        {children}

        <View style={styles.chambers}>
          {rows.map((row, i) => (
            <View key={i} style={styles.chamberRow}>
              {row.map((ch) => (
                <View key={ch.key} style={styles.chamberSlot}>
                  <ChamberView chamber={ch} isHero={isHero} />
                </View>
              ))}
              {row.length === 1 ? <View style={styles.chamberSlot} /> : null}
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tubeCard: {
    borderRadius: shape.large,
    overflow: 'hidden',
  },
  body: {
    padding: space.l,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.s,
    marginBottom: space.s,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space.s,
    flexShrink: 1,
  },
  chambers: {
    marginTop: space.m,
    gap: space.m,
  },
  chamberRow: {
    flexDirection: 'row',
    gap: space.m,
  },
  chamberSlot: {
    flex: 1,
  },
  chamber: {
    borderRadius: shape.medium,
    padding: space.m,
    minHeight: 116,
    justifyContent: 'center',
  },
  chamberTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.xs,
    gap: space.xs,
  },
  status: {
    flexShrink: 1,
    textAlign: 'right',
    fontWeight: '600',
  },
  chamberDay: {
    marginBottom: 2,
  },
  chamberDetail: {
    marginTop: 2,
  },
});
