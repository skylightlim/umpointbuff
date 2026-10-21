import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { getStatus } from '../services/api';
import { clearSession, getSessionCookies } from '../services/session';
import { SystemStatus } from '../types';
import { LoginModal } from '../components/LoginModal';

export const SettingsScreen: React.FC = () => {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [cookies, setCookies] = useState<string>('');
  const [loginModalVisible, setLoginModalVisible] = useState<boolean>(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setCookies(await getSessionCookies());

    try {
      const s = await getStatus();
      setStatus(s);
    } catch {
      setStatus(null);
    }
  };

  const handleClearCookies = async () => {
    Alert.alert('Clear Session', 'Log out and clear stored UMPoint session cookies?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          await clearSession();
          setCookies('');
          Alert.alert('Cleared', 'Session cookies cleared.');
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings & Account</Text>
        <Text style={styles.subtitle}>Configure mobile client and UMPoint credentials</Text>
      </View>

      {/* UMPoint Student Session Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="key-outline" size={20} color="#38bdf8" />
          <Text style={styles.cardTitle}>UMPoint Student Login</Text>
        </View>

        <View style={styles.sessionStatusBox}>
          <View style={[styles.statusDot, Boolean(cookies) ? styles.dotGreen : styles.dotRed]} />
          <Text style={styles.sessionStatusText}>
            {Boolean(cookies) ? 'Authenticated Session Active' : 'Not Signed In'}
          </Text>
        </View>

        <View style={styles.btnRow}>
          <TouchableOpacity
            style={styles.loginModalBtn}
            onPress={() => setLoginModalVisible(true)}
          >
            <Ionicons name="log-in-outline" size={18} color="#ffffff" style={{ marginRight: 6 }} />
            <Text style={styles.loginModalBtnText}>Sign In with Google SSO</Text>
          </TouchableOpacity>

          {Boolean(cookies) && (
            <TouchableOpacity style={styles.logoutBtn} onPress={handleClearCookies}>
              <Ionicons name="log-out-outline" size={18} color="#ef4444" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Live System Diagnostics */}
      {status && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons name="cloud-sync-outline" size={20} color="#38bdf8" />
            <Text style={styles.cardTitle}>System Synchronization</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Current Time (MYT):</Text>
            <Text style={styles.infoValue}>{status.current_time_myt}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>This Week (Mon-Sun):</Text>
            <Text style={styles.infoValue}>
              {status.current_week.start} to {status.current_week.end}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Next Week (Mon-Sun):</Text>
            <Text style={styles.infoValue}>
              {status.next_week.start} to {status.next_week.end}
            </Text>
          </View>
        </View>
      )}

      {/* Rules Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="shield-checkmark-outline" size={20} color="#f59e0b" />
          <Text style={styles.cardTitle}>UMPoint Rules & Quota</Text>
        </View>

        <View style={styles.bulletItem}>
          <Text style={styles.bulletDot}>•</Text>
          <Text style={styles.bulletText}>
            <Text style={styles.bulletBold}>Limit:</Text> Max 1 court/session per day, ≤ 2 bookings per week.
          </Text>
        </View>
        <View style={styles.bulletItem}>
          <Text style={styles.bulletDot}>•</Text>
          <Text style={styles.bulletText}>
            <Text style={styles.bulletBold}>Next-Week Booking Window:</Text> Rollover occurs strictly at{' '}
            <Text style={styles.bulletHighlight}>Monday 00:00:00 MYT</Text>.
          </Text>
        </View>
        <View style={styles.bulletItem}>
          <Text style={styles.bulletDot}>•</Text>
          <Text style={styles.bulletText}>
            <Text style={styles.bulletBold}>Venue:</Text> Gelanggang Badminton 1–4 J2, Second College.
          </Text>
        </View>
      </View>

      <LoginModal
        visible={loginModalVisible}
        onClose={() => setLoginModalVisible(false)}
        onSuccess={(c) => {
          setCookies(c);
          loadSettings();
        }}
      />
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
    gap: 16,
  },
  header: {
    paddingVertical: 10,
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
  card: {
    backgroundColor: '#131b2e',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  cardTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '700',
  },
  sessionStatusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 12,
    gap: 10,
    marginBottom: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotGreen: {
    backgroundColor: '#10b981',
  },
  dotRed: {
    backgroundColor: '#ef4444',
  },
  sessionStatusText: {
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: '600',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  loginModalBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 12,
  },
  loginModalBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  logoutBtn: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  infoLabel: {
    color: '#94a3b8',
    fontSize: 13,
  },
  infoValue: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '600',
  },
  bulletItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 8,
  },
  bulletDot: {
    color: '#f59e0b',
    fontSize: 14,
    fontWeight: '800',
  },
  bulletText: {
    flex: 1,
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 18,
  },
  bulletBold: {
    color: '#e2e8f0',
    fontWeight: '700',
  },
  bulletHighlight: {
    color: '#f59e0b',
    fontWeight: '700',
  },
});
