import React from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import { vantage, space } from '../../theme/vantageTheme';

const SIZES = { sm: 32, md: 40, lg: 48 };

export default function IconButton({
  icon,             // a rendered Ionicons / MaterialIcons element
  onPress,
  size = 'md',
  variant = 'ghost', // 'ghost' | 'filled' | 'badge'
  badgeColor,
  accessibilityLabel,
  style,
}) {
  const dim = SIZES[size];
  const bg = variant === 'filled' ? vantage.bgRaised : 'transparent';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.base,
        {
          width: dim,
          height: dim,
          borderRadius: dim / 2,
          backgroundColor: pressed ? vantage.bgPressed : bg,
        },
        style,
      ]}
    >
      {icon}
      {badgeColor ? (
        <View style={[styles.badge, { backgroundColor: badgeColor }]} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
