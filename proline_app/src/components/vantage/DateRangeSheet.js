import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import Sheet from './Sheet';
import PillButton from './PillButton';
import { vantage, space, sizes, weights, fontFamily, radius } from '../../theme/vantageTheme';

// Pure-JS From→To calendar picker (no native date-picker dependency, so it
// ships over OTA updates). Tap once to set FROM, tap again to set TO — the
// range highlights in between; Apply returns { from, to } as ms timestamps
// (from = start of that day, to = END of that day, inclusive).

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const dayStart = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); };
const dayEnd = (d) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x.getTime(); };

export function formatRangeLabel(from, to) {
  const f = new Date(from); const t = new Date(to);
  const fmt = (d) => `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
  const sameDay = f.toDateString() === t.toDateString();
  return sameDay ? fmt(f) : `${fmt(f)} – ${fmt(t)}`;
}

export default function DateRangeSheet({ visible, onClose, initialFrom, initialTo, onApply }) {
  const [from, setFrom] = useState(null);   // ms at day start
  const [to, setTo] = useState(null);       // ms at day start (converted on Apply)
  const [month, setMonth] = useState(() => { const d = new Date(); d.setDate(1); return d; });

  // Re-seed selection each time the sheet opens.
  useEffect(() => {
    if (!visible) return;
    setFrom(initialFrom != null ? dayStart(initialFrom) : null);
    setTo(initialTo != null ? dayStart(initialTo) : null);
    const seed = new Date(initialTo != null ? initialTo : Date.now());
    seed.setDate(1);
    setMonth(seed);
  }, [visible, initialFrom, initialTo]);

  const cells = useMemo(() => {
    const y = month.getFullYear(); const m = month.getMonth();
    const firstDow = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const out = [];
    for (let i = 0; i < firstDow; i++) out.push(null);
    for (let d = 1; d <= daysInMonth; d++) out.push(new Date(y, m, d));
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [month]);

  const todayStart = dayStart(new Date());

  const pick = (date) => {
    const t = dayStart(date);
    if (from == null || to != null) {
      // Fresh selection (or restarting after a complete range).
      setFrom(t); setTo(null);
    } else if (t < from) {
      // Tapped before the start — swap.
      setTo(from); setFrom(t);
    } else {
      setTo(t);
    }
  };

  const apply = () => {
    if (from == null) return;
    const end = to != null ? to : from;         // single-day range allowed
    onApply({ from, to: dayEnd(end) });
    onClose();
  };

  const shiftMonth = (delta) => {
    setMonth((prev) => { const d = new Date(prev); d.setMonth(d.getMonth() + delta); return d; });
  };

  const fmtChip = (ms) => (ms == null ? '—' : new Date(ms).toLocaleDateString());

  return (
    <Sheet visible={visible} onClose={onClose} title="Custom date range">
      <View style={styles.wrap}>
        {/* From / To summary */}
        <View style={styles.fromToRow}>
          <View style={styles.fromToBox}>
            <Text style={styles.fromToLab}>FROM</Text>
            <Text style={styles.fromToVal}>{fmtChip(from)}</Text>
          </View>
          <Ionicons name="arrow-forward" size={16} color={vantage.textMuted} />
          <View style={styles.fromToBox}>
            <Text style={styles.fromToLab}>TO</Text>
            <Text style={styles.fromToVal}>{fmtChip(to != null ? to : from)}</Text>
          </View>
        </View>

        {/* Month navigation */}
        <View style={styles.monthRow}>
          <Pressable onPress={() => shiftMonth(-1)} hitSlop={10} style={styles.monthBtn} accessibilityRole="button" accessibilityLabel="Previous month">
            <Ionicons name="chevron-back" size={18} color={vantage.textPrimary} />
          </Pressable>
          <Text style={styles.monthLab}>{MONTHS[month.getMonth()]} {month.getFullYear()}</Text>
          <Pressable onPress={() => shiftMonth(1)} hitSlop={10} style={styles.monthBtn} accessibilityRole="button" accessibilityLabel="Next month">
            <Ionicons name="chevron-forward" size={18} color={vantage.textPrimary} />
          </Pressable>
        </View>

        {/* Weekday header */}
        <View style={styles.weekRow}>
          {WEEKDAYS.map((w, i) => <Text key={`${w}${i}`} style={styles.weekLab}>{w}</Text>)}
        </View>

        {/* Day grid */}
        <View style={styles.grid}>
          {cells.map((date, i) => {
            if (!date) return <View key={i} style={styles.cell} />;
            const t = dayStart(date);
            const endSel = to != null ? to : null;
            const isFrom = from != null && t === from;
            const isTo = endSel != null && t === endSel;
            const inRange = from != null && endSel != null && t > from && t < endSel;
            const isFuture = t > todayStart;
            const isToday = t === todayStart;
            return (
              <Pressable
                key={i}
                onPress={isFuture ? undefined : () => pick(date)}
                disabled={isFuture}
                style={[styles.cell, inRange && styles.cellRange, (isFrom || isTo) && styles.cellPicked]}
                accessibilityRole="button"
                accessibilityLabel={date.toDateString()}
                accessibilityState={{ selected: isFrom || isTo, disabled: isFuture }}
              >
                <Text style={[
                  styles.cellTxt,
                  isFuture && { color: vantage.textMuted, opacity: 0.4 },
                  isToday && !isFrom && !isTo && { color: vantage.accent },
                  (isFrom || isTo) && styles.cellTxtPicked,
                ]}>
                  {date.getDate()}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Actions */}
        <View style={styles.btnRow}>
          <Pressable
            onPress={() => { setFrom(null); setTo(null); }}
            style={styles.clearBtn}
            accessibilityRole="button"
            accessibilityLabel="Clear selection"
          >
            <Text style={styles.clearTxt}>Clear</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <PillButton label="Apply" size="lg" onPress={apply} disabled={from == null} />
          </View>
        </View>
      </View>
    </Sheet>
  );
}

const CELL = `${100 / 7}%`;

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: space.lg, paddingBottom: space.lg },
  fromToRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.md },
  fromToBox: {
    flex: 1, borderWidth: 1, borderColor: vantage.border, borderRadius: radius.md,
    backgroundColor: vantage.bgRaised, paddingHorizontal: space.md, paddingVertical: space.sm,
  },
  fromToLab: { color: vantage.textMuted, fontFamily, fontSize: 10, fontWeight: weights.bold, letterSpacing: 1 },
  fromToVal: { color: vantage.textPrimary, fontFamily, fontSize: sizes.body, fontWeight: weights.semibold, marginTop: 2 },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.sm },
  monthBtn: {
    width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center',
    backgroundColor: vantage.bgRaised, borderWidth: 1, borderColor: vantage.border,
  },
  monthLab: { color: vantage.textPrimary, fontFamily, fontSize: sizes.body, fontWeight: weights.heavy },
  weekRow: { flexDirection: 'row', marginBottom: 2 },
  weekLab: { width: CELL, textAlign: 'center', color: vantage.textMuted, fontFamily, fontSize: sizes.label, fontWeight: weights.semibold },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: CELL, aspectRatio: 1.15, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  cellRange: { backgroundColor: vantage.bgRaised },
  cellPicked: { backgroundColor: vantage.accent },
  cellTxt: { color: vantage.textPrimary, fontFamily, fontSize: sizes.body },
  cellTxtPicked: { color: '#ffffff', fontWeight: weights.heavy },
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.lg },
  clearBtn: {
    paddingHorizontal: space.xl, paddingVertical: 12, borderRadius: 999,
    borderWidth: 1, borderColor: vantage.border, backgroundColor: vantage.bgRaised,
  },
  clearTxt: { color: vantage.textSecondary, fontFamily, fontSize: sizes.body, fontWeight: weights.semibold },
});
