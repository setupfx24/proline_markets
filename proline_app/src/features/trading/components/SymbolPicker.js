import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, TextInput, FlatList, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Sheet, SymbolIcon } from '../../../components/vantage';
import { vantage, space, sizes, weights, fontFamily, radius } from '../../../theme/vantageTheme';
import { getInstruments } from '../../../utils/instrumentsCache';

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
