import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Modal, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WebView, WebViewNavigation } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { Sniper } from '../../modules/umpoint-sniper';
import { markSignedIn } from '../services/session';
import { BASE_URL } from '../services/umpointClient';

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
      <SafeAreaView style={styles.container}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} accessibilityLabel="Close">
            <Ionicons name="close" size={24} color="#f8fafc" />
          </TouchableOpacity>
          <Text style={styles.title}>{mode === 'signin' ? 'Sign in to UMPoint' : 'My UMPoint bookings'}</Text>
          <View style={styles.closeBtn} />
        </View>

        {reason ? (
          <View style={styles.reason}>
            <Ionicons name="alarm-outline" size={18} color="#f59e0b" />
            <Text style={styles.reasonText}>{reason}</Text>
          </View>
        ) : null}
        {mode === 'signin' ? (
          <Text style={styles.hint}>Tap “UM Staff and Student” and sign in with your SiswaMail.</Text>
        ) : (
          <Text style={styles.hint}>This is UMPoint itself. Cancel here and the app will show the change.</Text>
        )}
        {blocked ? (
          <Text style={styles.blocked}>
            Google refused to sign in inside the app. Please tell the developer — this needs a fix.
          </Text>
        ) : null}

        <View style={styles.webWrap}>
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
            <View style={styles.loading}>
              <ActivityIndicator size="large" color="#10b981" />
            </View>
          ) : null}
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090d16',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  closeBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '700',
  },
  reason: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    margin: 12,
    marginBottom: 0,
    padding: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
  },
  reasonText: {
    flex: 1,
    color: '#fde68a',
    fontSize: 13,
    lineHeight: 18,
  },
  hint: {
    color: '#94a3b8',
    fontSize: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  blocked: {
    color: '#fca5a5',
    fontSize: 13,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  webWrap: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  loading: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#090d16',
  },
});
