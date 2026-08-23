import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import {
  BuySellSplit,
  DiscreteSlider,
  CheckboxRow,
  PillButton,
  showToast,
} from '../../../components/vantage';
import { vantage, space, sizes, weights, fontFamily, radius } from '../../../theme/vantageTheme';
import { handleTradeError } from '../../../utils/tradeErrors';
import ApiService from '../../../services/api/ApiService';

const ORDER_TYPES = ['market', 'limit', 'stop'];
const ORDER_LABEL = { market: 'Market', limit: 'Limit', stop: 'Stop' };
const LOT_PRESETS = [0.01, 0.1, 0.5, 1, 5];
const MAX_LOTS = 20000;

function fmt(v) {
  if (v == null || !Number.isFinite(v)) return '—';
  return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function OrderTicket({ accountId, account, accountSummary, symbol, tick, onPlaced }) {
  const [side, setSide] = useState('sell');
  const [orderType, setOrderType] = useState('market');
  const [volume, setVolume] = useState(1);
  const [limitPrice, setLimitPrice] = useState('');
  const [tpSlEnabled, setTpSlEnabled] = useState(false);
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [typeOpen, setTypeOpen] = useState(false);
  const [editingVol, setEditingVol] = useState(false);
  const [volText, setVolText] = useState('');

  const bid = tick?.bid != null ? Number(tick.bid) : null;
  const ask = tick?.ask != null ? Number(tick.ask) : null;
  const spread = (bid != null && ask != null) ? Math.round((ask - bid) * 100000) : null;
  const change = tick?.change_points != null ? Number(tick.change_points) : null;

  // Account summary fields arrive as strings — coerce before maths/formatting.
  const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
  const leverage = Number(account?.leverage || account?.leverage_ratio || 500);
  const equity = num(accountSummary?.equity ?? accountSummary?.balance);
  const px = ask ?? bid;
  const margin = (px != null && leverage) ? (Number(volume) * px) / leverage : null;
  const freeMargin = num(accountSummary?.free_margin) ?? equity;
  const marginLevel = num(accountSummary?.margin_level) ?? ((margin && equity) ? (equity / margin) * 100 : null);

  const stepVolume = useCallback((dir) => {
    setVolume((v) => {
      const next = Math.round((Number(v) + dir * 0.01) * 100) / 100;
      return Math.min(MAX_LOTS, Math.max(0.01, next));
    });
  }, []);

  const canSubmit = useMemo(() => {
    if (!accountId || !symbol) return false;
    if (!(volume > 0)) return false;
    if (orderType !== 'market' && !(Number(limitPrice) > 0)) return false;
    if (tpSlEnabled) {
      if (stopLoss && !(Number(stopLoss) > 0)) return false;
      if (takeProfit && !(Number(takeProfit) > 0)) return false;
    }
    return true;
  }, [accountId, symbol, volume, orderType, limitPrice, tpSlEnabled, stopLoss, takeProfit]);

  const submit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    const payload = {
      account_id: accountId,
      symbol,
      side,
      order_type: orderType,
      lots: Number(volume), // backend expects `lots`, not `volume`
    };
    if (orderType !== 'market') payload.price = Number(limitPrice);
    if (tpSlEnabled) {
      if (stopLoss) payload.stop_loss = Number(stopLoss);
      if (takeProfit) payload.take_profit = Number(takeProfit);
    }
    try {
      await ApiService.placeOrder(payload);
      showToast({ kind: 'success', message: `${side.toUpperCase()} ${volume} ${symbol} placed` });
      onPlaced?.();
    } catch (e) {
      // Market-closed → calm info popup instead of a red error.
      handleTradeError(e?.message, 'Order failed');
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, accountId, symbol, side, orderType, volume, limitPrice, tpSlEnabled, stopLoss, takeProfit, onPlaced]);

  const commitVol = useCallback(() => {
    const n = Number(volText);
    if (Number.isFinite(n) && n > 0) {
      setVolume(Math.min(MAX_LOTS, Math.max(0.01, Math.round(n * 100) / 100)));
    }
    setEditingVol(false);
  }, [volText]);

  return (
    <View style={styles.wrap}>
      <BuySellSplit
        bid={bid}
        ask={ask}
        spreadPoints={spread}
        side={side}
        onChange={setSide}
        changePoints={change}
      />

      {/* Order type dropdown */}
      <View>
        <Pressable style={styles.dropdown} onPress={() => setTypeOpen((o) => !o)} accessibilityRole="button">
          <Text style={styles.dropdownTxt}>{ORDER_LABEL[orderType]}</Text>
          <Ionicons name={typeOpen ? 'chevron-up' : 'chevron-down'} size={16} color={vantage.textMuted} />
        </Pressable>
        {typeOpen ? (
          <View style={styles.dropdownMenu}>
            {ORDER_TYPES.map((t) => (
              <Pressable
                key={t}
                onPress={() => { setOrderType(t); setTypeOpen(false); }}
                style={styles.dropdownItem}
                android_ripple={{ color: vantage.bgPressed }}
              >
                <Text style={[styles.dropdownItemTxt, orderType === t && { color: vantage.accent, fontWeight: weights.bold }]}>{ORDER_LABEL[t]}</Text>
                {orderType === t ? <Ionicons name="checkmark" size={16} color={vantage.accent} /> : null}
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

      {/* Price */}
      <View style={styles.priceBox}>
        {orderType === 'market' ? (
          <Text style={styles.pricePlaceholder}>Fill at market price</Text>
        ) : (
          <TextInput
            value={limitPrice}
            onChangeText={setLimitPrice}
            keyboardType="decimal-pad"
            placeholder={orderType === 'limit' ? 'Limit price' : 'Stop price'}
            placeholderTextColor={vantage.textMuted}
            style={styles.priceInput}
          />
        )}
      </View>

      {/* Volume + unit */}
      <View style={styles.volRow}>
        <Pressable onPress={() => stepVolume(-1)} hitSlop={8} style={styles.volBtn} accessibilityLabel="Decrease volume">
          <Ionicons name="remove" size={20} color={vantage.textSecondary} />
        </Pressable>
        <View style={styles.volCenter}>
          <Text style={styles.volLabel}>Volume</Text>
          {editingVol ? (
            <TextInput
              value={volText}
              onChangeText={(t) => setVolText(t.replace(/[^0-9.]/g, ''))}
              onBlur={commitVol}
              onSubmitEditing={commitVol}
              keyboardType="decimal-pad"
              autoFocus
              style={styles.volInput}
            />
          ) : (
            <Pressable onPress={() => { setVolText(String(volume)); setEditingVol(true); }} hitSlop={10}>
              <Text style={styles.volValue}>{Number.isInteger(volume) ? volume : volume.toFixed(2)}</Text>
            </Pressable>
          )}
        </View>
        <Pressable onPress={() => stepVolume(1)} hitSlop={8} style={styles.volBtn} accessibilityLabel="Increase volume">
          <Ionicons name="add" size={20} color={vantage.textSecondary} />
        </Pressable>
        <View style={styles.volDivider} />
        <Text style={styles.lotsTxt}>Lots</Text>
      </View>

      <Text style={styles.maxOpen}>Max open {fmt(MAX_LOTS)} Lots</Text>

      <CheckboxRow label="TP/SL" checked={tpSlEnabled} onChange={setTpSlEnabled} />
      {tpSlEnabled ? (
        <View style={styles.tpSlRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>Stop Loss</Text>
            <TextInput value={stopLoss} onChangeText={setStopLoss} keyboardType="decimal-pad" placeholder="0.00000" placeholderTextColor={vantage.textMuted} style={styles.priceInput} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>Take Profit</Text>
            <TextInput value={takeProfit} onChangeText={setTakeProfit} keyboardType="decimal-pad" placeholder="0.00000" placeholderTextColor={vantage.textMuted} style={styles.priceInput} />
          </View>
        </View>
      ) : null}

      {/* Info */}
      <View style={styles.info}>
        <InfoRow label="Required Margin" value={margin != null ? `${fmt(margin)} USD` : '—'} />
        <InfoRow label="Free Margin" value={freeMargin != null ? `${fmt(freeMargin)} USD` : '—'} />
        <InfoRow label="Margin Level After Trading" value={marginLevel != null ? `${fmt(marginLevel)}%` : '—'} />
        <InfoRow label="Leverage" value={`1:${leverage}`} />
      </View>

      <PillButton
        label={submitting ? 'Placing…' : (side === 'buy' ? 'Buy' : 'Sell')}
        variant={side === 'buy' ? 'buy' : 'sell'}
        size="lg"
        loading={submitting}
        disabled={!canSubmit || submitting}
        onPress={submit}
        style={{ marginTop: space.md }}
      />
    </View>
  );
}

function InfoRow({ label, value, dashed }) {
  return (
    <View style={infoStyles.row}>
      <Text style={[infoStyles.label, dashed && infoStyles.dashed]}>{label}</Text>
      <Text style={infoStyles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: space.lg, paddingTop: space.md, gap: space.md },
  dropdown: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: vantage.bgElevated, borderRadius: radius.md,
    paddingVertical: space.md, paddingHorizontal: space.md, gap: space.sm,
  },
  dropdownTxt: { flex: 1, textAlign: 'center', color: vantage.textPrimary, fontFamily, fontSize: sizes.body, fontWeight: weights.semibold },
  dropdownMenu: { backgroundColor: vantage.bgRaised, borderRadius: radius.md, marginTop: space.xs, overflow: 'hidden', borderWidth: 1, borderColor: vantage.border },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, paddingVertical: space.md },
  dropdownItemTxt: { color: vantage.textPrimary, fontFamily, fontSize: sizes.body },
  volInput: { color: vantage.textPrimary, fontFamily, fontSize: sizes.body, fontWeight: weights.bold, minWidth: 64, textAlign: 'center', padding: 0, marginTop: 1 },
  priceBox: {
    backgroundColor: vantage.bgElevated, borderRadius: radius.md,
    paddingVertical: space.md, paddingHorizontal: space.md, alignItems: 'center',
    minHeight: 48, justifyContent: 'center',
  },
  pricePlaceholder: { color: vantage.textMuted, fontFamily, fontSize: sizes.body },
  priceInput: { color: vantage.textPrimary, fontFamily, fontSize: sizes.body, fontWeight: weights.bold, textAlign: 'center', padding: 0 },
  volRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: vantage.bgElevated, borderRadius: radius.md,
    paddingHorizontal: space.md, paddingVertical: space.sm, gap: space.sm,
  },
  volBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  volCenter: { flex: 1, alignItems: 'center' },
  volLabel: { color: vantage.textMuted, fontFamily, fontSize: sizes.micro },
  volValue: { color: vantage.textPrimary, fontFamily, fontSize: sizes.body, fontWeight: weights.bold, marginTop: 1 },
  volDivider: { width: StyleSheet.hairlineWidth, height: 28, backgroundColor: vantage.borderStrong, marginHorizontal: space.xs },
  lotsUnit: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: space.sm },
  lotsTxt: { color: vantage.textSecondary, fontFamily, fontSize: sizes.body, fontWeight: weights.semibold },
  maxOpen: { color: vantage.textMuted, fontFamily, fontSize: sizes.label, textAlign: 'right' },
  fieldLabel: { color: vantage.textSecondary, fontFamily, fontSize: sizes.label, marginBottom: space.xs },
  tpSlRow: { flexDirection: 'row', gap: space.md },
  info: { gap: space.sm, marginTop: space.xs },
});

const infoStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { color: vantage.textMuted, fontFamily, fontSize: sizes.label },
  dashed: { textDecorationLine: 'underline', textDecorationStyle: 'dotted' },
  value: { color: vantage.textPrimary, fontFamily, fontSize: sizes.label, fontWeight: weights.semibold },
});
