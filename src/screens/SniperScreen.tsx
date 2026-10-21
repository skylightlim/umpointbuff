import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  AppState,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { PhoneSetup, Sniper, SniperTask } from '../../modules/umpoint-sniper';
import { dayLabel, mytDate, nextRolloverMs } from '../services/umpointClient';

interface Props {
  onNavigateToCourts?: () => void;
}

const STATUS: Record<SniperTask['status'], { label: string; color: string }> = {
  armed: { label: 'ARMED', color: '#f59e0b' },
  running: { label: 'RUNNING', color: '#38bdf8' },
  ringing: { label: 'NEEDS SIGN-IN', color: '#ef4444' },
  booked: { label: 'BOOKED', color: '#10b981' },
  failed: { label: 'NOT BOOKED', color: '#ef4444' },
  dry_run: { label: 'TEST OK', color: '#10b981' },
  missed: { label: 'MISSED', color: '#94a3b8' },
  cancelled: { label: 'CANCELLED', color: '#64748b' },
};

const finished = (t: SniperTask) => !['armed', 'running', 'ringing'].includes(t.status);

function countdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const hms = [Math.floor((s % 86400) / 3600), Math.floor((s % 3600) / 60), s % 60]
    .map((n) => String(n).padStart(2, '0'))
    .join(':');
  return d > 0 ? `${d}d ${hms}` : hms;
}

function fireLabel(t: SniperTask): string {
  const time = new Date(t.fireAt + 8 * 3_600_000).toISOString().slice(11, 19);
  return `${dayLabel(mytDate(t.fireAt))}, ${time} MYT`;
}

export const SniperScreen: React.FC<Props> = ({ onNavigateToCourts }) => {
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
  const ready = setup.notifications && setup.exactAlarms && setup.fullScreen && !setup.backgroundRestricted;

  const fixNotifications = async () => {
    if (Platform.OS === 'android' && Number(Platform.Version) >= 33) {
      const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
      if (r === 'granted') return reload();
    }
    Sniper.openSettings('notifications');
  };

  const setupRows: { ok: boolean; title: string; text: string; fix: () => void }[] = [
    {
      ok: setup.notifications,
      title: 'Notifications',
      text: 'To tell you whether you got the court.',
      fix: fixNotifications,
    },
    {
      ok: setup.exactAlarms,
      title: 'Alarms & reminders',
      text: 'Wakes the phone at 23:50 to get ready.',
      fix: () => Sniper.openSettings('exactAlarms'),
    },
    {
      ok: setup.fullScreen,
      title: 'Full-screen alarm',
      text: 'Lets it ring over the lock screen if you must sign in.',
      fix: () => Sniper.openSettings('fullScreen'),
    },
    {
      ok: !setup.backgroundRestricted,
      title: 'Battery not restricted',
      text: 'A “Restricted” app can’t run at midnight. Use “Optimised” or “Unrestricted”.',
      fix: () => Sniper.openSettings('app'),
    },
  ];

  /** The whole midnight sequence on a 3-minute clock, without booking anything. */
  const testRun = () => {
    const nextTuesday = mytDate(rollover + 86_400_000);
    try {
      Sniper.arm({
        date: nextTuesday,
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
      Alert.alert(
        'Test run started',
        'In 3 minutes it goes through what happens at midnight — session check, clock, the shot — but books nothing. Lock the phone if you like; a notification tells you how it went.',
      );
    } catch (err: any) {
      Alert.alert('Could not start the test', err?.message || 'Something went wrong.');
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

  const remove = (t: SniperTask) => {
    Sniper.remove(t.id);
    reload();
  };

  const visible = [...tasks].sort((a, b) =>
    finished(a) === finished(b) ? b.fireAt - a.fireAt : finished(a) ? 1 : -1,
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Rollover Sniper</Text>
        <Text style={styles.subtitle}>Books next week’s court at the second it opens</Text>
      </View>

      <View style={styles.countdownCard}>
        <View style={styles.countdownRow}>
          <MaterialCommunityIcons name="target" size={28} color="#ef4444" />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.countdownLabel}>NEXT WEEK OPENS IN</Text>
            <Text style={styles.countdownDigits}>{countdown(rollover - now)}</Text>
          </View>
        </View>
        <Text style={styles.ruleText}>
          UMPoint opens next week at <Text style={styles.ruleTextBold}>Monday 00:00:00 MYT</Text>. At 23:50 the phone
          wakes, renews your session, checks UMPoint’s clock, and fires on the second. Leave it on the charger.
        </Text>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name={ready ? 'shield-checkmark' : 'warning-outline'} size={18} color={ready ? '#10b981' : '#f59e0b'} />
          <Text style={styles.cardTitle}>{ready ? 'Phone is ready' : 'Phone setup'}</Text>
        </View>
        {setupRows.map((row) => (
          <TouchableOpacity key={row.title} style={styles.setupRow} onPress={row.fix} disabled={row.ok}>
            <Ionicons
              name={row.ok ? 'checkmark-circle' : 'alert-circle'}
              size={20}
              color={row.ok ? '#10b981' : '#f59e0b'}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.setupTitle}>{row.title}</Text>
              {!row.ok && <Text style={styles.setupText}>{row.text}</Text>}
            </View>
            {!row.ok && <Text style={styles.fixText}>Fix</Text>}
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={styles.testBtn} onPress={testRun}>
          <Ionicons name="flask-outline" size={16} color="#38bdf8" />
          <Text style={styles.testBtnText}>Test run (books nothing)</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.queueHeader}>
        <Text style={styles.queueTitle}>Snipes</Text>
        <TouchableOpacity style={styles.newSnipeBtn} onPress={onNavigateToCourts}>
          <Ionicons name="add" size={16} color="#ffffff" />
          <Text style={styles.newSnipeBtnText}>Pick a slot</Text>
        </TouchableOpacity>
      </View>

      {visible.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="timer-sand-empty" size={56} color="#334155" />
          <Text style={styles.emptyTitle}>Nothing armed</Text>
          <Text style={styles.emptySubtitle}>
            On the Courts tab, switch to Next Week, pick Tuesday–Friday, tap a green slot and arm the sniper.
          </Text>
        </View>
      ) : (
        visible.map((t) => {
          const st = STATUS[t.status] ?? STATUS.failed;
          return (
            <View key={t.id} style={styles.taskCard}>
              <View style={styles.taskCardHeader}>
                <Text style={styles.courtBadgeText}>
                  {t.dryRun ? 'Test run' : `Court ${t.bookedCourt ?? t.court}${t.anyCourt && !t.bookedCourt ? ' or any' : ''}`}
                </Text>
                <View style={[styles.statusPill, { borderColor: st.color, backgroundColor: st.color + '1f' }]}>
                  <Text style={[styles.statusText, { color: st.color }]}>{st.label}</Text>
                </View>
              </View>
              <Text style={styles.taskSlot}>
                {dayLabel(t.date)} · {t.start}–{t.end}
              </Text>
              <Text style={styles.taskMeta}>
                {t.event} · {t.pax} pax · fires {fireLabel(t)}
              </Text>
              {t.message ? <Text style={styles.resultText}>{t.message}</Text> : null}
              <View style={styles.taskFooter}>
                {t.status === 'armed' ? (
                  <TouchableOpacity onPress={() => cancel(t)}>
                    <Text style={styles.taskCancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                ) : finished(t) ? (
                  <TouchableOpacity onPress={() => remove(t)}>
                    <Text style={styles.taskRemoveText}>Remove</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090d16',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
    gap: 14,
  },
  header: {
    paddingTop: 4,
  },
  title: {
    color: '#f8fafc',
    fontSize: 22,
    fontWeight: '800',
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 4,
  },
  countdownCard: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    gap: 12,
  },
  countdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  countdownLabel: {
    color: '#fca5a5',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  countdownDigits: {
    color: '#f8fafc',
    fontSize: 28,
    fontWeight: '800',
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  ruleText: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 18,
  },
  ruleTextBold: {
    color: '#f8fafc',
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#131b2e',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  cardTitle: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '700',
  },
  setupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  setupTitle: {
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: '600',
  },
  setupText: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  fixText: {
    color: '#f59e0b',
    fontSize: 13,
    fontWeight: '700',
  },
  testBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.35)',
  },
  testBtnText: {
    color: '#38bdf8',
    fontSize: 13,
    fontWeight: '700',
  },
  queueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  queueTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '700',
  },
  newSnipeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ef4444',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  newSnipeBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 24,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    color: '#e2e8f0',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 12,
  },
  emptySubtitle: {
    color: '#64748b',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 19,
  },
  taskCard: {
    backgroundColor: '#131b2e',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  taskCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  courtBadgeText: {
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: '700',
  },
  statusPill: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
  },
  taskSlot: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 8,
  },
  taskMeta: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 4,
  },
  resultText: {
    color: '#cbd5e1',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 8,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#0f172a',
  },
  taskFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  taskCancelBtnText: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '700',
  },
  taskRemoveText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600',
  },
});
