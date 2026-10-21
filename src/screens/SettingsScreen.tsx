import React, { useEffect, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { Sniper } from '../../modules/umpoint-sniper';
import { BookingPrefs, DEFAULT_PREFS, loadPrefs, savePrefs } from '../services/cache';
import { requestSignIn, signOut, useSession } from '../services/session';
import { Card, Hairline, Press, SectionTitle, Txt } from '../ui';
import { ScreenHeader } from '../components/Pieces';
import { radius, space, useColors } from '../theme';

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
      'This also forgets your Google sign-in in the app, so armed snipes can’t renew your session until you sign in again.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign out', style: 'destructive', onPress: () => signOut() },
      ],
    );

  const statusText =
    session === 'signed_in' ? 'Signed in' : session === 'signed_out' ? 'Not signed in' : session === 'offline' ? 'Can’t reach UMPoint' : 'Checking…';

  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <ScreenHeader title="Settings" />

      <View style={styles.section}>
        <SectionTitle>UMPoint account</SectionTitle>
        <Card style={styles.list}>
          <View style={styles.row}>
            <View style={[styles.dot, { backgroundColor: signedIn ? c.mat : c.cork }]} />
            <Txt variant="headline" style={styles.flex}>
              {statusText}
            </Txt>
            {signedIn ? (
              <Press onPress={handleSignOut}>
                <Txt variant="callout" color={c.smash} style={{ fontWeight: '600' }}>
                  Sign out
                </Txt>
              </Press>
            ) : (
              <Press onPress={() => requestSignIn()}>
                <Txt variant="callout" color={c.mat} style={{ fontWeight: '700' }}>
                  Sign in
                </Txt>
              </Press>
            )}
          </View>
        </Card>
        <Txt variant="footnote" color={c.ink3} style={styles.footnote}>
          UMPoint ends a session after 10–20 idle minutes. The app signs you back in on its own; you only sign in
          again when Google asks.
        </Txt>
      </View>

      <View style={styles.section}>
        <SectionTitle>Every booking uses</SectionTitle>
        <Card style={styles.list}>
          <View style={styles.row}>
            <Txt variant="body" color={c.ink2} style={styles.label}>
              Event
            </Txt>
            <TextInput
              value={prefs.event}
              onChangeText={(event) => update({ ...prefs, event })}
              onEndEditing={() => !prefs.event.trim() && update({ ...prefs, event: DEFAULT_PREFS.event })}
              style={[styles.input, { color: c.ink }]}
              placeholder={DEFAULT_PREFS.event}
              placeholderTextColor={c.ink3}
              returnKeyType="done"
              accessibilityLabel="Event name"
            />
          </View>
          <Hairline inset={space.l} />
          <View style={styles.row}>
            <Txt variant="body" color={c.ink2} style={styles.label}>
              Players
            </Txt>
            <View style={styles.flex} />
            <View style={[styles.stepper, { backgroundColor: c.fill }]}>
              <Press
                onPress={() => update({ ...prefs, pax: Math.max(1, prefs.pax - 1) })}
                disabled={prefs.pax <= 1}
                haptic="selection"
                style={styles.stepButton}
                accessibilityLabel="Fewer players"
              >
                <Ionicons name="remove" size={18} color={prefs.pax <= 1 ? c.ink3 : c.ink} />
              </Press>
              <Txt variant="time" style={styles.stepValue}>
                {prefs.pax}
              </Txt>
              <Press
                onPress={() => update({ ...prefs, pax: Math.min(12, prefs.pax + 1) })}
                haptic="selection"
                style={styles.stepButton}
                accessibilityLabel="More players"
              >
                <Ionicons name="add" size={18} color={c.ink} />
              </Press>
            </View>
          </View>
        </Card>
        <Txt variant="footnote" color={c.ink3} style={styles.footnote}>
          UMPoint asks for an event name and a head count with every booking.
        </Txt>
      </View>

      <View style={styles.section}>
        <SectionTitle>Help</SectionTitle>
        <Card style={styles.list}>
          <Press onPress={() => setLog(Sniper.readLog() || 'Nothing logged yet.')} style={styles.row}>
            <Ionicons name="document-text-outline" size={20} color={c.ink2} />
            <Txt variant="headline" style={styles.flex}>
              Sniper log
            </Txt>
            <Ionicons name="chevron-forward" size={16} color={c.ink3} />
          </Press>
        </Card>
        <Txt variant="footnote" color={c.ink3} style={styles.footnote}>
          Every step the sniper took, for when a snipe didn’t go as expected. Version {Constants.expoConfig?.version ?? '?'}.
        </Txt>
      </View>

      <Modal visible={log !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setLog(null)}>
        <View style={[styles.flex, { backgroundColor: c.bg, paddingTop: insets.top }]}>
          <View style={[styles.logTop, { borderBottomColor: c.hairline }]}>
            <Txt variant="title">Sniper log</Txt>
            <Press onPress={() => setLog(null)} accessibilityLabel="Close">
              <Ionicons name="close" size={24} color={c.ink} />
            </Press>
          </View>
          <ScrollView contentContainerStyle={{ padding: space.l, paddingBottom: insets.bottom + space.l }}>
            <Txt variant="footnote" color={c.ink2} style={styles.logText} selectable>
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
    paddingBottom: space.xxl,
  },
  section: {
    paddingHorizontal: space.l,
    marginTop: space.l,
  },
  list: {
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    paddingHorizontal: space.l,
    minHeight: 52,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  label: {
    width: 72,
  },
  input: {
    flex: 1,
    fontSize: 15,
    paddingVertical: space.m,
    textAlign: 'right',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.s,
  },
  stepButton: {
    width: 40,
    height: 34,
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
    padding: space.l,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  logText: {
    fontFamily: 'monospace',
    fontSize: 11,
    lineHeight: 16,
  },
});
