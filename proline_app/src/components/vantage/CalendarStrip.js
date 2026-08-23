import React from 'react';
import { ScrollView, Pressable, View, Text, StyleSheet } from 'react-native';
import { vantage, space, sizes, weights, fontFamily } from '../../theme/vantageTheme';

const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

export default function CalendarStrip({ days, activeDate, onChange }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {days.map((d) => {
        const active = isSameDay(d, activeDate);
        return (
          <Pressable
            key={d.toISOString()}
            onPress={() => onChange(d)}
            style={styles.cell}
            accessibilityRole="button"
            accessibilityLabel={d.toDateString()}
          >
            <Text style={styles.dow}>{DAY_NAMES[d.getDay()]}</Text>
            <View style={[styles.dotBg, active && styles.dotBgActive]}>
              <Text style={[styles.dom, active && { color: vantage.textPrimary, fontWeight: weights.heavy }]}>
                {String(d.getDate()).padStart(2, '0')}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function isSameDay(a, b) {
  return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

const styles = StyleSheet.create({
  row: { gap: space.lg, paddingHorizontal: space.lg, paddingVertical: space.sm },
  cell: { alignItems: 'center', gap: space.xs, minWidth: 48 },
  dow: { color: vantage.textMuted, fontFamily, fontSize: sizes.label },
  dotBg: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  dotBgActive: { backgroundColor: vantage.accent },
  dom: { color: vantage.textPrimary, fontFamily, fontSize: sizes.h3, fontWeight: weights.bold },
});
