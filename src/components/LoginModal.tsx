import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  TextInput,
  Platform,
} from 'react-native';
import { WebView, WebViewNavigation } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { setSessionCookies } from '../services/session';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSuccess: (cookies: string) => void;
}

export const LoginModal: React.FC<Props> = ({ visible, onClose, onSuccess }) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [manualMode, setManualMode] = useState<boolean>(false);
  const [cookieInput, setCookieInput] = useState<string>('');

  const handleNavigationStateChange = (navState: WebViewNavigation) => {
    // If URL is in /modules/ and not on /login/, user is logged in!
    if (navState.url.includes('/modules/') && !navState.url.includes('/login')) {
      // In webview, post message with cookies
    }
  };

  const handleMessage = async (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'LOGIN_SUCCESS') {
        const capturedCookies = data.cookies || '';
        if (capturedCookies) {
          await setSessionCookies(capturedCookies);
          Alert.alert('Signed In!', 'UMPoint student session authenticated.');
          onSuccess(capturedCookies);
          onClose();
        }
      }
    } catch {
      // ignore non-json messages
    }
  };

  const handleManualSave = async () => {
    if (!cookieInput.trim()) {
      Alert.alert('Empty Cookie', 'Please paste your PHPSESSID and cookiesession1 string.');
      return;
    }
    await setSessionCookies(cookieInput.trim());
    Alert.alert('Session Saved', 'Updated local UMPoint session cookies.');
    onSuccess(cookieInput.trim());
    onClose();
  };

  // Injected JavaScript that checks when user is on dashboard or modules
  const injectedJS = `
    (function() {
      function checkLogin() {
        if (window.location.href.includes('/modules/') && !window.location.href.includes('/login')) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'LOGIN_SUCCESS',
            cookies: document.cookie,
            url: window.location.href
          }));
        }
      }
      checkLogin();
      setInterval(checkLogin, 1500);
    })();
    true;
  `;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.container}>
        {/* Modal Top Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color="#f8fafc" />
          </TouchableOpacity>
          <Text style={styles.title}>UM Staff & Student Login</Text>
          <TouchableOpacity onPress={() => setManualMode(!manualMode)} style={styles.toggleBtn}>
            <Text style={styles.toggleText}>{manualMode ? 'Browser' : 'Manual'}</Text>
          </TouchableOpacity>
        </View>

        {manualMode ? (
          <View style={styles.manualContainer}>
            <Text style={styles.manualTitle}>Manual Cookie Paste</Text>
            <Text style={styles.manualSubtitle}>
              If you prefer, paste your UMPoint session cookie string below:
            </Text>
            <TextInput
              style={styles.manualInput}
              value={cookieInput}
              onChangeText={setCookieInput}
              placeholder="cookiesession1=...; PHPSESSID=..."
              placeholderTextColor="#64748b"
              multiline
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity style={styles.manualSaveBtn} onPress={handleManualSave}>
              <Text style={styles.manualSaveBtnText}>Save Cookie String</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.webViewContainer}>
            {loading && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color="#10b981" />
                <Text style={styles.loadingText}>Loading UMPoint SSO...</Text>
              </View>
            )}
            {Platform.OS === 'web' ? (
              <View style={styles.webFallbackContainer}>
                <Text style={styles.webFallbackTitle}>In-App WebView</Text>
                <Text style={styles.webFallbackText}>
                  On native iOS & Android (Expo Go / APK), a full Google OAuth WebView opens here. On web browser preview, switch to "Manual" above or use native device.
                </Text>
              </View>
            ) : (
              <WebView
                source={{ uri: 'https://umpoint.um.edu.my/login/' }}
                onNavigationStateChange={handleNavigationStateChange}
                onMessage={handleMessage}
                injectedJavaScript={injectedJS}
                onLoadEnd={() => setLoading(false)}
                javaScriptEnabled
                domStorageEnabled
                sharedCookiesEnabled
                thirdPartyCookiesEnabled
              />
            )}
          </View>
        )}
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  closeBtn: {
    padding: 6,
  },
  title: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '700',
  },
  toggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#1e293b',
    borderRadius: 8,
  },
  toggleText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '700',
  },
  webViewContainer: {
    flex: 1,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#090d16',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  loadingText: {
    color: '#94a3b8',
    marginTop: 12,
    fontSize: 14,
  },
  manualContainer: {
    padding: 20,
    flex: 1,
  },
  manualTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '700',
  },
  manualSubtitle: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 6,
    lineHeight: 18,
  },
  manualInput: {
    backgroundColor: '#131b2e',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    color: '#f8fafc',
    padding: 12,
    height: 120,
    marginTop: 16,
    textAlignVertical: 'top',
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  manualSaveBtn: {
    backgroundColor: '#059669',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  manualSaveBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  webFallbackContainer: {
    flex: 1,
    padding: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  webFallbackTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '700',
  },
  webFallbackText: {
    color: '#94a3b8',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
});
