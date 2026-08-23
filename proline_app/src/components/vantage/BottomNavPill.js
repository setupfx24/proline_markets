import React from 'react';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { vantage, space, sizes, weights, fontFamily, radius } from '../../theme/vantageTheme';

// Approximate fully-rendered height of the attached nav bar (used by screens for
// bottom padding so content isn't hidden behind the nav). Keep in sync with the
// styles below if padding/sizes change. Excludes the safe-area inset, which is
// added on top at runtime.
export const BOTTOM_NAV_PILL_HEIGHT = 84;

// Dark, faded gradient for the bar — lighter at the top edge, fading to near the
// screen background at the bottom so the bar reads as "attached" and glossy.
const BAR_GRADIENT = vantage.isDark
  ? ['#34353B', '#1B1C20', '#0B0B0D']
  : ['#FFFFFF', '#F2F5FA', '#E7ECF3'];

// Subtle highlight hairline along the very top edge (the "faded" sheen).
const TOP_SHEEN = vantage.isDark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.9)';

export default function BottomNavPill({ tabs, activeKey, onChange }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.outer} pointerEvents="box-none">
      <LinearGradient
        colors={BAR_GRADIENT}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={[styles.bar, { paddingBottom: Math.max(insets.bottom, space.sm) }]}
      >
        {/* Glossy top-edge sheen */}
        <View style={[styles.sheen, { backgroundColor: TOP_SHEEN }]} pointerEvents="none" />

        <View style={styles.row}>
          {tabs.map((t) => {
            const active = t.key === activeKey;
            return (
              <Pressable
                key={t.key}
                onPress={() => onChange(t.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={t.label}
                style={styles.tab}
              >
                {/* Active-tab top indicator bar */}
                <View style={[styles.indicator, active && styles.indicatorActive]} />
                <View style={styles.icon}>
                  {t.renderIcon ? t.renderIcon(active) : (active ? t.icon : t.iconInactive)}
                </View>
                <Text
                  style={[styles.label, active && styles.labelActive]}
                  numberOfLines={1}
                >
                  {t.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  bar: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: space.sm,
    borderTopWidth: 1,
    borderColor: vantage.border,
    overflow: 'hidden',
    // Lift the attached bar off the content with a soft upward shadow.
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -6 },
    elevation: 24,
  },
  sheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingTop: space.md,
    paddingBottom: space.xs,
    gap: 4,
  },
  indicator: {
    position: 'absolute',
    top: 0,
    width: 26,
    height: 3,
    borderRadius: radius.pill,
    backgroundColor: 'transparent',
  },
  indicatorActive: {
    backgroundColor: vantage.accent,
  },
  icon: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: vantage.textMuted,
    fontFamily,
    fontSize: sizes.micro,
    fontWeight: weights.medium,
  },
  labelActive: {
    color: vantage.accent,
    fontWeight: weights.bold,
  },
});
