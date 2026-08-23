import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { InstrumentRow, GradientActionButton } from '../../../components/vantage';
import { vantage, space, sizes, weights, fontFamily } from '../../../theme/vantageTheme';
import { getWatchlist } from '../../markets/watchlist/watchlistStorage';
import { getSparkData } from '../../../utils/sparklineCache';

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
          <Text style={styles.viewAll}>View All</Text>
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
            onPress={() => nav.navigate('MarketsTab', { screen: 'InstrumentDetail', params: { symbol: sym } })}
            card
            upColor="#FBAA45"
          />
        );
      })}
      <GradientActionButton
        label="Add Symbol"
        onPress={handleSeeAll}
        style={styles.addSymbol}
        accessibilityLabel="Add symbol"
      />
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
  viewAll: { color: vantage.accent, fontFamily, fontSize: sizes.body, fontWeight: weights.semibold },
  empty: { color: vantage.textMuted, fontFamily, fontSize: sizes.label, paddingHorizontal: space.lg, paddingBottom: space.md },
  addSymbol: {
    marginHorizontal: space.lg, marginTop: space.md,
  },
});
