import React, { useState } from 'react';
import { ScrollView, View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { Screen, PillButton, IconButton, showToast } from '../../../components/vantage';
import { vantage, space, sizes, weights, fontFamily, radius } from '../../../theme/vantageTheme';
import { BOTTOM_NAV_PILL_HEIGHT } from '../../../components/vantage/BottomNavPill';
import ApiService from '../../../services/api/ApiService';
import { showWithdrawKycGate } from '../../../utils/kycGate';

// Mirrors WITHDRAW_NETWORK_OPTIONS on the website. Backend expects
// network ∈ {tron, bsc, eth} and destination_address (NOT chain/address).
const NETWORKS = [
  { network: 'tron', label: 'USDT TRC20', sub: 'Tron',      hint: 'Address starts with T', regex: /^T[1-9A-HJ-NP-Za-km-z]{33}$/ },
  { network: 'bsc',  label: 'USDT BEP20', sub: 'BSC',       hint: '0x + 40 hex characters', regex: /^0x[a-fA-F0-9]{40}$/ },
  { network: 'eth',  label: 'USDT ERC20', sub: 'Ethereum',  hint: '0x + 40 hex characters', regex: /^0x[a-fA-F0-9]{40}$/ },
];

export default function WithdrawCrypto() {
  const nav = useNavigation();
  const [network, setNetwork] = useState('tron');
  const [address, setAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const opt = NETWORKS.find((n) => n.network === network) || NETWORKS[0];

  const submit = async () => {
    const addr = address.trim();
    if (!addr || !(Number(amount) > 0)) return;
    if (!opt.regex.test(addr)) {
      showToast({ kind: 'warn', message: `Invalid ${opt.label} address. ${opt.hint}` });
      return;
    }
    setSubmitting(true);
    try {
      await ApiService.submitOnchainWithdrawal({ network: opt.network, amount: Number(amount), destination_address: addr });
      showToast({ kind: 'success', message: 'Withdrawal submitted' });
      nav.goBack();
    } catch (e) {
      const msg = e?.message || 'Submit failed';
      if (msg === 'KYC_REQUIRED') {
        // Withdrawal-time KYC check — backend rejects until KYC is approved.
        showWithdrawKycGate(nav);
      } else if (/step.?up|2fa|otp/i.test(msg)) {
        showToast({ kind: 'warn', message: 'Email OTP / 2FA required — coming soon' });
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
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: BOTTOM_NAV_PILL_HEIGHT + space.huge }}>
        <Text style={styles.label}>Network</Text>
        <View style={styles.chainRow}>
          {NETWORKS.map((c) => (
            <Pressable key={c.network} onPress={() => setNetwork(c.network)} style={[styles.chainChip, network === c.network && styles.chainChipActive]}>
              <Text style={[styles.chainTxt, network === c.network && { color: vantage.textPrimary, fontWeight: weights.bold }]}>{c.label.replace('USDT ', '')}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.label, { marginTop: space.md }]}>Destination address</Text>
        <TextInput value={address} onChangeText={setAddress} placeholder={opt.hint} placeholderTextColor={vantage.textMuted} style={styles.input} autoCapitalize="none" autoCorrect={false} />

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
