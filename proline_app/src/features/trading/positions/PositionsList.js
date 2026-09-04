import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { SegmentedTabs, Card, Sheet, PillButton, PriceTicker, showToast, showAppAlert, DateRangeSheet, formatRangeLabel } from '../../../components/vantage';
import { vantage, space, sizes, weights, fontFamily, radius } from '../../../theme/vantageTheme';
import ApiService from '../../../services/api/ApiService';
import { isSoftTradeError, handleTradeError } from '../../../utils/tradeErrors';
import { BRAND_LOGO_DATA_URI } from '../../../constants/brandLogo';
import { formatMoney, formatSignedMoney } from '../../../utils/format';
import logger from '../../../utils/logger';

// History date-range filter options and their cutoffs.
const HISTORY_RANGES = [
  { value: 'all',   label: 'All' },
  { value: 'today', label: 'Today' },
  { value: 'week',  label: '7D' },
  { value: 'month', label: '30D' },
];
const HISTORY_RANGE_LABEL = {
  all: 'All time', today: 'Today', week: 'Last 7 days', month: 'Last 30 days',
};

function historyCutoff(range) {
  const now = new Date();
  if (range === 'today') { const d = new Date(now); d.setHours(0, 0, 0, 0); return d.getTime(); }
  if (range === 'week') return now.getTime() - 7 * 24 * 3600 * 1000;
  if (range === 'month') return now.getTime() - 30 * 24 * 3600 * 1000;
  return null;
}

function closeTimeOf(trade) {
  return Date.parse(trade.close_time || trade.closed_at || trade.closedAt || '') || 0;
}

/** Branded printable statement for the (filtered) closed trades. */
function buildHistoryHtml(trades, rangeLabel, account) {
  const netOf = (t) => {
    const gross = Number(t.pnl ?? t.profit ?? t.realized_pnl ?? 0) || 0;
    return gross - (Number(t.commission ?? 0) || 0) + (Number(t.swap ?? 0) || 0);
  };
  const totalNet = trades.reduce((s, t) => s + netOf(t), 0);
  const rows = trades.map((t) => {
    const ts = closeTimeOf(t);
    const date = ts ? new Date(ts).toLocaleString() : '';
    const net = netOf(t);
    return `<tr>
      <td>${date}</td><td>${t.symbol || ''}</td><td>${String(t.side || '').toUpperCase()}</td>
      <td style="text-align:right">${t.lots ?? t.volume ?? t.quantity ?? ''}</td>
      <td style="text-align:right">${t.open_price ?? ''}</td>
      <td style="text-align:right">${t.close_price ?? ''}</td>
      <td style="text-align:right">${formatMoney(t.commission ?? 0)}</td>
      <td style="text-align:right">${formatMoney(t.swap ?? 0)}</td>
      <td style="text-align:right;color:${net >= 0 ? '#16a34a' : '#dc2626'}">${formatSignedMoney(net)}</td>
    </tr>`;
  }).join('');
  const acctLabel = account
    ? `${account.is_demo ? 'Demo' : 'Live'} ${account.account_number || account.id || ''}`
    : '';
  let now = '';
  try { now = new Date().toLocaleString(); } catch (_) {}
  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
  body{font-family:-apple-system,Roboto,Helvetica,sans-serif;padding:24px;color:#111}
  .brand{display:flex;align-items:center;justify-content:space-between;margin:0 0 12px}
  .brand img{height:34px}
  h1{font-size:20px;margin:0 0 4px}
  .sub{color:#666;font-size:12px;margin:0 0 16px}
  table{width:100%;border-collapse:collapse;font-size:11px}
  th,td{border-bottom:1px solid #eee;padding:6px;text-align:left}
  th{background:#fafafa;text-transform:uppercase;font-size:9px;letter-spacing:.5px;color:#555}
  tfoot td{font-weight:700;border-top:2px solid #ddd}
</style></head><body>
  <div class="brand">
    <h1>Trade History Statement</h1>
    <img src="${BRAND_LOGO_DATA_URI}" alt="ProlineMarket"/>
  </div>
  <p class="sub">${acctLabel ? acctLabel + ' · ' : ''}${rangeLabel} · Generated ${now} · ${trades.length} trades</p>
  <table>
    <thead><tr><th>Closed</th><th>Symbol</th><th>Side</th><th>Lots</th><th>Open</th><th>Close</th><th>Commission</th><th>Swap</th><th>Net P&amp;L</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr><td colspan="8">Total net P&amp;L</td><td style="text-align:right;color:${totalNet >= 0 ? '#16a34a' : '#dc2626'}">${formatSignedMoney(totalNet)}</td></tr></tfoot>
  </table>
</body></html>`;
}

const HISTORY_PAGE = 20;

export default function PositionsList({ positions = [], orders = [], history = [], historyTotal = null, onLoadMoreHistory, account, accountSummary, onChange }) {
  const [view, setView] = useState('positions');
  // History pagination — render a page at a time instead of every closed trade.
  const [historyShown, setHistoryShown] = useState(HISTORY_PAGE);
  useEffect(() => { if (view !== 'history') setHistoryShown(HISTORY_PAGE); }, [view]);

  // Real closed-trade count: the fetched list is server-paged (50/page), so
  // history.length caps at what's been fetched — the server total is truth.
  const closedCount = historyTotal != null ? historyTotal : history.length;
  // More rows exist on the server beyond what's been fetched so far.
  const serverHasMore = historyTotal != null && history.length < historyTotal;

  // History date filter + PDF export. 'custom' uses the From→To calendar.
  const [historyRange, setHistoryRange] = useState('all');
  const [historyCustom, setHistoryCustom] = useState(null); // {from, to} ms
  const [historyPickerOpen, setHistoryPickerOpen] = useState(false);
  useEffect(() => { setHistoryShown(HISTORY_PAGE); }, [historyRange, historyCustom]);
  const filteredHistory = useMemo(() => {
    if (historyRange === 'custom' && historyCustom) {
      return history.filter((h) => {
        const ts = closeTimeOf(h);
        return ts >= historyCustom.from && ts <= historyCustom.to;
      });
    }
    const cutoff = historyCutoff(historyRange);
    if (cutoff == null) return history;
    return history.filter((h) => closeTimeOf(h) >= cutoff);
  }, [history, historyRange, historyCustom]);
  const historyRangeLabel = historyRange === 'custom' && historyCustom
    ? formatRangeLabel(historyCustom.from, historyCustom.to)
    : HISTORY_RANGE_LABEL[historyRange];

  const [exporting, setExporting] = useState(false);
  const exportHistoryPdf = useCallback(async () => {
    if (!filteredHistory.length) {
      showToast({ kind: 'warn', message: 'No trades in this period to export' });
      return;
    }
    setExporting(true);
    try {
      const { uri } = await Print.printToFileAsync({
        html: buildHistoryHtml(filteredHistory, historyRangeLabel, account),
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Trade History PDF', UTI: 'com.adobe.pdf' });
      } else {
        showToast({ kind: 'info', message: `Saved to: ${uri}` });
      }
    } catch (e) {
      logger.error('PositionsList: history PDF export failed', e);
      showToast({ kind: 'error', message: e?.message || 'Could not export PDF' });
    } finally {
      setExporting(false);
    }
  }, [filteredHistory, historyRangeLabel, account]);
  const [slTpTarget, setSlTpTarget] = useState(null);
  // Themed close-confirm flows. We track the position *id* (not the object) so
  // the open sheet always re-reads the latest `positions` prop → live P&L.
  const [closeId, setCloseId] = useState(null);
  // Bulk-close confirm: null (closed) | 'all' | 'profit' | 'loss'.
  const [closeAllType, setCloseAllType] = useState(null);

  // Close one position — fully, or partially when `lotsToClose` is less than
  // the open volume (mirrors the web close dialog's 25/50/75/FULL flow).
  const confirmCloseOne = useCallback(async (lotsToClose = null) => {
    if (!closeId) return;
    try {
      const res = await ApiService.closePosition(closeId, lotsToClose);
      const remaining = Number(res?.remaining_lots ?? 0);
      showToast({
        kind: 'success',
        message: remaining > 0
          ? `Partially closed — ${remaining.toFixed(2)} lots remain`
          : 'Position closed',
      });
      onChange?.();
    } catch (e) {
      // MAM-mirrored / market-closed responses surface as a calm info popup
      // instead of a red error.
      handleTradeError(e?.message, 'Close failed');
    } finally {
      setCloseId(null);
    }
  }, [closeId, onChange]);

  // Subset a bulk-close type operates on (same buckets as the web dialog).
  const bulkTargets = useCallback((type) => {
    if (type === 'profit') return positions.filter((p) => (plOf(p) ?? 0) >= 0);
    if (type === 'loss') return positions.filter((p) => (plOf(p) ?? 0) < 0);
    return positions;
  }, [positions]);

  const confirmCloseAll = useCallback(async () => {
    const type = closeAllType || 'all';
    const ids = bulkTargets(type).map((p) => p.id || p._id).filter(Boolean);
    if (!ids.length) { setCloseAllType(null); return; }
    const results = await Promise.allSettled(ids.map((id) => ApiService.closePosition(id)));
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    const rejected = results.filter((r) => r.status === 'rejected');
    // MAM-mirrored / closed-market positions are "skipped", not failures.
    const skipped = rejected.filter((r) => isSoftTradeError(r.reason?.message)).length;
    const failed = rejected.length - skipped;

    setCloseAllType(null);
    onChange?.();

    if (failed > 0) {
      // Only genuine failures use the red error toast.
      showToast({ kind: 'error', message: `Closed ${ok}${skipped ? `, ${skipped} skipped` : ''}, ${failed} failed` });
    } else if (skipped > 0) {
      // Managed (MAM) / market-closed positions can't be closed here — show a
      // calm themed popup, not an error.
      showAppAlert({
        title: 'Some positions skipped',
        message: ok > 0
          ? `Closed ${ok} position(s). ${skipped} couldn't be closed here because they're managed (MAM) trades or the market is closed.`
          : `These ${skipped} position(s) can't be closed here — they're managed (MAM) trades or the market is closed.`,
      });
    } else {
      showToast({ kind: 'success', message: `Closed ${ok} position(s)` });
    }
  }, [closeAllType, bulkTargets, onChange]);

  const closingPos = closeId
    ? positions.find((p) => String(p.id || p._id) === String(closeId)) || null
    : null;

  const handleCancelOrder = useCallback(async (id) => {
    try {
      await ApiService.cancelOrder(id);
      showToast({ kind: 'success', message: 'Order cancelled' });
      onChange?.();
    } catch (e) {
      showToast({ kind: 'error', message: e?.message || 'Cancel failed' });
    }
  }, [onChange]);

  return (
    <View style={styles.wrap}>
      <AccountSummaryCard account={account} summary={accountSummary} openCount={positions.length} closedCount={closedCount} />

      <View style={styles.headerRow}>
        <SegmentedTabs
          value={view}
          onChange={setView}
          options={[
            { value: 'positions', label: `Positions (${positions.length})` },
            { value: 'pending',   label: `Pending (${orders.length})` },
            { value: 'history',   label: `History (${closedCount})` },
          ]}
        />
      </View>

      {view === 'positions' ? (
        positions.length === 0 ? (
          <Text style={styles.empty}>No open positions.</Text>
        ) : (
          <>
            <View style={styles.closeAllRow}>
              <Pressable onPress={() => setCloseAllType('all')} style={styles.closeAllBtn} accessibilityRole="button" accessibilityLabel="Close all positions">
                <Ionicons name="close-circle-outline" size={16} color={vantage.down} />
                <Text style={styles.closeAllTxt}>Close all ({positions.length})</Text>
              </Pressable>
            </View>
            {positions.map((p) => (
              <PositionRow
                key={p.id || p._id}
                position={p}
                onClose={() => setCloseId(p.id || p._id)}
                onSetSlTp={() => setSlTpTarget(p)}
              />
            ))}
          </>
        )
      ) : view === 'pending' ? (
        orders.length === 0 ? (
          <Text style={styles.empty}>No pending orders.</Text>
        ) : orders.map((o) => (
          <OrderRow key={o.id || o._id} order={o} onCancel={() => handleCancelOrder(o.id || o._id)} />
        ))
      ) : (
        history.length === 0 ? (
          <Text style={styles.empty}>No trade history.</Text>
        ) : (
          <>
            {/* Date-range filter + PDF export for the filtered set. */}
            <View style={styles.histControls}>
              <View style={{ flex: 1 }}>
                <SegmentedTabs value={historyRange} onChange={setHistoryRange} options={HISTORY_RANGES} />
              </View>
              <Pressable
                onPress={() => setHistoryPickerOpen(true)}
                style={styles.pdfBtn}
                accessibilityRole="button"
                accessibilityLabel="Custom date range"
              >
                <Ionicons name="calendar-outline" size={18} color={historyRange === 'custom' ? vantage.accent : vantage.textSecondary} />
              </Pressable>
              <Pressable
                onPress={exporting ? undefined : exportHistoryPdf}
                style={styles.pdfBtn}
                accessibilityRole="button"
                accessibilityLabel="Download trade history PDF"
              >
                <Ionicons name={exporting ? 'hourglass-outline' : 'download-outline'} size={18} color={vantage.accent} />
              </Pressable>
            </View>
            {historyRange === 'custom' && historyCustom ? (
              <View style={styles.customRangeRow}>
                <Ionicons name="calendar" size={13} color={vantage.accent} />
                <Text style={styles.customRangeTxt}>{formatRangeLabel(historyCustom.from, historyCustom.to)}</Text>
                <Pressable
                  onPress={() => { setHistoryRange('all'); setHistoryCustom(null); }}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Clear custom range"
                >
                  <Ionicons name="close-circle" size={16} color={vantage.textMuted} />
                </Pressable>
              </View>
            ) : null}
            <DateRangeSheet
              visible={historyPickerOpen}
              onClose={() => setHistoryPickerOpen(false)}
              initialFrom={historyCustom?.from}
              initialTo={historyCustom?.to}
              onApply={(win) => { setHistoryCustom(win); setHistoryRange('custom'); }}
            />
            {filteredHistory.length === 0 ? (
              <Text style={styles.empty}>No trades in this period.</Text>
            ) : (
              <>
                {filteredHistory.slice(0, historyShown).map((h, i) => (
                  <HistoryRow key={h.id || h._id || i} trade={h} />
                ))}
                {filteredHistory.length > historyShown ? (
                  <Pressable
                    onPress={() => setHistoryShown((n) => n + HISTORY_PAGE)}
                    style={styles.showMoreBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Show more trade history"
                  >
                    <Text style={styles.showMoreTxt}>
                      Show more ({filteredHistory.length - historyShown} remaining)
                    </Text>
                    <Ionicons name="chevron-down" size={16} color={vantage.textSecondary} />
                  </Pressable>
                ) : serverHasMore ? (
                  /* Everything fetched so far is on screen but the server has
                     older pages — pull the next 50 and keep revealing. */
                  <Pressable
                    onPress={() => { onLoadMoreHistory?.(); setHistoryShown((n) => n + HISTORY_PAGE); }}
                    style={styles.showMoreBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Load older trades"
                  >
                    <Text style={styles.showMoreTxt}>
                      Load older trades ({historyTotal - history.length} more)
                    </Text>
                    <Ionicons name="cloud-download-outline" size={16} color={vantage.textSecondary} />
                  </Pressable>
                ) : null}
              </>
            )}
          </>
        )
      )}

      <SlTpSheet
        position={slTpTarget}
        onClose={() => setSlTpTarget(null)}
        onSaved={onChange}
      />

      <CloseConfirmSheet
        position={closingPos}
        positions={positions}
        onCancel={() => setCloseId(null)}
        onConfirm={confirmCloseOne}
        onBulk={(type) => { setCloseId(null); setCloseAllType(type); }}
      />

      <CloseAllSheet
        type={closeAllType}
        positions={closeAllType ? bulkTargets(closeAllType) : []}
        onCancel={() => setCloseAllType(null)}
        onConfirm={confirmCloseAll}
      />
    </View>
  );
}

// Helper — pull a position's live NET P&L regardless of which field the API
// used. Net = profit − commission + swap so it matches the website terminal
// exactly. The API returns swap negative for a charge, so adding it subtracts
// the fee; commission is a positive cost.
function plOf(p) {
  if (!p) return null;
  const v = p.profit ?? p.profit_loss ?? p.pl ?? p.pnl ?? null;
  if (v == null) return null;
  const commission = Number(p.commission ?? 0) || 0;
  const swap = Number(p.swap ?? 0) || 0;
  return Number(v) - commission + swap;
}

// Web-parity close sheet: position summary (symbol / side / open lots / live
// P&L), LOTS TO CLOSE with 25/50/75/FULL chips + an editable lots field, the
// estimated P&L for the chosen portion, Cancel/Close, and a BULK CLOSE row
// (All / Profit / Loss with live counts). Because the parent re-derives
// `position` from the latest props on every refresh tick, P&L keeps moving
// while the sheet is open.
const CLOSE_PCTS = [0.25, 0.5, 0.75, 1];
function CloseConfirmSheet({ position, positions = [], onCancel, onConfirm, onBulk }) {
  const [closing, setClosing] = useState(false);
  const [pct, setPct] = useState(1);          // selected chip (null = custom-typed)
  const [lotsText, setLotsText] = useState('');
  const lastIdRef = React.useRef(null);

  const side = String(position?.side || '').toLowerCase();
  const pl = plOf(position);
  const plPositive = pl == null ? true : pl >= 0;
  const openLots = Number(position?.volume ?? position?.lots ?? position?.quantity ?? 0) || 0;
  const open = Number(position?.open_price ?? position?.openPrice ?? 0);

  // Reset the lots selection when a DIFFERENT position opens — not on every
  // live-refresh tick (the parent passes a fresh object each poll).
  useEffect(() => {
    const id = position ? String(position.id || position._id) : null;
    if (id && id !== lastIdRef.current) {
      lastIdRef.current = id;
      setPct(1);
      setLotsText(openLots ? openLots.toFixed(2) : '');
      setClosing(false);
    }
    if (!id) lastIdRef.current = null;
  }, [position, openLots]);

  // Effective lots a chip resolves to: percentage of the open lots snapped to
  // the 0.01 lot step and clamped to [0.01, openLots].
  const chipLots = useCallback((p) => {
    if (!(openLots > 0)) return null;
    if (p === 1) return openLots;
    return Math.max(0.01, Math.min(Math.round(openLots * p * 100) / 100, openLots));
  }, [openLots]);

  // A partial chip whose snapped lots equal the full size can't actually do a
  // partial close (e.g. 75% of a 0.01-lot position is below the minimum trade
  // size) — disable it rather than silently closing 100%.
  const chipDisabled = useCallback(
    (p) => p !== 1 && (chipLots(p) == null || chipLots(p) >= openLots - 1e-9),
    [chipLots, openLots],
  );
  const noPartialPossible = CLOSE_PCTS.every((p) => p === 1 || chipDisabled(p));

  const pickPct = useCallback((p) => {
    if (chipDisabled(p)) return;
    setPct(p);
    const v = chipLots(p);
    if (v != null) setLotsText(v.toFixed(2));
  }, [chipLots, chipDisabled]);

  const lotsNum = Number(lotsText);
  const lotsValid = Number.isFinite(lotsNum) && lotsNum >= 0.01 && lotsNum <= openLots + 1e-9;
  const isFull = lotsValid && Math.abs(lotsNum - openLots) < 0.005;
  // Estimated P&L for the portion being closed (linear in lots, like the web).
  const estPl = pl != null && openLots > 0 && lotsValid ? pl * (lotsNum / openLots) : null;
  const estPositive = estPl == null ? true : estPl >= 0;
  // Effective share of the position being closed — derived from the lots
  // field, so it stays correct for custom-typed amounts, not just the chips.
  const effPct = lotsValid && openLots > 0 ? Math.round((lotsNum / openLots) * 100) : null;

  const profitCount = positions.filter((x) => (plOf(x) ?? 0) >= 0).length;
  const lossCount = positions.length - profitCount;

  const confirm = useCallback(async () => {
    if (!lotsValid) return;
    setClosing(true);
    try { await onConfirm(isFull ? null : lotsNum); } finally { setClosing(false); }
  }, [onConfirm, lotsValid, isFull, lotsNum]);

  return (
    <Sheet visible={!!position} onClose={onCancel} title="Close position">
      {position ? (
        <View style={sheetStyles.wrap}>
          {/* Summary card — Symbol / Side / Open lots / live P&L. */}
          <View style={closeStyles.sumBox}>
            <SumRow label="Symbol" value={position.symbol} bold />
            <SumRow label="Side" value={side.toUpperCase()} color={side === 'buy' ? vantage.up : vantage.down} />
            <SumRow label="Open lots" value={openLots ? openLots.toFixed(2) : '—'} />
            <SumRow label="Open price" value={open ? open.toFixed(5) : '—'} />
            <SumRow
              label="P&L"
              value={pl != null ? `${plPositive ? '+' : '−'}$${Math.abs(pl).toFixed(2)}` : '—'}
              color={plPositive ? vantage.up : vantage.down}
              last
            />
          </View>

          {/* Lots to close — percent chips + editable lots. */}
          <Text style={closeStyles.secLab}>LOTS TO CLOSE</Text>
          <View style={closeStyles.pctRow}>
            {CLOSE_PCTS.map((p) => {
              const active = pct === p;
              const disabled = chipDisabled(p);
              return (
                <Pressable
                  key={p}
                  onPress={() => pickPct(p)}
                  disabled={disabled}
                  style={[
                    closeStyles.pctChip,
                    active && closeStyles.pctChipActive,
                    disabled && { opacity: 0.35 },
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active, disabled }}
                >
                  <Text style={[closeStyles.pctTxt, active && closeStyles.pctTxtActive]}>
                    {p === 1 ? 'FULL' : `${p * 100}%`}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {noPartialPossible ? (
            <Text style={closeStyles.badHint}>
              This position is at the minimum size (0.01 lots) — it can only be closed in full.
            </Text>
          ) : null}
          <TextInput
            value={lotsText}
            onChangeText={(t) => { setLotsText(t.replace(/[^0-9.]/g, '')); setPct(null); }}
            keyboardType="decimal-pad"
            placeholder="0.01"
            placeholderTextColor={vantage.textMuted}
            style={[sheetStyles.input, !lotsValid && lotsText !== '' && closeStyles.inputBad]}
            accessibilityLabel="Lots to close"
          />
          {!lotsValid && lotsText !== '' ? (
            <Text style={closeStyles.badHint}>Enter between 0.01 and {openLots.toFixed(2)} lots.</Text>
          ) : null}

          {/* Estimated P&L for the selected portion — the label names the
              share (percent + lots) the figure belongs to, so "50% → +$4.10"
              reads unambiguously even after typing a custom lots amount. */}
          <View style={closeStyles.estRow}>
            <Text style={closeStyles.estLab}>
              {effPct != null
                ? `EST. P&L · ${effPct}% (${lotsNum.toFixed(2)} lots)`
                : 'EST. P&L'}
            </Text>
            <Text style={[closeStyles.estVal, { color: estPositive ? vantage.up : vantage.down }]}>
              {estPl != null ? `${estPositive ? '+' : '−'}$${Math.abs(estPl).toFixed(2)}` : '—'}
            </Text>
          </View>

          <View style={closeStyles.btnRow}>
            <Pressable onPress={onCancel} disabled={closing} style={closeStyles.cancelBtn} accessibilityRole="button">
              <Text style={closeStyles.cancelBtnTxt}>Cancel</Text>
            </Pressable>
            <PillButton
              label={closing ? 'Closing…' : (isFull ? 'Close' : `Close ${lotsValid ? lotsNum.toFixed(2) : ''} lots`)}
              variant="sell"
              size="lg"
              loading={closing}
              disabled={closing || !lotsValid}
              onPress={confirm}
              style={{ flex: 1 }}
            />
          </View>

          {/* Bulk close — same buckets as the web dialog. */}
          <Text style={closeStyles.bulkLab}>BULK CLOSE</Text>
          <View style={closeStyles.bulkRow}>
            <BulkChip icon="layers-outline" label="All" count={positions.length} color={vantage.textPrimary}
              disabled={closing || positions.length === 0} onPress={() => onBulk?.('all')} />
            <BulkChip icon="trending-up-outline" label="Profit" count={profitCount} color={vantage.up}
              disabled={closing || profitCount === 0} onPress={() => onBulk?.('profit')} />
            <BulkChip icon="trending-down-outline" label="Loss" count={lossCount} color={vantage.down}
              disabled={closing || lossCount === 0} onPress={() => onBulk?.('loss')} />
          </View>
        </View>
      ) : null}
    </Sheet>
  );
}

function SumRow({ label, value, color, bold, last }) {
  return (
    <View style={[closeStyles.sumRow, !last && closeStyles.sumRowBorder]}>
      <Text style={closeStyles.sumRowLab}>{label}</Text>
      <Text style={[closeStyles.sumRowVal, color ? { color } : null, bold ? { fontWeight: weights.heavy } : null]}>
        {value}
      </Text>
    </View>
  );
}

function BulkChip({ icon, label, count, color, disabled, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[closeStyles.bulkChip, disabled && { opacity: 0.4 }]}
      accessibilityRole="button"
      accessibilityLabel={`Close ${label.toLowerCase()} positions`}
    >
      <Ionicons name={icon} size={16} color={color} />
      <Text style={[closeStyles.bulkChipTxt, { color }]}>{label}</Text>
      <Text style={closeStyles.bulkChipCount}>({count})</Text>
    </Pressable>
  );
}

// Bulk-close confirm sheet — All / Profit / Loss buckets. Shows the subset's
// combined live P&L and closes every position in it at market on confirm.
const BULK_TITLES = { all: 'Close all', profit: 'Close profitable', loss: 'Close losing' };
function CloseAllSheet({ type, positions, onCancel, onConfirm }) {
  const [closing, setClosing] = useState(false);
  const total = (positions || []).reduce((sum, p) => sum + (plOf(p) ?? 0), 0);
  const positive = total >= 0;
  const title = BULK_TITLES[type] || 'Close all';

  const confirm = useCallback(async () => {
    setClosing(true);
    try { await onConfirm(); } finally { setClosing(false); }
  }, [onConfirm]);

  return (
    <Sheet visible={!!type} onClose={onCancel} title={`${title} (${positions?.length || 0})`}>
      <View style={sheetStyles.wrap}>
        <View style={closeStyles.plBox}>
          <Text style={closeStyles.plLab}>Combined live P&L</Text>
          <Text style={[closeStyles.plBig, { color: positive ? vantage.up : vantage.down }]}>
            {`${positive ? '+' : ''}${total.toFixed(2)} USD`}
          </Text>
        </View>

        <Text style={sheetStyles.hint}>
          This closes {positions?.length || 0} open position(s) at the current market price.
        </Text>

        <PillButton
          label={closing ? 'Closing…' : `${title} — ${positions?.length || 0} position(s)`}
          variant="sell"
          size="lg"
          loading={closing}
          disabled={closing || !(positions?.length > 0)}
          onPress={confirm}
          style={{ marginTop: space.lg }}
        />
        <Pressable onPress={onCancel} disabled={closing} style={closeStyles.cancel} accessibilityRole="button">
          <Text style={closeStyles.cancelTxt}>Cancel</Text>
        </Pressable>
      </View>
    </Sheet>
  );
}

const closeStyles = StyleSheet.create({
  // Summary card (Symbol / Side / Open lots / P&L)
  sumBox: {
    backgroundColor: vantage.bgRaised, borderRadius: radius.md,
    borderWidth: 1, borderColor: vantage.border,
    paddingHorizontal: space.md, marginBottom: space.md,
  },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: space.sm },
  sumRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: vantage.border },
  sumRowLab: { color: vantage.textMuted, fontFamily, fontSize: sizes.label },
  sumRowVal: { color: vantage.textPrimary, fontFamily, fontSize: sizes.label, fontWeight: weights.bold },
  // Lots-to-close section
  secLab: { color: vantage.textMuted, fontFamily, fontSize: sizes.micro, fontWeight: weights.bold, letterSpacing: 0.6, marginBottom: space.sm },
  pctRow: { flexDirection: 'row', gap: space.sm, marginBottom: space.sm },
  pctChip: {
    paddingHorizontal: space.md, paddingVertical: 6,
    borderRadius: radius.sm || 6, borderWidth: 1, borderColor: vantage.border,
    backgroundColor: vantage.bgRaised,
  },
  pctChipActive: { borderColor: vantage.accent, backgroundColor: vantage.accentMuted || 'rgba(242,106,31,0.15)' },
  pctTxt: { color: vantage.textSecondary, fontFamily, fontSize: sizes.label, fontWeight: weights.bold },
  pctTxtActive: { color: vantage.accent },
  inputBad: { borderColor: vantage.down },
  badHint: { color: vantage.down, fontFamily, fontSize: sizes.micro, marginTop: space.xs },
  estRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: vantage.bgRaised, borderRadius: radius.md, borderWidth: 1, borderColor: vantage.border,
    paddingHorizontal: space.md, paddingVertical: space.md, marginTop: space.md,
  },
  estLab: { color: vantage.textMuted, fontFamily, fontSize: sizes.micro, fontWeight: weights.bold, letterSpacing: 0.6 },
  estVal: { fontFamily, fontSize: sizes.body, fontWeight: weights.heavy },
  btnRow: { flexDirection: 'row', gap: space.sm, marginTop: space.lg, alignItems: 'stretch' },
  cancelBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    borderRadius: radius.pill, borderWidth: 1, borderColor: vantage.border,
    backgroundColor: vantage.bgRaised,
  },
  cancelBtnTxt: { color: vantage.textPrimary, fontFamily, fontSize: sizes.body, fontWeight: weights.bold },
  // Bulk close
  bulkLab: {
    color: vantage.textMuted, fontFamily, fontSize: sizes.micro, fontWeight: weights.bold,
    letterSpacing: 0.6, textAlign: 'center',
    marginTop: space.lg, paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: vantage.border,
  },
  bulkRow: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
  bulkChip: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2,
    borderRadius: radius.md, borderWidth: 1, borderColor: vantage.border,
    backgroundColor: vantage.bgRaised, paddingVertical: space.md,
  },
  bulkChipTxt: { fontFamily, fontSize: sizes.label, fontWeight: weights.bold },
  bulkChipCount: { color: vantage.textMuted, fontFamily, fontSize: sizes.micro },
  plBox: {
    alignItems: 'center',
    backgroundColor: vantage.bgRaised,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: vantage.border,
    paddingVertical: space.lg,
    marginBottom: space.md,
  },
  plLab: { color: vantage.textMuted, fontFamily, fontSize: sizes.label },
  plBig: { fontFamily, fontSize: sizes.hero, fontWeight: weights.heavy, marginTop: 4 },
  plSub: { color: vantage.textMuted, fontFamily, fontSize: sizes.label, marginTop: 4 },
  cancel: { alignItems: 'center', paddingVertical: space.md, marginTop: space.xs },
  cancelTxt: { color: vantage.textSecondary, fontFamily, fontSize: sizes.body, fontWeight: weights.semibold },
});

function SlTpSheet({ position, onClose, onSaved }) {
  const [sl, setSl] = useState('');
  const [tp, setTp] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!position) return;
    const curSl = position.stop_loss ?? position.sl ?? '';
    const curTp = position.take_profit ?? position.tp ?? '';
    setSl(curSl ? String(curSl) : '');
    setTp(curTp ? String(curTp) : '');
  }, [position]);

  const save = useCallback(async () => {
    if (!position) return;
    setSaving(true);
    try {
      await ApiService.modifyPosition(position.id || position._id, {
        stop_loss: sl ? Number(sl) : null,
        take_profit: tp ? Number(tp) : null,
      });
      showToast({ kind: 'success', message: 'SL/TP updated' });
      onSaved?.();
      onClose();
    } catch (e) {
      showToast({ kind: 'error', message: e?.message || 'Update failed' });
    } finally {
      setSaving(false);
    }
  }, [position, sl, tp, onSaved, onClose]);

  const side = String(position?.side || '').toLowerCase();
  const current = position?.current_price ?? position?.currentPrice ?? null;

  return (
    <Sheet visible={!!position} onClose={onClose} title="Set SL / TP">
      {position ? (
        <View style={sheetStyles.wrap}>
          <View style={sheetStyles.head}>
            <Text style={styles.sym}>{position.symbol}</Text>
            <Text style={[styles.side, { color: side === 'buy' ? vantage.up : vantage.down }]}>
              {side.toUpperCase()} {position.volume ?? position.lots ?? '—'}
              {current != null ? `  ·  ${Number(current).toFixed(5)}` : ''}
            </Text>
          </View>

          <Text style={sheetStyles.label}>Stop Loss</Text>
          <TextInput
            value={sl}
            onChangeText={(t) => setSl(t.replace(/[^0-9.]/g, ''))}
            keyboardType="decimal-pad"
            placeholder="0.00000"
            placeholderTextColor={vantage.textMuted}
            style={sheetStyles.input}
          />

          <Text style={[sheetStyles.label, { marginTop: space.md }]}>Take Profit</Text>
          <TextInput
            value={tp}
            onChangeText={(t) => setTp(t.replace(/[^0-9.]/g, ''))}
            keyboardType="decimal-pad"
            placeholder="0.00000"
            placeholderTextColor={vantage.textMuted}
            style={sheetStyles.input}
          />

          <Text style={sheetStyles.hint}>Leave a field blank to remove that level.</Text>

          <PillButton
            label={saving ? 'Saving…' : 'Save SL / TP'}
            variant="primary"
            size="lg"
            loading={saving}
            disabled={saving}
            onPress={save}
            style={{ marginTop: space.lg }}
          />
        </View>
      ) : null}
    </Sheet>
  );
}

// Where a trade came from, shown as a badge exactly as the web terminal does.
// Backend tags: self_trade = placed by hand, copy_trade = mirrored from a
// master, algo_trade = placed by an external bot through the algo API. Older
// rows carry no trade_type, so fall back to the account prefix — CF/IF is an
// investor sub-account, i.e. a MAM mirror.
function tradeSource(tradeType, accountNumber) {
  const t = String(tradeType || '').toLowerCase();
  if (t === 'algo_trade' || t === 'algo') {
    return { label: 'Algo', color: vantage.accent, bg: vantage.accentMuted };
  }
  const acct = String(accountNumber || '').toUpperCase();
  const looksInvestor = acct.startsWith('CF') || acct.startsWith('IF');
  if (t === 'copy_trade' || t === 'mam' || t === 'pamm' || looksInvestor) {
    return { label: 'MAM', color: vantage.textSecondary, bg: vantage.bgRaised };
  }
  return { label: 'Real', color: vantage.up, bg: vantage.upMuted };
}

// Why a trade closed, as the web terminal labels it. A trader needs to see
// that a stop-loss fired rather than guessing from the price, so SL/TP badges
// carry the trigger price too.
function closeReason(reason, triggerPrice) {
  const r = String(reason || 'manual').toLowerCase();
  const px = Number.isFinite(Number(triggerPrice)) ? ` @ ${Number(triggerPrice).toFixed(5)}` : '';
  if (r === 'sl' || r === 'stop_loss') return { label: `SL${px}`, color: vantage.down, bg: vantage.downMuted };
  if (r === 'tp' || r === 'take_profit') return { label: `TP${px}`, color: vantage.up, bg: vantage.upMuted };
  if (r === 'admin') return { label: 'Admin', color: vantage.accent, bg: vantage.accentMuted };
  if (r === 'margin' || r === 'liquidation' || r === 'margin_call') return { label: 'Margin', color: vantage.down, bg: vantage.downMuted };
  if (r === 'copy_close' || r === 'copy' || r === 'copy_stopped' || r === 'managed_withdrawal') return { label: 'Copy close', color: vantage.textSecondary, bg: vantage.bgRaised };
  if (r === 'algo_close') return { label: 'Algo', color: vantage.textSecondary, bg: vantage.bgRaised };
  return { label: 'Manual', color: vantage.textMuted, bg: vantage.bgElevated };
}

function CloseReasonBadge({ reason, closePrice }) {
  const c = closeReason(reason, closePrice);
  return (
    <View style={[styles.srcBadge, { backgroundColor: c.bg, borderColor: c.color }]}>
      <Text style={[styles.srcBadgeTxt, { color: c.color }]}>{c.label}</Text>
    </View>
  );
}

function SourceBadge({ tradeType, accountNumber }) {
  const s = tradeSource(tradeType, accountNumber);
  return (
    <View style={[styles.srcBadge, { backgroundColor: s.bg, borderColor: s.color }]}>
      <Text style={[styles.srcBadgeTxt, { color: s.color }]}>{s.label}</Text>
    </View>
  );
}

function PositionRow({ position, onClose, onSetSlTp }) {
  const nav = useNavigation();
  // Tapping the card body opens that instrument's chart (cross-tab into the
  // Markets stack). The SL/TP and Close buttons keep their own actions.
  const openChart = useCallback(() => {
    const sym = String(position.symbol || '').toUpperCase();
    if (sym) nav.navigate('MarketsTab', { screen: 'InstrumentDetail', params: { symbol: sym } });
  }, [nav, position.symbol]);
  const side = String(position.side || '').toLowerCase();
  const commission = position.commission ?? 0;
  const swap = position.swap ?? 0;
  // NET P&L (profit − commission + swap; swap is negative for a charge) to
  // match the website terminal. Fees are also shown on their own rows below.
  const grossPl = position.profit ?? position.profit_loss ?? position.pl ?? position.pnl ?? null;
  const pl = grossPl == null ? null : Number(grossPl) - (Number(commission) || 0) + (Number(swap) || 0);
  const plPositive = pl == null ? true : Number(pl) >= 0;
  const lots = position.volume ?? position.lots ?? position.quantity ?? '—';
  const open = Number(position.open_price ?? position.openPrice ?? 0);
  const current = position.current_price ?? position.currentPrice ?? null;
  // Show the SL/TP right on the card (like the web terminal) so the trader
  // sees the levels without opening the SL/TP sheet. `—` when unset.
  const slVal = Number(position.stop_loss ?? position.sl ?? 0);
  const tpVal = Number(position.take_profit ?? position.tp ?? 0);
  const hasSl = slVal > 0;
  const hasTp = tpVal > 0;

  return (
    <Card style={styles.card}>
      <Pressable onPress={openChart} accessibilityRole="button" accessibilityLabel={`Open ${position.symbol} chart`}>
      <View style={styles.cardRow}>
        <View style={{ flex: 1 }}>
          <View style={styles.symRow}>
            <Text style={styles.sym}>{position.symbol}</Text>
            <SourceBadge tradeType={position.trade_type} accountNumber={position.account_number} />
          </View>
          <Text style={[styles.side, { color: side === 'buy' ? vantage.up : vantage.down, fontWeight: weights.bold }]}>
            {side.toUpperCase()} {lots} @ {open ? open.toFixed(5) : '—'}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.plLabel}>P&L</Text>
          {pl != null ? (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <PriceTicker
                value={Number(pl)}
                format={(v) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}`}
                fontSize={sizes.h3}
                fontWeight={weights.heavy}
                fontFamily={fontFamily}
                upColor={vantage.up}
                downColor={vantage.down}
                neutralColor={plPositive ? vantage.up : vantage.down}
              />
              <Text style={[styles.pl, { color: plPositive ? vantage.up : vantage.down }]}> USD</Text>
            </View>
          ) : (
            <Text style={[styles.pl, { color: vantage.textMuted }]}>— USD</Text>
          )}
        </View>
      </View>

      <View style={styles.metaGrid}>
        {current != null ? <Meta label="Current" value={Number(current).toFixed(5)} /> : null}
        <Meta label="SL" value={hasSl ? slVal.toFixed(5) : '—'} valueColor={hasSl ? vantage.down : vantage.textMuted} />
        <Meta label="TP" value={hasTp ? tpVal.toFixed(5) : '—'} valueColor={hasTp ? vantage.up : vantage.textMuted} />
        <Meta label="Commission" value={`${Number(commission).toFixed(2)} USD`} />
        <Meta label="Swap" value={`${Number(swap).toFixed(2)} USD`} />
      </View>
      </Pressable>

      <View style={styles.btnRow}>
        <Pressable onPress={onSetSlTp} style={[styles.actionPill, styles.slTpBtn]} accessibilityRole="button" accessibilityLabel="Set stop loss / take profit">
          <Ionicons name="options-outline" size={16} color={vantage.accent} />
          <Text style={styles.slTpTxt}>SL/TP</Text>
        </Pressable>
        <Pressable onPress={onClose} style={[styles.actionPill, styles.closeBtn]} accessibilityRole="button">
          <Ionicons name="close-circle-outline" size={16} color={vantage.down} />
          <Text style={styles.closeTxt}>Close position</Text>
        </Pressable>
      </View>
    </Card>
  );
}

function HistoryRow({ trade }) {
  const side = String(trade.side || '').toLowerCase();
  // NET realized P&L (profit − commission + swap) to match the website.
  const grossPnl = trade.pnl ?? trade.profit ?? trade.realized_pnl ?? null;
  const pnl = grossPnl == null
    ? null
    : Number(grossPnl) - (Number(trade.commission ?? 0) || 0) + (Number(trade.swap ?? 0) || 0);
  const pnlPositive = pnl == null ? true : Number(pnl) >= 0;
  const lots = trade.lots ?? trade.volume ?? trade.quantity ?? '—';
  const open = Number(trade.open_price ?? 0);
  const close = Number(trade.close_price ?? 0);
  let dateStr = '';
  try {
    if (trade.close_time) {
      dateStr = new Date(trade.close_time).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    }
  } catch (_) {}

  return (
    <Card style={styles.card}>
      <View style={styles.cardRow}>
        <View style={{ flex: 1 }}>
          <View style={styles.symRow}>
            <Text style={styles.sym}>{trade.symbol}</Text>
            <SourceBadge tradeType={trade.trade_type} accountNumber={trade.account_number} />
            <CloseReasonBadge reason={trade.close_reason} closePrice={trade.close_price} />
          </View>
          <Text style={[styles.side, { color: side === 'buy' ? vantage.up : vantage.down }]}>
            {side.toUpperCase()} {lots} @ {open ? open.toFixed(5) : '—'}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.plLabel}>P&L</Text>
          <Text style={[styles.pl, { color: pnlPositive ? vantage.up : vantage.down }]}>
            {pnl != null ? `${pnlPositive ? '+' : ''}${Number(pnl).toFixed(2)}` : '—'} USD
          </Text>
        </View>
      </View>
      <View style={styles.metaGrid}>
        <Meta label="Close price" value={close ? close.toFixed(5) : '—'} />
        <Meta label="Commission" value={`${Number(trade.commission ?? 0).toFixed(2)} USD`} />
        <Meta label="Swap" value={`${Number(trade.swap ?? 0).toFixed(2)} USD`} />
        {dateStr ? <Meta label="Closed" value={dateStr} /> : null}
      </View>
    </Card>
  );
}

function Meta({ label, value, valueColor }) {
  return (
    <View style={styles.meta}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={[styles.metaValue, valueColor ? { color: valueColor } : null]}>{value}</Text>
    </View>
  );
}

function OrderRow({ order, onCancel }) {
  const side = String(order.side || '').toLowerCase();
  return (
    <Card style={styles.card}>
      <View style={styles.cardRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sym}>{order.symbol}</Text>
          <Text style={[styles.side, { color: side === 'buy' ? vantage.up : vantage.down }]}>
            {(order.order_type || 'limit').toUpperCase()} {side.toUpperCase()} {order.volume ?? order.lots ?? '—'} @ {Number(order.price ?? 0).toFixed(5)}
          </Text>
        </View>
        <Pressable onPress={onCancel} hitSlop={8} style={styles.actionBtn}>
          <Ionicons name="trash-outline" size={20} color={vantage.down} />
          <Text style={[styles.actionTxt, { color: vantage.down }]}>Cancel</Text>
        </Pressable>
      </View>
    </Card>
  );
}

// Account snapshot above the positions/history tabs — balance, equity, margin.
function AccountSummaryCard({ account, summary, openCount, closedCount }) {
  const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
  const fmt2 = (v) => (v == null ? '—' : Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  const ccy = account?.currency || 'USD';
  const balance = num(summary?.balance) ?? num(account?.balance);
  const credit = num(summary?.credit) ?? num(account?.credit) ?? 0;
  const equity = num(summary?.equity) ?? balance;
  const usedMargin = num(summary?.margin) ?? num(summary?.used_margin) ?? num(summary?.margin_used);
  const freeMargin = num(summary?.free_margin) ?? (equity != null && usedMargin != null ? equity - usedMargin : equity);
  const label = account ? `${account.is_demo ? 'Demo' : 'Live'} ${account.account_number || account.id || ''}`.trim() : 'No account';
  return (
    <Card style={styles.summary}>
      <View style={styles.sumTop}>
        <Text style={styles.sumAcct} numberOfLines={1}>{label}</Text>
        <Text style={styles.sumCounts}>{openCount} open · {closedCount} closed</Text>
      </View>
      {/* MT5-style order, mirrors the web terminal bar. Margin Level was
          removed there too — keep the two in sync. */}
      <View style={styles.sumGrid}>
        <SumCell label="Balance" value={`${fmt2(balance)} ${ccy}`} />
        <SumCell label="Credit" value={fmt2(credit)} />
        <SumCell label="Equity" value={`${fmt2(equity)} ${ccy}`} />
        <SumCell label="Used Margin" value={fmt2(usedMargin)} />
        <SumCell label="Free Margin" value={fmt2(freeMargin)} />
      </View>
    </Card>
  );
}

function SumCell({ label, value }) {
  return (
    <View style={styles.sumCell}>
      <Text style={styles.sumLab}>{label}</Text>
      <Text style={styles.sumVal}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: space.lg, paddingTop: space.md, gap: space.sm },
  summary: { marginBottom: space.sm },
  sumTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space.sm, gap: space.sm },
  sumAcct: { color: vantage.textPrimary, fontFamily, fontSize: sizes.body, fontWeight: weights.heavy, flexShrink: 1 },
  sumCounts: { color: vantage.textMuted, fontFamily, fontSize: sizes.label },
  sumGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space.sm },
  sumCell: { width: '33%' },
  sumLab: { color: vantage.textMuted, fontFamily, fontSize: sizes.micro },
  sumVal: { color: vantage.textPrimary, fontFamily, fontSize: sizes.label, fontWeight: weights.bold, marginTop: 2 },
  headerRow: { paddingBottom: space.sm },
  closeAllRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: space.sm },
  closeAllBtn: {
    flexDirection: 'row', alignItems: 'center', gap: space.xs,
    paddingVertical: space.xs, paddingHorizontal: space.md,
    borderRadius: radius.pill, borderWidth: 1, borderColor: vantage.down,
  },
  closeAllTxt: { color: vantage.down, fontFamily, fontSize: sizes.label, fontWeight: weights.bold },
  empty: { color: vantage.textMuted, fontFamily, fontSize: sizes.body, textAlign: 'center', padding: space.lg },
  showMoreBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: space.md, marginTop: space.xs,
    borderWidth: 1, borderColor: vantage.border, borderRadius: radius.md, backgroundColor: vantage.bgRaised,
  },
  showMoreTxt: { color: vantage.textSecondary, fontFamily, fontSize: sizes.label, fontWeight: weights.semibold },
  histControls: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.sm },
  customRangeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: space.sm, paddingHorizontal: 2 },
  customRangeTxt: { color: vantage.accent, fontFamily, fontSize: sizes.label, fontWeight: weights.semibold },
  pdfBtn: {
    width: 38, height: 38, alignItems: 'center', justifyContent: 'center',
    borderRadius: radius.md, borderWidth: 1, borderColor: vantage.border, backgroundColor: vantage.bgRaised,
  },
  card: { marginBottom: space.sm },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  symRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  srcBadge: { paddingHorizontal: space.sm, paddingVertical: 1, borderRadius: radius.sm, borderWidth: 1 },
  srcBadgeTxt: { fontFamily, fontSize: sizes.micro, fontWeight: weights.bold, letterSpacing: 0.4 },
  sym: { color: vantage.textPrimary, fontFamily, fontSize: sizes.h3, fontWeight: weights.bold },
  side: { fontFamily, fontSize: sizes.label, fontWeight: weights.semibold, marginTop: 2 },
  plLabel: { color: vantage.textMuted, fontFamily, fontSize: sizes.micro },
  pl: { fontFamily, fontSize: sizes.h3, fontWeight: weights.heavy, marginTop: 1 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: space.xs, marginTop: space.sm },
  actionTxt: { color: vantage.textMuted, fontFamily, fontSize: sizes.label },

  metaGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: space.lg,
    marginTop: space.md, paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: vantage.border,
  },
  meta: { minWidth: 80 },
  metaLabel: { color: vantage.textMuted, fontFamily, fontSize: sizes.micro },
  metaValue: { color: vantage.textPrimary, fontFamily, fontSize: sizes.label, fontWeight: weights.semibold, marginTop: 2 },
  btnRow: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  actionPill: {
    flex: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xs,
    paddingVertical: space.sm, borderRadius: 10, borderWidth: 1,
  },
  slTpBtn: { borderColor: '#FBA945' },
  slTpTxt: { color: vantage.accent, fontFamily, fontSize: sizes.label, fontWeight: weights.bold },
  closeBtn: { borderColor: '#FBA945' },
  closeTxt: { color: vantage.down, fontFamily, fontSize: sizes.label, fontWeight: weights.bold },
});

const sheetStyles = StyleSheet.create({
  wrap: { paddingBottom: space.md },
  head: { marginBottom: space.lg },
  label: { color: vantage.textSecondary, fontFamily, fontSize: sizes.label, marginBottom: space.sm },
  input: {
    backgroundColor: vantage.bgRaised, borderRadius: radius.md, borderWidth: 1, borderColor: vantage.border,
    paddingHorizontal: space.md, paddingVertical: space.md,
    color: vantage.textPrimary, fontFamily, fontSize: sizes.body, fontWeight: weights.bold,
  },
  hint: { color: vantage.textMuted, fontFamily, fontSize: sizes.micro, marginTop: space.sm },
});
