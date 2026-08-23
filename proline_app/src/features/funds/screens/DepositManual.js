import React, { useEffect, useState } from 'react';
import { ScrollView, View, Text, TextInput, StyleSheet, Pressable, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';

import { Screen, Card, PillButton, IconButton, showToast } from '../../../components/vantage';
import { vantage, space, sizes, weights, fontFamily, radius } from '../../../theme/vantageTheme';
import { BOTTOM_NAV_PILL_HEIGHT } from '../../../components/vantage/BottomNavPill';
import ApiService from '../../../services/api/ApiService';

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

      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: BOTTOM_NAV_PILL_HEIGHT + space.huge }}>
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
