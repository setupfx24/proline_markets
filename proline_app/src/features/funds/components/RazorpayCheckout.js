import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import { Screen, IconButton, showToast } from '../../../components/vantage';
import { BOTTOM_NAV_PILL_HEIGHT } from '../../../components/vantage/BottomNavPill';
import { vantage, space, sizes, weights, fontFamily } from '../../../theme/vantageTheme';
import ApiService from '../../../services/api/ApiService';

// Razorpay Checkout runs inside a WebView (no native SDK needed — same
// checkout.js the website loads). On success the WebView posts the payment
// response back to RN, which verifies it server-side (keeps the auth token
// out of the WebView). Mirrors the website's openRazorpay* handlers.
function buildHtml({ keyId, orderId, amountPaise, description }) {
  const opts = JSON.stringify({
    key: keyId,
    order_id: orderId,
    amount: amountPaise || undefined,
    currency: 'INR',
    name: 'ProlineMarket',
    description: description || 'Deposit',
    theme: { color: '#F26A1F' },
  });
  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<style>html,body{height:100%;margin:0;background:#000;color:#9CA3AF;font-family:system-ui}
.c{height:100%;display:flex;align-items:center;justify-content:center}</style>
</head><body>
<div class="c">Opening secure payment…</div>
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
<script>
  function post(m){ if(window.ReactNativeWebView){ window.ReactNativeWebView.postMessage(JSON.stringify(m)); } }
  try {
    var o = ${opts};
    o.handler = function(resp){ post({ type:'success', razorpay_order_id: resp.razorpay_order_id, razorpay_payment_id: resp.razorpay_payment_id, razorpay_signature: resp.razorpay_signature }); };
    o.modal = { ondismiss: function(){ post({ type:'dismiss' }); } };
    var rzp = new Razorpay(o);
    rzp.on('payment.failed', function(r){ post({ type:'failed', message: (r && r.error && r.error.description) || 'Payment failed' }); });
    rzp.open();
  } catch (e) {
    post({ type:'error', message: String(e) });
  }
</script>
</body></html>`;
}

export default function RazorpayCheckout() {
  const nav = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { keyId, orderId, amountInr, depositId } = route.params || {};
  const [verifying, setVerifying] = useState(false);

  const html = useMemo(() => buildHtml({
    keyId,
    orderId,
    amountPaise: amountInr ? Math.round(Number(amountInr) * 100) : undefined,
    description: depositId ? `Deposit ${String(depositId).slice(0, 8)}` : 'Deposit',
  }), [keyId, orderId, amountInr, depositId]);

  const onMessage = useCallback(async (event) => {
    let msg = {};
    try { msg = JSON.parse(event.nativeEvent.data); } catch (_) { return; }

    if (msg.type === 'success') {
      setVerifying(true);
      try {
        await ApiService.verifyRazorpayPayment({
          razorpay_order_id: msg.razorpay_order_id,
          razorpay_payment_id: msg.razorpay_payment_id,
          razorpay_signature: msg.razorpay_signature,
        });
        showToast({ kind: 'success', message: 'Payment received — wallet credited' });
      } catch (e) {
        showToast({ kind: 'error', message: e?.message || 'Verification failed' });
      } finally {
        setVerifying(false);
        nav.goBack();
      }
    } else if (msg.type === 'dismiss') {
      nav.goBack();
    } else if (msg.type === 'failed' || msg.type === 'error') {
      showToast({ kind: 'error', message: msg.message || 'Payment failed' });
      nav.goBack();
    }
  }, [nav]);

  return (
    <Screen edges={['top']}>
      <View style={styles.header}>
        <IconButton icon={<Ionicons name="chevron-back" size={22} color={vantage.textPrimary} />} accessibilityLabel="Back" onPress={() => nav.goBack()} />
        <Text style={styles.title}>Pay with Razorpay</Text>
        <View style={{ width: 40 }} />
      </View>

      {!keyId || !orderId ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={36} color={vantage.down} />
          <Text style={styles.muted}>Missing payment details.</Text>
        </View>
      ) : (
        <WebView
          source={{ html, baseUrl: 'https://checkout.razorpay.com' }}
          style={[styles.web, { marginBottom: BOTTOM_NAV_PILL_HEIGHT + insets.bottom }]}
          javaScriptEnabled
          domStorageEnabled
          originWhitelist={['*']}
          onMessage={onMessage}
          startInLoadingState
          renderLoading={() => (
            <View style={styles.center}><ActivityIndicator color={vantage.accent} /></View>
          )}
        />
      )}

      {verifying ? (
        <View style={styles.overlay}>
          <ActivityIndicator color={vantage.accent} />
          <Text style={styles.muted}>Verifying payment…</Text>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.sm, paddingTop: space.sm, paddingBottom: space.xs },
  title: { flex: 1, color: vantage.textPrimary, fontFamily, fontSize: sizes.h2, fontWeight: weights.heavy, textAlign: 'center' },
  web: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.sm },
  muted: { color: vantage.textMuted, fontFamily, fontSize: sizes.body },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', gap: space.sm },
});
