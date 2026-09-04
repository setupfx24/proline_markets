import React, { useEffect, useState, useContext } from 'react';
import { ScrollView, View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';

import { AuthContext } from '../../../app/providers/AuthContext';
import { Screen, Card, PillButton, SymbolIcon, IconButton, StatCard, showToast } from '../../../components/vantage';
import { vantage, space, sizes, weights, fontFamily, radius } from '../../../theme/vantageTheme';
import { BOTTOM_NAV_PILL_HEIGHT } from '../../../components/vantage/BottomNavPill';
import ApiService from '../../../services/api/ApiService';

export default function StrategyDetailScreen() {
  const nav = useNavigation();
  const route = useRoute();
  const providerId = route.params?.providerId;

  const [provider, setProvider] = useState(null);
  const [loading, setLoading] = useState(true);
  const { user } = useContext(AuthContext) || {};
  const myId = user?.id ? String(user.id) : null;

  const [accounts, setAccounts] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState(null);
  const [amount, setAmount] = useState('');
  const [showCopy, setShowCopy] = useState(false);
  const [copying, setCopying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Prefer the dedicated provider endpoint, fall back to the leaderboard.
        let found = null;
        try {
          found = await ApiService.getProvider(providerId);
        } catch (_) {}
        if (!found) {
          const res = await ApiService.getLeaderboard({ limit: 50 });
          const list = Array.isArray(res) ? res : (Array.isArray(res?.items) ? res.items : []);
          found = list.find((p) => (p.id || p.provider_id) === providerId) || null;
        }
        if (!cancelled) {
          setProvider(found);
          if (found?.min_investment) setAmount(String(found.min_investment));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [providerId]);

  // Live accounts the copy can be funded from (demo can't host copies).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await ApiService.getAccounts();
        const list = Array.isArray(res) ? res : (Array.isArray(res?.items) ? res.items : []);
        const live = list.filter((a) => !a.is_demo);
        if (!cancelled) {
          setAccounts(live);
          if (live[0]) setSelectedAccountId(live[0].id || live[0]._id);
        }
      } catch (_) {}
    })();
    return () => { cancelled = true; };
  }, []);

  const submitCopy = async () => {
    const amt = Number(amount);
    if (!(amt > 0)) { showToast({ kind: 'warn', message: 'Enter a valid amount' }); return; }
    const minInv = Number(provider?.min_investment || 0);
    if (minInv && amt < minInv) { showToast({ kind: 'warn', message: `Minimum investment is ${minInv}` }); return; }
    setCopying(true);
    try {
      await ApiService.copyMaster(providerId, amt, selectedAccountId);
      showToast({ kind: 'success', message: 'Copying started' });
      setShowCopy(false);
      nav.navigate('Trade');
    } catch (e) {
      showToast({ kind: 'error', message: e?.message || 'Could not start copy' });
    } finally {
      setCopying(false);
    }
  };

  if (loading) {
    return (
      <Screen edges={['top']}>
        <BackHeader onBack={() => nav.goBack()} />
        <Text style={styles.empty}>Loading…</Text>
      </Screen>
    );
  }

  if (!provider) {
    return (
      <Screen edges={['top']}>
        <BackHeader onBack={() => nav.goBack()} />
        <Text style={styles.empty}>Strategy not found.</Text>
      </Screen>
    );
  }

  const ret30 = Number(provider.total_return_pct ?? provider.return_30d ?? provider.roi_30d ?? 0);
  const positive30 = ret30 >= 0;
  const aum = provider.total_aum ?? provider.aum ?? provider.aum_usd ?? null;
  const followers = provider.followers_count ?? provider.follower_count ?? null;
  const winRate = provider.win_rate ?? null;
  const drawdown = provider.max_drawdown_pct ?? provider.max_drawdown ?? provider.drawdown ?? null;
  // Your own master account — hide Copy, show "You" (backend is_self, or match
  // the master's owner user_id against the logged-in user as a fallback).
  const isSelf = !!(provider.is_self || (myId && String(provider.user_id || provider.master_user_id || '') === myId));
  const isCopying = !!provider.is_copying;     // already a follower → no re-copy
  const displayName = provider.provider_name || provider.name || 'Strategy';
  const displayCategory = provider.strategy_info?.category || provider.category || provider.description || null;

  return (
    <Screen edges={['top']}>
      <BackHeader onBack={() => nav.goBack()} />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: BOTTOM_NAV_PILL_HEIGHT + space.huge }}>
        <View style={styles.head}>
          <SymbolIcon symbol={displayName.slice(0, 2).toUpperCase()} size={56} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{displayName}</Text>
            {displayCategory ? <Text style={styles.sub} numberOfLines={2}>{displayCategory}</Text> : null}
            {followers != null ? <Text style={styles.sub}>{followers} followers</Text> : null}
          </View>
          {provider.is_full ? <Text style={styles.full}>Full</Text> : null}
        </View>

        <View style={styles.statsRow}>
          <StatCard label="30D Return" value={`${positive30 ? '+' : ''}${ret30.toFixed(2)}%`} delta={`${positive30 ? 'Gain' : 'Loss'}`} deltaPositive={positive30} />
          {aum != null ? <StatCard label="AUM (USD)" value={Number(aum).toLocaleString('en-US', { maximumFractionDigits: 0 })} /> : null}
          {winRate != null ? <StatCard label="Win Rate" value={`${Number(winRate).toFixed(1)}%`} /> : null}
          {drawdown != null ? <StatCard label="Max Drawdown" value={`${Number(drawdown).toFixed(2)}%`} /> : null}
        </View>

        <Card style={{ marginTop: space.lg }}>
          <Row label="Strategy ID" value={String(provider.id || provider.provider_id || '—')} />
          <Row label="Investors" value={(provider.active_investors ?? provider.followers_count) != null ? String(provider.active_investors ?? provider.followers_count) : '—'} last />
        </Card>

        {isSelf ? (
          <Card style={{ marginTop: space.xl }}>
            <View style={styles.selfRow}>
              <View style={styles.selfBadge}><Text style={styles.selfBadgeTxt}>You</Text></View>
              <Text style={styles.selfTxt}>This is your own master account — you can’t copy yourself.</Text>
            </View>
          </Card>
        ) : isCopying ? (
          <Card style={{ marginTop: space.xl }}>
            <View style={styles.selfRow}>
              <View style={[styles.selfBadge, { backgroundColor: vantage.upMuted, borderColor: vantage.up }]}>
                <Text style={[styles.selfBadgeTxt, { color: vantage.up }]}>Copying</Text>
              </View>
              <Text style={styles.selfTxt}>You’re already copying this master — their trades are mirrored to your account. A master can only be copied once.</Text>
            </View>
          </Card>
        ) : !showCopy ? (
          <PillButton
            label={provider.is_full ? 'Strategy is full' : 'Copy Strategy'}
            variant="primary"
            size="lg"
            disabled={!!provider.is_full}
            onPress={() => setShowCopy(true)}
            style={{ marginTop: space.xl }}
          />
        ) : (
          <Card style={{ marginTop: space.xl }}>
            <Text style={styles.copyTitle}>Copy this strategy</Text>

            <Text style={styles.copyLabel}>Investment amount (USD)</Text>
            <TextInput
              value={amount}
              onChangeText={(t) => setAmount(t.replace(/[^0-9.]/g, ''))}
              keyboardType="decimal-pad"
              placeholder={provider.min_investment ? `Min ${provider.min_investment}` : '0.00'}
              placeholderTextColor={vantage.textMuted}
              style={styles.copyInput}
            />

            {accounts.length > 0 ? (
              <>
                <Text style={styles.copyLabel}>Fund from account</Text>
                <View style={styles.acctRow}>
                  {accounts.map((a) => {
                    const id = a.id || a._id;
                    const active = id === selectedAccountId;
                    return (
                      <Pressable
                        key={id}
                        onPress={() => setSelectedAccountId(id)}
                        style={[styles.acctChip, active && styles.acctChipActive]}
                      >
                        <Text style={[styles.acctChipTxt, active && { color: vantage.textPrimary }]}>
                          {a.account_number || a.group || id}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : (
              <Text style={styles.copyHint}>No live account — copy will use your wallet balance.</Text>
            )}

            <PillButton
              label={copying ? 'Starting…' : 'Confirm copy'}
              variant="primary"
              size="lg"
              loading={copying}
              disabled={copying}
              onPress={submitCopy}
              style={{ marginTop: space.lg }}
            />
            <Pressable onPress={() => setShowCopy(false)} hitSlop={8} style={{ alignSelf: 'center', marginTop: space.md }}>
              <Text style={styles.cancelTxt}>Cancel</Text>
            </Pressable>
          </Card>
        )}

      </ScrollView>
    </Screen>
  );
}

function BackHeader({ onBack }) {
  return (
    <View style={styles.header}>
      <IconButton icon={<Ionicons name="chevron-back" size={22} color={vantage.textPrimary} />} accessibilityLabel="Back" onPress={onBack} />
    </View>
  );
}

function Row({ label, value, last }) {
  return (
    <View style={[rowStyles.row, !last && rowStyles.border]}>
      <Text style={rowStyles.label}>{label}</Text>
      <Text style={rowStyles.value} numberOfLines={1} ellipsizeMode="middle">{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: space.sm, paddingTop: space.sm },
  empty: { color: vantage.textMuted, fontFamily, fontSize: sizes.body, padding: space.huge, textAlign: 'center' },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  name: { color: vantage.textPrimary, fontFamily, fontSize: sizes.h1, fontWeight: weights.heavy },
  sub: { color: vantage.textMuted, fontFamily, fontSize: sizes.label, marginTop: 2 },
  full: { color: vantage.textMuted, fontFamily, fontSize: sizes.label, fontWeight: weights.semibold, backgroundColor: vantage.bgPressed, paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: 6 },
  statsRow: { flexDirection: 'row', gap: space.md, marginTop: space.lg, flexWrap: 'wrap' },
  copyTitle: { color: vantage.textPrimary, fontFamily, fontSize: sizes.h3, fontWeight: weights.heavy, marginBottom: space.md },
  selfRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  selfBadge: { backgroundColor: vantage.accentMuted, borderWidth: 1, borderColor: vantage.accent, paddingHorizontal: space.md, paddingVertical: space.xs, borderRadius: radius.pill },
  selfBadgeTxt: { color: vantage.accent, fontFamily, fontSize: sizes.label, fontWeight: weights.heavy },
  selfTxt: { flex: 1, color: vantage.textSecondary, fontFamily, fontSize: sizes.label, lineHeight: 18 },
  copyLabel: { color: vantage.textSecondary, fontFamily, fontSize: sizes.label, marginTop: space.md, marginBottom: space.xs },
  copyInput: {
    backgroundColor: vantage.bgRaised, borderRadius: radius.md,
    paddingHorizontal: space.md, paddingVertical: space.md,
    color: vantage.textPrimary, fontFamily, fontSize: sizes.h3, fontWeight: weights.bold,
  },
  acctRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  acctChip: { paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.pill, backgroundColor: vantage.bgRaised, borderWidth: 1, borderColor: vantage.border },
  acctChipActive: { borderColor: vantage.accent, backgroundColor: vantage.accentMuted },
  acctChipTxt: { color: vantage.textSecondary, fontFamily, fontSize: sizes.label, fontWeight: weights.semibold },
  copyHint: { color: vantage.textMuted, fontFamily, fontSize: sizes.label, marginTop: space.sm },
  cancelTxt: { color: vantage.textMuted, fontFamily, fontSize: sizes.label, fontWeight: weights.semibold },
});

const rowStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: space.sm, gap: space.md },
  border: { borderBottomColor: vantage.border, borderBottomWidth: StyleSheet.hairlineWidth },
  label: { color: vantage.textMuted, fontFamily, fontSize: sizes.body, flexShrink: 0 },
  value: { flex: 1, textAlign: 'right', color: vantage.textPrimary, fontFamily, fontSize: sizes.body, fontWeight: weights.bold },
});
