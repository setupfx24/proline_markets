import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Circle, Text as SvgText } from 'react-native-svg';
import Card from './Card';
import SymbolIcon from './SymbolIcon';
import { vantage, space, sizes, weights, fontFamily } from '../../theme/vantageTheme';

export default function SpotlightCard({ title = 'Spotlight', items, brandLabel = 'PM' }) {
  return (
    <Card padding={0}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Svg width={56} height={56} style={styles.glow}>
          <Defs>
            <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={vantage.accentGlow} stopOpacity="0.95" />
              <Stop offset="1" stopColor={vantage.accent} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx="28" cy="28" r="26" fill="url(#glow)" />
          <SvgText
            x="28" y="34"
            fontSize="13" fontWeight="800"
            fill={vantage.textPrimary}
            textAnchor="middle"
          >{brandLabel}</SvgText>
        </Svg>
      </View>
      <Card variant="raised" style={styles.body}>
        {items.map((it, i) => (
          <View key={it.symbol} style={[styles.row, i < items.length - 1 && styles.rowBorder]}>
            <SymbolIcon symbol={it.symbol} size={36} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.sym}>{it.symbol}</Text>
              {it.subtitle ? <Text style={styles.sub}>{it.subtitle}</Text> : null}
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              {(() => {
                const hasPrice = it.price != null && Number.isFinite(Number(it.price));
                const hasPct = it.changePct != null && Number.isFinite(Number(it.changePct));
                return (
                  <>
                    <Text style={styles.price}>{hasPrice ? Number(it.price).toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—'}</Text>
                    <Text style={[styles.pct, { color: hasPct ? (it.changePct >= 0 ? vantage.up : vantage.down) : vantage.textMuted }]}>
                      {hasPct ? `${it.changePct >= 0 ? '+' : ''}${Number(it.changePct).toFixed(2)}%` : '—'}
                    </Text>
                  </>
                );
              })()}
            </View>
          </View>
        ))}
      </Card>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: space.lg, paddingBottom: 0 },
  title: { color: vantage.textPrimary, fontFamily, fontSize: sizes.h2, fontWeight: weights.heavy },
  glow: {},
  body: { margin: space.md, padding: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  rowBorder: { borderBottomColor: vantage.border, borderBottomWidth: StyleSheet.hairlineWidth },
  sym: { color: vantage.textPrimary, fontFamily, fontSize: sizes.h3, fontWeight: weights.bold },
  sub: { color: vantage.textMuted, fontFamily, fontSize: sizes.label, marginTop: 2 },
  price: { color: vantage.textPrimary, fontFamily, fontSize: sizes.h3, fontWeight: weights.bold },
  pct: { fontFamily, fontSize: sizes.label, fontWeight: weights.semibold, marginTop: 2 },
});
