import React, { useEffect, useState } from 'react';
import { ScrollView, View, Text, TextInput, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';

import { Screen, Card, PillButton, IconButton, showToast } from '../../../components/vantage';
import { vantage, space, sizes, weights, fontFamily, radius } from '../../../theme/vantageTheme';
import { BOTTOM_NAV_PILL_HEIGHT } from '../../../components/vantage/BottomNavPill';
import ApiService from '../../../services/api/ApiService';

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
  const address = wallets[chain] || wallets[chain.toLowerCase()] || null;

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

      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: BOTTOM_NAV_PILL_HEIGHT + space.huge }}>
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
