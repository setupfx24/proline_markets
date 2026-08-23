import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { InstrumentRow, CategoryTabs, GradientActionButton } from '../../../components/vantage';
import { vantage, space, sizes, weights, fontFamily, radius } from '../../../theme/vantageTheme';
import { bySegment } from '../../../utils/marketMovers';

const WATCHLIST_PAGE = 15;
// Stable fallback so memoized rows don't see a fresh [] identity every render.
const EMPTY_SPARK = [];

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

  const matching = useMemo(() => {
    if (filter === 'all') return pinnedSymbols;
    const allowed = new Set(
      bySegment(instruments, filter).map((i) => String(i.symbol || '').toUpperCase())
    );
    return pinnedSymbols.filter((s) => allowed.has(String(s).toUpperCase()));
  }, [filter, pinnedSymbols, instruments]);

  // Paginate — a page of rows plus "Show more", so a big watchlist doesn't
  // become one endless scroll. Resets when the category filter changes.
  const [shown, setShown] = useState(WATCHLIST_PAGE);
  useEffect(() => { setShown(WATCHLIST_PAGE); }, [filter]);
  const visible = matching.slice(0, shown);
  const remaining = matching.length - visible.length;

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
              name={upper}
              subtitle={inst?.display_name || inst?.name || undefined}
              price={p.bid != null ? Number(p.bid) : (p.price != null ? Number(p.price) : null)}
              changePct={p.change_pct != null ? Number(p.change_pct) : (p.changePct != null ? Number(p.changePct) : null)}
              sparkData={sparksBySymbol[upper] || EMPTY_SPARK}
              onPress={onPressInstrument}
              upColor="#FBAA45"
            />
          );
        })
      )}
      {remaining > 0 ? (
        <Pressable
          onPress={() => setShown((n) => n + WATCHLIST_PAGE)}
          style={styles.showMoreBtn}
          accessibilityRole="button"
          accessibilityLabel={`Show ${Math.min(WATCHLIST_PAGE, remaining)} more pinned instruments`}
        >
          <Text style={styles.showMoreTxt}>Show more ({remaining} remaining)</Text>
          <Ionicons name="chevron-down" size={16} color={vantage.textSecondary} />
        </Pressable>
      ) : null}

      <GradientActionButton
        label="Add Symbol"
        onPress={onAdd || (() => nav.navigate('WatchlistEdit'))}
        style={styles.addSymbol}
        accessibilityLabel="Add symbol to watchlist"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  filterRow: { flexDirection: 'row', alignItems: 'center', paddingRight: space.lg, gap: space.sm },
  emptyWrap: { alignItems: 'center', paddingVertical: space.huge, paddingHorizontal: space.xl, gap: space.sm },
  emptyTitle: { color: vantage.textPrimary, fontFamily, fontSize: sizes.h3, fontWeight: weights.bold },
  emptySub: { color: vantage.textMuted, fontFamily, fontSize: sizes.body },
  emptyInline: { color: vantage.textMuted, fontFamily, fontSize: sizes.body, padding: space.lg, textAlign: 'center' },
  showMoreBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginHorizontal: space.lg, marginTop: space.sm, paddingVertical: space.md,
    borderWidth: 1, borderColor: vantage.border, borderRadius: radius.md, backgroundColor: vantage.bgRaised,
  },
  showMoreTxt: { color: vantage.textSecondary, fontFamily, fontSize: sizes.label, fontWeight: weights.semibold },
  addSymbol: {
    marginHorizontal: space.lg, marginTop: space.lg,
  },
});
