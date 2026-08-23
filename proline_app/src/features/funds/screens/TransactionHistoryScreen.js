import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, FlatList, Pressable, RefreshControl, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { Screen, IconButton, CategoryTabs, Sheet, showToast, DateRangeSheet, formatRangeLabel } from '../../../components/vantage';
import { vantage, space, sizes, weights, fontFamily, radius } from '../../../theme/vantageTheme';
import { BOTTOM_NAV_PILL_HEIGHT } from '../../../components/vantage/BottomNavPill';
import ApiService from '../../../services/api/ApiService';
import { useAccount } from '../../../app/providers/AccountContext';
import { BRAND_LOGO_DATA_URI } from '../../../constants/brandLogo';

const FILTER_OPTIONS = [
  { value: 'all',         label: 'All' },
  { value: 'deposit',     label: 'Deposits' },
  { value: 'withdraw',    label: 'Withdrawals' },
  { value: 'transfer',    label: 'Transfers' },
  { value: 'trading',     label: 'Trading' },
];

const TX_PAGE = 50;

// Date ranges — same set as Trade → History.
const RANGE_OPTIONS = [
  { value: 'all',   label: 'All time' },
  { value: 'today', label: 'Today' },
  { value: '7d',    label: '7D' },
  { value: '30d',   label: '30D' },
];

function rangeCutoff(range) {
  if (range === 'all') return null;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (range === '7d') d.setDate(d.getDate() - 7);
  if (range === '30d') d.setDate(d.getDate() - 30);
  return d.getTime();
}

export default function TransactionHistoryScreen() {
  const nav = useNavigation();
  const { accounts } = useAccount();
  const [filter, setFilter] = useState('all');
  const [range, setRange] = useState('all');
  // Account scope: null = all accounts, else the selected account's id. The
  // ledger mixes every account's rows — without this the user can't tell
  // whose history they're looking at.
  const [acctId, setAcctId] = useState(null);
  // Custom From→To range: {from, to} ms timestamps set via DateRangeSheet.
  const [customRange, setCustomRange] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [acctSheetOpen, setAcctSheetOpen] = useState(false);
  const [allItems, setAllItems] = useState([]);
  // Paged rendering of the (potentially 1000-row) ledger.
  const [shown, setShown] = useState(TX_PAGE);
  useEffect(() => { setShown(TX_PAGE); }, [filter, range, customRange, acctId]);

  // account id → short display label (e.g. "Live 98690328"), used by the
  // scope chips, each row's account tag, and the PDF.
  const acctMap = useMemo(() => {
    const m = {};
    for (const a of accounts || []) {
      const id = String(a.id || a._id || '');
      if (!id) continue;
      m[id] = `${a.is_demo ? 'Demo' : 'Live'} ${a.account_number || id.slice(0, 8)}`;
    }
    return m;
  }, [accounts]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Backend ignores per_page/type — it returns the full ledger, so we fetch
      // once and filter on the client.
      const res = await ApiService.getTransactions({ page: 1, perPage: 1000 });
      const list = Array.isArray(res) ? res : (Array.isArray(res?.items) ? res.items : []);
      setAllItems(list);
    } catch (_) {
      setAllItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const items = useMemo(() => {
    const cutoff = range === 'custom' ? null : rangeCutoff(range);
    const win = range === 'custom' ? customRange : null;
    return allItems.filter((tx) => {
      if (acctId && String(tx.account_id || '') !== acctId) return false;
      if (cutoff != null || win) {
        const ts = Date.parse(tx.created_at || tx.createdAt || '');
        if (!Number.isFinite(ts)) return false;
        if (cutoff != null && ts < cutoff) return false;
        if (win && (ts < win.from || ts > win.to)) return false;
      }
      if (filter === 'all') return true;
      const t = String(tx.type || tx.kind || '').toLowerCase();
      // Trade-close ledger rows are typed profit/loss by the backend.
      if (filter === 'trading') return t === 'profit' || t === 'loss';
      return t.includes(filter);
    });
  }, [allItems, filter, range, customRange, acctId]);

  const exportPdf = useCallback(async () => {
    if (!items.length) { showToast({ kind: 'warn', message: 'No transactions to export' }); return; }
    setExporting(true);
    try {
      const rangeLabel = range === 'custom' && customRange
        ? formatRangeLabel(customRange.from, customRange.to)
        : (RANGE_OPTIONS.find((r) => r.value === range) || {}).label;
      const { uri } = await Print.printToFileAsync({
        html: buildHtml(items, filter, rangeLabel, acctId ? acctMap[acctId] : null, acctMap),
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Transactions PDF', UTI: 'com.adobe.pdf' });
      } else {
        showToast({ kind: 'info', message: `Saved to: ${uri}` });
      }
    } catch (e) {
      showToast({ kind: 'error', message: e?.message || 'Could not export PDF' });
    } finally {
      setExporting(false);
    }
  }, [items, filter, range, customRange, acctId, acctMap]);

  return (
    <Screen edges={['top']}>
      <View style={styles.header}>
        <IconButton icon={<Ionicons name="chevron-back" size={22} color={vantage.textPrimary} />} accessibilityLabel="Back" onPress={() => nav.goBack()} />
        <Text style={styles.title}>Transactions</Text>
        <IconButton
          icon={<Ionicons name={exporting ? 'hourglass-outline' : 'download-outline'} size={20} color={vantage.accent} />}
          accessibilityLabel="Download PDF"
          onPress={exporting ? undefined : exportPdf}
        />
      </View>
      {/* Account scope — the ledger mixes all accounts; a compact dropdown
          bar opens a sheet to pick one. Hidden for single-account users. */}
      {Object.keys(acctMap).length > 1 ? (
        <Pressable
          onPress={() => setAcctSheetOpen(true)}
          style={styles.acctBar}
          accessibilityRole="button"
          accessibilityLabel="Filter by account"
        >
          <Ionicons name="wallet-outline" size={15} color={vantage.textSecondary} />
          <Text style={styles.acctBarLab}>Account</Text>
          <Text style={styles.acctBarVal} numberOfLines={1}>
            {acctId ? acctMap[acctId] : 'All accounts'}
          </Text>
          <Ionicons name="chevron-down" size={15} color={vantage.textMuted} />
        </Pressable>
      ) : null}
      <Sheet visible={acctSheetOpen} onClose={() => setAcctSheetOpen(false)} title="Select account">
        <View style={styles.acctSheetWrap}>
          {[[null, 'All accounts'], ...Object.entries(acctMap)].map(([id, label]) => {
            const active = acctId === id;
            return (
              <Pressable
                key={id ?? 'all'}
                onPress={() => { setAcctId(id); setAcctSheetOpen(false); }}
                style={[styles.acctOption, active && styles.acctOptionActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Ionicons
                  name={id == null ? 'albums-outline' : 'wallet-outline'}
                  size={18}
                  color={active ? vantage.accent : vantage.textSecondary}
                />
                <Text style={[styles.acctOptionTxt, active && { color: vantage.accent }]}>{label}</Text>
                <View style={{ flex: 1 }} />
                {active ? <Ionicons name="checkmark-circle" size={18} color={vantage.accent} /> : null}
              </Pressable>
            );
          })}
        </View>
      </Sheet>
      <CategoryTabs value={filter} onChange={setFilter} options={FILTER_OPTIONS} />
      {/* Date range — combines with the type filter above; also scopes the
          PDF export. "Custom" opens the From→To calendar. */}
      <View style={styles.rangeRow}>
        {RANGE_OPTIONS.map((r) => {
          const active = range === r.value;
          return (
            <Pressable
              key={r.value}
              onPress={() => setRange(r.value)}
              style={[styles.rangeChip, active && styles.rangeChipActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.rangeTxt, active && styles.rangeTxtActive]}>{r.label}</Text>
            </Pressable>
          );
        })}
        <Pressable
          onPress={() => setPickerOpen(true)}
          style={[styles.rangeChip, styles.customChip, range === 'custom' && styles.rangeChipActive]}
          accessibilityRole="button"
          accessibilityState={{ selected: range === 'custom' }}
          accessibilityLabel="Custom date range"
        >
          <Ionicons name="calendar-outline" size={13} color={range === 'custom' ? vantage.accent : vantage.textSecondary} />
          <Text style={[styles.rangeTxt, range === 'custom' && styles.rangeTxtActive]}>
            {range === 'custom' && customRange ? formatRangeLabel(customRange.from, customRange.to) : 'Custom'}
          </Text>
        </Pressable>
      </View>
      <DateRangeSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        initialFrom={customRange?.from}
        initialTo={customRange?.to}
        onApply={(win) => { setCustomRange(win); setRange('custom'); }}
      />
      <FlatList
        data={items.slice(0, shown)}
        contentContainerStyle={{ paddingBottom: BOTTOM_NAV_PILL_HEIGHT + space.huge }}
        keyExtractor={(item, idx) => String(item.id || item._id || idx)}
        renderItem={({ item }) => <Row tx={item} acctLabel={acctMap[String(item.account_id || '')]} />}
        ListEmptyComponent={loading ? null : <Text style={styles.empty}>No transactions.</Text>}
        // Explicit pagination: a page of TX_PAGE rows and a visible
        // "Show more" button — the ledger can be 1000+ rows.
        ListFooterComponent={items.length > shown ? (
          <Pressable
            onPress={() => setShown((n) => n + TX_PAGE)}
            style={styles.showMoreBtn}
            accessibilityRole="button"
            accessibilityLabel="Show more transactions"
          >
            <Text style={styles.showMoreTxt}>
              Show more ({items.length - shown} remaining)
            </Text>
            <Ionicons name="chevron-down" size={16} color={vantage.textSecondary} />
          </Pressable>
        ) : items.length > TX_PAGE ? (
          <Text style={styles.pagingFooter}>All {items.length} transactions shown</Text>
        ) : null}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={vantage.accent} colors={[vantage.accent]} />}
      />
    </Screen>
  );
}

function buildHtml(items, filter, rangeLabel, acctLabel, acctMap = {}) {
  const rows = items.map((tx) => {
    const type = String(tx.type || tx.kind || '').toUpperCase();
    const method = tx.payment_method || tx.method || tx.gateway || tx.type || '';
    const account = acctMap[String(tx.account_id || '')] || '—';
    const amount = Number(tx.amount ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const status = tx.status || 'pending';
    let date = '';
    try { date = tx.created_at ? new Date(tx.created_at).toLocaleString() : ''; } catch (_) {}
    return `<tr><td>${date}</td><td>${account}</td><td>${type}</td><td>${method}</td><td style="text-align:right">${amount}</td><td>${status}</td></tr>`;
  }).join('');
  let now = '';
  try { now = new Date().toLocaleString(); } catch (_) {}
  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
  body{font-family:-apple-system,Roboto,Helvetica,sans-serif;padding:24px;color:#111}
  .brand{display:flex;align-items:center;justify-content:space-between;margin:0 0 12px}
  .brand img{height:34px}
  h1{font-size:20px;margin:0 0 4px}
  .sub{color:#666;font-size:12px;margin:0 0 16px}
  table{width:100%;border-collapse:collapse;font-size:12px}
  th,td{border-bottom:1px solid #eee;padding:8px;text-align:left}
  th{background:#fafafa;text-transform:uppercase;font-size:10px;letter-spacing:.5px;color:#555}
</style></head><body>
  <div class="brand">
    <h1>ProlineMarket — Transactions${acctLabel ? ' · ' + acctLabel : ''}${filter !== 'all' ? ' · ' + filter : ''}${rangeLabel && rangeLabel !== 'All time' ? ' · ' + rangeLabel : ''}</h1>
    <img src="${BRAND_LOGO_DATA_URI}" alt="ProlineMarket"/>
  </div>
  <p class="sub">Generated ${now} · ${items.length} records</p>
  <table>
    <thead><tr><th>Date</th><th>Account</th><th>Type</th><th>Method</th><th>Amount (USD)</th><th>Status</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body></html>`;
}

function Row({ tx, acctLabel }) {
  const t = String(tx.type || tx.kind || '').toLowerCase();
  const isDeposit = t.includes('deposit');
  const isWithdraw = t.includes('withdraw');
  // Trade-close ledger rows: sign/colour by result, trade details underneath.
  const isProfit = t === 'profit';
  const isLoss = t === 'loss';
  const color = (isDeposit || isProfit) ? vantage.up : ((isWithdraw || isLoss) ? vantage.down : vantage.textPrimary);
  const sign = (isDeposit || isProfit) ? '+' : ((isWithdraw || isLoss) ? '−' : '');
  const amount = Math.abs(Number(tx.amount ?? 0));
  const method = tx.payment_method || tx.method || tx.gateway || tx.type || 'Transaction';
  const status = String(tx.status || '').toLowerCase();
  const desc = String(tx.description || '').trim();
  let dateStr = '';
  try { dateStr = tx.created_at ? new Date(tx.created_at).toLocaleDateString() : ''; } catch (_) {}
  const icon = isProfit ? 'trending-up'
    : isLoss ? 'trending-down'
    : isDeposit ? 'arrow-down-circle'
    : isWithdraw ? 'arrow-up-circle'
    : 'swap-horizontal';
  return (
    <View style={rowStyles.row}>
      <Ionicons name={icon} size={22} color={color} />
      <View style={{ flex: 1, marginLeft: space.md }}>
        <Text style={rowStyles.method}>{String(method).toUpperCase()}</Text>
        <Text style={rowStyles.date} numberOfLines={1}>
          {/* Account tag first so the user always knows WHOSE row this is. */}
          {[acctLabel, (isProfit || isLoss) && desc ? desc : null, dateStr]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[rowStyles.amount, { color }]}>{sign}${amount.toFixed(2)}</Text>
        <Text style={[rowStyles.status, status === 'completed' && { color: vantage.up }, status === 'failed' && { color: vantage.down }]}>{status || 'pending'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pagingFooter: { color: vantage.textMuted, fontFamily, fontSize: sizes.label, textAlign: 'center', paddingVertical: space.md },
  showMoreBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginHorizontal: space.lg, marginTop: space.sm, paddingVertical: space.md,
    borderWidth: 1, borderColor: vantage.border, borderRadius: radius.md, backgroundColor: vantage.bgRaised,
  },
  showMoreTxt: { color: vantage.textSecondary, fontFamily, fontSize: sizes.label, fontWeight: weights.semibold },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.sm, paddingTop: space.sm, paddingBottom: space.xs },
  rangeRow: { flexDirection: 'row', gap: space.xs, paddingHorizontal: space.lg, paddingTop: space.xs, paddingBottom: space.sm },
  acctBar: {
    flexDirection: 'row', alignItems: 'center', gap: space.xs,
    marginHorizontal: space.lg, marginBottom: space.sm,
    paddingHorizontal: space.md, paddingVertical: 10,
    borderWidth: 1, borderColor: vantage.border, borderRadius: radius.md, backgroundColor: vantage.bgRaised,
  },
  acctBarLab: { color: vantage.textMuted, fontFamily, fontSize: sizes.label, fontWeight: weights.semibold, textTransform: 'uppercase', letterSpacing: 0.5 },
  acctBarVal: { flex: 1, color: vantage.textPrimary, fontFamily, fontSize: sizes.body, fontWeight: weights.semibold, textAlign: 'right' },
  acctSheetWrap: { paddingHorizontal: space.lg, paddingBottom: space.lg, gap: space.xs },
  acctOption: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    paddingHorizontal: space.md, paddingVertical: space.md,
    borderWidth: 1, borderColor: vantage.border, borderRadius: radius.md, backgroundColor: vantage.bgRaised,
  },
  acctOptionActive: { borderColor: vantage.accent },
  acctOptionTxt: { color: vantage.textPrimary, fontFamily, fontSize: sizes.body, fontWeight: weights.semibold },
  rangeChip: {
    paddingHorizontal: space.md, paddingVertical: 6, borderRadius: 999,
    borderWidth: 1, borderColor: vantage.border, backgroundColor: vantage.bgRaised,
  },
  rangeChipActive: { borderColor: vantage.accent, backgroundColor: vantage.accentSoft || vantage.bgRaised },
  customChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rangeTxt: { color: vantage.textSecondary, fontFamily, fontSize: sizes.label, fontWeight: weights.semibold },
  rangeTxtActive: { color: vantage.accent },
  title: { flex: 1, color: vantage.textPrimary, fontFamily, fontSize: sizes.h2, fontWeight: weights.heavy, textAlign: 'center' },
  empty: { color: vantage.textMuted, fontFamily, fontSize: sizes.body, padding: space.huge, textAlign: 'center' },
});

const rowStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingVertical: space.md, borderBottomColor: vantage.border, borderBottomWidth: StyleSheet.hairlineWidth },
  method: { color: vantage.textPrimary, fontFamily, fontSize: sizes.body, fontWeight: weights.semibold },
  date: { color: vantage.textMuted, fontFamily, fontSize: sizes.label, marginTop: 2 },
  amount: { fontFamily, fontSize: sizes.body, fontWeight: weights.heavy },
  status: { color: vantage.textMuted, fontFamily, fontSize: sizes.label, marginTop: 2, textTransform: 'capitalize' },
});
