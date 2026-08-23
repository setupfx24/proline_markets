import React, { useState } from 'react';
import { ScrollView, View, Text, TextInput, StyleSheet, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import ApiService from '../../../services/api/ApiService';
import logger from '../../../utils/logger';
import { Screen, PillButton, IconButton, showToast } from '../../../components/vantage';
import { vantage, space, sizes, weights, fontFamily, radius } from '../../../theme/vantageTheme';

export default function ForgotPasswordScreen({ navigation }) {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const requestOtp = async () => {
    if (!email.trim()) return;
    setSubmitting(true);
    try {
      await ApiService.request('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim() }),
      });
      showToast({ kind: 'success', message: 'OTP sent to your email' });
      setStep(2);
    } catch (e) {
      logger.error('ForgotPasswordScreen: OTP request failed', e);
      showToast({ kind: 'error', message: e?.message || 'Failed to send OTP' });
    } finally { setSubmitting(false); }
  };

  const resetPassword = async () => {
    if (newPwd !== confirmPwd) return showToast({ kind: 'warn', message: 'Passwords do not match' });
    if (newPwd.length < 8) return showToast({ kind: 'warn', message: 'Password must be 8+ characters' });
    setSubmitting(true);
    try {
      await ApiService.request('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token: otp.trim(), new_password: newPwd }),
      });
      showToast({ kind: 'success', message: 'Password reset. Please log in.' });
      navigation.navigate('Login');
    } catch (e) {
      logger.error('ForgotPasswordScreen: password reset failed', e);
      showToast({ kind: 'error', message: e?.message || 'Reset failed' });
    } finally { setSubmitting(false); }
  };

  return (
    <Screen edges={['top','bottom']}>
      <View style={styles.headerRow}>
        <IconButton icon={<Ionicons name="chevron-back" size={22} color={vantage.textPrimary} />} accessibilityLabel="Back" onPress={() => step === 1 ? navigation.goBack() : setStep(step - 1)} />
        <Text style={styles.title}>Reset Password</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <View style={styles.stepper}>
            {[1,2,3].map((s) => (
              <View key={s} style={[styles.stepDot, s <= step && { backgroundColor: vantage.accent }]} />
            ))}
          </View>

          {step === 1 ? (
            <>
              <Text style={styles.help}>Enter your email and we'll send a one-time code.</Text>
              <Text style={styles.label}>Email</Text>
              <TextInput value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor={vantage.textMuted} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} style={styles.input} />
              <PillButton label={submitting ? 'Sending…' : 'Send Code'} variant="primary" size="lg" loading={submitting} disabled={!email.trim() || submitting} onPress={requestOtp} style={{ marginTop: space.xl }} />
            </>
          ) : step === 2 ? (
            <>
              <Text style={styles.help}>Enter the 6-digit code we sent to {email}.</Text>
              <Text style={styles.label}>Code</Text>
              <TextInput value={otp} onChangeText={setOtp} placeholder="123456" placeholderTextColor={vantage.textMuted} keyboardType="number-pad" maxLength={6} autoCorrect={false} style={[styles.input, styles.codeInput]} />
              <PillButton label="Continue" variant="primary" size="lg" disabled={otp.length < 4} onPress={() => setStep(3)} style={{ marginTop: space.xl }} />
              <Pressable onPress={requestOtp} hitSlop={6} style={{ marginTop: space.md, alignSelf: 'center' }}>
                <Text style={styles.link}>Resend code</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.help}>Choose a new password (8+ characters).</Text>
              <Text style={styles.label}>New Password</Text>
              <TextInput value={newPwd} onChangeText={setNewPwd} placeholder="••••••••" placeholderTextColor={vantage.textMuted} secureTextEntry autoCapitalize="none" autoCorrect={false} style={styles.input} />
              <Text style={[styles.label, { marginTop: space.md }]}>Confirm Password</Text>
              <TextInput value={confirmPwd} onChangeText={setConfirmPwd} placeholder="••••••••" placeholderTextColor={vantage.textMuted} secureTextEntry autoCapitalize="none" autoCorrect={false} style={styles.input} />
              <PillButton label={submitting ? 'Resetting…' : 'Reset Password'} variant="primary" size="lg" loading={submitting} disabled={!newPwd || !confirmPwd || submitting} onPress={resetPassword} style={{ marginTop: space.xl }} />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.sm, paddingTop: space.sm },
  title: { flex: 1, color: vantage.textPrimary, fontFamily, fontSize: sizes.h2, fontWeight: weights.heavy, textAlign: 'center' },
  body: { padding: space.xl, flexGrow: 1 },
  stepper: { flexDirection: 'row', justifyContent: 'center', gap: space.sm, marginBottom: space.xl },
  stepDot: { width: 30, height: 6, borderRadius: 3, backgroundColor: vantage.bgPressed },
  help: { color: vantage.textMuted, fontFamily, fontSize: sizes.body, marginBottom: space.xl, textAlign: 'center' },
  label: { color: vantage.textSecondary, fontFamily, fontSize: sizes.label, marginBottom: space.xs },
  input: {
    backgroundColor: vantage.bgElevated, borderRadius: radius.md,
    paddingHorizontal: space.md, paddingVertical: space.md,
    color: vantage.textPrimary, fontFamily, fontSize: sizes.body,
  },
  codeInput: { textAlign: 'center', letterSpacing: 8, fontSize: sizes.h1, fontWeight: weights.heavy },
  link: { color: vantage.accent, fontFamily, fontSize: sizes.label, fontWeight: weights.bold },
});
