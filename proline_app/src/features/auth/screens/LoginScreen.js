import React, { useState, useContext, useEffect, useRef } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Dimensions, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Defs, LinearGradient as SvgLinearGradient, RadialGradient, Stop, Rect } from 'react-native-svg';

import { AuthContext } from '../../../app/providers/AuthContext';
import { Screen, showToast } from '../../../components/vantage';
import { space, sizes, weights, fontFamily, radius } from '../../../theme/vantageTheme';

// Screen-local palette — reference look: pure black canvas + #F04024 accent.
const THEME = '#F04024';
const C = {
  bg:        '#000000',
  inputBg:   '#31302E',
  inputBgFocus: '#3A3936',
  border:    '#3D3C3A',
  borderFocus: THEME,
  textPrimary:   '#FFFFFF',
  textSecondary: '#9A9A9A',
  textMuted:     '#5E5E5E',
};

const { width: WIN_W, height: WIN_H } = Dimensions.get('window');

// Big soft radial blob — sized well beyond the screen so its faded edges never
// reach the canvas bounds (no hard "cut" as it drifts). Square keeps the glow a
// perfect circle.
const BLOOM_D = Math.round(Math.max(WIN_W, WIN_H) * 1.5);
// Horizontal travel of the bloom — a gentle left→right sweep along the bottom.
const BLOOM_TRAVEL = WIN_W * 0.24;

// Full-bleed backdrop: a soft circular orange bloom glowing up from the
// lower-left over a near-black charcoal canvas (matches the reference wallpaper).
// The blob drifts left→right on a smooth ~2.3s loop; the charcoal base fills the
// whole screen so no gaps or white ever show, and the blob is larger than the
// viewport so it is never clipped while moving.
function LoginBackground() {
  // 0 → blob at its left rest position, 1 → shifted right.
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(t, {
          toValue: 1,
          duration: 2300,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(t, {
          toValue: 0,
          duration: 2300,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [t]);

  const translateX = t.interpolate({
    inputRange: [0, 1],
    outputRange: [0, BLOOM_TRAVEL],
  });

  return (
    <View pointerEvents="none" style={styles.bg}>
      {/* Solid charcoal canvas — fills everything so no gaps/white can show. */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0B0B0D' }]} />

      {/* Animated soft circular bloom — drifts left↔right, never clipped. */}
      <Animated.View
        style={{
          position: 'absolute',
          width: BLOOM_D,
          height: BLOOM_D,
          left: -BLOOM_D * 0.34,
          bottom: -BLOOM_D * 0.46,
          transform: [{ translateX }],
        }}
      >
        <Svg width={BLOOM_D} height={BLOOM_D}>
          <Defs>
            {/* Orange bloom, fully faded to transparent before the edge */}
            <RadialGradient id="bgBloom" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#FF7A33" stopOpacity="0.95" />
              <Stop offset="0.18" stopColor={THEME} stopOpacity="0.85" />
              <Stop offset="0.42" stopColor="#9A2D0B" stopOpacity="0.38" />
              <Stop offset="0.7" stopColor="#3A1206" stopOpacity="0.12" />
              <Stop offset="1" stopColor="#0B0B0D" stopOpacity="0" />
            </RadialGradient>
            {/* Soft white core sheen for a modern, glossy highlight */}
            <RadialGradient id="bgSheen" cx="50%" cy="50%" r="30%">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.14" />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width={BLOOM_D} height={BLOOM_D} fill="url(#bgBloom)" />
          <Rect x="0" y="0" width={BLOOM_D} height={BLOOM_D} fill="url(#bgSheen)" />
        </Svg>
      </Animated.View>
    </View>
  );
}

export default function LoginScreen({ navigation }) {
  const { login, demoLogin } = useContext(AuthContext);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [focused, setFocused] = useState(null); // 'email' | 'password' | null
  const [submitting, setSubmitting] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);

  const canSubmit = !!email.trim() && !!password && !submitting && !demoBusy;

  const onSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    const res = await login(email.trim(), password);
    setSubmitting(false);
    if (res.twoFactorRequired) {
      navigation.navigate('TwoFactor', { email: email.trim(), password });
      return;
    }
    if (!res.success) showToast({ kind: 'error', message: res.message || 'Login failed' });
  };

  // One-tap demo sign-in — no email/password needed (matches the web).
  const onDemo = async () => {
    if (submitting || demoBusy) return;
    setDemoBusy(true);
    const res = await demoLogin();
    setDemoBusy(false);
    if (!res.success) showToast({ kind: 'error', message: res.message || 'Demo login failed' });
  };

  return (
    <Screen edges={['top', 'bottom']} glow={false}>
      <LoginBackground />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>Sign in to continue your journey</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <Text style={styles.label}>Email</Text>
            <View style={[styles.inputWrap, focused === 'email' && styles.inputWrapFocus]}>
              <Ionicons name="mail-outline" size={18} color={focused === 'email' ? THEME : C.textMuted} style={styles.leadIcon} />
              <TextInput
                value={email}
                onChangeText={setEmail}
                onFocus={() => setFocused('email')}
                onBlur={() => setFocused(null)}
                placeholder="you@example.com"
                placeholderTextColor={C.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="off"
                importantForAutofill="no"
                style={styles.input}
              />
            </View>

            <Text style={[styles.label, { marginTop: space.lg }]}>Password</Text>
            <View style={[styles.inputWrap, focused === 'password' && styles.inputWrapFocus]}>
              <Ionicons name="lock-closed-outline" size={18} color={focused === 'password' ? THEME : C.textMuted} style={styles.leadIcon} />
              <TextInput
                value={password}
                onChangeText={setPassword}
                onFocus={() => setFocused('password')}
                onBlur={() => setFocused(null)}
                placeholder="••••••••"
                placeholderTextColor={C.textMuted}
                secureTextEntry={!showPwd}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="off"
                importantForAutofill="no"
                style={styles.input}
              />
              <Pressable onPress={() => setShowPwd(!showPwd)} hitSlop={8} accessibilityRole="button" accessibilityLabel={showPwd ? 'Hide password' : 'Show password'} style={styles.eye}>
                <Ionicons name={showPwd ? 'eye-off-outline' : 'eye-outline'} size={20} color={C.textMuted} />
              </Pressable>
            </View>

            <Pressable onPress={() => navigation.navigate('ForgotPassword')} hitSlop={6} style={styles.forgot}>
              <Text style={styles.forgotText}>Forgot password?</Text>
            </Pressable>

            <Pressable
              onPress={onSubmit}
              disabled={!canSubmit}
              accessibilityRole="button"
              accessibilityLabel="Log in"
              style={({ pressed }) => [
                styles.loginBtn,
                { opacity: canSubmit ? (pressed ? 0.88 : 1) : 0.45 },
              ]}
            >
              <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
                <Defs>
                  <SvgLinearGradient id="loginGrad" x1="0" y1="0" x2="1" y2="1">
                    <Stop offset="0" stopColor="#FF6A45" />
                    <Stop offset="0.5" stopColor={THEME} />
                    <Stop offset="1" stopColor="#C9301A" />
                  </SvgLinearGradient>
                </Defs>
                <Rect x="0" y="0" width="100%" height="100%" fill="url(#loginGrad)" />
              </Svg>
              {submitting
                ? <ActivityIndicator color="#FFFFFF" />
                : <Text style={styles.loginText}>Log In</Text>}
            </Pressable>

            {/* One-tap demo sign-in — try the platform with play money, no
                registration. Mirrors the web "Try Demo" button. */}
            <Pressable
              onPress={onDemo}
              disabled={submitting || demoBusy}
              accessibilityRole="button"
              accessibilityLabel="Try demo account"
              style={({ pressed }) => [
                styles.demoBtn,
                { opacity: (submitting || demoBusy) ? 0.55 : (pressed ? 0.85 : 1) },
              ]}
            >
              {demoBusy
                ? <ActivityIndicator color={THEME} />
                : <Text style={styles.demoText}>Try Demo</Text>}
            </Pressable>

            <Pressable onPress={() => navigation.navigate('Signup')} hitSlop={8} style={styles.signupRow}>
              <Text style={[styles.signupMuted, { color: C.textMuted }]}>Don't have an account? </Text>
              <Text style={styles.signupLink}>Sign up</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  bg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  body: { flexGrow: 1, paddingHorizontal: space.xl, paddingTop: space.huge, paddingBottom: space.xl, justifyContent: 'flex-start' },

  header: { marginBottom: space.xxxl, alignItems: 'center' },
  title: { color: C.textPrimary, fontFamily, fontSize: 32, fontWeight: weights.heavy, letterSpacing: -0.5, textAlign: 'center' },
  subtitle: { color: C.textSecondary, fontFamily, fontSize: sizes.body, marginTop: space.sm, textAlign: 'center' },

  form: {},
  label: { color: C.textSecondary, fontFamily, fontSize: sizes.label, marginBottom: space.sm, letterSpacing: 0.3 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.inputBg, borderRadius: radius.pill,
    borderWidth: 1, borderColor: C.border,
    paddingHorizontal: space.lg, minHeight: 56,
  },
  inputWrapFocus: { borderColor: C.borderFocus, backgroundColor: C.inputBgFocus },
  leadIcon: { marginRight: space.sm },
  input: { flex: 1, color: C.textPrimary, fontFamily, fontSize: sizes.body, paddingVertical: space.md },
  eye: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },

  forgot: { alignSelf: 'flex-end', marginTop: space.md },
  forgotText: { color: THEME, fontFamily, fontSize: sizes.label, fontWeight: weights.semibold },

  signupRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: space.xl },
  signupMuted: { fontFamily, fontSize: sizes.body },
  signupLink: { color: THEME, fontFamily, fontSize: sizes.body, fontWeight: weights.bold },

  demoBtn: {
    marginTop: space.md,
    borderRadius: radius.pill,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: THEME,
    backgroundColor: 'transparent',
  },
  demoText: { color: THEME, fontFamily, fontSize: sizes.h3, fontWeight: weights.bold },

  loginBtn: {
    marginTop: space.xxl,
    borderRadius: radius.pill,
    minHeight: 56,
    overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
  },
  loginText: { color: '#FFFFFF', fontFamily, fontSize: sizes.h3, fontWeight: weights.bold },
});
