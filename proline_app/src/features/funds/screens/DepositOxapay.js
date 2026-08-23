import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import { Screen, PillButton, IconButton, showToast } from '../../../components/vantage';
import { BOTTOM_NAV_PILL_HEIGHT } from '../../../components/vantage/BottomNavPill';
import { vantage, space, sizes, weights, fontFamily } from '../../../theme/vantageTheme';
import ApiService from '../../../services/api/ApiService';

// Opens the OxaPay hosted crypto checkout in a WebView. The backend creates a
// Deposit row + an OxaPay invoice and returns payment_url; OxaPay's webhook
// auto-credits the wallet on payment — no polling needed here.
export default function DepositOxapay() {
  const nav = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const amount = Number(route.params?.amount) || 0;
  const accountId = route.params?.accountId || null;

  const [payUrl, setPayUrl] = useState(null);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(true);

  const create = useCallback(async () => {
    if (!(amount > 0)) {
      setError('Enter a deposit amount first.');
      setCreating(false);
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const res = await ApiService.createOxapayDeposit({ amount, accountId });
      const url = res?.payment_url;
      if (!url) throw new Error('Gateway did not return a payment link');
      setPayUrl(url);
    } catch (e) {
      setError(e?.message || 'Could not open the gateway');
    } finally {
      setCreating(false);
    }
  }, [amount, accountId]);

  useEffect(() => { create(); }, [create]);

  return (
    <Screen edges={['top']}>
      <View style={styles.header}>
        <IconButton icon={<Ionicons name="chevron-back" size={22} color={vantage.textPrimary} />} accessibilityLabel="Back" onPress={() => nav.goBack()} />
        <Text style={styles.title}>Crypto Deposit</Text>
        <View style={{ width: 40 }} />
      </View>

      {creating ? (
        <View style={styles.center}>
          <ActivityIndicator color={vantage.accent} />
          <Text style={styles.muted}>Opening secure checkout…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={36} color={vantage.down} />
          <Text style={styles.errTxt}>{error}</Text>
          {amount > 0 ? (
            <PillButton label="Try again" variant="primary" size="md" onPress={create} style={{ marginTop: space.md }} />
          ) : (
            <PillButton label="Go back" variant="primary" size="md" onPress={() => nav.goBack()} style={{ marginTop: space.md }} />
          )}
        </View>
      ) : payUrl ? (
        <>
          <WebView
            source={{ uri: payUrl }}
            style={styles.web}
            startInLoadingState
            renderLoading={() => (
              <View style={styles.center}><ActivityIndicator color={vantage.accent} /></View>
            )}
            onError={() => setError('Failed to load the payment page')}
          />
          <View style={[styles.footer, { paddingBottom: BOTTOM_NAV_PILL_HEIGHT + insets.bottom + space.md }]}>
            <Text style={styles.footNote}>
              Complete the payment in the page above. Your wallet is credited automatically once confirmed.
            </Text>
            <PillButton
              label="I've completed payment"
              variant="primary"
              size="lg"
              onPress={() => { showToast({ kind: 'info', message: 'We’ll credit your wallet once the payment confirms' }); nav.goBack(); }}
            />
          </View>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.sm, paddingTop: space.sm, paddingBottom: space.xs },
  title: { flex: 1, color: vantage.textPrimary, fontFamily, fontSize: sizes.h2, fontWeight: weights.heavy, textAlign: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl, gap: space.sm },
  muted: { color: vantage.textMuted, fontFamily, fontSize: sizes.body },
  errTxt: { color: vantage.textPrimary, fontFamily, fontSize: sizes.body, textAlign: 'center' },
  web: { flex: 1, backgroundColor: '#FFFFFF' },
  footer: { padding: space.lg, gap: space.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: vantage.border, backgroundColor: vantage.bg },
  footNote: { color: vantage.textMuted, fontFamily, fontSize: sizes.label, textAlign: 'center' },
});
