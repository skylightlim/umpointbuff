import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, WebViewNavigation } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { Sniper } from '../../modules/umpoint-sniper';
import { markSignedIn } from '../services/session';
import { BASE_URL } from '../services/umpointClient';
import { IconButton, Txt } from '../ui';
import { shape, space, useColors } from '../theme';

interface Props {
  visible: boolean;
  mode: 'signin' | 'dashboard';
  reason?: string;
  onClose: () => void;
}

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
      <View style={[styles.container, { backgroundColor: c.surface, paddingTop: insets.top }]}>
        <View style={[styles.topBar, { borderBottomColor: c.outlineVariant, borderBottomWidth: StyleSheet.hairlineWidth }]}>
          <IconButton icon="close" label="Close" onPress={onClose} size={40} />
          <Txt variant="titleMedium" color={c.onSurface}>
            {mode === 'signin' ? 'Sign in to UMPoint' : 'My UMPoint Bookings'}
          </Txt>
          <View style={styles.closePlaceholder} />
        </View>

        {reason ? (
          <View style={[styles.reason, { backgroundColor: c.errorContainer }]}>
            <Ionicons name="alarm-outline" size={20} color={c.error} />
            <Txt variant="bodySmall" color={c.onErrorContainer} style={styles.flex}>
              {reason}
            </Txt>
          </View>
        ) : null}

        <Txt variant="bodySmall" color={c.onSurfaceVariant} style={styles.hint}>
          {mode === 'signin'
            ? 'Tap “UM Staff and Student” and sign in with your SiswaMail.'
            : 'Live UMPoint dashboard. Cancelling here updates your local bookings immediately.'}
        </Txt>

        {blocked ? (
          <Txt variant="bodySmall" color={c.error} style={styles.hint}>
            Google refused to sign in inside the app. Check network or WebView user agent.
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
            <View style={[styles.loading, { backgroundColor: c.surface }]}>
              <ActivityIndicator size="large" color={c.primary} />
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
    paddingHorizontal: space.m,
    height: 56,
  },
  closePlaceholder: {
    width: 40,
  },
  reason: {
    flexDirection: 'row',
    gap: space.m,
    alignItems: 'center',
    margin: space.m,
    marginBottom: 0,
    padding: space.m,
    borderRadius: shape.medium,
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
