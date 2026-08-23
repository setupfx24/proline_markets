import React, { useState, useContext } from 'react';
import { ScrollView, View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AuthContext } from '../../../app/providers/AuthContext';
import { Screen, PillButton, IconButton, showToast } from '../../../components/vantage';
import { vantage, space, sizes, weights, fontFamily, radius } from '../../../theme/vantageTheme';

export default function TwoFactor({ navigation, route }) {
  const { login } = useContext(AuthContext);
  const { email, password } = route.params || {};
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    if (code.length < 6) return;
    setSubmitting(true);
    const res = await login(email, password, code);
    setSubmitting(false);
    if (!res.success) showToast({ kind: 'error', message: res.message || '2FA verification failed' });
  };

  return (
    <Screen edges={['top','bottom']}>
      <View style={styles.headerRow}>
        <IconButton icon={<Ionicons name="chevron-back" size={22} color={vantage.textPrimary} />} accessibilityLabel="Back" onPress={() => navigation.goBack()} />
        <Text style={styles.title}>Two-Factor</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.body}>
          <View style={styles.iconWrap}>
            <Ionicons name="shield-checkmark" size={56} color={vantage.accent} />
          </View>
          <Text style={styles.help}>Enter the 6-digit code from your authenticator app.</Text>
          <TextInput
            value={code}
            onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
            placeholder="123456"
            placeholderTextColor={vantage.textMuted}
            keyboardType="number-pad"
            maxLength={6}
            autoFocus
            style={[styles.input, styles.codeInput]}
          />
          <PillButton
            label={submitting ? 'Verifying…' : 'Verify'}
            variant="primary"
            size="lg"
            loading={submitting}
            disabled={code.length < 6 || submitting}
            onPress={onSubmit}
            style={{ marginTop: space.xl }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.sm, paddingTop: space.sm },
  title: { flex: 1, color: vantage.textPrimary, fontFamily, fontSize: sizes.h2, fontWeight: weights.heavy, textAlign: 'center' },
  body: { padding: space.xl, flexGrow: 1, alignItems: 'center' },
  iconWrap: { marginTop: space.xl, marginBottom: space.lg },
  help: { color: vantage.textMuted, fontFamily, fontSize: sizes.body, marginBottom: space.xl, textAlign: 'center' },
  input: { width: '100%', backgroundColor: vantage.bgElevated, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.md, color: vantage.textPrimary, fontFamily, fontSize: sizes.body },
  codeInput: { textAlign: 'center', letterSpacing: 8, fontSize: sizes.hero, fontWeight: weights.heavy },
});
