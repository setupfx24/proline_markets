import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { vantage, space, radius } from '../../theme/vantageTheme';

export default function Card({
  children,
  padding = space.lg,
  borderRadius = radius.lg,
  variant = 'elevated', // 'elevated' | 'raised' | 'outline'
  onPress,
  style,
}) {
  const bg =
    variant === 'raised' ? vantage.bgRaised :
    variant === 'outline' ? 'transparent' :
    vantage.bgElevated;
  const border = variant === 'outline' ? vantage.borderStrong : 'transparent';

  const inner = (
    <View
      style={[
        styles.card,
        { backgroundColor: bg, borderColor: border, borderWidth: variant === 'outline' ? 1 : 0, padding, borderRadius },
        style,
      ]}
    >
      {children}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        android_ripple={{ color: vantage.bgPressed, borderless: false }}
        accessibilityRole="button"
      >
        {({ pressed }) => (
          <View style={pressed ? { opacity: 0.85 } : null}>{inner}</View>
        )}
      </Pressable>
    );
  }
  return inner;
}

const styles = StyleSheet.create({
  card: {},
});
