import React, { useState, useContext } from 'react';
import { ScrollView, View, Text, TextInput, StyleSheet, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AuthContext } from '../../../app/providers/AuthContext';
import { Screen, PillButton, IconButton, showToast } from '../../../components/vantage';
import { vantage, space, sizes, weights, fontFamily, radius } from '../../../theme/vantageTheme';

export default function RegisterOtp({ navigation, route }) {
  const { registerVerify, registerResend } = useContext(AuthContext);
  const { email, password } = route.params || {};
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);

  const onVerify = async () => {
    if (code.length < 4) return;
    setSubmitting(true);
    const res = await registerVerify(email, code, password);
    setSubmitting(false);
    // On success the auth state flips and the navigator swaps to the app.
    if (!res.success) showToast({ kind: 'error', message: res.message || 'Verification failed' });
  };

  const onResend = async () => {
    setResending(true);
    const res = await registerResend(email);
    setResending(false);
    showToast({ kind: res.success ? 'success' : 'error', message: res.message });
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.headerRow}>
        <IconButton icon={<Ionicons name="chevron-back" size={22} color={vantage.textPrimary} />} accessibilityLabel="Back" onPress={() => navigation.goBack()} />
        <Text style={styles.title}>Verify Email</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <View style={styles.iconWrap}>
            <Ionicons name="mail-unread-outline" size={56} color={vantage.accent} />
          </View>
          <Text style={styles.help}>
            We sent a verification code to{'\n'}
            <Text style={styles.email}>{email}</Text>
          </Text>
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
            label={submitting ? 'Verifying…' : 'Verify & Continue'}
            variant="primary"
            size="lg"
            loading={submitting}
            disabled={code.length < 4 || submitting}
            onPress={onVerify}
            style={{ marginTop: space.xl }}
          />

          <Pressable onPress={onResend} disabled={resending} hitSlop={8} style={styles.resendWrap}>
            <Text style={styles.resend}>{resending ? 'Resending…' : "Didn't get the code? Resend"}</Text>
          </Pressable>
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
  help: { color: vantage.textMuted, fontFamily, fontSize: sizes.body, marginBottom: space.xl, textAlign: 'center', lineHeight: 22 },
  email: { color: vantage.textPrimary, fontWeight: weights.bold },
  input: { width: '100%', backgroundColor: vantage.bgElevated, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.md, color: vantage.textPrimary, fontFamily, fontSize: sizes.body },
  codeInput: { textAlign: 'center', letterSpacing: 8, fontSize: sizes.hero, fontWeight: weights.heavy },
  resendWrap: { marginTop: space.xl, alignSelf: 'center' },
  resend: { color: vantage.accent, fontFamily, fontSize: sizes.label, fontWeight: weights.bold },
});
