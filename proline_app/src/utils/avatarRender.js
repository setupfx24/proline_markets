import React from 'react';
import { View, Image } from 'react-native';
import LottieView from 'lottie-react-native';
import { Ionicons } from '@expo/vector-icons';

// Default animation + the preset avatars the user can pick.
const DEFAULT_ANIM = require('../../assets/animations/avatar-active.json');
export const LOTTIE_AVATARS = {
  a: require('../../assets/animations/avatar-active.json'),
  b: require('../../assets/animations/avatar.json'),
};
export const ICON_AVATARS = [
  { key: 'i1', name: 'person', color: '#F04024' },
  { key: 'i2', name: 'happy', color: '#22C55E' },
  { key: 'i3', name: 'rocket', color: '#3B82F6' },
  { key: 'i4', name: 'star', color: '#F59E0B' },
  { key: 'i5', name: 'paw', color: '#A855F7' },
  { key: 'i6', name: 'flash', color: '#EC4899' },
];

// Accepts the raw `avatar` value (JSON string from the DB, an already-parsed
// object, or null) and returns a normalized { type, value } descriptor.
export function parseAvatar(raw) {
  if (!raw) return { type: 'default' };
  if (typeof raw === 'object') return raw;
  try {
    const v = JSON.parse(raw);
    return v && typeof v === 'object' ? v : { type: 'default' };
  } catch {
    return { type: 'default' };
  }
}

// Renders the chosen avatar (photo / preset animation / icon) or the default
// animation. Fills a `size`×`size` square — wrap in an overflow:hidden circle.
export function renderAvatar(av, size) {
  if (av?.type === 'photo' && av.value) {
    return <Image source={{ uri: av.value }} style={{ width: size, height: size }} resizeMode="cover" />;
  }
  if (av?.type === 'lottie' && LOTTIE_AVATARS[av.value]) {
    return <LottieView source={LOTTIE_AVATARS[av.value]} autoPlay loop style={{ width: size * 0.86, height: size * 0.86 }} />;
  }
  if (av?.type === 'icon' && av.value) {
    return (
      <View style={{ width: size, height: size, backgroundColor: av.value.color, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={av.value.name} size={size * 0.5} color="#fff" />
      </View>
    );
  }
  return <LottieView source={DEFAULT_ANIM} autoPlay loop style={{ width: size * 0.86, height: size * 0.86 }} />;
}
