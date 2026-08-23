import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { vantage, space, sizes, weights, fontFamily } from '../../theme/vantageTheme';

export default function EmptyState({ icon, title, subtitle, action }) {
  return (
    <View style={styles.wrap}>
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: space.huge, paddingHorizontal: space.xl, gap: space.sm },
  icon: { marginBottom: space.sm },
  title: { color: vantage.textPrimary, fontFamily, fontSize: sizes.h3, fontWeight: weights.bold, textAlign: 'center' },
  subtitle: { color: vantage.textMuted, fontFamily, fontSize: sizes.body, textAlign: 'center' },
  action: { marginTop: space.md, alignSelf: 'stretch' },
});
