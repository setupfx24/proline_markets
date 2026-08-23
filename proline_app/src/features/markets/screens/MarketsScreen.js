import React, { useEffect, useState, useCallback } from 'react';
import { ScrollView, RefreshControl, StyleSheet } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';

import { Screen } from '../../../components/vantage';
import { vantage, space } from '../../../theme/vantageTheme';
import ApiService from '../../../services/api/ApiService';
import webSocketService from '../../../services/websocket/WebSocketService';
import { getInstruments } from '../../../utils/instrumentsCache';
import { getWatchlist } from '../watchlist/watchlistStorage';
import { getSparkData } from '../../../utils/sparklineCache';
import { BOTTOM_NAV_PILL_HEIGHT } from '../../../components/vantage/BottomNavPill';

import MarketsHeader from '../components/MarketsHeader';
import MarketsExplore from '../components/MarketsExplore';
import MarketsWatchlist from '../watchlist/MarketsWatchlist';
import SymbolPicker from '../../trading/components/SymbolPicker';

export default function MarketsScreen() {
  const nav = useNavigation();
  const [view, setView] = useState('watchlist');
  const [searchOpen, setSearchOpen] = useState(false);
  const [segment, setSegment] = useState('overview');
  const [moversDirection, setMoversDirection] = useState('up');

  const [refreshing, setRefreshing] = useState(false);
  const [instruments, setInstruments] = useState([]);
  const [pinnedSymbols, setPinnedSymbols] = useState([]);
  const [pricesBySymbol, setPricesBySymbol] = useState({});
  const [sparksBySymbol, setSparksBySymbol] = useState({});

  const fetchAll = useCallback(async () => {
    const [list, pinned, prices] = await Promise.allSettled([
      getInstruments(),
      getWatchlist(),
      ApiService.getAllPrices().then((res) => Array.isArray(res) ? res : (Array.isArray(res?.items) ? res.items : [])),
    ]);

    if (list.status === 'fulfilled') setInstruments(list.value || []);
    if (pinned.status === 'fulfilled') setPinnedSymbols(pinned.value || []);
    if (prices.status === 'fulfilled') {
      const map = {};
      for (const p of (prices.value || [])) {
        const sym = String(p.symbol || p.ticker || '').toUpperCase();
        if (sym) map[sym] = p;
      }
      setPricesBySymbol(map);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    (async () => {
      const list = await getWatchlist();
      if (!cancelled) setPinnedSymbols(list);
    })();
    return () => { cancelled = true; };
  }, []));

  useEffect(() => {
    if (typeof webSocketService?.onPriceUpdate !== 'function') return;
    const unsubscribe = webSocketService.onPriceUpdate((msg) => {
      if (!msg) return;
      const sym = String(msg.symbol || msg.s || '').toUpperCase();
      if (!sym) return;
      setPricesBySymbol((prev) => {
        const cur = prev[sym] || {};
        const bid = msg.bid != null ? Number(msg.bid) : cur.bid;
        const ask = msg.ask != null ? Number(msg.ask) : cur.ask;
        return { ...prev, [sym]: { ...cur, symbol: sym, bid, ask } };
      });
    });
    webSocketService.connectPriceStream?.();
    return () => { if (typeof unsubscribe === 'function') unsubscribe(); };
  }, []);

  // Live prices via polling (every 2s while focused) — reliable real-time
  // movement even when the price WebSocket isn't delivering.
  const refreshPrices = useCallback(async () => {
    try {
      const res = await ApiService.getAllPrices();
      const arr = Array.isArray(res) ? res : (Array.isArray(res?.items) ? res.items : []);
      const map = {};
      for (const p of arr) {
        const sym = String(p.symbol || p.ticker || '').toUpperCase();
        if (sym) map[sym] = p;
      }
      setPricesBySymbol(map);
    } catch (_) {}
  }, []);
  useFocusEffect(useCallback(() => {
    // REST poll is the WebSocket FALLBACK, not the price driver — 2s keeps
    // the full-universe fetch cheap instead of hammering it at 500ms.
    const id = setInterval(refreshPrices, 2000);
    return () => clearInterval(id);
  }, [refreshPrices]));

  useEffect(() => {
    let cancelled = false;
    const visibleSet = new Set();
    pinnedSymbols.forEach((s) => visibleSet.add(String(s).toUpperCase()));
    instruments.slice(0, 30).forEach((i) => visibleSet.add(String(i.symbol || '').toUpperCase()));

    (async () => {
      for (const sym of visibleSet) {
        if (!sym || sparksBySymbol[sym]) continue;
        const data = await getSparkData(sym);
        if (cancelled) return;
        setSparksBySymbol((prev) => ({ ...prev, [sym]: data }));
      }
    })();

    return () => { cancelled = true; };
  }, [pinnedSymbols, instruments]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  }, [fetchAll]);

  const handleSelectInstrument = useCallback((sym) => {
    nav.navigate('InstrumentDetail', { symbol: sym });
  }, [nav]);

  const handleEdit = useCallback(() => nav.navigate('WatchlistEdit'), [nav]);

  return (
    <Screen edges={['top']}>
      <MarketsHeader
        view={view}
        onChangeView={setView}
        onSearch={() => setSearchOpen(true)}
      />
      <SymbolPicker
        visible={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelect={(sym) => nav.navigate('InstrumentDetail', { symbol: sym })}
      />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: BOTTOM_NAV_PILL_HEIGHT + space.huge }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={vantage.accent} colors={[vantage.accent]} />
        }
      >
        {view === 'explore' ? (
          <MarketsExplore
            segment={segment}
            onChangeSegment={setSegment}
            instruments={instruments}
            pricesBySymbol={pricesBySymbol}
            sparksBySymbol={sparksBySymbol}
            moversDirection={moversDirection}
            onChangeMoversDirection={() => setMoversDirection((d) => d === 'up' ? 'down' : 'up')}
            onPressInstrument={handleSelectInstrument}
          />
        ) : (
          <MarketsWatchlist
            pinnedSymbols={pinnedSymbols}
            instruments={instruments}
            pricesBySymbol={pricesBySymbol}
            sparksBySymbol={sparksBySymbol}
            onPressInstrument={handleSelectInstrument}
            onEdit={handleEdit}
            onAdd={handleEdit}
          />
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {},
});
