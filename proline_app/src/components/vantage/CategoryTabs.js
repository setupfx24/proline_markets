import React from 'react';
import { Pressable, Text, ScrollView, StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { vantage, space, weights, fontFamily, radius } from '../../theme/vantageTheme';

// Brand accent for the active chip (warm red → orange gradient).
const ACCENT = '#F04024';
const ACCENT_HI = '#FF6A45';

export default function CategoryTabs({ value, onChange, options }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.row}
    >
      {options.map((o) => {
        const active = o.value === value;
        const gid = `chip-${o.value}`;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={({ pressed }) => [
              styles.chip,
              active ? styles.chipActive : styles.chipIdle,
              pressed && { opacity: 0.85 },
            ]}
          >
            {active ? (
              <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
                <Defs>
                  <LinearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
                    <Stop offset="0" stopColor={ACCENT_HI} />
                    <Stop offset="1" stopColor={ACCENT} />
                  </LinearGradient>
                </Defs>
                <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gid})`} />
              </Svg>
            ) : null}
            <Text
              style={[
                styles.label,
                {
                  // Selected chip: white in dark theme; black in light theme so
                  // it stays readable (the bright pill can wash out white text).
                  color: active ? (vantage.isDark ? '#FFFFFF' : '#000000') : vantage.textSecondary,
                  fontWeight: active ? weights.bold : weights.medium,
                },
              ]}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // flexGrow:0 keeps the horizontal ScrollView from stretching as a flex child.
  scroll: { flexGrow: 0 },
  row: { gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.sm, alignItems: 'center' },
  chip: {
    paddingHorizontal: space.lg,
    minHeight: 38,
    borderRadius: radius.pill,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipIdle: { backgroundColor: vantage.bgElevated, borderWidth: 1, borderColor: vantage.border },
  chipActive: { borderWidth: 1, borderColor: ACCENT },
  label: { fontFamily, fontSize: 14, letterSpacing: 0.2 },
});
