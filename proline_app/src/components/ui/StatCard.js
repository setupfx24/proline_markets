import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { vantage } from '../../theme/vantageTheme';

const colors = {
  bgCard: vantage.bgElevated,
  border: vantage.border,
  textMuted: vantage.textMuted,
  textPrimary: vantage.textPrimary,
};

export default function StatCard({ label, value, valueColor, prefix = '', suffix = '' }) {
  return (
    <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
      <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.value, { color: valueColor || colors.textPrimary }]} numberOfLines={1}>
        {prefix}{typeof value === 'number' ? value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : value}{suffix}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, padding: 14, borderRadius: 12, borderWidth: 1 },
  label: { fontSize: 11, fontWeight: '500', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  value: { fontSize: 18, fontWeight: '700' },
});
