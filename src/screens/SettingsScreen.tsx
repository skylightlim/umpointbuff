import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Modal, SafeAreaView } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { Sniper } from '../../modules/umpoint-sniper';
import { requestSignIn, signOut, useSession } from '../services/session';
import { dayLabel, mytDate, nextRolloverMs } from '../services/umpointClient';

const Bullet: React.FC<{ bold: string; children: React.ReactNode }> = ({ bold, children }) => (
  <View style={styles.bulletItem}>
    <Text style={styles.bulletDot}>•</Text>
    <Text style={styles.bulletText}>
      <Text style={styles.bulletBold}>{bold}</Text> {children}
    </Text>
  </View>
);

export const SettingsScreen: React.FC = () => {
  const session = useSession();
  const [log, setLog] = useState<string | null>(null);
  const signedIn = session === 'signed_in';

  const handleSignOut = () =>
    Alert.alert(
      'Sign out?',
      'This also forgets your Google sign-in inside the app, so armed snipes can’t renew your session until you sign in again.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign out', style: 'destructive', onPress: () => signOut() },
      ],
    );

  const statusText =
    session === 'signed_in'
      ? 'Signed in'
      : session === 'signed_out'
        ? 'Not signed in'
        : session === 'offline'
          ? 'Can’t reach UMPoint'
          : 'Checking…';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings & Account</Text>
        <Text style={styles.subtitle}>Your UMPoint sign-in and how the app works</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="key-outline" size={20} color="#38bdf8" />
          <Text style={styles.cardTitle}>UMPoint account</Text>
        </View>
        <View style={styles.sessionStatusBox}>
          <View style={[styles.statusDot, signedIn ? styles.dotGreen : styles.dotRed]} />
          <Text style={styles.sessionStatusText}>{statusText}</Text>
        </View>
        <Text style={styles.noteText}>
          UMPoint ends a session after about 15 idle minutes. The app signs you back in by itself; you only sign in
          again if Google asks.
        </Text>
        <View style={styles.btnRow}>
          {!signedIn && (
            <TouchableOpacity style={styles.loginModalBtn} onPress={() => requestSignIn()}>
              <Ionicons name="log-in-outline" size={18} color="#ffffff" style={{ marginRight: 6 }} />
              <Text style={styles.loginModalBtnText}>Sign in with SiswaMail</Text>
            </TouchableOpacity>
          )}
          {signedIn && (
            <TouchableOpacity style={[styles.loginModalBtn, styles.signOutBtn]} onPress={handleSignOut}>
              <Ionicons name="log-out-outline" size={18} color="#ef4444" style={{ marginRight: 6 }} />
              <Text style={[styles.loginModalBtnText, { color: '#ef4444' }]}>Sign out</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="information-circle-outline" size={20} color="#f59e0b" />
          <Text style={styles.cardTitle}>How UMPoint books courts</Text>
        </View>
        <Bullet bold="Courts:">Gelanggang Badminton 1–4 J2, Second College, 09:00–19:00, Monday to Friday.</Bullet>
        <Bullet bold="Opening:">
          Next week opens at Monday 00:00:00 MYT — next on {dayLabel(mytDate(nextRolloverMs()))}.
        </Bullet>
        <Bullet bold="Cancelling:">done on UMPoint’s own page (Bookings tab), so it works exactly as the site does.</Bullet>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <MaterialCommunityIcons name="file-document-outline" size={20} color="#94a3b8" />
          <Text style={styles.cardTitle}>Sniper log</Text>
        </View>
        <Text style={styles.noteText}>What the sniper did, step by step. Useful if a snipe didn’t go as expected.</Text>
        <TouchableOpacity style={styles.logBtn} onPress={() => setLog(Sniper.readLog() || 'Nothing logged yet.')}>
          <Text style={styles.logBtnText}>Show log</Text>
        </TouchableOpacity>
        <Text style={styles.versionText}>Version {Constants.expoConfig?.version ?? '?'}</Text>
      </View>

      <Modal visible={log !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setLog(null)}>
        <SafeAreaView style={styles.container}>
          <View style={styles.logTop}>
            <Text style={styles.cardTitle}>Sniper log</Text>
            <TouchableOpacity onPress={() => setLog(null)} accessibilityLabel="Close">
              <Ionicons name="close" size={24} color="#f8fafc" />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            <Text style={styles.logText} selectable>
              {log}
            </Text>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  noteText: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 12,
  },
  signOutBtn: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  logBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#1e293b',
  },
  logBtnText: {
    color: '#e2e8f0',
    fontWeight: '700',
  },
  versionText: {
    color: '#475569',
    fontSize: 11,
    marginTop: 14,
  },
  logTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  logText: {
    color: '#cbd5e1',
    fontSize: 11,
    fontFamily: 'monospace',
    lineHeight: 16,
  },
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
});
