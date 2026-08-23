# Plan E — Vantage Redesign: Funds Screen + Payment Gateways (Phase 5)

> Subagent-driven execution.

**Goal:** Replace the Funds placeholder with the real Vantage-style funds tab, wired to all 3 payment gateways already in the ProlineMarket backend (Razorpay, on-chain USDT, manual bank/UPI) plus withdraw / transfer / transaction history. **This is the phase that wires the actual payment integrations the user originally asked for.**

**Architecture:** `FundsScreen` (overview) + 4 deposit sub-screens + 2 withdraw sub-screens + transfer + history. All hit the existing backend; new methods are added to `ApiService`. Razorpay is integrated via WebView (no native dep). On-chain USDT renders QR code via `react-native-qrcode-svg`. Manual deposits/withdrawals upload proof via `expo-image-picker`.

**Working directory:** `/Users/tarundewangan/Downloads/Projects/ProlineMarket/ProlineMarket_apk`

---

### File structure

**New:**
- `src/screens/funds/DepositScreen.js`
- `src/screens/funds/DepositRazorpay.js`
- `src/screens/funds/DepositOnchain.js`
- `src/screens/funds/DepositManual.js`
- `src/screens/funds/WithdrawScreen.js`
- `src/screens/funds/WithdrawCrypto.js`
- `src/screens/funds/WithdrawManual.js`
- `src/screens/funds/TransferScreen.js`
- `src/screens/funds/TransactionHistoryScreen.js`

**Modified:**
- `src/screens/funds/FundsScreen.js` — full rewrite (orchestrator)
- `src/services/ApiService.js` — add ~11 wallet methods
- `src/navigation/FundsStack.js` — register all new routes
- `package.json` — `react-native-qrcode-svg` via expo install

---

### Task E1: New dep + ApiService methods

#### Install dep

```bash
cd /Users/tarundewangan/Downloads/Projects/ProlineMarket/ProlineMarket_apk && npx expo install react-native-qrcode-svg
```

#### Add to ApiService

In `src/services/ApiService.js`, after the existing `submitWithdrawal()` method (~line 92), insert these methods (the existing method numbers may shift; insert anywhere within the Wallet APIs region):

```js
  // Wallet — extended payment gateway methods

  async getDepositBankDetails() {
    return this.request('/wallet/deposit/bank-details', { method: 'POST' });
  }

  async getRazorpayRate() {
    return this.request('/wallet/deposit/razorpay/rate');
  }

  async createRazorpayOrder(amountUsd) {
    return this.request('/wallet/deposit/razorpay/order', {
      method: 'POST',
      body: JSON.stringify({ amount_usd: amountUsd }),
    });
  }

  async verifyRazorpayPayment(data) {
    return this.request('/wallet/deposit/razorpay/verify', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async submitOnchainDeposit(data) {
    return this.request('/wallet/deposit/onchain', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getOnchainDepositStatus(depositId) {
    return this.request(`/wallet/deposit/${encodeURIComponent(depositId)}/onchain-status`);
  }

  async submitManualDeposit(formData) {
    const token = await SecureStore.getItemAsync('token');
    const res = await fetch(`${this.baseUrl}/wallet/deposit/manual`, {
      method: 'POST',
      headers: {
        ...(token && { 'Authorization': `Bearer ${token}` }),
        'Accept': 'application/json',
      },
      body: formData,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error((data && (data.detail || data.message)) || `Manual deposit failed (${res.status})`);
    return data;
  }

  async submitOnchainWithdrawal(data) {
    return this.request('/wallet/withdraw/onchain', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async submitManualWithdrawal(formData) {
    const token = await SecureStore.getItemAsync('token');
    const res = await fetch(`${this.baseUrl}/wallet/withdraw/manual`, {
      method: 'POST',
      headers: {
        ...(token && { 'Authorization': `Bearer ${token}` }),
        'Accept': 'application/json',
      },
      body: formData,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error((data && (data.detail || data.message)) || `Manual withdrawal failed (${res.status})`);
    return data;
  }

  async getOnchainWithdrawStatus(withdrawalId) {
    return this.request(`/wallet/withdraw/${encodeURIComponent(withdrawalId)}/onchain-status`);
  }

  async getTransactions({ page = 1, perPage = 50, type = null } = {}) {
    const q = new URLSearchParams({ page: String(page), per_page: String(perPage) });
    if (type) q.append('type', type);
    return this.request(`/wallet/transactions?${q.toString()}`);
  }
```

Note: multipart endpoints (`submitManualDeposit`, `submitManualWithdrawal`) deliberately bypass the JSON Content-Type from the `request()` helper.

---

### Task E2: FundsScreen overview (rewrite)

`src/screens/funds/FundsScreen.js`

```js
import React, { useEffect, useState, useCallback } from 'react';
import { ScrollView, RefreshControl, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';

import { Screen, BalanceBlock, QuickActionTile, Card } from '../../components/vantage';
import { vantage, space, sizes, weights, fontFamily } from '../../theme/vantageTheme';
import ApiService from '../../services/ApiService';
import { useHiddenBalance } from '../../utils/hiddenBalance';
import { BOTTOM_NAV_PILL_HEIGHT } from '../../components/vantage/BottomNavPill';

export default function FundsScreen() {
  const nav = useNavigation();
  const { hidden, toggle } = useHiddenBalance();

  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState(null);
  const [recent, setRecent] = useState([]);

  const fetchAll = useCallback(async () => {
    await Promise.allSettled([
      ApiService.getWalletSummary().then(setSummary).catch(() => setSummary(null)),
      ApiService.getTransactions({ page: 1, perPage: 5 }).then((res) => {
        const list = Array.isArray(res) ? res : (Array.isArray(res?.items) ? res.items : []);
        setRecent(list);
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

  const total = summary?.total_balance ?? summary?.balance ?? summary?.total_equity ?? null;
  const main = summary?.main_balance ?? summary?.main_wallet ?? null;
  const trading = summary?.trading_balance ?? null;

  return (
    <Screen edges={['top']}>
      <View style={styles.headerWrap}>
        <Text style={styles.title}>Funds</Text>
      </View>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: BOTTOM_NAV_PILL_HEIGHT + space.huge }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={vantage.accent} colors={[vantage.accent]} />}
      >
        <View style={styles.balanceWrap}>
          <BalanceBlock
            label="Total Balance"
            amount={typeof total === 'number' ? total : null}
            currency="USD"
            hidden={hidden}
            onToggleHide={toggle}
          />
          {(main != null || trading != null) ? (
            <View style={styles.splitRow}>
              {main != null ? (
                <View style={{ flex: 1 }}>
                  <Text style={styles.splitLab}>Main Wallet</Text>
                  <Text style={styles.splitVal}>{hidden ? '••••' : Number(main).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                </View>
              ) : null}
              {trading != null ? (
                <View style={{ flex: 1 }}>
                  <Text style={styles.splitLab}>Trading</Text>
                  <Text style={styles.splitVal}>{hidden ? '••••' : Number(trading).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>

        <View style={styles.tilesRow}>
          <QuickActionTile icon={<Ionicons name="arrow-down-circle" size={26} color={vantage.up} />} label="Deposit" onPress={() => nav.navigate('Deposit')} />
          <QuickActionTile icon={<Ionicons name="arrow-up-circle" size={26} color={vantage.down} />} label="Withdraw" onPress={() => nav.navigate('Withdraw')} />
          <QuickActionTile icon={<Ionicons name="swap-horizontal" size={26} color={vantage.textPrimary} />} label="Transfer" onPress={() => nav.navigate('Transfer')} />
          <QuickActionTile icon={<Ionicons name="receipt-outline" size={26} color={vantage.textPrimary} />} label="History" onPress={() => nav.navigate('TransactionHistory')} />
        </View>

        <View style={styles.recentSection}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          {recent.length === 0 ? (
            <Text style={styles.empty}>No transactions yet.</Text>
          ) : recent.map((t) => <TxRow key={t.id || t._id || `${t.created_at}-${t.amount}`} tx={t} />)}
        </View>
      </ScrollView>
    </Screen>
  );
}

function TxRow({ tx }) {
  const isDeposit = String(tx.type || tx.kind || '').toLowerCase().includes('deposit');
  const isWithdraw = String(tx.type || tx.kind || '').toLowerCase().includes('withdraw');
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
        size={22} color={color}
      />
      <View style={{ flex: 1, marginLeft: space.md }}>
        <Text style={txStyles.method}>{String(method).toUpperCase()}</Text>
        <Text style={txStyles.date}>{dateStr}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[txStyles.amount, { color }]}>{sign}${amount.toFixed(2)}</Text>
        <Text style={[txStyles.status, status === 'completed' ? { color: vantage.up } : status === 'failed' ? { color: vantage.down } : null]}>
          {status || 'pending'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerWrap: { paddingHorizontal: space.lg, paddingTop: space.sm },
  title: { color: vantage.textPrimary, fontFamily, fontSize: sizes.hero, fontWeight: weights.heavy },
  scroll: {},
  balanceWrap: { paddingHorizontal: space.lg, paddingTop: space.md },
  splitRow: { flexDirection: 'row', gap: space.lg, marginTop: space.md, padding: space.md, backgroundColor: vantage.bgElevated, borderRadius: 12 },
  splitLab: { color: vantage.textMuted, fontFamily, fontSize: sizes.label },
  splitVal: { color: vantage.textPrimary, fontFamily, fontSize: sizes.h3, fontWeight: weights.bold, marginTop: 2 },
  tilesRow: { flexDirection: 'row', paddingHorizontal: space.lg, paddingVertical: space.lg, gap: space.md },
  recentSection: { paddingHorizontal: space.lg, paddingTop: space.md },
  sectionTitle: { color: vantage.textPrimary, fontFamily, fontSize: sizes.h2, fontWeight: weights.heavy, marginBottom: space.sm },
  empty: { color: vantage.textMuted, fontFamily, fontSize: sizes.body, padding: space.lg, textAlign: 'center' },
});

const txStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: space.sm, borderBottomColor: vantage.border, borderBottomWidth: StyleSheet.hairlineWidth },
  method: { color: vantage.textPrimary, fontFamily, fontSize: sizes.body, fontWeight: weights.semibold },
  date: { color: vantage.textMuted, fontFamily, fontSize: sizes.label, marginTop: 2 },
  amount: { fontFamily, fontSize: sizes.body, fontWeight: weights.heavy },
  status: { color: vantage.textMuted, fontFamily, fontSize: sizes.label, marginTop: 2, textTransform: 'capitalize' },
});
```

---

### Task E3: DepositScreen (method picker)

`src/screens/funds/DepositScreen.js`

```js
import React, { useState } from 'react';
import { ScrollView, View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { Screen, Card, PillButton, IconButton } from '../../components/vantage';
import { vantage, space, sizes, weights, fontFamily, radius } from '../../theme/vantageTheme';

const QUICK_AMOUNTS = [100, 500, 1000, 5000];

const METHODS = [
  { key: 'razorpay', icon: 'card-outline',   title: 'Card / UPI / Netbanking', subtitle: 'Powered by Razorpay · ~instant',     route: 'DepositRazorpay' },
  { key: 'onchain',  icon: 'link-outline',   title: 'Direct USDT',              subtitle: 'TRC20 / BEP20 / ERC20 · ~10-30 min', route: 'DepositOnchain' },
  { key: 'manual',   icon: 'business-outline', title: 'Bank Transfer / Manual UPI', subtitle: 'Upload proof · reviewed 1-24 hr', route: 'DepositManual' },
];

export default function DepositScreen() {
  const nav = useNavigation();
  const [amount, setAmount] = useState('');

  return (
    <Screen edges={['top']}>
      <View style={styles.header}>
        <IconButton icon={<Ionicons name="chevron-back" size={22} color={vantage.textPrimary} />} accessibilityLabel="Back" onPress={() => nav.goBack()} />
        <Text style={styles.title}>Deposit</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: space.huge }}>
        <Text style={styles.label}>Amount (USD)</Text>
        <TextInput
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="0.00"
          placeholderTextColor={vantage.textMuted}
          style={styles.amountInput}
        />
        <View style={styles.quickRow}>
          {QUICK_AMOUNTS.map((a) => (
            <Pressable key={a} onPress={() => setAmount(String(a))} style={styles.quickChip} accessibilityRole="button">
              <Text style={styles.quickTxt}>${a}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.label, { marginTop: space.xl }]}>Choose payment method</Text>
        {METHODS.map((m) => (
          <Card
            key={m.key}
            onPress={() => nav.navigate(m.route, { amount: Number(amount) || 0 })}
            style={styles.methodCard}
          >
            <View style={styles.methodRow}>
              <View style={styles.methodIcon}>
                <Ionicons name={m.icon} size={26} color={vantage.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.methodTitle}>{m.title}</Text>
                <Text style={styles.methodSub}>{m.subtitle}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={vantage.textMuted} />
            </View>
          </Card>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.sm, paddingTop: space.sm, paddingBottom: space.xs },
  title: { flex: 1, color: vantage.textPrimary, fontFamily, fontSize: sizes.h2, fontWeight: weights.heavy, textAlign: 'center' },
  label: { color: vantage.textSecondary, fontFamily, fontSize: sizes.label, marginBottom: space.sm },
  amountInput: {
    backgroundColor: vantage.bgElevated, borderRadius: radius.md,
    paddingHorizontal: space.md, paddingVertical: space.lg,
    color: vantage.textPrimary, fontFamily, fontSize: sizes.h1, fontWeight: weights.heavy,
  },
  quickRow: { flexDirection: 'row', gap: space.sm, marginTop: space.sm, flexWrap: 'wrap' },
  quickChip: { paddingHorizontal: space.lg, paddingVertical: space.sm, backgroundColor: vantage.bgRaised, borderRadius: radius.pill },
  quickTxt: { color: vantage.textPrimary, fontFamily, fontSize: sizes.label, fontWeight: weights.bold },
  methodCard: { marginBottom: space.sm },
  methodRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  methodIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: vantage.accentMuted, alignItems: 'center', justifyContent: 'center' },
  methodTitle: { color: vantage.textPrimary, fontFamily, fontSize: sizes.body, fontWeight: weights.bold },
  methodSub: { color: vantage.textMuted, fontFamily, fontSize: sizes.label, marginTop: 2 },
});
```

---

### Task E4: DepositRazorpay

`src/screens/funds/DepositRazorpay.js`

Uses WebView with Razorpay Checkout JS. Mobile WebView posts success back via `window.ReactNativeWebView.postMessage`. App calls verify endpoint, shows toast.

```js
import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { WebView } from 'react-native-webview';

import { Screen, Card, PillButton, IconButton, showToast } from '../../components/vantage';
import { vantage, space, sizes, weights, fontFamily } from '../../theme/vantageTheme';
import ApiService from '../../services/ApiService';

export default function DepositRazorpay() {
  const nav = useNavigation();
  const route = useRoute();
  const initialAmount = route.params?.amount || 0;

  const [phase, setPhase] = useState('rate'); // 'rate' | 'creating' | 'webview' | 'verifying' | 'done'
  const [rate, setRate] = useState(null);
  const [order, setOrder] = useState(null);
  const [error, setError] = useState(null);
  const webviewRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await ApiService.getRazorpayRate();
        if (!cancelled) setRate(r?.rate ?? r?.usd_to_inr ?? 83);
      } catch (e) {
        if (!cancelled) setRate(83);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const inrAmount = rate && initialAmount > 0 ? (initialAmount * rate) : 0;

  const startCheckout = async () => {
    setPhase('creating');
    try {
      const o = await ApiService.createRazorpayOrder(initialAmount);
      setOrder(o);
      setPhase('webview');
    } catch (e) {
      setError(e?.message || 'Failed to create order');
      setPhase('rate');
    }
  };

  const handleMessage = async (event) => {
    let msg;
    try { msg = JSON.parse(event.nativeEvent.data); } catch (_) { return; }
    if (msg.type === 'success') {
      setPhase('verifying');
      try {
        await ApiService.verifyRazorpayPayment({
          order_id: msg.order_id,
          payment_id: msg.payment_id,
          signature: msg.signature,
        });
        showToast({ kind: 'success', message: 'Deposit successful' });
        nav.goBack();
      } catch (e) {
        showToast({ kind: 'error', message: e?.message || 'Verification failed' });
        setPhase('rate');
      }
    } else if (msg.type === 'cancel' || msg.type === 'failure') {
      showToast({ kind: 'info', message: 'Payment cancelled' });
      setPhase('rate');
    }
  };

  if (phase === 'webview' && order) {
    const html = razorpayHtml(order);
    return (
      <Screen edges={['top']}>
        <Header onBack={() => setPhase('rate')} title="Pay with Razorpay" />
        <WebView
          ref={webviewRef}
          source={{ html, baseUrl: 'https://api.razorpay.com' }}
          onMessage={handleMessage}
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState
          renderLoading={() => <ActivityIndicator color={vantage.accent} style={{ marginTop: 100 }} />}
        />
      </Screen>
    );
  }

  if (phase === 'verifying') {
    return (
      <Screen edges={['top']}>
        <Header onBack={() => nav.goBack()} title="Verifying…" />
        <View style={{ alignItems: 'center', padding: space.huge }}>
          <ActivityIndicator color={vantage.accent} size="large" />
          <Text style={styles.subText}>Confirming your payment…</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={['top']}>
      <Header onBack={() => nav.goBack()} title="Razorpay Deposit" />
      <View style={{ padding: space.lg }}>
        <Card>
          <Row label="Amount (USD)" value={`$${initialAmount.toFixed(2)}`} />
          <Row label="Exchange Rate" value={rate ? `${rate.toFixed(2)} INR / USD` : 'Loading…'} />
          <Row label="You'll pay (INR)" value={rate ? `₹${inrAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '—'} last />
        </Card>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <PillButton
          label={phase === 'creating' ? 'Creating order…' : 'Continue to Pay'}
          variant="primary"
          size="lg"
          loading={phase === 'creating'}
          disabled={!initialAmount || initialAmount <= 0 || phase === 'creating'}
          onPress={startCheckout}
          style={{ marginTop: space.xl }}
        />
        {!initialAmount ? (
          <Text style={styles.helper}>Enter an amount on the previous screen.</Text>
        ) : null}
      </View>
    </Screen>
  );
}

function Header({ onBack, title }) {
  return (
    <View style={styles.header}>
      <IconButton icon={<Ionicons name="chevron-back" size={22} color={vantage.textPrimary} />} accessibilityLabel="Back" onPress={onBack} />
      <Text style={styles.title}>{title}</Text>
      <View style={{ width: 40 }} />
    </View>
  );
}

function Row({ label, value, last }) {
  return (
    <View style={[rowStyles.row, !last && rowStyles.border]}>
      <Text style={rowStyles.label}>{label}</Text>
      <Text style={rowStyles.value}>{value}</Text>
    </View>
  );
}

function razorpayHtml(order) {
  const key = order.key_id || order.key || '';
  const amount = order.amount_paise || order.amount || 0;
  const orderId = order.order_id || order.id || '';
  const currency = order.currency || 'INR';

  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1" /><style>body{background:#000;color:#fff;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;}</style></head><body><div>Opening Razorpay…</div><script src="https://checkout.razorpay.com/v1/checkout.js"></script><script>
function post(payload){ if(window.ReactNativeWebView){ window.ReactNativeWebView.postMessage(JSON.stringify(payload)); } }
var rzp = new Razorpay({
  key: ${JSON.stringify(key)},
  amount: ${JSON.stringify(amount)},
  currency: ${JSON.stringify(currency)},
  order_id: ${JSON.stringify(orderId)},
  name: 'ProlineMarket',
  description: 'Wallet deposit',
  handler: function(resp){
    post({ type:'success', order_id: resp.razorpay_order_id, payment_id: resp.razorpay_payment_id, signature: resp.razorpay_signature });
  },
  modal: { ondismiss: function(){ post({ type:'cancel' }); } },
  theme: { color: '#F26A1F' }
});
rzp.on('payment.failed', function(resp){ post({ type:'failure', code: resp.error && resp.error.code, description: resp.error && resp.error.description }); });
setTimeout(function(){ rzp.open(); }, 100);
</script></body></html>`;
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.sm, paddingTop: space.sm, paddingBottom: space.xs },
  title: { flex: 1, color: vantage.textPrimary, fontFamily, fontSize: sizes.h2, fontWeight: weights.heavy, textAlign: 'center' },
  subText: { color: vantage.textSecondary, fontFamily, fontSize: sizes.body, marginTop: space.md },
  error: { color: vantage.down, fontFamily, fontSize: sizes.label, marginTop: space.sm, textAlign: 'center' },
  helper: { color: vantage.textMuted, fontFamily, fontSize: sizes.label, textAlign: 'center', marginTop: space.sm },
});

const rowStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: space.sm },
  border: { borderBottomColor: vantage.border, borderBottomWidth: StyleSheet.hairlineWidth },
  label: { color: vantage.textMuted, fontFamily, fontSize: sizes.body },
  value: { color: vantage.textPrimary, fontFamily, fontSize: sizes.body, fontWeight: weights.bold },
});
```

---

### Task E5: DepositOnchain (QR + tx hash submit)

`src/screens/funds/DepositOnchain.js`

```js
import React, { useEffect, useState } from 'react';
import { ScrollView, View, Text, TextInput, StyleSheet, Pressable, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';

import { Screen, Card, PillButton, IconButton, showToast } from '../../components/vantage';
import { vantage, space, sizes, weights, fontFamily, radius } from '../../theme/vantageTheme';
import ApiService from '../../services/ApiService';

const CHAINS = [
  { key: 'TRC20', label: 'TRC20 (Tron)' },
  { key: 'BEP20', label: 'BEP20 (BSC)' },
  { key: 'ERC20', label: 'ERC20 (Ethereum)' },
];

export default function DepositOnchain() {
  const nav = useNavigation();
  const route = useRoute();
  const initialAmount = route.params?.amount || 0;

  const [chain, setChain] = useState('TRC20');
  const [bankDetails, setBankDetails] = useState(null);
  const [txHash, setTxHash] = useState('');
  const [amount, setAmount] = useState(String(initialAmount || ''));
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await ApiService.getDepositBankDetails();
        if (!cancelled) setBankDetails(res);
      } catch (_) { if (!cancelled) setBankDetails(null); }
    })();
    return () => { cancelled = true; };
  }, []);

  const wallets = bankDetails?.crypto_wallets || bankDetails?.wallets || {};
  const address = wallets[chain] || wallets[chain.toLowerCase()] || wallets[String(chain).replace(/\d+/, '').toLowerCase()] || null;

  const copyAddr = async () => {
    if (!address) return;
    await Clipboard.setStringAsync(address);
    showToast({ kind: 'success', message: 'Address copied' });
  };

  const submit = async () => {
    if (!txHash.trim() || !(Number(amount) > 0)) return;
    setSubmitting(true);
    try {
      await ApiService.submitOnchainDeposit({ chain, amount: Number(amount), tx_hash: txHash.trim() });
      showToast({ kind: 'success', message: 'Submitted for verification' });
      nav.goBack();
    } catch (e) {
      showToast({ kind: 'error', message: e?.message || 'Submit failed' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen edges={['top']}>
      <View style={styles.header}>
        <IconButton icon={<Ionicons name="chevron-back" size={22} color={vantage.textPrimary} />} accessibilityLabel="Back" onPress={() => nav.goBack()} />
        <Text style={styles.title}>USDT Deposit</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: space.huge }}>
        <Text style={styles.label}>Network</Text>
        <View style={styles.chainRow}>
          {CHAINS.map((c) => (
            <Pressable key={c.key} onPress={() => setChain(c.key)} style={[styles.chainChip, chain === c.key && styles.chainChipActive]}>
              <Text style={[styles.chainTxt, chain === c.key && { color: vantage.textPrimary, fontWeight: weights.bold }]}>{c.key}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.qrWrap}>
          {address ? (
            <View style={styles.qrBox}>
              <QRCode value={address} size={200} backgroundColor="#FFFFFF" color="#000000" />
            </View>
          ) : (
            <View style={[styles.qrBox, { alignItems: 'center', justifyContent: 'center' }]}>
              <Text style={{ color: vantage.textMuted, fontFamily }}>No address available</Text>
            </View>
          )}
        </View>

        {address ? (
          <Pressable onPress={copyAddr} style={styles.addrRow} accessibilityRole="button">
            <Text style={styles.addr} numberOfLines={1}>{address}</Text>
            <Ionicons name="copy-outline" size={18} color={vantage.accent} />
          </Pressable>
        ) : null}

        <Card style={styles.warn}>
          <Ionicons name="alert-circle-outline" size={20} color={vantage.accent} />
          <Text style={styles.warnTxt}>
            Send only USDT-{chain} to this address. Sending other tokens or wrong network = permanent loss.
          </Text>
        </Card>

        <Text style={[styles.label, { marginTop: space.xl }]}>Tx hash</Text>
        <TextInput
          value={txHash}
          onChangeText={setTxHash}
          placeholder="0x..."
          placeholderTextColor={vantage.textMuted}
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text style={[styles.label, { marginTop: space.md }]}>Amount sent (USDT)</Text>
        <TextInput
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="0.00"
          placeholderTextColor={vantage.textMuted}
          style={styles.input}
        />

        <PillButton
          label={submitting ? 'Submitting…' : 'Submit for Verification'}
          variant="primary"
          size="lg"
          loading={submitting}
          disabled={!txHash.trim() || !(Number(amount) > 0) || submitting}
          onPress={submit}
          style={{ marginTop: space.xl }}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.sm, paddingTop: space.sm, paddingBottom: space.xs },
  title: { flex: 1, color: vantage.textPrimary, fontFamily, fontSize: sizes.h2, fontWeight: weights.heavy, textAlign: 'center' },
  label: { color: vantage.textSecondary, fontFamily, fontSize: sizes.label, marginBottom: space.sm },
  chainRow: { flexDirection: 'row', gap: space.sm, marginBottom: space.lg },
  chainChip: { flex: 1, paddingVertical: space.sm, backgroundColor: vantage.bgElevated, borderRadius: radius.pill, borderWidth: 1, borderColor: vantage.border, alignItems: 'center' },
  chainChipActive: { backgroundColor: vantage.bgRaised, borderColor: vantage.accent },
  chainTxt: { color: vantage.textMuted, fontFamily, fontSize: sizes.label },
  qrWrap: { alignItems: 'center', marginVertical: space.md },
  qrBox: { padding: space.lg, backgroundColor: '#FFFFFF', borderRadius: 12, width: 232, height: 232 },
  addrRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: vantage.bgElevated, padding: space.md, borderRadius: radius.md, gap: space.sm, marginVertical: space.md },
  addr: { flex: 1, color: vantage.textPrimary, fontFamily, fontSize: sizes.label, fontWeight: weights.semibold },
  warn: { flexDirection: 'row', gap: space.md, backgroundColor: vantage.accentMuted, marginTop: space.sm },
  warnTxt: { flex: 1, color: vantage.textPrimary, fontFamily, fontSize: sizes.label },
  input: { backgroundColor: vantage.bgElevated, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.md, color: vantage.textPrimary, fontFamily, fontSize: sizes.body },
});
```

---

### Task E6: DepositManual (proof upload)

`src/screens/funds/DepositManual.js`

```js
import React, { useEffect, useState } from 'react';
import { ScrollView, View, Text, TextInput, StyleSheet, Pressable, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';

import { Screen, Card, PillButton, IconButton, showToast } from '../../components/vantage';
import { vantage, space, sizes, weights, fontFamily, radius } from '../../theme/vantageTheme';
import ApiService from '../../services/ApiService';

export default function DepositManual() {
  const nav = useNavigation();
  const route = useRoute();
  const initialAmount = route.params?.amount || 0;

  const [bankDetails, setBankDetails] = useState(null);
  const [amount, setAmount] = useState(String(initialAmount || ''));
  const [transactionId, setTransactionId] = useState('');
  const [proof, setProof] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await ApiService.getDepositBankDetails();
        if (!cancelled) setBankDetails(res);
      } catch (_) {}
    })();
    return () => { cancelled = true; };
  }, []);

  const banks = bankDetails?.banks || bankDetails?.bank_accounts || [];
  const upiIds = bankDetails?.upi_ids || bankDetails?.upi || [];

  const pickProof = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      showToast({ kind: 'warn', message: 'Permission required to pick image' });
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (!res.canceled && res.assets?.[0]) setProof(res.assets[0]);
  };

  const submit = async () => {
    if (!proof || !(Number(amount) > 0) || !transactionId.trim()) return;
    setSubmitting(true);
    const fd = new FormData();
    fd.append('amount', String(amount));
    fd.append('transaction_id', transactionId.trim());
    fd.append('file', {
      uri: proof.uri,
      type: proof.mimeType || 'image/jpeg',
      name: proof.fileName || 'proof.jpg',
    });
    try {
      await ApiService.submitManualDeposit(fd);
      showToast({ kind: 'success', message: 'Submitted — pending admin review' });
      nav.goBack();
    } catch (e) {
      showToast({ kind: 'error', message: e?.message || 'Submit failed' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen edges={['top']}>
      <View style={styles.header}>
        <IconButton icon={<Ionicons name="chevron-back" size={22} color={vantage.textPrimary} />} accessibilityLabel="Back" onPress={() => nav.goBack()} />
        <Text style={styles.title}>Manual Deposit</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: space.huge }}>
        {banks.length > 0 ? (
          <Card style={{ marginBottom: space.md }}>
            <Text style={styles.sectionTitle}>Bank Accounts</Text>
            {banks.map((b, idx) => (
              <View key={idx} style={[styles.detailBlock, idx < banks.length - 1 && styles.detailBorder]}>
                <Detail label="Bank" value={b.bank_name || b.name || '—'} />
                <Detail label="Account" value={b.account_number || '—'} />
                <Detail label="IFSC" value={b.ifsc || '—'} />
                <Detail label="Holder" value={b.account_holder || b.holder || '—'} />
              </View>
            ))}
          </Card>
        ) : null}

        {upiIds.length > 0 ? (
          <Card style={{ marginBottom: space.md }}>
            <Text style={styles.sectionTitle}>UPI</Text>
            {upiIds.map((u, idx) => (
              <Detail key={idx} label={u.label || 'UPI ID'} value={u.upi_id || u.id || '—'} />
            ))}
          </Card>
        ) : null}

        <Text style={styles.label}>Amount (USD)</Text>
        <TextInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={vantage.textMuted} style={styles.input} />

        <Text style={[styles.label, { marginTop: space.md }]}>Your transaction reference</Text>
        <TextInput value={transactionId} onChangeText={setTransactionId} placeholder="UTR / UPI ref" placeholderTextColor={vantage.textMuted} style={styles.input} autoCapitalize="none" />

        <Text style={[styles.label, { marginTop: space.md }]}>Payment proof (screenshot)</Text>
        <Pressable onPress={pickProof} style={styles.proofBtn} accessibilityRole="button">
          {proof ? (
            <Image source={{ uri: proof.uri }} style={styles.proofImg} resizeMode="cover" />
          ) : (
            <View style={styles.proofPlaceholder}>
              <Ionicons name="image-outline" size={28} color={vantage.textMuted} />
              <Text style={styles.proofTxt}>Tap to choose image</Text>
            </View>
          )}
        </Pressable>

        <PillButton
          label={submitting ? 'Submitting…' : 'Submit for Review'}
          variant="primary"
          size="lg"
          loading={submitting}
          disabled={!proof || !(Number(amount) > 0) || !transactionId.trim() || submitting}
          onPress={submit}
          style={{ marginTop: space.xl }}
        />
      </ScrollView>
    </Screen>
  );
}

function Detail({ label, value }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLab}>{label}</Text>
      <Text style={styles.detailVal} selectable>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.sm, paddingTop: space.sm, paddingBottom: space.xs },
  title: { flex: 1, color: vantage.textPrimary, fontFamily, fontSize: sizes.h2, fontWeight: weights.heavy, textAlign: 'center' },
  label: { color: vantage.textSecondary, fontFamily, fontSize: sizes.label, marginBottom: space.sm },
  sectionTitle: { color: vantage.textPrimary, fontFamily, fontSize: sizes.h3, fontWeight: weights.bold, marginBottom: space.sm },
  input: { backgroundColor: vantage.bgElevated, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.md, color: vantage.textPrimary, fontFamily, fontSize: sizes.body },
  detailBlock: { paddingVertical: space.sm },
  detailBorder: { borderBottomColor: vantage.border, borderBottomWidth: StyleSheet.hairlineWidth },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  detailLab: { color: vantage.textMuted, fontFamily, fontSize: sizes.label },
  detailVal: { color: vantage.textPrimary, fontFamily, fontSize: sizes.label, fontWeight: weights.bold },
  proofBtn: { backgroundColor: vantage.bgElevated, borderRadius: radius.md, overflow: 'hidden', minHeight: 140, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: vantage.border, borderStyle: 'dashed' },
  proofImg: { width: '100%', height: 200 },
  proofPlaceholder: { alignItems: 'center', padding: space.lg, gap: space.sm },
  proofTxt: { color: vantage.textMuted, fontFamily, fontSize: sizes.label },
});
```

---

### Task E7: WithdrawScreen + WithdrawCrypto + WithdrawManual

#### `src/screens/funds/WithdrawScreen.js` (method picker)

Same pattern as DepositScreen but only 2 methods (crypto + manual). Skip amount input here — collect on sub-screens.

```js
import React from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { Screen, Card, IconButton } from '../../components/vantage';
import { vantage, space, sizes, weights, fontFamily } from '../../theme/vantageTheme';

const METHODS = [
  { key: 'crypto', icon: 'link-outline', title: 'Crypto Withdrawal', subtitle: 'TRC20 / BEP20 / ERC20', route: 'WithdrawCrypto' },
  { key: 'manual', icon: 'business-outline', title: 'Manual UPI / Bank', subtitle: 'Admin-reviewed payout', route: 'WithdrawManual' },
];

export default function WithdrawScreen() {
  const nav = useNavigation();
  return (
    <Screen edges={['top']}>
      <View style={styles.header}>
        <IconButton icon={<Ionicons name="chevron-back" size={22} color={vantage.textPrimary} />} accessibilityLabel="Back" onPress={() => nav.goBack()} />
        <Text style={styles.title}>Withdraw</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: space.lg }}>
        <Text style={styles.label}>Choose withdrawal method</Text>
        {METHODS.map((m) => (
          <Card key={m.key} onPress={() => nav.navigate(m.route)} style={styles.card}>
            <View style={styles.row}>
              <View style={styles.iconWrap}><Ionicons name={m.icon} size={26} color={vantage.accent} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{m.title}</Text>
                <Text style={styles.cardSub}>{m.subtitle}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={vantage.textMuted} />
            </View>
          </Card>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.sm, paddingTop: space.sm, paddingBottom: space.xs },
  title: { flex: 1, color: vantage.textPrimary, fontFamily, fontSize: sizes.h2, fontWeight: weights.heavy, textAlign: 'center' },
  label: { color: vantage.textSecondary, fontFamily, fontSize: sizes.label, marginBottom: space.sm },
  card: { marginBottom: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  iconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: vantage.accentMuted, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { color: vantage.textPrimary, fontFamily, fontSize: sizes.body, fontWeight: weights.bold },
  cardSub: { color: vantage.textMuted, fontFamily, fontSize: sizes.label, marginTop: 2 },
});
```

#### `src/screens/funds/WithdrawCrypto.js`

```js
import React, { useState } from 'react';
import { ScrollView, View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { Screen, PillButton, IconButton, showToast } from '../../components/vantage';
import { vantage, space, sizes, weights, fontFamily, radius } from '../../theme/vantageTheme';
import ApiService from '../../services/ApiService';

const CHAINS = [
  { key: 'TRC20', label: 'TRC20' },
  { key: 'BEP20', label: 'BEP20' },
  { key: 'ERC20', label: 'ERC20' },
];

export default function WithdrawCrypto() {
  const nav = useNavigation();
  const [chain, setChain] = useState('TRC20');
  const [address, setAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!address.trim() || !(Number(amount) > 0)) return;
    setSubmitting(true);
    try {
      await ApiService.submitOnchainWithdrawal({ chain, address: address.trim(), amount: Number(amount) });
      showToast({ kind: 'success', message: 'Withdrawal submitted' });
      nav.goBack();
    } catch (e) {
      const msg = e?.message || 'Submit failed';
      // Surface step-up auth errors clearly
      if (/step.?up|2fa|otp/i.test(msg)) {
        showToast({ kind: 'warn', message: 'Email OTP / 2FA required for withdrawals — coming soon' });
      } else {
        showToast({ kind: 'error', message: msg });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen edges={['top']}>
      <View style={styles.header}>
        <IconButton icon={<Ionicons name="chevron-back" size={22} color={vantage.textPrimary} />} accessibilityLabel="Back" onPress={() => nav.goBack()} />
        <Text style={styles.title}>Crypto Withdrawal</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: space.huge }}>
        <Text style={styles.label}>Network</Text>
        <View style={styles.chainRow}>
          {CHAINS.map((c) => (
            <Pressable key={c.key} onPress={() => setChain(c.key)} style={[styles.chainChip, chain === c.key && styles.chainChipActive]}>
              <Text style={[styles.chainTxt, chain === c.key && { color: vantage.textPrimary, fontWeight: weights.bold }]}>{c.key}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.label, { marginTop: space.md }]}>Destination address</Text>
        <TextInput value={address} onChangeText={setAddress} placeholder="T... / 0x..." placeholderTextColor={vantage.textMuted} style={styles.input} autoCapitalize="none" autoCorrect={false} />

        <Text style={[styles.label, { marginTop: space.md }]}>Amount (USDT)</Text>
        <TextInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={vantage.textMuted} style={styles.input} />

        <Text style={styles.warn}>Triple-check the address. Crypto withdrawals are irreversible.</Text>

        <PillButton label={submitting ? 'Submitting…' : 'Submit Withdrawal'} variant="primary" size="lg" loading={submitting} disabled={!address.trim() || !(Number(amount) > 0) || submitting} onPress={submit} style={{ marginTop: space.xl }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.sm, paddingTop: space.sm, paddingBottom: space.xs },
  title: { flex: 1, color: vantage.textPrimary, fontFamily, fontSize: sizes.h2, fontWeight: weights.heavy, textAlign: 'center' },
  label: { color: vantage.textSecondary, fontFamily, fontSize: sizes.label, marginBottom: space.sm },
  chainRow: { flexDirection: 'row', gap: space.sm },
  chainChip: { flex: 1, paddingVertical: space.sm, backgroundColor: vantage.bgElevated, borderRadius: radius.pill, borderWidth: 1, borderColor: vantage.border, alignItems: 'center' },
  chainChipActive: { backgroundColor: vantage.bgRaised, borderColor: vantage.accent },
  chainTxt: { color: vantage.textMuted, fontFamily, fontSize: sizes.label },
  input: { backgroundColor: vantage.bgElevated, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.md, color: vantage.textPrimary, fontFamily, fontSize: sizes.body },
  warn: { color: vantage.down, fontFamily, fontSize: sizes.label, marginTop: space.md, textAlign: 'center' },
});
```

#### `src/screens/funds/WithdrawManual.js`

```js
import React, { useState } from 'react';
import { ScrollView, View, Text, TextInput, StyleSheet, Pressable, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';

import { Screen, PillButton, IconButton, showToast } from '../../components/vantage';
import { vantage, space, sizes, weights, fontFamily, radius } from '../../theme/vantageTheme';
import ApiService from '../../services/ApiService';

export default function WithdrawManual() {
  const nav = useNavigation();
  const [amount, setAmount] = useState('');
  const [upiId, setUpiId] = useState('');
  const [qr, setQr] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const pickQr = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return showToast({ kind: 'warn', message: 'Permission required' });
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
    if (!res.canceled && res.assets?.[0]) setQr(res.assets[0]);
  };

  const submit = async () => {
    if (!upiId.trim() || !(Number(amount) > 0)) return;
    setSubmitting(true);
    const fd = new FormData();
    fd.append('amount', String(amount));
    fd.append('upi_id', upiId.trim());
    if (qr) {
      fd.append('file', { uri: qr.uri, type: qr.mimeType || 'image/jpeg', name: qr.fileName || 'qr.jpg' });
    }
    try {
      await ApiService.submitManualWithdrawal(fd);
      showToast({ kind: 'success', message: 'Withdrawal submitted for review' });
      nav.goBack();
    } catch (e) {
      showToast({ kind: 'error', message: e?.message || 'Submit failed' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen edges={['top']}>
      <View style={styles.header}>
        <IconButton icon={<Ionicons name="chevron-back" size={22} color={vantage.textPrimary} />} accessibilityLabel="Back" onPress={() => nav.goBack()} />
        <Text style={styles.title}>UPI / Bank Withdraw</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: space.huge }}>
        <Text style={styles.label}>UPI ID</Text>
        <TextInput value={upiId} onChangeText={setUpiId} placeholder="name@bank" placeholderTextColor={vantage.textMuted} style={styles.input} autoCapitalize="none" autoCorrect={false} />

        <Text style={[styles.label, { marginTop: space.md }]}>Amount (USD)</Text>
        <TextInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={vantage.textMuted} style={styles.input} />

        <Text style={[styles.label, { marginTop: space.md }]}>UPI QR (optional)</Text>
        <Pressable onPress={pickQr} style={styles.proofBtn}>
          {qr ? <Image source={{ uri: qr.uri }} style={styles.proofImg} resizeMode="cover" /> : (
            <View style={styles.proofPlaceholder}>
              <Ionicons name="qr-code-outline" size={28} color={vantage.textMuted} />
              <Text style={styles.proofTxt}>Tap to attach QR</Text>
            </View>
          )}
        </Pressable>

        <PillButton label={submitting ? 'Submitting…' : 'Submit Withdrawal'} variant="primary" size="lg" loading={submitting} disabled={!upiId.trim() || !(Number(amount) > 0) || submitting} onPress={submit} style={{ marginTop: space.xl }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.sm, paddingTop: space.sm, paddingBottom: space.xs },
  title: { flex: 1, color: vantage.textPrimary, fontFamily, fontSize: sizes.h2, fontWeight: weights.heavy, textAlign: 'center' },
  label: { color: vantage.textSecondary, fontFamily, fontSize: sizes.label, marginBottom: space.sm },
  input: { backgroundColor: vantage.bgElevated, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.md, color: vantage.textPrimary, fontFamily, fontSize: sizes.body },
  proofBtn: { backgroundColor: vantage.bgElevated, borderRadius: radius.md, overflow: 'hidden', minHeight: 140, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: vantage.border, borderStyle: 'dashed' },
  proofImg: { width: '100%', height: 200 },
  proofPlaceholder: { alignItems: 'center', padding: space.lg, gap: space.sm },
  proofTxt: { color: vantage.textMuted, fontFamily, fontSize: sizes.label },
});
```

---

### Task E8: TransferScreen

`src/screens/funds/TransferScreen.js`

```js
import React, { useState, useEffect } from 'react';
import { ScrollView, View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { Screen, Sheet, MenuRow, PillButton, IconButton, Card, showToast } from '../../components/vantage';
import { vantage, space, sizes, weights, fontFamily, radius } from '../../theme/vantageTheme';
import ApiService from '../../services/ApiService';

export default function TransferScreen() {
  const nav = useNavigation();
  const [accounts, setAccounts] = useState([]);
  const [fromAccount, setFromAccount] = useState(null);
  const [toAccount, setToAccount] = useState(null);
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [picking, setPicking] = useState(null); // 'from' | 'to'

  useEffect(() => {
    (async () => {
      try {
        const res = await ApiService.getAccounts();
        const list = Array.isArray(res) ? res : (Array.isArray(res?.items) ? res.items : []);
        setAccounts(list);
      } catch (_) {}
    })();
  }, []);

  const submit = async () => {
    if (!fromAccount || !toAccount || !(Number(amount) > 0)) return;
    if (fromAccount.id === toAccount.id) return showToast({ kind: 'warn', message: 'Choose different accounts' });
    setSubmitting(true);
    try {
      await ApiService.transferInternal(fromAccount.id || fromAccount._id, toAccount.id || toAccount._id, Number(amount));
      showToast({ kind: 'success', message: 'Transfer submitted' });
      nav.goBack();
    } catch (e) {
      showToast({ kind: 'error', message: e?.message || 'Transfer failed' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen edges={['top']}>
      <View style={styles.header}>
        <IconButton icon={<Ionicons name="chevron-back" size={22} color={vantage.textPrimary} />} accessibilityLabel="Back" onPress={() => nav.goBack()} />
        <Text style={styles.title}>Transfer</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: space.lg }}>
        <Text style={styles.label}>From</Text>
        <Pressable onPress={() => setPicking('from')} style={styles.pickRow}>
          <Text style={styles.pickTxt}>{fromAccount ? labelOf(fromAccount) : 'Select source account'}</Text>
          <Ionicons name="chevron-down" size={18} color={vantage.textMuted} />
        </Pressable>

        <Text style={[styles.label, { marginTop: space.md }]}>To</Text>
        <Pressable onPress={() => setPicking('to')} style={styles.pickRow}>
          <Text style={styles.pickTxt}>{toAccount ? labelOf(toAccount) : 'Select destination account'}</Text>
          <Ionicons name="chevron-down" size={18} color={vantage.textMuted} />
        </Pressable>

        <Text style={[styles.label, { marginTop: space.md }]}>Amount</Text>
        <TextInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={vantage.textMuted} style={styles.input} />

        <PillButton label={submitting ? 'Transferring…' : 'Submit Transfer'} variant="primary" size="lg" loading={submitting} disabled={!fromAccount || !toAccount || !(Number(amount) > 0) || submitting} onPress={submit} style={{ marginTop: space.xl }} />
      </ScrollView>

      <Sheet visible={picking != null} onClose={() => setPicking(null)} title={picking === 'from' ? 'From account' : 'To account'}>
        {accounts.length === 0 ? (
          <Text style={{ color: vantage.textMuted, fontFamily, padding: space.lg, textAlign: 'center' }}>No accounts.</Text>
        ) : accounts.map((a) => (
          <MenuRow
            key={a.id || a._id}
            icon={<Ionicons name="card-outline" size={20} color={vantage.textPrimary} />}
            label={labelOf(a)}
            value={a.balance != null ? `${Number(a.balance).toFixed(2)} ${a.currency || 'USD'}` : ''}
            onPress={() => {
              if (picking === 'from') setFromAccount(a); else setToAccount(a);
              setPicking(null);
            }}
          />
        ))}
      </Sheet>
    </Screen>
  );
}

function labelOf(a) { return `${a.is_demo ? 'Demo' : 'Live'} #${a.account_number || a.id || ''}`; }

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.sm, paddingTop: space.sm, paddingBottom: space.xs },
  title: { flex: 1, color: vantage.textPrimary, fontFamily, fontSize: sizes.h2, fontWeight: weights.heavy, textAlign: 'center' },
  label: { color: vantage.textSecondary, fontFamily, fontSize: sizes.label, marginBottom: space.sm },
  pickRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: vantage.bgElevated, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.md },
  pickTxt: { flex: 1, color: vantage.textPrimary, fontFamily, fontSize: sizes.body },
  input: { backgroundColor: vantage.bgElevated, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.md, color: vantage.textPrimary, fontFamily, fontSize: sizes.body },
});
```

---

### Task E9: TransactionHistoryScreen

`src/screens/funds/TransactionHistoryScreen.js`

```js
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, RefreshControl, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { Screen, IconButton, CategoryTabs } from '../../components/vantage';
import { vantage, space, sizes, weights, fontFamily } from '../../theme/vantageTheme';
import ApiService from '../../services/ApiService';

const FILTER_OPTIONS = [
  { value: 'all',         label: 'All' },
  { value: 'deposit',     label: 'Deposits' },
  { value: 'withdrawal',  label: 'Withdrawals' },
  { value: 'transfer',    label: 'Transfers' },
];

export default function TransactionHistoryScreen() {
  const nav = useNavigation();
  const [filter, setFilter] = useState('all');
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPage = useCallback(async (p, replace = false) => {
    setLoading(true);
    try {
      const type = filter === 'all' ? null : filter;
      const res = await ApiService.getTransactions({ page: p, perPage: 30, type });
      const list = Array.isArray(res) ? res : (Array.isArray(res?.items) ? res.items : []);
      setItems((prev) => replace ? list : [...prev, ...list]);
      setHasMore(list.length === 30);
    } catch (_) {
      if (replace) setItems([]);
    } finally { setLoading(false); }
  }, [filter]);

  useEffect(() => {
    setPage(1);
    setHasMore(true);
    fetchPage(1, true);
  }, [filter, fetchPage]);

  const onEndReached = useCallback(() => {
    if (loading || !hasMore) return;
    const next = page + 1;
    setPage(next);
    fetchPage(next);
  }, [loading, hasMore, page, fetchPage]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setPage(1);
    await fetchPage(1, true);
    setRefreshing(false);
  }, [fetchPage]);

  return (
    <Screen edges={['top']}>
      <View style={styles.header}>
        <IconButton icon={<Ionicons name="chevron-back" size={22} color={vantage.textPrimary} />} accessibilityLabel="Back" onPress={() => nav.goBack()} />
        <Text style={styles.title}>Transactions</Text>
        <View style={{ width: 40 }} />
      </View>
      <CategoryTabs value={filter} onChange={setFilter} options={FILTER_OPTIONS} />
      <FlatList
        data={items}
        keyExtractor={(item, idx) => String(item.id || item._id || idx)}
        renderItem={({ item }) => <Row tx={item} />}
        ListEmptyComponent={loading ? null : <Text style={styles.empty}>No transactions.</Text>}
        ListFooterComponent={loading && page > 1 ? <Text style={styles.loading}>Loading…</Text> : null}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.3}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={vantage.accent} colors={[vantage.accent]} />}
      />
    </Screen>
  );
}

function Row({ tx }) {
  const t = String(tx.type || tx.kind || '').toLowerCase();
  const isDeposit = t.includes('deposit');
  const isWithdraw = t.includes('withdraw');
  const color = isDeposit ? vantage.up : (isWithdraw ? vantage.down : vantage.textPrimary);
  const sign = isDeposit ? '+' : (isWithdraw ? '−' : '');
  const amount = Math.abs(Number(tx.amount ?? 0));
  const method = tx.payment_method || tx.method || tx.gateway || tx.type || 'Transaction';
  const status = String(tx.status || '').toLowerCase();
  const dateStr = tx.created_at ? new Date(tx.created_at).toLocaleDateString() : '';
  return (
    <View style={rowStyles.row}>
      <Ionicons name={isDeposit ? 'arrow-down-circle' : isWithdraw ? 'arrow-up-circle' : 'swap-horizontal'} size={22} color={color} />
      <View style={{ flex: 1, marginLeft: space.md }}>
        <Text style={rowStyles.method}>{String(method).toUpperCase()}</Text>
        <Text style={rowStyles.date}>{dateStr}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[rowStyles.amount, { color }]}>{sign}${amount.toFixed(2)}</Text>
        <Text style={[rowStyles.status, status === 'completed' && { color: vantage.up }, status === 'failed' && { color: vantage.down }]}>{status || 'pending'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.sm, paddingTop: space.sm, paddingBottom: space.xs },
  title: { flex: 1, color: vantage.textPrimary, fontFamily, fontSize: sizes.h2, fontWeight: weights.heavy, textAlign: 'center' },
  empty: { color: vantage.textMuted, fontFamily, fontSize: sizes.body, padding: space.huge, textAlign: 'center' },
  loading: { color: vantage.textMuted, fontFamily, fontSize: sizes.label, padding: space.md, textAlign: 'center' },
});

const rowStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingVertical: space.md, borderBottomColor: vantage.border, borderBottomWidth: StyleSheet.hairlineWidth },
  method: { color: vantage.textPrimary, fontFamily, fontSize: sizes.body, fontWeight: weights.semibold },
  date: { color: vantage.textMuted, fontFamily, fontSize: sizes.label, marginTop: 2 },
  amount: { fontFamily, fontSize: sizes.body, fontWeight: weights.heavy },
  status: { color: vantage.textMuted, fontFamily, fontSize: sizes.label, marginTop: 2, textTransform: 'capitalize' },
});
```

---

### Task E10: Register routes in FundsStack

`src/navigation/FundsStack.js`

```js
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import FundsScreen from '../screens/funds/FundsScreen';
import DepositScreen from '../screens/funds/DepositScreen';
import DepositRazorpay from '../screens/funds/DepositRazorpay';
import DepositOnchain from '../screens/funds/DepositOnchain';
import DepositManual from '../screens/funds/DepositManual';
import WithdrawScreen from '../screens/funds/WithdrawScreen';
import WithdrawCrypto from '../screens/funds/WithdrawCrypto';
import WithdrawManual from '../screens/funds/WithdrawManual';
import TransferScreen from '../screens/funds/TransferScreen';
import TransactionHistoryScreen from '../screens/funds/TransactionHistoryScreen';

const Stack = createNativeStackNavigator();

export default function FundsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#000' } }}>
      <Stack.Screen name="Funds" component={FundsScreen} />
      <Stack.Screen name="Deposit" component={DepositScreen} />
      <Stack.Screen name="DepositRazorpay" component={DepositRazorpay} />
      <Stack.Screen name="DepositOnchain" component={DepositOnchain} />
      <Stack.Screen name="DepositManual" component={DepositManual} />
      <Stack.Screen name="Withdraw" component={WithdrawScreen} />
      <Stack.Screen name="WithdrawCrypto" component={WithdrawCrypto} />
      <Stack.Screen name="WithdrawManual" component={WithdrawManual} />
      <Stack.Screen name="Transfer" component={TransferScreen} />
      <Stack.Screen name="TransactionHistory" component={TransactionHistoryScreen} />
    </Stack.Navigator>
  );
}
```

---

### Smoke test
- Funds tab → balance + 4 action tiles + recent txs visible.
- Tap Deposit → enter amount → tap Razorpay tile → INR conversion preview → Continue → WebView Razorpay Checkout opens → complete in test mode → verify endpoint hit → success toast → back to Funds.
- Tap Deposit → On-chain → pick chain → QR + address → copy → enter tx hash → submit → toast.
- Tap Deposit → Manual → bank details visible → fill amount + UTR + pick image → submit → toast.
- Tap Withdraw → Crypto → fill → submit.
- Tap Withdraw → Manual → UPI ID + amount + optional QR → submit.
- Tap Transfer → from/to via sheet → amount → submit.
- Tap History → list + filter chips + infinite scroll.
