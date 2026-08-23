import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { vantage, space } from '../../theme/vantageTheme';

export default function DiscreteSlider({ value, onChange, stops }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.track} />
      <View style={styles.dotsRow}>
        {stops.map((s) => {
          const active = s === value;
          return (
            <Pressable
              key={s}
              onPress={() => onChange(s)}
              hitSlop={16}
              style={[styles.dot, active && styles.dotActive]}
              accessibilityRole="button"
              accessibilityLabel={`Set lots to ${s}`}
              accessibilityState={{ selected: active }}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { height: 32, justifyContent: 'center' },
  track: { position: 'absolute', left: 0, right: 0, height: 2, backgroundColor: vantage.borderStrong, borderRadius: 1 },
  dotsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: vantage.borderStrong, backgroundColor: vantage.bg },
  dotActive: { backgroundColor: vantage.accent, borderColor: vantage.accent, width: 16, height: 16, borderRadius: 8 },
});
