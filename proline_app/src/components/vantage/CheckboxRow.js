import React from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { vantage, space, sizes, fontFamily } from '../../theme/vantageTheme';

export default function CheckboxRow({ label, checked, onChange, disabled = false }) {
  return (
    <Pressable
      onPress={disabled ? undefined : () => onChange(!checked)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      style={styles.row}
    >
      <View style={[
        styles.box,
        { backgroundColor: checked ? vantage.accent : 'transparent', borderColor: checked ? vantage.accent : vantage.borderStrong, opacity: disabled ? 0.5 : 1 },
      ]}>
        {checked ? <Ionicons name="checkmark" size={14} color={vantage.textInverse} /> : null}
      </View>
      <Text style={[styles.label, { opacity: disabled ? 0.5 : 1 }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  box: { width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  label: { color: vantage.textPrimary, fontFamily, fontSize: sizes.body },
});
