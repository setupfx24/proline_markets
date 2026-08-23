import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { WebView } from 'react-native-webview';

import { Screen, Card, PillButton, IconButton, showToast } from '../../../components/vantage';
import { vantage, space, sizes, weights, fontFamily } from '../../../theme/vantageTheme';
import ApiService from '../../../services/api/ApiService';

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
