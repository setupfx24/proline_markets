import React from 'react';
import { View, Dimensions, StyleSheet } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { vantage } from '../../theme/vantageTheme';

// Signature warm radial glow that bleeds from the top of the screen into the
// black background — the brand look on Home and other primary screens.
const { width: SCREEN_W } = Dimensions.get('window');
const GLOW_H = 480;

export default function ScreenGlow() {
  // Strong warm glow on the black theme; a soft orange wash on the light theme
  // so it stays subtle against white.
  const dark = vantage.isDark !== false;
  const o0 = dark ? 0.55 : 0.18;
  const o1 = dark ? 0.30 : 0.10;
  const o2 = dark ? 0.12 : 0.05;
  return (
    <View pointerEvents="none" style={[styles.wrap, { width: SCREEN_W, height: GLOW_H }]}>
      <Svg width={SCREEN_W} height={GLOW_H}>
        <Defs>
          <RadialGradient id="screenTopGlow" cx="50%" cy="0%" rx="80%" ry="62%" fx="50%" fy="0%">
            <Stop offset="0" stopColor={vantage.accentGlow} stopOpacity={String(o0)} />
            <Stop offset="0.32" stopColor={vantage.accent} stopOpacity={String(o1)} />
            <Stop offset="0.62" stopColor={dark ? '#9A2D0B' : vantage.accent} stopOpacity={String(o2)} />
            <Stop offset="1" stopColor={vantage.bg} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width={SCREEN_W} height={GLOW_H} fill="url(#screenTopGlow)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, left: 0 },
});
