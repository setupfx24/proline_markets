import React, { useEffect, useState, useCallback } from 'react';
import { ScrollView, View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { Screen, Card, PillButton, IconButton, showToast } from '../../../components/vantage';
import { BOTTOM_NAV_PILL_HEIGHT } from '../../../components/vantage/BottomNavPill';
import { vantage, space, sizes, weights, fontFamily, radius } from '../../../theme/vantageTheme';
import ApiService from '../../../services/api/ApiService';
import { authedFetch } from '../../../services/api/authedFetch';

function money(n) {
  return Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

const TYPES = [
  { key: 'signal_provider', label: 'Signal',  desc: 'Let others copy your trades, sized to each follower’s equity.' },
  { key: 'pamm',            label: 'PAMM',     desc: 'Manage a pooled fund — investors allocate a $ amount, sized to the pool.' },
  // MAM removed — the website only surfaces Copy Trading + PAMM.
];

// Backend keeps only two master records per user: 'pamm' and 'signal_provider'
// (which also covers MAM). Normalize the UI type to the stored type so the
// per-type status check looks up the right record.
const normalizeType = (t) => (t === 'pamm' ? 'pamm' : 'signal_provider');

export default function BecomeMasterScreen() {
  const nav = useNavigation();
  const [type, setType] = useState('signal_provider');
  const [perfFee, setPerfFee] = useState('20');
  const [mgmtFee, setMgmtFee] = useState('0');
  const [minInv, setMinInv] = useState('100');
  const [maxInv, setMaxInv] = useState('100');

  const [elig, setElig] = useState(null);
  const [provider, setProvider] = useState(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    // Eligibility (always 200) — global, not per type.
    try { setElig(await ApiService.getMasterEligibility()); } catch (_) {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Provider status is PER master type: a user can be a PAMM master and still
  // apply as a Signal/Copy master. Re-check whenever the selected type changes.
  // Raw fetch so the expected 404 ("not a provider of this type") doesn't
  // surface as a red console error.
  const loadProvider = useCallback(async (t) => {
    try {
      const res = await authedFetch(`/social/my-provider?master_type=${normalizeType(t)}`);
      setProvider(res.ok ? await res.json() : null);
    } catch (_) {
      setProvider(null);
    }
  }, []);

  useEffect(() => { loadProvider(type); }, [type, loadProvider]);

  const apply = async () => {
    const pf = Number(perfFee), mf = Number(mgmtFee), mi = Number(minInv), mx = Number(maxInv);
    if (!(pf >= 0 && pf <= 50)) { showToast({ kind: 'warn', message: 'Performance fee must be 0–50%' }); return; }
    if (type !== 'signal_provider' && !(mf >= 0 && mf <= 10)) { showToast({ kind: 'warn', message: 'Management fee must be 0–10%' }); return; }
    if (!(mi > 0)) { showToast({ kind: 'warn', message: 'Min investment must be greater than 0' }); return; }
    if (!(mx >= 1 && mx <= 1000)) { showToast({ kind: 'warn', message: 'Max investors must be 1–1000' }); return; }

    setApplying(true);
    try {
      const res = await ApiService.becomeProvider({
        master_type: type,
        performance_fee_pct: pf,
        management_fee_pct: type === 'signal_provider' ? 0 : mf,
        min_investment: mi,
        max_investors: mx,
      });
      showToast({ kind: 'success', message: res?.message || 'Application submitted for review' });
      await loadProvider(type);
    } catch (e) {
      showToast({ kind: 'error', message: e?.message || 'Could not apply' });
    } finally {
      setApplying(false);
    }
  };

  const criteria = elig ? [
    { label: 'Active trading days', cur: `${elig.active_days} / ${elig.active_days_required}`, ok: elig.active_days_ok },
    { label: 'Profitable track record', cur: `${elig.total_pnl_usd >= 0 ? '+' : '−'}$${money(Math.abs(elig.total_pnl_usd))}`, ok: elig.profitable_ok },
    { label: 'Trade volume', cur: `$${money(elig.trade_volume_usd)} / $${money(elig.trade_volume_required)}`, ok: elig.trade_volume_ok },
    { label: 'Trades placed', cur: `${elig.trade_count} / ${elig.trade_count_required}`, ok: elig.trade_count_ok },
  ] : [];

  const status = String(provider?.status || provider?.application_status || '').toLowerCase();
  const alreadyApplied = !!provider && ['pending', 'submitted', 'approved', 'active'].includes(status);
  const selectedType = TYPES.find((t) => t.key === type);

  return (
    <Screen edges={['top']}>
      <View style={styles.header}>
        <IconButton icon={<Ionicons name="chevron-back" size={22} color={vantage.textPrimary} />} accessibilityLabel="Back" onPress={() => nav.goBack()} />
        <Text style={styles.title}>Become a Master</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: BOTTOM_NAV_PILL_HEIGHT + space.huge }}>
        <View style={styles.hero}>
          <View style={styles.heroIcon}><Ionicons name="ribbon" size={36} color={vantage.accent} /></View>
          <Text style={styles.heroTitle}>Earn from your trading</Text>
          <Text style={styles.heroSub}>Approved masters accept followers/investors and earn a performance fee on profits.</Text>
        </View>

        {/* Master type — ALWAYS visible so you can apply for another type even
            after becoming a master of one. */}
        <Text style={styles.sectionTitle}>Master type</Text>
        <View style={styles.typeRow}>
          {TYPES.map((t) => {
            const active = t.key === type;
            return (
              <Pressable key={t.key} onPress={() => setType(t.key)} style={[styles.typeChip, active && styles.typeChipActive]}>
                <Text style={[styles.typeTxt, active && { color: vantage.textInverse }]}>{t.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.typeDesc}>{selectedType?.desc}</Text>

        {alreadyApplied ? (
          <Card style={{ marginTop: space.lg }}>
            <Text style={styles.cardTitle}>
              {status === 'approved' || status === 'active' ? `You're a ${selectedType?.label} Master` : 'Application under review'}
            </Text>
            <Text style={styles.cardSub}>
              {status === 'approved' || status === 'active'
                ? `Your ${selectedType?.label} master profile is active. Pick another type above to apply for more.`
                : 'An admin will review your application. You will be notified once approved.'}
            </Text>
          </Card>
        ) : (
          <>
            {/* Settings */}
            <Text style={styles.sectionTitle}>Settings</Text>
            <Card>
              <Field label="Performance fee (%)" value={perfFee} onChange={setPerfFee} hint="0–50" />
              {type !== 'signal_provider' ? (
                <Field label="Management fee (%)" value={mgmtFee} onChange={setMgmtFee} hint="0–10" />
              ) : null}
              <Field label="Minimum investment (USD)" value={minInv} onChange={setMinInv} />
              <Field label="Maximum investors" value={maxInv} onChange={setMaxInv} hint="1–1000" last />
            </Card>

            {/* Eligibility */}
            <Text style={styles.sectionTitle}>Eligibility</Text>
            <Card padding={0}>
              {loading ? (
                <Text style={styles.loading}>Loading…</Text>
              ) : criteria.map((c, i) => (
                <View key={c.label} style={[styles.critRow, i > 0 && styles.critBorder]}>
                  <Ionicons name={c.ok ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={c.ok ? vantage.up : vantage.textMuted} />
                  <Text style={styles.critLabel}>{c.label}</Text>
                  <Text style={[styles.critVal, { color: c.ok ? vantage.up : vantage.textSecondary }]}>{c.cur}</Text>
                </View>
              ))}
            </Card>
            <Text style={styles.hint}>
              {elig?.all_passed ? 'You meet the criteria.' : 'PAMM requires all criteria. Signal provider may be approved sooner.'}
            </Text>

            <PillButton
              label={applying ? 'Submitting…' : 'Submit application'}
              variant="primary"
              size="lg"
              loading={applying}
              disabled={applying}
              onPress={apply}
              style={{ marginTop: space.lg }}
            />
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function Field({ label, value, onChange, hint, last }) {
  return (
    <View style={[fieldStyles.wrap, !last && fieldStyles.border]}>
      <View style={{ flex: 1 }}>
        <Text style={fieldStyles.label}>{label}</Text>
        {hint ? <Text style={fieldStyles.hint}>{hint}</Text> : null}
      </View>
      <TextInput
        value={value}
        onChangeText={(t) => onChange(t.replace(/[^0-9.]/g, ''))}
        keyboardType="decimal-pad"
        style={fieldStyles.input}
        placeholderTextColor={vantage.textMuted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.sm, paddingTop: space.sm },
  title: { flex: 1, color: vantage.textPrimary, fontFamily, fontSize: sizes.h2, fontWeight: weights.heavy, textAlign: 'center' },
  hero: { alignItems: 'center', paddingVertical: space.md },
  heroIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: vantage.accentMuted, alignItems: 'center', justifyContent: 'center', marginBottom: space.md },
  heroTitle: { color: vantage.textPrimary, fontFamily, fontSize: sizes.h2, fontWeight: weights.heavy, textAlign: 'center' },
  heroSub: { color: vantage.textMuted, fontFamily, fontSize: sizes.body, textAlign: 'center', marginTop: space.sm, lineHeight: 20 },
  sectionTitle: { color: vantage.textSecondary, fontFamily, fontSize: sizes.label, fontWeight: weights.semibold, textTransform: 'uppercase', letterSpacing: 1, marginTop: space.lg, marginBottom: space.sm },
  typeRow: { flexDirection: 'row', gap: space.sm },
  typeChip: { flex: 1, alignItems: 'center', paddingVertical: space.md, borderRadius: radius.md, backgroundColor: vantage.bgElevated, borderWidth: 1, borderColor: vantage.border },
  typeChipActive: { backgroundColor: vantage.accent, borderColor: vantage.accent },
  typeTxt: { color: vantage.textSecondary, fontFamily, fontSize: sizes.body, fontWeight: weights.bold },
  typeDesc: { color: vantage.textMuted, fontFamily, fontSize: sizes.label, marginTop: space.sm, lineHeight: 18 },
  loading: { color: vantage.textMuted, fontFamily, fontSize: sizes.body, padding: space.lg, textAlign: 'center' },
  critRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  critBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: vantage.border },
  critLabel: { flex: 1, color: vantage.textPrimary, fontFamily, fontSize: sizes.body },
  critVal: { fontFamily, fontSize: sizes.label, fontWeight: weights.bold },
  cardTitle: { color: vantage.textPrimary, fontFamily, fontSize: sizes.h3, fontWeight: weights.heavy },
  cardSub: { color: vantage.textMuted, fontFamily, fontSize: sizes.body, marginTop: space.sm, lineHeight: 20 },
  hint: { color: vantage.textMuted, fontFamily, fontSize: sizes.label, marginTop: space.sm },
});

const fieldStyles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', paddingVertical: space.md },
  border: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: vantage.border },
  label: { color: vantage.textPrimary, fontFamily, fontSize: sizes.body },
  hint: { color: vantage.textMuted, fontFamily, fontSize: sizes.micro, marginTop: 2 },
  input: {
    minWidth: 80, textAlign: 'right',
    color: vantage.textPrimary, fontFamily, fontSize: sizes.h3, fontWeight: weights.bold,
    paddingVertical: 0,
  },
});
