import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Card } from '../../../components/vantage';
import { vantage, space, sizes, weights, fontFamily } from '../../../theme/vantageTheme';

export default function PromoBanner({ banner, onPress }) {
  if (!banner) return null;
  const title = banner.title || banner.heading || 'Top Performing Signal Providers';
  const cta = banner.cta_label || banner.subtitle || 'View More';
  const imageUrl = banner.image_url || banner.image || null;

  return (
    <Card
      onPress={onPress}
      style={styles.card}
      padding={space.lg}
    >
      <View style={styles.row}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.thumb} resizeMode="contain" />
        ) : (
          <View style={[styles.thumb, styles.thumbFallback]}>
            <Ionicons name="trophy" size={32} color={vantage.accent} />
          </View>
        )}
        <View style={styles.body}>
          <Text style={styles.title} numberOfLines={2}>{title}</Text>
          <Text style={styles.cta}>{cta} ›</Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: space.lg, marginVertical: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  thumb: { width: 64, height: 64, borderRadius: 12, backgroundColor: vantage.bgRaised },
  thumbFallback: { alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, minWidth: 0 },
  title: { color: vantage.textPrimary, fontFamily, fontSize: sizes.h3, fontWeight: weights.heavy },
  cta: { color: vantage.textSecondary, fontFamily, fontSize: sizes.label, marginTop: 4 },
});
