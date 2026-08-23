import React, { useState, useEffect, useCallback } from 'react';
import { ScrollView, View, Text, TextInput, Pressable, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';

import { Screen, Card, PillButton, IconButton, SegmentedTabs, showToast } from '../../../components/vantage';
import { vantage, space, sizes, weights, fontFamily, radius } from '../../../theme/vantageTheme';
import { BOTTOM_NAV_PILL_HEIGHT } from '../../../components/vantage/BottomNavPill';
import ApiService from '../../../services/api/ApiService';
import LocalBankingPanel from '../components/LocalBankingPanel';

const QUICK_AMOUNTS = [100, 500, 1000, 5000];

// Mirrors the website's Deposit tab: a shared amount on top, then a
// Crypto | Local Banking toggle. Crypto shows the admin's pay-to
// destinations + the OxaPay gateway + manual tx-hash/proof submission.
export default function DepositScreen() {
  const nav = useNavigation();
  const [amount, setAmount] = useState('');
  const [section, setSection] = useState('crypto');

  const [bankInfo, setBankInfo] = useState(null);
  const [txId, setTxId] = useState('');
  const [proof, setProof] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await ApiService.getDepositBankDetails();
        if (!cancelled) setBankInfo(res || null);
      } catch (_) { if (!cancelled) setBankInfo(null); }
    })();
    return () => { cancelled = true; };
  }, []);

  const hasDestination = !!(bankInfo && (bankInfo.bank_name || bankInfo.upi_id || bankInfo.qr_code_url || bankInfo.wallet_address));

  const copyAddr = useCallback(async (addr) => {
    await Clipboard.setStringAsync(addr);
    showToast({ kind: 'success', message: 'Address copied' });
  }, []);

  const openGateway = useCallback(() => {
    if (!(Number(amount) > 0)) { showToast({ kind: 'warn', message: 'Enter a deposit amount first' }); return; }
    nav.navigate('DepositOxapay', { amount: Number(amount) });
  }, [amount, nav]);

  const pickProof = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { showToast({ kind: 'warn', message: 'Permission required to pick image' }); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
    if (!res.canceled && res.assets?.[0]) setProof(res.assets[0]);
  }, []);

  const submitManual = useCallback(async () => {
    if (!(Number(amount) > 0)) { showToast({ kind: 'warn', message: 'Enter a valid amount' }); return; }
    if (!hasDestination) { showToast({ kind: 'warn', message: 'No manual destination — use the crypto gateway' }); return; }
    if (!txId.trim()) { showToast({ kind: 'warn', message: 'Enter your transaction reference / tx hash' }); return; }
    if (!proof) { showToast({ kind: 'warn', message: 'Upload a screenshot of your payment' }); return; }
    setSubmitting(true);
    const fd = new FormData();
    fd.append('amount', String(amount));
    fd.append('transaction_id', txId.trim());
    fd.append('file', { uri: proof.uri, type: proof.mimeType || 'image/jpeg', name: proof.fileName || 'proof.jpg' });
    try {
      await ApiService.submitManualDeposit(fd);
      showToast({ kind: 'success', message: `Deposit of $${Number(amount).toLocaleString()} submitted — pending approval` });
      setAmount(''); setTxId(''); setProof(null);
    } catch (e) {
      showToast({ kind: 'error', message: e?.message || 'Deposit failed' });
    } finally {
      setSubmitting(false);
    }
  }, [amount, hasDestination, txId, proof]);

  return (
    <Screen edges={['top']}>
      <View style={styles.header}>
        <IconButton icon={<Ionicons name="chevron-back" size={22} color={vantage.textPrimary} />} accessibilityLabel="Back" onPress={() => nav.goBack()} />
        <Text style={styles.title}>Deposit</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: BOTTOM_NAV_PILL_HEIGHT + space.huge }} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Amount (USD){section === 'local_banking' ? ' · optional' : ''}</Text>
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

        <View style={{ marginTop: space.lg, marginBottom: space.md }}>
          <SegmentedTabs
            value={section}
            onChange={setSection}
            options={[
              { value: 'crypto', label: 'Crypto' },
              { value: 'local_banking', label: 'Local Banking' },
            ]}
          />
        </View>

        {section === 'crypto' ? (
          <>
            {hasDestination ? (
              <Card style={styles.payCard}>
                <Text style={styles.payTitle}>Pay to</Text>
                {bankInfo.qr_code_url ? (
                  <Image source={{ uri: bankInfo.qr_code_url }} style={styles.adminQr} resizeMode="contain" />
                ) : null}
                {bankInfo.bank_name ? <Detail label="Bank" value={bankInfo.bank_name} /> : null}
                {bankInfo.account_holder ? <Detail label="Holder" value={bankInfo.account_holder} /> : null}
                {bankInfo.account_number ? <Detail label="A/C" value={bankInfo.account_number} /> : null}
                {bankInfo.ifsc_code ? <Detail label="IFSC" value={bankInfo.ifsc_code} /> : null}
                {bankInfo.upi_id ? <Detail label="UPI" value={bankInfo.upi_id} /> : null}

                {bankInfo.wallet_address ? (
                  <View style={styles.walletBox}>
                    <Text style={styles.walletLab}>Crypto address</Text>
                    <View style={styles.walletRow}>
                      <View style={styles.qrChip}>
                        <QRCode value={bankInfo.wallet_address} size={92} backgroundColor="#FFFFFF" color="#000000" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.walletAddr} selectable>{bankInfo.wallet_address}</Text>
                        <Pressable onPress={() => copyAddr(bankInfo.wallet_address)} hitSlop={6}>
                          <Text style={styles.copyTxt}>Copy address</Text>
                        </Pressable>
                      </View>
                    </View>
                    <Text style={styles.hint}>Scan or copy, pay, then paste your tx hash below as proof.</Text>
                  </View>
                ) : null}
              </Card>
            ) : null}

            <PillButton
              label="Pay with crypto gateway →"
              variant="primary"
              size="lg"
              onPress={openGateway}
              style={{ marginTop: hasDestination ? space.md : 0 }}
            />

            {hasDestination ? (
              <>
                <Text style={styles.orNote}>Or pay manually to the address above and submit your transaction hash below.</Text>

                <Text style={[styles.label, { marginTop: space.md }]}>Transaction reference / tx hash</Text>
                <TextInput value={txId} onChangeText={setTxId} placeholder="On-chain tx hash, UTR, or reference" placeholderTextColor={vantage.textMuted} style={styles.input} autoCapitalize="none" autoCorrect={false} />

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
                  label={submitting ? 'Submitting…' : 'Submit deposit proof'}
                  variant="secondary"
                  size="lg"
                  loading={submitting}
                  disabled={submitting}
                  onPress={submitManual}
                  style={{ marginTop: space.lg }}
                />
              </>
            ) : null}
          </>
        ) : (
          <LocalBankingPanel amount={amount} />
        )}
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
  amountInput: {
    backgroundColor: vantage.bgElevated, borderRadius: radius.md,
    paddingHorizontal: space.md, paddingVertical: space.lg,
    color: vantage.textPrimary, fontFamily, fontSize: sizes.h1, fontWeight: weights.heavy,
  },
  quickRow: { flexDirection: 'row', gap: space.sm, marginTop: space.sm, flexWrap: 'wrap' },
  quickChip: { paddingHorizontal: space.lg, paddingVertical: space.sm, backgroundColor: vantage.bgRaised, borderRadius: radius.pill },
  quickTxt: { color: vantage.textPrimary, fontFamily, fontSize: sizes.label, fontWeight: weights.bold },
  input: { backgroundColor: vantage.bgElevated, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.md, color: vantage.textPrimary, fontFamily, fontSize: sizes.body },

  payCard: { gap: space.xs },
  payTitle: { color: vantage.textMuted, fontFamily, fontSize: sizes.micro, fontWeight: weights.bold, letterSpacing: 1, textTransform: 'uppercase', marginBottom: space.xs },
  adminQr: { width: 150, height: 150, borderRadius: radius.md, backgroundColor: '#FFFFFF', marginBottom: space.sm },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3, gap: space.md },
  detailLab: { color: vantage.textMuted, fontFamily, fontSize: sizes.label },
  detailVal: { color: vantage.textPrimary, fontFamily, fontSize: sizes.label, fontWeight: weights.bold, flexShrink: 1, textAlign: 'right' },
  walletBox: { marginTop: space.sm, paddingTop: space.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: vantage.border, gap: space.sm },
  walletLab: { color: vantage.textMuted, fontFamily, fontSize: sizes.micro, fontWeight: weights.bold, letterSpacing: 1, textTransform: 'uppercase' },
  walletRow: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  qrChip: { padding: space.xs, backgroundColor: '#FFFFFF', borderRadius: 8 },
  walletAddr: { color: vantage.textPrimary, fontFamily, fontSize: sizes.label, fontWeight: weights.semibold },
  copyTxt: { color: vantage.accent, fontFamily, fontSize: sizes.label, fontWeight: weights.bold, marginTop: space.xs },
  hint: { color: vantage.textMuted, fontFamily, fontSize: sizes.micro, lineHeight: 15 },
  orNote: { color: vantage.textMuted, fontFamily, fontSize: sizes.label, textAlign: 'center', marginTop: space.lg },
  proofBtn: { backgroundColor: vantage.bgElevated, borderRadius: radius.md, overflow: 'hidden', minHeight: 140, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: vantage.border, borderStyle: 'dashed' },
  proofImg: { width: '100%', height: 200 },
  proofPlaceholder: { alignItems: 'center', padding: space.lg, gap: space.sm },
  proofTxt: { color: vantage.textMuted, fontFamily, fontSize: sizes.label },
});
