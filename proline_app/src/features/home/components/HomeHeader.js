import React, { useContext } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import LottieView from 'lottie-react-native';
import { useNavigation } from '@react-navigation/native';

import { AuthContext } from '../../../app/providers/AuthContext';
import { IconButton } from '../../../components/vantage';
import { parseAvatar, renderAvatar } from '../../../utils/avatarRender';
import { vantage, space, sizes, weights, fontFamily } from '../../../theme/vantageTheme';

export default function HomeHeader({ unreadNotifications = 0, accountLabel, onPickAccount, onAddAccount }) {
  const nav = useNavigation();
  const { user } = useContext(AuthContext) || {};
  const av = parseAvatar(user?.avatar);   // reflects the avatar chosen in Profile

  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => nav.navigate('ProfileMenu')}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Open profile menu"
      >
        <View style={styles.avatarWrap}>
          <View style={[styles.avatar, styles.avatarFallback]}>
            {renderAvatar(av, 36)}
          </View>
        </View>
      </Pressable>

      {/* Account picker — sits right of the profile icon. */}
      {onPickAccount ? (
        <Pressable
          onPress={onPickAccount}
          hitSlop={6}
          style={styles.acctChip}
          accessibilityRole="button"
          accessibilityLabel="Switch account"
        >
          <Text style={styles.acctChipTxt} numberOfLines={1}>{accountLabel || 'All accounts'}</Text>
          <Ionicons name="chevron-down" size={14} color={vantage.textSecondary} />
        </Pressable>
      ) : null}
      {onAddAccount ? (
        <Pressable
          onPress={onAddAccount}
          hitSlop={6}
          style={styles.addBtn}
          accessibilityRole="button"
          accessibilityLabel="Add account"
        >
          <Ionicons name="add" size={18} color={vantage.textPrimary} />
        </Pressable>
      ) : null}

      <View style={{ flex: 1 }} />

      {/* No search icon on Home — instrument search lives in the Markets tab,
          which has its own header search. */}
      <IconButton
        icon={<Ionicons name="notifications-outline" size={18} color={vantage.textPrimary} />}
        badgeColor={unreadNotifications > 0 ? vantage.down : undefined}
        accessibilityLabel="Notifications"
        onPress={() => nav.navigate('Notifications')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.md,
    gap: space.xs,
  },
  avatarWrap: { padding: 2 },
  avatar: {
    width: 36, height: 36, borderRadius: 18, overflow: 'hidden',
  },
  avatarFallback: {
    backgroundColor: vantage.bgRaised,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarAnim: { width: 30, height: 30 },

  acctChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginLeft: space.sm,
    backgroundColor: vantage.bgRaised, borderWidth: 1, borderColor: vantage.border,
    borderRadius: 999, paddingHorizontal: space.md, paddingVertical: 6, maxWidth: 180,
  },
  acctChipTxt: { color: vantage.textSecondary, fontFamily, fontSize: sizes.label, fontWeight: weights.semibold, flexShrink: 1 },
  addBtn: {
    width: 32, height: 32, borderRadius: 16, marginLeft: space.xs,
    backgroundColor: vantage.bgRaised, borderWidth: 1, borderColor: vantage.border,
    alignItems: 'center', justifyContent: 'center',
  },
});
