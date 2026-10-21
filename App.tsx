import React, { useEffect, useRef, useState } from 'react';
import { AppState, PermissionsAndroid, Platform, Pressable, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useFonts } from 'expo-font';
import { BarlowCondensed_600SemiBold, BarlowCondensed_700Bold } from '@expo-google-fonts/barlow-condensed';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CourtsScreen } from './src/screens/CourtsScreen';
import { BookingsScreen } from './src/screens/BookingsScreen';
import { SniperScreen } from './src/screens/SniperScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { UmpointSheet } from './src/components/UmpointSheet';
import { ToastProvider } from './src/components/Pieces';
import { Sniper } from './modules/umpoint-sniper';
import { onSignInRequest, refreshSession, requestSignIn } from './src/services/session';
import { Txt } from './src/ui';
import { useColors } from './src/theme';
import { WeekType } from './src/types';

type Tab = 'courts' | 'sniper' | 'bookings' | 'settings';

const TABS: { tab: Tab; label: string; icon: keyof typeof Ionicons.glyphMap; active: keyof typeof Ionicons.glyphMap }[] = [
  { tab: 'courts', label: 'Courts', icon: 'grid-outline', active: 'grid' },
  { tab: 'sniper', label: 'Sniper', icon: 'locate-outline', active: 'locate' },
  { tab: 'bookings', label: 'Bookings', icon: 'bookmark-outline', active: 'bookmark' },
  { tab: 'settings', label: 'Settings', icon: 'settings-outline', active: 'settings' },
];

export default function App() {
  const [fontsLoaded] = useFonts({ BarlowCondensed_600SemiBold, BarlowCondensed_700Bold });
  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <ToastProvider>{fontsLoaded ? <Shell /> : null}</ToastProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function Shell() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('courts');
  const [courtsWeek, setCourtsWeek] = useState<WeekType>('this');
  const [signIn, setSignIn] = useState<{ reason?: string } | null>(null);
  const signInOpen = useRef(false);

  useEffect(() => {
    signInOpen.current = signIn !== null;
  }, [signIn]);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(c.bg);
  }, [c.bg]);

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

  return (
    <View style={[styles.flex, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      <StatusBar style="auto" />
      <View style={styles.flex}>
        {tab === 'courts' && (
          <CourtsScreen
            week={courtsWeek}
            onWeekChange={setCourtsWeek}
            onOpenSettings={() => setTab('settings')}
            onOpenSniper={() => setTab('sniper')}
          />
        )}
        {tab === 'sniper' && (
          <SniperScreen
            onPickSlot={() => {
              setCourtsWeek('next');
              setTab('courts');
            }}
            onOpenSettings={() => setTab('settings')}
          />
        )}
        {tab === 'bookings' && <BookingsScreen onOpenSettings={() => setTab('settings')} />}
        {tab === 'settings' && <SettingsScreen />}
      </View>

      {/* Tabs are peers: switching is instant, no slide. */}
      <View
        style={[
          styles.tabBar,
          { backgroundColor: c.surface, borderTopColor: c.hairline, paddingBottom: Math.max(insets.bottom, 8) },
        ]}
        accessibilityRole="tablist"
      >
        {TABS.map((t) => {
          const active = t.tab === tab;
          const color = active ? (t.tab === 'sniper' ? c.smash : c.mat) : c.ink3;
          return (
            <Pressable
              key={t.tab}
              style={styles.tabItem}
              onPress={() => setTab(t.tab)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={t.label}
            >
              <Ionicons name={active ? t.active : t.icon} size={23} color={color} />
              <Txt variant="caption" color={color} style={styles.tabLabel}>
                {t.label}
              </Txt>
            </Pressable>
          );
        })}
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
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 6,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: 4,
  },
  tabLabel: {
    textTransform: 'none',
    letterSpacing: 0.1,
    fontWeight: '600',
  },
});
