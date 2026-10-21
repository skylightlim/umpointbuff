import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { getAppMode, getServerUrl, getStatus, setAppMode, setServerUrl } from '../services/api';
import { clearSession, getSessionCookies } from '../services/session';
import { SystemStatus } from '../types';
import { LoginModal } from '../components/LoginModal';

export const SettingsScreen: React.FC = () => {
  const [appMode, setAppModeState] = useState<'standalone' | 'server'>('standalone');
  const [urlInput, setUrlInput] = useState<string>('');
  const [testing, setTesting] = useState<boolean>(false);
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [cookies, setCookies] = useState<string>('');
  const [loginModalVisible, setLoginModalVisible] = useState<boolean>(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const mode = await getAppMode();
    const url = await getServerUrl();
    const currentCookies = await getSessionCookies();

    setAppModeState(mode);
    setUrlInput(url);
    setCookies(currentCookies);

    try {
      const s = await getStatus();
      setStatus(s);
    } catch {
      setStatus(null);
    }
  };

  const handleToggleMode = async (mode: 'standalone' | 'server') => {
    await setAppMode(mode);
    setAppModeState(mode);
    try {
      const s = await getStatus();
      setStatus(s);
    } catch {
      setStatus(null);
    }
  };

  const handleSaveUrl = async () => {
    if (!urlInput.trim()) {
      Alert.alert('Invalid URL', 'Please enter a valid backend server URL.');
      return;
    }
    await setServerUrl(urlInput.trim());
    Alert.alert('Saved', 'Server URL updated.');
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

      {/* Mode Selector Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <MaterialCommunityIcons name="cellphone-wireless" size={20} color="#10b981" />
          <Text style={styles.cardTitle}>App Operation Mode</Text>
        </View>

        <View style={styles.modeToggleRow}>
          <TouchableOpacity
            style={[styles.modeBtn, appMode === 'standalone' && styles.modeBtnActive]}
            onPress={() => handleToggleMode('standalone')}
          >
            <Ionicons
              name="phone-portrait-outline"
              size={18}
              color={appMode === 'standalone' ? '#ffffff' : '#94a3b8'}
            />
            <Text style={[styles.modeBtnText, appMode === 'standalone' && styles.modeBtnTextActive]}>
              100% On Phone (Direct)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modeBtn, appMode === 'server' && styles.modeBtnActive]}
            onPress={() => handleToggleMode('server')}
          >
            <Ionicons
              name="server-outline"
              size={18}
              color={appMode === 'server' ? '#ffffff' : '#94a3b8'}
            />
            <Text style={[styles.modeBtnText, appMode === 'server' && styles.modeBtnTextActive]}>
              External Server
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.modeDescription}>
          {appMode === 'standalone'
            ? '✅ Standalone Mode: Your phone talks directly to UMPoint. No PC or external backend server needed!'
            : '🌐 Server Mode: Connects to a remote Python bot for overnight background sniping while phone is asleep.'}
        </Text>
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

      {/* External Server Configuration (Only visible in server mode) */}
      {appMode === 'server' && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="cloud-outline" size={20} color="#a855f7" />
            <Text style={styles.cardTitle}>Backend Server Configuration</Text>
          </View>

          <Text style={styles.inputLabel}>Server URL</Text>
          <TextInput
            style={styles.textInput}
            value={urlInput}
            onChangeText={setUrlInput}
            placeholder="http://10.221.34.186:8000"
            placeholderTextColor="#64748b"
            autoCapitalize="none"
          />

          <TouchableOpacity style={styles.saveUrlBtn} onPress={handleSaveUrl}>
            <Text style={styles.saveUrlBtnText}>Save Server URL</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Live System Diagnostics */}
      {status && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons name="cloud-sync-outline" size={20} color="#38bdf8" />
            <Text style={styles.cardTitle}>System Synchronization</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Mode:</Text>
            <Text style={styles.infoValueBold}>{status.status}</Text>
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
  modeToggleRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: '#0f172a',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 6,
  },
  modeBtnActive: {
    backgroundColor: '#065f46',
    borderColor: '#10b981',
  },
  modeBtnText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
  },
  modeBtnTextActive: {
    color: '#ffffff',
  },
  modeDescription: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 12,
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
  inputLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    color: '#f8fafc',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
  },
  saveUrlBtn: {
    backgroundColor: '#1e293b',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  saveUrlBtnText: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '700',
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
  infoValueBold: {
    color: '#10b981',
    fontSize: 14,
    fontWeight: '800',
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
