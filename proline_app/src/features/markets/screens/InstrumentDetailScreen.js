import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { ScrollView, View, Text, StyleSheet, Pressable, TextInput, Keyboard, Platform, Modal, ActivityIndicator, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Screen,
  BuySellSplit,
  IconButton,
  Sheet,
  showToast,
} from '../../../components/vantage';
import OrderTicket from '../../trading/order/OrderTicket';
import { BOTTOM_NAV_PILL_HEIGHT } from '../../../components/vantage/BottomNavPill';
import AccountSwitcher from '../../trading/components/AccountSwitcher';
import { useAccount } from '../../../app/providers/AccountContext';
import { vantage, space, sizes, weights, fontFamily, radius } from '../../../theme/vantageTheme';
import * as SecureStore from 'expo-secure-store';
import ApiService from '../../../services/api/ApiService';
import webSocketService from '../../../services/websocket/WebSocketService';
import NativeChart from '../charts/NativeChart';
import { describeTradeError } from '../../../utils/tradeErrors';
import { getInstruments } from '../../../utils/instrumentsCache';
import { getWatchlist, addToWatchlist, removeFromWatchlist } from '../watchlist/watchlistStorage';

const TIMEFRAMES = [
  { key: 'Tick', tv: '1',  label: 'Tick' },
  { key: '1m',   tv: '1',  label: '1m' },
  { key: '15m',  tv: '15', label: '15m' },
  { key: '1h',   tv: '60', label: '1h' },
  { key: '1D',   tv: 'D',  label: '1D' },
  { key: '1W',   tv: 'W',  label: '1W' },
];

export default function InstrumentDetailScreen() {
  const nav = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const initialSymbol = String(route.params?.symbol || 'XAUUSD').toUpperCase();

  const [symbol, setSymbol] = useState(initialSymbol);
  // Re-sync when navigated here again with a different symbol — the screen may
  // already be in the stack (e.g. opened from the home watchlist), so without
  // this it would keep showing the first instrument.
  useEffect(() => {
    const s = route.params?.symbol;
    if (s) setSymbol(String(s).toUpperCase());
  }, [route.params?.symbol]);
  // Remember the last instrument viewed → the Trade tab defaults to it.
  useEffect(() => { if (symbol) SecureStore.setItemAsync('lastSymbol', symbol).catch(() => {}); }, [symbol]);
  const [tf, setTf] = useState('1m');
  const [chartFull, setChartFull] = useState(false);   // fullscreen chart toggle
  const [chartDragging, setChartDragging] = useState(false); // freeze page scroll during an on-chart SL/TP drag
  const [instrument, setInstrument] = useState(null);
  const [tick, setTick] = useState(null);
  const [bars1D, setBars1D] = useState([]);
  const [bars1W, setBars1W] = useState([]);
  const [bars1M, setBars1M] = useState([]);
  const [pinned, setPinned] = useState(false);
  // Global account selection — synced with Home & Trade.
  const { accounts, selectedAccount: activeAccount, selectAccount, refreshAccounts } = useAccount();
  const [acctSheet, setAcctSheet] = useState(false);
  // No-account prompt shown on Buy/Sell: null | 'open' | 'choose'.
  const [acctPrompt, setAcctPrompt] = useState(null);
  // Trade failure popup: null | { title, message }. Rendered as a custom
  // overlay so it also shows OVER the fullscreen chart.
  const [tradeError, setTradeError] = useState(null);
  const [tradeOk, setTradeOk] = useState(null);        // success popup (works over fullscreen too)
  const [posRefresh, setPosRefresh] = useState(0);     // bump → chart pulls new position line instantly
  const [closePrompt, setClosePrompt] = useState(null); // positionId pending a close-confirm from the chart [x]
  const [closing, setClosing] = useState(false);
  const [side, setSide] = useState('sell');
  const [lots, setLots] = useState(0.01);
  const [submitting, setSubmitting] = useState(false);
  const [footerH, setFooterH] = useState(330);
  const [kbHeight, setKbHeight] = useState(0);
  // Advanced order sheet (limit / stop entry with TP/SL) — reachable from the
  // normal footer AND the fullscreen chart's bottom bar.
  const [advOpen, setAdvOpen] = useState(false);

  // Lift the (absolutely-positioned) footer above the keyboard when typing Lots.
  // Edge-to-edge (Expo SDK 54 default) breaks Android `adjustResize`, so the
  // footer won't move on its own — we translate it up by the keyboard height.
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvt, (e) => setKbHeight(e?.endCoordinates?.height || 0));
    const hide = Keyboard.addListener(hideEvt, () => setKbHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  // Load instrument metadata + initial pin state + accounts
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [list, watchlist] = await Promise.allSettled([
        getInstruments(),
        getWatchlist(),
      ]);
      if (cancelled) return;
      if (list.status === 'fulfilled') {
        const found = (list.value || []).find((i) => String(i.symbol || '').toUpperCase() === symbol);
        setInstrument(found || null);
      }
      if (watchlist.status === 'fulfilled') setPinned((watchlist.value || []).includes(symbol));
    })();
    return () => { cancelled = true; };
  }, [symbol]);

  // Refresh tick + bars
  const refresh = useCallback(async () => {
    const [prices, b1d, b1w, b1m] = await Promise.allSettled([
      ApiService.getAllPrices(),
      ApiService.getBars(symbol, { resolution: '60', limit: 24 }),
      ApiService.getBars(symbol, { resolution: 'D',  limit: 7 }),
      ApiService.getBars(symbol, { resolution: 'D',  limit: 30 }),
    ]);
    if (prices.status === 'fulfilled') {
      const arr = Array.isArray(prices.value) ? prices.value : (Array.isArray(prices.value?.items) ? prices.value.items : []);
      const t = arr.find((x) => String(x.symbol || x.ticker || '').toUpperCase() === symbol);
      if (t) setTick(t);
    }
    // Backend ignores `limit` and returns full history — keep the most recent
    // bars so the OHLC / 1D-1W-1M figures reflect the intended window.
    const arrOr = (s) => Array.isArray(s) ? s : [];
    if (b1d.status === 'fulfilled') setBars1D(arrOr(b1d.value).slice(-24));
    if (b1w.status === 'fulfilled') setBars1W(arrOr(b1w.value).slice(-7));
    if (b1m.status === 'fulfilled') setBars1M(arrOr(b1m.value).slice(-30));
  }, [symbol]);

  useEffect(() => { refresh(); }, [refresh]);
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  // Live ticks
  useEffect(() => {
    if (typeof webSocketService?.onPriceUpdate !== 'function') return;
    const unsub = webSocketService.onPriceUpdate((msg) => {
      if (!msg) return;
      const sym = String(msg.symbol || msg.s || '').toUpperCase();
      if (sym !== symbol) return;
      setTick((prev) => ({
        ...(prev || {}),
        symbol: sym,
        bid: msg.bid != null ? Number(msg.bid) : prev?.bid,
        ask: msg.ask != null ? Number(msg.ask) : prev?.ask,
      }));
    });
    webSocketService.connectPriceStream?.();
    return () => { if (typeof unsub === 'function') unsub(); };
  }, [symbol]);

  // Live price via polling (WS fallback, 1.5s while focused). Fetches ONLY
  // this symbol — the old version pulled the entire price universe every
  // 500ms to read one row.
  useFocusEffect(useCallback(() => {
    let cancelled = false;
    const tickOnce = async () => {
      try {
        const t = await ApiService.getPrice(symbol);
        if (!cancelled && t && t.bid != null) setTick(t);
      } catch (_) {}
    };
    const id = setInterval(tickOnce, 1500);
    return () => { cancelled = true; clearInterval(id); };
  }, [symbol]));

  // Derived
  const bid = tick?.bid != null ? Number(tick.bid) : null;
  const ask = tick?.ask != null ? Number(tick.ask) : null;
  const change = tick?.change != null ? Number(tick.change) : null;
  const changePct = tick?.change_pct != null ? Number(tick.change_pct) : null;
  const spread = bid != null && ask != null ? Math.round((ask - bid) * 100000) : null;

  const ohlc = useMemo(() => {
    if (!bars1D.length) return { open: null, high: null, low: null, close: null };
    const sorted = [...bars1D].sort((a, b) => (a.time || 0) - (b.time || 0));
    const first = sorted[0] || {};
    const last  = sorted[sorted.length - 1] || {};
    const high  = Math.max(...sorted.map((b) => Number(b.high ?? b.h ?? 0)).filter(Number.isFinite));
    const low   = Math.min(...sorted.map((b) => Number(b.low  ?? b.l ?? 0)).filter((v) => Number.isFinite(v) && v > 0));
    return {
      open:  Number(first.open  ?? first.o ?? null),
      close: Number(last.close  ?? last.c ?? null),
      high:  Number.isFinite(high) ? high : null,
      low:   Number.isFinite(low)  ? low  : null,
    };
  }, [bars1D]);

  const pctFor = (bars) => {
    if (!bars?.length) return null;
    const sorted = [...bars].sort((a, b) => (a.time || 0) - (b.time || 0));
    const first = Number(sorted[0]?.close ?? sorted[0]?.c ?? 0);
    const last  = Number(sorted[sorted.length - 1]?.close ?? sorted[sorted.length - 1]?.c ?? 0);
    if (!first) return null;
    return (last - first) / first * 100;
  };
  const pct1D = changePct ?? pctFor(bars1D);
  const pct1W = pctFor(bars1W);
  const pct1M = pctFor(bars1M);
  // 1-day absolute change — tick's field, else derived from the day's bars
  // (first vs last close) so the header shows real movement, not a static "—".
  const dayChangeAbs = change ?? (bars1D.length ? (() => {
    const s = [...bars1D].sort((a, b) => (a.time || 0) - (b.time || 0));
    const f = Number(s[0]?.close ?? s[0]?.c);
    const l = Number(s[s.length - 1]?.close ?? s[s.length - 1]?.c);
    return Number.isFinite(f) && Number.isFinite(l) ? l - f : null;
  })() : null);
  const positive = (pct1D ?? 0) >= 0;

  // 1h Low/High range
  const range1h = useMemo(() => {
    if (!bars1D.length) return null;
    const lastHour = bars1D.slice(-1)[0];
    if (!lastHour) return null;
    const low = Number(lastHour.low ?? lastHour.l ?? 0);
    const high = Number(lastHour.high ?? lastHour.h ?? 0);
    if (!(low > 0) || !(high > 0)) return null;
    const cur = bid ?? Number(lastHour.close ?? lastHour.c ?? low);
    const pos = (cur - low) / (high - low || 1);
    return { low, high, posPct: Math.max(0, Math.min(1, pos)) };
  }, [bars1D, bid]);

  const togglePin = useCallback(async () => {
    if (pinned) {
      await removeFromWatchlist(symbol);
      setPinned(false);
      showToast({ kind: 'info', message: `${symbol} removed from watchlist` });
    } else {
      await addToWatchlist(symbol);
      setPinned(true);
      showToast({ kind: 'success', message: `${symbol} added to watchlist` });
    }
  }, [pinned, symbol]);

  // One-tap execution (MT5-style): tapping Sell/Buy places the market order
  // immediately for that side — no separate confirm/execute button.
  const placeOrder = useCallback(async (sideArg) => {
    const s = sideArg === 'buy' || sideArg === 'sell' ? sideArg : side;
    // No account chosen — guide the user instead of silently doing nothing.
    // Uses a custom overlay (not Alert.alert), which Android won't render over
    // the fullscreen-chart Modal. 'open' = no accounts yet, 'choose' = pick one.
    if (!activeAccount) {
      setAcctPrompt((!accounts || accounts.length === 0) ? 'open' : 'choose');
      return;
    }
    if (!(lots > 0) || submitting) return;
    setSide(s);
    setSubmitting(true);
    try {
      await ApiService.placeOrder({
        account_id: activeAccount.id || activeAccount._id,
        symbol,
        side: s,
        order_type: 'market',
        lots: Number(lots),
      });
      // Success popup via MessagePopup (custom overlay) so it shows over the
      // fullscreen chart too — a toast does NOT render above the fullscreen
      // Modal on Android. Auto-dismisses so it isn't a tap-to-close chore.
      setTradeOk({ kind: 'success', title: 'Order placed', message: `${s.toUpperCase()} ${lots} ${symbol}` });
      // Pull the new position onto the chart RIGHT NOW (both instances) instead
      // of waiting for the 3s poll — this is why the entry/SL/TP line was slow.
      setPosRefresh((n) => n + 1);
    } catch (e) {
      // Custom popup (not toast/AppAlert) so the failure is visible over the
      // fullscreen chart too, with a clean message and no raw console error.
      setTradeError(describeTradeError(e?.message, 'Order failed'));
    } finally {
      setSubmitting(false);
      // Refresh the account so Free Margin / Equity reflect the new position
      // immediately — otherwise the panel showed a STALE (too-high) free
      // margin after opening, and the next order got a confusing
      // "Insufficient margin" while the display still read the old amount.
      try { refreshAccounts?.(); } catch (_) {}
    }
  }, [activeAccount, accounts, lots, side, symbol, submitting, refreshAccounts]);


  // Keep Free Margin / Equity live while this screen is focused — open
  // positions change the account's used/free margin, so a stale snapshot made
  // the order panel show more free margin than really available.
  useFocusEffect(useCallback(() => {
    const id = setInterval(() => { try { refreshAccounts?.(); } catch (_) {} }, 6000);
    return () => clearInterval(id);
  }, [refreshAccounts]));

  // Auto-dismiss the order-placed success popup.
  useEffect(() => {
    if (!tradeOk) return;
    const t = setTimeout(() => setTradeOk(null), 1600);
    return () => clearTimeout(t);
  }, [tradeOk]);

  // Confirm handler for the chart [x] close-position button. Closes via the API,
  // then bumps posRefresh so the chart re-pulls positions and drops the closed
  // trade's entry/SL/TP lines. Rendered over the fullscreen chart too.
  const confirmClosePosition = useCallback(async () => {
    const id = closePrompt;
    if (!id || closing) return;
    setClosing(true);
    try {
      await ApiService.closePosition(id);
      setClosePrompt(null);
      setTradeOk({ kind: 'success', title: 'Position closed', message: '' });
      setPosRefresh((n) => n + 1);
      try { refreshAccounts?.(); } catch (_) {}
    } catch (e) {
      setClosePrompt(null);
      setTradeError(describeTradeError(e?.message, 'Could not close the position'));
    } finally {
      setClosing(false);
    }
  }, [closePrompt, closing, refreshAccounts]);

  // Confirm handler for the no-account prompt. Exits fullscreen first so the
  // Accounts screen / account picker (both rendered at screen level) are
  // actually visible, then routes to the right place.
  const confirmAcctPrompt = useCallback(() => {
    const mode = acctPrompt;
    setAcctPrompt(null);
    setChartFull(false);
    if (mode === 'open') {
      nav.navigate('HomeTab', { screen: 'Accounts', params: { action: 'open' } });
    } else {
      // Let the fullscreen Modal finish closing before opening the picker.
      setTimeout(() => setAcctSheet(true), 250);
    }
  }, [acctPrompt, nav]);

  // Estimated margin to open `lots` at the current price:
  // notional (price × lots × contract_size) ÷ account leverage. For non-USD
  // quote pairs this is an approximation in quote currency terms (hence "≈") —
  // the server computes the authoritative figure at execution.
  const marginReq = useMemo(() => {
    const px = ask ?? bid;
    const lev = Number(activeAccount?.leverage) || 100;
    const cs = Number(instrument?.contract_size) || 100000;
    if (!(px > 0) || !(lots > 0)) return null;
    return (px * lots * cs) / lev;
  }, [ask, bid, lots, activeAccount, instrument]);
  const freeMargin = activeAccount?.free_margin != null
    ? Number(activeAccount.free_margin)
    : (activeAccount?.balance != null ? Number(activeAccount.balance) : null);
  const marginTight = marginReq != null && freeMargin != null && marginReq > freeMargin;

  // Chart fills everything between the header and the trade footer (the old
  // fixed 380px left dead space once the price hero + tab row were removed).
  // ~96px covers the header + chart margins; never below the old 380px minimum.
  const { height: winH } = useWindowDimensions();
  const chartH = Math.max(380, winH - insets.top - footerH - 96);

  const interval = (TIMEFRAMES.find((x) => x.key === tf) || TIMEFRAMES[1]).tv;

  return (
    <Screen edges={['top']} glow={false}>
      {/* Minimal header: back + fullscreen / watchlist only. The
          instrument name / picker row is gone — the symbol was just chosen
          from the Markets list, and the chart legend shows it anyway. The
          Chart/Orders/Info tab row is gone too: positions live in the Trade
          tab, so this screen is purely chart + one-tap trading. */}
      <Header
        pinned={pinned}
        onBack={() => nav.goBack()}
        onPin={togglePin}
        onFullscreen={() => setChartFull(true)}
      />

      {/* Chart rendered DIRECTLY (not inside a ScrollView) — a WebView inside a
          ScrollView renders blank on many Android devices, which is why the
          normal chart didn't show while the fullscreen (Modal, no ScrollView)
          one did. No scroll content here anyway; the chart fills the area. */}
      <View style={{ flex: 1 }}>
        <View style={[styles.chartWrap, { height: chartH }]}>
              {/* Direct in-APK chart (bundled library). Reliable-loading; the
                  persistent-host optimization was reverted after it caused a
                  stuck-spinner regression. Loads per open (a bit slower) but
                  works — fast-load to be revisited carefully. */}
              {/* No key={symbol} → the chart does NOT remount on a symbol change;
                  it switches LIVE via window.SC.setSymbol() (no 26 MB reload =
                  FundedZone-fast). The boot symbol is correct via the URL param,
                  so the earlier 'frozen on first symbol' bug can't recur. Stays
                  mounted across tabs; unmounts only while fullscreen is open so
                  we never run two heavy WebViews at once. */}
              {!chartFull ? (
                <NativeChart symbol={symbol} interval={interval} theme={vantage.isDark ? 'dark' : 'light'} accountId={activeAccount?.id || activeAccount?._id} onDrag={setChartDragging} refreshTick={posRefresh} onClosePosition={(id) => setClosePrompt(id)} />
              ) : null}
            </View>

            <Modal
              visible={chartFull}
              animationType="slide"
              onRequestClose={() => setChartFull(false)}
              supportedOrientations={['portrait', 'landscape']}
            >
              <View style={styles.fsContainer}>
                {/* Safe-area padding so the chart's top toolbar isn't hidden
                    behind the device status bar / notch. */}
                <View style={{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom }}>
                  <NativeChart symbol={symbol} interval={interval} theme={vantage.isDark ? 'dark' : 'light'} accountId={activeAccount?.id || activeAccount?._id} onDrag={setChartDragging} refreshTick={posRefresh} onClosePosition={(id) => setClosePrompt(id)} />
                  {/* Trade bar in fullscreen too: Lots + advanced (limit/stop)
                      opener + the same one-tap Sell/Buy split. Lift it above
                      the keyboard when typing Lots (edge-to-edge breaks the
                      OS auto-resize, so we push it up by the keyboard height —
                      same trick as the normal footer, but via marginBottom
                      since this bar is flex-positioned, not absolute). */}
                  <View style={[styles.fsFooter, kbHeight > 0 && { marginBottom: kbHeight }]}>
                    <View style={styles.fsLotsRow}>
                      <Text style={styles.lotsLabel}>Lots</Text>
                      <LotsField value={lots} onChange={setLots} />
                      <View style={{ flex: 1 }} />
                      <Pressable onPress={() => setAdvOpen(true)} style={styles.advBtn} accessibilityRole="button" accessibilityLabel="Advanced order — limit, stop, TP/SL">
                        <Ionicons name="options-outline" size={14} color={vantage.textSecondary} />
                        <Text style={styles.advBtnTxt}>Limit / Stop</Text>
                      </Pressable>
                    </View>
                    <View style={{ opacity: submitting ? 0.6 : 1 }} pointerEvents={submitting ? 'none' : 'auto'}>
                      <BuySellSplit
                        bid={bid}
                        ask={ask}
                        spreadPoints={spread}
                        side={side}
                        onChange={(s) => { void placeOrder(s); }}
                      />
                    </View>
                  </View>
                </View>
                <Pressable
                  onPress={() => setChartFull(false)}
                  style={[styles.fsClose, { top: insets.top + 10 }]}
                  hitSlop={12}
                  accessibilityLabel="Exit fullscreen"
                >
                  <Ionicons name="close" size={22} color="#fff" />
                </Pressable>
                {/* The advanced-order sheet must be nested INSIDE this modal
                    while the fullscreen chart is open, or it would open
                    underneath it. */}
                <AdvancedOrderSheet
                  visible={advOpen && chartFull}
                  onClose={() => setAdvOpen(false)}
                  account={activeAccount}
                  symbol={symbol}
                  tick={tick}
                  maxH={Math.round(winH * 0.7)}
                />
                {/* No-account prompt — nested here so it shows OVER the
                    fullscreen chart (Alert.alert / screen-level overlays would
                    render underneath this Modal). */}
                {chartFull ? (
                  <>
                    <AccountPrompt
                      mode={acctPrompt}
                      onCancel={() => setAcctPrompt(null)}
                      onConfirm={confirmAcctPrompt}
                    />
                    <MessagePopup data={tradeError} onClose={() => setTradeError(null)} />
                    <MessagePopup data={tradeOk} onClose={() => setTradeOk(null)} />
                    <ClosePositionPrompt visible={!!closePrompt} busy={closing} onCancel={() => setClosePrompt(null)} onConfirm={confirmClosePosition} />
                  </>
                ) : null}
              </View>
            </Modal>
      </View>

      <View
        style={[styles.footer, {
          bottom: kbHeight,
          paddingBottom: kbHeight > 0 ? space.md : BOTTOM_NAV_PILL_HEIGHT + insets.bottom + space.sm,
        }]}
        onLayout={(e) => setFooterH(e.nativeEvent.layout.height)}
      >
        <Pressable onPress={() => setAcctSheet(true)} style={styles.acctRow} accessibilityRole="button" accessibilityLabel="Switch account">
          <Ionicons name="wallet-outline" size={14} color={vantage.textSecondary} />
          <Text style={styles.acctTxt} numberOfLines={1}>
            {activeAccount ? `${activeAccount.is_demo ? 'Demo' : 'Live'} ${activeAccount.account_number || activeAccount.id || ''}` : 'Select account'}
          </Text>
          <Ionicons name="chevron-down" size={14} color={vantage.textMuted} />
        </Pressable>
        <View style={styles.lotsBar}>
          <Text style={styles.lotsLabel}>Lots</Text>
          <LotsField value={lots} onChange={setLots} />
        </View>
        {/* ONE-TAP execution: tapping Sell/Buy places the market order for
            that side immediately (dimmed + inert while a placement is in
            flight). No separate execute button. */}
        <View style={{ opacity: submitting ? 0.6 : 1 }} pointerEvents={submitting ? 'none' : 'auto'}>
          <BuySellSplit
            bid={bid}
            ask={ask}
            spreadPoints={spread}
            side={side}
            onChange={(s) => { void placeOrder(s); }}
          />
        </View>
        {/* Cost of the selected lots — updates live as lots/price change;
            turns red when it exceeds free margin. */}
        <View style={styles.freeMarginRow}>
          <Text style={styles.freeMarginLab}>Margin required:</Text>
          <Text style={[styles.freeMarginVal, marginTight && { color: vantage.down }]}>
            {marginReq != null
              ? `≈ ${marginReq.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${activeAccount?.currency || 'USD'}`
              : '—'}
          </Text>
        </View>
        <View style={styles.freeMarginRow}>
          <Text style={styles.freeMarginLab}>Free Margin:</Text>
          <Text style={styles.freeMarginVal}>
            {freeMargin != null ? `${freeMargin.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${activeAccount.currency || 'USD'}` : '—'}
          </Text>
          <View style={{ flex: 1 }} />
          <Pressable onPress={() => setAdvOpen(true)} style={styles.advBtn} accessibilityRole="button" accessibilityLabel="Advanced order — limit, stop, TP/SL">
            <Ionicons name="options-outline" size={14} color={vantage.textSecondary} />
            <Text style={styles.advBtnTxt}>Limit / Stop</Text>
          </Pressable>
        </View>
      </View>

      <AccountSwitcher
        visible={acctSheet}
        onClose={() => setAcctSheet(false)}
        accounts={accounts}
        selectedId={activeAccount?.id || activeAccount?._id}
        onSelect={selectAccount}
      />

      {/* No-account prompt for the normal (non-fullscreen) chart. The
          fullscreen instance is nested inside the fullscreen Modal above. */}
      {!chartFull ? (
        <>
          <AccountPrompt
            mode={acctPrompt}
            onCancel={() => setAcctPrompt(null)}
            onConfirm={confirmAcctPrompt}
          />
          <MessagePopup data={tradeError} onClose={() => setTradeError(null)} />
          <MessagePopup data={tradeOk} onClose={() => setTradeOk(null)} />
          <ClosePositionPrompt visible={!!closePrompt} busy={closing} onCancel={() => setClosePrompt(null)} onConfirm={confirmClosePosition} />
        </>
      ) : null}

      {/* Advanced order sheet (normal, non-fullscreen instance). */}
      <AdvancedOrderSheet
        visible={advOpen && !chartFull}
        onClose={() => setAdvOpen(false)}
        account={activeAccount}
        symbol={symbol}
        tick={tick}
        maxH={Math.round(winH * 0.7)}
      />
    </Screen>
  );
}

// No-account prompt overlay (custom, NOT Alert.alert — Alert won't render over
// the fullscreen-chart Modal on Android). Rendered both inside the fullscreen
// Modal and at screen level so it shows in either context.
function AccountPrompt({ mode, onCancel, onConfirm }) {
  if (!mode) return null;
  const isOpen = mode === 'open';
  return (
    <View style={promptStyles.overlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
      <View style={promptStyles.card}>
        <View style={promptStyles.iconWrap}>
          <Ionicons name={isOpen ? 'add-circle-outline' : 'wallet-outline'} size={40} color={vantage.accent} />
        </View>
        <Text style={promptStyles.title}>{isOpen ? 'Open your account' : 'Choose your account'}</Text>
        <Text style={promptStyles.sub}>
          {isOpen
            ? 'You need a trading account to place orders. Open one now to start trading.'
            : 'Select a trading account before placing an order.'}
        </Text>
        <Pressable style={promptStyles.primaryBtn} onPress={onConfirm}>
          <Text style={promptStyles.primaryTxt}>{isOpen ? 'Open Account' : 'Choose Account'}</Text>
        </Pressable>
        <Pressable style={promptStyles.cancelBtn} onPress={onCancel} hitSlop={8}>
          <Text style={promptStyles.cancelTxt}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
}

// Confirm popup for closing a position from the chart's [x] button. Custom
// overlay so it also shows OVER the fullscreen chart Modal.
function ClosePositionPrompt({ visible, busy, onCancel, onConfirm }) {
  if (!visible) return null;
  return (
    <View style={promptStyles.overlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={busy ? undefined : onCancel} />
      <View style={promptStyles.card}>
        <View style={[promptStyles.iconWrap, { backgroundColor: vantage.down + '1F', borderColor: vantage.down + '55' }]}>
          <Ionicons name="close-circle-outline" size={40} color={vantage.down} />
        </View>
        <Text style={promptStyles.title}>Close position?</Text>
        <Text style={promptStyles.sub}>This will close the trade at the current market price.</Text>
        <Pressable style={[promptStyles.primaryBtn, { backgroundColor: vantage.down }, busy && { opacity: 0.6 }]} onPress={onConfirm} disabled={busy}>
          <Text style={[promptStyles.primaryTxt, { color: '#fff' }]}>{busy ? 'Closing…' : 'Close position'}</Text>
        </Pressable>
        <Pressable style={promptStyles.cancelBtn} onPress={onCancel} hitSlop={8} disabled={busy}>
          <Text style={promptStyles.cancelTxt}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
}

// Generic single-button popup for trade failures — shows over the fullscreen
// chart too (rendered inside the fullscreen Modal), unlike toasts / AppAlert.
function MessagePopup({ data, onClose }) {
  if (!data) return null;
  const ok = data.kind === 'success';
  const color = ok ? (vantage.up || '#22c55e') : vantage.accent;
  return (
    <View style={promptStyles.overlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={promptStyles.card}>
        <View style={[promptStyles.iconWrap, { backgroundColor: color + '1F', borderColor: color + '55' }]}>
          <Ionicons name={ok ? 'checkmark-circle-outline' : 'alert-circle-outline'} size={40} color={color} />
        </View>
        {data.title ? <Text style={promptStyles.title}>{data.title}</Text> : null}
        {data.message ? <Text style={promptStyles.sub}>{data.message}</Text> : null}
        <Pressable style={promptStyles.primaryBtn} onPress={onClose}>
          <Text style={promptStyles.primaryTxt}>OK</Text>
        </Pressable>
      </View>
    </View>
  );
}

const promptStyles = StyleSheet.create({
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 28, zIndex: 9999,
  },
  card: {
    width: '100%', maxWidth: 360, borderRadius: 20,
    backgroundColor: vantage.bgRaised, borderWidth: StyleSheet.hairlineWidth, borderColor: vantage.border,
    padding: 22, alignItems: 'center',
  },
  iconWrap: {
    width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center',
    backgroundColor: vantage.accent + '1F', borderWidth: 1, borderColor: vantage.accent + '55', marginBottom: 14,
  },
  title: { color: vantage.textPrimary, fontFamily, fontSize: 18, fontWeight: '800' },
  sub: { color: vantage.textMuted, fontFamily, fontSize: 13, textAlign: 'center', marginTop: 6, lineHeight: 18 },
  primaryBtn: {
    width: '100%', backgroundColor: vantage.accent, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', marginTop: 18,
  },
  primaryTxt: { color: '#000', fontFamily, fontSize: 15, fontWeight: '800' },
  cancelBtn: { paddingVertical: 12, marginTop: 4 },
  cancelTxt: { color: vantage.textMuted, fontFamily, fontSize: 14, fontWeight: '600' },
});

// Slide-up sheet hosting the full order ticket — market / LIMIT / STOP order
// types with optional TP/SL and margin preview (the same OrderTicket the old
// Trade tab used, now reachable from the chart screen instead of duplicating
// a second buy/sell UI).
function AdvancedOrderSheet({ visible, onClose, account, symbol, tick, maxH }) {
  return (
    <Sheet visible={visible} onClose={onClose} title={`New order — ${symbol}`}>
      <ScrollView
        style={{ maxHeight: maxH || 520 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <OrderTicket
          accountId={account?.id || account?._id}
          account={account}
          accountSummary={account}
          symbol={symbol}
          tick={tick}
          onPlaced={onClose}
        />
      </ScrollView>
    </Sheet>
  );
}

// Type-only Lots input — no +/- steppers, just tap and type the volume.
function LotsField({ value, onChange }) {
  const [text, setText] = useState('');
  const [editing, setEditing] = useState(false);
  const parse = (t) => {
    const n = Number(String(t).replace(',', '.'));
    return Number.isFinite(n) && n > 0 ? Math.min(1000, Math.max(0.01, n)) : null;
  };
  // Commit on EVERY keystroke, not just blur — tapping Buy/Sell while the
  // keyboard is still open must trade the lots on screen, not the stale value
  // (typing 0.05 then tapping Buy used to place 0.01).
  const handleChange = (t) => {
    setText(t);
    const n = parse(t);
    if (n != null) onChange(n);
  };
  const commit = () => {
    setEditing(false);
    const n = parse(text);
    if (n != null) onChange(n);
  };
  return (
    <TextInput
      style={styles.lotsInput}
      value={editing ? text : Number(value).toFixed(2)}
      onFocus={() => { setEditing(true); setText(Number(value).toFixed(2)); }}
      onChangeText={handleChange}
      onBlur={commit}
      onSubmitEditing={commit}
      keyboardType="decimal-pad"
      returnKeyType="done"
      selectTextOnFocus
      placeholder="0.00"
      placeholderTextColor={vantage.textMuted}
      accessibilityLabel="Lots volume"
    />
  );
}

function Header({ pinned, onBack, onPin, onFullscreen }) {
  return (
    <View style={styles.header}>
      <IconButton icon={<Ionicons name="chevron-back" size={22} color={vantage.textPrimary} />} accessibilityLabel="Back" onPress={onBack} />
      <View style={{ flex: 1 }} />
      <Pressable onPress={onFullscreen} hitSlop={8} accessibilityRole="button" accessibilityLabel="Fullscreen chart" style={styles.hdrIcon}>
        <Ionicons name="expand-outline" size={21} color={vantage.textPrimary} />
      </Pressable>
      <Pressable onPress={onPin} hitSlop={8} accessibilityRole="button" accessibilityLabel={pinned ? 'Unpin' : 'Pin to watchlist'} style={styles.hdrIcon}>
        <Ionicons name={pinned ? 'star' : 'star-outline'} size={22} color={pinned ? vantage.accent : vantage.textPrimary} />
      </Pressable>
    </View>
  );
}

function Cell({ label, value }) {
  return (
    <View style={styles.ohlcCell}>
      <Text style={styles.ohlcLab}>{label}</Text>
      <Text style={styles.ohlcVal}>{value}</Text>
    </View>
  );
}

function PeriodCell({ label, pct }) {
  const has = pct != null && Number.isFinite(pct);
  const positive = has && pct >= 0;
  return (
    <View style={styles.periodCell}>
      <Text style={styles.periodLab}>{label}</Text>
      <Text style={[styles.periodVal, { color: !has ? vantage.textMuted : positive ? vantage.up : vantage.down }]}>
        {has ? `${positive ? '+' : ''}${pct.toFixed(2)}%` : '—'}
      </Text>
    </View>
  );
}

function RangeBar({ range }) {
  if (!range) return null;
  return (
    <View style={styles.rangeWrap}>
      <View style={styles.rangeRow}>
        <Text style={styles.rangeLab}>Low</Text>
        <Text style={styles.rangeLab}>High</Text>
      </View>
      <View style={styles.rangeTrack}>
        <View style={[styles.rangeMarker, { left: `${range.posPct * 100}%` }]}>
          <Ionicons name="caret-down" size={12} color={vantage.textPrimary} />
        </View>
      </View>
      <View style={styles.rangeRow}>
        <Text style={styles.rangeVal}>{fmt(range.low)}</Text>
        <Text style={[styles.rangeLab, { fontSize: sizes.label }]}>1h</Text>
        <Text style={styles.rangeVal}>{fmt(range.high)}</Text>
      </View>
    </View>
  );
}

function InfoRow({ label, value, last }) {
  return (
    <View style={[styles.infoRow, !last && styles.infoBorder]}>
      <Text style={styles.infoLab}>{label}</Text>
      <Text style={styles.infoVal} selectable>{value}</Text>
    </View>
  );
}

function fmt(v) {
  if (v == null || !Number.isFinite(Number(v))) return '—';
  const n = Number(v);
  if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (n >= 1) return n.toFixed(2);
  return n.toFixed(5);
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: space.sm, paddingTop: space.sm, paddingBottom: space.xs,
    gap: space.xs,
  },
  symbolWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  symbolTxt: { color: vantage.textPrimary, fontFamily, fontSize: sizes.h2, fontWeight: weights.heavy },
  hdrIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },

  tabRow: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: vantage.border },
  tabCell: { flex: 1, alignItems: 'center', paddingVertical: space.sm },
  tabLabel: { color: vantage.textMuted, fontFamily, fontSize: sizes.h3 },
  tabUnderline: { height: 2, width: 36, borderRadius: 1, marginTop: space.xs },

  heroRow: { flexDirection: 'row', paddingHorizontal: space.lg, paddingVertical: space.sm, gap: space.md },
  heroPrice: { color: vantage.textPrimary, fontFamily, fontSize: sizes.hero, fontWeight: weights.heavy },
  heroChange: { fontFamily, fontSize: sizes.body, fontWeight: weights.bold, marginTop: 2 },
  heroTime: { color: vantage.textMuted, fontFamily, fontSize: sizes.label, marginTop: 2 },

  ohlcGrid: { width: 160, flexDirection: 'row', flexWrap: 'wrap', alignContent: 'flex-start' },
  ohlcCell: { width: '50%', paddingVertical: 2 },
  ohlcLab: { color: vantage.textMuted, fontFamily, fontSize: sizes.micro },
  ohlcVal: { color: vantage.textPrimary, fontFamily, fontSize: sizes.label, fontWeight: weights.bold },

  tfRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingBottom: space.sm },
  tfCell: { paddingVertical: space.xs },
  tfTxt: { color: vantage.textMuted, fontFamily, fontSize: sizes.body },
  tfMore: { marginLeft: 'auto' },

  chartWrap: { height: 380, marginHorizontal: space.sm, backgroundColor: vantage.bg, borderRadius: radius.md, overflow: 'hidden' },
  chartLoader: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: vantage.bg },
  chart: { flex: 1, backgroundColor: vantage.bg },
  fsBtn: {
    // Bottom-right: clear of TradingView's top-anchored toolbar + indicator
    // dialog close (X) (top-right) and the TradingView logo (bottom-left).
    position: 'absolute', bottom: 10, right: 10,
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: vantage.bgElevated, borderWidth: 1, borderColor: vantage.border,
    alignItems: 'center', justifyContent: 'center',
  },
  fsContainer: { flex: 1, backgroundColor: vantage.bg },
  // Fullscreen-chart bottom trade bar.
  fsFooter: { paddingHorizontal: space.lg, paddingTop: space.sm, gap: space.sm, backgroundColor: vantage.bg },
  fsLotsRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  // "Limit / Stop" advanced-order opener chip.
  advBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: vantage.border, borderRadius: radius.pill,
    paddingHorizontal: space.md, paddingVertical: 5, backgroundColor: vantage.bgRaised,
  },
  advBtnTxt: { color: vantage.textSecondary, fontFamily, fontSize: sizes.label, fontWeight: weights.semibold },
  fsClose: {
    position: 'absolute', right: 14,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center',
  },

  acctRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs, alignSelf: 'flex-start', backgroundColor: vantage.bgRaised, borderWidth: 1, borderColor: vantage.border, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 6, marginBottom: space.xs, maxWidth: '70%' },
  acctTxt: { color: vantage.textPrimary, fontFamily, fontSize: sizes.label, fontWeight: weights.semibold, flexShrink: 1 },

  periodRow: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: vantage.border, marginTop: space.md },
  periodCell: { flex: 1, alignItems: 'center', paddingVertical: space.md, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: vantage.border },
  periodLab: { color: vantage.textMuted, fontFamily, fontSize: sizes.label },
  periodVal: { fontFamily, fontSize: sizes.body, fontWeight: weights.bold, marginTop: 2 },

  rangeWrap: { paddingHorizontal: space.lg, paddingVertical: space.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: vantage.border },
  rangeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rangeLab: { color: vantage.textMuted, fontFamily, fontSize: sizes.micro },
  rangeVal: { color: vantage.textPrimary, fontFamily, fontSize: sizes.label, fontWeight: weights.bold },
  rangeTrack: { height: 4, backgroundColor: vantage.bgRaised, borderRadius: 2, marginVertical: space.sm, position: 'relative' },
  rangeMarker: { position: 'absolute', top: -10, marginLeft: -6, alignItems: 'center' },

  empty: { color: vantage.textMuted, fontFamily, fontSize: sizes.body, textAlign: 'center', padding: space.lg },
  ordTitle: { color: vantage.textSecondary, fontFamily, fontSize: sizes.label, fontWeight: weights.bold, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: space.sm },
  ordRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: vantage.border },
  ordSide: { fontFamily, fontSize: sizes.body, fontWeight: weights.bold },
  ordPl: { fontFamily, fontSize: sizes.body, fontWeight: weights.heavy },

  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: space.sm },
  infoBorder: { borderBottomColor: vantage.border, borderBottomWidth: StyleSheet.hairlineWidth },
  infoLab: { color: vantage.textMuted, fontFamily, fontSize: sizes.body },
  infoVal: { color: vantage.textPrimary, fontFamily, fontSize: sizes.body, fontWeight: weights.bold },

  footer: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: vantage.bg,
    paddingHorizontal: space.lg, paddingTop: space.xs,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: vantage.border,
    gap: space.xs,
  },
  lotsBar: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  lotsLabel: { color: vantage.textSecondary, fontFamily, fontSize: sizes.label, width: 50 },
  lotsInput: {
    flex: 1,
    height: 42,
    backgroundColor: vantage.bgRaised,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: vantage.border,
    paddingHorizontal: space.md,
    color: vantage.textPrimary,
    fontFamily,
    fontSize: sizes.h3,
    fontWeight: weights.bold,
    textAlign: 'center',
  },
  freeMarginRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  freeMarginLab: { color: vantage.textMuted, fontFamily, fontSize: sizes.label },
  freeMarginVal: { color: vantage.textPrimary, fontFamily, fontSize: sizes.label, fontWeight: weights.bold },
});
