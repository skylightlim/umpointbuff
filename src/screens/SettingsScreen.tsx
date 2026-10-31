import React, { useEffect, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { Sniper } from '../../modules/umpoint-sniper';
import { BookingPrefs, DEFAULT_PREFS, loadPrefs, savePrefs } from '../services/cache';
import { requestSignIn, signOut, useSession } from '../services/session';
import { Button, Card, Hairline, IconButton, Press, SectionTitle, Txt } from '../ui';
import { ScreenHeader, TAB_CLEARANCE } from '../components/Pieces';
import { elevation, shape, space, useColors } from '../theme';

export const SettingsScreen: React.FC = () => {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const session = useSession();
  const [prefs, setPrefs] = useState<BookingPrefs>(DEFAULT_PREFS);
  const [log, setLog] = useState<string | null>(null);
  const signedIn = session === 'signed_in';

  useEffect(() => {
    loadPrefs().then(setPrefs);
  }, []);

  const update = (next: BookingPrefs) => {
    setPrefs(next);
    savePrefs(next);
  };

  const handleSignOut = () =>
    Alert.alert(
      'Sign out?',
      'This forgets your Google sign-in session in the app. Armed snipes will not be able to renew credentials at midnight until you sign in again.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign out', style: 'destructive', onPress: () => signOut() },
      ],
    );

  const statusText =
    session === 'signed_in' ? 'Signed in' : session === 'signed_out' ? 'Not signed in' : session === 'offline' ? 'Can’t reach UMPoint' : 'Checking…';

  return (
    <ScrollView style={{ backgroundColor: c.surface }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <ScreenHeader title="Settings" />

      {/* Account Section */}
      <View style={styles.section}>
        <SectionTitle>UMPoint account</SectionTitle>
        <Card
          style={[
            styles.list,
            {
              backgroundColor: c.surfaceContainerLow,
              borderColor: c.outlineVariant,
              borderWidth: 1,
              elevation: elevation.level1,
            },
          ]}
        >
          <View style={styles.row}>
            <View style={[styles.dot, { backgroundColor: signedIn ? c.secondary : c.tertiary }]} />
            <Txt variant="titleMedium" color={c.onSurface} style={styles.flex}>
              {statusText}
            </Txt>
            {signedIn ? (
              <Button label="Sign out" tone="danger" size="m" onPress={handleSignOut} />
            ) : (
              <Button label="Sign in" tone="filled" size="m" onPress={() => requestSignIn()} />
            )}
          </View>
        </Card>
        <Txt variant="bodySmall" color={c.onSurfaceVariant} style={styles.footnote}>
          UMPoint sessions expire after 10–20 idle minutes. The app automatically refreshes credentials using Google OAuth.
        </Txt>
      </View>

      {/* Booking Defaults Section */}
      <View style={styles.section}>
        <SectionTitle>Booking defaults</SectionTitle>
        <Card
          style={[
            styles.list,
            {
              backgroundColor: c.surfaceContainerLow,
              borderColor: c.outlineVariant,
              borderWidth: 1,
              elevation: elevation.level1,
            },
          ]}
        >
          <View style={styles.row}>
            <Txt variant="bodyMedium" color={c.onSurfaceVariant} style={styles.label}>
              Event
            </Txt>
            <TextInput
              value={prefs.event}
              onChangeText={(event) => update({ ...prefs, event })}
              onEndEditing={() => !prefs.event.trim() && update({ ...prefs, event: DEFAULT_PREFS.event })}
              style={[styles.input, { color: c.onSurface }]}
              placeholder={DEFAULT_PREFS.event}
              placeholderTextColor={c.outline}
              returnKeyType="done"
              accessibilityLabel="Default event name"
            />
          </View>

          <Hairline inset={space.l} />

          <View style={styles.row}>
            <Txt variant="bodyMedium" color={c.onSurfaceVariant} style={styles.label}>
              Players
            </Txt>
            <View style={styles.flex} />
            <View style={[styles.stepper, { backgroundColor: c.surfaceContainerHighest }]}>
              <Press
                onPress={() => update({ ...prefs, pax: Math.max(1, prefs.pax - 1) })}
                disabled={prefs.pax <= 1}
                haptic="selection"
                style={styles.stepButton}
                accessibilityLabel="Fewer players"
              >
                <Ionicons name="remove" size={18} color={prefs.pax <= 1 ? c.outline : c.onSurface} />
              </Press>
              <Txt variant="titleMedium" color={c.onSurface} style={styles.stepValue}>
                {prefs.pax}
              </Txt>
              <Press
                onPress={() => update({ ...prefs, pax: Math.min(12, prefs.pax + 1) })}
                haptic="selection"
                style={styles.stepButton}
                accessibilityLabel="More players"
              >
                <Ionicons name="add" size={18} color={c.onSurface} />
              </Press>
            </View>
          </View>
        </Card>
        <Txt variant="bodySmall" color={c.onSurfaceVariant} style={styles.footnote}>
          Applied automatically to every manual booking and sniper attempt.
        </Txt>
      </View>

      {/* Diagnostics / Help Section */}
      <View style={styles.section}>
        <SectionTitle>Diagnostics</SectionTitle>
        <Card
          style={[
            styles.list,
            {
              backgroundColor: c.surfaceContainerLow,
              borderColor: c.outlineVariant,
              borderWidth: 1,
              elevation: elevation.level1,
            },
          ]}
        >
          <Press onPress={() => setLog(Sniper.readLog() || 'Nothing logged yet.')} style={styles.row}>
            <Ionicons name="document-text-outline" size={22} color={c.primary} />
            <Txt variant="bodyLarge" color={c.onSurface} style={styles.flex}>
              Sniper execution log
            </Txt>
            <Ionicons name="chevron-forward" size={18} color={c.outline} />
          </Press>
        </Card>
        <Txt variant="bodySmall" color={c.onSurfaceVariant} style={styles.footnote}>
          Step-by-step logs for verification. App version {Constants.expoConfig?.version ?? '1.0.0'}.
        </Txt>
      </View>

      {/* Modal for Logs */}
      <Modal visible={log !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setLog(null)}>
        <View style={[styles.flex, { backgroundColor: c.surface, paddingTop: insets.top }]}>
          <View style={[styles.logTop, { borderBottomColor: c.outlineVariant, borderBottomWidth: StyleSheet.hairlineWidth }]}>
            <Txt variant="titleLarge" color={c.onSurface}>Sniper Log</Txt>
            <IconButton icon="close" label="Close" onPress={() => setLog(null)} size={40} />
          </View>
          <ScrollView contentContainerStyle={{ padding: space.l, paddingBottom: insets.bottom + space.l }}>
            <Txt variant="bodySmall" color={c.onSurfaceVariant} style={styles.logText} selectable>
              {log}
            </Txt>
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    paddingBottom: TAB_CLEARANCE + space.xxl,
  },
  section: {
    paddingHorizontal: space.l,
    marginTop: space.l,
  },
  list: {
    paddingVertical: 0,
    paddingHorizontal: 0,
    borderRadius: shape.large,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    paddingHorizontal: space.l,
    minHeight: 56,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  label: {
    width: 72,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: space.m,
    textAlign: 'right',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: shape.small,
  },
  stepButton: {
    width: 40,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepValue: {
    minWidth: 28,
    textAlign: 'center',
  },
  footnote: {
    paddingHorizontal: space.xs,
    marginTop: space.s,
  },
  logTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.l,
    height: 64,
  },
  logText: {
    fontFamily: 'monospace',
    lineHeight: 18,
  },
});
