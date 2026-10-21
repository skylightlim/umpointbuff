import React, { useEffect, useRef, useState } from 'react';
import {
  AppState,
  PermissionsAndroid,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  StatusBar as RNStatusBar,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { CourtsScreen } from './src/screens/CourtsScreen';
import { BookingsScreen } from './src/screens/BookingsScreen';
import { SniperScreen } from './src/screens/SniperScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { UmpointSheet } from './src/components/UmpointSheet';
import { Sniper } from './modules/umpoint-sniper';
import { onSignInRequest, refreshSession, requestSignIn, useSession } from './src/services/session';

type Tab = 'courts' | 'sniper' | 'bookings' | 'settings';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('courts');
  const [signIn, setSignIn] = useState<{ reason?: string } | null>(null);
  const signInOpen = useRef(false);
  const session = useSession();

  useEffect(() => {
    signInOpen.current = signIn !== null;
  }, [signIn]);

  useEffect(() => {
    if (Platform.OS === 'android' && Number(Platform.Version) >= 33) {
      PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    }
    refreshSession();
    const offRequest = onSignInRequest((reason) => setSignIn({ reason }));
    const appState = AppState.addEventListener('change', (s) => {
      if (s === 'active') refreshSession();
    });
    // When the sniper rings for a sign-in, opening the app goes straight to the sign-in sheet.
    const poll = setInterval(() => {
      if (AppState.currentState === 'active' && !signInOpen.current && Sniper.status().needsSignIn) {
        requestSignIn('The sniper fires at 00:00 and your UMPoint session has expired. Sign in now.');
      }
    }, 2000);
    return () => {
      offRequest();
      appState.remove();
      clearInterval(poll);
    };
  }, []);

  const pill =
    session === 'signed_in'
      ? { text: 'SIGNED IN', color: '#10b981' }
      : session === 'signed_out'
        ? { text: 'SIGN IN', color: '#f59e0b' }
        : session === 'offline'
          ? { text: 'OFFLINE', color: '#94a3b8' }
          : { text: 'CHECKING', color: '#94a3b8' };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />

      {/* Main App Top Header */}
      <View style={styles.appHeader}>
        <View style={styles.brandRow}>
          <View style={styles.brandLogoBox}>
            <MaterialCommunityIcons name="badminton" size={20} color="#10b981" />
          </View>
          <View>
            <Text style={styles.brandTitle}>UMPoint Badminton</Text>
            <Text style={styles.brandSubtitle}>Pusat Sukan • Second College</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.serverStatusPill, { borderColor: pill.color, backgroundColor: pill.color + '1f' }]}
          onPress={() => (session === 'signed_in' ? setActiveTab('settings') : requestSignIn())}
          accessibilityLabel={`UMPoint session: ${pill.text.toLowerCase()}`}
        >
          <View style={[styles.greenDot, { backgroundColor: pill.color }]} />
          <Text style={[styles.serverStatusText, { color: pill.color }]}>{pill.text}</Text>
        </TouchableOpacity>
      </View>

      {/* Screen Body */}
      <View style={styles.screenContainer}>
        {activeTab === 'courts' && (
          <CourtsScreen
            onNavigateToSniper={() => setActiveTab('sniper')}
            onNavigateToBookings={() => setActiveTab('bookings')}
          />
        )}
        {activeTab === 'sniper' && (
          <SniperScreen onNavigateToCourts={() => setActiveTab('courts')} />
        )}
        {activeTab === 'bookings' && <BookingsScreen />}
        {activeTab === 'settings' && <SettingsScreen />}
      </View>

      {/* Bottom Navigation Bar */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={[styles.navItem, activeTab === 'courts' && styles.navItemActive]}
          onPress={() => setActiveTab('courts')}
        >
          <MaterialCommunityIcons
            name={activeTab === 'courts' ? 'calendar-month' : 'calendar-month-outline'}
            size={24}
            color={activeTab === 'courts' ? '#10b981' : '#64748b'}
          />
          <Text style={[styles.navText, activeTab === 'courts' && styles.navTextActive]}>
            Courts
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navItem, activeTab === 'sniper' && styles.navItemActive]}
          onPress={() => setActiveTab('sniper')}
        >
          <MaterialCommunityIcons
            name={activeTab === 'sniper' ? 'target' : 'target'}
            size={24}
            color={activeTab === 'sniper' ? '#ef4444' : '#64748b'}
          />
          <Text style={[styles.navText, activeTab === 'sniper' && styles.navTextSniperActive]}>
            Sniper
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navItem, activeTab === 'bookings' && styles.navItemActive]}
          onPress={() => setActiveTab('bookings')}
        >
          <Ionicons
            name={activeTab === 'bookings' ? 'bookmark' : 'bookmark-outline'}
            size={22}
            color={activeTab === 'bookings' ? '#38bdf8' : '#64748b'}
          />
          <Text style={[styles.navText, activeTab === 'bookings' && styles.navTextBookingsActive]}>
            Bookings
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navItem, activeTab === 'settings' && styles.navItemActive]}
          onPress={() => setActiveTab('settings')}
        >
          <Ionicons
            name={activeTab === 'settings' ? 'settings' : 'settings-outline'}
            size={22}
            color={activeTab === 'settings' ? '#f8fafc' : '#64748b'}
          />
          <Text style={[styles.navText, activeTab === 'settings' && styles.navTextSettingsActive]}>
            Settings
          </Text>
        </TouchableOpacity>
      </View>

      <UmpointSheet
        visible={signIn !== null}
        mode="signin"
        reason={signIn?.reason}
        onClose={() => {
          setSignIn(null);
          refreshSession();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#090d16',
    paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight || 24 : 0,
  },
  appHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#131b2e',
    backgroundColor: '#090d16',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandLogoBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#064e3b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '800',
  },
  brandSubtitle: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '500',
  },
  serverStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  greenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  serverStatusText: {
    color: '#10b981',
    fontSize: 10,
    fontWeight: '800',
  },
  screenContainer: {
    flex: 1,
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#0c1220',
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    paddingVertical: 8,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  navItemActive: {},
  navText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 4,
  },
  navTextActive: {
    color: '#10b981',
    fontWeight: '700',
  },
  navTextSniperActive: {
    color: '#ef4444',
    fontWeight: '700',
  },
  navTextBookingsActive: {
    color: '#38bdf8',
    fontWeight: '700',
  },
  navTextSettingsActive: {
    color: '#f8fafc',
    fontWeight: '700',
  },
});
