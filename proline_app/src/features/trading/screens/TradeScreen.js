import React, { useEffect, useState, useCallback, useRef } from 'react';
import { ScrollView, RefreshControl, View, StyleSheet } from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';

import { Screen, SegmentedTabs } from '../../../components/vantage';
import { vantage, space } from '../../../theme/vantageTheme';
import ApiService from '../../../services/api/ApiService';
import webSocketService from '../../../services/websocket/WebSocketService';
import * as SecureStore from 'expo-secure-store';
import { BOTTOM_NAV_PILL_HEIGHT } from '../../../components/vantage/BottomNavPill';

import { useAccount } from '../../../app/providers/AccountContext';
import TradeCFDs from './TradeCFDs';
import TradeCopy from './TradeCopy';

const DEFAULT_SYMBOL = 'EURUSD';

export default function TradeScreen() {
  const nav = useNavigation();
  const route = useRoute();
  const [view, setView] = useState('cfds');

  // Global account selection — synced with Home and instrument-detail screens.
  const { accounts, selectedAccount, selectAccount, refreshAccounts } = useAccount();
  const [accountSummary, setAccountSummary] = useState(null);
  const [symbol, setSymbol] = useState(route.params?.symbol || DEFAULT_SYMBOL);
  const [tick, setTick] = useState(null);
  const [positions, setPositions] = useState([]);
  const [orders, setOrders] = useState([]);
  const [history, setHistory] = useState([]);
  const [historyTotal, setHistoryTotal] = useState(null); // server-reported total closed trades
  const historyPageRef = useRef(1);                       // last fetched server page
  const historyLoadingMoreRef = useRef(false);            // in-flight guard for load-more
  const prevPosCountRef = useRef(0);   // detect when an open position closes
  const [refreshing, setRefreshing] = useState(false);

  const accountId = selectedAccount?.id || selectedAccount?._id;

  // Account switch: drop the previous account's data immediately — the fetch
  // below repopulates. Without this, account A's positions/history stay on
  // screen under account B until the network round-trip completes.
  useEffect(() => {
    setPositions([]);
    setOrders([]);
    setHistory([]);
    setHistoryTotal(null);
    historyPageRef.current = 1;
    setAccountSummary(null);
    prevPosCountRef.current = 0;
  }, [accountId]);

  useEffect(() => {
    if (route.params?.symbol) setSymbol(String(route.params.symbol).toUpperCase());
  }, [route.params?.symbol]);

  // Remember the active symbol so re-entering Trade restores it.
  useEffect(() => { if (symbol) SecureStore.setItemAsync('lastSymbol', symbol).catch(() => {}); }, [symbol]);

  // On entering the Trade tab, default to the last instrument the user opened
  // (in Markets or here) — unless this navigation passed an explicit symbol.
  useFocusEffect(useCallback(() => {
    if (route.params?.symbol) return;
    let cancelled = false;
    SecureStore.getItemAsync('lastSymbol').then((s) => {
      if (!cancelled && s) setSymbol(String(s).toUpperCase());
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [route.params?.symbol]));

  // Honor an explicit sub-tab request (e.g. "Go to Trade" from a symbol always
  // lands on CFDs, even if the Trade tab was last left on Copy).
  useEffect(() => {
    const t = route.params?.tradeView;
    if (t === 'cfds' || t === 'copy') setView(t);
  }, [route.params?.tradeView]);

  // Pre-select the account passed in from elsewhere (e.g. Accounts screen).
  useEffect(() => {
    const wanted = route.params?.selectedAccountId;
    if (!wanted || !accounts.length) return;
    const match = accounts.find((a) => String(a.id || a._id) === String(wanted));
    if (match) selectAccount(match);
  }, [accounts, route.params?.selectedAccountId, selectAccount]);

  const loadAccounts = refreshAccounts;

  const refreshAccountData = useCallback(async () => {
    // Skip account-specific calls for an inactive account (avoids spammy errors).
    if (!accountId || selectedAccount?.is_active === false) return;
    const [summary, pos, ords, hist] = await Promise.allSettled([
      ApiService.getAccountSummary(accountId),
      ApiService.getPositions(accountId, 'open'),
      ApiService.getOrders(accountId, 'pending'),
      ApiService.getTradeHistory(accountId, 1, 50),
    ]);
    if (summary.status === 'fulfilled') setAccountSummary(summary.value);
    if (pos.status === 'fulfilled') {
      const list = Array.isArray(pos.value) ? pos.value : (Array.isArray(pos.value?.items) ? pos.value.items : []);
      prevPosCountRef.current = list.length;
      setPositions(list);
    }
    if (ords.status === 'fulfilled') {
      const list = Array.isArray(ords.value) ? ords.value : (Array.isArray(ords.value?.items) ? ords.value.items : []);
      setOrders(list);
    }
    if (hist.status === 'fulfilled') {
      const list = Array.isArray(hist.value) ? hist.value : (Array.isArray(hist.value?.items) ? hist.value.items : []);
      // History = closed trades only. The endpoint pages (50/page) — keep the
      // server's TOTAL so counts show the real number (a 51st trade must read
      // 51, not the page size), and reset paging on every full refresh.
      setHistory(list.filter((t) => t.close_time || t.close_price));
      setHistoryTotal(Number.isFinite(Number(hist.value?.total)) ? Number(hist.value.total) : null);
      historyPageRef.current = 1;
    }
  }, [accountId, selectedAccount]);

  // Fetch the next server page of closed trades and append (deduped by id).
  // Called by the history list when the user has revealed everything fetched
  // so far and the server reports more.
  const loadMoreHistory = useCallback(async () => {
    if (!accountId || historyLoadingMoreRef.current) return;
    historyLoadingMoreRef.current = true;
    try {
      const next = historyPageRef.current + 1;
      const res = await ApiService.getTradeHistory(accountId, next, 50);
      const list = Array.isArray(res) ? res : (Array.isArray(res?.items) ? res.items : []);
      if (list.length) {
        historyPageRef.current = next;
        setHistory((prev) => {
          const seen = new Set(prev.map((t) => String(t.id || t._id)));
          const fresh = list.filter((t) => (t.close_time || t.close_price) && !seen.has(String(t.id || t._id)));
          return [...prev, ...fresh];
        });
      }
      if (Number.isFinite(Number(res?.total))) setHistoryTotal(Number(res.total));
    } catch (_) {
      /* keep what we have; user can retry via Show more */
    } finally {
      historyLoadingMoreRef.current = false;
    }
  }, [accountId]);

  const refreshTick = useCallback(async () => {
    if (!symbol) return;
    try {
      const res = await ApiService.getAllPrices();
      const list = Array.isArray(res) ? res : (Array.isArray(res?.items) ? res.items : []);
      const t = list.find((p) => String(p.symbol || p.ticker || '').toUpperCase() === symbol.toUpperCase());
      if (t) setTick(t);
    } catch (_) {}
  }, [symbol]);

  // Light live refresh — account summary + open positions — so P&L / margin
  // keep moving without re-fetching orders/history every tick.
  const refreshLive = useCallback(async () => {
    if (!accountId || selectedAccount?.is_active === false) return;
    const [summary, pos] = await Promise.allSettled([
      ApiService.getAccountSummary(accountId),
      ApiService.getPositions(accountId, 'open'),
    ]);
    if (summary.status === 'fulfilled') setAccountSummary(summary.value);
    if (pos.status === 'fulfilled') {
      const list = Array.isArray(pos.value) ? pos.value : (Array.isArray(pos.value?.items) ? pos.value.items : []);
      // A drop in open positions means one closed (e.g. SL/TP hit) — pull
      // orders + history right away so the closed trade shows immediately
      // instead of waiting for the next focus/full refresh.
      if (list.length < prevPosCountRef.current) refreshAccountData();
      prevPosCountRef.current = list.length;
      setPositions(list);
    }
  }, [accountId, selectedAccount, refreshAccountData]);

  useEffect(() => { loadAccounts(); }, [loadAccounts]);
  useEffect(() => { refreshAccountData(); }, [refreshAccountData]);
  useEffect(() => { refreshTick(); }, [refreshTick]);

  useFocusEffect(useCallback(() => {
    refreshAccountData();
    refreshTick();
  }, [refreshAccountData, refreshTick]));

  // Poll while focused: price AND P&L / positions every 1s — matching the web
  // terminal's ~1.5s poll so both clients read the same server P&L within a
  // second of each other. Works even if the live WebSocket stalls.
  useFocusEffect(useCallback(() => {
    let n = 0;
    const id = setInterval(() => {
      refreshTick();
      refreshLive();
      if (n % 6 === 5) refreshAccountData();   // periodic full refresh (orders + closed history)
      n += 1;
    }, 1000);
    return () => clearInterval(id);
  }, [refreshTick, refreshLive, refreshAccountData]));

  useEffect(() => {
    if (typeof webSocketService?.onPriceUpdate !== 'function') return;
    const unsubscribe = webSocketService.onPriceUpdate((msg) => {
      if (!msg) return;
      const sym = String(msg.symbol || msg.s || '').toUpperCase();
      if (sym !== symbol.toUpperCase()) return;
      setTick((prev) => ({
        ...(prev || {}),
        symbol: sym,
        bid: msg.bid != null ? Number(msg.bid) : prev?.bid,
        ask: msg.ask != null ? Number(msg.ask) : prev?.ask,
      }));
    });
    webSocketService.connectPriceStream?.();
    return () => { if (typeof unsubscribe === 'function') unsubscribe(); };
  }, [symbol]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.allSettled([loadAccounts(), refreshAccountData(), refreshTick()]);
    setRefreshing(false);
  }, [loadAccounts, refreshAccountData, refreshTick]);

  return (
    <Screen edges={['top']}>
      <View style={styles.headerWrap}>
        <SegmentedTabs
          value={view}
          onChange={setView}
          options={[
            { value: 'cfds', label: 'CFDs' },
            { value: 'copy', label: 'Copy' },
          ]}
        />
      </View>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: BOTTOM_NAV_PILL_HEIGHT + space.huge }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={vantage.accent} colors={[vantage.accent]} />
        }
        keyboardShouldPersistTaps="handled"
      >
        {view === 'cfds' ? (
          <TradeCFDs
            accounts={accounts}
            selectedAccount={selectedAccount}
            onSelectAccount={selectAccount}
            symbol={symbol}
            onSelectSymbol={setSymbol}
            tick={tick}
            accountSummary={accountSummary}
            positions={positions}
            orders={orders}
            history={history}
            historyTotal={historyTotal}
            onLoadMoreHistory={loadMoreHistory}
            onChange={refreshAccountData}
          />
        ) : (
          <TradeCopy />
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerWrap: { paddingHorizontal: space.lg, paddingTop: space.sm },
  scroll: {},
});
