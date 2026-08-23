import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from './Card';
import SymbolIcon from './SymbolIcon';
import Sparkline from './Sparkline';
import { vantage, space, sizes, weights, fontFamily, radius } from '../../theme/vantageTheme';

export default function StrategyCard({
  name,
  category,
  metricLabel = '30D Return',
  metricValue,
  metricSigned = true,
  followers,
  riskScore = 'Moderate',
  winRate,
  chartData,
  status,
  avatarSymbol,
  onPress,
  width = 220,
}) {
  const hasMetric = typeof metricValue === 'number' && Number.isFinite(metricValue);
  const positive = (metricValue ?? 0) >= 0;
  // Home Copy-Trade cards use the brand gold for positive returns.
  const metricColor = metricSigned ? (positive ? '#FBAA45' : vantage.down) : '#FBAA45';

  const chart = Array.isArray(chartData) && chartData.length >= 2
    ? chartData
    : genSeries(name, metricValue, winRate);
  const chartW = Math.round(width * 0.42);

  return (
    <Card onPress={onPress} style={{ width }} padding={space.md}>
      <View style={styles.body}>
        <View style={styles.left}>
          <View style={styles.head}>
            <SymbolIcon symbol={avatarSymbol || name?.slice(0, 2) || '??'} size={36} />
            <View style={styles.headText}>
              <Text style={styles.name} numberOfLines={1}>{name}</Text>
              {category ? <Text style={styles.category} numberOfLines={1}>{category}</Text> : null}
            </View>
            {status === 'full' ? <View style={styles.full}><Text style={styles.fullTxt}>Full</Text></View> : null}
          </View>
          <Text style={styles.lab}>{metricLabel}</Text>
          <Text style={[styles.val, { color: metricColor }]}>
            {hasMetric ? `${metricSigned && positive ? '+' : ''}${metricValue.toFixed(2)}%` : '—'}
          </Text>
        </View>
        <View style={styles.chart}>
          <Sparkline data={chart} color={vantage.accent} width={chartW} height={72} strokeWidth={2} fill />
        </View>
      </View>
    </Card>
  );
}

function Stat({ icon, label, value }) {
  return (
    <View style={styles.stat}>
      <View style={styles.statHead}>
        <Ionicons name={icon} size={13} color={vantage.textMuted} />
        <Text style={styles.statLab} numberOfLines={1}>{label}</Text>
      </View>
      <Text style={styles.statVal} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function fmtFollowers(v) {
  if (v == null || !Number.isFinite(Number(v))) return '—';
  return Number(v).toLocaleString('en-US');
}

// Deterministic upward-drifting series so every card shows a chart even before a
// real equity curve is available. Seeded by name + headline metric for variety.
function genSeries(name = '', metric = 8, winRate = 60) {
  let seed = winRate || 60;
  for (let i = 0; i < name.length; i++) seed += name.charCodeAt(i);
  const up = (metric ?? 0) >= 0 ? 1 : -1;
  const out = [];
  let v = 50;
  for (let i = 0; i < 24; i++) {
    const wave = Math.sin((i + seed) * 0.6) * 3 + Math.cos((i + seed) * 0.27) * 2;
    v += up * (1.4 + (((seed + i * 7) % 11) / 11)) + wave;
    out.push(v);
  }
  return out;
}

const styles = StyleSheet.create({
  body: { flexDirection: 'row', alignItems: 'stretch' },
  left: { flex: 1, minWidth: 0 },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.sm },
  headText: { flex: 1, minWidth: 0 },
  name: { color: vantage.textPrimary, fontFamily, fontSize: sizes.h3, fontWeight: weights.heavy },
  category: { color: vantage.textMuted, fontFamily, fontSize: sizes.micro, marginTop: 1 },
  full: { backgroundColor: vantage.bgPressed, paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: radius.sm },
  fullTxt: { color: vantage.textMuted, fontFamily, fontSize: sizes.micro, fontWeight: weights.semibold },
  lab: { color: vantage.textMuted, fontFamily, fontSize: sizes.label },
  val: { fontFamily, fontSize: sizes.h1, fontWeight: weights.heavy, marginTop: 2 },
  chart: { justifyContent: 'flex-end', paddingLeft: space.sm },
  divider: { height: 1, backgroundColor: vantage.border, marginVertical: space.md },
  stats: { flexDirection: 'row', justifyContent: 'space-between', gap: space.sm },
  stat: { flex: 1, minWidth: 0 },
  statHead: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statLab: { color: vantage.textMuted, fontFamily, fontSize: sizes.micro, flexShrink: 1 },
  statVal: { color: vantage.textPrimary, fontFamily, fontSize: sizes.body, fontWeight: weights.bold, marginTop: 3 },
});
