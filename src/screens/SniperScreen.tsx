import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, PermissionsAndroid, Platform, RefreshControl, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PhoneSetup, Sniper, SniperTask } from '../../modules/umpoint-sniper';
import { getBookings } from '../services/api';
import { useCached } from '../services/cache';
import { requestSignIn, useSession } from '../services/session';
import { cancelSnipe, isLive, reloadTasks, removeSnipe, takeLanding, useTasks } from '../services/tasks';
import { dateMs, dayLabel, mytDate, nextRolloverMs, weekStartMs } from '../services/umpointClient';
import { BookedSlot, ago, countdown, parseBooking, shortDay, weekOf, weekRange } from '../services/week';
import { Booking, WeekType } from '../types';
import { Button, Group, Hairline, Note, Press, Row, Sheet, SheetHandle, Txt } from '../ui';
import { Chamber, Tube } from '../ui/Tube';
import { Shuttle, ShuttleState } from '../ui/Shuttle';
import { AccountButton, ScrollScreen, useToast } from '../components/Pieces';
import { shape, space, useColors } from '../theme';

const DAY = 86_400_000;

interface Props {
  onPickSlot: (week: WeekType) => void;
  onOpenSettings: () => void;
  onOpenDashboard: () => void;
}

const RULES: { rule: string; source: 'terms' | 'page' | 'seen' | 'unknown' }[] = [
  { rule: 'One court and one session a day.', source: 'terms' },
  { rule: 'Two bookings a week, on different days, so at most two sessions.', source: 'terms' },
  { rule: 'Book at least a day ahead. No same-day bookings.', source: 'page' },
  { rule: 'Next week opens Monday 00:00 MYT, which makes its Monday same-day: snipe Tuesday to Friday.', source: 'seen' },
  { rule: 'Weekdays 09:00–19:00 in half-hour blocks. Weekends are closed.', source: 'seen' },
  { rule: 'No longest session is stated anywhere. The app offers up to 2 hours.', source: 'unknown' },
  { rule: 'Pusat Sukan may cancel or change any booking.', source: 'terms' },
];

const TASK_LOOK: Record<SniperTask['status'], { label: string; shuttle: ShuttleState }> = {
  armed: { label: 'Armed', shuttle: 'armed' },
  running: { label: 'Awake', shuttle: 'armed' },
  ringing: { label: 'Sign in', shuttle: 'armed' },
  booked: { label: 'Booked', shuttle: 'booked' },
  failed: { label: 'Not booked', shuttle: 'lost' },
  dry_run: { label: 'Test passed', shuttle: 'test' },
  missed: { label: 'Missed', shuttle: 'lost' },
  cancelled: { label: 'Cancelled', shuttle: 'lost' },
};

const sameSlot = (a: { date: string; start: string }, b: { date: string; start: string }) =>
  a.date === b.date && a.start === b.start;

export const SniperScreen: React.FC<Props> = ({ onPickSlot, onOpenSettings, onOpenDashboard }) => {
  const c = useColors();
  const toast = useToast();
  const session = useSession();
  const tasks = useTasks();
  const bookings = useCached<Booking[]>('bookings', getBookings);
  const [setup, setSetup] = useState<PhoneSetup>(() => Sniper.phoneSetup());
  const [now, setNow] = useState(() => Date.now());
  const [openTask, setOpenTask] = useState<SniperTask | null>(null);
  const [openBooking, setOpenBooking] = useState<BookedSlot | null>(null);
  const [landing] = useState(() => takeLanding());
  const taskSheet = useRef<SheetHandle>(null);
  const bookingSheet = useRef<SheetHandle>(null);

  const reloadSetup = useCallback(() => setSetup(Sniper.phoneSetup()), []);

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const poll = setInterval(reloadSetup, 4000);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        reloadSetup();
        reloadTasks();
      }
    });
    return () => {
      clearInterval(tick);
      clearInterval(poll);
      sub.remove();
    };
  }, [reloadSetup]);

  const thisMonday = weekStartMs(now);
  const rollover = nextRolloverMs(now);
  const today = mytDate(now);
  const slots = (bookings.data ?? []).map(parseBooking).filter((b): b is BookedSlot => b !== null);
  const live = tasks.filter(isLive);
  const finished = tasks.filter((t) => !isLive(t)).sort((a, b) => b.updatedAt - a.updatedAt);
  const ringing = live.some((t) => t.status === 'ringing');
  const running = live.some((t) => t.status === 'running');

  const showTask = (t: SniperTask) => {
    setOpenTask(t);
  };
  const showBooking = (b: BookedSlot) => {
    setOpenBooking(b);
  };

  useEffect(() => {
    if (openTask) taskSheet.current?.open();
  }, [openTask]);

  useEffect(() => {
    if (openBooking) bookingSheet.current?.open();
  }, [openBooking]);

  const chambersFor = (monday: number, week: WeekType): Chamber[] => {
    const inWeek = (date: string) => weekOf(date) === monday;
    const out: Chamber[] = [];
    const booked = slots.filter((b) => inWeek(b.date)).sort((a, b) => dateMs(a.date) - dateMs(b.date) || a.start.localeCompare(b.start));
    booked.forEach((b) =>
      out.push({
        key: `b-${b.date}-${b.start}`,
        state: 'booked',
        day: dayLabel(b.date),
        time: `${b.start}–${b.end}`,
        detail: b.court ? `Court ${b.court}` : undefined,
        status: 'Booked',
        onPress: () => showBooking(b),
        accessibilityLabel: `Booked, ${dayLabel(b.date)}, ${b.start} to ${b.end}${b.court ? `, court ${b.court}` : ''}`,
      }),
    );

    tasks
      .filter((t) => inWeek(t.date) && t.status === 'booked' && !booked.some((b) => sameSlot(b, t)))
      .forEach((t) =>
        out.push({
          key: `t-${t.id}`,
          state: 'booked',
          day: dayLabel(t.date),
          time: `${t.start}–${t.end}`,
          detail: `Court ${t.bookedCourt ?? t.court}`,
          status: 'Booked',
          onPress: () => showTask(t),
          accessibilityLabel: `Booked by sniper, ${dayLabel(t.date)}, ${t.start} to ${t.end}`,
        }),
      );

    live
      .filter((t) => inWeek(t.date))
      .sort((a, b) => dateMs(a.date) - dateMs(b.date))
      .forEach((t) =>
        out.push({
          key: `t-${t.id}`,
          state: t.dryRun ? 'test' : 'armed',
          day: dayLabel(t.date),
          time: `${t.start}–${t.end}`,
          detail: t.dryRun ? 'Books nothing' : `Court ${t.court}${t.anyCourt ? ' or any' : ''}`,
          status: t.dryRun ? 'Test run' : TASK_LOOK[t.status].label,
          onPress: () => showTask(t),
          landing: t.id === landing,
          accessibilityLabel: `${t.dryRun ? 'Test run' : TASK_LOOK[t.status].label}, ${dayLabel(t.date)}, ${t.start} to ${t.end}, court ${t.court}`,
        }),
      );

    const counted = out.filter((ch) => ch.state !== 'test').length;
    const free = Math.max(0, 2 - counted);
    const daysLeft = week === 'next' || dateMs(mytDate(monday + 4 * DAY)) >= dateMs(today) + DAY;
    for (let i = 0; i < free; i++) {
      out.push(
        daysLeft
          ? {
              key: `free-${i}`,
              state: 'empty',
              day: week === 'next' ? 'Tue – Fri' : 'Any day ahead',
              time: week === 'next' ? 'Pick a slot' : 'Book a court',
              detail: week === 'next' ? 'Fires at 00:00:00' : undefined,
              status: 'Free',
              onPress: () => onPickSlot(week),
              accessibilityLabel: week === 'next' ? 'Free. Pick a slot to snipe next week' : 'Free. Book a court this week',
            }
          : {
              key: `free-${i}`,
              state: 'empty',
              day: 'This week',
              time: 'No days left',
              detail: 'Book a day ahead',
              status: 'Unused',
              accessibilityLabel: 'Unused. No bookable days left this week',
            },
      );
    }
    return out;
  };

  const nextChambers = chambersFor(rollover, 'next');
  const thisChambers = chambersFor(thisMonday, 'this');
  const used = (chs: Chamber[]) => chs.filter((ch) => ch.state === 'booked' || ch.state === 'armed').length;

  const ready = setup.notifications && setup.exactAlarms && setup.fullScreen && !setup.backgroundRestricted;

  const fixNotifications = async () => {
    if (Platform.OS === 'android' && Number(Platform.Version) >= 33) {
      const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
      if (r === 'granted') return reloadSetup();
    }
    Sniper.openSettings('notifications');
  };

  const setupRows = [
    { ok: setup.notifications, title: 'Notifications', text: 'Alerts you about booking results.', fix: fixNotifications },
    { ok: setup.exactAlarms, title: 'Alarms & reminders', text: 'Wakes phone at 23:50 to get ready.', fix: () => Sniper.openSettings('exactAlarms') },
    { ok: setup.fullScreen, title: 'Full-screen alarm', text: 'Rings over lock screen if sign-in is required.', fix: () => Sniper.openSettings('fullScreen') },
    {
      ok: !setup.backgroundRestricted,
      title: 'Battery not restricted',
      text: 'Set battery to Optimised or Unrestricted so Android does not kill the midnight alarm.',
      fix: () => Sniper.openSettings('app'),
    },
  ];

  const startTestRun = () =>
    Alert.alert(
      'Start a test run?',
      'In 3 minutes the phone runs the midnight routine: it wakes, renews your session, and checks UMPoint’s clock without booking anything.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start test',
          onPress: () => {
            try {
              Sniper.arm({
                date: mytDate(rollover + DAY),
                start: '09:00',
                end: '09:30',
                court: '1',
                anyCourt: false,
                event: 'Sniper test',
                pax: 1,
                dryRun: true,
                fireAt: Date.now() + 3 * 60_000,
              });
              reloadTasks();
              toast('Test run scheduled in 3 minutes.', 'plain');
            } catch (err: any) {
              toast(err?.message || 'Couldn’t start test run.', 'error');
            }
          },
        },
      ],
    );

  const refresh = () => {
    bookings.refresh();
    reloadTasks();
    reloadSetup();
  };

  const bookingsLine = bookings.refreshing
    ? 'Updating from UMPoint…'
    : bookings.error
      ? `Couldn’t refresh: ${bookings.error}`
      : bookings.updatedAt
        ? `From UMPoint dashboard · ${ago(bookings.updatedAt, now).toLowerCase()}`
        : '';

  return (
    <>
      <ScrollScreen
        title="Sniper"
        right={<AccountButton onOpenSettings={onOpenSettings} />}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} tintColor={c.primary} colors={[c.primary]} />}
      >
        {/* Next Week Hero Card */}
        <View style={styles.pad}>
          <Tube
            title="Next week"
            range={weekRange(rollover)}
            meta={
              <Txt variant="labelMedium" color={c.primary}>
                {used(nextChambers)} of 2 used
              </Txt>
            }
            chambers={nextChambers}
          >
            <View style={styles.clockBlock} accessible accessibilityLabel={`Next week opens in ${countdown(rollover - now)}`}>
              <Txt variant="clock" color={c.onSurface}>
                {countdown(rollover - now)}
              </Txt>
              <Txt variant="bodySmall" color={c.onSurfaceVariant}>
                {running
                  ? 'The sniper is awake. It books at 00:00:00.'
                  : `until next week opens · ${shortDay(rollover)}, 00:00:00`}
              </Txt>
            </View>

            {ringing ? (
              <View style={[styles.alarm, { backgroundColor: c.errorContainer }]}>
                <Ionicons name="alarm" size={22} color={c.error} />
                <Txt variant="bodySmall" color={c.onErrorContainer} style={styles.flex}>
                  Your UMPoint session expired. Sign in before 00:00 or snipe cannot fire.
                </Txt>
                <Press onPress={() => requestSignIn()} style={[styles.alarmButton, { backgroundColor: c.error }]}>
                  <Txt variant="labelMedium" color={c.onError} style={styles.bold}>
                    Sign in
                  </Txt>
                </Press>
              </View>
            ) : null}
          </Tube>

          {used(nextChambers) > 2 ? (
            <Note tone="warn" style={styles.noteGap}>
              More than two bookings planned for next week. UMPoint allows at most two on different days.
            </Note>
          ) : null}
        </View>

        {/* This Week Card */}
        <View style={[styles.pad, styles.section]}>
          <Tube
            variant="white"
            title="This week"
            range={weekRange(thisMonday)}
            meta={
              <Txt variant="labelMedium" color={c.onSurfaceVariant}>
                {used(thisChambers)} of 2 used
              </Txt>
            }
            chambers={thisChambers}
          />
          <Txt variant="bodySmall" color={bookings.error ? c.error : c.onSurfaceVariant} style={styles.under} numberOfLines={2}>
            {session === 'signed_out' && !bookings.data ? 'Sign in to see your bookings.' : bookingsLine}
          </Txt>
        </View>

        {/* Phone Readiness Checklist */}
        <Group
          title="Phone readiness"
          footer={ready ? 'All requirements met for background midnight execution.' : 'Tap each item to open system settings and enable permissions.'}
        >
          {ready ? (
            <Row
              icon="shield-checkmark"
              iconColor={c.secondary}
              title="Ready for midnight"
              subtitle="Keep phone charging. It wakes at 23:50 to renew session and fire at 00:00:00."
            />
          ) : null}

          {!ready
            ? setupRows.map((row) => (
                <Row
                  key={row.title}
                  icon={row.ok ? 'checkmark-circle' : 'alert-circle'}
                  iconColor={row.ok ? c.secondary : c.tertiary}
                  title={row.title}
                  subtitle={row.ok ? undefined : row.text}
                  onPress={row.ok ? undefined : row.fix}
                  accessibilityLabel={row.ok ? `${row.title}, enabled` : `${row.title}, needs attention`}
                  right={
                    row.ok ? null : (
                      <View style={[styles.fix, { backgroundColor: c.tertiaryContainer }]}>
                        <Txt variant="labelSmall" color={c.onTertiaryContainer} style={styles.bold}>
                          Fix
                        </Txt>
                      </View>
                    )
                  }
                />
              ))
            : null}

          <Row
            icon="flask-outline"
            iconColor={c.primary}
            title="Test run (3 min)"
            subtitle="Simulates the complete midnight wake & check routine without booking."
            onPress={startTestRun}
            chevron
          />
        </Group>

        {/* UMPoint Policy & Rules */}
        <Group
          title="UMPoint booking rules"
          footer="Terms: Pusat Sukan rules. Page: Web constraints. Seen: Observed behaviour."
        >
          {RULES.map((r) => (
            <View key={r.rule} style={styles.rule}>
              <Txt variant="bodyMedium" color={c.onSurface} style={styles.flex}>
                {r.rule}
              </Txt>
              <SourceTag source={r.source} />
            </View>
          ))}
        </Group>

        {/* Snipe History */}
        {finished.length ? (
          <Group title="Snipe history">
            {finished.map((t) => {
              const look = TASK_LOOK[t.status] ?? TASK_LOOK.failed;
              return (
                <Press key={t.id} onPress={() => showTask(t)} accessibilityLabel={`${look.label}, ${dayLabel(t.date)}, ${t.start}`}>
                  <View style={styles.historyRow}>
                    <Shuttle state={look.shuttle} width={34} onDark={false} />
                    <View style={styles.flex}>
                      <Txt variant="bodyMedium" color={c.onSurface}>
                        {dayLabel(t.date)} · {t.start}–{t.end}
                      </Txt>
                      <Txt variant="bodySmall" color={c.onSurfaceVariant} numberOfLines={1}>
                        {t.dryRun ? 'Test run' : `Court ${t.bookedCourt ?? t.court}`} · {look.label}
                      </Txt>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={c.outline} />
                  </View>
                </Press>
              );
            })}
          </Group>
        ) : null}
      </ScrollScreen>

      <Sheet ref={taskSheet} onClosed={() => setOpenTask(null)}>
        {openTask ? (
          <TaskDetail
            task={tasks.find((t) => t.id === openTask.id) ?? openTask}
            onCancel={(t) =>
              Alert.alert('Cancel this snipe?', `${dayLabel(t.date)} ${t.start}–${t.end}, Court ${t.court}.`, [
                { text: 'Keep snipe', style: 'cancel' },
                {
                  text: 'Cancel snipe',
                  style: 'destructive',
                  onPress: () => {
                    cancelSnipe(t.id);
                    taskSheet.current?.close();
                    toast('Snipe cancelled', 'plain');
                  },
                },
              ])
            }
            onRemove={(t) => {
              removeSnipe(t.id);
              taskSheet.current?.close();
            }}
          />
        ) : null}
      </Sheet>

      <Sheet ref={bookingSheet} onClosed={() => setOpenBooking(null)}>
        {openBooking ? (
          <BookingDetail
            slot={openBooking}
            onOpenDashboard={() => {
              bookingSheet.current?.close();
              onOpenDashboard();
            }}
          />
        ) : null}
      </Sheet>
    </>
  );
};

function SourceTag({ source }: { source: (typeof RULES)[number]['source'] }) {
  const c = useColors();
  const look = {
    terms: { text: 'Terms', bg: c.primaryContainer, fg: c.onPrimaryContainer },
    page: { text: 'Page', bg: c.secondaryContainer, fg: c.onSecondaryContainer },
    seen: { text: 'Seen', bg: c.surfaceContainerHighest, fg: c.onSurfaceVariant },
    unknown: { text: 'Note', bg: c.tertiaryContainer, fg: c.onTertiaryContainer },
  }[source];

  return (
    <View style={[styles.tag, { backgroundColor: look.bg }]}>
      <Txt variant="labelSmall" color={look.fg} style={styles.tagText}>
        {look.text}
      </Txt>
    </View>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  const c = useColors();
  return (
    <View style={styles.field}>
      <Txt variant="bodyMedium" color={c.onSurfaceVariant} style={styles.fieldLabel}>
        {label}
      </Txt>
      <Txt variant="bodyMedium" color={c.onSurface} style={styles.fieldValue}>
        {value}
      </Txt>
    </View>
  );
}

function DetailHead({
  shuttle,
  status,
  statusColor,
  day,
  time,
}: {
  shuttle: ShuttleState;
  status: string;
  statusColor: string;
  day: string;
  time: string;
}) {
  const c = useColors();
  return (
    <View style={styles.detailHead}>
      <View style={[styles.detailShuttle, { backgroundColor: c.surfaceContainerHigh }]}>
        <Shuttle state={shuttle} width={52} onDark={false} />
      </View>
      <View style={styles.flex}>
        <Txt variant="labelMedium" color={statusColor} style={styles.bold}>
          {status}
        </Txt>
        <Txt variant="headlineSmall" color={c.onSurface} numberOfLines={1} adjustsFontSizeToFit>
          {time}
        </Txt>
        <Txt variant="bodySmall" color={c.onSurfaceVariant}>
          {day}
        </Txt>
      </View>
    </View>
  );
}

function TaskDetail({
  task,
  onCancel,
  onRemove,
}: {
  task: SniperTask;
  onCancel: (t: SniperTask) => void;
  onRemove: (t: SniperTask) => void;
}) {
  const c = useColors();
  const look = TASK_LOOK[task.status] ?? TASK_LOOK.failed;
  const liveNow = isLive(task);
  const statusColor = task.dryRun ? c.primary : look.shuttle === 'armed' ? c.tertiary : look.shuttle === 'booked' ? c.secondary : c.error;

  return (
    <View>
      <DetailHead
        shuttle={task.dryRun ? 'test' : look.shuttle}
        status={task.dryRun ? `Test run · ${look.label}` : look.label}
        statusColor={statusColor}
        day={dayLabel(task.date)}
        time={`${task.start}–${task.end}`}
      />
      <View style={[styles.fields, { backgroundColor: c.surfaceContainerHigh }]}>
        <Field
          label="Court"
          value={task.bookedCourt ? `Court ${task.bookedCourt}` : `Court ${task.court}${task.anyCourt ? ', fallback to any free court' : ''}`}
        />
        <Hairline color={c.outlineVariant} />
        <Field
          label={liveNow ? 'Fires at' : 'Fired at'}
          value={`${shortDay(task.fireAt)}, ${new Date(task.fireAt + 8 * 3_600_000).toISOString().slice(11, 19)} MYT`}
        />
        <Hairline color={c.outlineVariant} />
        <Field label="Booked as" value={`${task.event}, ${task.pax} ${task.pax === 1 ? 'player' : 'players'}`} />
      </View>
      {task.message ? <Note tone={task.status === 'failed' || task.status === 'missed' ? 'error' : 'info'} style={styles.noteGap}>{task.message}</Note> : null}
      {task.status === 'armed' ? (
        <Button label="Cancel snipe" tone="danger" icon="close-circle" onPress={() => onCancel(task)} style={styles.isolated} />
      ) : !liveNow ? (
        <Button label="Remove from history" tone="plain" onPress={() => onRemove(task)} style={styles.isolated} />
      ) : (
        <Txt variant="bodySmall" color={c.onSurfaceVariant} style={styles.isolatedText}>
          Sniper is currently active and running.
        </Txt>
      )}
    </View>
  );
}

function BookingDetail({ slot, onOpenDashboard }: { slot: BookedSlot; onOpenDashboard: () => void }) {
  const c = useColors();
  return (
    <View>
      <DetailHead shuttle="booked" status="Booked" statusColor={c.secondary} day={dayLabel(slot.date)} time={`${slot.start}–${slot.end}`} />
      <View style={[styles.fields, { backgroundColor: c.surfaceContainerHigh }]}>
        <Field label="Court" value={slot.court ? `Court ${slot.court}` : slot.booking.facility} />
        <Hairline color={c.outlineVariant} />
        <Field label="Event" value={slot.event || '—'} />
        <Hairline color={c.outlineVariant} />
        <Field label="Booking Ref" value={`No. ${slot.booking.num}${slot.booking.invoice ? ` · ${slot.booking.invoice}` : ''}`} />
        {slot.booking.booking_date ? (
          <>
            <Hairline color={c.outlineVariant} />
            <Field label="Booked on" value={slot.booking.booking_date} />
          </>
        ) : null}
      </View>
      {slot.booking.cancellable ? (
        <>
          <Button label="Cancel on UMPoint" tone="danger" icon="open-outline" onPress={onOpenDashboard} style={styles.isolated} />
          <Txt variant="bodySmall" color={c.onSurfaceVariant} style={styles.isolatedText}>
            Opens UMPoint portal in sheet.
          </Txt>
        </>
      ) : (
        <Txt variant="bodySmall" color={c.onSurfaceVariant} style={styles.isolatedText}>
          UMPoint does not offer cancellation for this booking.
        </Txt>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  bold: {
    fontWeight: '600',
  },
  pad: {
    paddingHorizontal: space.l,
  },
  section: {
    marginTop: space.l,
  },
  clockBlock: {
    marginTop: space.m,
  },
  alarm: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    marginTop: space.m,
    padding: space.m,
    borderRadius: shape.medium,
  },
  alarmButton: {
    paddingHorizontal: space.m,
    minHeight: 36,
    borderRadius: shape.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteGap: {
    marginTop: space.m,
  },
  under: {
    paddingHorizontal: space.xs,
    marginTop: space.s,
  },
  fix: {
    paddingHorizontal: 12,
    minHeight: 28,
    borderRadius: shape.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rule: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.m,
    paddingHorizontal: space.l,
    paddingVertical: space.m,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: shape.extraSmall,
    marginTop: 2,
  },
  tagText: {
    fontWeight: '600',
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    paddingHorizontal: space.l,
    paddingVertical: space.m,
    minHeight: 56,
  },
  detailHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.l,
    marginBottom: space.m,
  },
  detailShuttle: {
    width: 68,
    height: 68,
    borderRadius: shape.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fields: {
    marginTop: space.l,
    borderRadius: shape.medium,
    overflow: 'hidden',
  },
  field: {
    flexDirection: 'row',
    gap: space.m,
    paddingHorizontal: space.l,
    paddingVertical: space.m,
    alignItems: 'center',
  },
  fieldLabel: {
    width: 96,
  },
  fieldValue: {
    flex: 1,
    textAlign: 'right',
  },
  isolated: {
    marginTop: space.xl,
  },
  isolatedText: {
    textAlign: 'center',
    marginTop: space.s,
  },
});
