import React from 'react';
import { View, Image, StyleSheet } from 'react-native';

const LOADER = require('../../../assets/images/download.gif');

// Full-screen startup loader — animated GIF centred on a black background.
export default function AppLoader() {
  return (
    <View style={styles.root}>
      <Image source={LOADER} style={styles.gif} resizeMode="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center' },
  gif: { width: 200, height: 200 },
});
