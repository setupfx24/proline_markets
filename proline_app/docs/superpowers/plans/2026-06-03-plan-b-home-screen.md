# Plan B — Vantage Redesign: Home Screen (Phase 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use `- [ ]` checkboxes.

**Goal:** Replace the Home placeholder screen with the real Vantage-style dashboard, wired to the live ProlineMarket backend.

**Architecture:** Composition of six small section components (`HomeHeader`, `BalanceBlock`, `QuickActionsGrid`, `PromoBanner`, `StrategyCarousel`, `WatchlistSection`) orchestrated by `HomeScreen.js`. Each section owns its own fetch logic via the existing `ApiService` (`src/services/ApiService.js`). Watchlist live-updates from `WebSocketService` (`src/services/WebSocketService.js`). Pinned watchlist symbols + hidden-balance flag persist in `expo-secure-store`. Sparkline OHLC bars fetched on demand and cached in-memory for 60 s. No new third-party deps.

**Tech Stack:** React + RN 0.81.5 (Hermes), existing ApiService + WebSocketService, expo-secure-store for prefs, `react-native-svg` for sparklines (already installed).

**Working directory:** `/Users/tarundewangan/Downloads/Projects/ProlineMarket/ProlineMarket_apk`

---

### File structure

**New files:**
- `src/utils/watchlistStorage.js` — get/set/add/remove pinned watchlist symbols (SecureStore)
- `src/utils/hiddenBalance.js` — get/set hidden-balance preference (SecureStore)
- `src/utils/sparklineCache.js` — fetch + in-memory cache for per-symbol 24h bars
- `src/screens/home/HomeHeader.js` — top bar (avatar + search + chat)
- `src/screens/home/QuickActionsGrid.js` — 4 quick-action tiles
- `src/screens/home/PromoBanner.js` — hero banner card
- `src/screens/home/StrategyCarousel.js` — horizontal scroll of leaderboard strategies
- `src/screens/home/WatchlistSection.js` — sparkline-rich watchlist list

**Modified files:**
- `src/services/ApiService.js` — add `getBars(symbol, params)` method
- `src/screens/HomeScreen.js` — replace placeholder body with orchestrator

---

### Task 1: Helpers — watchlistStorage + hiddenBalance + sparklineCache + ApiService.getBars

**Files:**
- Create: `src/utils/watchlistStorage.js`
- Create: `src/utils/hiddenBalance.js`
- Create: `src/utils/sparklineCache.js`
- Modify: `src/services/ApiService.js` (add one method)

- [ ] **Step 1: Create watchlistStorage.js**

```js
import * as SecureStore from 'expo-secure-store';

const KEY = 'prolinemarket.watchlist';
const DEFAULT_WATCHLIST = ['XAUUSD', 'NAS100', 'BTCUSD', 'EURUSD', 'Nikkei225'];

let cached = null;

export async function getWatchlist() {
  if (cached) return cached;
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        cached = parsed;
        return parsed;
      }
    }
  } catch (_) {}
  cached = DEFAULT_WATCHLIST;
  return DEFAULT_WATCHLIST;
}

export async function setWatchlist(symbols) {
  const list = Array.isArray(symbols) ? symbols.filter((s) => typeof s === 'string') : [];
  cached = list;
  try {
    await SecureStore.setItemAsync(KEY, JSON.stringify(list));
  } catch (_) {}
}

export async function addToWatchlist(symbol) {
  const cur = await getWatchlist();
  if (cur.includes(symbol)) return cur;
  const next = [...cur, symbol];
  await setWatchlist(next);
  return next;
}

export async function removeFromWatchlist(symbol) {
  const cur = await getWatchlist();
  const next = cur.filter((s) => s !== symbol);
  await setWatchlist(next);
  return next;
}
```

- [ ] **Step 2: Create hiddenBalance.js**

```js
import { useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';

const KEY = 'prolinemarket.balanceHidden';

export function useHiddenBalance() {
  const [hidden, setHiddenState] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const v = await SecureStore.getItemAsync(KEY);
        if (!cancelled) setHiddenState(v === '1');
      } catch (_) {}
      if (!cancelled) setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, []);

  const toggle = async () => {
    const next = !hidden;
    setHiddenState(next);
    try {
      await SecureStore.setItemAsync(KEY, next ? '1' : '0');
    } catch (_) {}
  };

  return { hidden, toggle, loaded };
}
```

- [ ] **Step 3: Create sparklineCache.js**

```js
import ApiService from '../services/ApiService';

const TTL_MS = 60_000;
const cache = new Map(); // symbol -> { ts, data }
const inflight = new Map(); // symbol -> Promise

export async function getSparkData(symbol) {
  const sym = String(symbol || '').toUpperCase();
  if (!sym) return [];

  const now = Date.now();
  const hit = cache.get(sym);
  if (hit && (now - hit.ts) < TTL_MS) return hit.data;

  if (inflight.has(sym)) return inflight.get(sym);

  const p = (async () => {
    try {
      const bars = await ApiService.getBars(sym, { resolution: '60', limit: 24 });
      const points = Array.isArray(bars) ? bars.map((b) => Number(b?.close ?? b?.c ?? 0)).filter(Number.isFinite) : [];
      cache.set(sym, { ts: Date.now(), data: points });
      return points;
    } catch (_) {
      cache.set(sym, { ts: Date.now(), data: [] });
      return [];
    } finally {
      inflight.delete(sym);
    }
  })();
  inflight.set(sym, p);
  return p;
}

export function clearSparkCache() {
  cache.clear();
}
```

- [ ] **Step 4: Add `getBars` to ApiService**

Open `src/services/ApiService.js`. Find the `getAllPrices()` method (around line 323). Add immediately after it (before `getOrders`):

```js
  async getBars(symbol, { resolution = '60', limit = 24 } = {}) {
    const query = new URLSearchParams({ resolution: String(resolution), limit: String(limit) });
    return this.request(`/instruments/${encodeURIComponent(symbol)}/bars?${query.toString()}`);
  }
```

Verify with grep:
```bash
grep -n "getBars" /Users/tarundewangan/Downloads/Projects/ProlineMarket/ProlineMarket_apk/src/services/ApiService.js
```

- [ ] **Step 5: Smoke verify**

```bash
node -e "console.log(typeof require('/Users/tarundewangan/Downloads/Projects/ProlineMarket/ProlineMarket_apk/src/utils/watchlistStorage.js'))"
```

May fail because the file uses ESM `import`. That's fine — Metro/Babel handles it. Instead just `ls` the files:

```bash
ls /Users/tarundewangan/Downloads/Projects/ProlineMarket/ProlineMarket_apk/src/utils/watchlistStorage.js /Users/tarundewangan/Downloads/Projects/ProlineMarket/ProlineMarket_apk/src/utils/hiddenBalance.js /Users/tarundewangan/Downloads/Projects/ProlineMarket/ProlineMarket_apk/src/utils/sparklineCache.js
```

---

### Task 2: HomeHeader component

**Files:**
- Create: `src/screens/home/HomeHeader.js`

- [ ] **Step 1: Write the component**

```js
import React, { useContext } from 'react';
import { View, Image, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { AuthContext } from '../../context/AuthContext';
import { IconButton } from '../../components/vantage';
import { vantage, space } from '../../theme/vantageTheme';

const AVATAR_PLACEHOLDER = null; // future: cache profile.avatar_url

export default function HomeHeader({ unreadSupport = 0 }) {
  const nav = useNavigation();
  const { user } = useContext(AuthContext) || {};
  const initials = (user?.email || 'U').slice(0, 1).toUpperCase();

  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => nav.navigate('ProfileMenu')}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Open profile menu"
      >
        <View style={styles.avatarWrap}>
          {AVATAR_PLACEHOLDER ? (
            <Image source={{ uri: AVATAR_PLACEHOLDER }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Ionicons name="person" size={22} color={vantage.textPrimary} />
            </View>
          )}
        </View>
      </Pressable>

      <View style={{ flex: 1 }} />

      <IconButton
        icon={<Ionicons name="search" size={20} color={vantage.textPrimary} />}
        accessibilityLabel="Search"
        onPress={() => nav.navigate('Search')}
      />
      <IconButton
        icon={<Ionicons name="chatbubble-outline" size={20} color={vantage.textPrimary} />}
        badgeColor={unreadSupport > 0 ? vantage.down : undefined}
        accessibilityLabel="Support"
        onPress={() => nav.navigate('Support')}
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
    paddingBottom: space.md,
    gap: space.xs,
  },
  avatarWrap: { padding: 2 },
  avatar: {
    width: 36, height: 36, borderRadius: 18,
  },
  avatarFallback: {
    backgroundColor: vantage.bgRaised,
    alignItems: 'center', justifyContent: 'center',
  },
});
```

Note: `ProfileMenu`, `Search`, and `Support` are not yet routes — they'll get registered in later plans. For now the navigation calls will no-op. Wrap with try or rely on react-navigation logging a warning silently — that's acceptable for Plan B.

- [ ] **Step 2: Smoke check** — file exists, imports resolve via grep:
```bash
grep -n "from '../../components/vantage'" /Users/tarundewangan/Downloads/Projects/ProlineMarket/ProlineMarket_apk/src/screens/home/HomeHeader.js
```

---

### Task 3: QuickActionsGrid component

**Files:**
- Create: `src/screens/home/QuickActionsGrid.js`

- [ ] **Step 1: Write the component**

```js
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { QuickActionTile } from '../../components/vantage';
import { vantage, space } from '../../theme/vantageTheme';

export default function QuickActionsGrid({ hasNewBanners = false }) {
  const nav = useNavigation();
  return (
    <View style={styles.row}>
      <QuickActionTile
        icon={<Ionicons name="gift-outline" size={24} color={vantage.textPrimary} />}
        label="Promotion"
        badge={hasNewBanners ? 'New' : undefined}
        onPress={() => nav.navigate('Notifications')}
      />
      <QuickActionTile
        icon={<Ionicons name="calendar-outline" size={24} color={vantage.textPrimary} />}
        label="Calendar"
        onPress={() => nav.navigate('EconomicCalendar')}
      />
      <QuickActionTile
        icon={<Ionicons name="school-outline" size={24} color={vantage.textPrimary} />}
        label="Academy"
        onPress={() => nav.navigate('Academy')}
      />
      <QuickActionTile
        icon={<Ionicons name="people-outline" size={24} color={vantage.textPrimary} />}
        label="IB"
        onPress={() => nav.navigate('Business', { initialTab: 'ib' })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    gap: space.md,
  },
});
```

Same routing note as Task 2 — destinations don't exist as routes yet within HomeStack. Subsequent plans add them. Calls will warn in console but not crash.

---

### Task 4: PromoBanner component

**Files:**
- Create: `src/screens/home/PromoBanner.js`

- [ ] **Step 1: Write the component**

```js
import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Card } from '../../components/vantage';
import { vantage, space, sizes, weights, fontFamily } from '../../theme/vantageTheme';

export default function PromoBanner({ banner, onPress }) {
  if (!banner) return null;
  const title = banner.title || banner.heading || 'Top Performing Signal Providers';
  const cta = banner.cta_label || banner.subtitle || 'View More';
  const imageUrl = banner.image_url || banner.image || null;

  return (
    <Card
      onPress={onPress}
      style={styles.card}
      padding={space.lg}
    >
      <View style={styles.row}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.thumb} resizeMode="contain" />
        ) : (
          <View style={[styles.thumb, styles.thumbFallback]}>
            <Ionicons name="trophy" size={32} color={vantage.accent} />
          </View>
        )}
        <View style={styles.body}>
          <Text style={styles.title} numberOfLines={2}>{title}</Text>
          <Text style={styles.cta}>{cta} ›</Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: space.lg, marginVertical: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  thumb: { width: 64, height: 64, borderRadius: 12, backgroundColor: vantage.bgRaised },
  thumbFallback: { alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, minWidth: 0 },
  title: { color: vantage.textPrimary, fontFamily, fontSize: sizes.h3, fontWeight: weights.heavy },
  cta: { color: vantage.textSecondary, fontFamily, fontSize: sizes.label, marginTop: 4 },
});
```

---

### Task 5: StrategyCarousel component

**Files:**
- Create: `src/screens/home/StrategyCarousel.js`

- [ ] **Step 1: Write the component**

```js
import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { StrategyCard } from '../../components/vantage';
import { vantage, space, sizes, weights, fontFamily } from '../../theme/vantageTheme';

export default function StrategyCarousel({ strategies = [], onSeeAll }) {
  const nav = useNavigation();

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={styles.heading}>Best Overall Strategies</Text>
        <Pressable onPress={onSeeAll || (() => nav.navigate('TradeTab'))} hitSlop={8} accessibilityRole="button" accessibilityLabel="See all strategies">
          <Ionicons name="chevron-forward" size={20} color={vantage.textMuted} />
        </Pressable>
      </View>
      {strategies.length === 0 ? (
        <Text style={styles.empty}>No strategies yet.</Text>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.row}
        >
          {strategies.map((s) => (
            <StrategyCard
              key={s.id || s.provider_id || s.account_id || s.name}
              name={s.name || s.display_name || 'Strategy'}
              category={s.category || s.segment || null}
              return30d={typeof s.return_30d === 'number' ? s.return_30d : (typeof s.roi_30d === 'number' ? s.roi_30d : null)}
              aum={typeof s.aum === 'number' ? s.aum : (typeof s.aum_usd === 'number' ? s.aum_usd : null)}
              status={s.is_full ? 'full' : 'open'}
              avatarSymbol={(s.symbol || s.name || 'ST').slice(0, 2).toUpperCase()}
              onPress={() => nav.navigate('TradeTab')}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: space.md },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingBottom: space.sm,
  },
  heading: { color: vantage.textPrimary, fontFamily, fontSize: sizes.h2, fontWeight: weights.heavy },
  empty: { color: vantage.textMuted, fontFamily, fontSize: sizes.label, paddingHorizontal: space.lg, paddingBottom: space.md },
  row: { gap: space.md, paddingHorizontal: space.lg, paddingBottom: space.sm },
});
```

---

### Task 6: WatchlistSection component

**Files:**
- Create: `src/screens/home/WatchlistSection.js`

This component holds the list of pinned symbols and shows live prices with sparklines. Loads sparkline bars per symbol on demand.

- [ ] **Step 1: Write the component**

```js
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { InstrumentRow } from '../../components/vantage';
import { vantage, space, sizes, weights, fontFamily } from '../../theme/vantageTheme';
import { getWatchlist } from '../../utils/watchlistStorage';
import { getSparkData } from '../../utils/sparklineCache';

export default function WatchlistSection({ pricesBySymbol = {}, onSeeAll }) {
  const nav = useNavigation();
  const [symbols, setSymbols] = useState([]);
  const [sparks, setSparks] = useState({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await getWatchlist();
      if (!cancelled) setSymbols(list);
    })();
    return () => { cancelled = true; };
  }, []);

  // Lazy-load sparkline data once per symbol.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const sym of symbols) {
        if (sparks[sym]) continue;
        const data = await getSparkData(sym);
        if (cancelled) return;
        setSparks((prev) => ({ ...prev, [sym]: data }));
      }
    })();
    return () => { cancelled = true; };
  }, [symbols]);

  const handleSeeAll = useCallback(() => {
    if (onSeeAll) onSeeAll();
    else nav.navigate('MarketsTab');
  }, [onSeeAll, nav]);

  if (symbols.length === 0) {
    return (
      <View style={styles.wrap}>
        <View style={styles.headerRow}>
          <Text style={styles.heading}>Watchlist</Text>
        </View>
        <Text style={styles.empty}>Tap + Add in Markets to pin instruments.</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={styles.heading}>Watchlist</Text>
        <Pressable onPress={handleSeeAll} hitSlop={8} accessibilityRole="button" accessibilityLabel="View all watchlist">
          <Ionicons name="chevron-forward" size={20} color={vantage.textMuted} />
        </Pressable>
      </View>
      {symbols.map((sym) => {
        const p = pricesBySymbol[sym] || pricesBySymbol[sym?.toUpperCase()] || null;
        const price = p?.bid != null ? Number(p.bid) : (p?.price != null ? Number(p.price) : null);
        const changePct = p?.change_pct != null ? Number(p.change_pct) : (p?.changePct != null ? Number(p.changePct) : null);
        return (
          <InstrumentRow
            key={sym}
            symbol={sym}
            name={sym}
            subtitle={p?.display_name || p?.name || undefined}
            price={price}
            changePct={changePct}
            sparkData={sparks[sym] || []}
            onPress={() => nav.navigate('TradeTab', { screen: 'Trade', params: { symbol: sym } })}
          />
        );
      })}
      <Pressable onPress={handleSeeAll} style={styles.viewMore} accessibilityRole="button" accessibilityLabel="View more">
        <Text style={styles.viewMoreTxt}>View More ›</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: space.md },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingBottom: space.sm,
  },
  heading: { color: vantage.textPrimary, fontFamily, fontSize: sizes.h2, fontWeight: weights.heavy },
  empty: { color: vantage.textMuted, fontFamily, fontSize: sizes.label, paddingHorizontal: space.lg, paddingBottom: space.md },
  viewMore: { alignItems: 'center', paddingVertical: space.md },
  viewMoreTxt: { color: vantage.textSecondary, fontFamily, fontSize: sizes.body, fontWeight: weights.semibold },
});
```

---

### Task 7: HomeScreen orchestrator

**Files:**
- Modify: `src/screens/HomeScreen.js` (full rewrite)

Connects all sections, fetches portfolio + leaderboard + prices + banners, subscribes to WS price ticks, and supports pull-to-refresh.

- [ ] **Step 1: Rewrite `src/screens/HomeScreen.js`**

```js
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { ScrollView, RefreshControl, View, StyleSheet, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { Screen, BalanceBlock } from '../components/vantage';
import { vantage, space } from '../theme/vantageTheme';
import ApiService from '../services/ApiService';
import webSocketService from '../services/WebSocketService';
import { useHiddenBalance } from '../utils/hiddenBalance';
import { BOTTOM_NAV_PILL_HEIGHT } from '../components/vantage/BottomNavPill';

import HomeHeader from './home/HomeHeader';
import QuickActionsGrid from './home/QuickActionsGrid';
import PromoBanner from './home/PromoBanner';
import StrategyCarousel from './home/StrategyCarousel';
import WatchlistSection from './home/WatchlistSection';

export default function HomeScreen() {
  const nav = useNavigation();
  const { hidden, toggle: toggleHidden } = useHiddenBalance();

  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState(null);
  const [perfDay, setPerfDay] = useState(null);
  const [strategies, setStrategies] = useState([]);
  const [banner, setBanner] = useState(null);
  const [unreadSupport, setUnreadSupport] = useState(0);
  const [pricesBySymbol, setPricesBySymbol] = useState({});

  const pricesRef = useRef(pricesBySymbol);
  pricesRef.current = pricesBySymbol;

  const fetchAll = useCallback(async () => {
    const tasks = [
      ApiService.getPortfolioSummary().then(setSummary).catch(() => setSummary(null)),
      ApiService.getPortfolioPerformance('1d').then(setPerfDay).catch(() => setPerfDay(null)),
      ApiService.getLeaderboard({ sort: 'overall', limit: 10 }).then((res) => {
        const list = Array.isArray(res) ? res : (Array.isArray(res?.items) ? res.items : []);
        setStrategies(list);
      }).catch(() => setStrategies([])),
      ApiService.getBanners('dashboard').then((res) => {
        const list = Array.isArray(res) ? res : (Array.isArray(res?.items) ? res.items : []);
        setBanner(list[0] || null);
      }).catch(() => setBanner(null)),
      ApiService.getAllPrices().then((res) => {
        const list = Array.isArray(res) ? res : (Array.isArray(res?.items) ? res.items : []);
        const map = {};
        for (const p of list) {
          const sym = String(p.symbol || p.ticker || '').toUpperCase();
          if (sym) map[sym] = p;
        }
        setPricesBySymbol(map);
      }).catch(() => setPricesBySymbol({})),
      ApiService.getTickets(1, 5).then((res) => {
        const list = Array.isArray(res) ? res : (Array.isArray(res?.items) ? res.items : []);
        const unread = list.filter((t) => t?.has_unread || t?.unread_count > 0 || t?.status === 'open').length;
        setUnreadSupport(unread);
      }).catch(() => setUnreadSupport(0)),
    ];
    await Promise.allSettled(tasks);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Subscribe to WS price ticks while this screen is mounted.
  useEffect(() => {
    if (typeof webSocketService?.connectPriceStream !== 'function') return;
    let mounted = true;

    const onTick = (msg) => {
      if (!mounted || !msg) return;
      const sym = String(msg.symbol || msg.s || '').toUpperCase();
      if (!sym) return;
      setPricesBySymbol((prev) => {
        const cur = prev[sym] || {};
        const bid = msg.bid != null ? Number(msg.bid) : cur.bid;
        const ask = msg.ask != null ? Number(msg.ask) : cur.ask;
        return { ...prev, [sym]: { ...cur, symbol: sym, bid, ask } };
      });
    };

    const maybeUnsub = typeof webSocketService.addPriceListener === 'function'
      ? webSocketService.addPriceListener(onTick)
      : null;

    webSocketService.connectPriceStream?.();

    return () => {
      mounted = false;
      if (typeof maybeUnsub === 'function') maybeUnsub();
      else if (typeof webSocketService.removePriceListener === 'function') {
        webSocketService.removePriceListener(onTick);
      }
    };
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  }, [fetchAll]);

  const totalValue = summary?.total_equity ?? summary?.equity ?? summary?.balance ?? null;
  const todayPnl = perfDay?.profit ?? perfDay?.pnl ?? perfDay?.pl ?? null;
  const hasNewBanners = !!banner;

  return (
    <Screen edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: BOTTOM_NAV_PILL_HEIGHT + space.huge }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={vantage.accent} colors={[vantage.accent]} />
        }
      >
        <HomeHeader unreadSupport={unreadSupport} />

        <View style={styles.balanceWrap}>
          <BalanceBlock
            label="Total Value"
            amount={typeof totalValue === 'number' ? totalValue : null}
            currency="USD"
            hidden={hidden}
            onToggleHide={toggleHidden}
            subLabel="Today's PnL"
            subAmount={typeof todayPnl === 'number' ? todayPnl : null}
            subPositive={typeof todayPnl === 'number' ? todayPnl >= 0 : true}
          />
        </View>

        <QuickActionsGrid hasNewBanners={hasNewBanners} />

        {banner ? (
          <PromoBanner banner={banner} onPress={() => nav.navigate('TradeTab')} />
        ) : null}

        <StrategyCarousel strategies={strategies} onSeeAll={() => nav.navigate('TradeTab')} />

        <WatchlistSection
          pricesBySymbol={pricesBySymbol}
          onSeeAll={() => nav.navigate('MarketsTab')}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 120 },
  balanceWrap: { paddingHorizontal: space.lg, paddingBottom: space.sm },
});
```

- [ ] **Step 2: Sanity check imports**

```bash
grep -nE "from '\.\./(components/vantage|theme/vantageTheme|services|utils|context)" /Users/tarundewangan/Downloads/Projects/ProlineMarket/ProlineMarket_apk/src/screens/HomeScreen.js
```

All paths should be relative-correct.

- [ ] **Step 3: Re-add the DEV long-press shortcut to ComponentGallery**

The old HomeScreen had a long-press on the "Home" title to open the gallery (from Task 28 of Plan A). The new HomeScreen no longer renders a "Home" label — the gallery is reachable in another way.

Add a tiny invisible DEV shortcut: in `HomeScreen.js`, wrap the inner `HomeHeader` call so that long-pressing the avatar opens the gallery. We don't want to mutate HomeHeader's contract, so just wrap externally:

Edit `HomeScreen.js`: replace `<HomeHeader unreadSupport={unreadSupport} />` with

```jsx
<Pressable onLongPress={() => __DEV__ && nav.navigate('ComponentGallery')}>
  <HomeHeader unreadSupport={unreadSupport} />
</Pressable>
```

`Pressable` is already imported. This preserves the gallery access from Plan A.

---

### Task 8: Smoke test checklist

- [ ] **Step 1: Launch the app**

```bash
cd /Users/tarundewangan/Downloads/Projects/ProlineMarket/ProlineMarket_apk && npx expo start
```

The user runs this and connects an Android device or emulator.

- [ ] **Step 2: Verify each section**

On the device, after logging in:

1. **Header:** avatar visible top-left (initial fallback if no profile pic). Search + chat icons top-right. Chat shows red dot only if there are unread support tickets.
2. **Balance:** "Total Value" with amount (or `—` if API returned no value). Eye icon hides → "••••••". Persists across app restarts. "Today's PnL" colored green/red.
3. **Quick actions:** 4 tiles: Promotion (with "New" badge if a banner exists) / Calendar / Academy / IB. Tapping logs a warning in DEV (routes not yet wired in HomeStack) — that's expected; nothing should crash.
4. **Promo banner:** appears only when `/banners?page=dashboard` returns one. Falls back gracefully if no banner exists.
5. **Strategy carousel:** horizontal scroll. Cards show name + category + 30D return %. Empty state message if leaderboard is empty.
6. **Watchlist:** Defaults to `['XAUUSD','NAS100','BTCUSD','EURUSD','Nikkei225']` for new users. Each row shows colored symbol icon, name, sparkline (loads after ~1s), current bid price, % change. Live ticks update price + color subtly. "View More" → MarketsTab.
7. **Pull-to-refresh:** drag down → orange spinner → all six sections refetch.
8. **Long-press avatar (DEV only):** opens ComponentGallery.

- [ ] **Step 3: Check for runtime errors**

Watch Metro logs. Expected warnings (NOT bugs):
- "The action 'NAVIGATE' with payload 'ProfileMenu' / 'Search' / 'Support' / 'EconomicCalendar' / 'Academy' / 'Business' was not handled by any navigator." — these routes belong to later plans.

Any RED error in console = bug. Stop and fix before declaring complete.

---

## Done state for Plan B

- HomeScreen shows real data sourced from `/portfolio/summary`, `/portfolio/performance?period=1d`, `/social/leaderboard`, `/banners`, `/instruments/prices/all`, `/support/tickets`.
- Watchlist symbols persist per-device; default list seeds on first launch.
- Hidden-balance toggle persists across launches.
- Sparkline OHLC bars fetched on demand and cached 60 s.
- Live price ticks patch watchlist rows individually via WebSocketService.
- Pull-to-refresh re-fetches everything.
- App still boots if any endpoint fails (each request is independently catch'd).
- ComponentGallery still reachable in DEV via long-press on header.

Plan C = Markets screen (Watchlist + Explore with category tabs, Spotlight, Market Movers, Essentials list). Same composition pattern.
