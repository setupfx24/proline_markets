import React, { useState } from 'react';
import { ScrollView, View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { Screen, PillButton, IconButton, showToast } from '../../../components/vantage';
import { vantage, space, sizes, weights, fontFamily, radius } from '../../../theme/vantageTheme';
import { BOTTOM_NAV_PILL_HEIGHT } from '../../../components/vantage/BottomNavPill';
import ApiService from '../../../services/api/ApiService';
import { showWithdrawKycGate } from '../../../utils/kycGate';

// Mirrors CRYPTO_ASSETS on the web wallet page. The selection is not a
// separate backend field: it is prefixed onto the payout string so finance can
// match the transfer, exactly as the website does.
const CRYPTO_ASSETS = [
  { id: 'BTC',      label: 'BTC',  sub: 'Bitcoin' },
  { id: 'ETH',      label: 'ETH',  sub: 'Ethereum' },
  { id: 'USDT_ERC', label: 'USDT', sub: 'ERC20' },
  { id: 'USDC_ERC', label: 'USDC', sub: 'ERC20' },
  { id: 'TRX',      label: 'TRX',  sub: 'Tron' },
  { id: 'USDT_TRC', label: 'USDT', sub: 'TRC20' },
  { id: 'USDC_TRC', label: 'USDC', sub: 'TRC20' },
  { id: 'USDT_SOL', label: 'USDT', sub: 'SOL' },
  { id: 'USDC_SOL', label: 'USDC', sub: 'SOL' },
  { id: 'SOL',      label: 'SOL',  sub: 'Solana' },
  { id: 'XRP',      label: 'XRP',  sub: 'XRP' },
];

export default function WithdrawCrypto() {
  const nav = useNavigation();
  const [asset, setAsset] = useState(CRYPTO_ASSETS[0].id);
  const [address, setAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const opt = CRYPTO_ASSETS.find((c) => c.id === asset) || CRYPTO_ASSETS[0];

  const submit = async () => {
    const addr = address.trim();
    if (!addr || !(Number(amount) > 0)) return;
    setSubmitting(true);
    try {
      // The same call the website's crypto withdrawal makes: the generic
      // /wallet/withdraw route with the OxaPay method, the chosen asset
      // prefixed onto the payout details.
      await ApiService.submitWithdrawal({
        amount: Number(amount),
        method: 'oxapay',
        bank_details: { oxapay_payout: `[${opt.id}] ${addr}`.trim() },
      });
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
        <Text style={styles.label}>Asset</Text>
        <View style={styles.chainRow}>
          {CRYPTO_ASSETS.map((c) => (
            <Pressable key={c.id} onPress={() => setAsset(c.id)} style={[styles.chainChip, asset === c.id && styles.chainChipActive]}>
              <Text style={[styles.chainTxt, asset === c.id && { color: vantage.textPrimary, fontWeight: weights.bold }]}>{c.label}</Text>
              <Text style={styles.chainSub}>{c.sub}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.label, { marginTop: space.md }]}>Wallet address / payout details</Text>
        <TextInput value={address} onChangeText={setAddress} placeholder={`Your ${opt.label} (${opt.sub}) address`} placeholderTextColor={vantage.textMuted} style={styles.input} autoCapitalize="none" autoCorrect={false} />

        <Text style={[styles.label, { marginTop: space.md }]}>Amount (USD)</Text>
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
  chainRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chainChip: { minWidth: 88, flexGrow: 1, paddingVertical: space.sm, paddingHorizontal: space.sm, backgroundColor: vantage.bgElevated, borderRadius: radius.md, borderWidth: 1, borderColor: vantage.border, alignItems: 'center' },
  chainChipActive: { backgroundColor: vantage.bgRaised, borderColor: vantage.accent },
  chainTxt: { color: vantage.textMuted, fontFamily, fontSize: sizes.label },
  chainSub: { color: vantage.textMuted, fontFamily, fontSize: sizes.micro, marginTop: 2 },
  input: { backgroundColor: vantage.bgElevated, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.md, color: vantage.textPrimary, fontFamily, fontSize: sizes.body },
  warn: { color: vantage.down, fontFamily, fontSize: sizes.label, marginTop: space.md, textAlign: 'center' },
});
