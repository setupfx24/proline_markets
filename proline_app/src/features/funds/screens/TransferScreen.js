import React, { useState, useEffect } from 'react';
import { ScrollView, View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { Screen, Sheet, MenuRow, PillButton, IconButton, showToast } from '../../../components/vantage';
import { vantage, space, sizes, weights, fontFamily, radius } from '../../../theme/vantageTheme';
import { BOTTOM_NAV_PILL_HEIGHT } from '../../../components/vantage/BottomNavPill';
import ApiService from '../../../services/api/ApiService';

const MAIN_WALLET = { id: 'main', isMain: true };

export default function TransferScreen() {
  const nav = useNavigation();
  const [accounts, setAccounts] = useState([]);
  const [mainBalance, setMainBalance] = useState(null);
  const [fromAccount, setFromAccount] = useState(null);
  const [toAccount, setToAccount] = useState(null);
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [picking, setPicking] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await ApiService.getAccounts();
        const list = Array.isArray(res) ? res : (Array.isArray(res?.items) ? res.items : []);
        // Demo accounts are excluded from transfers — real money only.
        setAccounts(list.filter((a) => !a.is_demo));
      } catch (_) {}
      try {
        const sum = await ApiService.getWalletSummary();
        if (sum && sum.main_wallet_balance != null) setMainBalance(Number(sum.main_wallet_balance));
      } catch (_) {}
    })();
  }, []);

  const submit = async () => {
    if (!fromAccount || !toAccount || !(Number(amount) > 0)) return;
    const fromMain = !!fromAccount.isMain;
    const toMain = !!toAccount.isMain;
    if (fromMain && toMain) {
      return showToast({ kind: 'warn', message: 'Choose a trading account too' });
    }
    if (!fromMain && !toMain && (fromAccount.id || fromAccount._id) === (toAccount.id || toAccount._id)) {
      return showToast({ kind: 'warn', message: 'Choose different accounts' });
    }
    setSubmitting(true);
    try {
      const amt = Number(amount);
      const aid = (x) => x.id || x._id;
      if (fromMain) {
        await ApiService.transferMainToTrading(aid(toAccount), amt);     // wallet → account
      } else if (toMain) {
        await ApiService.transferTradingToMain(aid(fromAccount), amt);   // account → wallet
      } else {
        await ApiService.transferInternal(aid(fromAccount), aid(toAccount), amt); // account → account
      }
      showToast({ kind: 'success', message: 'Transfer submitted' });
      nav.goBack();
    } catch (e) {
      showToast({ kind: 'error', message: e?.message || 'Transfer failed' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen edges={['top']}>
      <View style={styles.header}>
        <IconButton icon={<Ionicons name="chevron-back" size={22} color={vantage.textPrimary} />} accessibilityLabel="Back" onPress={() => nav.goBack()} />
        <Text style={styles.title}>Transfer</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: BOTTOM_NAV_PILL_HEIGHT + space.huge }}>
        <Text style={styles.label}>From</Text>
        <Pressable onPress={() => setPicking('from')} style={styles.pickRow}>
          <Text style={styles.pickTxt}>{fromAccount ? labelOf(fromAccount) : 'Select source account'}</Text>
          <Ionicons name="chevron-down" size={18} color={vantage.textMuted} />
        </Pressable>

        <Text style={[styles.label, { marginTop: space.md }]}>To</Text>
        <Pressable onPress={() => setPicking('to')} style={styles.pickRow}>
          <Text style={styles.pickTxt}>{toAccount ? labelOf(toAccount) : 'Select destination account'}</Text>
          <Ionicons name="chevron-down" size={18} color={vantage.textMuted} />
        </Pressable>

        <Text style={[styles.label, { marginTop: space.md }]}>Amount</Text>
        <TextInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={vantage.textMuted} style={styles.input} />

        <PillButton label={submitting ? 'Transferring…' : 'Submit Transfer'} variant="primary" size="lg" loading={submitting} disabled={!fromAccount || !toAccount || !(Number(amount) > 0) || submitting} onPress={submit} style={{ marginTop: space.xl }} />
      </ScrollView>

      <Sheet visible={picking != null} onClose={() => setPicking(null)} title={picking === 'from' ? 'From' : 'To'}>
        {[MAIN_WALLET, ...accounts].map((a) => (
          <MenuRow
            key={a.id || a._id}
            icon={<Ionicons name={a.isMain ? 'wallet-outline' : 'card-outline'} size={20} color={vantage.textPrimary} />}
            label={labelOf(a)}
            value={a.isMain
              ? (mainBalance != null ? `${mainBalance.toFixed(2)} USD` : '')
              : (a.balance != null ? `${Number(a.balance).toFixed(2)} ${a.currency || 'USD'}` : '')}
            onPress={() => {
              if (picking === 'from') setFromAccount(a); else setToAccount(a);
              setPicking(null);
            }}
          />
        ))}
      </Sheet>
    </Screen>
  );
}

function labelOf(a) {
  if (a?.isMain) return 'Main Wallet';
  return `${a.is_demo ? 'Demo' : 'Live'} #${a.account_number || a.id || ''}`;
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.sm, paddingTop: space.sm, paddingBottom: space.xs },
  title: { flex: 1, color: vantage.textPrimary, fontFamily, fontSize: sizes.h2, fontWeight: weights.heavy, textAlign: 'center' },
  label: { color: vantage.textSecondary, fontFamily, fontSize: sizes.label, marginBottom: space.sm },
  pickRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: vantage.bgElevated, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.md },
  pickTxt: { flex: 1, color: vantage.textPrimary, fontFamily, fontSize: sizes.body },
  input: { backgroundColor: vantage.bgElevated, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.md, color: vantage.textPrimary, fontFamily, fontSize: sizes.body },
});
