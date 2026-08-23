import React from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { Screen, Card, IconButton } from '../../../components/vantage';
import { vantage, space, sizes, weights, fontFamily } from '../../../theme/vantageTheme';
import { BOTTOM_NAV_PILL_HEIGHT } from '../../../components/vantage/BottomNavPill';

const METHODS = [
  { key: 'crypto', icon: 'link-outline', title: 'Crypto Withdrawal', subtitle: 'TRC20 / BEP20 / ERC20', route: 'WithdrawCrypto' },
  { key: 'manual', icon: 'business-outline', title: 'Manual UPI / Bank', subtitle: 'Admin-reviewed payout', route: 'WithdrawManual' },
];

export default function WithdrawScreen() {
  const nav = useNavigation();
  return (
    <Screen edges={['top']}>
      <View style={styles.header}>
        <IconButton icon={<Ionicons name="chevron-back" size={22} color={vantage.textPrimary} />} accessibilityLabel="Back" onPress={() => nav.goBack()} />
        <Text style={styles.title}>Withdraw</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: BOTTOM_NAV_PILL_HEIGHT + space.huge }}>
        <Text style={styles.label}>Choose withdrawal method</Text>
        {METHODS.map((m) => (
          <Card key={m.key} onPress={() => nav.navigate(m.route)} style={styles.card}>
            <View style={styles.row}>
              <View style={styles.iconWrap}><Ionicons name={m.icon} size={26} color={vantage.accent} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{m.title}</Text>
                <Text style={styles.cardSub}>{m.subtitle}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={vantage.textMuted} />
            </View>
          </Card>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.sm, paddingTop: space.sm, paddingBottom: space.xs },
  title: { flex: 1, color: vantage.textPrimary, fontFamily, fontSize: sizes.h2, fontWeight: weights.heavy, textAlign: 'center' },
  label: { color: vantage.textSecondary, fontFamily, fontSize: sizes.label, marginBottom: space.sm },
  card: { marginBottom: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  iconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: vantage.accentMuted, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { color: vantage.textPrimary, fontFamily, fontSize: sizes.body, fontWeight: weights.bold },
  cardSub: { color: vantage.textMuted, fontFamily, fontSize: sizes.label, marginTop: 2 },
});
