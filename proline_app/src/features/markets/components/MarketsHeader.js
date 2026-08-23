import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { SegmentedTabs, IconButton } from '../../../components/vantage';
import { vantage, space } from '../../../theme/vantageTheme';

export default function MarketsHeader({ view, onChangeView, onSearch }) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <SegmentedTabs
          value={view}
          onChange={onChangeView}
          options={[
            { value: 'watchlist', label: 'Watchlist' },
            { value: 'explore',   label: 'Explore' },
          ]}
        />
      </View>
      <IconButton
        icon={<Ionicons name="search" size={18} color={vantage.textPrimary} />}
        accessibilityLabel="Search"
        onPress={onSearch}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.xs,
  },
});
