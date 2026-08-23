import React, { useState } from 'react';
import { ScrollView, View, Text, TextInput, StyleSheet, Pressable, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';

import { Screen, PillButton, IconButton, showToast } from '../../../components/vantage';
import { vantage, space, sizes, weights, fontFamily, radius } from '../../../theme/vantageTheme';
import { BOTTOM_NAV_PILL_HEIGHT } from '../../../components/vantage/BottomNavPill';
import ApiService from '../../../services/api/ApiService';
import { showWithdrawKycGate } from '../../../utils/kycGate';

export default function WithdrawManual() {
  const nav = useNavigation();
  const [amount, setAmount] = useState('');
  const [upiId, setUpiId] = useState('');
  const [notes, setNotes] = useState('');
  const [qr, setQr] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Website rule: UPI id and/or QR — at least one is required.
  const canSubmit = (upiId.trim() || qr) && Number(amount) > 0 && !submitting;

  const pickQr = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return showToast({ kind: 'warn', message: 'Permission required' });
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
    if (!res.canceled && res.assets?.[0]) setQr(res.assets[0]);
  };

  const submit = async () => {
    if (!((upiId.trim() || qr) && Number(amount) > 0)) {
      return showToast({ kind: 'warn', message: 'Enter a UPI ID and/or attach a QR' });
    }
    setSubmitting(true);
    const fd = new FormData();
    fd.append('amount', String(amount));
    fd.append('upi_id', upiId.trim());
    fd.append('payout_notes', notes.trim());
    if (qr) {
      fd.append('file', { uri: qr.uri, type: qr.mimeType || 'image/jpeg', name: qr.fileName || 'qr.jpg' });
    }
    try {
      await ApiService.submitManualWithdrawal(fd);
      showToast({ kind: 'success', message: 'Withdrawal submitted for review' });
      nav.goBack();
    } catch (e) {
      const msg = e?.message || 'Submit failed';
      if (msg === 'KYC_REQUIRED') {
        // Withdrawal-time KYC check — backend rejects until KYC is approved.
        showWithdrawKycGate(nav);
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
        <Text style={styles.title}>UPI / Bank Withdraw</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: BOTTOM_NAV_PILL_HEIGHT + space.huge }}>
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

        <Text style={[styles.label, { marginTop: space.md }]}>Notes (optional)</Text>
        <TextInput value={notes} onChangeText={setNotes} placeholder="Account name, bank, or payout instructions" placeholderTextColor={vantage.textMuted} style={styles.input} />

        <PillButton label={submitting ? 'Submitting…' : 'Submit Withdrawal'} variant="primary" size="lg" loading={submitting} disabled={!canSubmit} onPress={submit} style={{ marginTop: space.xl }} />
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
