import React from 'react';
import { View, StatusBar, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ScreenGlow from './ScreenGlow';
import { vantage } from '../../theme/vantageTheme';

export default function Screen({ children, edges = ['top'], style, glow = true }) {
  return (
    <View style={styles.root}>
      <StatusBar barStyle={vantage.isDark ? 'light-content' : 'dark-content'} backgroundColor={vantage.bg} translucent={false} />
      {glow ? <ScreenGlow /> : null}
      <SafeAreaView style={[styles.safe, style]} edges={edges}>
        {children}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: vantage.bg },
  safe: { flex: 1, backgroundColor: 'transparent' },
});
