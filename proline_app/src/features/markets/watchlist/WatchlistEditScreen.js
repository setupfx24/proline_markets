import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, TextInput, FlatList, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { Screen, IconButton, SymbolIcon, CategoryTabs } from '../../../components/vantage';
import { BOTTOM_NAV_PILL_HEIGHT } from '../../../components/vantage/BottomNavPill';
import { vantage, space, sizes, weights, fontFamily, radius } from '../../../theme/vantageTheme';
import { getInstruments } from '../../../utils/instrumentsCache';
import { getWatchlist, setWatchlist } from './watchlistStorage';
import { bySegment } from '../../../utils/marketMovers';

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

  const matching = useMemo(() => {
    let list = filter === 'all' ? instruments : bySegment(instruments, filter);
    const q = query.trim().toUpperCase();
    if (q) {
      list = list.filter((i) => {
        const sym = String(i.symbol || '').toUpperCase();
        const name = String(i.display_name || i.name || '').toUpperCase();
        return sym.includes(q) || name.includes(q);
      });
    }
    return list;
  }, [instruments, filter, query]);

  // Paged infinite scroll — window the list and grow near the end instead of
  // rendering every instrument at once. Resets on search/filter change.
  const EDIT_PAGE = 30;
  const [shown, setShown] = useState(EDIT_PAGE);
  useEffect(() => { setShown(EDIT_PAGE); }, [filter, query]);
  const visible = matching.slice(0, shown);

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
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: BOTTOM_NAV_PILL_HEIGHT + space.lg }}
        onEndReachedThreshold={0.4}
        onEndReached={() => setShown((n) => (n < matching.length ? n + EDIT_PAGE : n))}
        ListFooterComponent={matching.length > shown ? (
          <Text style={styles.pagingFooter}>Showing {shown} of {matching.length} — scroll for more</Text>
        ) : null}
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
  pagingFooter: { color: vantage.textMuted, fontFamily, fontSize: sizes.label, textAlign: 'center', paddingVertical: space.md },
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
