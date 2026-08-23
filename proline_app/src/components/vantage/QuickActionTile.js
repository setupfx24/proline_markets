import React from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import { vantage, space, sizes, weights, fontFamily, radius } from '../../theme/vantageTheme';

export default function QuickActionTile({
  icon,
  label,
  onPress,
  badge,
  size = 58,
  // 'accent' → orange-tinted tile (default, used across the app).
  // 'flat'   → dark, borderless square tile that fills its column (reference look).
  variant = 'accent',
}) {
  const flat = variant === 'flat';
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={styles.wrap}>
      <View
        style={[
          styles.icon,
          flat ? styles.iconFlat : styles.iconAccent,
          flat
            ? { width: '78%', aspectRatio: 1, borderRadius: radius.lg }
            : { width: size, height: size, borderRadius: radius.lg },
        ]}
      >
        {icon}
        {badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeTxt}>{badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.label, flat && styles.labelFlat]} numberOfLines={2}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: space.xs, flex: 1 },
  icon: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  iconAccent: {
    backgroundColor: vantage.accentMuted,
    borderWidth: 1,
    borderColor: 'rgba(242,106,31,0.22)',
  },
  iconFlat: {
    backgroundColor: vantage.bgRaised,
  },
  badge: {
    position: 'absolute',
    top: -6,
    left: -10,
    backgroundColor: vantage.accent,
    paddingHorizontal: space.xs + 2,
    paddingVertical: 1,
    borderRadius: radius.sm,
  },
  badgeTxt: { color: vantage.textInverse, fontFamily, fontSize: sizes.micro, fontWeight: weights.heavy },
  label: { color: vantage.textPrimary, fontFamily, fontSize: sizes.label, textAlign: 'center' },
  labelFlat: { color: vantage.textSecondary },
});
