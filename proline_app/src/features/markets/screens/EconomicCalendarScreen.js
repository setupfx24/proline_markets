import React, { useMemo, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Linking,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { vantage } from '../../../theme/vantageTheme';

const colors = {
  bgPrimary: vantage.bg,
  bgSecondary: vantage.bgRaised,
  bgCard: vantage.bgElevated,
  bgHover: vantage.bgPressed,
  border: vantage.border,
  textPrimary: vantage.textPrimary,
  textSecondary: vantage.textSecondary,
  textMuted: vantage.textMuted,
  primary: vantage.accent,
  accent: vantage.accent,
  success: vantage.up,
  error: vantage.down,
  warning: '#F59E0B',
  profitColor: vantage.up,
};
import { useI18n } from '../../../i18n';
import ScreenHeader from '../../../components/ui/ScreenHeader';

// TradingView Events (Economic Calendar) embed widget — same widget the web
// trader app uses. Free, live, and filterable inside the widget itself, so we
// don't need our own day/impact chips on top.
export default function EconomicCalendarScreen({ navigation }) {
  const isDark = vantage.isDark !== false;
  const { t } = useI18n();
  const [reloadKey, setReloadKey] = useState(0);
  const [errored, setErrored] = useState(false);

  const widgetHtml = useMemo(() => {
    const bg = isDark ? '#0a0a0a' : '#ffffff';
    const theme = isDark ? 'dark' : 'light';
    return `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  html,body{height:100%;width:100%;background:${bg};overflow:hidden;font-family:-apple-system,Segoe UI,Roboto,sans-serif;}
  .tradingview-widget-container{height:100%;width:100%;}
  .tradingview-widget-container__widget{height:100%;width:100%;}
</style>
</head><body>
<div class="tradingview-widget-container">
  <div class="tradingview-widget-container__widget"></div>
  <script type="text/javascript" src="https://s3.tradingview.com/external-embedding/embed-widget-events.js" async>
  {
    "colorTheme": "${theme}",
    "isTransparent": false,
    "locale": "en",
    "countryFilter": "us,eu,gb,jp,au,nz,ca,ch,cn,in,de,fr",
    "importanceFilter": "0,1",
    "width": "100%",
    "height": "100%"
  }
  </script>
</div>
<script>
  // Surface a network/script load failure to the React Native side so we can
  // show a "tap to retry" affordance instead of a silent blank page.
  window.addEventListener('error', function(e) {
    try {
      if (window.ReactNativeWebView && e && (e.message || (e.target && e.target.src))) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', message: e.message || 'load error' }));
      }
    } catch(_) {}
  }, true);
</script>
</body></html>`;
  }, [isDark, reloadKey]);

  const handleReload = useCallback(() => {
    setErrored(false);
    setReloadKey((k) => k + 1);
  }, []);

  const handleMessage = useCallback((event) => {
    try {
      const msg = JSON.parse(event?.nativeEvent?.data || '{}');
      if (msg && msg.type === 'error') setErrored(true);
    } catch (_) {}
  }, []);

  return (
    <View style={[s.container, { backgroundColor: colors.bgPrimary }]}>
      <ScreenHeader title={t('news.title')} subtitle={t('news.subtitle')} onBack={() => navigation.goBack()} />
      <View style={[s.note, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <Text style={[s.noteText, { color: colors.textMuted }]}>
          Live economic calendar powered by TradingView. Tap any event to expand details.
        </Text>
        <TouchableOpacity onPress={handleReload} style={s.reloadBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="refresh" size={16} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {errored ? (
        <View style={s.errorBox}>
          <Ionicons name="cloud-offline-outline" size={42} color={colors.textMuted} />
          <Text style={[s.errorTitle, { color: colors.textPrimary }]}>Couldn't load live calendar</Text>
          <Text style={[s.errorMsg, { color: colors.textMuted }]}>
            Check your internet connection and try again. The widget loads from TradingView's CDN.
          </Text>
          <View style={s.errorActions}>
            <TouchableOpacity style={[s.btn, { backgroundColor: colors.primary }]} onPress={handleReload}>
              <Ionicons name="refresh" size={16} color="#fff" />
              <Text style={s.btnText}>Retry</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.btn, { backgroundColor: colors.bgSecondary, borderWidth: 1, borderColor: colors.border }]}
              onPress={() => Linking.openURL('https://www.tradingview.com/economic-calendar/')}
            >
              <Ionicons name="open-outline" size={16} color={colors.textPrimary} />
              <Text style={[s.btnText, { color: colors.textPrimary }]}>Open in browser</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={s.webWrap}>
          <WebView
            key={`econ-cal-${isDark ? 'd' : 'l'}-${reloadKey}`}
            source={{ html: widgetHtml }}
            style={{ flex: 1, backgroundColor: isDark ? '#0a0a0a' : '#ffffff' }}
            javaScriptEnabled
            domStorageEnabled
            scrollEnabled
            originWhitelist={['*']}
            mixedContentMode="always"
            allowsInlineMediaPlayback
            androidLayerType="hardware"
            thirdPartyCookiesEnabled
            startInLoadingState
            onMessage={handleMessage}
            onError={() => setErrored(true)}
            onHttpError={() => setErrored(true)}
            renderLoading={() => (
              <View style={s.loaderOverlay}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[s.loaderText, { color: colors.textMuted }]}>Loading live calendar…</Text>
              </View>
            )}
          />
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  note: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginTop: 4, marginBottom: 8,
    padding: 10, borderRadius: 10, borderWidth: 1,
  },
  noteText: { flex: 1, fontSize: 11, lineHeight: 16 },
  reloadBtn: { marginLeft: 8, padding: 4 },
  webWrap: { flex: 1 },
  loaderOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center', alignItems: 'center',
  },
  loaderText: { fontSize: 12, marginTop: 10 },
  errorBox: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  errorTitle: { fontSize: 16, fontWeight: '700', marginTop: 12 },
  errorMsg: { fontSize: 13, textAlign: 'center', lineHeight: 20, marginTop: 6 },
  errorActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
});
