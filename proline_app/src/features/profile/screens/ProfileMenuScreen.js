import React, { useContext, useState, useCallback, useRef, useEffect } from 'react';
import { ScrollView, View, Text, StyleSheet, Pressable, PanResponder, Image, Modal, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import LottieView from 'lottie-react-native';
import * as Updates from 'expo-updates';
import * as ImagePicker from 'expo-image-picker';
import * as SecureStore from 'expo-secure-store';
// Legacy API (documentDirectory / writeAsStringAsync) — the SDK 54 default
// export of expo-file-system is the new class-based API.
import * as FileSystem from 'expo-file-system/legacy';
import { useNavigation, useFocusEffect } from '@react-navigation/native';

const APP_VERSION = Updates.runtimeVersion || '1.0.0';
const AVATAR_KEY = 'profileAvatar';

import { AuthContext } from '../../../app/providers/AuthContext';
import { useTheme } from '../../../app/providers/ThemeContext';
import { Screen, Card, MenuRow, PillButton, showToast } from '../../../components/vantage';
import { BOTTOM_NAV_PILL_HEIGHT } from '../../../components/vantage/BottomNavPill';
import { fetchKycStatus, isKycApproved, kycStatusLabel } from '../../../utils/kycGate';
import { vantage, space, sizes, weights, fontFamily, radius } from '../../../theme/vantageTheme';
import {
  getBiometricSupport,
  isBiometricEnabled,
  setBiometricEnabledFlag,
  authenticate,
} from '../../../services/auth/biometricLock';
import ApiService from '../../../services/api/ApiService';
import { LOTTIE_AVATARS, ICON_AVATARS, parseAvatar, renderAvatar } from '../../../utils/avatarRender';
import { requestTourReplay } from '../../../components/onboarding/tourStorage';

export default function ProfileMenuScreen() {
  const nav = useNavigation();
  const { user, logout, updateUser } = useContext(AuthContext) || {};
  const { isDark, setTheme } = useTheme();

  // The stored `user` object has no kyc_status — pull the live status from /profile.
  const [kycStatus, setKycStatus] = useState(user?.kyc_status || null);

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    (async () => {
      const s = await fetchKycStatus();
      // 'unknown' = the status fetch failed (offline / server error). Keep the
      // last known status instead of downgrading the badge; only show the
      // "Status unavailable" label when we never learned a real status.
      if (!cancelled) setKycStatus((prev) => (s === 'unknown' && prev ? prev : s));
    })();
    return () => { cancelled = true; };
  }, []));

  const kycApproved = isKycApproved(kycStatus);

  // ── App Lock (biometrics) ──────────────────────────────────────────────────
  const [bioEnabled, setBioEnabled] = useState(false);
  const [bioSupport, setBioSupport] = useState({ available: false, hasHardware: false, label: 'Biometrics' });
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sup = await getBiometricSupport();
      const on = await isBiometricEnabled();
      if (cancelled) return;
      setBioSupport(sup);
      setBioEnabled(on);
    })();
    return () => { cancelled = true; };
  }, []);

  const toggleBiometric = useCallback(async (next) => {
    if (next) {
      if (!bioSupport.available) {
        showToast({
          kind: 'warn',
          message: bioSupport.hasHardware
            ? 'No fingerprint/face enrolled — set it up in device settings first.'
            : 'This device has no biometric sensor.',
        });
        return;
      }
      const ok = await authenticate('Confirm to enable App Lock');
      if (!ok) { showToast({ kind: 'error', message: 'Authentication failed' }); return; }
      await setBiometricEnabledFlag(true);
      setBioEnabled(true);
      showToast({ kind: 'success', message: 'App Lock enabled with biometrics' });
    } else {
      const ok = await authenticate('Confirm to disable App Lock');
      if (!ok) { showToast({ kind: 'error', message: 'Authentication failed' }); return; }
      await setBiometricEnabledFlag(false);
      setBioEnabled(false);
      showToast({ kind: 'info', message: 'App Lock disabled' });
    }
  }, [bioSupport]);

  // Profile avatar — user can set a photo or pick a preset; defaults to the
  // existing animation.
  const [avatar, setAvatar] = useState(() => parseAvatar(user?.avatar));
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  // Load from the user object first (synced from DB), then a local cache, then
  // pull the latest from the server so it stays in sync across devices.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (user?.avatar) { setAvatar(parseAvatar(user.avatar)); }
      else {
        try { const raw = await SecureStore.getItemAsync(AVATAR_KEY); if (raw && !cancelled) setAvatar(parseAvatar(raw)); } catch {}
      }
      try {
        const prof = await ApiService.getProfile();
        if (!cancelled && prof && 'avatar' in prof) {
          setAvatar(parseAvatar(prof.avatar));
          // Sync the stored user record only for small values — a photo
          // data-URI from the server would blow SecureStore's ~2KB cap (the
          // display above already shows it; it's re-fetched each mount).
          const small = prof.avatar == null || String(prof.avatar).length < 1500;
          if (user && prof.avatar !== user.avatar && small) updateUser?.({ ...user, avatar: prof.avatar });
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [user?.avatar]);

  const saveAvatar = useCallback(async (av) => {
    setAvatar(av);
    setAvatarPickerOpen(false);
    const raw = JSON.stringify(av);
    // Local persistence: Android SecureStore values are capped (~2KB), so a
    // base64 photo data-URI silently failed to save. Write the photo bytes to
    // a file under documentDirectory and keep only the tiny file-URI JSON in
    // SecureStore. (This also migrates any legacy data-URI value on the next
    // save — the old value keeps displaying until then.)
    let localAv = av;
    try {
      if (av?.type === 'photo' && typeof av.value === 'string' && av.value.startsWith('data:')) {
        const base64 = av.value.slice(av.value.indexOf(',') + 1);
        const fileUri = `${FileSystem.documentDirectory}profileAvatar.jpg`;
        await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: FileSystem.EncodingType.Base64 });
        localAv = { ...av, value: fileUri };
      }
      await SecureStore.setItemAsync(AVATAR_KEY, JSON.stringify(localAv));
    } catch {}
    // Reflect in the home header instantly — use the small file-URI variant so
    // the stored `user` record also stays under the SecureStore size cap.
    if (user) updateUser?.({ ...user, avatar: JSON.stringify(localAv) });
    try { await ApiService.updateProfile({ avatar: raw }); } // persist to DB (data-URI syncs across devices)
    catch (e) { showToast({ kind: 'warn', message: 'Saved on device; server sync failed' }); }
  }, [user, updateUser]);

  const pickPhoto = useCallback(async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { showToast({ kind: 'warn', message: 'Gallery permission chahiye' }); return; }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true, aspect: [1, 1], quality: 0.4, base64: true,
      });
      if (!res.canceled && res.assets?.[0]) {
        const a = res.assets[0];
        // Store as a data-URI so it persists in the DB and syncs across devices.
        const value = a.base64 ? `data:image/jpeg;base64,${a.base64}` : a.uri;
        saveAvatar({ type: 'photo', value });
      }
    } catch (e) {
      showToast({ kind: 'error', message: `Photo select fail: ${e?.message || ''}` });
    }
  }, [saveAvatar]);

  // OTA / version update check via expo-updates.
  const [checking, setChecking] = useState(false);
  const checkForUpdate = useCallback(async () => {
    if (checking) return;
    // Only block in a true JS-dev session (Expo Go / dev-client metro). In a
    // real release build (preview/production) we always attempt the check —
    // don't gate on Updates.isEnabled, which can read false and wrongly show
    // the "disabled" message even in a proper build.
    if (__DEV__) {
      showToast({ kind: 'info', message: 'Updates are disabled in dev mode — works in the installed build.' });
      return;
    }
    setChecking(true);
    try {
      const res = await Updates.checkForUpdateAsync();
      if (res.isAvailable) {
        showToast({ kind: 'info', message: 'Update found — downloading…' });
        await Updates.fetchUpdateAsync();
        showToast({ kind: 'success', message: 'Update ready — restarting…' });
        setTimeout(() => { Updates.reloadAsync().catch(() => {}); }, 900);
      } else {
        showToast({ kind: 'success', message: 'You’re on the latest version ✓' });
      }
    } catch (e) {
      showToast({ kind: 'error', message: `Update check failed: ${e?.message || 'updates not enabled in this build'}` });
    } finally {
      setChecking(false);
    }
  }, [checking]);

  // Swipe left to close the drawer (it slides in from the left). Only claims
  // the gesture on a clear leftward horizontal drag so vertical scrolling is
  // unaffected.
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dx < -18 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderRelease: (_, g) => { if (g.dx < -55) nav.goBack(); },
    })
  ).current;

  return (
    <Screen edges={['top']}>
      <View style={{ flex: 1 }} {...panResponder.panHandlers}>
      <ScrollView contentContainerStyle={{ paddingBottom: BOTTOM_NAV_PILL_HEIGHT + space.huge }}>
        <View style={styles.backRow}>
          <Pressable onPress={() => nav.goBack()} hitSlop={8} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Back">
            <Ionicons name="chevron-back" size={24} color={vantage.textPrimary} />
          </Pressable>
        </View>
        {/* Profile header */}
        <View style={styles.profileHeader}>
          <Pressable onPress={() => setAvatarPickerOpen(true)} accessibilityRole="button" accessibilityLabel="Change profile picture">
            <View style={styles.avatar}>
              {renderAvatar(avatar, 56)}
            </View>
            <View style={styles.avatarEditBadge}>
              <Ionicons name="camera" size={11} color="#fff" />
            </View>
          </Pressable>
          <View style={{ flex: 1, marginLeft: space.md }}>
            <Text style={styles.name}>{user?.full_name || user?.email || 'Account'}</Text>
            <Text style={styles.email}>{user?.email || ''}</Text>
            {kycApproved ? (
              <View style={[styles.badge, { backgroundColor: 'rgba(34,197,94,0.15)' }]}>
                <Ionicons name="shield-checkmark" size={12} color={vantage.up} />
                <Text style={[styles.badgeTxt, { color: vantage.up }]}>KYC Verified</Text>
              </View>
            ) : (
              <View style={[styles.badge, { backgroundColor: vantage.accentMuted }]}>
                <Ionicons name="alert-circle-outline" size={12} color={vantage.accent} />
                <Text style={[styles.badgeTxt, { color: vantage.accent }]}>{kycStatusLabel(kycStatus)}</Text>
              </View>
            )}
          </View>
        </View>

        <Section title="ACCOUNTS">
          <MenuRow icon={<Ionicons name="card-outline" size={18} color={vantage.textPrimary} />} label="My Accounts" onPress={() => nav.navigate('Accounts')} />
          <MenuRow icon={<Ionicons name="trending-up-outline" size={18} color={vantage.textPrimary} />} label="Portfolio" onPress={() => nav.navigate('Portfolio')} />
        </Section>

        <Section title="VERIFICATION">
          <MenuRow icon={<Ionicons name="shield-checkmark-outline" size={18} color={vantage.up} />} label="KYC" value={kycStatusLabel(kycStatus)} onPress={() => nav.navigate('Kyc')} />
        </Section>

        <Section title="PROGRAMS">
          <MenuRow icon={<Ionicons name="briefcase-outline" size={18} color={vantage.textPrimary} />} label="Business / Sub-Broker" onPress={() => nav.navigate('Business')} />
          <MenuRow icon={<Ionicons name="bar-chart-outline" size={18} color={vantage.textPrimary} />} label="PAMM Investments" onPress={() => nav.navigate('Pamm')} />
        </Section>

        <Section title="TOOLS">
          <MenuRow icon={<Ionicons name="school-outline" size={18} color={vantage.textPrimary} />} label="Academy" onPress={() => nav.navigate('Academy')} />
          <MenuRow icon={<Ionicons name="calculator-outline" size={18} color={vantage.textPrimary} />} label="Risk Calculator" onPress={() => nav.navigate('RiskCalculator')} />
          <MenuRow icon={<Ionicons name="calendar-outline" size={18} color={vantage.textPrimary} />} label="Economic Calendar" onPress={() => nav.navigate('EconomicCalendar')} />
          <MenuRow icon={<Ionicons name="hardware-chip-outline" size={18} color={vantage.textPrimary} />} label="Algo Connector" onPress={() => nav.navigate('AlgoConnector')} />
          {/* One source of truth for orders/history: the Trade tab (live,
              paginated, on-brand). The old Order Book screen duplicated it. */}
          <MenuRow icon={<Ionicons name="book-outline" size={18} color={vantage.textPrimary} />} label="Order History" onPress={() => nav.navigate('TradeTab')} />
        </Section>

        <Section title="APPEARANCE">
          <View style={styles.appearanceRow}>
            <View style={styles.appearanceLabel}>
              <Ionicons name={isDark ? 'moon' : 'sunny'} size={18} color={vantage.accent} />
              <Text style={styles.appearanceTxt}>Theme</Text>
            </View>
            <View style={styles.segment}>
              <Pressable
                onPress={() => { if (isDark) setTheme('light'); }}
                style={[styles.segmentBtn, !isDark && styles.segmentBtnActive]}
                accessibilityRole="button"
                accessibilityLabel="Light theme"
              >
                <Ionicons name="sunny-outline" size={14} color={!isDark ? vantage.textInverse : vantage.textSecondary} />
                <Text style={[styles.segmentTxt, !isDark && styles.segmentTxtActive]}>Light</Text>
              </Pressable>
              <Pressable
                onPress={() => { if (!isDark) setTheme('dark'); }}
                style={[styles.segmentBtn, isDark && styles.segmentBtnActive]}
                accessibilityRole="button"
                accessibilityLabel="Dark theme"
              >
                <Ionicons name="moon-outline" size={14} color={isDark ? vantage.textInverse : vantage.textSecondary} />
                <Text style={[styles.segmentTxt, isDark && styles.segmentTxtActive]}>Dark</Text>
              </Pressable>
            </View>
          </View>
        </Section>

        <Section title="SECURITY">
          <View style={styles.appearanceRow}>
            <View style={styles.appearanceLabel}>
              <Ionicons name={bioSupport.label === 'Face ID' ? 'scan-outline' : 'finger-print'} size={18} color={vantage.accent} />
              <View>
                <Text style={styles.appearanceTxt}>App Lock</Text>
                <Text style={styles.securitySub}>
                  {bioSupport.available ? 'Unlock with biometrics' : 'Set up biometrics in device settings'}
                </Text>
              </View>
            </View>
            <Switch
              value={bioEnabled}
              onValueChange={toggleBiometric}
              trackColor={{ false: vantage.bgRaised, true: vantage.accent }}
              thumbColor="#fff"
            />
          </View>
        </Section>

        <Section title="HELP">
          <MenuRow icon={<Ionicons name="chatbubble-outline" size={18} color={vantage.textPrimary} />} label="Support" onPress={() => nav.navigate('Support')} />
          <MenuRow icon={<Ionicons name="notifications-outline" size={18} color={vantage.textPrimary} />} label="Notifications" onPress={() => nav.navigate('Notifications')} />
          <MenuRow icon={<Ionicons name="book-outline" size={18} color={vantage.textPrimary} />} label="How to use" onPress={() => nav.navigate('Instructions')} />
          <MenuRow
            icon={<Ionicons name="map-outline" size={18} color={vantage.textPrimary} />}
            label="App Tour"
            onPress={() => {
              // Pop back to the dashboard so the tour plays over the shell,
              // then ask the tour host (MainTabs) to start immediately.
              nav.navigate('Home');
              requestTourReplay();
            }}
          />
        </Section>

        <Section title="ABOUT">
          <MenuRow
            icon={<Ionicons name={checking ? 'sync' : 'cloud-download-outline'} size={18} color={vantage.accent} />}
            label={checking ? 'Checking for update…' : 'Check for update'}
            value={`v${APP_VERSION}`}
            onPress={checkForUpdate}
          />
        </Section>

        <View style={{ padding: space.lg, marginTop: space.lg }}>
          <PillButton
            label="Log Out"
            variant="danger"
            size="md"
            onPress={async () => {
              await logout?.();
              showToast({ kind: 'info', message: 'Logged out' });
            }}
          />
        </View>
      </ScrollView>
      </View>

      <Modal visible={avatarPickerOpen} transparent animationType="fade" onRequestClose={() => setAvatarPickerOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setAvatarPickerOpen(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Profile picture</Text>

            <Pressable onPress={pickPhoto} style={styles.photoBtn}>
              <Ionicons name="image-outline" size={18} color="#fff" />
              <Text style={styles.photoBtnTxt}>Choose photo from gallery</Text>
            </Pressable>

            <Text style={styles.modalSub}>Or pick an avatar</Text>
            <View style={styles.avatarGrid}>
              {Object.keys(LOTTIE_AVATARS).map((k) => (
                <Pressable key={k} onPress={() => saveAvatar({ type: 'lottie', value: k })} style={styles.gridItem}>
                  <LottieView source={LOTTIE_AVATARS[k]} autoPlay loop style={{ width: 46, height: 46 }} />
                </Pressable>
              ))}
              {ICON_AVATARS.map((ic) => (
                <Pressable key={ic.key} onPress={() => saveAvatar({ type: 'icon', value: { name: ic.name, color: ic.color } })} style={[styles.gridItem, { backgroundColor: ic.color }]}>
                  <Ionicons name={ic.name} size={26} color="#fff" />
                </Pressable>
              ))}
            </View>

            <Pressable onPress={() => saveAvatar({ type: 'default' })} style={styles.resetBtn}>
              <Ionicons name="refresh-outline" size={15} color={vantage.textMuted} />
              <Text style={styles.resetTxt}>Reset to default</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

function Section({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Card padding={0}>
        {children}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  backRow: { paddingHorizontal: space.sm, paddingTop: space.sm },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  profileHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: space.lg, paddingVertical: space.lg,
    gap: space.md,
  },
  avatar: {
    width: 56, height: 56, borderRadius: 28, overflow: 'hidden',
    backgroundColor: vantage.bgRaised,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarAnim: { width: 48, height: 48 },
  avatarEditBadge: {
    position: 'absolute', right: -2, bottom: -2, width: 20, height: 20, borderRadius: 10,
    backgroundColor: vantage.accent, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: vantage.bg,
  },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: space.lg },
  modalCard: { width: '100%', maxWidth: 360, backgroundColor: vantage.bgRaised, borderRadius: radius.lg, borderWidth: 1, borderColor: vantage.border, padding: space.lg },
  modalTitle: { color: vantage.textPrimary, fontFamily, fontSize: sizes.h3, fontWeight: weights.heavy, marginBottom: space.md },
  photoBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, backgroundColor: vantage.accent, borderRadius: radius.md, paddingVertical: 13 },
  photoBtnTxt: { color: '#fff', fontFamily, fontSize: sizes.body, fontWeight: weights.bold },
  modalSub: { color: vantage.textMuted, fontFamily, fontSize: sizes.label, fontWeight: weights.semibold, marginTop: space.lg, marginBottom: space.sm },
  avatarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  gridItem: { width: 56, height: 56, borderRadius: 28, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: vantage.bgRaisedHover || vantage.bgRaised, borderWidth: 1, borderColor: vantage.border },
  resetBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: space.lg, paddingVertical: 10 },
  resetTxt: { color: vantage.textMuted, fontFamily, fontSize: sizes.label, fontWeight: weights.semibold },
  name: { color: vantage.textPrimary, fontFamily, fontSize: sizes.h2, fontWeight: weights.heavy },
  email: { color: vantage.textMuted, fontFamily, fontSize: sizes.label, marginTop: 2 },
  badge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: 6, marginTop: space.sm },
  badgeTxt: { fontFamily, fontSize: sizes.micro, fontWeight: weights.heavy },
  appearanceRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: space.lg, paddingVertical: space.md,
  },
  appearanceLabel: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  appearanceTxt: { color: vantage.textPrimary, fontFamily, fontSize: sizes.body, fontWeight: weights.semibold },
  securitySub: { color: vantage.textMuted, fontFamily, fontSize: sizes.micro, marginTop: 1 },
  segment: {
    flexDirection: 'row', backgroundColor: vantage.bgRaised,
    borderRadius: radius.pill, padding: 3, gap: 2,
  },
  segmentBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: space.md, paddingVertical: 6, borderRadius: radius.pill,
  },
  segmentBtnActive: { backgroundColor: vantage.accent },
  segmentTxt: { color: vantage.textSecondary, fontFamily, fontSize: sizes.label, fontWeight: weights.semibold },
  segmentTxtActive: { color: vantage.textInverse },
  section: { paddingHorizontal: space.lg, marginTop: space.lg },
  sectionTitle: {
    color: vantage.textSecondary, fontFamily, fontSize: sizes.label,
    fontWeight: weights.semibold, textTransform: 'uppercase', letterSpacing: 1,
    marginBottom: space.sm,
  },
});
