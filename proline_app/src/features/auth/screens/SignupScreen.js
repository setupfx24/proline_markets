import React, { useState, useContext } from 'react';
import { ScrollView, View, Text, TextInput, StyleSheet, Pressable, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AuthContext } from '../../../app/providers/AuthContext';
import { Screen, PillButton, CheckboxRow, showToast } from '../../../components/vantage';
import { vantage, space, sizes, weights, fontFamily, radius } from '../../../theme/vantageTheme';

const COMMON_COUNTRIES = ['India', 'United States', 'United Kingdom', 'Singapore', 'UAE', 'Australia', 'Canada', 'Germany', 'France', 'Other'];

// RegisterRequest.password is Field(min_length=8) — gate on it here so a short
// password is caught before the round-trip instead of coming back as a 422.
const MIN_PASSWORD = 8;

// The wordmark ships in two inks and the active theme is already applied before
// any screen module loads, so the right one is picked once at evaluation time —
// white on the dark theme, brand-dark on the light theme (the single-ink
// wordmark used to vanish against one of the two backgrounds).
const BRAND_LOGO = vantage.isDark
  ? require('../../../../assets/brand/proline-logo-white.png')
  : require('../../../../assets/brand/proline-logo.png');

function pwdStrength(p) {
  if (!p) return { score: 0, label: '—' };
  let s = 0;
  if (p.length >= 8) s += 1;
  if (/[A-Z]/.test(p)) s += 1;
  if (/[0-9]/.test(p)) s += 1;
  if (/[^A-Za-z0-9]/.test(p)) s += 1;
  return { score: s, label: ['Too weak','Weak','Fair','Good','Strong'][s] };
}

export default function SignupScreen({ navigation }) {
  const { registerStart } = useContext(AuthContext);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [country, setCountry] = useState('India');
  const [countryPick, setCountryPick] = useState(false);
  const [referral, setReferral] = useState('');
  const [terms, setTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const strength = pwdStrength(password);

  const onSubmit = async () => {
    if (!email.trim() || password.length < MIN_PASSWORD || !firstName.trim() || !lastName.trim() || !terms) return;

    const cleanEmail = email.trim().toLowerCase();
    const signupData = {
      email: cleanEmail,
      password,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      country,
      ...(referral.trim() ? { referral_code: referral.trim() } : {}),
    };
    setSubmitting(true);
    // Step 1 of the OTP signup: creates the account with email_verified=false
    // and emails a 6-digit code. Login stays blocked until the next screen
    // confirms that code, which is also what logs the user in.
    const res = await registerStart(signupData);
    setSubmitting(false);
    if (!res.success) {
      showToast({ kind: 'error', message: res.message || 'Signup failed' });
      return;
    }
    navigation.navigate('RegisterOtp', { email: cleanEmail, password, signupData });
  };

  return (
    <Screen edges={['top','bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <View style={styles.brandWrap}>
            <Image source={BRAND_LOGO} style={styles.logo} resizeMode="contain" />
            <Text style={styles.tagline}>Create your account</Text>
          </View>

          <Text style={styles.label}>Email</Text>
          <TextInput value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor={vantage.textMuted} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} style={styles.input} />

          <Text style={[styles.label, { marginTop: space.md }]}>Password</Text>
          <View style={styles.pwdRow}>
            <TextInput value={password} onChangeText={setPassword} placeholder="••••••••" placeholderTextColor={vantage.textMuted} secureTextEntry={!showPwd} autoCapitalize="none" autoCorrect={false} style={[styles.input, { flex: 1, marginRight: space.sm }]} />
            <Pressable onPress={() => setShowPwd(!showPwd)} hitSlop={8} style={styles.eye}>
              <Ionicons name={showPwd ? 'eye-off-outline' : 'eye-outline'} size={20} color={vantage.textMuted} />
            </Pressable>
          </View>
          {password ? (
            <View style={styles.strengthRow}>
              {[0,1,2,3].map((i) => (
                <View key={i} style={[styles.strengthBar, { backgroundColor: i < strength.score ? (strength.score < 2 ? vantage.down : strength.score < 4 ? vantage.accent : vantage.up) : vantage.bgPressed }]} />
              ))}
              <Text style={styles.strengthTxt}>{password.length < MIN_PASSWORD ? `Min ${MIN_PASSWORD} characters` : strength.label}</Text>
            </View>
          ) : null}

          {/* Two fields, not one "Full Name" — the backend requires first_name
              AND last_name (both min_length 1), and the web app already asks for
              them separately. Splitting a single field on whitespace both hid
              that requirement until submit and mangled names like "Van Der Berg". */}
          <View style={styles.nameRow}>
            <View style={styles.nameCol}>
              <Text style={[styles.label, { marginTop: space.md }]}>First Name</Text>
              <TextInput value={firstName} onChangeText={setFirstName} placeholder="Hari" placeholderTextColor={vantage.textMuted} autoCapitalize="words" autoCorrect={false} style={styles.input} />
            </View>
            <View style={styles.nameCol}>
              <Text style={[styles.label, { marginTop: space.md }]}>Last Name</Text>
              <TextInput value={lastName} onChangeText={setLastName} placeholder="Sharma" placeholderTextColor={vantage.textMuted} autoCapitalize="words" autoCorrect={false} style={styles.input} />
            </View>
          </View>

          <Text style={[styles.label, { marginTop: space.md }]}>Country</Text>
          <Pressable onPress={() => setCountryPick(!countryPick)} style={styles.input}>
            <Text style={{ color: vantage.textPrimary, fontFamily, fontSize: sizes.body }}>{country}</Text>
          </Pressable>
          {countryPick ? (
            <View style={styles.dropdown}>
              {COMMON_COUNTRIES.map((c) => (
                <Pressable key={c} onPress={() => { setCountry(c); setCountryPick(false); }} style={styles.dropdownRow} android_ripple={{ color: vantage.bgPressed }}>
                  <Text style={{ color: c === country ? vantage.accent : vantage.textPrimary, fontFamily, fontSize: sizes.body }}>{c}</Text>
                  {c === country ? <Ionicons name="checkmark" size={18} color={vantage.accent} /> : null}
                </Pressable>
              ))}
            </View>
          ) : null}

          <Text style={[styles.label, { marginTop: space.md }]}>Referral code <Text style={{ color: vantage.textMuted }}>(optional)</Text></Text>
          <TextInput value={referral} onChangeText={setReferral} placeholder="REF123" placeholderTextColor={vantage.textMuted} autoCapitalize="characters" autoCorrect={false} style={styles.input} />

          <View style={{ marginTop: space.md }}>
            <CheckboxRow label="I agree to Terms & Privacy Policy" checked={terms} onChange={setTerms} />
          </View>

          <PillButton
            label={submitting ? 'Creating…' : 'Create Account'}
            variant="primary"
            size="lg"
            loading={submitting}
            disabled={!email.trim() || password.length < MIN_PASSWORD || !firstName.trim() || !lastName.trim() || !terms || submitting}
            onPress={onSubmit}
            style={{ marginTop: space.xl }}
          />

          <View style={styles.loginRow}>
            <Text style={styles.muted}>Already have an account? </Text>
            <Pressable onPress={() => navigation.navigate('Login')} hitSlop={6}>
              <Text style={styles.link}>Log in</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: space.xl, paddingTop: space.xxl, flexGrow: 1 },
  brandWrap: { alignItems: 'center', marginBottom: space.xl },
  logo: { width: 160, height: 50, marginBottom: space.md },
  tagline: { color: vantage.textMuted, fontFamily, fontSize: sizes.body },
  label: { color: vantage.textSecondary, fontFamily, fontSize: sizes.label, marginBottom: space.xs },
  input: {
    backgroundColor: vantage.bgElevated, borderRadius: radius.md,
    paddingHorizontal: space.md, paddingVertical: space.md,
    color: vantage.textPrimary, fontFamily, fontSize: sizes.body,
  },
  nameRow: { flexDirection: 'row', gap: space.md },
  nameCol: { flex: 1 },
  pwdRow: { flexDirection: 'row', alignItems: 'center' },
  eye: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  strengthRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: space.xs },
  strengthBar: { flex: 1, height: 4, borderRadius: 2 },
  strengthTxt: { color: vantage.textMuted, fontFamily, fontSize: sizes.micro, marginLeft: space.sm },
  dropdown: { backgroundColor: vantage.bgRaised, borderRadius: radius.md, marginTop: space.xs, paddingVertical: space.xs },
  dropdownRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.md, paddingVertical: space.md },
  link: { color: vantage.accent, fontFamily, fontSize: sizes.label, fontWeight: weights.bold },
  muted: { color: vantage.textMuted, fontFamily, fontSize: sizes.body },
  loginRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: space.xl },
});
