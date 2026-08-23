import React, { useEffect, useState, useCallback } from 'react';
import { ScrollView, RefreshControl, View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';

import { useAccount } from '../../../app/providers/AccountContext';
import { Screen, BalanceBlock, QuickActionTile } from '../../../components/vantage';
import { vantage, space, sizes, weights, fontFamily } from '../../../theme/vantageTheme';
import ApiService from '../../../services/api/ApiService';
import { useHiddenBalance } from '../../../utils/hiddenBalance';
import { BOTTOM_NAV_PILL_HEIGHT } from '../../../components/vantage/BottomNavPill';

// "Recent Transactions" shows at most this many rows from the last 2 days;
// everything else lives in the full History screen.
const RECENT_MAX_ROWS = 8;

export default function FundsScreen() {
  const nav = useNavigation();
  const { hidden, toggle } = useHiddenBalance();
  const { accounts } = useAccount();

  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState(null);
  const [recent, setRecent] = useState([]);

  const fetchAll = useCallback(async () => {
    await Promise.allSettled([
      ApiService.getWalletSummary().then(setSummary).catch(() => setSummary(null)),
      ApiService.getTransactions({ page: 1, perPage: 5 }).then((res) => {
        const list = Array.isArray(res) ? res : (Array.isArray(res?.items) ? res.items : []);
        // "Recent" = the LAST 2 DAYS only (today + yesterday), capped — the
        // backend ignores per_page and returns the full ledger, which used to
        // render here in its entirety. Full history lives behind History.
        const cutoff = new Date();
        cutoff.setHours(0, 0, 0, 0);
        cutoff.setDate(cutoff.getDate() - 1);
        const recentOnly = list.filter((t) => {
          // Money movements only — per-trade P&L ledger rows (type
          // profit/loss) belong to Trade → History, not the Funds view.
          const type = String(t.type || t.kind || '').toLowerCase();
          if (type === 'profit' || type === 'loss') return false;
          const ts = Date.parse(t.created_at || t.createdAt || '');
          return Number.isFinite(ts) && ts >= cutoff.getTime();
        }).slice(0, RECENT_MAX_ROWS);
        setRecent(recentOnly);
      }).catch(() => setRecent([])),
    ]);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useFocusEffect(useCallback(() => { fetchAll(); }, [fetchAll]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  }, [fetchAll]);

  // Main account balance (the wallet) and the combined balance of all trading
  // accounts. "Total Balance" shows the trading-accounts total.
  const main = summary?.main_wallet_balance ?? summary?.main_balance ?? summary?.main_wallet ?? null;
  // Sum of ALL trading accounts (live + demo) from the accounts list — used when
  // the wallet-summary's live-only total is 0/absent, otherwise a DEMO user (no
  // live accounts) saw "Trading Accounts 0.00" even though their demo account
  // holds a balance.
  const accountsTotal = Array.isArray(accounts) && accounts.length
    ? accounts.reduce((s, a) => s + (Number(a.balance ?? a.equity) || 0), 0)
    : null;
  const apiTrading = summary?.total_live_balance ?? summary?.trading_balance ?? summary?.total_equity ?? null;
  const trading = (apiTrading != null && apiTrading > 0) ? apiTrading : (accountsTotal ?? apiTrading);
  const total = trading ?? summary?.total_balance ?? summary?.balance ?? null;
  const showSplit = main != null || trading != null;

  return (
    <Screen edges={['top']} glow>
      {/* Fixed header — stays pinned while the transactions list scrolls. */}
      <View style={styles.fixedHeader}>
        <View style={styles.headerWrap}>
          <Text style={styles.title}>Funds</Text>
        </View>

        {/* Banner div — fund_banner.png fills the card. */}
        <View style={styles.bannerCard}>
          <Image
            source={require('../../../../assets/images/fund_banner.png')}
            style={styles.bannerImage}
            resizeMode="cover"
          />
        </View>

        <View style={styles.balanceWrap}>
          <View style={styles.splitRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.splitLab}>Main Wallet</Text>
              <Text style={styles.splitVal}>{hidden ? '••••' : Number(main || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.splitLab}>Trading Accounts</Text>
              <Text style={styles.splitVal}>{hidden ? '••••' : Number(trading || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
            </View>
          </View>
        </View>

        <View style={styles.tilesRow}>
          <QuickActionTile variant="flat" icon={<Ionicons name="arrow-up-outline" size={30} color="#B39166" />} label="Deposit" onPress={() => nav.navigate('Deposit')} />
          <QuickActionTile variant="flat" icon={<Ionicons name="arrow-down-outline" size={30} color="#B39166" />} label="Withdraw" onPress={() => nav.navigate('Withdraw')} />
          <QuickActionTile variant="flat" icon={<Ionicons name="swap-horizontal-outline" size={30} color="#B39166" />} label="Transfer" onPress={() => nav.navigate('Transfer')} />
          <QuickActionTile variant="flat" icon={<Ionicons name="receipt-outline" size={30} color="#B39166" />} label="History" onPress={() => nav.navigate('TransactionHistory')} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: BOTTOM_NAV_PILL_HEIGHT + space.huge }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={vantage.accent} colors={[vantage.accent]} />}
      >
        <View style={styles.recentSection}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Recent Transactions</Text>
            <Pressable onPress={() => nav.navigate('TransactionHistory')} hitSlop={8} accessibilityRole="button" accessibilityLabel="View all transactions">
              <Text style={styles.viewAll}>View all →</Text>
            </Pressable>
          </View>
          {recent.length === 0 ? (
            <Text style={styles.empty}>No transactions in the last 2 days.</Text>
          ) : recent.map((t) => <TxRow key={t.id || t._id || `${t.created_at}-${t.amount}`} tx={t} />)}
        </View>
      </ScrollView>
    </Screen>
  );
}

function TxRow({ tx }) {
  const t = String(tx.type || tx.kind || '').toLowerCase();
  const isDeposit = t.includes('deposit');
  const isWithdraw = t.includes('withdraw');
  const sign = isDeposit ? '+' : (isWithdraw ? '−' : '');
  const color = isDeposit ? vantage.up : (isWithdraw ? vantage.down : vantage.textPrimary);
  const amount = Math.abs(Number(tx.amount ?? 0));
  const method = tx.payment_method || tx.method || tx.gateway || tx.type || 'Transaction';
  const status = String(tx.status || '').toLowerCase();
  const dateStr = tx.created_at ? new Date(tx.created_at).toLocaleDateString() : (tx.timestamp ? new Date(tx.timestamp).toLocaleDateString() : '');

  return (
    <View style={txStyles.row}>
      <Ionicons
        name={isDeposit ? 'arrow-down-circle' : isWithdraw ? 'arrow-up-circle' : 'swap-horizontal'}
        size={30} color={color}
      />
      <View style={{ flex: 1, marginLeft: space.md }}>
        <Text style={txStyles.method}>{String(method).toUpperCase()}</Text>
        <Text style={txStyles.date}>{dateStr}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[txStyles.amount, { color }]}>{sign}${amount.toFixed(2)}</Text>
        <Text style={[txStyles.status, status === 'completed' ? { color: '#F04024' } : status === 'failed' ? { color: vantage.down } : null]}>
          {status || 'pending'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fixedHeader: { backgroundColor: vantage.bg },
  headerWrap: { paddingHorizontal: space.lg, paddingTop: space.sm },
  title: { color: vantage.textPrimary, fontFamily, fontSize: sizes.hero, fontWeight: weights.heavy },
  scroll: {},
  // Empty banner placeholder. width = 92% of screen, height auto via aspectRatio.
  // Recommended image: 1560 × 600 px (ratio 2.6) — or any image at the same ratio.
  bannerCard: {
    alignSelf: 'center',
    width: '92%',
    aspectRatio: 2.6,
    marginTop: space.md,
    borderRadius: 20,
    backgroundColor: vantage.bgElevated,
    borderWidth: 1,
    borderColor: vantage.border,
    overflow: 'hidden',
  },
  bannerImage: { width: '100%', height: '100%' },
  balanceWrap: { paddingHorizontal: space.lg, paddingTop: space.md },
  splitRow: { flexDirection: 'row', gap: space.lg, marginTop: space.md, padding: space.md, backgroundColor: vantage.bgElevated, borderRadius: 12 },
  splitLab: { color: vantage.textMuted, fontFamily, fontSize: sizes.label },
  splitVal: { color: vantage.textPrimary, fontFamily, fontSize: sizes.h3, fontWeight: weights.bold, marginTop: 2 },
  tilesRow: { flexDirection: 'row', paddingHorizontal: space.lg, paddingVertical: space.lg, gap: space.md },
  recentSection: { paddingHorizontal: space.lg, paddingTop: space.md },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  viewAll: { color: vantage.accent, fontFamily, fontSize: sizes.label, fontWeight: weights.semibold },
  sectionTitle: { color: vantage.textPrimary, fontFamily, fontSize: sizes.h2, fontWeight: weights.heavy, marginBottom: space.sm },
  empty: { color: vantage.textMuted, fontFamily, fontSize: sizes.body, padding: space.lg, textAlign: 'center' },
});

const txStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: space.md, borderBottomColor: vantage.border, borderBottomWidth: StyleSheet.hairlineWidth },
  method: { color: vantage.textPrimary, fontFamily, fontSize: 16, fontWeight: weights.semibold },
  date: { color: vantage.textMuted, fontFamily, fontSize: 13, marginTop: 2 },
  amount: { fontFamily, fontSize: 16, fontWeight: weights.heavy },
  status: { color: vantage.textMuted, fontFamily, fontSize: 13, marginTop: 2, textTransform: 'capitalize' },
});
