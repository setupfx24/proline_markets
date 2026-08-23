# Plan C — Vantage Redesign: Markets Screen (Phase 3)

> Subagent-driven execution. Steps use `- [ ]`.

**Goal:** Replace the Markets placeholder with the real Vantage-style screen — Watchlist | Explore toggle, category filter, Spotlight, Market Movers, Essentials list — wired to live ProlineMarket data, plus InstrumentDetail and WatchlistEdit screens.

**Architecture:** `MarketsScreen` is the orchestrator with a `SegmentedTabs` toggle between two sub-views: `MarketsExplore` (Spotlight + Movers + Essentials, filtered by segment) and `MarketsWatchlist` (pinned symbols + filter chips + Edit/Add). Both sub-views reuse `<InstrumentRow>` and the `pricesBySymbol` + `sparkData` pattern from Plan B. Two pushed screens: `InstrumentDetailScreen` (symbol info + Trade CTA) and `WatchlistEditScreen` (multi-select instrument list).

**Working directory:** `/Users/tarundewangan/Downloads/Projects/ProlineMarket/ProlineMarket_apk`

---

### File structure

**New:**
- `src/utils/instrumentsCache.js` — fetch + cache `/instruments` list (5 min TTL)
- `src/utils/marketMovers.js` — pure functions: `topRisers(prices, n)`, `topFallers(prices, n)`, `bySegment(instruments, seg)`
- `src/screens/markets/MarketsHeader.js`
- `src/screens/markets/MarketsExplore.js`
- `src/screens/markets/MarketsWatchlist.js`
- `src/screens/markets/InstrumentDetailScreen.js`
- `src/screens/markets/WatchlistEditScreen.js`

**Modified:**
- `src/screens/MarketsScreen.js` — orchestrator
- `src/navigation/MarketsStack.js` — register `InstrumentDetail` + `WatchlistEdit`

**No new third-party deps.** Reuses everything from Plans A + B.

---

### Task C1: Helpers (instruments cache + market movers)

**Files:**
- Create: `src/utils/instrumentsCache.js`
- Create: `src/utils/marketMovers.js`

#### `src/utils/instrumentsCache.js`

```js
import ApiService from '../services/ApiService';

const TTL_MS = 5 * 60_000;
let cache = null;
let inflight = null;

export async function getInstruments() {
  const now = Date.now();
  if (cache && (now - cache.ts) < TTL_MS) return cache.list;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const res = await ApiService.getInstruments();
      const list = Array.isArray(res) ? res : (Array.isArray(res?.items) ? res.items : []);
      cache = { ts: Date.now(), list };
      return list;
    } catch (_) {
      if (cache) return cache.list;
      return [];
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export function clearInstrumentsCache() {
  cache = null;
}
```

#### `src/utils/marketMovers.js`

```js
function pctOf(p) {
  const v = p?.change_pct ?? p?.changePct ?? p?.change_percent ?? null;
  return v == null ? null : Number(v);
}

export function topRisers(pricesMap, n = 5) {
  return Object.values(pricesMap || {})
    .filter((p) => pctOf(p) != null && pctOf(p) > 0)
    .sort((a, b) => pctOf(b) - pctOf(a))
    .slice(0, n);
}

export function topFallers(pricesMap, n = 5) {
  return Object.values(pricesMap || {})
    .filter((p) => pctOf(p) != null && pctOf(p) < 0)
    .sort((a, b) => pctOf(a) - pctOf(b))
    .slice(0, n);
}

const SEGMENT_ALIASES = {
  forex:     ['forex', 'fx', 'currency', 'currencies'],
  crypto:    ['crypto', 'cryptocurrency', 'coin', 'coins'],
  indices:   ['index', 'indices', 'cash index', 'idx'],
  commodities:['commodity', 'commodities', 'metal', 'metals'],
  metals:    ['metal', 'metals', 'commodity', 'commodities'],
  shares:    ['stock', 'stocks', 'share', 'shares', 'equity', 'equities'],
};

export function bySegment(instruments, segmentKey) {
  if (!segmentKey || segmentKey === 'overview') return instruments;
  const aliases = SEGMENT_ALIASES[segmentKey] || [segmentKey];
  return (instruments || []).filter((i) => {
    const seg = String(i?.segment || i?.category || i?.type || '').toLowerCase();
    return aliases.some((a) => seg.includes(a));
  });
}

export const MARQUEE_SPOTLIGHT = ['XAUUSD', 'NAS100', 'BTCUSD'];
```

**Smoke verification:** files exist; no syntax errors.

---

### Task C2: MarketsHeader

**Files:**
- Create: `src/screens/markets/MarketsHeader.js`

```js
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { SegmentedTabs, IconButton } from '../../components/vantage';
import { vantage, space } from '../../theme/vantageTheme';

export default function MarketsHeader({ view, onChangeView, onSearch }) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <SegmentedTabs
          value={view}
          onChange={onChangeView}
          options={[
            { value: 'watchlist', label: 'Watchlist' },
            { value: 'explore',   label: 'Explore' },
          ]}
        />
      </View>
      <IconButton
        icon={<Ionicons name="search" size={20} color={vantage.textPrimary} />}
        accessibilityLabel="Search"
        onPress={onSearch}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.xs,
  },
});
```

---

### Task C3: MarketsExplore (Spotlight + Movers + Essentials)

**Files:**
- Create: `src/screens/markets/MarketsExplore.js`

```js
import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import {
  Card,
  CategoryTabs,
  QuickActionTile,
  SpotlightCard,
  MoversBars,
  InstrumentRow,
} from '../../components/vantage';
import { vantage, space, sizes, weights, fontFamily } from '../../theme/vantageTheme';
import { topRisers, topFallers, bySegment, MARQUEE_SPOTLIGHT } from '../../utils/marketMovers';
import { getSparkData } from '../../utils/sparklineCache';

const SEGMENT_OPTIONS = [
  { value: 'overview',    label: 'Overview' },
  { value: 'indices',     label: 'Indices' },
  { value: 'forex',       label: 'Forex' },
  { value: 'crypto',      label: 'Crypto' },
  { value: 'metals',      label: 'Metals' },
  { value: 'shares',      label: 'Shares' },
];

export default function MarketsExplore({
  segment,
  onChangeSegment,
  instruments,
  pricesBySymbol,
  sparksBySymbol,
  moversDirection,
  onChangeMoversDirection,
  onPressInstrument,
}) {
  const nav = useNavigation();

  const spotlightItems = useMemo(() => {
    return MARQUEE_SPOTLIGHT.map((sym) => {
      const p = pricesBySymbol[sym] || {};
      const i = instruments.find((x) => String(x.symbol || '').toUpperCase() === sym);
      return {
        symbol: sym,
        subtitle: i?.display_name || i?.name || sym,
        price: p.bid != null ? Number(p.bid) : (p.price != null ? Number(p.price) : 0),
        changePct: p.change_pct != null ? Number(p.change_pct) : (p.changePct != null ? Number(p.changePct) : 0),
      };
    });
  }, [pricesBySymbol, instruments]);

  const movers = useMemo(() => {
    const fn = moversDirection === 'down' ? topFallers : topRisers;
    return fn(pricesBySymbol, 5).map((p) => ({
      symbol: String(p.symbol || '').toUpperCase(),
      changePct: Number(p.change_pct ?? p.changePct ?? 0),
    }));
  }, [pricesBySymbol, moversDirection]);

  const essentials = useMemo(() => {
    return bySegment(instruments, segment).slice(0, 20);
  }, [instruments, segment]);

  return (
    <View>
      <View style={styles.quickRow}>
        <QuickActionTile
          icon={<Ionicons name="calendar-outline" size={24} color={vantage.textPrimary} />}
          label="Calendar"
          onPress={() => nav.navigate('EconomicCalendar')}
        />
        <QuickActionTile
          icon={<Ionicons name="calculator-outline" size={24} color={vantage.textPrimary} />}
          label="Risk Calc"
          onPress={() => nav.navigate('RiskCalculator')}
        />
      </View>

      <CategoryTabs
        value={segment}
        onChange={onChangeSegment}
        options={SEGMENT_OPTIONS}
      />

      <View style={styles.section}>
        <SpotlightCard brandLabel="PM" items={spotlightItems} />
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Market Movers</Text>
          <Pressable onPress={onChangeMoversDirection} hitSlop={8} accessibilityRole="button">
            <Text style={styles.sectionAction}>{moversDirection === 'up' ? 'Top risers' : 'Top fallers'} ⇄</Text>
          </Pressable>
        </View>
        <Card>
          {movers.length === 0 ? (
            <Text style={styles.empty}>No movers yet.</Text>
          ) : (
            <MoversBars items={movers} direction={moversDirection} />
          )}
        </Card>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Essentials</Text>
          <Pressable onPress={() => onChangeSegment('overview')} hitSlop={8} accessibilityRole="button">
            <Ionicons name="chevron-forward" size={20} color={vantage.textMuted} />
          </Pressable>
        </View>
        {essentials.length === 0 ? (
          <Text style={styles.empty}>No instruments in this segment.</Text>
        ) : essentials.map((i) => {
          const sym = String(i.symbol || '').toUpperCase();
          const p = pricesBySymbol[sym] || {};
          return (
            <InstrumentRow
              key={sym}
              symbol={sym}
              name={i.display_name || i.name || sym}
              subtitle={i.description || undefined}
              price={p.bid != null ? Number(p.bid) : (p.price != null ? Number(p.price) : null)}
              changePct={p.change_pct != null ? Number(p.change_pct) : (p.changePct != null ? Number(p.changePct) : null)}
              sparkData={sparksBySymbol[sym] || []}
              onPress={() => onPressInstrument(sym)}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  quickRow: { flexDirection: 'row', paddingHorizontal: space.lg, paddingVertical: space.md, gap: space.md },
  section: { paddingHorizontal: space.lg, paddingVertical: space.sm },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: space.sm },
  sectionTitle: { color: vantage.textPrimary, fontFamily, fontSize: sizes.h2, fontWeight: weights.heavy },
  sectionAction: { color: vantage.textSecondary, fontFamily, fontSize: sizes.label, fontWeight: weights.semibold },
  empty: { color: vantage.textMuted, fontFamily, fontSize: sizes.label, padding: space.md, textAlign: 'center' },
});
```

---

### Task C4: MarketsWatchlist sub-view

**Files:**
- Create: `src/screens/markets/MarketsWatchlist.js`

```js
import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { InstrumentRow, CategoryTabs } from '../../components/vantage';
import { vantage, space, sizes, weights, fontFamily } from '../../theme/vantageTheme';
import { bySegment } from '../../utils/marketMovers';

const FILTER_OPTIONS = [
  { value: 'all',     label: 'All' },
  { value: 'indices', label: 'Indices' },
  { value: 'crypto',  label: 'Crypto' },
  { value: 'metals',  label: 'Metals' },
];

export default function MarketsWatchlist({
  pinnedSymbols = [],
  instruments = [],
  pricesBySymbol = {},
  sparksBySymbol = {},
  onPressInstrument,
  onEdit,
  onAdd,
}) {
  const nav = useNavigation();
  const [filter, setFilter] = useState('all');

  const visible = useMemo(() => {
    if (filter === 'all') return pinnedSymbols;
    const allowed = new Set(
      bySegment(instruments, filter).map((i) => String(i.symbol || '').toUpperCase())
    );
    return pinnedSymbols.filter((s) => allowed.has(String(s).toUpperCase()));
  }, [filter, pinnedSymbols, instruments]);

  return (
    <View>
      <View style={styles.filterRow}>
        <View style={{ flex: 1 }}>
          <CategoryTabs value={filter} onChange={setFilter} options={FILTER_OPTIONS} />
        </View>
        <Pressable onPress={onEdit || (() => {})} hitSlop={8} accessibilityRole="button" accessibilityLabel="Edit watchlist filters">
          <Ionicons name="options-outline" size={22} color={vantage.textMuted} />
        </Pressable>
      </View>

      {pinnedSymbols.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="bookmark-outline" size={48} color={vantage.textMuted} />
          <Text style={styles.emptyTitle}>No pinned instruments</Text>
          <Text style={styles.emptySub}>Tap + Add to pin symbols here.</Text>
        </View>
      ) : visible.length === 0 ? (
        <Text style={styles.emptyInline}>No pinned instruments in this category.</Text>
      ) : (
        visible.map((sym) => {
          const upper = String(sym).toUpperCase();
          const p = pricesBySymbol[upper] || pricesBySymbol[sym] || {};
          const inst = instruments.find((x) => String(x.symbol || '').toUpperCase() === upper);
          return (
            <InstrumentRow
              key={sym}
              symbol={upper}
              name={inst?.display_name || inst?.name || upper}
              subtitle={inst?.description || undefined}
              price={p.bid != null ? Number(p.bid) : (p.price != null ? Number(p.price) : null)}
              changePct={p.change_pct != null ? Number(p.change_pct) : (p.changePct != null ? Number(p.changePct) : null)}
              sparkData={sparksBySymbol[upper] || []}
              onPress={() => onPressInstrument(upper)}
            />
          );
        })
      )}

      <View style={styles.actionsRow}>
        <Pressable onPress={onEdit || (() => nav.navigate('WatchlistEdit'))} style={styles.actionBtn} accessibilityRole="button" accessibilityLabel="Edit watchlist">
          <Ionicons name="create-outline" size={18} color={vantage.textPrimary} />
          <Text style={styles.actionTxt}>Edit</Text>
        </Pressable>
        <Pressable onPress={onAdd || (() => nav.navigate('WatchlistEdit'))} style={styles.actionBtn} accessibilityRole="button" accessibilityLabel="Add to watchlist">
          <Ionicons name="add" size={20} color={vantage.textPrimary} />
          <Text style={styles.actionTxt}>Add</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  filterRow: { flexDirection: 'row', alignItems: 'center', paddingRight: space.lg, gap: space.sm },
  emptyWrap: { alignItems: 'center', paddingVertical: space.huge, paddingHorizontal: space.xl, gap: space.sm },
  emptyTitle: { color: vantage.textPrimary, fontFamily, fontSize: sizes.h3, fontWeight: weights.bold },
  emptySub: { color: vantage.textMuted, fontFamily, fontSize: sizes.body },
  emptyInline: { color: vantage.textMuted, fontFamily, fontSize: sizes.body, padding: space.lg, textAlign: 'center' },
  actionsRow: { flexDirection: 'row', justifyContent: 'center', gap: space.xxl, paddingVertical: space.lg },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: space.lg, paddingVertical: space.sm },
  actionTxt: { color: vantage.textPrimary, fontFamily, fontSize: sizes.body, fontWeight: weights.semibold },
});
```

---

### Task C5: MarketsScreen orchestrator (full rewrite)

**Files:**
- Modify: `src/screens/MarketsScreen.js`

Manages: view toggle, segment, movers direction, instruments fetch, prices fetch, watchlist sync, WS subscription, pull-to-refresh.

```js
import React, { useEffect, useState, useCallback } from 'react';
import { ScrollView, RefreshControl, StyleSheet } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';

import { Screen } from '../components/vantage';
import { vantage, space } from '../theme/vantageTheme';
import ApiService from '../services/ApiService';
import webSocketService from '../services/WebSocketService';
import { getInstruments } from '../utils/instrumentsCache';
import { getWatchlist } from '../utils/watchlistStorage';
import { getSparkData } from '../utils/sparklineCache';
import { BOTTOM_NAV_PILL_HEIGHT } from '../components/vantage/BottomNavPill';

import MarketsHeader from './markets/MarketsHeader';
import MarketsExplore from './markets/MarketsExplore';
import MarketsWatchlist from './markets/MarketsWatchlist';

export default function MarketsScreen() {
  const nav = useNavigation();
  const [view, setView] = useState('watchlist');
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

  // Refresh pinned list on every focus (user may have added from elsewhere).
  useFocusEffect(useCallback(() => {
    let cancelled = false;
    (async () => {
      const list = await getWatchlist();
      if (!cancelled) setPinnedSymbols(list);
    })();
    return () => { cancelled = true; };
  }, []));

  // Live prices via WS.
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

  // Lazy-load sparklines for whatever symbols are currently visible.
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
        onSearch={() => nav.navigate('WatchlistEdit')}
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
```

---

### Task C6: InstrumentDetailScreen

**Files:**
- Create: `src/screens/markets/InstrumentDetailScreen.js`

Minimal Vantage-styled detail page: header + symbol + bid/ask/spread/change + Trade CTA + "Add to Watchlist" toggle. No chart in this phase — chart belongs to Plan D (Trade).

```js
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { ScrollView, View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';

import { Screen, Card, PillButton, SymbolIcon, Sparkline, IconButton, showToast } from '../../components/vantage';
import { vantage, space, sizes, weights, fontFamily } from '../../theme/vantageTheme';
import ApiService from '../../services/ApiService';
import { getInstruments } from '../../utils/instrumentsCache';
import { getSparkData } from '../../utils/sparklineCache';
import { getWatchlist, addToWatchlist, removeFromWatchlist } from '../../utils/watchlistStorage';

export default function InstrumentDetailScreen() {
  const nav = useNavigation();
  const route = useRoute();
  const symbol = String(route.params?.symbol || '').toUpperCase();

  const [instrument, setInstrument] = useState(null);
  const [tick, setTick] = useState(null);
  const [sparkData, setSparkData] = useState([]);
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [list, prices, bars, watchlist] = await Promise.allSettled([
        getInstruments(),
        ApiService.getAllPrices(),
        getSparkData(symbol),
        getWatchlist(),
      ]);
      if (cancelled) return;
      if (list.status === 'fulfilled') {
        const found = (list.value || []).find((i) => String(i.symbol || '').toUpperCase() === symbol);
        setInstrument(found || null);
      }
      if (prices.status === 'fulfilled') {
        const arr = Array.isArray(prices.value) ? prices.value : (Array.isArray(prices.value?.items) ? prices.value.items : []);
        const p = arr.find((x) => String(x.symbol || x.ticker || '').toUpperCase() === symbol) || null;
        setTick(p);
      }
      if (bars.status === 'fulfilled') setSparkData(bars.value || []);
      if (watchlist.status === 'fulfilled') setPinned((watchlist.value || []).includes(symbol));
    })();
    return () => { cancelled = true; };
  }, [symbol]);

  const bid = tick?.bid != null ? Number(tick.bid) : null;
  const ask = tick?.ask != null ? Number(tick.ask) : null;
  const changePct = tick?.change_pct != null ? Number(tick.change_pct) : (tick?.changePct != null ? Number(tick.changePct) : null);
  const positive = (changePct ?? 0) >= 0;
  const spread = bid != null && ask != null ? (ask - bid) : null;

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

  return (
    <Screen edges={['top']}>
      <View style={styles.headerRow}>
        <IconButton
          icon={<Ionicons name="chevron-back" size={22} color={vantage.textPrimary} />}
          accessibilityLabel="Back"
          onPress={() => nav.goBack()}
        />
        <View style={{ flex: 1 }} />
        <Pressable onPress={togglePin} hitSlop={8} accessibilityRole="button" accessibilityLabel={pinned ? 'Unpin' : 'Pin to watchlist'}>
          <Ionicons name={pinned ? 'bookmark' : 'bookmark-outline'} size={22} color={pinned ? vantage.accent : vantage.textPrimary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: space.huge }}>
        <View style={styles.symbolRow}>
          <SymbolIcon symbol={symbol} size={56} />
          <View style={{ flex: 1 }}>
            <Text style={styles.symbol}>{symbol}</Text>
            <Text style={styles.subname} numberOfLines={1}>{instrument?.display_name || instrument?.name || symbol}</Text>
          </View>
        </View>

        <View style={styles.priceRow}>
          <Text style={styles.price}>{bid != null ? bid.toLocaleString('en-US', { maximumFractionDigits: 5 }) : '—'}</Text>
          {changePct != null ? (
            <Text style={[styles.pct, { color: positive ? vantage.up : vantage.down }]}>
              {`${positive ? '+' : ''}${changePct.toFixed(2)}%`}
            </Text>
          ) : null}
        </View>

        <View style={styles.sparkWrap}>
          <Sparkline data={sparkData} width={320} height={80} strokeWidth={2} color={positive ? vantage.up : vantage.down} />
        </View>

        <Card style={{ marginTop: space.lg }}>
          <Stat label="Bid"    value={bid != null ? bid.toFixed(5) : '—'} />
          <Stat label="Ask"    value={ask != null ? ask.toFixed(5) : '—'} />
          <Stat label="Spread" value={spread != null ? spread.toFixed(5) : '—'} />
          <Stat label="Segment" value={instrument?.segment || instrument?.category || '—'} last />
        </Card>

        <PillButton
          label="Trade"
          variant="primary"
          size="lg"
          onPress={() => nav.navigate('TradeTab', { screen: 'Trade', params: { symbol } })}
          style={{ marginTop: space.xl }}
        />
      </ScrollView>
    </Screen>
  );
}

function Stat({ label, value, last = false }) {
  return (
    <View style={[statStyles.row, !last && statStyles.border]}>
      <Text style={statStyles.label}>{label}</Text>
      <Text style={statStyles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.sm, paddingTop: space.sm, paddingBottom: space.xs, gap: space.xs },
  symbolRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  symbol: { color: vantage.textPrimary, fontFamily, fontSize: sizes.h1, fontWeight: weights.heavy },
  subname: { color: vantage.textMuted, fontFamily, fontSize: sizes.body, marginTop: 2 },
  priceRow: { marginTop: space.lg, gap: 4 },
  price: { color: vantage.textPrimary, fontFamily, fontSize: sizes.hero, fontWeight: weights.heavy },
  pct: { fontFamily, fontSize: sizes.h3, fontWeight: weights.bold },
  sparkWrap: { alignItems: 'center', marginTop: space.md },
});

const statStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: space.sm },
  border: { borderBottomColor: vantage.border, borderBottomWidth: StyleSheet.hairlineWidth },
  label: { color: vantage.textMuted, fontFamily, fontSize: sizes.body },
  value: { color: vantage.textPrimary, fontFamily, fontSize: sizes.body, fontWeight: weights.bold },
});
```

---

### Task C7: WatchlistEditScreen

**Files:**
- Create: `src/screens/markets/WatchlistEditScreen.js`

Multi-select list. Search + segment filter. Tap row toggles pin.

```js
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, TextInput, FlatList, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { Screen, IconButton, SymbolIcon, CategoryTabs } from '../../components/vantage';
import { vantage, space, sizes, weights, fontFamily, radius } from '../../theme/vantageTheme';
import { getInstruments } from '../../utils/instrumentsCache';
import { getWatchlist, setWatchlist } from '../../utils/watchlistStorage';
import { bySegment } from '../../utils/marketMovers';

const FILTER_OPTIONS = [
  { value: 'all',     label: 'All' },
  { value: 'forex',   label: 'Forex' },
  { value: 'crypto',  label: 'Crypto' },
  { value: 'indices', label: 'Indices' },
  { value: 'metals',  label: 'Metals' },
  { value: 'shares',  label: 'Shares' },
];

export default function WatchlistEditScreen() {
  const nav = useNavigation();
  const [instruments, setInstruments] = useState([]);
  const [pinned, setPinned] = useState(new Set());
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [list, watchlist] = await Promise.all([getInstruments(), getWatchlist()]);
      if (cancelled) return;
      setInstruments(list || []);
      setPinned(new Set((watchlist || []).map((s) => String(s).toUpperCase())));
    })();
    return () => { cancelled = true; };
  }, []);

  const visible = useMemo(() => {
    let list = filter === 'all' ? instruments : bySegment(instruments, filter);
    const q = query.trim().toUpperCase();
    if (q) {
      list = list.filter((i) => {
        const sym = String(i.symbol || '').toUpperCase();
        const name = String(i.display_name || i.name || '').toUpperCase();
        return sym.includes(q) || name.includes(q);
      });
    }
    return list.slice(0, 200);
  }, [instruments, filter, query]);

  const toggleSymbol = useCallback((sym) => {
    const upper = String(sym).toUpperCase();
    setPinned((prev) => {
      const next = new Set(prev);
      if (next.has(upper)) next.delete(upper); else next.add(upper);
      return next;
    });
    setDirty(true);
  }, []);

  const save = useCallback(async () => {
    await setWatchlist(Array.from(pinned));
    nav.goBack();
  }, [pinned, nav]);

  return (
    <Screen edges={['top']}>
      <View style={styles.headerRow}>
        <IconButton
          icon={<Ionicons name="chevron-back" size={22} color={vantage.textPrimary} />}
          accessibilityLabel="Back"
          onPress={() => nav.goBack()}
        />
        <Text style={styles.title}>Edit Watchlist</Text>
        <Pressable onPress={save} hitSlop={8} accessibilityRole="button" accessibilityLabel="Done">
          <Text style={[styles.doneTxt, !dirty && { color: vantage.textMuted }]}>Done</Text>
        </Pressable>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={vantage.textMuted} style={{ marginRight: space.sm }} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search symbol or name"
          placeholderTextColor={vantage.textMuted}
          style={styles.searchInput}
          autoCapitalize="characters"
          autoCorrect={false}
        />
        {query ? (
          <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="Clear">
            <Ionicons name="close-circle" size={18} color={vantage.textMuted} />
          </Pressable>
        ) : null}
      </View>

      <CategoryTabs value={filter} onChange={setFilter} options={FILTER_OPTIONS} />

      <FlatList
        data={visible}
        keyExtractor={(item) => String(item.symbol || item.id)}
        renderItem={({ item }) => {
          const sym = String(item.symbol || '').toUpperCase();
          const isPinned = pinned.has(sym);
          return (
            <Pressable
              onPress={() => toggleSymbol(sym)}
              style={styles.row}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isPinned }}
              android_ripple={{ color: vantage.bgPressed }}
            >
              <SymbolIcon symbol={sym} size={36} />
              <View style={styles.rowText}>
                <Text style={styles.rowSym}>{sym}</Text>
                <Text style={styles.rowName} numberOfLines={1}>{item.display_name || item.name || sym}</Text>
              </View>
              <Ionicons
                name={isPinned ? 'checkmark-circle' : 'add-circle-outline'}
                size={26}
                color={isPinned ? vantage.accent : vantage.textMuted}
              />
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <Text style={styles.empty}>No instruments match.</Text>
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: space.sm, paddingTop: space.sm, paddingBottom: space.sm,
    gap: space.sm,
  },
  title: { flex: 1, color: vantage.textPrimary, fontFamily, fontSize: sizes.h2, fontWeight: weights.heavy, textAlign: 'center' },
  doneTxt: { color: vantage.accent, fontFamily, fontSize: sizes.body, fontWeight: weights.bold, paddingHorizontal: space.md },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: space.lg, marginVertical: space.sm,
    backgroundColor: vantage.bgElevated,
    borderRadius: radius.md, paddingHorizontal: space.md, height: 44,
  },
  searchInput: { flex: 1, color: vantage.textPrimary, fontFamily, fontSize: sizes.body, padding: 0 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    paddingHorizontal: space.lg, paddingVertical: space.md,
  },
  rowText: { flex: 1 },
  rowSym: { color: vantage.textPrimary, fontFamily, fontSize: sizes.h3, fontWeight: weights.bold },
  rowName: { color: vantage.textMuted, fontFamily, fontSize: sizes.label, marginTop: 2 },
  empty: { color: vantage.textMuted, fontFamily, fontSize: sizes.body, padding: space.huge, textAlign: 'center' },
});
```

---

### Task C8: Register new routes in MarketsStack

**Files:**
- Modify: `src/navigation/MarketsStack.js`

```js
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MarketsScreen from '../screens/MarketsScreen';
import InstrumentDetailScreen from '../screens/markets/InstrumentDetailScreen';
import WatchlistEditScreen from '../screens/markets/WatchlistEditScreen';

const Stack = createNativeStackNavigator();

export default function MarketsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#000' } }}>
      <Stack.Screen name="Markets" component={MarketsScreen} />
      <Stack.Screen name="InstrumentDetail" component={InstrumentDetailScreen} />
      <Stack.Screen name="WatchlistEdit" component={WatchlistEditScreen} />
    </Stack.Navigator>
  );
}
```

---

### Task C9: Smoke test checklist

After all tasks:

- Markets tab opens — Watchlist | Explore toggle at top, search icon top-right.
- Watchlist view: default 5 pinned symbols visible with live prices + sparklines, Edit/Add buttons at bottom.
- Tap Add → WatchlistEdit screen → search "EUR" filters, tap to toggle pin, Done returns and updated list shows.
- Switch to Explore: Calendar + Risk Calc tiles, segment tabs (Overview / Indices / Forex / Crypto / Metals / Shares).
- Spotlight card shows XAUUSD / NAS100 / BTCUSD with glowing wordmark badge.
- Market Movers bar chart shows top 5 risers; tap "Top risers ⇄" toggles to fallers.
- Essentials list filters by selected segment.
- Tap any row → InstrumentDetail with bid/ask/spread/sparkline + Trade CTA + bookmark toggle.
- Pull to refresh works on Markets root.
- Bottom nav pill clears all content; no overlap.
