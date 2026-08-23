import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Sheet, MenuRow } from '../../../components/vantage';
import { vantage, space, sizes, weights, fontFamily, radius } from '../../../theme/vantageTheme';

// Identify copy/PAMM/MAM accounts so the user can tell them apart from normal
// trading accounts. Backend flags them via is_copy_trading; the group name (if
// the admin named it PAMM/MAM) refines the label.
function acctTag(a) {
  // Precise type from the backend (follower allocation / master record).
  // MAM is folded into Copy — the app only surfaces PAMM + Copy Trading.
  const t = String(a?.copy_type || '').toLowerCase();
  if (t === 'pamm') return 'PAMM';
  if (['mam', 'mamm', 'signal_provider', 'signal'].includes(t)) return 'Copy';
  // Fallback to the generic flag + group name (older backend).
  if (!a?.is_copy_trading) return null;
  const g = String(
    a.account_group?.name || a.account_group?.display_name || a.account_group?.group_name || ''
  ).toLowerCase();
  if (g.includes('pamm')) return 'PAMM';
  return 'Copy';
}

export default function AccountSwitcher({ visible, onClose, accounts = [], selectedId, onSelect, onAddAccount }) {
  return (
    <Sheet visible={visible} onClose={onClose} title="Select account">
      {onAddAccount ? (
        <MenuRow
          icon={<Ionicons name="add-circle-outline" size={20} color={vantage.accent} />}
          label="Add account"
          onPress={() => { onClose(); onAddAccount(); }}
        />
      ) : null}
      {accounts.length === 0 ? (
        <Text style={styles.empty}>No accounts. Open one in Funds.</Text>
      ) : accounts.map((a) => {
        const id = a.id || a._id;
        const isSelected = id === selectedId;
        const tag = acctTag(a);
        const balance = a.balance != null
          ? `${Number(a.balance).toLocaleString('en-US', { maximumFractionDigits: 2 })} ${a.currency || 'USD'}`
          : '';
        return (
          <Pressable
            key={id}
            onPress={() => { onSelect(a); onClose(); }}
            style={styles.row}
            android_ripple={{ color: vantage.bgPressed }}
            accessibilityRole="button"
          >
            <Ionicons name={isSelected ? 'checkmark-circle' : 'card-outline'} size={20} color={isSelected ? vantage.accent : vantage.textPrimary} />
            <View style={styles.rowText}>
              <View style={styles.labelRow}>
                <Text style={styles.label} numberOfLines={1}>
                  {a.is_demo ? 'Demo' : 'Live'} {a.account_number || id}
                </Text>
                {tag ? (
                  <View style={[styles.tag, tag === 'Copy' ? styles.tagCopy : styles.tagManaged]}>
                    <Text style={[styles.tagTxt, tag === 'Copy' ? { color: vantage.textSecondary } : { color: vantage.accent }]}>{tag}</Text>
                  </View>
                ) : null}
              </View>
              {balance ? <Text style={styles.balance}>{balance}</Text> : null}
            </View>
          </Pressable>
        );
      })}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  empty: { color: vantage.textMuted, fontFamily, fontSize: sizes.body, padding: space.lg, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, paddingHorizontal: space.xs },
  rowText: { flex: 1, minWidth: 0 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  label: { color: vantage.textPrimary, fontFamily, fontSize: sizes.body, fontWeight: weights.semibold, flexShrink: 1 },
  tag: { paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: radius.sm },
  tagManaged: { backgroundColor: vantage.accentMuted },
  tagCopy: { backgroundColor: vantage.bgPressed },
  tagTxt: { fontFamily, fontSize: sizes.micro, fontWeight: weights.heavy, letterSpacing: 0.5 },
  balance: { color: vantage.textMuted, fontFamily, fontSize: sizes.label, marginTop: 2 },
});
