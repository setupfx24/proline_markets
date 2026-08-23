import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, Pressable, Image, StyleSheet, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';

import { Card, PillButton, showToast } from '../../../components/vantage';
import { vantage, space, sizes, weights, fontFamily, radius } from '../../../theme/vantageTheme';
import ApiService from '../../../services/api/ApiService';

// Website local-banking flow as a self-contained panel so it can live inside
// the Deposit screen's "Local Banking" section (and standalone). `amount` is
// the shared deposit amount controlled by the parent (optional for LB).
function isLbItem(d) {
  const m = String(d.method || '').toLowerCase();
  if (m === 'local_banking') return true;
  return m === 'razorpay' && String(d.payment_link || '').startsWith('razorpay:');
}

export default function LocalBankingPanel({ amount = '' }) {
  const nav = useNavigation();
  const [submitting, setSubmitting] = useState(false);
  const [requests, setRequests] = useState([]);

  const [confirmingId, setConfirmingId] = useState(null);
  const [cAmount, setCAmount] = useState('');
  const [cTxId, setCTxId] = useState('');
  const [cFile, setCFile] = useState(null);
  const [cSubmitting, setCSubmitting] = useState(false);

  // Razorpay (per-request) — amount entry for the "awaiting" state + busy flag.
  const [rzpAmounts, setRzpAmounts] = useState({});
  const [rzpBusyId, setRzpBusyId] = useState(null);

  const loadRequests = useCallback(async () => {
    try {
      const res = await ApiService.getDeposits(1, 30);
      const list = Array.isArray(res) ? res : (Array.isArray(res?.items) ? res.items : []);
      const filtered = list.filter(isLbItem).slice(0, 8);
      setRequests(filtered);
      // Prefill the Razorpay amount box with the request's amount (if any),
      // without clobbering anything the user has already typed.
      setRzpAmounts((prev) => {
        const next = { ...prev };
        filtered.forEach((d) => {
          if (d.payment_link === 'razorpay:awaiting' && next[d.id] === undefined && Number(d.amount) > 0) {
            next[d.id] = String(Number(d.amount));
          }
        });
        return next;
      });
    } catch (_) {}
  }, []);

  useFocusEffect(useCallback(() => { loadRequests(); }, [loadRequests]));

  const sendRequest = useCallback(async () => {
    setSubmitting(true);
    try {
      await ApiService.createLocalBankingRequest(Number(amount) || 0);
      showToast({ kind: 'success', message: 'Request submitted — our team will share payment details shortly' });
      loadRequests();
    } catch (e) {
      const msg = e?.message || 'Request failed';
      if (msg.includes('KYC')) {
        showToast({ kind: 'warn', message: 'Complete KYC verification to continue' });
        nav.navigate('HomeTab', { screen: 'Kyc' });
      } else {
        showToast({ kind: 'error', message: msg });
      }
    } finally {
      setSubmitting(false);
    }
  }, [amount, loadRequests, nav]);

  // Razorpay — "awaiting" state: user enters amount, we create the order then
  // open Checkout in the WebView screen.
  const payAwaiting = useCallback(async (req) => {
    const amt = Number(rzpAmounts[req.id]);
    if (!(amt > 0)) { showToast({ kind: 'warn', message: 'Enter an amount to pay' }); return; }
    setRzpBusyId(req.id);
    try {
      const order = await ApiService.createLbRazorpayOrder(req.id, amt);
      nav.navigate('RazorpayCheckout', { keyId: order.key_id, orderId: order.order_id, amountInr: order.amount_inr, depositId: req.id });
    } catch (e) {
      showToast({ kind: 'error', message: e?.message || 'Could not create Razorpay order' });
    } finally {
      setRzpBusyId(null);
    }
  }, [rzpAmounts, nav]);

  // Razorpay — order already created (payment_link "razorpay:<order_id>").
  const payOrder = useCallback(async (req) => {
    const orderId = req.transaction_id;
    if (!orderId) { showToast({ kind: 'warn', message: 'No Razorpay order on this deposit yet' }); return; }
    setRzpBusyId(req.id);
    try {
      const meta = await ApiService.getRazorpayOrderMeta(orderId);
      if (!meta?.key_id) { showToast({ kind: 'error', message: 'Razorpay is not configured' }); return; }
      nav.navigate('RazorpayCheckout', { keyId: meta.key_id, orderId, amountInr: meta.amount_inr, depositId: req.id });
    } catch (e) {
      showToast({ kind: 'error', message: e?.message || 'Could not load payment details' });
    } finally {
      setRzpBusyId(null);
    }
  }, [nav]);

  const pickProof = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { showToast({ kind: 'warn', message: 'Permission required to pick image' }); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
    if (!res.canceled && res.assets?.[0]) setCFile(res.assets[0]);
  }, []);

  const openConfirm = useCallback((id) => {
    setConfirmingId((cur) => (cur === id ? null : id));
    setCAmount(''); setCTxId(''); setCFile(null);
  }, []);

  const submitProof = useCallback(async (depositId) => {
    if (!(Number(cAmount) > 0)) { showToast({ kind: 'warn', message: 'Enter the amount you paid' }); return; }
    if (!cTxId.trim()) { showToast({ kind: 'warn', message: 'Enter the UTR / UPI reference' }); return; }
    if (!cFile) { showToast({ kind: 'warn', message: 'Upload a payment screenshot' }); return; }
    setCSubmitting(true);
    try {
      await ApiService.confirmLocalBankingPayment(depositId, { amount: Number(cAmount), transactionId: cTxId, file: cFile });
      showToast({ kind: 'success', message: "Proof submitted — we'll confirm and credit shortly" });
      setConfirmingId(null);
      loadRequests();
    } catch (e) {
      showToast({ kind: 'error', message: e?.message || 'Could not submit proof' });
    } finally {
      setCSubmitting(false);
    }
  }, [cAmount, cTxId, cFile, loadRequests]);

  return (
    <View>
      <Card style={styles.infoCard}>
        <Ionicons name="information-circle-outline" size={20} color={vantage.accent} />
        <Text style={styles.infoTxt}>
          Submit this request and our team will share a payment link (Razorpay, bank transfer or UPI) with you shortly. Your wallet is credited once payment is confirmed.
        </Text>
      </Card>

      <PillButton
        label={submitting ? 'Sending…' : 'Send Request'}
        variant="primary"
        size="lg"
        loading={submitting}
        disabled={submitting}
        onPress={sendRequest}
        style={{ marginTop: space.md }}
      />

      {requests.length > 0 ? (
        <>
          <Text style={styles.sectionTitle}>Your requests</Text>
          {requests.map((r) => (
            <RequestCard
              key={r.id}
              req={r}
              confirming={confirmingId === r.id}
              onPay={(url) => Linking.openURL(url).catch(() => showToast({ kind: 'error', message: 'Could not open link' }))}
              onToggleConfirm={() => openConfirm(r.id)}
              cAmount={cAmount} setCAmount={setCAmount}
              cTxId={cTxId} setCTxId={setCTxId}
              cFile={cFile} pickProof={pickProof}
              cSubmitting={cSubmitting}
              onSubmitProof={() => submitProof(r.id)}
              rzpAmount={rzpAmounts[r.id] || ''}
              setRzpAmount={(v) => setRzpAmounts((p) => ({ ...p, [r.id]: v }))}
              rzpBusy={rzpBusyId === r.id}
              onPayAwaiting={() => payAwaiting(r)}
              onPayOrder={() => payOrder(r)}
            />
          ))}
        </>
      ) : null}
    </View>
  );
}

function RequestCard({
  req, confirming, onPay, onToggleConfirm,
  cAmount, setCAmount, cTxId, setCTxId, cFile, pickProof, cSubmitting, onSubmitProof,
  rzpAmount, setRzpAmount, rzpBusy, onPayAwaiting, onPayOrder,
}) {
  const status = String(req.status || 'pending').toLowerCase();
  const isApproved = status === 'approved' || status === 'auto_approved';
  const isRejected = status === 'rejected' || status === 'failed';
  const hasLink = !!req.payment_link;
  const proofSubmitted = Number(req.amount || 0) > 0;
  const link = req.payment_link || '';
  const openable = /^https?:\/\//i.test(link);
  const isRzpAwaiting = link === 'razorpay:awaiting';
  const isRzpOrder = link.startsWith('razorpay:') && !isRzpAwaiting;

  const stage = isApproved ? 'Credited'
    : isRejected ? 'Rejected'
    : (isRzpAwaiting || isRzpOrder) ? 'Approved — pay via Razorpay'
    : proofSubmitted ? 'Proof submitted — verifying'
    : hasLink ? 'Payment details ready'
    : 'Awaiting admin review';
  const stageColor = isApproved ? vantage.up : isRejected ? vantage.down : vantage.textMuted;
  // Razorpay paths are NOT gated by proofSubmitted — an LB request created
  // with an amount still needs to be paid via Razorpay (mirrors the website).
  const rzpActive = (isRzpAwaiting || isRzpOrder) && !isApproved && !isRejected;
  const proofActions = hasLink && !isApproved && !isRejected && !proofSubmitted && !isRzpAwaiting && !isRzpOrder;

  return (
    <Card style={{ marginTop: space.sm }}>
      <View style={styles.reqTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.reqAmt}>{proofSubmitted ? `$${Number(req.amount || 0).toLocaleString()}` : 'Deposit request'}</Text>
          <Text style={[styles.reqStage, { color: stageColor }]}>{stage}</Text>
        </View>
        {(isRzpOrder && rzpActive) || proofActions ? (
          <View style={styles.reqBtns}>
            {isRzpOrder && rzpActive ? (
              <Pressable onPress={onPayOrder} disabled={rzpBusy} style={[styles.smallBtn, styles.payBtn, rzpBusy && { opacity: 0.6 }]} accessibilityRole="button">
                <Text style={styles.payTxt}>{rzpBusy ? 'Opening…' : 'Pay with Razorpay'}</Text>
              </Pressable>
            ) : null}
            {proofActions && openable ? (
              <Pressable onPress={() => onPay(link)} style={[styles.smallBtn, styles.payBtn]} accessibilityRole="button">
                <Text style={styles.payTxt}>Pay now</Text>
              </Pressable>
            ) : null}
            {proofActions ? (
              <Pressable onPress={onToggleConfirm} style={[styles.smallBtn, styles.paidBtn]} accessibilityRole="button">
                <Text style={styles.paidTxt}>{confirming ? 'Cancel' : "I've Paid"}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>

      {/* Razorpay "awaiting" — enter amount, then create order + open checkout. */}
      {isRzpAwaiting && !isApproved && !isRejected ? (
        <View style={styles.confirmBox}>
          <Text style={styles.cLabel}>Amount to deposit (USD)</Text>
          <View style={styles.rzpRow}>
            <TextInput
              value={rzpAmount}
              onChangeText={setRzpAmount}
              keyboardType="decimal-pad"
              placeholder="e.g. 100"
              placeholderTextColor={vantage.textMuted}
              style={[styles.cInput, { flex: 1 }]}
            />
            <Pressable onPress={onPayAwaiting} disabled={rzpBusy || !(Number(rzpAmount) > 0)} style={[styles.smallBtn, styles.payBtn, (rzpBusy || !(Number(rzpAmount) > 0)) && { opacity: 0.6 }]} accessibilityRole="button">
              <Text style={styles.payTxt}>{rzpBusy ? 'Opening…' : 'Pay with Razorpay'}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {/* Inline "I've Paid" proof form. */}
      {confirming ? (
        <View style={styles.confirmBox}>
          <Text style={styles.cLabel}>Amount paid (USD)</Text>
          <TextInput value={cAmount} onChangeText={setCAmount} keyboardType="decimal-pad" placeholder="e.g. 100" placeholderTextColor={vantage.textMuted} style={styles.cInput} />

          <Text style={[styles.cLabel, { marginTop: space.sm }]}>UTR / UPI reference</Text>
          <TextInput value={cTxId} onChangeText={setCTxId} placeholder="Transaction reference" placeholderTextColor={vantage.textMuted} style={styles.cInput} autoCapitalize="none" />

          <Text style={[styles.cLabel, { marginTop: space.sm }]}>Payment proof (screenshot)</Text>
          <Pressable onPress={pickProof} style={styles.proofBtn} accessibilityRole="button">
            {cFile ? (
              <Image source={{ uri: cFile.uri }} style={styles.proofImg} resizeMode="cover" />
            ) : (
              <View style={styles.proofPlaceholder}>
                <Ionicons name="image-outline" size={26} color={vantage.textMuted} />
                <Text style={styles.proofTxt}>Tap to choose image</Text>
              </View>
            )}
          </Pressable>

          <PillButton label={cSubmitting ? 'Submitting…' : 'Submit proof'} variant="primary" size="md" loading={cSubmitting} disabled={cSubmitting} onPress={onSubmitProof} style={{ marginTop: space.md }} />
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  infoCard: { flexDirection: 'row', gap: space.md, backgroundColor: vantage.accentMuted },
  infoTxt: { flex: 1, color: vantage.textPrimary, fontFamily, fontSize: sizes.label, lineHeight: 18 },
  sectionTitle: { color: vantage.textPrimary, fontFamily, fontSize: sizes.h3, fontWeight: weights.bold, marginTop: space.xl, marginBottom: space.sm },
  reqTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  reqAmt: { color: vantage.textPrimary, fontFamily, fontSize: sizes.body, fontWeight: weights.bold },
  reqStage: { fontFamily, fontSize: sizes.label, marginTop: 2 },
  reqBtns: { flexDirection: 'row', gap: space.xs, flexShrink: 0 },
  smallBtn: { paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  payBtn: { backgroundColor: vantage.accent },
  payTxt: { color: vantage.textInverse, fontFamily, fontSize: sizes.label, fontWeight: weights.bold },
  paidBtn: { borderWidth: 1, borderColor: vantage.textPrimary },
  paidTxt: { color: vantage.textPrimary, fontFamily, fontSize: sizes.label, fontWeight: weights.bold },
  rzpRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  confirmBox: { marginTop: space.md, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: vantage.border },
  cLabel: { color: vantage.textSecondary, fontFamily, fontSize: sizes.label, marginBottom: space.xs },
  cInput: { backgroundColor: vantage.bgRaised, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.sm, color: vantage.textPrimary, fontFamily, fontSize: sizes.body },
  proofBtn: { backgroundColor: vantage.bgRaised, borderRadius: radius.md, overflow: 'hidden', minHeight: 120, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: vantage.border, borderStyle: 'dashed' },
  proofImg: { width: '100%', height: 160 },
  proofPlaceholder: { alignItems: 'center', padding: space.lg, gap: space.xs },
  proofTxt: { color: vantage.textMuted, fontFamily, fontSize: sizes.label },
});
