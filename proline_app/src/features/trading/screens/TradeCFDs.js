import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { vantage, space, sizes, weights, fontFamily, radius } from '../../../theme/vantageTheme';

import AccountSwitcher from '../components/AccountSwitcher';
import PositionsList from '../positions/PositionsList';

export default function TradeCFDs({
  accounts,
  selectedAccount,
  onSelectAccount,
  symbol,
  onSelectSymbol,
  tick,
  accountSummary,
  positions,
  orders,
  history,
  historyTotal,
  onLoadMoreHistory,
  onChange,
}) {
  const [accountSheet, setAccountSheet] = useState(false);

  const equity = accountSummary?.equity ?? accountSummary?.balance ?? null;

  const accLabel = selectedAccount?.is_demo ? 'Demo' : 'Live';
  const accName = selectedAccount?.group || selectedAccount?.name || selectedAccount?.platform || '';
  const accNumber = selectedAccount?.account_number || selectedAccount?.id || '';

  return (
    <View>
      <View style={styles.headerRow}>
        <Pressable onPress={() => setAccountSheet(true)} style={styles.accountChip} accessibilityRole="button">
          <Text style={styles.accountTxt} numberOfLines={1}>
            <Text style={{ color: vantage.accent, fontWeight: weights.bold }}>{accLabel} </Text>
            {accName ? `${accName} ` : ''}{accNumber}
          </Text>
          <Ionicons name="chevron-down" size={14} color={vantage.textMuted} />
        </Pressable>
        <View style={styles.equityCol}>
          <View style={styles.equityLabRow}>
            <Text style={styles.equityLab}>Equity ({selectedAccount?.currency || 'USD'})</Text>
          </View>
          <Text style={styles.equityValue}>
            {equity != null ? Number(equity).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
          </Text>
        </View>
      </View>

      {/* The duplicated order ticket was removed (2026-07-18): orders are
          placed from the chart / instrument screen (one-tap Buy/Sell + on-chart
          SL/TP). The Trade tab is the POSITIONS view — every open position with
          live P&L and the Set SL/TP sheet, plus Pending and History. */}
      <PositionsList account={selectedAccount} accountSummary={accountSummary} positions={positions} orders={orders} history={history} historyTotal={historyTotal} onLoadMoreHistory={onLoadMoreHistory} onChange={onChange} />

      <AccountSwitcher
        visible={accountSheet}
        onClose={() => setAccountSheet(false)}
        accounts={accounts}
        selectedId={selectedAccount?.id || selectedAccount?._id}
        onSelect={onSelectAccount}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.md, gap: space.md,
  },
  accountChip: {
    flexDirection: 'row', alignItems: 'center', gap: space.xs,
    backgroundColor: vantage.bgElevated, borderWidth: 1, borderColor: vantage.border,
    borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: space.sm,
    maxWidth: '62%',
  },
  accountTxt: { color: vantage.textPrimary, fontFamily, fontSize: sizes.label, fontWeight: weights.semibold },
  equityCol: { alignItems: 'flex-end' },
  equityLabRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  equityLab: { color: vantage.textMuted, fontFamily, fontSize: sizes.label },
  equityValue: { color: vantage.textPrimary, fontFamily, fontSize: sizes.h2, fontWeight: weights.heavy, marginTop: 1 },
  symbolRow: {
    flexDirection: 'row', alignItems: 'center', gap: space.xs,
    paddingHorizontal: space.lg, paddingVertical: space.md,
  },
  symbolName: { color: vantage.textPrimary, fontFamily, fontSize: sizes.h1, fontWeight: weights.heavy },
});
