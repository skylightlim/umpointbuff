import React, { useEffect, useRef, useState } from 'react';
import { AppState, PermissionsAndroid, Platform, Pressable, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import * as Haptics from 'expo-haptics';
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
import { shape, useColors } from './src/theme';
import { WeekType } from './src/types';

type Tab = 'courts' | 'sniper' | 'bookings' | 'settings';

const TABS: { tab: Tab; label: string; icon: keyof typeof Ionicons.glyphMap; active: keyof typeof Ionicons.glyphMap }[] = [
  { tab: 'courts', label: 'Courts', icon: 'grid-outline', active: 'grid' },
  { tab: 'sniper', label: 'Sniper', icon: 'locate-outline', active: 'locate' },
  { tab: 'bookings', label: 'Bookings', icon: 'calendar-outline', active: 'calendar' },
  { tab: 'settings', label: 'Settings', icon: 'settings-outline', active: 'settings' },
];

export default function App() {
  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <ToastProvider>
          <Shell />
        </ToastProvider>
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
    SystemUI.setBackgroundColorAsync(c.surface);
  }, [c.surface]);

  useEffect(() => {
    if (Platform.OS === 'android' && Number(Platform.Version) >= 33) {
      PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    }
    refreshSession();
    const offRequest = onSignInRequest((reason) => setSignIn({ reason }));
    const appState = AppState.addEventListener('change', (s) => {
      if (s === 'active') refreshSession();
    });

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

  const handleTabPress = (nextTab: Tab) => {
    if (nextTab !== tab) {
      Haptics.selectionAsync();
      setTab(nextTab);
    }
  };

  return (
    <View style={[styles.flex, { backgroundColor: c.surface, paddingTop: insets.top }]}>
      <StatusBar style="auto" />
      <View style={styles.flex}>
        {tab === 'courts' && (
          <CourtsScreen
            week={courtsWeek}
            onWeekChange={setCourtsWeek}
            onOpenSettings={() => setTab('settings')}
            onOpenSniper={() => setTab('sniper')}
            onArmed={() => setTab('sniper')}
          />
        )}
        {tab === 'sniper' && (
          <SniperScreen
            onPickSlot={() => {
              setCourtsWeek('next');
              setTab('courts');
            }}
            onOpenSettings={() => setTab('settings')}
            onOpenDashboard={() => setTab('bookings')}
          />
        )}
        {tab === 'bookings' && <BookingsScreen onOpenSettings={() => setTab('settings')} />}
        {tab === 'settings' && <SettingsScreen />}
      </View>

      {/* Material Design 3 Navigation Bar (80dp height + pill indicator + labelMedium) */}
      <View
        style={[
          styles.navigationBar,
          {
            backgroundColor: c.surfaceContainer,
            paddingBottom: Math.max(insets.bottom, 12),
          },
        ]}
        accessibilityRole="tablist"
      >
        {TABS.map((t) => {
          const active = t.tab === tab;
          const indicatorBg = active
            ? t.tab === 'sniper'
              ? c.tertiaryContainer
              : c.secondaryContainer
            : 'transparent';
          const iconColor = active
            ? t.tab === 'sniper'
              ? c.onTertiaryContainer
              : c.onSecondaryContainer
            : c.onSurfaceVariant;
          const labelColor = active ? c.onSurface : c.onSurfaceVariant;

          return (
            <Pressable
              key={t.tab}
              style={styles.navItem}
              onPress={() => handleTabPress(t.tab)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={t.label}
            >
              <View style={[styles.activeIndicator, { backgroundColor: indicatorBg }]}>
                <Ionicons name={active ? t.active : t.icon} size={22} color={iconColor} />
              </View>
              <Txt
                variant="labelMedium"
                color={labelColor}
                style={[styles.navLabel, active && styles.activeNavLabel]}
              >
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
  navigationBar: {
    flexDirection: 'row',
    height: 80,
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 8,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    gap: 4,
  },
  activeIndicator: {
    width: 64,
    height: 32,
    borderRadius: shape.large,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navLabel: {
    textAlign: 'center',
  },
  activeNavLabel: {
    fontWeight: '700',
  },
});
