import React from 'react';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { vantage, space, sizes, weights, fontFamily } from '../../theme/vantageTheme';

export default function SegmentedTabs({ value, onChange, options }) {
  return (
    <View style={styles.row}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={styles.tab}
          >
            <Text style={[
              styles.label,
              {
                // Light theme: force black for the active segment (and a darker
                // grey for inactive) so the tabs read clearly on a white bg.
                color: active
                  ? (vantage.isDark ? vantage.textPrimary : '#000000')
                  : (vantage.isDark ? vantage.textMuted : '#475569'),
                fontWeight: active ? weights.heavy : weights.medium,
              },
            ]}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.xl, paddingVertical: space.sm },
  tab: { paddingVertical: space.xs },
  label: { fontFamily, fontSize: sizes.h2 },
});
