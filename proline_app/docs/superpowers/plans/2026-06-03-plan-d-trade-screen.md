# Plan D — Vantage Redesign: Trade Screen (Phase 4)

> Subagent-driven execution. Steps use `- [ ]`.

**Goal:** Replace the Trade placeholder with the Vantage CFDs + Copy split screen, wired to live ProlineMarket backend. Functional order placement, live positions, leaderboards, and a strategy detail page.

**Architecture:** `TradeScreen` orchestrator with `SegmentedTabs` toggling between `TradeCFDs` (account header + symbol row + BuySellSplit + OrderTicket + PositionsList) and `TradeCopy` (Become provider card + Discover leaderboards). Chart deferred — kept as an icon that opens a "Coming soon" placeholder. `StrategyDetailScreen` pushed when tapping a strategy.

**Scope notes**
- Chart panel deferred to a later phase (Vantage screenshot uses TradingView WebView; existing 360KB MainTradingScreen has working integration we'll port later).
- Order placement: market + limit + stop, with optional TP/SL.
- Positions live-update via existing WS trade stream (already in WebSocketService).

**Working directory:** `/Users/tarundewangan/Downloads/Projects/ProlineMarket/ProlineMarket_apk`

---

### File structure

**New files in `src/screens/trade/`:**
- `SymbolPicker.js` — bottom-sheet symbol search (uses cached instruments)
- `AccountSwitcher.js` — bottom-sheet account picker
- `OrderTicket.js` — full order form (BuySell + Volume + TP/SL + Margin + CTA)
- `PositionsList.js` — Positions + Pending Orders tabs
- `TradeCFDs.js` — CFDs sub-view orchestrator
- `TradeCopy.js` — Copy sub-view
- `StrategyDetailScreen.js`

**Modified:**
- `src/screens/TradeScreen.js`
- `src/navigation/TradeStack.js`

---

### Task D1: AccountSwitcher

**File:** `src/screens/trade/AccountSwitcher.js`

```js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Sheet, MenuRow } from '../../components/vantage';
import { vantage, space, sizes, weights, fontFamily } from '../../theme/vantageTheme';

export default function AccountSwitcher({ visible, onClose, accounts = [], selectedId, onSelect }) {
  return (
    <Sheet visible={visible} onClose={onClose} title="Select account">
      {accounts.length === 0 ? (
        <Text style={styles.empty}>No accounts. Open one in Funds.</Text>
      ) : accounts.map((a) => {
        const id = a.id || a._id;
        const isSelected = id === selectedId;
        const label = `${a.is_demo ? 'Demo' : 'Live'} ${a.account_number || id}`;
        const balance = a.balance != null ? `${Number(a.balance).toLocaleString('en-US', { maximumFractionDigits: 2 })} ${a.currency || 'USD'}` : '';
        return (
          <MenuRow
            key={id}
            icon={<Ionicons name={isSelected ? 'checkmark-circle' : 'card-outline'} size={20} color={isSelected ? vantage.accent : vantage.textPrimary} />}
            label={label}
            value={balance}
            onPress={() => { onSelect(a); onClose(); }}
          />
        );
      })}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  empty: { color: vantage.textMuted, fontFamily, fontSize: sizes.body, padding: space.lg, textAlign: 'center' },
});
```

---

### Task D2: SymbolPicker

**File:** `src/screens/trade/SymbolPicker.js`

```js
import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, TextInput, FlatList, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Sheet, SymbolIcon } from '../../components/vantage';
import { vantage, space, sizes, weights, fontFamily, radius } from '../../theme/vantageTheme';
import { getInstruments } from '../../utils/instrumentsCache';

export default function SymbolPicker({ visible, onClose, onSelect }) {
  const [instruments, setInstruments] = useState([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    (async () => {
      const list = await getInstruments();
      if (!cancelled) setInstruments(list || []);
    })();
    return () => { cancelled = true; };
  }, [visible]);

  const filtered = useMemo(() => {
    const q = query.trim().toUpperCase();
    if (!q) return instruments.slice(0, 100);
    return instruments.filter((i) => {
      const sym = String(i.symbol || '').toUpperCase();
      const name = String(i.display_name || i.name || '').toUpperCase();
      return sym.includes(q) || name.includes(q);
    }).slice(0, 100);
  }, [instruments, query]);

  return (
    <Sheet visible={visible} onClose={onClose} title="Choose symbol" height="80%">
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={vantage.textMuted} style={{ marginRight: space.sm }} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search"
          placeholderTextColor={vantage.textMuted}
          style={styles.searchInput}
          autoCapitalize="characters"
          autoCorrect={false}
          autoFocus
        />
        {query ? (
          <Pressable onPress={() => setQuery('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={vantage.textMuted} />
          </Pressable>
        ) : null}
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.symbol || item.id)}
        renderItem={({ item }) => {
          const sym = String(item.symbol || '').toUpperCase();
          return (
            <Pressable
              onPress={() => { onSelect(sym); onClose(); }}
              style={styles.row}
              android_ripple={{ color: vantage.bgPressed }}
            >
              <SymbolIcon symbol={sym} size={32} />
              <View style={styles.rowText}>
                <Text style={styles.rowSym}>{sym}</Text>
                <Text style={styles.rowName} numberOfLines={1}>{item.display_name || item.name || ''}</Text>
              </View>
            </Pressable>
          );
        }}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: vantage.bgRaised,
    borderRadius: radius.md, paddingHorizontal: space.md, height: 44,
    marginBottom: space.md,
  },
  searchInput: { flex: 1, color: vantage.textPrimary, fontFamily, fontSize: sizes.body, padding: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  rowText: { flex: 1 },
  rowSym: { color: vantage.textPrimary, fontFamily, fontSize: sizes.h3, fontWeight: weights.bold },
  rowName: { color: vantage.textMuted, fontFamily, fontSize: sizes.label, marginTop: 2 },
});
```

---

### Task D3: OrderTicket

**File:** `src/screens/trade/OrderTicket.js`

The form. Submits via `ApiService.placeOrder`.

```js
import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import {
  BuySellSplit,
  NumberStepper,
  DiscreteSlider,
  CheckboxRow,
  PillButton,
  Card,
  showToast,
} from '../../components/vantage';
import { vantage, space, sizes, weights, fontFamily, radius } from '../../theme/vantageTheme';
import ApiService from '../../services/ApiService';

const ORDER_TYPES = ['market', 'limit', 'stop'];
const LOT_PRESETS = [0.01, 0.1, 0.5, 1, 5];

export default function OrderTicket({ accountId, symbol, tick, onPlaced }) {
  const [side, setSide] = useState('sell');
  const [orderType, setOrderType] = useState('market');
  const [volume, setVolume] = useState(0.1);
  const [limitPrice, setLimitPrice] = useState('');
  const [tpSlEnabled, setTpSlEnabled] = useState(false);
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const bid = tick?.bid != null ? Number(tick.bid) : null;
  const ask = tick?.ask != null ? Number(tick.ask) : null;
  const spread = (bid != null && ask != null) ? Math.round((ask - bid) * 100000) : null;

  const canSubmit = useMemo(() => {
    if (!accountId || !symbol) return false;
    if (!(volume > 0)) return false;
    if (orderType !== 'market' && !(Number(limitPrice) > 0)) return false;
    if (tpSlEnabled) {
      if (stopLoss && !(Number(stopLoss) > 0)) return false;
      if (takeProfit && !(Number(takeProfit) > 0)) return false;
    }
    return true;
  }, [accountId, symbol, volume, orderType, limitPrice, tpSlEnabled, stopLoss, takeProfit]);

  const submit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    const payload = {
      account_id: accountId,
      symbol,
      side,
      order_type: orderType,
      volume: Number(volume),
    };
    if (orderType !== 'market') payload.price = Number(limitPrice);
    if (tpSlEnabled) {
      if (stopLoss) payload.stop_loss = Number(stopLoss);
      if (takeProfit) payload.take_profit = Number(takeProfit);
    }
    try {
      await ApiService.placeOrder(payload);
      showToast({ kind: 'success', message: `${side.toUpperCase()} ${volume} ${symbol} placed` });
      onPlaced?.();
    } catch (e) {
      showToast({ kind: 'error', message: e?.message || 'Order failed' });
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, accountId, symbol, side, orderType, volume, limitPrice, tpSlEnabled, stopLoss, takeProfit, onPlaced]);

  return (
    <View style={styles.wrap}>
      <BuySellSplit
        bid={bid}
        ask={ask}
        spreadPoints={spread}
        side={side}
        onChange={setSide}
      />

      <View style={styles.typeRow}>
        {ORDER_TYPES.map((t) => (
          <Pressable
            key={t}
            onPress={() => setOrderType(t)}
            style={[styles.typeChip, orderType === t && styles.typeChipActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: orderType === t }}
          >
            <Text style={[styles.typeTxt, orderType === t && { color: vantage.textPrimary, fontWeight: weights.bold }]}>
              {t.toUpperCase()}
            </Text>
          </Pressable>
        ))}
      </View>

      {orderType !== 'market' ? (
        <View style={styles.field}>
          <Text style={styles.label}>{orderType === 'limit' ? 'Limit price' : 'Stop price'}</Text>
          <TextInput
            value={limitPrice}
            onChangeText={setLimitPrice}
            keyboardType="decimal-pad"
            placeholder="0.00000"
            placeholderTextColor={vantage.textMuted}
            style={styles.input}
          />
        </View>
      ) : null}

      <View style={styles.field}>
        <NumberStepper
          label="Volume (lots)"
          value={volume}
          onChange={setVolume}
          min={0.01}
          max={1000}
          step={0.01}
          precision={2}
        />
        <View style={{ height: space.md }} />
        <DiscreteSlider value={LOT_PRESETS.includes(volume) ? volume : null} onChange={setVolume} stops={LOT_PRESETS} />
      </View>

      <CheckboxRow label="TP / SL" checked={tpSlEnabled} onChange={setTpSlEnabled} />
      {tpSlEnabled ? (
        <View style={styles.tpSlRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Stop Loss</Text>
            <TextInput
              value={stopLoss}
              onChangeText={setStopLoss}
              keyboardType="decimal-pad"
              placeholder="0.00000"
              placeholderTextColor={vantage.textMuted}
              style={styles.input}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Take Profit</Text>
            <TextInput
              value={takeProfit}
              onChangeText={setTakeProfit}
              keyboardType="decimal-pad"
              placeholder="0.00000"
              placeholderTextColor={vantage.textMuted}
              style={styles.input}
            />
          </View>
        </View>
      ) : null}

      <Card style={styles.infoCard}>
        <InfoRow label="Symbol" value={symbol || '—'} />
        <InfoRow label="Side" value={side.toUpperCase()} valueColor={side === 'buy' ? vantage.up : vantage.down} />
        <InfoRow label="Volume" value={`${volume} lots`} />
        <InfoRow label="Type" value={orderType.toUpperCase()} last />
      </Card>

      <PillButton
        label={submitting ? 'Placing…' : `${side === 'buy' ? 'Buy' : 'Sell'} ${symbol || ''}`}
        variant={side === 'buy' ? 'buy' : 'sell'}
        size="lg"
        loading={submitting}
        disabled={!canSubmit || submitting}
        onPress={submit}
        style={{ marginTop: space.lg }}
      />
    </View>
  );
}

function InfoRow({ label, value, valueColor, last }) {
  return (
    <View style={[infoStyles.row, !last && infoStyles.border]}>
      <Text style={infoStyles.label}>{label}</Text>
      <Text style={[infoStyles.value, valueColor && { color: valueColor }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: space.lg, gap: space.md },
  typeRow: { flexDirection: 'row', gap: space.sm },
  typeChip: {
    flex: 1, paddingVertical: space.sm, paddingHorizontal: space.md,
    backgroundColor: vantage.bgElevated,
    borderRadius: radius.pill,
    borderWidth: 1, borderColor: vantage.border,
    alignItems: 'center',
  },
  typeChipActive: { backgroundColor: vantage.bgRaised, borderColor: vantage.accent },
  typeTxt: { color: vantage.textMuted, fontFamily, fontSize: sizes.label },
  field: { gap: space.xs },
  label: { color: vantage.textSecondary, fontFamily, fontSize: sizes.label },
  input: {
    backgroundColor: vantage.bgRaised,
    borderRadius: radius.md,
    paddingHorizontal: space.md, paddingVertical: space.md,
    color: vantage.textPrimary, fontFamily, fontSize: sizes.h3, fontWeight: weights.bold,
  },
  tpSlRow: { flexDirection: 'row', gap: space.md },
  infoCard: { marginTop: space.sm },
});

const infoStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: space.sm },
  border: { borderBottomColor: vantage.border, borderBottomWidth: StyleSheet.hairlineWidth },
  label: { color: vantage.textMuted, fontFamily, fontSize: sizes.body },
  value: { color: vantage.textPrimary, fontFamily, fontSize: sizes.body, fontWeight: weights.bold },
});
```

---

### Task D4: PositionsList

**File:** `src/screens/trade/PositionsList.js`

Tabs Positions / Pending. Each row has a close/cancel button.

```js
import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { SegmentedTabs, Card, showToast } from '../../components/vantage';
import { vantage, space, sizes, weights, fontFamily } from '../../theme/vantageTheme';
import ApiService from '../../services/ApiService';

export default function PositionsList({ positions = [], orders = [], onChange }) {
  const [view, setView] = useState('positions');

  const handleClosePosition = useCallback(async (id) => {
    Alert.alert('Close position', 'Confirm closing this position?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Close', style: 'destructive', onPress: async () => {
        try {
          await ApiService.closePosition(id);
          showToast({ kind: 'success', message: 'Position closed' });
          onChange?.();
        } catch (e) {
          showToast({ kind: 'error', message: e?.message || 'Close failed' });
        }
      } },
    ]);
  }, [onChange]);

  const handleCancelOrder = useCallback(async (id) => {
    try {
      await ApiService.cancelOrder(id);
      showToast({ kind: 'success', message: 'Order cancelled' });
      onChange?.();
    } catch (e) {
      showToast({ kind: 'error', message: e?.message || 'Cancel failed' });
    }
  }, [onChange]);

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <SegmentedTabs
          value={view}
          onChange={setView}
          options={[
            { value: 'positions', label: `Positions (${positions.length})` },
            { value: 'pending',   label: `Pending (${orders.length})` },
          ]}
        />
      </View>

      {view === 'positions' ? (
        positions.length === 0 ? (
          <Text style={styles.empty}>No open positions.</Text>
        ) : positions.map((p) => (
          <PositionRow key={p.id || p._id} position={p} onClose={() => handleClosePosition(p.id || p._id)} />
        ))
      ) : (
        orders.length === 0 ? (
          <Text style={styles.empty}>No pending orders.</Text>
        ) : orders.map((o) => (
          <OrderRow key={o.id || o._id} order={o} onCancel={() => handleCancelOrder(o.id || o._id)} />
        ))
      )}
    </View>
  );
}

function PositionRow({ position, onClose }) {
  const side = String(position.side || '').toLowerCase();
  const pl = position.profit ?? position.profit_loss ?? position.pl ?? null;
  const plPositive = pl == null ? true : Number(pl) >= 0;
  return (
    <Card style={styles.card}>
      <View style={styles.cardRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sym}>{position.symbol}</Text>
          <Text style={[styles.side, { color: side === 'buy' ? vantage.up : vantage.down }]}>
            {side.toUpperCase()} {position.volume ?? position.lots ?? '—'} @ {Number(position.open_price ?? position.openPrice ?? 0).toFixed(5)}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.pl, { color: plPositive ? vantage.up : vantage.down }]}>
            {pl != null ? `${plPositive ? '+' : ''}${Number(pl).toFixed(2)}` : '—'} USD
          </Text>
          <Pressable onPress={onClose} hitSlop={8} style={styles.actionBtn}>
            <Ionicons name="close-circle-outline" size={20} color={vantage.textMuted} />
            <Text style={styles.actionTxt}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Card>
  );
}

function OrderRow({ order, onCancel }) {
  const side = String(order.side || '').toLowerCase();
  return (
    <Card style={styles.card}>
      <View style={styles.cardRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sym}>{order.symbol}</Text>
          <Text style={[styles.side, { color: side === 'buy' ? vantage.up : vantage.down }]}>
            {(order.order_type || 'limit').toUpperCase()} {side.toUpperCase()} {order.volume ?? order.lots ?? '—'} @ {Number(order.price ?? 0).toFixed(5)}
          </Text>
        </View>
        <Pressable onPress={onCancel} hitSlop={8} style={styles.actionBtn}>
          <Ionicons name="trash-outline" size={20} color={vantage.down} />
          <Text style={[styles.actionTxt, { color: vantage.down }]}>Cancel</Text>
        </Pressable>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: space.lg, paddingTop: space.md, gap: space.sm },
  headerRow: { paddingBottom: space.sm },
  empty: { color: vantage.textMuted, fontFamily, fontSize: sizes.body, textAlign: 'center', padding: space.lg },
  card: { marginBottom: space.sm },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  sym: { color: vantage.textPrimary, fontFamily, fontSize: sizes.h3, fontWeight: weights.bold },
  side: { fontFamily, fontSize: sizes.label, fontWeight: weights.semibold, marginTop: 2 },
  pl: { fontFamily, fontSize: sizes.h3, fontWeight: weights.heavy },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: space.xs, marginTop: space.sm },
  actionTxt: { color: vantage.textMuted, fontFamily, fontSize: sizes.label },
});
```

---

### Task D5: TradeCFDs sub-view

**File:** `src/screens/trade/TradeCFDs.js`

```js
import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Card, showToast } from '../../components/vantage';
import { vantage, space, sizes, weights, fontFamily } from '../../theme/vantageTheme';

import AccountSwitcher from './AccountSwitcher';
import SymbolPicker from './SymbolPicker';
import OrderTicket from './OrderTicket';
import PositionsList from './PositionsList';

export default function TradeCFDs({
  accounts,
  selectedAccount,
  onSelectAccount,
  symbol,
  onSelectSymbol,
  tick,
  accountSummary,
  positions,
  orders,
  onChange,
}) {
  const [accountSheet, setAccountSheet] = useState(false);
  const [symbolSheet, setSymbolSheet] = useState(false);

  const equity = accountSummary?.equity ?? accountSummary?.balance ?? null;

  return (
    <View>
      <Pressable onPress={() => setAccountSheet(true)} style={styles.accountRow} accessibilityRole="button">
        <View style={{ flex: 1 }}>
          <Text style={styles.tagLine}>{selectedAccount?.is_demo ? 'Demo' : 'Live'} #{selectedAccount?.account_number || selectedAccount?.id || '—'}</Text>
          <Text style={styles.equityValue}>
            {equity != null ? Number(equity).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'} {selectedAccount?.currency || 'USD'}
          </Text>
          <Text style={styles.tagSub}>Equity</Text>
        </View>
        <Ionicons name="chevron-down" size={18} color={vantage.textMuted} />
      </Pressable>

      <Pressable onPress={() => setSymbolSheet(true)} style={styles.symbolRow} accessibilityRole="button">
        <Text style={styles.symbolName}>{symbol || 'Select symbol'}</Text>
        <Ionicons name="chevron-down" size={18} color={vantage.textMuted} />
        <View style={{ flex: 1 }} />
        <Pressable onPress={() => showToast({ kind: 'info', message: 'Chart coming soon' })} hitSlop={8}>
          <Ionicons name="stats-chart" size={22} color={vantage.textPrimary} />
        </Pressable>
      </Pressable>

      <OrderTicket
        accountId={selectedAccount?.id || selectedAccount?._id}
        symbol={symbol}
        tick={tick}
        onPlaced={onChange}
      />

      <PositionsList positions={positions} orders={orders} onChange={onChange} />

      <AccountSwitcher
        visible={accountSheet}
        onClose={() => setAccountSheet(false)}
        accounts={accounts}
        selectedId={selectedAccount?.id || selectedAccount?._id}
        onSelect={onSelectAccount}
      />
      <SymbolPicker
        visible={symbolSheet}
        onClose={() => setSymbolSheet(false)}
        onSelect={onSelectSymbol}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  accountRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: vantage.bgElevated,
    margin: space.lg, padding: space.lg, borderRadius: 16,
  },
  tagLine: { color: vantage.textSecondary, fontFamily, fontSize: sizes.label, fontWeight: weights.semibold },
  equityValue: { color: vantage.textPrimary, fontFamily, fontSize: sizes.hero, fontWeight: weights.heavy, marginTop: 2 },
  tagSub: { color: vantage.textMuted, fontFamily, fontSize: sizes.label, marginTop: 2 },
  symbolRow: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    paddingHorizontal: space.lg, paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: vantage.border,
  },
  symbolName: { color: vantage.textPrimary, fontFamily, fontSize: sizes.h2, fontWeight: weights.heavy },
});
```

---

### Task D6: TradeCopy sub-view

**File:** `src/screens/trade/TradeCopy.js`

```js
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { Card, SegmentedTabs, CategoryTabs, SymbolIcon, PillButton } from '../../components/vantage';
import { vantage, space, sizes, weights, fontFamily, radius } from '../../theme/vantageTheme';
import ApiService from '../../services/ApiService';

const SORT_OPTIONS = [
  { value: 'most_copied',     label: 'Most Copied' },
  { value: 'highest_return',  label: 'Highest Return' },
  { value: 'highest_win_rate',label: 'Highest Win Rate' },
];

export default function TradeCopy() {
  const nav = useNavigation();
  const [tab, setTab] = useState('discover');
  const [sort, setSort] = useState('most_copied');
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await ApiService.getLeaderboard({ sort, limit: 30 });
        const list = Array.isArray(res) ? res : (Array.isArray(res?.items) ? res.items : []);
        if (!cancelled) setProviders(list);
      } catch (_) {
        if (!cancelled) setProviders([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [sort]);

  const top1 = providers[0];
  const rest = providers.slice(1);

  return (
    <View>
      <Card style={styles.becomeCard} onPress={() => nav.navigate('Business')}>
        <View style={styles.becomeRow}>
          <View style={[styles.iconCircle, { backgroundColor: vantage.accentMuted }]}>
            <Ionicons name="radio-outline" size={22} color={vantage.accent} />
          </View>
          <Text style={styles.becomeTxt}>Become a Signal Provider</Text>
          <Ionicons name="chevron-forward" size={18} color={vantage.textMuted} />
        </View>
      </Card>

      <View style={{ paddingHorizontal: space.lg }}>
        <SegmentedTabs
          value={tab}
          onChange={setTab}
          options={[
            { value: 'discover',  label: 'Discover' },
            { value: 'community', label: 'Community' },
          ]}
        />
      </View>

      {tab === 'discover' ? (
        <>
          {top1 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Best Overall Strategy</Text>
              <Card onPress={() => nav.navigate('StrategyDetail', { providerId: top1.id || top1.provider_id })}>
                <BigStrategyRow item={top1} />
              </Card>
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Leaderboards</Text>
            <CategoryTabs value={sort} onChange={setSort} options={SORT_OPTIONS} />
            {loading ? (
              <Text style={styles.empty}>Loading…</Text>
            ) : rest.length === 0 ? (
              <Text style={styles.empty}>No strategies yet.</Text>
            ) : rest.map((p) => (
              <Pressable
                key={p.id || p.provider_id || p.name}
                onPress={() => nav.navigate('StrategyDetail', { providerId: p.id || p.provider_id })}
                android_ripple={{ color: vantage.bgPressed }}
                style={styles.row}
              >
                <StrategyMiniRow item={p} />
              </Pressable>
            ))}
          </View>
        </>
      ) : (
        <View style={styles.section}>
          <Text style={styles.empty}>Community feed coming soon.</Text>
        </View>
      )}
    </View>
  );
}

function BigStrategyRow({ item }) {
  const ret = Number(item.return_30d ?? item.roi_30d ?? 0);
  const positive = ret >= 0;
  const aum = item.aum ?? item.aum_usd ?? null;
  return (
    <View style={bigStyles.wrap}>
      <View style={bigStyles.head}>
        <SymbolIcon symbol={(item.symbol || item.name || 'ST').slice(0, 2).toUpperCase()} size={40} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={bigStyles.name}>{item.name || 'Strategy'}</Text>
          {item.category ? (
            <View style={bigStyles.badge}><Text style={bigStyles.badgeTxt}>{item.category}</Text></View>
          ) : null}
        </View>
        {item.is_full ? <Text style={bigStyles.full}>Full</Text> : null}
      </View>
      <View style={bigStyles.statsRow}>
        <View style={{ flex: 1 }}>
          <Text style={bigStyles.lab}>30D Return</Text>
          <Text style={[bigStyles.val, { color: positive ? vantage.up : vantage.down }]}>
            {`${positive ? '+' : ''}${ret.toFixed(2)}%`}
          </Text>
        </View>
        {aum != null ? (
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <Text style={bigStyles.lab}>AUM (USD)</Text>
            <Text style={bigStyles.aum}>{Number(aum).toLocaleString('en-US', { maximumFractionDigits: 2 })}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function StrategyMiniRow({ item }) {
  const ret = Number(item.return_30d ?? item.roi_30d ?? 0);
  const positive = ret >= 0;
  const aum = item.aum ?? item.aum_usd ?? null;
  return (
    <View style={miniStyles.row}>
      <SymbolIcon symbol={(item.symbol || item.name || 'ST').slice(0, 2).toUpperCase()} size={36} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={miniStyles.name} numberOfLines={1}>{item.name || 'Strategy'}</Text>
        {item.follower_count != null ? (
          <Text style={miniStyles.sub} numberOfLines={1}>{item.follower_count} followers</Text>
        ) : null}
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        {aum != null ? <Text style={miniStyles.aum}>{Number(aum).toLocaleString('en-US', { maximumFractionDigits: 0 })} USD</Text> : null}
        <Text style={[miniStyles.ret, { color: positive ? vantage.up : vantage.down }]}>
          {`${positive ? '+' : ''}${ret.toFixed(2)}%`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  becomeCard: { margin: space.lg },
  becomeRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  iconCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  becomeTxt: { flex: 1, color: vantage.textPrimary, fontFamily, fontSize: sizes.body, fontWeight: weights.semibold },
  section: { paddingHorizontal: space.lg, paddingVertical: space.md, gap: space.sm },
  sectionTitle: { color: vantage.textPrimary, fontFamily, fontSize: sizes.h2, fontWeight: weights.heavy, marginBottom: space.sm },
  empty: { color: vantage.textMuted, fontFamily, fontSize: sizes.body, padding: space.lg, textAlign: 'center' },
  row: { paddingVertical: space.sm },
});

const bigStyles = StyleSheet.create({
  wrap: { padding: space.sm, gap: space.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  name: { color: vantage.textPrimary, fontFamily, fontSize: sizes.h2, fontWeight: weights.heavy },
  badge: { alignSelf: 'flex-start', backgroundColor: vantage.bgPressed, paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: radius.sm, marginTop: 2 },
  badgeTxt: { color: vantage.textSecondary, fontFamily, fontSize: sizes.micro, fontWeight: weights.medium },
  full: { color: vantage.textMuted, fontFamily, fontSize: sizes.label, fontWeight: weights.semibold, backgroundColor: vantage.bgPressed, paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: radius.sm },
  statsRow: { flexDirection: 'row' },
  lab: { color: vantage.textMuted, fontFamily, fontSize: sizes.label },
  val: { fontFamily, fontSize: sizes.h1, fontWeight: weights.heavy, marginTop: 2 },
  aum: { color: vantage.textPrimary, fontFamily, fontSize: sizes.h2, fontWeight: weights.heavy, marginTop: 2 },
});

const miniStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  name: { color: vantage.textPrimary, fontFamily, fontSize: sizes.h3, fontWeight: weights.bold },
  sub: { color: vantage.textMuted, fontFamily, fontSize: sizes.label, marginTop: 2 },
  aum: { color: vantage.textPrimary, fontFamily, fontSize: sizes.body, fontWeight: weights.bold },
  ret: { fontFamily, fontSize: sizes.label, fontWeight: weights.bold, marginTop: 2 },
});
```

---

### Task D7: TradeScreen orchestrator

**File (modify):** `src/screens/TradeScreen.js`

```js
import React, { useEffect, useState, useCallback } from 'react';
import { ScrollView, RefreshControl, StyleSheet } from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';

import { Screen } from '../components/vantage';
import { vantage, space } from '../theme/vantageTheme';
import ApiService from '../services/ApiService';
import webSocketService from '../services/WebSocketService';
import { BOTTOM_NAV_PILL_HEIGHT } from '../components/vantage/BottomNavPill';

import MarketsHeader from './markets/MarketsHeader';
import TradeCFDs from './trade/TradeCFDs';
import TradeCopy from './trade/TradeCopy';

const DEFAULT_SYMBOL = 'EURUSD';

export default function TradeScreen() {
  const nav = useNavigation();
  const route = useRoute();
  const [view, setView] = useState('cfds');

  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [accountSummary, setAccountSummary] = useState(null);
  const [symbol, setSymbol] = useState(route.params?.symbol || DEFAULT_SYMBOL);
  const [tick, setTick] = useState(null);
  const [positions, setPositions] = useState([]);
  const [orders, setOrders] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const accountId = selectedAccount?.id || selectedAccount?._id;

  useEffect(() => {
    if (route.params?.symbol) setSymbol(route.params.symbol);
  }, [route.params?.symbol]);

  const loadAccounts = useCallback(async () => {
    try {
      const res = await ApiService.getAccounts();
      const list = Array.isArray(res) ? res : (Array.isArray(res?.items) ? res.items : []);
      setAccounts(list);
      if (!selectedAccount && list[0]) setSelectedAccount(list[0]);
    } catch (_) { setAccounts([]); }
  }, [selectedAccount]);

  const refreshAccountData = useCallback(async () => {
    if (!accountId) return;
    const [summary, pos, ords] = await Promise.allSettled([
      ApiService.getAccountSummary(accountId),
      ApiService.getPositions(accountId, 'open'),
      ApiService.getOrders(accountId, 'pending'),
    ]);
    if (summary.status === 'fulfilled') setAccountSummary(summary.value);
    if (pos.status === 'fulfilled') {
      const list = Array.isArray(pos.value) ? pos.value : (Array.isArray(pos.value?.items) ? pos.value.items : []);
      setPositions(list);
    }
    if (ords.status === 'fulfilled') {
      const list = Array.isArray(ords.value) ? ords.value : (Array.isArray(ords.value?.items) ? ords.value.items : []);
      setOrders(list);
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

  useEffect(() => { loadAccounts(); }, [loadAccounts]);

  useEffect(() => { refreshAccountData(); }, [refreshAccountData]);

  useEffect(() => { refreshTick(); }, [refreshTick]);

  useFocusEffect(useCallback(() => {
    refreshAccountData();
    refreshTick();
  }, [refreshAccountData, refreshTick]));

  // Live WS price ticks for the selected symbol.
  useEffect(() => {
    if (typeof webSocketService?.onPriceUpdate !== 'function') return;
    const unsubscribe = webSocketService.onPriceUpdate((msg) => {
      if (!msg) return;
      const sym = String(msg.symbol || msg.s || '').toUpperCase();
      if (sym !== symbol.toUpperCase()) return;
      setTick((prev) => ({ ...(prev || {}), symbol: sym, bid: msg.bid != null ? Number(msg.bid) : prev?.bid, ask: msg.ask != null ? Number(msg.ask) : prev?.ask }));
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
      <MarketsHeader
        view={view}
        onChangeView={setView}
        onSearch={() => nav.navigate('MarketsTab')}
      />
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
            onSelectAccount={setSelectedAccount}
            symbol={symbol}
            onSelectSymbol={setSymbol}
            tick={tick}
            accountSummary={accountSummary}
            positions={positions}
            orders={orders}
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
  scroll: {},
});
```

**Note:** The header tabs are labeled "Watchlist | Explore" via the shared `MarketsHeader`. For Trade we override with CFDs | Copy by passing a custom options array — actually `MarketsHeader` is hardcoded to those labels. Replace with inline `SegmentedTabs` for Trade:

In the orchestrator above, replace the `MarketsHeader` line with:

```jsx
import { SegmentedTabs } from '../components/vantage';
// ...
<View style={{ paddingHorizontal: space.lg, paddingTop: space.sm }}>
  <SegmentedTabs
    value={view}
    onChange={setView}
    options={[
      { value: 'cfds', label: 'CFDs' },
      { value: 'copy', label: 'Copy' },
    ]}
  />
</View>
```

Drop the `MarketsHeader` import.

---

### Task D8: StrategyDetailScreen

**File:** `src/screens/trade/StrategyDetailScreen.js`

```js
import React, { useEffect, useState } from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';

import { Screen, Card, PillButton, SymbolIcon, IconButton, StatCard, showToast } from '../../components/vantage';
import { vantage, space, sizes, weights, fontFamily } from '../../theme/vantageTheme';
import ApiService from '../../services/ApiService';

export default function StrategyDetailScreen() {
  const nav = useNavigation();
  const route = useRoute();
  const providerId = route.params?.providerId;

  const [provider, setProvider] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Try a leaderboard fetch and find by ID; fallback if backend has /social/providers/:id
        const res = await ApiService.getLeaderboard({ limit: 50 });
        const list = Array.isArray(res) ? res : (Array.isArray(res?.items) ? res.items : []);
        const found = list.find((p) => (p.id || p.provider_id) === providerId);
        if (!cancelled) setProvider(found || null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [providerId]);

  if (loading) {
    return (
      <Screen edges={['top']}>
        <BackHeader onBack={() => nav.goBack()} />
        <Text style={styles.empty}>Loading…</Text>
      </Screen>
    );
  }

  if (!provider) {
    return (
      <Screen edges={['top']}>
        <BackHeader onBack={() => nav.goBack()} />
        <Text style={styles.empty}>Strategy not found.</Text>
      </Screen>
    );
  }

  const ret30 = Number(provider.return_30d ?? provider.roi_30d ?? 0);
  const positive30 = ret30 >= 0;
  const aum = provider.aum ?? provider.aum_usd ?? null;
  const followers = provider.follower_count ?? null;
  const winRate = provider.win_rate ?? null;
  const drawdown = provider.max_drawdown ?? provider.drawdown ?? null;

  return (
    <Screen edges={['top']}>
      <BackHeader onBack={() => nav.goBack()} />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: space.huge }}>
        <View style={styles.head}>
          <SymbolIcon symbol={(provider.symbol || provider.name || 'ST').slice(0, 2).toUpperCase()} size={56} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{provider.name || 'Strategy'}</Text>
            {provider.category ? <Text style={styles.sub}>{provider.category}</Text> : null}
            {followers != null ? <Text style={styles.sub}>{followers} followers</Text> : null}
          </View>
          {provider.is_full ? <Text style={styles.full}>Full</Text> : null}
        </View>

        <View style={styles.statsRow}>
          <StatCard label="30D Return" value={`${positive30 ? '+' : ''}${ret30.toFixed(2)}%`} delta={`${positive30 ? 'Gain' : 'Loss'}`} deltaPositive={positive30} />
          {aum != null ? <StatCard label="AUM (USD)" value={Number(aum).toLocaleString('en-US', { maximumFractionDigits: 0 })} /> : null}
          {winRate != null ? <StatCard label="Win Rate" value={`${Number(winRate).toFixed(1)}%`} /> : null}
          {drawdown != null ? <StatCard label="Max Drawdown" value={`${Number(drawdown).toFixed(2)}%`} /> : null}
        </View>

        <Card style={{ marginTop: space.lg }}>
          <Row label="Strategy ID" value={String(provider.id || provider.provider_id || '—')} />
          <Row label="Category" value={provider.category || '—'} />
          <Row label="Allocations" value={provider.allocation_count != null ? String(provider.allocation_count) : '—'} last />
        </Card>

        <PillButton
          label={provider.is_full ? 'Strategy is full' : 'Copy Strategy'}
          variant="primary"
          size="lg"
          disabled={!!provider.is_full}
          onPress={() => showToast({ kind: 'info', message: 'Copy flow coming soon' })}
          style={{ marginTop: space.xl }}
        />
      </ScrollView>
    </Screen>
  );
}

function BackHeader({ onBack }) {
  return (
    <View style={styles.header}>
      <IconButton icon={<Ionicons name="chevron-back" size={22} color={vantage.textPrimary} />} accessibilityLabel="Back" onPress={onBack} />
    </View>
  );
}

function Row({ label, value, last }) {
  return (
    <View style={[rowStyles.row, !last && rowStyles.border]}>
      <Text style={rowStyles.label}>{label}</Text>
      <Text style={rowStyles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: space.sm, paddingTop: space.sm },
  empty: { color: vantage.textMuted, fontFamily, fontSize: sizes.body, padding: space.huge, textAlign: 'center' },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  name: { color: vantage.textPrimary, fontFamily, fontSize: sizes.h1, fontWeight: weights.heavy },
  sub: { color: vantage.textMuted, fontFamily, fontSize: sizes.label, marginTop: 2 },
  full: { color: vantage.textMuted, fontFamily, fontSize: sizes.label, fontWeight: weights.semibold, backgroundColor: vantage.bgPressed, paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: 6 },
  statsRow: { flexDirection: 'row', gap: space.md, marginTop: space.lg, flexWrap: 'wrap' },
});

const rowStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: space.sm },
  border: { borderBottomColor: vantage.border, borderBottomWidth: StyleSheet.hairlineWidth },
  label: { color: vantage.textMuted, fontFamily, fontSize: sizes.body },
  value: { color: vantage.textPrimary, fontFamily, fontSize: sizes.body, fontWeight: weights.bold },
});
```

---

### Task D9: Register routes

**File (modify):** `src/navigation/TradeStack.js`

```js
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import TradeScreen from '../screens/TradeScreen';
import StrategyDetailScreen from '../screens/trade/StrategyDetailScreen';

const Stack = createNativeStackNavigator();

export default function TradeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#000' } }}>
      <Stack.Screen name="Trade" component={TradeScreen} />
      <Stack.Screen name="StrategyDetail" component={StrategyDetailScreen} />
    </Stack.Navigator>
  );
}
```

---

### Smoke test

- Open Trade tab → CFDs view default.
- Account row shows Live/Demo + equity. Tap → bottom sheet lists accounts.
- Symbol row shows current symbol. Tap → search modal. Pick another symbol → form updates.
- BuySellSplit shows bid/ask + spread. Tap to switch sides.
- Order type chip toggles Market/Limit/Stop. Limit/Stop reveals price field.
- Volume stepper + slider preset.
- TP/SL checkbox toggles SL/TP fields.
- Submit a small market order on a Demo account — toast "BUY 0.1 SYMBOL placed". Position appears in Positions list.
- Tap Close on the position → confirmation alert → close succeeds.
- Switch to Copy tab → Discover view → Best Overall card + Leaderboards.
- Tap a strategy → StrategyDetail with stats + Copy Strategy button (info toast).
