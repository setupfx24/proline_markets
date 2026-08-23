import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { sizes, weights, fontFamily } from '../../theme/vantageTheme';

const SYMBOL_COLORS = {
  XAUUSD:   { bg: '#E8A53A', initials: 'Au' },
  XAGUSD:   { bg: '#B8C2CC', initials: 'Ag' },
  BTCUSD:   { bg: '#F7931A', initials: '₿' },
  ETHUSD:   { bg: '#627EEA', initials: 'Ξ' },
  EURUSD:   { bg: '#3D7AC7', initials: 'EU' },
  GBPUSD:   { bg: '#7E3D7B', initials: 'UK' },
  USDJPY:   { bg: '#BC002D', initials: '¥' },
  NAS100:   { bg: '#3DA0E2', initials: '100' },
  Nikkei225:{ bg: '#1A2D5E', initials: '225' },
  JPN225ft: { bg: '#FFFFFF', initials: '•',  fg: '#BC002D' },
  HK50:     { bg: '#E5343D', initials: '✦' },
  HK50ft:   { bg: '#E5343D', initials: '✦' },
  DJ30:     { bg: '#3A8FE0', initials: 'DJ' },
  SP500:    { bg: '#4DA89B', initials: '500' },
};

// Fallback for non-market symbols (e.g. trader initials like "KA"): a distinct
// orange shade per string so avatars read clearly on both light and dark
// themes. Lightness is kept mid-range so white text stays legible.
function hashColor(sym) {
  let h = 0;
  for (let i = 0; i < sym.length; i++) h = (h * 31 + sym.charCodeAt(i)) & 0xffffff;
  const hue = 14 + (h % 22);          // 14–35° → red-orange to amber
  const sat = 78 + (h % 14);          // 78–92%
  const light = 44 + (h % 10);        // 44–54%
  return `hsl(${hue}, ${sat}%, ${light}%)`;
}

export default function SymbolIcon({ symbol, size = 40 }) {
  const cfg = SYMBOL_COLORS[symbol];
  // Rounded-rectangle tile (10px radius) with a warm sand background and a
  // deep red glyph so the initials stay readable on both light and dark
  // themes. The configured glyphs/initials (e.g. "Au", "₿", "225") are still
  // used for the label.
  const bg = '#FDCB8E';
  const fg = '#C3350F';
  const initials = cfg ? cfg.initials : symbol.slice(0, 2).toUpperCase();
  const fontSize = Math.max(10, Math.floor(size * 0.36));

  return (
    <View style={[styles.base, { width: size, height: size, borderRadius: 10, backgroundColor: bg }]}>
      <Text style={{ color: fg, fontFamily, fontSize, fontWeight: weights.heavy }}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
});
