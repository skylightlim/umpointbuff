import React, { useEffect, useRef, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Switch, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { Sniper } from '../../modules/umpoint-sniper';
import { COURT_IDS, bookCourt, getWeek, scheduleSnipe } from '../services/api';
import { BookingPrefs, DEFAULT_PREFS, loadPrefs, useCached } from '../services/cache';
import {
  CLOSING_TIME,
  dateMs,
  dayLabel,
  hhmm,
  isWeekday,
  minutes,
  mytDate,
  nextRolloverMs,
  weekStartMs,
} from '../services/umpointClient';
import { CourtId, SlotStatus, WeekGrid, WeekType } from '../types';
import { Button, Hairline, Press, Segmented, Sheet, SheetHandle, Txt } from '../ui';
import { CourtMarks, CourtTile, ScreenHeader, SessionPill, useToast } from '../components/Pieces';
import { radius, space, useColors } from '../theme';

const DAY = 86_400_000;

/** For the 26 Oct 2026 study: snipes also record how fast courts go until 01:00. */
const RECORD_ROLLOVER = true;

interface Props {
  week: WeekType;
  onWeekChange: (w: WeekType) => void;
  onOpenSettings: () => void;
  onOpenSniper: () => void;
}

function ago(at: number | null, now: number): string {
  if (!at) return '';
  const min = Math.round((now - at) / 60_000);
  return min < 1 ? 'Updated just now' : min < 60 ? `Updated ${min} min ago` : `Updated ${new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

export const CourtsScreen: React.FC<Props> = ({ week, onWeekChange, onOpenSettings, onOpenSniper }) => {
  const c = useColors();
  const monday = weekStartMs() + (week === 'next' ? 7 * DAY : 0);
  const grid = useCached<WeekGrid>(`week:${mytDate(monday)}`, () => getWeek(week));
  const [showEarlier, setShowEarlier] = useState(false);
  const [pickedDate, setPickedDate] = useState<string | null>(null);
  const [slot, setSlot] = useState<{ date: string; start: string } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const sheet = useRef<SheetHandle>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  // Bookable: a weekday at least a day ahead. Next week opens at its Monday 00:00, which makes
  // that Monday same-day — so Tue–Fri there.
  const today = mytDate(now);
  const earliest = (week === 'this' ? dateMs(today) : nextRolloverMs(now)) + DAY;
  const bookable = (d: string) => dateMs(d) >= earliest;
  const weekdays = (grid.data?.dates ?? []).filter(isWeekday);
  const days = weekdays.filter((d) => showEarlier || bookable(d));
  const hiddenEarlier = weekdays.filter((d) => !bookable(d)).length;
  const date = pickedDate && days.includes(pickedDate) ? pickedDate : (days.find(bookable) ?? days[0]);
  const readOnly = !date || !bookable(date);

  const open = (start: string) => {
    if (!date || readOnly) return;
    setSlot({ date, start });
    sheet.current?.open();
  };

  const statusLine = grid.refreshing
    ? 'Updating…'
    : grid.error
      ? `Couldn’t refresh: ${grid.error}`
      : ago(grid.updatedAt, now);

  return (
    <View style={[styles.flex, { backgroundColor: c.bg }]}>
      <ScreenHeader title="Courts" right={<SessionPill onOpenSettings={onOpenSettings} />} />

      <View style={styles.pad}>
        <Segmented
          options={[
            { value: 'this', label: 'This week' },
            { value: 'next', label: 'Next week', badge: 'SNIPE' },
          ]}
          value={week}
          onChange={(w) => {
            setPickedDate(null);
            onWeekChange(w);
          }}
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.days}
        style={styles.daysScroll}
      >
        {hiddenEarlier > 0 && week === 'this' ? (
          <Press
            onPress={() => setShowEarlier((v) => !v)}
            haptic="selection"
            style={[styles.dayChip, styles.earlier, { borderColor: c.hairline }]}
            accessibilityLabel={showEarlier ? 'Hide earlier days' : 'Show earlier days'}
          >
            <Ionicons name={showEarlier ? 'eye-off-outline' : 'time-outline'} size={16} color={c.ink2} />
            <Txt variant="footnote" color={c.ink2}>
              {showEarlier ? 'Hide' : 'Earlier'}
            </Txt>
          </Press>
        ) : null}
        {days.map((d) => {
          const selected = d === date;
          const past = !bookable(d);
          const [dd] = d.split('-');
          return (
            <Press
              key={d}
              onPress={() => setPickedDate(d)}
              haptic="selection"
              style={[
                styles.dayChip,
                { backgroundColor: selected ? c.ink : c.surface, opacity: past && !selected ? 0.6 : 1 },
              ]}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={`${dayLabel(d)}${past ? ', past' : ''}`}
            >
              <Txt variant="caption" color={selected ? c.surface : c.ink3}>
                {d === today ? 'Today' : past ? 'Past' : dayLabel(d).split(' ')[0]}
              </Txt>
              <Txt variant="time" color={selected ? c.surface : c.ink}>
                {dd}
              </Txt>
            </Press>
          );
        })}
      </ScrollView>

      <View style={[styles.pad, styles.statusRow]}>
        <Txt variant="footnote" color={grid.error ? c.smash : c.ink3} numberOfLines={1} style={styles.flex}>
          {statusLine}
        </Txt>
        {week === 'next' ? (
          <Txt variant="footnote" color={c.smash}>
            Opens Mon {dayLabel(mytDate(nextRolloverMs(now))).split(' ').slice(1).join(' ')} 00:00
          </Txt>
        ) : null}
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.rail}
        refreshControl={<RefreshControl refreshing={false} onRefresh={grid.refresh} tintColor={c.mat} colors={[c.mat]} />}
      >
        {!grid.data ? (
          grid.error ? (
            <View style={styles.empty}>
              <Ionicons name="cloud-offline-outline" size={40} color={c.ink3} />
              <Txt variant="headline" style={{ marginTop: space.m }}>
                Can’t load the courts
              </Txt>
              <Txt variant="footnote" color={c.ink2} style={{ textAlign: 'center', marginTop: 4 }}>
                {grid.error}
              </Txt>
              <Button label="Try again" tone="plain" onPress={grid.refresh} style={{ marginTop: space.l, alignSelf: 'stretch' }} />
            </View>
          ) : (
            <RailSkeleton />
          )
        ) : days.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="calendar-outline" size={40} color={c.ink3} />
            <Txt variant="headline" style={{ marginTop: space.m }}>
              Nothing left to book this week
            </Txt>
            <Txt variant="footnote" color={c.ink2} style={{ textAlign: 'center', marginTop: 4 }}>
              Courts are booked at least a day ahead.
            </Txt>
            <Button label="See next week" tone="plain" onPress={() => onWeekChange('next')} style={{ marginTop: space.l, alignSelf: 'stretch' }} />
          </View>
        ) : (
          <View style={[styles.railCard, { backgroundColor: c.surface }]}>
            {readOnly ? (
              <View style={[styles.readOnlyNote, { backgroundColor: c.fill }]}>
                <Ionicons name="lock-closed-outline" size={14} color={c.ink2} />
                <Txt variant="footnote" color={c.ink2}>
                  {date === today ? 'Today can’t be booked any more — book a day ahead.' : 'This day has passed.'}
                </Txt>
              </View>
            ) : null}
            {grid.data.times.map((t, i) => {
              const statuses = COURT_IDS.map((id) => grid.data!.status[date!]?.[t.start]?.[id] ?? 'unavailable');
              const free = statuses.filter((s) => s === 'free').length;
              const mine = statuses.includes('mine');
              const canOpen = !readOnly && free > 0;
              return (
                <View key={t.start}>
                  {i > 0 ? <Hairline inset={space.l} /> : null}
                  <Press
                    onPress={() => open(t.start)}
                    disabled={!canOpen}
                    style={[styles.row, { opacity: readOnly ? 0.55 : 1 }]}
                    accessibilityLabel={`${t.start}, ${mine ? 'yours' : free === 0 ? 'full' : `${free} courts free`}`}
                  >
                    <Txt variant="time" style={styles.rowTime} color={free === 0 && !mine ? c.ink3 : c.ink}>
                      {t.start}
                    </Txt>
                    <CourtMarks statuses={statuses} />
                    <Txt
                      variant="footnote"
                      color={mine ? c.cork : free === 0 ? c.ink3 : c.mat}
                      style={[styles.rowLabel, { fontWeight: '600' }]}
                    >
                      {mine ? 'Yours' : free === 0 ? 'Full' : `${free} free`}
                    </Txt>
                    <Ionicons name="chevron-forward" size={16} color={canOpen ? c.ink3 : 'transparent'} />
                  </Press>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      <Sheet ref={sheet} onClosed={() => setSlot(null)}>
        {slot && grid.data ? (
          <SlotSheet
            grid={grid.data}
            week={week}
            date={slot.date}
            start={slot.start}
            onDone={(changed) => {
              sheet.current?.close();
              if (changed) grid.refresh();
            }}
            onOpenSettings={() => {
              sheet.current?.close();
              onOpenSettings();
            }}
            onOpenSniper={() => {
              sheet.current?.close();
              onOpenSniper();
            }}
          />
        ) : null}
      </Sheet>
    </View>
  );
};

function RailSkeleton() {
  const c = useColors();
  return (
    <View style={[styles.railCard, { backgroundColor: c.surface }]}>
      {Array.from({ length: 8 }, (_, i) => (
        <View key={i} style={styles.row}>
          <View style={[styles.skel, { width: 54, backgroundColor: c.fill }]} />
          <View style={[styles.skel, { width: 52, backgroundColor: c.fill }]} />
          <View style={[styles.skel, { width: 44, marginLeft: 'auto', backgroundColor: c.fill }]} />
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

function SlotSheet({
  grid,
  week,
  date,
  start,
  onDone,
  onOpenSettings,
  onOpenSniper,
}: {
  grid: WeekGrid;
  week: WeekType;
  date: string;
  start: string;
  onDone: (changed: boolean) => void;
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
  const length = fits(slots) ? slots : DURATIONS.filter((d) => fits(d.slots)).pop()?.slots ?? 1;
  const end = hhmm(minutes(start) + length * 30);
  const starts = Array.from({ length }, (_, i) => hhmm(minutes(start) + i * 30));

  // A court is free for the booking only if every half hour in it is free.
  const rangeStatus = (id: CourtId): SlotStatus => {
    const all = starts.map((s) => grid.status[date]?.[s]?.[id] ?? 'unavailable');
    if (all.every((s) => s === 'free')) return 'free';
    return all.includes('mine') ? 'mine' : 'taken';
  };
  const freeCourts = COURT_IDS.filter((id) => rangeStatus(id) === 'free');
  const chosen = court && freeCourts.includes(court) ? court : (freeCourts[0] ?? null);

  // Pusat Sukan's terms: one session a day, two bookings a week on different days.
  const sniping = week === 'next';
  const armed = sniping ? Sniper.tasks().filter((t) => t.status === 'armed' && grid.dates.includes(t.date)) : [];
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
        toast(res.message);
        onDone(true);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setProblem(res.message);
      }
    } catch (e: any) {
      setProblem(e?.message || 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const arm = () => {
    if (!chosen) return;
    try {
      scheduleSnipe({ date, start, end, court: chosen, anyCourt, event: prefs.event, pax: prefs.pax, measure: RECORD_ROLLOVER });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast(`Sniper armed · ${dayLabel(date)} ${start}–${end}, Court ${chosen}`, 'smash');
      onDone(false);
    } catch (e: any) {
      setProblem(e?.message || 'Couldn’t arm the sniper.');
    }
  };

  return (
    <View>
      <Txt variant="caption" color={c.ink3}>
        {dayLabel(date)}
      </Txt>
      <View style={styles.sheetTitle}>
        <Txt variant="clock" style={{ fontSize: 44, lineHeight: 48 }}>
          {start}
        </Txt>
        <Txt variant="time" color={c.ink3} style={{ marginBottom: 4 }}>
          – {end}
        </Txt>
      </View>

      <View style={styles.durations}>
        {DURATIONS.map((d) => {
          const ok = fits(d.slots);
          const selected = d.slots === length;
          return (
            <Press
              key={d.slots}
              onPress={() => setSlots(d.slots)}
              disabled={!ok}
              haptic="selection"
              style={[
                styles.duration,
                { backgroundColor: selected ? c.ink : c.fill, opacity: ok ? 1 : 0.35 },
              ]}
              accessibilityRole="radio"
              accessibilityState={{ selected, disabled: !ok }}
            >
              <Txt variant="callout" color={selected ? c.surface : c.ink}>
                {d.label}
              </Txt>
            </Press>
          );
        })}
      </View>

      <View style={styles.courts}>
        {COURT_IDS.map((id) => (
          <CourtTile
            key={id}
            label={`Court ${id}`}
            status={rangeStatus(id)}
            selected={id === chosen}
            onPress={() => setCourt(id)}
          />
        ))}
      </View>

      {sniping ? (
        <View style={[styles.optionRow, { backgroundColor: c.fill }]}>
          <View style={styles.flex}>
            <Txt variant="headline">Any court</Txt>
            <Txt variant="footnote" color={c.ink2}>
              If Court {chosen ?? '–'} is gone at 00:00, try the others one at a time. Never more than one.
            </Txt>
          </View>
          <Switch value={anyCourt} onValueChange={setAnyCourt} trackColor={{ true: c.smash }} />
        </View>
      ) : null}

      {warning ? (
        <View style={[styles.note, { backgroundColor: c.corkSoft }]}>
          <Ionicons name="information-circle" size={16} color={c.cork} />
          <Txt variant="footnote" color={c.ink} style={styles.flex}>
            {warning}
          </Txt>
        </View>
      ) : null}
      {problem ? (
        <View style={[styles.note, { backgroundColor: c.smashSoft }]}>
          <Ionicons name="alert-circle" size={16} color={c.smash} />
          <Txt variant="footnote" color={c.ink} style={styles.flex}>
            {problem}
          </Txt>
        </View>
      ) : null}

      {chosen ? (
        sniping ? (
          <Button
            tone="smash"
            icon="locate"
            label={`Arm sniper · Court ${chosen}`}
            onPress={arm}
            style={{ marginTop: space.l }}
          />
        ) : (
          <Button
            label={`Book Court ${chosen} · ${start}–${end}`}
            onPress={book}
            loading={busy}
            style={{ marginTop: space.l }}
          />
        )
      ) : (
        <Button label="No court is free for that long" onPress={() => {}} disabled tone="plain" style={{ marginTop: space.l }} />
      )}

      <Press onPress={onOpenSettings} style={styles.prefsLink} accessibilityRole="button">
        <Txt variant="footnote" color={c.ink3}>
          As “{prefs.event}”, {prefs.pax} players · Change
        </Txt>
      </Press>
      {sniping ? (
        <Press onPress={onOpenSniper} style={styles.prefsLink}>
          <Txt variant="footnote" color={c.ink3}>
            Fires Monday 00:00:00 · How the sniper works
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
  pad: {
    paddingHorizontal: space.l,
  },
  daysScroll: {
    flexGrow: 0,
    marginTop: space.m,
  },
  days: {
    paddingHorizontal: space.l,
    gap: space.s,
  },
  dayChip: {
    width: 58,
    height: 62,
    borderRadius: radius.m,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  earlier: {
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s,
    marginTop: space.m,
    marginBottom: space.s,
  },
  rail: {
    paddingHorizontal: space.l,
    paddingBottom: space.xxl,
  },
  railCard: {
    borderRadius: radius.l,
    overflow: 'hidden',
  },
  readOnlyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s,
    paddingHorizontal: space.l,
    paddingVertical: space.s,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.l,
    paddingHorizontal: space.l,
    minHeight: 52,
  },
  rowTime: {
    width: 54,
  },
  rowLabel: {
    flex: 1,
    textAlign: 'right',
  },
  skel: {
    height: 14,
    borderRadius: 7,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: space.xxl,
    paddingHorizontal: space.xl,
  },
  sheetTitle: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.s,
    marginTop: 2,
  },
  durations: {
    flexDirection: 'row',
    gap: space.s,
    marginTop: space.l,
  },
  duration: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  courts: {
    flexDirection: 'row',
    gap: space.m,
    marginTop: space.xl,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    padding: space.m,
    borderRadius: radius.m,
    marginTop: space.l,
  },
  note: {
    flexDirection: 'row',
    gap: space.s,
    padding: space.m,
    borderRadius: radius.m,
    marginTop: space.m,
  },
  prefsLink: {
    alignItems: 'center',
    paddingTop: space.m,
  },
});
