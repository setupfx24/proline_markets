import React from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { vantage, space, sizes, weights, fontFamily } from '../../theme/vantageTheme';

export default function MenuRow({ icon, label, value, onPress, danger = false }) {
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: vantage.bgPressed }}
      accessibilityRole="button"
      style={styles.row}
    >
      <View style={styles.iconBox}>{icon}</View>
      <Text style={[styles.label, danger && { color: vantage.down }]}>{label}</Text>
      <View style={styles.right}>
        {value ? <Text style={styles.value}>{value}</Text> : null}
        <Ionicons name="chevron-forward" size={16} color={vantage.textMuted} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    gap: space.md,
    minHeight: 52,
  },
  iconBox: { width: 24, alignItems: 'center' },
  label: { flex: 1, color: vantage.textPrimary, fontFamily, fontSize: sizes.body, fontWeight: weights.medium },
  right: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  value: { color: vantage.textMuted, fontFamily, fontSize: sizes.label },
});
