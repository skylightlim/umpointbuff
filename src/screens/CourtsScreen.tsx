import React, { useEffect, useRef, useState } from 'react';
import { BackHandler, LayoutChangeEvent, RefreshControl, StyleSheet, Switch, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useSharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { COURT_IDS, bookCourt, getWeek } from '../services/api';
import { BookingPrefs, DEFAULT_PREFS, loadPrefs, useCached } from '../services/cache';
import { armSnipe, isLive, useTasks } from '../services/tasks';
import { CLOSING_TIME, dateMs, dayLabel, hhmm, minutes, mytDate, nextRolloverMs, weekStartMs } from '../services/umpointClient';
import { ago, countdown, shortDay } from '../services/week';
import { SniperTask } from '../../modules/umpoint-sniper';
import { CourtId, SlotStatus, WeekGrid, WeekType } from '../types';
import { Button, Note, Press, Segmented, Txt } from '../ui';
import { AccountButton, CourtMeter, CourtTile, LargeHeader, TAB_CLEARANCE, useToast } from '../components/Pieces';
import { EASE_DECELERATE, elevation, shape, space, useColors } from '../theme';

const DAY = 86_400_000;
const GUTTER = 62;

const RECORD_ROLLOVER = true;

const ROW_LAYOUT = LinearTransition.duration(240).easing(EASE_DECELERATE);
const PICKER_IN = FadeIn.duration(180).delay(40);
const PICKER_OUT = FadeOut.duration(120);

interface Props {
  week: WeekType;
  onWeekChange: (w: WeekType) => void;
  onOpenSettings: () => void;
  onOpenSniper: () => void;
  onArmed: () => void;
}

function armedAt(tasks: SniperTask[], date: string, start: string): Set<string> {
  const at = minutes(start);
  return new Set(
    tasks
      .filter((t) => isLive(t) && !t.dryRun && t.date === date && minutes(t.start) <= at && at < minutes(t.end))
      .map((t) => t.court),
  );
}

function Countdown({ to }: { to: number }) {
  const c = useColors();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <Txt variant="labelMedium" color={c.tertiary} style={styles.tabular}>
      Opens in {countdown(to - now)}
    </Txt>
  );
}

export const CourtsScreen: React.FC<Props> = ({ week, onWeekChange, onOpenSettings, onOpenSniper, onArmed }) => {
  const c = useColors();
  const tasks = useTasks();
  const [now] = useState(() => Date.now());
  const monday = weekStartMs(now) + (week === 'next' ? 7 * DAY : 0);
  const grid = useCached<WeekGrid>(`week:${mytDate(monday)}`, () => getWeek(week));
  const [pickedDate, setPickedDate] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useSharedValue(0);
  const viewport = useRef(0);
  const boardY = useRef(0);
  const pendingScroll = useRef<string | null>(null);

  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.set(e.contentOffset.y);
  });

  const today = mytDate(now);
  const rollover = nextRolloverMs(now);
  const earliest = (week === 'this' ? dateMs(today) : rollover) + DAY;
  const bookable = (d: string) => dateMs(d) >= earliest;
  const days = Array.from({ length: 5 }, (_, i) => mytDate(monday + i * DAY));
  const date = pickedDate && days.includes(pickedDate) ? pickedDate : (days.find(bookable) ?? days[4]);
  const readOnly = !bookable(date);
  const nothingLeft = !days.some(bookable);

  useEffect(() => {
    if (!expanded) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setExpanded(null);
      return true;
    });
    return () => sub.remove();
  }, [expanded]);

  const pickDay = (d: string) => {
    setPickedDate(d);
    setExpanded(null);
  };

  const toggle = (start: string) => {
    if (readOnly) return;
    if (expanded === start) {
      setExpanded(null);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    pendingScroll.current = start;
    setExpanded(start);
  };

  const onPickerLayout = (start: string, e: LayoutChangeEvent) => {
    if (pendingScroll.current !== start) return;
    pendingScroll.current = null;
    const { y, height } = e.nativeEvent.layout;
    const top = boardY.current + y;
    const bottom = top + height;
    const visibleTop = scrollY.get();
    const visibleBottom = visibleTop + viewport.current - TAB_CLEARANCE;
    if (bottom > visibleBottom || top < visibleTop) {
      scrollRef.current?.scrollTo({ y: Math.max(0, Math.min(top - space.s, bottom - (viewport.current - TAB_CLEARANCE))), animated: true });
    }
  };

  const armedDays = new Set(tasks.filter((t) => isLive(t) && !t.dryRun).map((t) => t.date));
  const mineDays = new Set(
    days.filter((d) => Object.values(grid.data?.status[d] ?? {}).some((byCourt) => Object.values(byCourt).includes('mine'))),
  );

  const statusLine = grid.refreshing
    ? 'Updating…'
    : grid.error
      ? `Couldn’t refresh: ${grid.error}`
      : ago(grid.updatedAt, now);

  const readOnlyReason =
    week === 'next' && dateMs(date) === rollover
      ? 'Monday opens at 00:00 that same day, so it can’t be sniped. Pick Tuesday to Friday.'
      : date === today
        ? 'Today can’t be booked anymore. Courts are booked at least a day ahead.'
        : 'This day has passed. You can view court history.';

  return (
    <View style={[styles.flex, { backgroundColor: c.surface }]}>
      <LargeHeader title="Courts" right={<AccountButton onOpenSettings={onOpenSettings} />} />

      {/* Material 3 Segmented Button for Week Switching */}
      <View style={styles.pad}>
        <Segmented
          options={[
            { value: 'this', label: 'This week' },
            { value: 'next', label: 'Next week', dot: [...armedDays].some((d) => dateMs(d) >= rollover) ? c.tertiary : undefined },
          ]}
          value={week}
          onChange={(w) => {
            setPickedDate(null);
            setExpanded(null);
            onWeekChange(w);
          }}
        />
      </View>

      {/* Material 3 Day Selector Cards */}
      <View style={styles.days} accessibilityRole="tablist">
        {days.map((d) => {
          const selected = d === date;
          const can = bookable(d);
          const [dd] = d.split('-');
          const marker = armedDays.has(d) ? c.tertiary : mineDays.has(d) ? c.secondary : null;
          const caption = d === today ? 'Today' : dayLabel(d).split(' ')[0];

          return (
            <Press
              key={d}
              onPress={() => pickDay(d)}
              haptic="selection"
              style={[
                styles.day,
                {
                  backgroundColor: selected
                    ? c.secondaryContainer
                    : c.surfaceContainerLow,
                  borderColor: selected ? c.secondary : c.outlineVariant,
                  borderWidth: selected ? 1.5 : 1,
                  opacity: can || selected ? 1 : 0.45,
                },
              ]}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={`${dayLabel(d)}${can ? '' : ', cannot be booked'}${marker === c.tertiary ? ', snipe armed' : marker ? ', you have a booking' : ''}`}
            >
              <Txt variant="labelSmall" color={selected ? c.onSecondaryContainer : c.onSurfaceVariant}>
                {caption}
              </Txt>
              <Txt variant="titleLarge" color={selected ? c.onSecondaryContainer : can ? c.onSurface : c.outline} style={!can && !selected && styles.struck}>
                {String(Number(dd))}
              </Txt>
              <View style={[styles.dayMarker, { backgroundColor: marker ?? 'transparent' }]} />
            </Press>
          );
        })}
      </View>

      {/* Status info row */}
      <View style={[styles.pad, styles.statusRow]}>
        <Txt variant="labelSmall" color={grid.error ? c.error : c.onSurfaceVariant} numberOfLines={1} style={styles.flex}>
          {statusLine}
        </Txt>
        {week === 'next' ? <Countdown to={rollover} /> : null}
      </View>

      <Animated.ScrollView
        ref={scrollRef}
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={styles.flex}
        onLayout={(e) => (viewport.current = e.nativeEvent.layout.height)}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={false} onRefresh={grid.refresh} tintColor={c.primary} colors={[c.primary]} />}
      >
        {!grid.data ? (
          grid.error ? (
            <View style={styles.empty}>
              <Ionicons name="cloud-offline-outline" size={48} color={c.onSurfaceVariant} />
              <Txt variant="titleMedium" color={c.onSurface} style={styles.emptyTitle}>
                Can’t load courts
              </Txt>
              <Txt variant="bodyMedium" color={c.onSurfaceVariant} style={styles.emptyText}>
                {grid.error}
              </Txt>
              <Button label="Try again" tone="tonal" onPress={grid.refresh} style={styles.emptyButton} />
            </View>
          ) : (
            <BoardSkeleton />
          )
        ) : (
          <View onLayout={(e) => (boardY.current = e.nativeEvent.layout.y)}>
            {nothingLeft && week === 'this' ? (
              <View style={styles.pad}>
                <Note tone="info">Nothing left to book this week. Courts are booked at least a day ahead.</Note>
                <Button label="See next week" tone="tonal" size="m" onPress={() => onWeekChange('next')} style={styles.noteButton} />
              </View>
            ) : readOnly ? (
              <View style={styles.pad}>
                <Note tone="info">{readOnlyReason}</Note>
              </View>
            ) : null}

            <View style={styles.board}>
              {grid.data.times.map((t) => {
                const armed = armedAt(tasks, date, t.start);
                const statuses = COURT_IDS.map((id) => {
                  const s: SlotStatus = grid.data!.status[date]?.[t.start]?.[id] ?? 'unavailable';
                  return armed.has(id) && s !== 'mine' ? ('armed' as const) : s;
                });
                const free = statuses.filter((s) => s === 'free').length;
                const mine = statuses.includes('mine');
                const isArmed = statuses.includes('armed');
                const open = expanded === t.start;
                const dimmed = expanded !== null && !open;
                const hour = t.start.endsWith(':00');

                const label = mine ? 'Yours' : isArmed ? 'Armed' : free === 0 ? 'Full' : `${free} free`;
                const labelColor = mine ? c.tertiary : isArmed ? c.primary : free === 0 ? c.outline : c.secondary;

                return (
                  <Animated.View
                    key={t.start}
                    layout={ROW_LAYOUT}
                    style={[styles.rowWrap, { opacity: dimmed || readOnly ? 0.4 : 1 }]}
                  >
                    {open ? (
                      <Animated.View
                        entering={PICKER_IN}
                        exiting={PICKER_OUT}
                        style={[
                          styles.card,
                          {
                            backgroundColor: c.surfaceContainerLow,
                            borderColor: c.outlineVariant,
                            borderWidth: 1,
                            elevation: elevation.level2,
                          },
                        ]}
                        onLayout={(e) => onPickerLayout(t.start, e)}
                      >
                        <SlotPicker
                          grid={grid.data!}
                          week={week}
                          date={date}
                          start={t.start}
                          tasks={tasks}
                          onCollapse={() => setExpanded(null)}
                          onBooked={() => {
                            setExpanded(null);
                            grid.refresh();
                          }}
                          onArmed={() => {
                            setExpanded(null);
                            onArmed();
                          }}
                          onOpenSettings={onOpenSettings}
                          onOpenSniper={onOpenSniper}
                        />
                      </Animated.View>
                    ) : (
                      <Press
                        onPress={() => toggle(t.start)}
                        disabled={readOnly || free === 0}
                        style={styles.row}
                        accessibilityLabel={`${t.start}, ${label}`}
                        accessibilityHint={free > 0 && !readOnly ? 'Choose a court' : undefined}
                        accessibilityState={{ expanded: false }}
                      >
                        <Txt variant="titleSmall" color={hour ? c.onSurface : c.onSurfaceVariant} style={styles.rowTime}>
                          {t.start}
                        </Txt>
                        <View style={[styles.rowTrack, { borderTopColor: hour ? c.outlineVariant : c.surfaceContainerHighest }]}>
                          <CourtMeter statuses={statuses} />
                          <Txt variant="labelLarge" color={labelColor} style={[styles.rowLabel, styles.semibold]}>
                            {label}
                          </Txt>
                          <Ionicons name="chevron-down" size={16} color={free > 0 && !readOnly ? c.onSurfaceVariant : 'transparent'} />
                        </View>
                      </Press>
                    )}
                  </Animated.View>
                );
              })}

              <View style={styles.closing}>
                <Txt variant="titleSmall" color={c.outline} style={styles.rowTime}>
                  {CLOSING_TIME}
                </Txt>
                <View style={[styles.closingLine, { borderTopColor: c.outlineVariant }]}>
                  <Txt variant="bodySmall" color={c.outline}>
                    Courts close
                  </Txt>
                </View>
              </View>
            </View>
          </View>
        )}
      </Animated.ScrollView>
    </View>
  );
};

function BoardSkeleton() {
  const c = useColors();
  return (
    <View style={styles.board} accessibilityLabel="Loading courts">
      {Array.from({ length: 9 }, (_, i) => (
        <View key={i} style={styles.row}>
          <View style={[styles.skel, { width: 44, backgroundColor: c.surfaceContainerHighest }]} />
          <View style={[styles.rowTrack, { borderTopColor: c.surfaceContainerHighest }]}>
            <View style={[styles.skel, { width: 62, backgroundColor: c.surfaceContainerHighest }]} />
            <View style={[styles.skel, { width: 48, marginLeft: 'auto', backgroundColor: c.surfaceContainerHighest }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

const DURATIONS = [
  { slots: 1, label: '30 min' },
  { slots: 2, label: '1 hr' },
  { slots: 3, label: '1½ hr' },
  { slots: 4, label: '2 hr' },
];

function SlotPicker({
  grid,
  week,
  date,
  start,
  tasks,
  onCollapse,
  onBooked,
  onArmed,
  onOpenSettings,
  onOpenSniper,
}: {
  grid: WeekGrid;
  week: WeekType;
  date: string;
  start: string;
  tasks: SniperTask[];
  onCollapse: () => void;
  onBooked: () => void;
  onArmed: () => void;
  onOpenSettings: () => void;
  onOpenSniper: () => void;
}) {
  const c = useColors();
  const toast = useToast();
  const [slots, setSlots] = useState(2);
  const [court, setCourt] = useState<CourtId | null>(null);
  const [anyCourt, setAnyCourt] = useState(true);
  const [prefs, setPrefs] = useState<BookingPrefs>(DEFAULT_PREFS);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    loadPrefs().then(setPrefs);
  }, []);

  const fits = (n: number) => minutes(start) + n * 30 <= minutes(CLOSING_TIME);
  const length = fits(slots) ? slots : (DURATIONS.filter((d) => fits(d.slots)).pop()?.slots ?? 1);
  const end = hhmm(minutes(start) + length * 30);
  const starts = Array.from({ length }, (_, i) => hhmm(minutes(start) + i * 30));

  const rangeStatus = (id: CourtId): SlotStatus => {
    const all = starts.map((s) => grid.status[date]?.[s]?.[id] ?? 'unavailable');
    if (all.every((s) => s === 'free')) return 'free';
    return all.includes('mine') ? 'mine' : 'taken';
  };

  const freeCourts = COURT_IDS.filter((id) => rangeStatus(id) === 'free');
  const chosen = court && freeCourts.includes(court) ? court : (freeCourts[0] ?? null);

  const sniping = week === 'next';
  const armed = sniping ? tasks.filter((t) => isLive(t) && !t.dryRun && grid.dates.includes(t.date)) : [];
  const mineDays = sniping
    ? [...new Set(armed.map((t) => t.date))]
    : grid.dates.filter((d) => Object.values(grid.status[d] ?? {}).some((byCourt) => Object.values(byCourt).includes('mine')));

  const warning = mineDays.includes(date)
    ? `You already have ${sniping ? 'a snipe armed' : 'a session'} on ${dayLabel(date)}. Pusat Sukan allows one session a day.`
    : mineDays.length >= 2
      ? `You already have two ${sniping ? 'snipes armed' : 'bookings'} that week. Pusat Sukan allows two a week.`
      : null;

  const book = async () => {
    if (!chosen) return;
    setBusy(true);
    setProblem(null);
    try {
      const res = await bookCourt({ date, start, end, court: chosen, anyCourt: false, event: prefs.event, pax: prefs.pax });
      if (res.status === 'booked') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        toast(res.message || `Booked · ${dayLabel(date)} ${start}–${end}, Court ${chosen}`, 'booked');
        onBooked();
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setProblem(res.message);
      }
    } catch (e: any) {
      setProblem(e?.message || 'Something went wrong. Nothing was booked.');
    } finally {
      setBusy(false);
    }
  };

  const arm = () => {
    if (!chosen) return;
    try {
      armSnipe({ date, start, end, court: chosen, anyCourt, event: prefs.event, pax: prefs.pax, measure: RECORD_ROLLOVER });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast(`Armed · ${dayLabel(date)} ${start}–${end}, Court ${chosen}`, 'armed');
      onArmed();
    } catch (e: any) {
      setProblem(e?.message || 'Couldn’t arm sniper.');
    }
  };

  return (
    <View>
      <Press onPress={onCollapse} style={styles.pickerHead} accessibilityLabel={`${start} to ${end}, ${dayLabel(date)}. Close`} accessibilityState={{ expanded: true }}>
        <View style={styles.flex}>
          <Txt variant="headlineSmall" color={c.onSurface} numberOfLines={1}>
            {start}–{end}
          </Txt>
          <Txt variant="bodySmall" color={c.onSurfaceVariant}>
            {dayLabel(date)}
            {sniping ? ` · fires ${shortDay(nextRolloverMs())}, 00:00:00` : ''}
          </Txt>
        </View>
        <View style={[styles.collapse, { backgroundColor: c.surfaceContainerHighest }]}>
          <Ionicons name="chevron-up" size={18} color={c.onSurfaceVariant} />
        </View>
      </Press>

      {/* Duration selector */}
      <Segmented
        style={styles.durations}
        options={DURATIONS.map((d) => ({ value: String(d.slots), label: d.label, disabled: !fits(d.slots) }))}
        value={String(length)}
        onChange={(v) => setSlots(Number(v))}
      />

      {/* Court tiles */}
      <View style={styles.courts} accessibilityRole="radiogroup">
        {COURT_IDS.map((id) => (
          <CourtTile key={id} court={id} status={rangeStatus(id)} selected={id === chosen} onPress={() => setCourt(id)} />
        ))}
      </View>

      {/* Any court option */}
      {sniping ? (
        <View style={[styles.option, { backgroundColor: c.surfaceContainerHighest }]}>
          <View style={styles.flex}>
            <Txt variant="titleSmall" color={c.onSurface}>Any court fallback</Txt>
            <Txt variant="bodySmall" color={c.onSurfaceVariant}>
              If Court {chosen ?? '–'} is taken at midnight, try other courts sequentially.
            </Txt>
          </View>
          <Switch
            value={anyCourt}
            onValueChange={(v) => {
              Haptics.selectionAsync();
              setAnyCourt(v);
            }}
            trackColor={{ true: c.primary, false: c.outlineVariant }}
            thumbColor={anyCourt ? c.onPrimary : c.surface}
            accessibilityLabel="Any court fallback"
          />
        </View>
      ) : null}

      {warning ? (
        <Note tone="warn" style={styles.noteGap}>
          {warning}
        </Note>
      ) : null}
      {problem ? (
        <Note tone="error" style={styles.noteGap}>
          {problem}
        </Note>
      ) : null}

      {chosen ? (
        sniping ? (
          <Button tone="gold" icon="locate" label={`Arm sniper · Court ${chosen}`} onPress={arm} style={styles.primary} />
        ) : (
          <Button label={`Book Court ${chosen} · ${start}–${end}`} onPress={book} loading={busy} style={styles.primary} />
        )
      ) : (
        <Button label="No court is free for this duration" onPress={() => {}} disabled tone="tonal" style={styles.primary} />
      )}

      <Press onPress={onOpenSettings} style={styles.link} accessibilityRole="link" accessibilityLabel="Change event name and players">
        <Txt variant="bodySmall" color={c.onSurfaceVariant}>
          As “{prefs.event}”, {prefs.pax} {prefs.pax === 1 ? 'player' : 'players'} ·{' '}
          <Txt variant="labelSmall" color={c.primary} style={styles.semibold}>
            Change
          </Txt>
        </Txt>
      </Press>
      {sniping ? (
        <Press onPress={onOpenSniper} style={styles.linkTight} accessibilityRole="link">
          <Txt variant="labelSmall" color={c.primary} style={styles.semibold}>
            How the sniper works
          </Txt>
        </Press>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  semibold: {
    fontWeight: '600',
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
  pad: {
    paddingHorizontal: space.l,
  },
  days: {
    flexDirection: 'row',
    gap: space.s,
    paddingHorizontal: space.l,
    marginTop: space.l,
  },
  day: {
    flex: 1,
    height: 68,
    borderRadius: shape.medium,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  struck: {
    textDecorationLine: 'line-through',
  },
  dayMarker: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s,
    marginTop: space.m,
    marginBottom: space.xs,
  },
  scroll: {
    paddingTop: space.s,
    paddingBottom: TAB_CLEARANCE + space.xl,
  },
  board: {
    paddingHorizontal: space.l,
    marginTop: space.s,
  },
  rowWrap: {
    marginVertical: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: 56,
  },
  rowTime: {
    width: GUTTER,
    paddingTop: 16,
  },
  rowTrack: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    borderTopWidth: 1,
    paddingRight: space.xs,
  },
  rowLabel: {
    flex: 1,
    textAlign: 'right',
  },
  closing: {
    flexDirection: 'row',
    minHeight: 44,
  },
  closingLine: {
    flex: 1,
    borderTopWidth: 1,
    paddingTop: 16,
    alignItems: 'flex-end',
    paddingRight: space.xs,
  },
  card: {
    borderRadius: shape.large,
    padding: space.l,
    marginVertical: space.s,
  },
  pickerHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
  },
  collapse: {
    width: 36,
    height: 36,
    borderRadius: shape.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  durations: {
    marginTop: space.l,
  },
  courts: {
    flexDirection: 'row',
    gap: space.m,
    marginTop: space.l,
    paddingHorizontal: 2,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    padding: space.m,
    paddingLeft: space.l,
    borderRadius: shape.medium,
    marginTop: space.l,
  },
  noteGap: {
    marginTop: space.m,
  },
  primary: {
    marginTop: space.l,
  },
  link: {
    alignItems: 'center',
    paddingTop: space.l,
    paddingBottom: space.xs,
  },
  linkTight: {
    alignItems: 'center',
    paddingVertical: space.s,
  },
  skel: {
    height: 16,
    borderRadius: shape.small,
    marginTop: 20,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: space.xxxl,
    paddingHorizontal: space.xl,
  },
  emptyTitle: {
    marginTop: space.l,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: space.xs,
  },
  emptyButton: {
    marginTop: space.xl,
    alignSelf: 'stretch',
  },
  noteButton: {
    marginTop: space.m,
    alignSelf: 'flex-start',
  },
});
