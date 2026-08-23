import React, { useEffect, useRef, memo } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  interpolateColor,
  Easing,
} from 'react-native-reanimated';

/**
 * PriceTicker — an odometer-style animated number for live prices / PnL.
 *
 * • Each digit lives in its own clipped column of 0–9 and SCROLLS vertically
 *   to the new value (no flash/jump).
 * • Animations run entirely on the UI thread (Reanimated), so it stays smooth
 *   under many updates per second — the React re-render only swaps a digit
 *   prop, the motion never touches JS.
 * • On change the whole number briefly flashes green (up) or red (down), then
 *   eases back to the neutral colour.
 *
 *   <PriceTicker value={bid} decimals={5} fontSize={20} />
 */

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
const SLIDE = { duration: 260, easing: Easing.out(Easing.cubic) };

function formatNum(v, decimals, format) {
  if (typeof format === 'function') return String(format(v));
  if (v == null || !Number.isFinite(Number(v))) return '—';
  return Number(v).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

// One rolling 0–9 column. Re-renders only when its target digit changes; the
// slide + colour are driven by shared values on the UI thread.
const DigitColumn = memo(function DigitColumn({ digit, height, fontStyle, flash, colors }) {
  const ty = useSharedValue(-digit * height);

  useEffect(() => {
    ty.value = withTiming(-digit * height, SLIDE);
  }, [digit, height, ty]);

  const slide = useAnimatedStyle(() => ({ transform: [{ translateY: ty.value }] }));
  const color = useAnimatedStyle(() => ({
    color: interpolateColor(flash.value, [-1, 0, 1], [colors.down, colors.neutral, colors.up]),
  }));

  return (
    <View style={{ height, overflow: 'hidden' }}>
      <Animated.View style={slide}>
        {DIGITS.map((d) => (
          <Animated.Text key={d} style={[fontStyle, { height, lineHeight: height }, color]}>
            {d}
          </Animated.Text>
        ))}
      </Animated.View>
    </View>
  );
});

// Non-digit glyphs (decimal point, comma, minus, em-dash) — static position but
// they still ride the colour flash so the whole number highlights together.
const StaticChar = memo(function StaticChar({ char, height, fontStyle, flash, colors }) {
  const color = useAnimatedStyle(() => ({
    color: interpolateColor(flash.value, [-1, 0, 1], [colors.down, colors.neutral, colors.up]),
  }));
  return <Animated.Text style={[fontStyle, { height, lineHeight: height }, color]}>{char}</Animated.Text>;
});

function PriceTicker({
  value,
  decimals = 2,
  format,                 // optional (v) => string formatter (overrides decimals)
  fontSize = 22,
  fontWeight = '700',
  fontFamily,
  upColor = '#16C784',
  downColor = '#F6465D',
  neutralColor = '#FFFFFF',
  flashDuration = 360,
  style,
}) {
  const height = Math.round(fontSize * 1.22);
  const flash = useSharedValue(0);            // -1 down · 0 neutral · 1 up
  const prev = useRef(value);

  const text = formatNum(value, decimals, format);

  useEffect(() => {
    const a = Number(value);
    const b = Number(prev.current);
    const dir = Number.isFinite(a) && Number.isFinite(b) ? Math.sign(a - b) : 0;
    if (dir !== 0) {
      // Quick rise to full highlight, then ease back to neutral.
      flash.value = withSequence(
        withTiming(dir, { duration: 90 }),
        withTiming(0, { duration: flashDuration, easing: Easing.out(Easing.quad) }),
      );
    }
    prev.current = value;
  }, [value, flash, flashDuration]);

  const fontStyle = {
    fontSize,
    fontWeight,
    ...(fontFamily ? { fontFamily } : null),
    textAlign: 'center',
    includeFontPadding: false,        // Android: kill extra glyph padding
    fontVariant: ['tabular-nums'],    // equal digit widths → no horizontal jitter
  };
  const colors = { up: upColor, down: downColor, neutral: neutralColor };

  return (
    <View style={[styles.row, { height }, style]}>
      {text.split('').map((ch, i) =>
        ch >= '0' && ch <= '9' ? (
          <DigitColumn key={i} digit={Number(ch)} height={height} fontStyle={fontStyle} flash={flash} colors={colors} />
        ) : (
          <StaticChar key={`${i}-${ch}`} char={ch} height={height} fontStyle={fontStyle} flash={flash} colors={colors} />
        ),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});

export default memo(PriceTicker);
