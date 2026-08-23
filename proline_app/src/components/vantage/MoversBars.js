import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Rect, Defs, LinearGradient, Stop } from 'react-native-svg';
import { vantage, space, sizes, weights, fontFamily } from '../../theme/vantageTheme';

export default function MoversBars({ items, direction = 'up' }) {
  const max = Math.max(...items.map(i => Math.abs(i.changePct)), 1);
  const color = direction === 'up' ? vantage.up : vantage.down;
  return (
    <View style={styles.row}>
      {items.map((it, idx) => {
        const h = Math.max(0.15, Math.abs(it.changePct) / max);
        const pctTxt = `${it.changePct >= 0 ? '+' : ''}${it.changePct.toFixed(2)}%`;
        return (
          <View key={it.symbol + idx} style={styles.col}>
            <Text style={[styles.pct, { color }]}>{pctTxt}</Text>
            <Svg width={36} height={120}>
              <Defs>
                <LinearGradient id={`g${idx}`} x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={color} stopOpacity="1" />
                  <Stop offset="1" stopColor={color} stopOpacity="0.2" />
                </LinearGradient>
              </Defs>
              <Rect x="8" y="0" width="20" height="120" fill={vantage.bgPressed} rx="4" />
              <Rect x="8" y={120 * (1 - h)} width="20" height={120 * h} fill={`url(#g${idx})`} rx="4" />
              <Rect x="6" y={120 * (1 - h) - 1} width="24" height="4" fill={color} rx="2" />
            </Svg>
            <Text style={styles.sym}>{it.symbol}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: space.sm, paddingVertical: space.sm },
  col: { alignItems: 'center', gap: space.xs },
  pct: { fontFamily, fontSize: sizes.label, fontWeight: weights.bold },
  sym: { color: vantage.textPrimary, fontFamily, fontSize: sizes.label, fontWeight: weights.semibold },
});
