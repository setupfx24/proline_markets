import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import HeaderLogo from "../components/HeaderLogo";
import * as SecureStore from 'expo-secure-store';
import { API_URL } from '../config';
import { useTheme } from '../context/ThemeContext';

const NotificationsScreen = ({ navigation }) => {
  const { colors, isDark } = useTheme();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [groupedNotifications, setGroupedNotifications] = useState({});

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (user) {
      fetchNotifications();
    }
  }, [user]);

  const loadUser = async () => {
    try {
      const userData = await SecureStore.getItemAsync('user');
      if (userData) {
        setUser(JSON.parse(userData));
      }
    } catch (e) {
      console.error('Error loading user:', e);
    }
  };

  const fetchNotifications = async () => {
    try {
      const res = await fetch(`${API_URL}/notifications/user/${user._id}`);
      const data = await res.json();
      const notifs = data.notifications || [];
      if (notifs.length > 0) {
        setNotifications(notifs);
        groupNotificationsByDate(notifs);
      } else {
        // Show sample notifications for demo if no real notifications
        generateSampleNotifications();
      }
    } catch (e) {
      console.error('Error fetching notifications:', e);
      // Generate sample notifications for demo
      generateSampleNotifications();
    }
    setLoading(false);
    setRefreshing(false);
  };

  const generateSampleNotifications = () => {
    const sampleNotifs = [
      {
        _id: '1',
        type: 'TRADE_OPEN',
        title: 'Trade Opened',
        message: 'BUY EUR/USD 0.10 lots at 1.08542',
        data: { symbol: 'EUR/USD', side: 'BUY', lotSize: 0.10, price: 1.08542 },
        createdAt: new Date().toISOString(),
        read: false
      },
      {
        _id: '2',
        type: 'TRADE_CLOSE',
        title: 'Trade Closed',
        message: 'SELL GBP/USD closed with +$45.20 profit',
        data: { symbol: 'GBP/USD', pnl: 45.20 },
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        read: false
      },
      {
        _id: '3',
        type: 'STOP_LOSS_HIT',
        title: 'Stop Loss Hit',
        message: 'XAU/USD position closed at stop loss -$23.50',
        data: { symbol: 'XAU/USD', pnl: -23.50 },
        createdAt: new Date(Date.now() - 7200000).toISOString(),
        read: true
      },
      {
        _id: '4',
        type: 'TAKE_PROFIT_HIT',
        title: 'Take Profit Hit',
        message: 'BTC/USD position closed at take profit +$120.00',
        data: { symbol: 'BTC/USD', pnl: 120.00 },
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        read: true
      },
      {
        _id: '5',
        type: 'PENDING_ORDER',
        title: 'Pending Order Placed',
        message: 'Buy Limit EUR/USD at 1.08200 - 0.05 lots',
        data: { symbol: 'EUR/USD', orderType: 'BUY_LIMIT', price: 1.08200 },
        createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
        read: true
      },
      {
        _id: '6',
        type: 'PENDING_TRIGGERED',
        title: 'Pending Order Triggered',
        message: 'Buy Limit EUR/USD executed at 1.08200',
        data: { symbol: 'EUR/USD' },
        createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
        read: true
      },
      {
        _id: '7',
        type: 'DEPOSIT',
        title: 'Deposit Received',
        message: 'Your deposit of $500.00 has been credited',
        data: { amount: 500 },
        createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
        read: true
      },
    ];
    setNotifications(sampleNotifs);
    groupNotificationsByDate(sampleNotifs);
  };

  const groupNotificationsByDate = (notifs) => {
    const grouped = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    notifs.forEach(notif => {
      const notifDate = new Date(notif.createdAt);
      notifDate.setHours(0, 0, 0, 0);
      
      let dateKey;
      if (notifDate.getTime() === today.getTime()) {
        dateKey = 'Today';
      } else if (notifDate.getTime() === yesterday.getTime()) {
        dateKey = 'Yesterday';
      } else {
        dateKey = notifDate.toLocaleDateString('en-US', { 
          weekday: 'long', 
          month: 'short', 
          day: 'numeric' 
        });
      }

      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(notif);
    });

    setGroupedNotifications(grouped);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchNotifications();
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'TRADE_OPEN':
        return { name: 'arrow-up-circle', color: '#22c55e', bg: '#22c55e20' };
      case 'TRADE_CLOSE':
        return { name: 'checkmark-circle', color: '#22c55e', bg: '#22c55e20' };
      case 'STOP_LOSS_HIT':
        return { name: 'alert-circle', color: '#ef4444', bg: '#ef444420' };
      case 'TAKE_PROFIT_HIT':
        return { name: 'trophy', color: '#22c55e', bg: '#22c55e20' };
      case 'PENDING_ORDER':
        return { name: 'time', color: '#a855f7', bg: '#a855f720' };
      case 'PENDING_TRIGGERED':
        return { name: 'flash', color: '#f97316', bg: '#f9731620' };
      case 'DEPOSIT':
        return { name: 'wallet', color: '#22c55e', bg: '#22c55e20' };
      case 'WITHDRAWAL':
        return { name: 'arrow-down-circle', color: '#22c55e', bg: '#22c55e20' };
      case 'COPY_TRADE':
        return { name: 'copy', color: '#06b6d4', bg: '#06b6d420' };
      default:
        return { name: 'notifications', color: '#888', bg: '#88888820' };
    }
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const markAsRead = async (notifId) => {
    try {
      await fetch(`${API_URL}/notifications/${notifId}/read`, { method: 'PUT' });
      setNotifications(prev => 
        prev.map(n => n._id === notifId ? { ...n, read: true } : n)
      );
    } catch (e) {
      console.error('Error marking as read:', e);
    }
  };

  const markAllAsRead = async () => {
    try {
      await fetch(`${API_URL}/notifications/user/${user._id}/read-all`, { method: 'PUT' });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      groupNotificationsByDate(notifications.map(n => ({ ...n, read: true })));
    } catch (e) {
      // Update locally anyway
      const updated = notifications.map(n => ({ ...n, read: true }));
      setNotifications(updated);
      groupNotificationsByDate(updated);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.bgPrimary }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.bgPrimary }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <HeaderLogo size={28} />
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Notifications</Text>
        </View>
        {unreadCount > 0 ? (
          <TouchableOpacity onPress={markAllAsRead} style={styles.markAllBtn}>
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 80 }} />
        )}
      </View>

      {/* Unread Badge */}
      {unreadCount > 0 && (
        <View style={styles.unreadBanner}>
          <View style={styles.unreadDot} />
          <Text style={styles.unreadText}>{unreadCount} unread notification{unreadCount > 1 ? 's' : ''}</Text>
        </View>
      )}

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        showsVerticalScrollIndicator={false}
      >
        {Object.keys(groupedNotifications).length === 0 ? (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.bgSecondary }]}>
              <Ionicons name="notifications-off-outline" size={48} color={colors.textMuted} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No Notifications</Text>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>You're all caught up! New notifications will appear here.</Text>
          </View>
        ) : (
          Object.entries(groupedNotifications).map(([date, notifs]) => (
            <View key={date} style={styles.dateGroup}>
              <Text style={styles.dateHeader}>{date}</Text>
              {notifs.map((notif) => {
                const icon = getNotificationIcon(notif.type);
                return (
                  <TouchableOpacity 
                    key={notif._id} 
                    style={[styles.notificationCard, { backgroundColor: colors.bgCard, borderColor: colors.border }, !notif.read && styles.unreadCard]}
                    onPress={() => markAsRead(notif._id)}
                    activeOpacity={0.7}
                  >
                    {/* iOS-style notification */}
                    <View style={styles.notifContent}>
                      <View style={[styles.notifIcon, { backgroundColor: icon.bg }]}>
                        <Ionicons name={icon.name} size={22} color={icon.color} />
                      </View>
                      <View style={styles.notifText}>
                        <View style={styles.notifHeader}>
                          <Text style={[styles.notifTitle, { color: colors.textPrimary }]}>{notif.title}</Text>
                          <Text style={[styles.notifTime, { color: colors.textMuted }]}>{formatTime(notif.createdAt)}</Text>
                        </View>
                        <Text style={[styles.notifMessage, { color: colors.textMuted }]} numberOfLines={2}>{notif.message}</Text>
                      </View>
                    </View>
                    {!notif.read && <View style={styles.unreadIndicator} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 16, 
    paddingTop: 60, 
    paddingBottom: 16 
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  markAllBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  markAllText: { color: '#22c55e', fontSize: 13, fontWeight: '500' },
  
  // Unread Banner
  unreadBanner: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginHorizontal: 16, 
    marginBottom: 12, 
    paddingHorizontal: 14, 
    paddingVertical: 10, 
    backgroundColor: '#22c55e20', 
    borderRadius: 10 
  },
  unreadDot: { 
    width: 8, 
    height: 8, 
    borderRadius: 4, 
    backgroundColor: '#22c55e', 
    marginRight: 10 
  },
  unreadText: { color: '#22c55e', fontSize: 13, fontWeight: '500' },
  
  // Empty State
  emptyState: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 40 },
  emptyIcon: { 
    width: 80, 
    height: 80, 
    borderRadius: 40, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginBottom: 16 
  },
  emptyTitle: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  emptyText: { color: '#666', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  
  // Date Group
  dateGroup: { marginBottom: 8 },
  dateHeader: { 
    color: '#888', 
    fontSize: 13, 
    fontWeight: '600', 
    paddingHorizontal: 16, 
    paddingVertical: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  
  // Notification Card - iOS Style
  notificationCard: { 
    marginHorizontal: 16, 
    marginBottom: 8, 
    borderRadius: 16, 
    padding: 14,
    borderWidth: 1,
    position: 'relative',
    overflow: 'hidden'
  },
  unreadCard: { 
    backgroundColor: '#0a1628',
    borderColor: '#1e3a5f'
  },
  notifContent: { 
    flexDirection: 'row', 
    alignItems: 'flex-start' 
  },
  notifIcon: { 
    width: 44, 
    height: 44, 
    borderRadius: 12, 
    justifyContent: 'center', 
    alignItems: 'center',
    marginRight: 12
  },
  notifText: { flex: 1 },
  notifHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 4 
  },
  notifTitle: { fontSize: 15, fontWeight: '600' },
  notifTime: { color: '#666', fontSize: 12 },
  notifMessage: { color: '#888', fontSize: 14, lineHeight: 19 },
  unreadIndicator: { 
    position: 'absolute', 
    left: 0, 
    top: 0, 
    bottom: 0, 
    width: 4, 
    backgroundColor: '#22c55e',
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16
  },
});

export default NotificationsScreen;
