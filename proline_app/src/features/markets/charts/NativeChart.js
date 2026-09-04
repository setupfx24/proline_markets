import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet, Platform, NativeModules } from 'react-native';
import { WebView } from 'react-native-webview';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

import { API_URL } from '../../../constants';
import { vantage, space, sizes, weights, fontFamily, radius } from '../../../theme/vantageTheme';
import { getInstruments } from '../../../utils/instrumentsCache';
import logger from '../../../utils/logger';

/**
 * Fully self-contained chart — the TradingView Advanced Charting Library is
 * bundled INSIDE the APK (android_asset/webchart) and rendered here. The
 * WebView makes NO network calls of its own; this RN host does every fetch
 * with the user's token (so there are no CORS issues) and feeds the chart over
 * a small bridge. Completely independent of the trader web app: nothing here
 * is loaded from it, so the chart works whether or not the website is up.
 *
 * Bridge:
 *   WebView → RN : {type:'getBars'|'resolveSymbol'|'ready'|'bridgeReady', ...}
 *   RN → WebView : window.SC.onBars(id, bars) | onSymbol(id, info) | pushTick(bar)
 */
// Production: the chart ships inside the app and is read straight off disk.
// Dev (Expo Go): android_asset/webchart does not exist — the withWebChart
// plugin only runs at prebuild — so the very same directory is served by the
// dev server instead (see the /webchart middleware in metro.config.js). Same
// files, same chart code; only where they are fetched from differs.
const BUNDLED_HTML =
  Platform.OS === 'android'
    ? 'file:///android_asset/webchart/index.html'
    : 'webchart/index.html'; // iOS: bundled resource (added later)

// Origin of the dev server this client is actually talking to — LAN
// ("http://192.168.1.25:8081") or tunnel ("https://x-anonymous-8081.exp.direct").
//
// SourceCode.scriptURL is the URL this very JS bundle was downloaded from, so
// it is always right and needs no guessing about scheme or port. The Constants
// values are only fallbacks: `expoConfig.hostUri` is frequently absent from the
// manifest (it was on this project), and debuggerHost carries no scheme.
function devServerOrigin() {
  const url = NativeModules?.SourceCode?.scriptURL;
  if (typeof url === 'string') {
    const m = url.match(/^(https?:\/\/[^/]+)/);
    if (m) return m[1];
  }
  const host = Constants.expoConfig?.hostUri || Constants.expoGoConfig?.debuggerHost;
  if (!host) return null;
  const bare = String(host).replace(/^https?:\/\//, '');
  // exp.direct tunnels are HTTPS-only; a LAN dev server is plain HTTP.
  return `${bare.includes('exp.direct') ? 'https' : 'http'}://${bare}`;
}

const DEV_ORIGIN = __DEV__ ? devServerOrigin() : null;
const DEV_CHART_URL = DEV_ORIGIN ? `${DEV_ORIGIN}/webchart/index.html` : null;
const DEV_HOST = DEV_ORIGIN;

const LOCAL_HTML = (__DEV__ && DEV_CHART_URL) ? DEV_CHART_URL : BUNDLED_HTML;

const RES_SECONDS = { '1': 60, '5': 300, '15': 900, '30': 1800, '60': 3600, '240': 14400, '1D': 86400, D: 86400 };
function resSeconds(r) { return RES_SECONDS[r] || 300; }

export default function NativeChart({ symbol = 'EURUSD', interval = '60', theme, accountId, onDrag, refreshTick, onClosePosition }) {
  const webRef = useRef(null);
  // The app's chart is entirely its own: assets/webchart/ (the charting
  // library + our chart page) ships inside the build and is loaded from there.
  // NOTHING is fetched from the trader web app — there used to be a fallback to
  // trade.prolinemarket.com/app-chart, and it is gone: the app must not depend
  // on the website being deployed, and that host does not even serve a chart.
  // On failure we show our own branded panel, never the WebView's raw error.
  const [failed, setFailed] = useState(false);
  const tokenRef = useRef('');
  const instrRef = useRef([]);
  const readyRef = useRef(false);
  const pollRef = useRef(null);
  const posPollRef = useRef(null);
  const acctRef = useRef(accountId);
  const curRef = useRef({ symbol: String(symbol).toUpperCase(), resolution: String(interval) });
  const dark = theme ? theme !== 'light' : vantage.isDark;
  acctRef.current = accountId;

  // Load token + instruments once.
  useEffect(() => {
    let alive = true;
    SecureStore.getItemAsync('token').then((t) => { if (alive) tokenRef.current = t || ''; }).catch(() => {});
    getInstruments().then((list) => { if (alive) instrRef.current = list || []; }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const authHeaders = useCallback(() => {
    const h = { Accept: 'application/json' };
    if (tokenRef.current) h.Authorization = `Bearer ${tokenRef.current}`;
    return h;
  }, []);

  // Fetch history bars for the chart's getBars request.
  const fetchBars = useCallback(async (sym, resolution, from, to) => {
    const url = `${API_URL}/instruments/${encodeURIComponent(sym)}/bars`
      + `?resolution=${encodeURIComponent(resolution)}&from=${from}&to=${to}`;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(url, { headers: authHeaders() });
        if (res.ok) {
          const raw = await res.json();
          const list = Array.isArray(raw) ? raw : (Array.isArray(raw?.bars) ? raw.bars : (Array.isArray(raw?.items) ? raw.items : []));
          return list.map((b) => ({
            time: Number(b.time), open: Number(b.open), high: Number(b.high),
            low: Number(b.low), close: Number(b.close), volume: Number(b.volume ?? 0),
          }));
        }
        if (res.status < 500) return [];
      } catch (e) { /* retry */ }
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
    return [];
  }, [authHeaders]);

  const inject = useCallback((js) => {
    try { webRef.current?.injectJavaScript(js + '\ntrue;'); } catch (e) {}
  }, []);

  // Push instrument metadata (digits) so the chart formats SL/TP prices right.
  const injectInstruments = useCallback(() => {
    const map = {};
    (instrRef.current || []).forEach((i) => {
      const s = String(i.symbol || '').toUpperCase();
      if (s) map[s] = { digits: Number(i.digits) || 5, contract_size: Number(i.contract_size) || 100000 };
    });
    inject(`window.SC && window.SC.setInstruments(${JSON.stringify(map)});`);
  }, [inject]);

  // Fetch this account's OPEN positions and feed them to the chart (entry + SL/TP
  // lines with live P&L). The position's `profit` is already live from the API.
  const fetchPositions = useCallback(async () => {
    const acct = acctRef.current;
    if (!acct) return;
    try {
      const url = `${API_URL}/positions/?account_id=${encodeURIComponent(acct)}&status=open`;
      const res = await fetch(url, { headers: authHeaders() });
      if (!res.ok) return;
      const raw = await res.json();
      const list = Array.isArray(raw) ? raw : (Array.isArray(raw?.items) ? raw.items : []);
      inject(`window.SC && window.SC.setPositions(${JSON.stringify(list)});`);
    } catch (e) { /* transient */ }
  }, [authHeaders, inject]);

  const startPosPoll = useCallback(() => {
    if (posPollRef.current) return;
    posPollRef.current = setInterval(fetchPositions, 3000);
    fetchPositions();
  }, [fetchPositions]);

  // Parent bumps `refreshTick` right after placing/closing a trade → pull the
  // new position onto the chart IMMEDIATELY instead of waiting up to 3s for the
  // next poll. Two pulls (now + ~900ms) cover the brief backend write lag so
  // the entry/SL/TP line appears the instant the order fills.
  useEffect(() => {
    if (refreshTick == null) return;
    let t = null;
    fetchPositions();
    t = setTimeout(fetchPositions, 900);
    return () => { if (t) clearTimeout(t); };
  }, [refreshTick, fetchPositions]);

  // Save an SL/TP dragged on the chart (RN does the PUT with the token, then
  // re-fetches so the line snaps to the server's truth).
  const saveBracket = useCallback(async (positionId, kind, price) => {
    try {
      const body = kind === 'sl' ? { stop_loss: Number(price) } : { take_profit: Number(price) };
      await fetch(`${API_URL}/positions/${encodeURIComponent(positionId)}`, {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (e) { /* ignore — re-fetch reflects server state */ }
    fetchPositions();
  }, [authHeaders, fetchPositions]);

  const resolveSymbolInfo = useCallback((sym) => {
    const s = String(sym).toUpperCase();
    const inst = (instrRef.current || []).find((i) => String(i.symbol).toUpperCase() === s);
    const seg = String(inst?.segment?.name || inst?.segment || '').toLowerCase();
    let digits = inst?.digits;
    if (digits == null) digits = s.endsWith('JPY') ? 3 : 5;
    return { digits: Number(digits) || 5, type: seg || 'forex' };
  }, []);

  // Handle bridge messages from the WebView.
  const onMessage = useCallback(async (evt) => {
    let m;
    try { m = JSON.parse(evt.nativeEvent.data); } catch (e) { return; }
    if (!m || !m.type) return;

    // The chart page reports its own boot progress and any uncaught error.
    // Both used to be dropped on the floor here, which is why a chart stuck on
    // its loading spinner gave nothing to go on.
    if (m.type === 'stage') { if (__DEV__) logger.log('[chart]', m.stage); return; }
    if (m.type === 'jserror') { logger.error('[chart] page error:', m.message); return; }

    if (m.type === 'bridgeReady' || m.type === 'ready') {
      if (m.type === 'ready') {
        readyRef.current = true;
        injectInstruments();
        startPoll();     // live candles
        startPosPoll();  // positions → entry + SL/TP lines
        // Boot-race guard: if the symbol/interval changed while the 26MB
        // library was still loading, the live setSymbol() call was skipped
        // (readyRef was false), leaving the chart stuck on whatever it booted
        // with (this is why tapping BTCUSD showed EURUSD). Re-apply the latest
        // now — but ONLY if it differs from the booted symbol, so the normal
        // case doesn't trigger a redundant re-resolve/flicker.
        const cur = curRef.current;
        if (cur.symbol && String(cur.symbol).toUpperCase() !== String(m.symbol || '').toUpperCase()) {
          inject(`window.SC && window.SC.setSymbol && window.SC.setSymbol(${JSON.stringify(String(cur.symbol).toUpperCase())});`);
        }
      }
      return;
    }
    if (m.type === 'setBracket') {
      await saveBracket(m.positionId, m.kind, m.price);
      return;
    }
    if (m.type === 'closePosition') {
      // Route to the parent so it can show a CONFIRM popup (the chart's [x] used
      // to close silently with no confirmation). The parent closes via the API
      // and bumps refreshTick, which re-pulls positions here so the entry/SL/TP
      // lines are removed — before, a closed trade's lines lingered on the chart.
      if (onClosePosition) { onClosePosition(m.positionId); return; }
      // Fallback (no handler wired): close directly, then refresh so lines clear.
      try {
        await fetch(`${API_URL}/positions/${encodeURIComponent(m.positionId)}/close`, {
          method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' }, body: '{}',
        });
      } catch (e) { /* ignore */ }
      fetchPositions();
      return;
    }
    if (m.type === 'chart:drag') {
      onDrag?.(!!m.active);   // freeze the parent ScrollView during an SL/TP drag
      return;
    }
    if (m.type === 'resolveSymbol') {
      const info = resolveSymbolInfo(m.symbol);
      inject(`window.SC && window.SC.onSymbol(${m.id}, ${JSON.stringify(info)});`);
      return;
    }
    if (m.type === 'getBars') {
      const bars = await fetchBars(m.symbol, m.resolution, m.from, m.to);
      inject(`window.SC && window.SC.onBars(${m.id}, ${JSON.stringify(bars)});`);
      // Track what the chart is currently showing so the live poll matches.
      curRef.current = { symbol: String(m.symbol).toUpperCase(), resolution: String(m.resolution) };
      return;
    }
  }, [fetchBars, inject, resolveSymbolInfo, injectInstruments, startPosPoll, saveBracket, authHeaders, fetchPositions, onDrag, onClosePosition]);

  // Live-candle poll: every 4s fetch the latest bar for the shown symbol/res and
  // push it into the chart (primary realtime for the self-contained build).
  const startPoll = useCallback(() => {
    if (pollRef.current) return;
    const tick = async () => {
      const { symbol: sym, resolution } = curRef.current;
      if (!sym) return;
      const step = resSeconds(resolution);
      const to = Math.floor(Date.now() / 1000);
      const from = to - step * 3;
      const bars = await fetchBars(sym, resolution, from, to);
      const nb = bars[bars.length - 1];
      if (nb && isFinite(nb.close)) {
        inject(`window.SC && window.SC.pushTick(${JSON.stringify({ symbol: sym, resolution, ...nb })});`);
      }
    };
    pollRef.current = setInterval(tick, 4000);
    tick();
  }, [fetchBars, inject]);

  useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (posPollRef.current) clearInterval(posPollRef.current);
  }, []);

  // Live symbol/interval switching without reload.
  useEffect(() => {
    const s = String(symbol).toUpperCase();
    curRef.current = { ...curRef.current, symbol: s };
    if (readyRef.current) inject(`window.SC && window.SC.setSymbol && window.SC.setSymbol(${JSON.stringify(s)});`);
  }, [symbol, inject]);
  useEffect(() => {
    curRef.current = { ...curRef.current, resolution: String(interval) };
    if (readyRef.current) inject(`window.SC && window.SC.setInterval && window.SC.setInterval(${JSON.stringify(String(interval))});`);
  }, [interval, inject]);

  const beforeLoad = `
    window.__SC_CONFIG = ${JSON.stringify({
      symbol: String(symbol).toUpperCase(),
      interval: String(interval),
      theme: dark ? 'dark' : 'light',
      digits: resolveSymbolInfo(symbol).digits,
    })};
    window.__SC_AUTOBOOT = true;
    true;
  `;

  // The BOOT symbol/interval ride in the URL query string — index.html reads
  // these FIRST (location.search). Unlike the injected __SC_CONFIG, the URL is
  // ALWAYS present in the loaded page regardless of injection timing or WebView
  // caching, so the chart can never fall back to its default EURUSD/60 (which is
  // exactly what made tapping Gold/NAS100 open EURUSD). Mirrors the old
  // URL-driven web chart, which never showed the wrong symbol.
  //
  // Captured ONCE at mount so the URI stays STABLE — later symbol/interval
  // changes go through the live window.SC.setSymbol()/setInterval() bridge
  // (no reload = FundedZone-fast). If the URI changed per symbol the WebView
  // would reload the whole 26 MB library on every switch.
  const bootRef = useRef(null);
  if (bootRef.current === null) {
    bootRef.current = { symbol: String(symbol).toUpperCase(), interval: String(interval) };
  }
  // The boot symbol is fixed; later switches go through the live
  // window.SC.setSymbol()/setInterval() bridge rather than reloading the page.
  const q = bootRef.current;
  const chartUri = `${LOCAL_HTML}?symbol=${encodeURIComponent(q.symbol)}`
    + `&interval=${encodeURIComponent(q.interval)}`
    + `&theme=${dark ? 'dark' : 'light'}`
    + `&digits=${resolveSymbolInfo(q.symbol).digits}`;

  // Calm branded panel, used both when the chart fails and as the WebView's own
  // error renderer. Trading and live prices are untouched, so the copy says so
  // rather than implying the whole screen is broken.
  const Unavailable = () => (
    <View style={[styles.wrap, styles.fallback]}>
      <Text style={styles.fallbackTitle}>Chart unavailable</Text>
      <Text style={styles.fallbackSub}>Live prices and trading are unaffected.</Text>
      <Pressable onPress={() => setFailed(false)} style={styles.retry} accessibilityRole="button" accessibilityLabel="Retry loading the chart">
        <Text style={styles.retryTxt}>Retry</Text>
      </Pressable>
    </View>
  );

  if (failed) return <Unavailable />;

  return (
    <View style={styles.wrap}>
      <WebView
        ref={webRef}
        source={{ uri: chartUri }}
        // Security invariant: this is a LOCAL page (file:///android_asset/…)
        // that makes NO network requests of its own — RN does every fetch and
        // feeds it over the postMessage bridge. So only file:// origins are
        // whitelisted, and file:// pages may read sibling file:// subresources
        // (the charting_library/ bundle next to index.html) but get NO
        // universal (network) access and no mixed-content allowance.
        // Local mode stays file://-only. The fallback additionally allows the
        // trader-web origin (and nothing else) so the hosted chart can load.
        // Local mode is file://-only in production. In dev the same page comes
        // from the dev server, so that origin has to be allowed too; the hosted
        // fallback adds the trader-web origin and nothing else.
        // blob:/data: are listed too — the charting library creates its workers
        // and iframes as blob: URLs (see onShouldStartLoadWithRequest below).
        // In dev the page is served by Metro, so that origin is allowed as well;
        // in production it is file:// only.
        originWhitelist={
          __DEV__ && DEV_ORIGIN
            ? ['file://*', 'blob:*', 'data:*', 'http://*', 'https://*']
            : ['file://*', 'blob:*', 'data:*']
        }
        // The charting library builds its workers/iframes as blob: URLs. Those
        // are same-document loads, but react-native-webview's default handler
        // measures every navigation against originWhitelist, does not match
        // blob:, and hands the URL to Linking.canOpenURL instead — which fails
        // with "Can't open url: blob:…" and silently blocks it. The library
        // then never initialises: no bundle requests, no error, and a chart
        // that spins forever. Allow the schemes the page legitimately loads
        // itself; anything else still falls through to the default handler.
        onShouldStartLoadWithRequest={(req) => {
          const u = String(req?.url || '');
          if (/^(blob:|data:|about:|file:)/.test(u)) return true;
          if (DEV_ORIGIN && u.startsWith(DEV_ORIGIN)) return true;
          // Keep the invariant: the chart page itself must not navigate away.
          return u === chartUri || u.startsWith('file://');
        }}
        style={styles.web}
        javaScriptEnabled
        domStorageEnabled
        allowFileAccess
        allowFileAccessFromFileURLs
        injectedJavaScriptBeforeContentLoaded={beforeLoad}
        onLoadEnd={() => {
          // Backup: ensure the chart boots even if the pre-load config injection
          // lost the race (it did on small/fast WebViews → stuck "1 script running").
          try { webRef.current?.injectJavaScript(beforeLoad + '\nwindow.SC && window.SC.setConfig && window.SC.setConfig(window.__SC_CONFIG); window.SC && window.SC.boot && window.SC.boot(); true;'); } catch (e) {}
        }}
        onMessage={onMessage}
        onError={(e) => {
          const ne = e?.nativeEvent;
          logger.error('[chart] load failed:', ne?.description, '|', ne?.url);
          setFailed(true);
        }}
        startInLoadingState
        renderLoading={() => (
          <View style={styles.loader}><ActivityIndicator size="large" color={vantage.accent} /></View>
        )}
        // Without this the WebView paints Android's own "Error loading page /
        // net::ERR_FILE_NOT_FOUND" chrome, which is what the user actually saw.
        // renderError replaces that surface entirely, so the raw browser error
        // can never reach the screen no matter what failed.
        renderError={() => <Unavailable />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: vantage.bg },
  web: { flex: 1, backgroundColor: vantage.bg },
  loader: { position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: vantage.bg },
  fallback: { alignItems: 'center', justifyContent: 'center', padding: space.xl, gap: space.sm },
  fallbackTitle: { color: vantage.textPrimary, fontFamily, fontSize: sizes.h3, fontWeight: weights.bold },
  fallbackSub: { color: vantage.textMuted, fontFamily, fontSize: sizes.label, textAlign: 'center' },
  retry: {
    marginTop: space.sm, paddingHorizontal: space.lg, paddingVertical: space.sm,
    borderRadius: radius.pill, borderWidth: 1, borderColor: vantage.border, backgroundColor: vantage.bgElevated,
  },
  retryTxt: { color: vantage.accent, fontFamily, fontSize: sizes.label, fontWeight: weights.bold },
});
