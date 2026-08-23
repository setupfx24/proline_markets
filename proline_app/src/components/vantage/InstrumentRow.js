import React, { memo, useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import SymbolIcon from './SymbolIcon';
import Sparkline from './Sparkline';
import PriceTicker from './PriceTicker';
import { vantage, space, weights, fontFamily, radius } from '../../theme/vantageTheme';

function InstrumentRow({
  symbol,
  name,
  subtitle,
  price,
  changePct,
  sparkData,
  onPress,
  rightExtra,
  card = false,
  upColor = vantage.up,
}) {
  // The price feed has no change field — derive movement from the sparkline
  // series (first vs last close) when an explicit changePct isn't supplied.
  let effChange = (changePct != null && Number.isFinite(changePct)) ? changePct : null;
  if (effChange == null && Array.isArray(sparkData) && sparkData.length >= 2) {
    const first = sparkData[0];
    const last = sparkData[sparkData.length - 1];
    if (first) effChange = ((last - first) / first) * 100;
  }
  const hasChange = effChange != null && Number.isFinite(effChange);
  const positive = (effChange ?? 0) >= 0;
  const sparkColor = positive ? upColor : vantage.down;
  const glowColor = positive ? upColor : vantage.down;
  const gradId = positive ? 'rowGlowUp' : 'rowGlowDown';

  // ── Motion ────────────────────────────────────────────────────────────────
  // Entrance: gentle fade + rise when the row first mounts.
  const mount = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(mount, { toValue: 1, duration: 320, useNativeDriver: true }).start();
  }, [mount]);

  // Press: subtle scale-in for a tactile, professional feel.
  const scale = useRef(new Animated.Value(1)).current;
  const pressIn = () => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 40, bounciness: 0 }).start();
  const pressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 6 }).start();

  return (
    <Animated.View
      style={{
        opacity: mount,
        transform: [
          { translateY: mount.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
          { scale },
        ],
      }}
    >
      <Pressable
        onPress={onPress ? () => onPress(symbol) : undefined}
        onPressIn={pressIn}
        onPressOut={pressOut}
        android_ripple={{ color: vantage.bgPressed }}
        accessibilityRole="button"
        style={[styles.row, card && styles.cardRow]}
      >
        <SymbolIcon symbol={symbol} size={40} />
        <View style={styles.left}>
          <Text style={styles.name} numberOfLines={1}>{name || symbol}</Text>
          {subtitle ? <Text style={styles.sub} numberOfLines={1}>{subtitle}</Text> : null}
        </View>
        <View style={styles.spark}>
          <Sparkline data={sparkData || []} color={sparkColor} width={64} height={28} />
        </View>
        <View style={styles.right}>
          <PriceTicker
            value={price}
            format={formatPrice}
            fontSize={16}
            fontWeight={weights.bold}
            fontFamily={fontFamily}
            upColor={upColor}
            downColor={vantage.down}
            neutralColor={vantage.textPrimary}
          />
          <Text style={[styles.pct, { color: hasChange ? (positive ? upColor : vantage.down) : vantage.textMuted }]}>
            {hasChange ? `${positive ? '+' : ''}${effChange.toFixed(2)}%` : '—'}
          </Text>
        </View>
        {rightExtra}
      </Pressable>
    </Animated.View>
  );
}

function formatPrice(p) {
  if (p == null || !Number.isFinite(p)) return '—';
  if (p >= 1000) return p.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (p >= 1) return p.toFixed(2);
  return p.toFixed(5);
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    gap: space.md,
    position: 'relative',
    overflow: 'hidden',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: vantage.border,
  },
  // Grey elevated card per row — matches the upper sections' surface. Removes
  // the divider border and floats each row as its own rounded panel.
  cardRow: {
    backgroundColor: vantage.bgElevated,
    borderRadius: radius.lg,
    marginHorizontal: space.lg,
    marginBottom: space.sm,
    borderBottomWidth: 0,
  },
  left: { flex: 1, minWidth: 0 },
  name: { color: vantage.textPrimary, fontFamily, fontSize: 16, fontWeight: weights.bold },
  sub: { color: vantage.textMuted, fontFamily, fontSize: 12, marginTop: 2 },
  spark: { width: 64 },
  right: { alignItems: 'flex-end', minWidth: 90 },
  price: { color: vantage.textPrimary, fontFamily, fontSize: 16, fontWeight: weights.bold },
  pct: { fontFamily, fontSize: 12, marginTop: 2 },
});

export default memo(InstrumentRow);
