import React, { useCallback, useEffect, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import * as SecureStore from 'expo-secure-store';

import { API_URL } from '../../../constants';
import { vantage } from '../../../theme/vantageTheme';
import { getInstruments } from '../../../utils/instrumentsCache';
import logger from '../../../utils/logger';

/**
 * Fully self-contained chart — the TradingView Advanced Charting Library is
 * bundled INSIDE the APK (android_asset/webchart) and rendered here. The
 * WebView makes NO network calls of its own; this RN host does every fetch
 * with the user's token (so there are no CORS issues) and feeds the chart over
 * a small bridge. Independent of the web /chart — nothing is loaded from
 * trade.prolinemarket.com.
 *
 * Bridge:
 *   WebView → RN : {type:'getBars'|'resolveSymbol'|'ready'|'bridgeReady', ...}
 *   RN → WebView : window.SC.onBars(id, bars) | onSymbol(id, info) | pushTick(bar)
 */
const LOCAL_HTML =
  Platform.OS === 'android'
    ? 'file:///android_asset/webchart/index.html'
    : 'webchart/index.html'; // iOS: bundled resource (added later)

const RES_SECONDS = { '1': 60, '5': 300, '15': 900, '30': 1800, '60': 3600, '240': 14400, '1D': 86400, D: 86400 };
function resSeconds(r) { return RES_SECONDS[r] || 300; }

export default function NativeChart({ symbol = 'EURUSD', interval = '60', theme, accountId, onDrag, refreshTick, onClosePosition }) {
  const webRef = useRef(null);
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
  const chartUri = `${LOCAL_HTML}?symbol=${encodeURIComponent(bootRef.current.symbol)}`
    + `&interval=${encodeURIComponent(bootRef.current.interval)}`
    + `&theme=${dark ? 'dark' : 'light'}`
    + `&digits=${resolveSymbolInfo(bootRef.current.symbol).digits}`;

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
        originWhitelist={['file://*']}
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
        onError={(e) => logger.error('NativeChart webview error', e?.nativeEvent)}
        startInLoadingState
        renderLoading={() => (
          <View style={styles.loader}><ActivityIndicator size="large" color={vantage.accent} /></View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: vantage.bg },
  web: { flex: 1, backgroundColor: vantage.bg },
  loader: { position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: vantage.bg },
});
