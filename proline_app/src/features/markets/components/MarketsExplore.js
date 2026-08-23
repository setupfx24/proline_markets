import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import {
  Card,
  CategoryTabs,
  QuickActionTile,
  SpotlightCard,
  MoversBars,
  InstrumentRow,
} from '../../../components/vantage';
import { vantage, space, sizes, weights, fontFamily, radius } from '../../../theme/vantageTheme';
import { topRisers, topFallers, bySegment, MARQUEE_SPOTLIGHT } from '../../../utils/marketMovers';

// Stable fallback so memoized rows don't see a fresh [] identity every render.
const EMPTY_SPARK = [];

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
        price: p.bid != null ? Number(p.bid) : (p.price != null ? Number(p.price) : null),
        changePct: p.change_pct != null ? Number(p.change_pct) : (p.changePct != null ? Number(p.changePct) : null),
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
    // Full instrument set for the segment (same set the website shows).
    return bySegment(instruments, segment);
  }, [instruments, segment]);

  // Paginate the list — render PAGE rows and grow on demand, so switching
  // segments never dumps 100+ rows into the scroll view at once.
  const ESSENTIALS_PAGE = 15;
  const [essentialsShown, setEssentialsShown] = useState(ESSENTIALS_PAGE);
  useEffect(() => { setEssentialsShown(ESSENTIALS_PAGE); }, [segment]);
  const essentialsVisible = essentials.slice(0, essentialsShown);
  const essentialsRemaining = essentials.length - essentialsVisible.length;

  return (
    <View>
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
        ) : essentialsVisible.map((i) => {
          const sym = String(i.symbol || '').toUpperCase();
          const p = pricesBySymbol[sym] || {};
          return (
            <InstrumentRow
              key={sym}
              symbol={sym}
              name={sym}
              subtitle={i.display_name || i.name || undefined}
              price={p.bid != null ? Number(p.bid) : (p.price != null ? Number(p.price) : null)}
              changePct={p.change_pct != null ? Number(p.change_pct) : (p.changePct != null ? Number(p.changePct) : null)}
              sparkData={sparksBySymbol[sym] || EMPTY_SPARK}
              onPress={onPressInstrument}
              upColor="#FBAA45"
            />
          );
        })}
        {essentialsRemaining > 0 ? (
          <Pressable
            onPress={() => setEssentialsShown((n) => n + ESSENTIALS_PAGE)}
            style={styles.showMoreBtn}
            accessibilityRole="button"
            accessibilityLabel={`Show ${Math.min(ESSENTIALS_PAGE, essentialsRemaining)} more instruments`}
          >
            <Text style={styles.showMoreTxt}>Show more ({essentialsRemaining} remaining)</Text>
            <Ionicons name="chevron-down" size={16} color={vantage.textSecondary} />
          </Pressable>
        ) : null}
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
  showMoreBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: space.md, marginTop: space.xs,
    borderWidth: 1, borderColor: vantage.border, borderRadius: radius.md, backgroundColor: vantage.bgRaised,
  },
  showMoreTxt: { color: vantage.textSecondary, fontFamily, fontSize: sizes.label, fontWeight: weights.semibold },
});
