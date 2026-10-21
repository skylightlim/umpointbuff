import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, WebViewNavigation } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { Sniper } from '../../modules/umpoint-sniper';
import { markSignedIn } from '../services/session';
import { BASE_URL } from '../services/umpointClient';
import { Press, Txt } from '../ui';
import { radius, space, useColors } from '../theme';

interface Props {
  visible: boolean;
  /** signin: UMPoint's login page; dashboard: UMPoint's own bookings page (to cancel there). */
  mode: 'signin' | 'dashboard';
  /** Shown above the page, e.g. why the sniper needs a sign-in. */
  reason?: string;
  onClose: () => void;
}

/**
 * UMPoint in a WebView. Its cookies are the app's session: fetch and the Kotlin sniper read the
 * same store. The user agent drops the WebView marker, since Google refuses sign-in in WebViews.
 */
export const UmpointSheet: React.FC<Props> = ({ visible, mode, reason, onClose }) => {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [blocked, setBlocked] = useState(false);
  const userAgent = useMemo(() => Sniper.userAgent(), []);

  const onNav = (nav: WebViewNavigation) => {
    const url = nav.url;
    if (url.includes('disallowed_useragent')) setBlocked(true);
    const inApp = url.startsWith(BASE_URL) && !url.includes('/login') && !url.includes('/google/');
    if (!inApp || nav.loading) return;
    markSignedIn();
    if (mode === 'signin') onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: c.bg, paddingTop: insets.top }]}>
        <View style={[styles.topBar, { borderBottomColor: c.hairline }]}>
          <Press onPress={onClose} style={styles.closeBtn} accessibilityLabel="Close">
            <Ionicons name="close" size={24} color={c.ink} />
          </Press>
          <Txt variant="headline">{mode === 'signin' ? 'Sign in to UMPoint' : 'My UMPoint bookings'}</Txt>
          <View style={styles.closeBtn} />
        </View>

        {reason ? (
          <View style={[styles.reason, { backgroundColor: c.smashSoft }]}>
            <Ionicons name="alarm-outline" size={18} color={c.smash} />
            <Txt variant="footnote" style={styles.flex}>
              {reason}
            </Txt>
          </View>
        ) : null}
        <Txt variant="footnote" color={c.ink2} style={styles.hint}>
          {mode === 'signin'
            ? 'Tap “UM Staff and Student” and sign in with your SiswaMail.'
            : 'This is UMPoint itself. Cancel here and the app shows the change.'}
        </Txt>
        {blocked ? (
          <Txt variant="footnote" color={c.smash} style={styles.hint}>
            Google refused to sign in inside the app. Tell the developer — this needs a fix.
          </Txt>
        ) : null}

        <View style={[styles.webWrap, { paddingBottom: insets.bottom }]}>
          {visible ? (
            <WebView
              source={{ uri: mode === 'signin' ? `${BASE_URL}/login/` : `${BASE_URL}/modules/dashboard/` }}
              userAgent={userAgent}
              onNavigationStateChange={onNav}
              onLoadEnd={() => setLoading(false)}
              javaScriptEnabled
              domStorageEnabled
              thirdPartyCookiesEnabled
              sharedCookiesEnabled
              setSupportMultipleWindows={false}
            />
          ) : null}
          {loading ? (
            <View style={[styles.loading, { backgroundColor: c.bg }]}>
              <ActivityIndicator size="large" color={c.mat} />
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.s,
    paddingVertical: space.s,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reason: {
    flexDirection: 'row',
    gap: space.s,
    alignItems: 'center',
    margin: space.m,
    marginBottom: 0,
    padding: space.m,
    borderRadius: radius.m,
  },
  hint: {
    paddingHorizontal: space.l,
    paddingVertical: space.s,
  },
  webWrap: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  loading: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
