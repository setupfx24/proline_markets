import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Dimensions, Linking } from 'react-native';

import { vantage, space, radius } from '../../../theme/vantageTheme';
import { API_BASE_URL } from '../../../constants/api';
import ApiService from '../../../services/api/ApiService';

const CARD_W = Dimensions.get('window').width - space.lg * 2;
const CARD_H = Math.round(CARD_W / 2.6);

// Admin banner image_url is usually a relative media path
// (/api/v1/banners/media/<file>) — make it absolute for <Image>.
function resolveUrl(u) {
  if (!u || typeof u !== 'string') return null;
  if (/^https?:\/\//i.test(u)) return u;
  const base = API_BASE_URL.replace(/\/$/, '');
  return `${base}${u.startsWith('/') ? '' : '/'}${u}`;
}

// Admin-uploaded promo banners. Full screen-width images; if more than one,
// the row snaps one banner at a time.
export default function BannerCarousel({ banners = [], onPressFallback }) {
  if (!banners.length) return null;

  const handlePress = (b) => {
    try { ApiService.trackBannerClick?.(b.id); } catch (_) {}
    const link = b.link_url;
    if (link && /^https?:\/\//i.test(link)) {
      Linking.openURL(link).catch(() => {});
    } else {
      onPressFallback?.();
    }
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      snapToInterval={CARD_W + space.md}
      snapToAlignment="start"
      decelerationRate="fast"
      disableIntervalMomentum
    >
      {banners.map((b) => {
        const img = resolveUrl(b.image_url);
        if (!img) return null;
        return (
          <Pressable
            key={b.id}
            onPress={() => handlePress(b)}
            style={styles.card}
            accessibilityRole="button"
            accessibilityLabel={b.title || 'Promotional banner'}
          >
            <Image source={{ uri: img }} style={styles.img} resizeMode="cover" />
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.sm },
  card: { width: CARD_W, height: CARD_H, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: vantage.bgElevated },
  img: { width: CARD_W, height: CARD_H },
});
