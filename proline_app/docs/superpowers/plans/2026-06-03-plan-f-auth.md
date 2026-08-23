# Plan F — Vantage Redesign: Auth Screens (Phase 6)

> Subagent-driven execution.

**Goal:** Replace PipHigh-era Login / Signup / ForgotPassword with Vantage-styled versions, plus a new 2FA TOTP screen. Wire AuthContext to handle the 2FA challenge response.

**Architecture:** New screens live in `src/screens/auth/`. AuthStack imports from there. AuthContext gains a `totp_code` parameter and surfaces a `2fa_required` flag when the backend asks for one. Old `src/screens/LoginScreen.js` / `SignupScreen.js` / `ForgotPasswordScreen.js` stay on disk (orphaned) and get deleted in Plan H.

**Working directory:** `/Users/tarundewangan/Downloads/Projects/ProlineMarket/ProlineMarket_apk`

**Out of scope (deferred):** Google OAuth (`expo-auth-session` adds 2 deps; backend supports it but we can land later if needed).

---

### File structure

**New:**
- `src/screens/auth/LoginScreen.js`
- `src/screens/auth/SignupScreen.js`
- `src/screens/auth/ForgotPasswordScreen.js`
- `src/screens/auth/TwoFactor.js`

**Modified:**
- `src/context/AuthContext.js` — extend `login()` with optional `totp_code`, return `{ success, twoFactorRequired, message }`
- `src/navigation/AuthStack.js` — point at new files + register `TwoFactor`

---

### Task F1: Extend AuthContext

In `src/context/AuthContext.js`, find the existing `login` method. Replace it with this version that supports an optional `totp_code` and surfaces `2fa_required`:

```js
const login = async (email, password, totpCode = null) => {
  try {
    const body = { email, password };
    if (totpCode) body.totp_code = totpCode;
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    // Backend may signal 2FA via 200 OK with a flag OR via 401 + code.
    if (data?.twofa_required || data?.['2fa_required'] || data?.code === 'twofa_required') {
      return { success: false, twoFactorRequired: true, message: data?.detail || data?.message || 'Two-factor authentication required' };
    }

    if (response.ok && data.access_token) {
      const userInfo = {
        id: data.user_id,
        email,
        role: data.role,
        expires_at: data.expires_at,
      };
      await SecureStore.setItemAsync('token', data.access_token);
      await SecureStore.setItemAsync('user', JSON.stringify(userInfo));
      await SecureStore.setItemAsync('savedEmail', email);
      await SecureStore.setItemAsync('savedPassword', password);
      setToken(data.access_token);
      setUser(userInfo);
      return { success: true };
    }

    return { success: false, message: data.detail || data.message || 'Login failed' };
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, message: 'Network error' };
  }
};
```

The rest of AuthContext is unchanged.

---

### Task F2: LoginScreen

`src/screens/auth/LoginScreen.js`

```js
import React, { useState, useContext } from 'react';
import { ScrollView, View, Text, TextInput, StyleSheet, Pressable, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AuthContext } from '../../context/AuthContext';
import { Screen, PillButton, showToast } from '../../components/vantage';
import { vantage, space, sizes, weights, fontFamily, radius } from '../../theme/vantageTheme';

export default function LoginScreen({ navigation }) {
  const { login } = useContext(AuthContext);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    if (!email.trim() || !password) return;
    setSubmitting(true);
    const res = await login(email.trim(), password);
    setSubmitting(false);
    if (res.twoFactorRequired) {
      navigation.navigate('TwoFactor', { email: email.trim(), password });
      return;
    }
    if (!res.success) showToast({ kind: 'error', message: res.message || 'Login failed' });
  };

  return (
    <Screen edges={['top','bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <View style={styles.brandWrap}>
            <Image source={require('../../../assets/prolinemarket-logo.png')} style={styles.logo} resizeMode="contain" />
            <Text style={styles.tagline}>Trade · Copy · Grow</Text>
          </View>

          <Text style={styles.label}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={vantage.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />

          <Text style={[styles.label, { marginTop: space.md }]}>Password</Text>
          <View style={styles.pwdRow}>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={vantage.textMuted}
              secureTextEntry={!showPwd}
              autoCapitalize="none"
              autoCorrect={false}
              style={[styles.input, { flex: 1, marginRight: space.sm }]}
            />
            <Pressable onPress={() => setShowPwd(!showPwd)} hitSlop={8} accessibilityRole="button" accessibilityLabel={showPwd ? 'Hide password' : 'Show password'} style={styles.eye}>
              <Ionicons name={showPwd ? 'eye-off-outline' : 'eye-outline'} size={20} color={vantage.textMuted} />
            </Pressable>
          </View>

          <Pressable onPress={() => navigation.navigate('ForgotPassword')} hitSlop={6} style={{ alignSelf: 'flex-end', marginTop: space.sm }}>
            <Text style={styles.link}>Forgot password? ›</Text>
          </Pressable>

          <PillButton
            label={submitting ? 'Logging in…' : 'Log In'}
            variant="primary"
            size="lg"
            loading={submitting}
            disabled={!email.trim() || !password || submitting}
            onPress={onSubmit}
            style={{ marginTop: space.xl }}
          />

          <View style={styles.signupRow}>
            <Text style={styles.muted}>Don't have an account? </Text>
            <Pressable onPress={() => navigation.navigate('Signup')} hitSlop={6}>
              <Text style={styles.link}>Sign up</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: space.xl, paddingTop: space.huge, flexGrow: 1 },
  brandWrap: { alignItems: 'center', marginBottom: space.huge },
  logo: { width: 180, height: 60, marginBottom: space.md },
  tagline: { color: vantage.textMuted, fontFamily, fontSize: sizes.body, letterSpacing: 2, textTransform: 'uppercase' },
  label: { color: vantage.textSecondary, fontFamily, fontSize: sizes.label, marginBottom: space.xs },
  input: {
    backgroundColor: vantage.bgElevated, borderRadius: radius.md,
    paddingHorizontal: space.md, paddingVertical: space.md,
    color: vantage.textPrimary, fontFamily, fontSize: sizes.body,
  },
  pwdRow: { flexDirection: 'row', alignItems: 'center' },
  eye: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  link: { color: vantage.accent, fontFamily, fontSize: sizes.label, fontWeight: weights.bold },
  muted: { color: vantage.textMuted, fontFamily, fontSize: sizes.body },
  signupRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: space.xl },
});
```

---

### Task F3: SignupScreen

`src/screens/auth/SignupScreen.js`

```js
import React, { useState, useContext } from 'react';
import { ScrollView, View, Text, TextInput, StyleSheet, Pressable, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AuthContext } from '../../context/AuthContext';
import { Screen, PillButton, CheckboxRow, showToast } from '../../components/vantage';
import { vantage, space, sizes, weights, fontFamily, radius } from '../../theme/vantageTheme';

const COMMON_COUNTRIES = ['India', 'United States', 'United Kingdom', 'Singapore', 'UAE', 'Australia', 'Canada', 'Germany', 'France', 'Other'];

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
  const { signup } = useContext(AuthContext);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [fullName, setFullName] = useState('');
  const [country, setCountry] = useState('India');
  const [countryPick, setCountryPick] = useState(false);
  const [referral, setReferral] = useState('');
  const [terms, setTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const strength = pwdStrength(password);

  const onSubmit = async () => {
    if (!email.trim() || !password || !fullName.trim() || !terms) return;
    setSubmitting(true);
    const res = await signup({
      email: email.trim(),
      password,
      full_name: fullName.trim(),
      country,
      ...(referral.trim() ? { referral_code: referral.trim() } : {}),
    });
    setSubmitting(false);
    if (!res.success) showToast({ kind: 'error', message: res.message || 'Signup failed' });
  };

  return (
    <Screen edges={['top','bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <View style={styles.brandWrap}>
            <Image source={require('../../../assets/prolinemarket-logo.png')} style={styles.logo} resizeMode="contain" />
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
              <Text style={styles.strengthTxt}>{strength.label}</Text>
            </View>
          ) : null}

          <Text style={[styles.label, { marginTop: space.md }]}>Full Name</Text>
          <TextInput value={fullName} onChangeText={setFullName} placeholder="Your full name" placeholderTextColor={vantage.textMuted} autoCapitalize="words" style={styles.input} />

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
            disabled={!email.trim() || !password || !fullName.trim() || !terms || submitting}
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
```

---

### Task F4: ForgotPasswordScreen

`src/screens/auth/ForgotPasswordScreen.js`

```js
import React, { useState } from 'react';
import { ScrollView, View, Text, TextInput, StyleSheet, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { API_URL } from '../../config';
import { Screen, PillButton, IconButton, showToast } from '../../components/vantage';
import { vantage, space, sizes, weights, fontFamily, radius } from '../../theme/vantageTheme';

export default function ForgotPasswordScreen({ navigation }) {
  const [step, setStep] = useState(1); // 1 = email, 2 = OTP, 3 = new password
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const requestOtp = async () => {
    if (!email.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.detail || data?.message || 'Failed to send OTP');
      }
      showToast({ kind: 'success', message: 'OTP sent to your email' });
      setStep(2);
    } catch (e) {
      showToast({ kind: 'error', message: e?.message || 'Failed to send OTP' });
    } finally { setSubmitting(false); }
  };

  const resetPassword = async () => {
    if (newPwd !== confirmPwd) return showToast({ kind: 'warn', message: 'Passwords do not match' });
    if (newPwd.length < 8) return showToast({ kind: 'warn', message: 'Password must be 8+ characters' });
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), otp: otp.trim(), new_password: newPwd }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.detail || data?.message || 'Reset failed');
      }
      showToast({ kind: 'success', message: 'Password reset. Please log in.' });
      navigation.navigate('Login');
    } catch (e) {
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
```

---

### Task F5: TwoFactor

`src/screens/auth/TwoFactor.js`

```js
import React, { useState, useContext } from 'react';
import { ScrollView, View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AuthContext } from '../../context/AuthContext';
import { Screen, PillButton, IconButton, showToast } from '../../components/vantage';
import { vantage, space, sizes, weights, fontFamily, radius } from '../../theme/vantageTheme';

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
```

---

### Task F6: Update AuthStack

`src/navigation/AuthStack.js`

```js
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '../screens/auth/LoginScreen';
import SignupScreen from '../screens/auth/SignupScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import TwoFactor from '../screens/auth/TwoFactor';

const Stack = createNativeStackNavigator();

export default function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#000' } }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="TwoFactor" component={TwoFactor} />
    </Stack.Navigator>
  );
}
```

---

### Smoke test

- Log out (or clear app data) → Login screen shows Vantage wordmark + email + password (eye toggle) + Forgot link + big orange Log In + Sign up link.
- Tap Forgot → 3-step flow (email → OTP → new password) with progress dots.
- Tap Sign up → form with email + password (strength bar) + name + country dropdown + referral + ToS checkbox + Create Account.
- After successful Login (no 2FA) → MainTabs.
- If a 2FA-enabled account logs in → navigates to TwoFactor screen → enter TOTP → if backend accepts, lands in MainTabs.
