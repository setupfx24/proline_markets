import React, { useState, useCallback, useEffect } from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';

import { Screen, Card, PillButton, IconButton, showToast } from '../../../components/vantage';
import { vantage, space, sizes, weights, fontFamily, radius } from '../../../theme/vantageTheme';
import { BOTTOM_NAV_PILL_HEIGHT } from '../../../components/vantage/BottomNavPill';
import ApiService from '../../../services/api/ApiService';
import logger from '../../../utils/logger';

// Mirrors the website's Algo Connector page: pick a trading account, mint an
// API key pair for it, revoke it later. One key per account.
//
// A freshly generated pair is held in a panel the user dismisses explicitly,
// mirroring the website: the secret is what a bot is configured with, and it
// should be copied deliberately rather than scrolling past in the list.
export default function AlgoConnectorScreen() {
  const nav = useNavigation();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [fresh, setFresh] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await ApiService.getAlgoAccounts();
      setAccounts(Array.isArray(res?.items) ? res.items : []);
    } catch (e) {
      logger.error('algo accounts load failed', e);
      showToast({ kind: 'error', message: e?.message || 'Could not load accounts' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const copy = useCallback(async (value, label) => {
    await Clipboard.setStringAsync(String(value || ''));
    showToast({ kind: 'success', message: label + ' copied' });
  }, []);

  const doGenerate = useCallback(async (acc) => {
    setBusy(acc.account_id);
    try {
      const res = await ApiService.generateAlgoKey(acc.account_id);
      setFresh({
        api_key: res?.api_key,
        api_secret: res?.api_secret,
        account_number: res?.account_number || acc.account_number,
      });
      showToast({ kind: 'success', message: 'API key generated' });
      await load();
    } catch (e) {
      showToast({ kind: 'error', message: e?.message || 'Could not generate key' });
    } finally {
      setBusy(null);
    }
  }, [load]);

  const generate = useCallback((acc) => {
    // Regenerating silently kills the credentials a running bot is using, so it
    // is confirmed; a first-time generate has nothing to lose and is not.
    if (!acc.has_key) { doGenerate(acc); return; }
    Alert.alert(
      'Replace existing key?',
      acc.account_number + ' already has a key. Generating a new one revokes it immediately, and any bot using it stops working.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Replace', style: 'destructive', onPress: () => doGenerate(acc) },
      ],
    );
  }, [doGenerate]);

  const revoke = useCallback((acc) => {
    Alert.alert(
      'Revoke API key?',
      'Your algo bot will stop working for ' + acc.account_number + '.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: async () => {
            setBusy(acc.key_id);
            try {
              await ApiService.revokeAlgoKey(acc.key_id);
              showToast({ kind: 'success', message: 'Key revoked' });
              await load();
            } catch (e) {
              showToast({ kind: 'error', message: e?.message || 'Could not revoke key' });
            } finally {
              setBusy(null);
            }
          },
        },
      ],
    );
  }, [load]);

  const connected = accounts.filter((a) => a.has_key).length;

  return (
    <Screen edges={['top']}>
      <View style={styles.header}>
        <IconButton icon={<Ionicons name="chevron-back" size={22} color={vantage.textPrimary} />} accessibilityLabel="Back" onPress={() => nav.goBack()} />
        <Text style={styles.title}>Algo Connector</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: BOTTOM_NAV_PILL_HEIGHT + space.huge }}>
        <Text style={styles.sub}>Connect an external trading bot to a trading account with an API key pair.</Text>

        {fresh ? (
          <Card style={styles.freshCard}>
            <View style={styles.freshHead}>
              <Ionicons name="warning-outline" size={18} color={vantage.accent} />
              <Text style={styles.freshTitle}>Save your credentials</Text>
            </View>
            <Text style={styles.freshSub}>Copy both into your bot now. Generating a new key for this account revokes this pair.</Text>

            <Text style={styles.fieldLabel}>Account</Text>
            <Text style={styles.fieldValue} selectable>{fresh.account_number}</Text>

            <Text style={styles.fieldLabel}>API Key</Text>
            <Pressable onPress={() => copy(fresh.api_key, 'API key')} accessibilityRole="button">
              <Text style={styles.fieldMono} selectable>{fresh.api_key}</Text>
            </Pressable>

            <Text style={styles.fieldLabel}>API Secret</Text>
            <Pressable onPress={() => copy(fresh.api_secret, 'API secret')} accessibilityRole="button">
              <Text style={styles.fieldMono} selectable>{fresh.api_secret}</Text>
            </Pressable>

            <PillButton label="I have saved them" variant="primary" size="lg" onPress={() => setFresh(null)} style={{ marginTop: space.lg }} />
          </Card>
        ) : null}

        <Text style={styles.sectionTitle}>Connected accounts ({connected})</Text>

        {loading ? (
          <View style={styles.loading}><ActivityIndicator color={vantage.accent} /></View>
        ) : accounts.length === 0 ? (
          <Card>
            <Text style={styles.empty}>No trading accounts yet. Open one first, then come back to generate an API key.</Text>
          </Card>
        ) : (
          accounts.map((a) => (
            <Card key={a.account_id} style={styles.accCard}>
              <View style={styles.accRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.accNum}>{a.account_number}</Text>
                  <Text style={styles.accMeta}>
                    {a.account_type}{a.is_demo ? ' · Demo' : ''} · {a.currency} {Number(a.balance || 0).toLocaleString()}
                  </Text>
                </View>
                <View style={[styles.badge, a.has_key ? styles.badgeOn : styles.badgeOff]}>
                  <Text style={[styles.badgeTxt, a.has_key && { color: vantage.up }]}>{a.has_key ? 'Connected' : 'No key'}</Text>
                </View>
              </View>

              {a.has_key ? (
                <>
                  <Text style={styles.fieldLabel}>API Key</Text>
                  <Pressable onPress={() => copy(a.api_key, 'API key')} accessibilityRole="button">
                    <Text style={styles.fieldMono} selectable>{a.api_key}</Text>
                  </Pressable>
                  <Text style={styles.accMeta}>
                    {a.trades_count || 0} trades{a.last_used_at ? ' · last used ' + new Date(a.last_used_at).toLocaleDateString() : ''}
                  </Text>
                </>
              ) : null}

              <View style={styles.actions}>
                <PillButton
                  label={a.has_key ? 'Regenerate' : 'Generate key'}
                  variant="secondary"
                  size="md"
                  loading={busy === a.account_id}
                  disabled={!!busy}
                  onPress={() => generate(a)}
                  style={{ flex: 1 }}
                />
                {a.has_key ? (
                  <PillButton
                    label="Revoke"
                    variant="danger"
                    size="md"
                    loading={busy === a.key_id}
                    disabled={!!busy}
                    onPress={() => revoke(a)}
                    style={{ flex: 1 }}
                  />
                ) : null}
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.sm, paddingTop: space.sm, paddingBottom: space.xs },
  title: { flex: 1, color: vantage.textPrimary, fontFamily, fontSize: sizes.h2, fontWeight: weights.heavy, textAlign: 'center' },
  sub: { color: vantage.textSecondary, fontFamily, fontSize: sizes.label, marginBottom: space.md },
  sectionTitle: { color: vantage.textSecondary, fontFamily, fontSize: sizes.label, fontWeight: weights.bold, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: space.lg, marginBottom: space.sm },
  loading: { padding: space.xl, alignItems: 'center' },
  empty: { color: vantage.textMuted, fontFamily, fontSize: sizes.body, textAlign: 'center', padding: space.md },
  accCard: { marginBottom: space.md },
  accRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  accNum: { color: vantage.textPrimary, fontFamily, fontSize: sizes.body, fontWeight: weights.bold },
  accMeta: { color: vantage.textMuted, fontFamily, fontSize: sizes.label, marginTop: 2 },
  badge: { paddingHorizontal: space.md, paddingVertical: 4, borderRadius: radius.pill, borderWidth: 1 },
  badgeOn: { borderColor: vantage.up, backgroundColor: vantage.upMuted },
  badgeOff: { borderColor: vantage.border, backgroundColor: vantage.bgElevated },
  badgeTxt: { color: vantage.textMuted, fontFamily, fontSize: sizes.micro, fontWeight: weights.bold },
  fieldLabel: { color: vantage.textSecondary, fontFamily, fontSize: sizes.micro, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: space.md },
  fieldValue: { color: vantage.textPrimary, fontFamily, fontSize: sizes.body, marginTop: 2 },
  fieldMono: { color: vantage.textPrimary, fontFamily, fontSize: sizes.label, marginTop: 4, padding: space.sm, backgroundColor: vantage.bgElevated, borderRadius: radius.md, overflow: 'hidden' },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.lg },
  freshCard: { borderColor: vantage.accent, borderWidth: 1, marginBottom: space.lg },
  freshHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  freshTitle: { color: vantage.textPrimary, fontFamily, fontSize: sizes.h3, fontWeight: weights.bold },
  freshSub: { color: vantage.textSecondary, fontFamily, fontSize: sizes.label, marginTop: space.xs },
});
