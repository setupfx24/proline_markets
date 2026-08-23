import React from 'react';
import { Pressable, Text, ActivityIndicator, View, StyleSheet } from 'react-native';
import { vantage, space, sizes, weights, fontFamily, radius } from '../../theme/vantageTheme';

const VARIANTS = {
  primary:   { bg: vantage.accent,   fg: vantage.textInverse, pressed: vantage.accentGlow },
  secondary: { bg: vantage.bgRaised, fg: vantage.textPrimary, pressed: vantage.bgPressed },
  sell:      { bg: vantage.sellBg,   fg: vantage.textPrimary, pressed: '#C9341C' },
  buy:       { bg: vantage.up,       fg: vantage.textPrimary, pressed: '#1FA958' },
  danger:    { bg: 'transparent',    fg: vantage.down,        pressed: vantage.downMuted, borderColor: vantage.down },
  ghost:     { bg: 'transparent',    fg: vantage.textPrimary, pressed: vantage.bgPressed },
};

const SIZES = {
  sm: { paddingV: space.sm,  paddingH: space.lg, font: sizes.label, height: 36 },
  md: { paddingV: space.md,  paddingH: space.xl, font: sizes.body,  height: 48 },
  lg: { paddingV: space.lg,  paddingH: space.xxl,font: sizes.h3,    height: 56 },
};

export default function PillButton({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  leftIcon,
  rightIcon,
  fullWidth = true,
  style,
}) {
  const v = VARIANTS[variant];
  const s = SIZES[size];
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={isDisabled ? undefined : onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: pressed && !isDisabled ? v.pressed : v.bg,
          borderColor: v.borderColor || 'transparent',
          borderWidth: v.borderColor ? 1 : 0,
          paddingVertical: s.paddingV,
          paddingHorizontal: s.paddingH,
          opacity: isDisabled ? 0.5 : 1,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          minHeight: s.height,
        },
        style,
      ]}
    >
      <View style={styles.row}>
        {loading ? (
          <ActivityIndicator color={v.fg} />
        ) : (
          <>
            {leftIcon ? <View style={styles.iconL}>{leftIcon}</View> : null}
            <Text style={{ color: v.fg, fontFamily, fontSize: s.font, fontWeight: weights.bold }}>
              {label}
            </Text>
            {rightIcon ? <View style={styles.iconR}>{rightIcon}</View> : null}
          </>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  iconL: { marginRight: space.sm },
  iconR: { marginLeft: space.sm },
});
