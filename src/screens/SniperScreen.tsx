import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { cancelTask, getStatus, getTasks } from '../services/api';
import { SniperTask, SystemStatus } from '../types';

interface Props {
  onNavigateToCourts?: () => void;
}

export const SniperScreen: React.FC<Props> = ({ onNavigateToCourts }) => {
  const [tasks, setTasks] = useState<SniperTask[]>([]);
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [countdownStr, setCountdownStr] = useState<string>('--:--:--');

  const fetchData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [statusRes, tasksRes] = await Promise.all([getStatus(), getTasks()]);
      setStatus(statusRes);
      setTasks(tasksRes);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not fetch sniper queue.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      fetchData(true);
    }, 15000); // Poll status every 15s
    return () => clearInterval(interval);
  }, []);

  // Live seconds countdown ticker
  useEffect(() => {
    if (!status?.rollover_timestamp) return;

    const tick = () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const diff = Math.max(0, status.rollover_timestamp - nowSec);

      const days = Math.floor(diff / 86400);
      const hours = Math.floor((diff % 86400) / 3600);
      const mins = Math.floor((diff % 3600) / 60);
      const secs = diff % 60;

      if (days > 0) {
        setCountdownStr(`${days}d ${hours.toString().padStart(2, '0')}h ${mins.toString().padStart(2, '0')}m ${secs.toString().padStart(2, '0')}s`);
      } else {
        setCountdownStr(`${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
      }
    };

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [status?.rollover_timestamp]);

  const handleCancelTask = (taskId: string) => {
    Alert.alert('Cancel Sniper Task', 'Cancel this scheduled sniper booking?', [
      { text: 'No' },
      {
        text: 'Yes, Cancel',
        style: 'destructive',
        onPress: async () => {
          try {
            await cancelTask(taskId);
            fetchData(true);
          } catch (err: any) {
            Alert.alert('Error', err?.message || 'Failed to cancel task');
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Rollover Auto-Sniper</Text>
        <Text style={styles.subtitle}>Autonomous booking engine for next-week courts</Text>
      </View>

      {/* Countdown Hero Banner */}
      <View style={styles.countdownCard}>
        <View style={styles.countdownRow}>
          <MaterialCommunityIcons name="target" size={28} color="#ef4444" />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.countdownLabel}>NEXT WEEK ROLLOVER IN</Text>
            <Text style={styles.countdownDigits}>{countdownStr}</Text>
          </View>
        </View>
        <View style={styles.ruleBox}>
          <Ionicons name="information-circle-outline" size={16} color="#94a3b8" />
          <Text style={styles.ruleText}>
            UMPoint unlocks next-week court reservations at strictly{' '}
            <Text style={styles.ruleTextBold}>Monday 00:00:00 MYT</Text>. The bot wakes up automatically at rollover to reserve your slots.
          </Text>
        </View>
      </View>

      {/* Queue List Header */}
      <View style={styles.queueHeader}>
        <Text style={styles.queueTitle}>Scheduled Sniper Queue ({tasks.length})</Text>
        <TouchableOpacity style={styles.newSnipeBtn} onPress={onNavigateToCourts}>
          <Ionicons name="add" size={16} color="#ffffff" />
          <Text style={styles.newSnipeBtnText}>Queue Court</Text>
        </TouchableOpacity>
      </View>

      {loading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#ef4444" />
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchData(true)}
              tintColor="#ef4444"
            />
          }
        >
          {tasks.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="timer-sand-empty" size={56} color="#334155" />
              <Text style={styles.emptyTitle}>No Scheduled Snipes</Text>
              <Text style={styles.emptySubtitle}>
                Select any slot in Next Week from the Courts tab and choose "Queue for Mon 00:00 Rollover" to auto-book.
              </Text>
            </View>
          ) : (
            tasks.map((task) => {
              const isWaiting = task.status === 'pending' || task.status === 'waiting_for_rollover';
              const isCompleted = task.status === 'completed';
              const isFailed = task.status === 'failed';
              const isCancelled = task.status === 'cancelled';

              return (
                <View key={task.id} style={styles.taskCard}>
                  <View style={styles.taskCardHeader}>
                    <View style={styles.courtBadge}>
                      <Text style={styles.courtBadgeText}>
                        {task.court === 'any' ? 'Court 1-4 (Any)' : `Court ${task.court}`}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.taskStatusPill,
                        isWaiting && styles.statusWaiting,
                        isCompleted && styles.statusCompleted,
                        (isFailed || isCancelled) && styles.statusFailed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.taskStatusText,
                          isWaiting && styles.statusTextWaiting,
                          isCompleted && styles.statusTextCompleted,
                          (isFailed || isCancelled) && styles.statusTextFailed,
                        ]}
                      >
                        {task.status.replace(/_/g, ' ').toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.taskEventName}>{task.event}</Text>

                  <View style={styles.taskMetaRow}>
                    <Ionicons name="calendar-outline" size={15} color="#94a3b8" />
                    <Text style={styles.taskMetaText}>{task.date}</Text>
                    <Text style={styles.taskMetaDot}>•</Text>
                    <Ionicons name="time-outline" size={15} color="#94a3b8" />
                    <Text style={styles.taskMetaText}>
                      {task.start} – {task.end}
                    </Text>
                    <Text style={styles.taskMetaDot}>•</Text>
                    <Ionicons name="people-outline" size={15} color="#94a3b8" />
                    <Text style={styles.taskMetaText}>{task.pax} pax</Text>
                  </View>

                  {task.result?.message ? (
                    <View style={styles.resultBox}>
                      <Text style={styles.resultText}>{task.result.message}</Text>
                    </View>
                  ) : null}

                  {isWaiting ? (
                    <View style={styles.taskFooter}>
                      <Text style={styles.taskTargetTime}>
                        Fires at: {task.rollover_time} MYT
                      </Text>
                      <TouchableOpacity
                        style={styles.taskCancelBtn}
                        onPress={() => handleCancelTask(task.id)}
                      >
                        <Text style={styles.taskCancelBtnText}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090d16',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
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
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: '#171328',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#371e44',
  },
  countdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  countdownLabel: {
    color: '#f87171',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  countdownDigits: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: '900',
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  ruleBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 8,
    padding: 10,
    marginTop: 12,
    gap: 8,
  },
  ruleText: {
    flex: 1,
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 18,
  },
  ruleTextBold: {
    color: '#f8fafc',
    fontWeight: '700',
  },
  queueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 8,
  },
  queueTitle: {
    color: '#e2e8f0',
    fontSize: 15,
    fontWeight: '700',
  },
  newSnipeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dc2626',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  newSnipeBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    color: '#cbd5e1',
    fontSize: 17,
    fontWeight: '700',
    marginTop: 16,
  },
  emptySubtitle: {
    color: '#64748b',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  taskCard: {
    backgroundColor: '#131b2e',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  taskCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  courtBadge: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  courtBadgeText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '700',
  },
  taskStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusWaiting: {
    backgroundColor: '#7f1d1d',
  },
  statusCompleted: {
    backgroundColor: '#064e3b',
  },
  statusFailed: {
    backgroundColor: '#334155',
  },
  taskStatusText: {
    fontSize: 10,
    fontWeight: '800',
  },
  statusTextWaiting: {
    color: '#fca5a5',
  },
  statusTextCompleted: {
    color: '#34d399',
  },
  statusTextFailed: {
    color: '#94a3b8',
  },
  taskEventName: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 8,
  },
  taskMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  taskMetaText: {
    color: '#94a3b8',
    fontSize: 13,
  },
  taskMetaDot: {
    color: '#475569',
  },
  resultBox: {
    marginTop: 10,
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#0f172a',
  },
  resultText: {
    color: '#cbd5e1',
    fontSize: 12,
  },
  taskFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  taskTargetTime: {
    color: '#64748b',
    fontSize: 11,
  },
  taskCancelBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 6,
  },
  taskCancelBtnText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '700',
  },
});
