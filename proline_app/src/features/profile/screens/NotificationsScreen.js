import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import {
  ChevronLeft, CheckCheck, Bell, BellOff, TrendingUp, CheckCircle2,
  AlertCircle, Trophy, Clock, Zap, Wallet, ArrowDownCircle, Copy,
  ShieldCheck, LifeBuoy,
} from 'lucide-react-native';

import { Screen } from '../../../components/vantage';
import { BOTTOM_NAV_PILL_HEIGHT } from '../../../components/vantage/BottomNavPill';
import { vantage, space, sizes, weights, fontFamily, radius } from '../../../theme/vantageTheme';
import ApiService from '../../../services/api/ApiService';
import logger from '../../../utils/logger';

// Map a notification type (backend lowercase or legacy uppercase) to a lucide
// icon + accent colour.
function iconFor(type) {
  const t = String(type || '').toLowerCase();
  if (t.includes('deposit')) return { C: Wallet, color: vantage.up };
  if (t.includes('withdraw')) return { C: ArrowDownCircle, color: vantage.accent };
  if (t.includes('sl') || t.includes('stop')) return { C: AlertCircle, color: vantage.down };
  if (t.includes('tp') || t.includes('take_profit') || t.includes('profit')) return { C: Trophy, color: vantage.up };
  if (t.includes('close')) return { C: CheckCircle2, color: vantage.up };
  if (t.includes('pending') || t.includes('order')) return { C: Clock, color: vantage.accent };
  if (t.includes('open') || t.includes('trade')) return { C: TrendingUp, color: vantage.accent };
  if (t.includes('triggered') || t.includes('flash')) return { C: Zap, color: vantage.accent };
  if (t.includes('copy')) return { C: Copy, color: vantage.accent };
  if (t.includes('kyc') || t.includes('security')) return { C: ShieldCheck, color: vantage.up };
  if (t.includes('support') || t.includes('ticket')) return { C: LifeBuoy, color: vantage.accent };
  return { C: Bell, color: vantage.textSecondary };
}

function withAlpha(hex, a) {
  return `${hex}${a}`;
}

export default function NotificationsScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => { fetchNotifications(); }, []);

  const fetchNotifications = async () => {
    try {
      const data = await ApiService.request('/notifications');
      const notifs = data.items || data.notifications || [];
      const mapped = notifs.map((n) => ({
        ...n,
        _id: n.id || n._id,
        createdAt: n.created_at || n.createdAt,
        read: n.is_read || n.read || false,
      }));
      setNotifications(mapped);
    } catch (e) {
      logger.error('NotificationsScreen: notifications fetch failed', e);
      setNotifications([]);
    }
    setLoading(false);
    setRefreshing(false);
  };

  const onRefresh = () => { setRefreshing(true); fetchNotifications(); };

  const markAsRead = async (id) => {
    try {
      await ApiService.markNotificationRead(id);
    } catch (e) { logger.error('NotificationsScreen: mark read failed', e); }
    setNotifications((prev) => prev.map((n) => (n._id === id ? { ...n, read: true } : n)));
  };

  const markAllAsRead = async () => {
    try {
      await ApiService.request('/notifications/read-all', { method: 'PUT' });
    } catch (e) { logger.error('NotificationsScreen: mark all read failed', e); }
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  // action_url / type → in-app destination.
  const routeNotification = (notif) => {
    const url = String(notif.action_url || notif.actionUrl || '').toLowerCase();
    const type = String(notif.type || '').toLowerCase();
    try {
      if (url.includes('kyc') || type.includes('kyc')) return navigation.navigate('Kyc');
      if (url.includes('wallet') || url.includes('deposit') || url.includes('withdraw') || type.includes('deposit') || type.includes('withdraw')) return navigation.navigate('FundsTab', { screen: 'Funds' });
      if (url.includes('portfolio')) return navigation.navigate('Portfolio');
      if (url.includes('support') || type.includes('support') || type.includes('ticket')) return navigation.navigate('Support');
      if (url.includes('account')) return navigation.navigate('Accounts');
      if (type.includes('trade') || type.includes('order') || type.includes('position') || type.includes('copy') || type.includes('stop') || type.includes('profit') || type.includes('pending')) return navigation.navigate('TradeTab', { screen: 'Trade' });
    } catch (_) {}
  };

  const onPressNotif = (n) => {
    if (!n.read) markAsRead(n._id);
    routeNotification(n);
  };

  const grouped = groupByDate(notifications);
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <Screen edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={styles.iconBtn} accessibilityLabel="Back">
          <ChevronLeft size={24} color={vantage.textPrimary} />
        </Pressable>
        <Text style={styles.title}>Notifications</Text>
        {unreadCount > 0 ? (
          <Pressable onPress={markAllAsRead} hitSlop={8} style={styles.markAll} accessibilityLabel="Mark all read">
            <CheckCheck size={16} color={vantage.accent} />
            <Text style={styles.markAllTxt}>Read all</Text>
          </Pressable>
        ) : (
          <View style={{ width: 80 }} />
        )}
      </View>

      {unreadCount > 0 ? (
        <View style={styles.banner}>
          <View style={styles.dot} />
          <Text style={styles.bannerTxt}>{unreadCount} unread notification{unreadCount > 1 ? 's' : ''}</Text>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={vantage.accent} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: BOTTOM_NAV_PILL_HEIGHT + space.huge }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={vantage.accent} colors={[vantage.accent]} />}
          showsVerticalScrollIndicator={false}
        >
          {notifications.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}><BellOff size={40} color={vantage.textMuted} /></View>
              <Text style={styles.emptyTitle}>No notifications</Text>
              <Text style={styles.emptyTxt}>You're all caught up. New alerts will show up here.</Text>
            </View>
          ) : (
            grouped.map(([label, items]) => (
              <View key={label} style={styles.group}>
                <Text style={styles.groupLabel}>{label}</Text>
                {items.map((n) => {
                  const { C, color } = iconFor(n.type);
                  return (
                    <Pressable
                      key={n._id}
                      onPress={() => onPressNotif(n)}
                      style={[styles.card, !n.read && styles.cardUnread]}
                      android_ripple={{ color: vantage.bgPressed }}
                    >
                      {!n.read ? <View style={styles.unreadBar} /> : null}
                      <View style={[styles.iconWrap, { backgroundColor: withAlpha(color, '22') }]}>
                        <C size={20} color={color} />
                      </View>
                      <View style={styles.body}>
                        <View style={styles.titleRow}>
                          <Text style={styles.notifTitle} numberOfLines={1}>{n.title}</Text>
                          <Text style={styles.time}>{formatTime(n.createdAt)}</Text>
                        </View>
                        <Text style={styles.message}>{n.message}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ))
          )}
        </ScrollView>
      )}
    </Screen>
  );
}

function groupByDate(notifs) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yest = new Date(today); yest.setDate(yest.getDate() - 1);
  const map = new Map();
  for (const n of notifs) {
    const d = new Date(n.createdAt); d.setHours(0, 0, 0, 0);
    let key;
    if (d.getTime() === today.getTime()) key = 'Today';
    else if (d.getTime() === yest.getTime()) key = 'Yesterday';
    else key = new Date(n.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(n);
  }
  return Array.from(map.entries());
}

function formatTime(s) {
  try { return new Date(s).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }); }
  catch (_) { return ''; }
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.sm, paddingTop: space.sm, paddingBottom: space.xs },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, color: vantage.textPrimary, fontFamily, fontSize: sizes.h2, fontWeight: weights.heavy, textAlign: 'center' },
  markAll: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: space.sm, paddingVertical: 6, minWidth: 80, justifyContent: 'flex-end' },
  markAllTxt: { color: vantage.accent, fontFamily, fontSize: sizes.label, fontWeight: weights.bold },

  banner: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginHorizontal: space.lg, marginBottom: space.sm, paddingHorizontal: space.md, paddingVertical: space.sm, backgroundColor: vantage.accentMuted, borderRadius: radius.md },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: vantage.accent },
  bannerTxt: { color: vantage.accent, fontFamily, fontSize: sizes.label, fontWeight: weights.semibold },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  group: { marginBottom: space.sm },
  groupLabel: { color: vantage.textMuted, fontFamily, fontSize: sizes.label, fontWeight: weights.bold, textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: space.lg, paddingVertical: space.sm },

  card: {
    flexDirection: 'row', alignItems: 'flex-start', gap: space.md,
    marginHorizontal: space.lg, marginBottom: space.sm,
    padding: space.md, paddingLeft: space.lg,
    backgroundColor: vantage.bgElevated, borderRadius: radius.lg,
    borderWidth: 1, borderColor: vantage.border,
    overflow: 'hidden',
  },
  cardUnread: { backgroundColor: vantage.bgRaised, borderColor: withAlpha(vantage.accent, '55') },
  unreadBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: vantage.accent, borderTopLeftRadius: radius.lg, borderBottomLeftRadius: radius.lg },

  iconWrap: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm, marginBottom: 3 },
  notifTitle: { flex: 1, color: vantage.textPrimary, fontFamily, fontSize: sizes.body, fontWeight: weights.bold },
  time: { color: vantage.textMuted, fontFamily, fontSize: sizes.micro },
  message: { color: vantage.textSecondary, fontFamily, fontSize: sizes.label, lineHeight: 19 },

  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: space.xxl },
  emptyIcon: { width: 84, height: 84, borderRadius: 42, backgroundColor: vantage.bgElevated, alignItems: 'center', justifyContent: 'center', marginBottom: space.lg },
  emptyTitle: { color: vantage.textPrimary, fontFamily, fontSize: sizes.h3, fontWeight: weights.heavy, marginBottom: space.xs },
  emptyTxt: { color: vantage.textMuted, fontFamily, fontSize: sizes.body, textAlign: 'center', lineHeight: 20 },
});
