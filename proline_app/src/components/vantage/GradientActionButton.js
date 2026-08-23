import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { space, weights, fontFamily, radius } from '../../theme/vantageTheme';

// Brand gradient: #F04024 deepening to a lighter tint of the same hue, matching
// the reference pill button (bold label + circular arrow chip on the right).
const BRAND = '#F04024';
const BRAND_LIGHT = '#FF7A5A';

export default function GradientActionButton({
  label,
  onPress,
  icon = 'arrow-forward',
  style,
  accessibilityLabel,
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      style={({ pressed }) => [styles.wrap, style, pressed && { opacity: 0.9 }]}
    >
      <LinearGradient
        colors={[BRAND, BRAND_LIGHT]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <View style={styles.side} />
        <Text style={styles.label} numberOfLines={1}>{label}</Text>
        <View style={styles.side}>
          <View style={styles.chip}>
            <Ionicons name={icon} size={18} color={BRAND} />
          </View>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const CHIP = 34;

const styles = StyleSheet.create({
  wrap: { borderRadius: radius.lg, overflow: 'hidden' },
  gradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.sm,
    paddingHorizontal: space.sm,
    minHeight: 52,
  },
  // Equal side columns keep the label optically centered while the chip sits
  // flush to the right edge.
  side: { width: CHIP, alignItems: 'flex-end', justifyContent: 'center' },
  label: {
    flex: 1,
    textAlign: 'center',
    color: '#FFFFFF',
    fontFamily,
    fontSize: 16,
    fontWeight: weights.heavy,
  },
  chip: {
    width: CHIP, height: CHIP, borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
  },
});
