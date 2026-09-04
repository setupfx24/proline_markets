import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import * as SecureStore from 'expo-secure-store';

import ApiService from '../services/api/ApiService';
import { configureAndroidChannel, ensureNotificationPermission, presentLocalNotification, getNotifications } from '../services/notifications/pushNotifications';
import { navigate } from '../app/navigation/navigationRef';

// High-water mark: the created_at of the newest notification we've already
// raised a tray alert for. A single tiny value — the previous design persisted
// a JSON list of up to 200 seen ids (~8KB), which silently exceeds Android
// SecureStore's 2KB value limit; the save failed, the app forgot what it had
// alerted, and every open re-sprayed tray notifications for old unread items
// (reinstalling couldn't fix it because the bug recreated itself).
const LAST_ALERT_TS_KEY = 'notif_last_alert_ts';
// Poll the in-app feed every 10s while the app is foregrounded so tray alerts
// arrive promptly (was 30s — felt laggy). We also poll immediately whenever the
// app returns to the foreground (AppState 'active' listener below).
const POLL_MS = 10000;

function tsOf(n) {
  const t = Date.parse(n?.created_at || n?.createdAt || '');
  return Number.isFinite(t) ? t : 0;
}

// Map a notification's action_url / type to an in-app destination (mirrors
// the routing on NotificationsScreen).
function routeFor(data) {
  const url = String(data?.action_url || '').toLowerCase();
  const type = String(data?.type || '').toLowerCase();
  if (url.includes('kyc') || type.includes('kyc')) return ['HomeTab', { screen: 'Kyc' }];
  if (url.includes('wallet') || url.includes('deposit') || url.includes('withdraw')
    || type.includes('deposit') || type.includes('withdraw')) return ['FundsTab', { screen: 'Funds' }];
  if (url.includes('portfolio')) return ['HomeTab', { screen: 'Portfolio' }];
  if (url.includes('support') || type.includes('support') || type.includes('ticket')) return ['HomeTab', { screen: 'Support' }];
  if (type.includes('trade') || type.includes('order') || type.includes('position')
    || type.includes('copy') || type.includes('stop') || type.includes('profit') || type.includes('pending')) {
    return ['TradeTab', { screen: 'Trade' }];
  }
  return ['HomeTab', { screen: 'Notifications' }];
}

// Polls the in-app notification feed and raises a real device notification for
// each newly-arrived unread item — so users get a WhatsApp-style tray alert
// while the app is running/backgrounded. (Push when the app is fully killed
// needs server-side FCM/Expo push — see notes.)
export default function NotificationsBridge() {
  // In-memory dedupe for this session; the durable state is ONE timestamp.
  const seenRef = useRef(new Set());
  const lastAlertTsRef = useRef(0);
  // Polls must not run until the persisted timestamp has loaded — the old
  // code let the interval/AppState poll race ahead of initialization, which
  // bypassed the "don't spam existing items" guard.
  const readyRef = useRef(false);
  const pollingRef = useRef(false);

  useEffect(() => {
    let timer;
    let cancelled = false;

    const poll = async () => {
      if (!readyRef.current || pollingRef.current) return;
      pollingRef.current = true;
      try {
        const res = await ApiService.getNotifications(1, 20);
        const list = Array.isArray(res) ? res : (res?.items || res?.notifications || []);
        if (!Array.isArray(list)) return;
        const seen = seenRef.current;
        const cutoff = lastAlertTsRef.current;
        const fresh = [];
        let maxTs = cutoff;
        for (const n of list) {
          const id = String(n.id || n._id || '');
          const ts = tsOf(n);
          if (ts > maxTs) maxTs = ts;
          if (!id || seen.has(id)) continue;
          seen.add(id);
          const unread = !(n.is_read || n.read);
          // Alert only items strictly NEWER than the high-water mark — old
          // unread items (already alerted in a previous session, or existing
          // before install) never re-alert.
          if (unread && ts > cutoff) fresh.push(n);
        }
        // Newest first, capped so a backlog can't flood the tray.
        for (const n of fresh.slice(0, 5)) {
          await presentLocalNotification({
            title: n.title || 'ProlineMarket',
            body: n.message || '',
            data: { action_url: n.action_url || n.actionUrl, type: n.type },
          });
        }
        if (maxTs > lastAlertTsRef.current) {
          lastAlertTsRef.current = maxTs;
          // Single ~13-byte value — always within SecureStore's Android limit.
          try { await SecureStore.setItemAsync(LAST_ALERT_TS_KEY, String(maxTs)); } catch (_) {}
        }
      } catch (_) {
        /* transient network errors — next poll retries */
      } finally {
        pollingRef.current = false;
      }
    };

    (async () => {
      await configureAndroidChannel();
      await ensureNotificationPermission();
      // No push-token registration: the gateway has no endpoint to store one
      // (the trader web app never registers either), so notifications are
      // delivered by the local poll below rather than by server-side push.
      try {
        const raw = await SecureStore.getItemAsync(LAST_ALERT_TS_KEY);
        const ts = Number(raw);
        if (!cancelled && Number.isFinite(ts) && ts > 0) lastAlertTsRef.current = ts;
      } catch (_) {}
      if (cancelled) return;
      if (lastAlertTsRef.current === 0) {
        // Fresh install (or first run on this build): seed the high-water mark
        // to the newest EXISTING notification so nothing old alerts; only
        // items arriving from now on will.
        try {
          const res = await ApiService.getNotifications(1, 20);
          const list = Array.isArray(res) ? res : (res?.items || res?.notifications || []);
          let maxTs = Date.now();
          for (const n of (Array.isArray(list) ? list : [])) {
            const id = String(n.id || n._id || '');
            if (id) seenRef.current.add(id);
            const ts = tsOf(n);
            if (ts > maxTs) maxTs = ts;
          }
          lastAlertTsRef.current = maxTs;
          try { await SecureStore.setItemAsync(LAST_ALERT_TS_KEY, String(maxTs)); } catch (_) {}
        } catch (_) {
          lastAlertTsRef.current = Date.now();
        }
      }
      readyRef.current = true;
      poll();
    })();

    timer = setInterval(() => { if (AppState.currentState === 'active') poll(); }, POLL_MS);
    const appSub = AppState.addEventListener('change', (s) => { if (s === 'active') poll(); });
    // Only navigate for a GENUINE tap while the app is already running. Expo
    // re-delivers the launch/last notification response synchronously on every
    // cold start, which kept force-opening the Notifications screen every time
    // the user reopened the app from the launcher. Ignoring responses in the
    // first few seconds after mount skips that stale re-delivery while real
    // taps (which happen much later) still route correctly.
    const mountedAt = Date.now();
    // Lazy — importing expo-notifications at module scope throws in Expo Go
    // and would take the whole app down with it (see pushNotifications.js).
    const N = getNotifications();
    const respSub = N?.addNotificationResponseReceivedListener((resp) => {
      if (Date.now() - mountedAt < 4000) return;
      const data = resp?.notification?.request?.content?.data || {};
      const [name, params] = routeFor(data);
      navigate(name, params);
    });

    return () => {
      cancelled = true;
      clearInterval(timer);
      appSub.remove();
      respSub?.remove();
    };
  }, []);

  return null;
}
