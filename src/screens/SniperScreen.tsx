import React, { useCallback, useEffect, useState } from 'react';
import { Alert, AppState, PermissionsAndroid, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PhoneSetup, Sniper, SniperTask } from '../../modules/umpoint-sniper';
import { dayLabel, mytDate, nextRolloverMs } from '../services/umpointClient';
import { Card, Hairline, Press, SectionTitle, Txt } from '../ui';
import { ScreenHeader, SessionPill, useToast } from '../components/Pieces';
import { radius, space, useColors } from '../theme';

interface Props {
  onPickSlot: () => void;
  onOpenSettings: () => void;
}

const LIVE = ['armed', 'running', 'ringing'];
const finished = (t: SniperTask) => !LIVE.includes(t.status);

function clock(ms: number): { days: number; hms: string } {
  const s = Math.max(0, Math.floor(ms / 1000));
  const hms = [Math.floor((s % 86400) / 3600), Math.floor((s % 3600) / 60), s % 60]
    .map((n) => String(n).padStart(2, '0'))
    .join(':');
  return { days: Math.floor(s / 86400), hms };
}

/** Where each rule comes from, so nobody mistakes a guess for a rule. */
const RULES: { rule: string; source: 'terms' | 'page' | 'seen' | 'unknown' }[] = [
  { rule: 'One court and one session a day.', source: 'terms' },
  { rule: 'Two bookings a week, on different days — so at most two sessions.', source: 'terms' },
  { rule: 'Book at least a day ahead. No same-day bookings.', source: 'page' },
  { rule: 'Next week opens Monday 00:00 MYT, which makes its Monday same-day: snipe Tuesday–Friday.', source: 'seen' },
  { rule: 'Weekdays 09:00–19:00 in half-hour blocks. Weekends are closed.', source: 'seen' },
  { rule: 'No longest session is stated anywhere. The app offers up to 2 hours.', source: 'unknown' },
  { rule: 'Pusat Sukan may cancel or change any booking.', source: 'terms' },
];

export const SniperScreen: React.FC<Props> = ({ onPickSlot, onOpenSettings }) => {
  const c = useColors();
  const toast = useToast();
  const [tasks, setTasks] = useState<SniperTask[]>(() => Sniper.tasks());
  const [setup, setSetup] = useState<PhoneSetup>(() => Sniper.phoneSetup());
  const [now, setNow] = useState<number>(() => Date.now());

  const reload = useCallback(() => {
    setTasks(Sniper.tasks());
    setSetup(Sniper.phoneSetup());
  }, []);

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const poll = setInterval(reload, 3000);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && reload());
    return () => {
      clearInterval(tick);
      clearInterval(poll);
      sub.remove();
    };
  }, [reload]);

  const rollover = nextRolloverMs(now);
  const left = clock(rollover - now);
  const live = tasks.filter((t) => !finished(t)).sort((a, b) => a.fireAt - b.fireAt);
  const done = tasks.filter(finished).sort((a, b) => b.updatedAt - a.updatedAt);
  const ready = setup.notifications && setup.exactAlarms && setup.fullScreen && !setup.backgroundRestricted;

  const fixNotifications = async () => {
    if (Platform.OS === 'android' && Number(Platform.Version) >= 33) {
      const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
      if (r === 'granted') return reload();
    }
    Sniper.openSettings('notifications');
  };

  const setupRows = [
    { ok: setup.notifications, title: 'Notifications', text: 'So it can tell you whether you got the court.', fix: fixNotifications },
    { ok: setup.exactAlarms, title: 'Alarms & reminders', text: 'Wakes the phone at 23:50 to get ready.', fix: () => Sniper.openSettings('exactAlarms') },
    { ok: setup.fullScreen, title: 'Full-screen alarm', text: 'Lets it ring over the lock screen if you must sign in.', fix: () => Sniper.openSettings('fullScreen') },
    {
      ok: !setup.backgroundRestricted,
      title: 'Battery not restricted',
      text: 'A restricted app can’t run at midnight. Set battery to Optimised or Unrestricted.',
      fix: () => Sniper.openSettings('app'),
    },
  ];

  /** The whole midnight sequence on a 3-minute clock, without booking anything. */
  const testRun = () => {
    try {
      Sniper.arm({
        date: mytDate(rollover + 86_400_000),
        start: '09:00',
        end: '09:30',
        court: '1',
        anyCourt: false,
        event: 'Sniper test',
        pax: 1,
        dryRun: true,
        fireAt: Date.now() + 3 * 60_000,
      });
      reload();
      toast('Test run in 3 minutes — books nothing', 'plain');
    } catch (err: any) {
      Alert.alert('Couldn’t start the test', err?.message || 'Something went wrong.');
    }
  };

  const cancel = (t: SniperTask) =>
    Alert.alert('Cancel this snipe?', `${dayLabel(t.date)} ${t.start}–${t.end}, Court ${t.court}`, [
      { text: 'Keep it' },
      {
        text: 'Cancel snipe',
        style: 'destructive',
        onPress: () => {
          Sniper.cancel(t.id);
          reload();
        },
      },
    ]);

  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={styles.content}>
      <ScreenHeader title="Sniper" right={<SessionPill onOpenSettings={onOpenSettings} />} />

      <View style={styles.pad}>
        <View style={[styles.hero, { backgroundColor: c.mat }]}>
          {/* the court's own lines, faint, behind the clock */}
          <View style={[styles.heroNet, { backgroundColor: c.courtLine }]} />
          <View style={[styles.heroLine, { left: '18%', backgroundColor: c.courtLine }]} />
          <View style={[styles.heroLine, { right: '18%', backgroundColor: c.courtLine }]} />
          <Txt variant="caption" color={c.courtLine} style={{ opacity: 0.85 }}>
            Next week opens in
          </Txt>
          <View style={styles.heroClock}>
            {left.days > 0 ? (
              <Txt variant="clock" color={c.courtLine}>
                {left.days}d{' '}
              </Txt>
            ) : null}
            <Txt variant="clock" color={c.courtLine} style={{ fontVariant: ['tabular-nums'] }}>
              {left.hms}
            </Txt>
          </View>
          <Txt variant="footnote" color={c.courtLine} style={{ opacity: 0.85 }}>
            {dayLabel(mytDate(rollover))} · 00:00:00 MYT
          </Txt>
          <View style={styles.heroFooter}>
            <View style={[styles.armedBadge, { backgroundColor: 'rgba(255,255,255,0.16)' }]}>
              <View style={[styles.dot, { backgroundColor: live.length ? c.smash : c.courtLine }]} />
              <Txt variant="footnote" color={c.courtLine} style={{ fontWeight: '600' }}>
                {live.length ? `${live.length} armed` : 'Nothing armed'}
              </Txt>
            </View>
            <Press onPress={onPickSlot} style={[styles.heroButton, { backgroundColor: c.courtLine }]}>
              <Ionicons name="add" size={16} color={c.mat} />
              <Txt variant="callout" color={c.mat} style={{ fontWeight: '700' }}>
                Pick a slot
              </Txt>
            </Press>
          </View>
        </View>
      </View>

      {live.length ? (
        <View style={styles.section}>
          <SectionTitle>Armed</SectionTitle>
          {live.map((t) => (
            <TaskCard key={t.id} task={t} onCancel={() => cancel(t)} />
          ))}
        </View>
      ) : null}

      <View style={styles.section}>
        <SectionTitle>This phone</SectionTitle>
        <Card style={styles.list}>
          {ready ? (
            <View style={styles.setupRow}>
              <Ionicons name="shield-checkmark" size={20} color={c.mat} />
              <View style={styles.flex}>
                <Txt variant="headline">Ready for midnight</Txt>
                <Txt variant="footnote" color={c.ink2}>
                  Leave it on the charger. At 23:50 it wakes, renews your sign-in and checks UMPoint’s clock.
                </Txt>
              </View>
            </View>
          ) : (
            setupRows.map((row, i) => (
              <View key={row.title}>
                {i > 0 ? <Hairline inset={48} /> : null}
                <Press onPress={row.fix} disabled={row.ok} style={styles.setupRow}>
                  <Ionicons name={row.ok ? 'checkmark-circle' : 'alert-circle'} size={20} color={row.ok ? c.mat : c.cork} />
                  <View style={styles.flex}>
                    <Txt variant="headline">{row.title}</Txt>
                    {!row.ok ? (
                      <Txt variant="footnote" color={c.ink2}>
                        {row.text}
                      </Txt>
                    ) : null}
                  </View>
                  {!row.ok ? (
                    <Txt variant="callout" color={c.cork} style={{ fontWeight: '700' }}>
                      Fix
                    </Txt>
                  ) : null}
                </Press>
              </View>
            ))
          )}
          <Hairline inset={48} />
          <Press onPress={testRun} style={styles.setupRow}>
            <Ionicons name="flask-outline" size={20} color={c.ink2} />
            <View style={styles.flex}>
              <Txt variant="headline">Test run</Txt>
              <Txt variant="footnote" color={c.ink2}>
                The whole midnight routine in 3 minutes. Books nothing.
              </Txt>
            </View>
            <Ionicons name="chevron-forward" size={16} color={c.ink3} />
          </Press>
        </Card>
      </View>

      <View style={styles.section}>
        <SectionTitle>What UMPoint allows</SectionTitle>
        <Card style={styles.list}>
          {RULES.map((r, i) => (
            <View key={r.rule}>
              {i > 0 ? <Hairline /> : null}
              <View style={styles.ruleRow}>
                <Txt variant="body" style={styles.flex}>
                  {r.rule}
                </Txt>
                <SourceTag source={r.source} />
              </View>
            </View>
          ))}
        </Card>
        <Txt variant="footnote" color={c.ink3} style={styles.footnote}>
          Terms: Pusat Sukan’s booking terms on UMPoint. Page: UMPoint’s booking page. Seen: how UMPoint behaves.
          Neither the terms nor the page set a longest session.
        </Txt>
      </View>

      {done.length ? (
        <View style={styles.section}>
          <SectionTitle>Finished</SectionTitle>
          {done.map((t) => (
            <TaskCard
              key={t.id}
              task={t}
              onRemove={() => {
                Sniper.remove(t.id);
                reload();
              }}
            />
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
};

function SourceTag({ source }: { source: (typeof RULES)[number]['source'] }) {
  const c = useColors();
  const look = {
    terms: { text: 'Terms', bg: c.matSoft, fg: c.mat },
    page: { text: 'Page', bg: c.matSoft, fg: c.mat },
    seen: { text: 'Seen', bg: c.fill, fg: c.ink2 },
    unknown: { text: 'Not stated', bg: c.corkSoft, fg: c.cork },
  }[source];
  return (
    <View style={[styles.tag, { backgroundColor: look.bg }]}>
      <Txt variant="caption" color={look.fg} style={{ fontSize: 10 }}>
        {look.text}
      </Txt>
    </View>
  );
}

const STATUS: Record<SniperTask['status'], { label: string; tone: 'smash' | 'mat' | 'cork' | 'ink' }> = {
  armed: { label: 'Armed', tone: 'smash' },
  running: { label: 'Running', tone: 'smash' },
  ringing: { label: 'Needs sign-in', tone: 'smash' },
  booked: { label: 'Booked', tone: 'mat' },
  failed: { label: 'Not booked', tone: 'cork' },
  dry_run: { label: 'Test OK', tone: 'mat' },
  missed: { label: 'Missed', tone: 'ink' },
  cancelled: { label: 'Cancelled', tone: 'ink' },
};

function TaskCard({ task, onCancel, onRemove }: { task: SniperTask; onCancel?: () => void; onRemove?: () => void }) {
  const c = useColors();
  const st = STATUS[task.status] ?? STATUS.failed;
  const color = st.tone === 'smash' ? c.smash : st.tone === 'mat' ? c.mat : st.tone === 'cork' ? c.cork : c.ink3;
  const soft = st.tone === 'smash' ? c.smashSoft : st.tone === 'mat' ? c.matSoft : st.tone === 'cork' ? c.corkSoft : c.fill;
  return (
    <Card style={styles.taskCard}>
      <View style={styles.taskTop}>
        <View style={styles.flex}>
          <Txt variant="caption" color={c.ink3}>
            {task.dryRun ? 'Test run' : `Court ${task.bookedCourt ?? task.court}${task.anyCourt && !task.bookedCourt ? ' · or any court' : ''}`}
          </Txt>
          <View style={styles.taskWhen}>
            <Txt variant="time">{task.start}</Txt>
            <Txt variant="headline" color={c.ink2}>
              {dayLabel(task.date)} · to {task.end}
            </Txt>
          </View>
        </View>
        <View style={[styles.tag, { backgroundColor: soft }]}>
          <Txt variant="caption" color={color} style={{ fontSize: 10 }}>
            {st.label}
          </Txt>
        </View>
      </View>
      {task.message ? (
        <Txt variant="footnote" color={c.ink2} style={{ marginTop: space.s }}>
          {task.message}
        </Txt>
      ) : null}
      {onCancel && task.status === 'armed' ? (
        <Press onPress={onCancel} style={styles.taskAction}>
          <Txt variant="callout" color={c.smash} style={{ fontWeight: '600' }}>
            Cancel snipe
          </Txt>
        </Press>
      ) : null}
      {onRemove ? (
        <Press onPress={onRemove} style={styles.taskAction}>
          <Txt variant="callout" color={c.ink3}>
            Remove
          </Txt>
        </Press>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    paddingBottom: space.xxl,
  },
  pad: {
    paddingHorizontal: space.l,
  },
  hero: {
    borderRadius: radius.l,
    padding: space.l,
    overflow: 'hidden',
  },
  heroNet: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '50%',
    width: 2,
    opacity: 0.12,
  },
  heroLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1.5,
    opacity: 0.08,
  },
  heroClock: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: space.xs,
  },
  heroFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.l,
  },
  armedBadge: {
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
  heroButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
  },
  section: {
    paddingHorizontal: space.l,
    marginTop: space.xl,
  },
  list: {
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  setupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    paddingHorizontal: space.l,
    paddingVertical: space.m,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.m,
    paddingHorizontal: space.l,
    paddingVertical: space.m,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 2,
  },
  footnote: {
    paddingHorizontal: space.xs,
    marginTop: space.s,
  },
  taskCard: {
    marginBottom: space.s,
  },
  taskTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.m,
  },
  taskWhen: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space.s,
    marginTop: 2,
  },
  taskAction: {
    alignSelf: 'flex-start',
    marginTop: space.m,
  },
});
