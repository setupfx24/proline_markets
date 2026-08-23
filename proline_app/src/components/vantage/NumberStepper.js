import React from 'react';
import { View, Text, Pressable, TextInput, StyleSheet } from 'react-native';
import { vantage, space, sizes, weights, fontFamily, radius } from '../../theme/vantageTheme';

export default function NumberStepper({
  value,
  onChange,
  min = 0,
  max = Infinity,
  step = 1,
  precision = 0,
  label,
  suffix,
}) {
  const clamp = (n) => Math.min(max, Math.max(min, n));
  const dec = () => onChange(clamp(Number(value) - step));
  const inc = () => onChange(clamp(Number(value) + step));
  const onText = (t) => {
    const n = Number(t.replace(',', '.'));
    if (Number.isFinite(n)) onChange(clamp(n));
  };
  const display = precision > 0 ? Number(value).toFixed(precision) : String(value);

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.row}>
        <Pressable onPress={dec} style={styles.btn} accessibilityRole="button" accessibilityLabel="Decrease">
          <Text style={styles.btnTxt}>−</Text>
        </Pressable>
        <View style={styles.center}>
          <TextInput
            value={display}
            onChangeText={onText}
            keyboardType="numeric"
            style={styles.input}
            selectTextOnFocus
          />
          {suffix ? <Text style={styles.suffix}>{suffix}</Text> : null}
        </View>
        <Pressable onPress={inc} style={styles.btn} accessibilityRole="button" accessibilityLabel="Increase">
          <Text style={styles.btnTxt}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  label: { color: vantage.textSecondary, fontFamily, fontSize: sizes.label },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: vantage.bgRaised,
    borderRadius: radius.md,
    paddingHorizontal: space.sm,
    height: 40,
  },
  btn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  btnTxt: { color: vantage.textPrimary, fontFamily, fontSize: sizes.h3, fontWeight: weights.heavy },
  center: { flex: 1, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  input: { color: vantage.textPrimary, fontFamily, fontSize: sizes.h3, fontWeight: weights.bold, textAlign: 'center', minWidth: 40, padding: 0 },
  suffix: { color: vantage.textMuted, fontFamily, fontSize: sizes.label, marginLeft: space.xs },
});
