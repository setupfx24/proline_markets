import React, { useState, useEffect, useCallback, useRef, useContext } from 'react';
import { View, Text, Pressable, StyleSheet, Animated, PanResponder, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';

import { AuthContext } from '../../../app/providers/AuthContext';
import { Card, CategoryTabs, SymbolIcon } from '../../../components/vantage';
import { vantage, space, sizes, weights, fontFamily, radius } from '../../../theme/vantageTheme';
import ApiService from '../../../services/api/ApiService';

function copyKey(x) {
  return x != null ? String(x) : null;
}

const SORT_OPTIONS = [
  { value: 'most_copied',     label: 'Most Copied' },
  { value: 'highest_return',  label: 'Highest Return' },
  { value: 'highest_win_rate',label: 'Highest Win Rate' },
];

export default function TradeCopy() {
  const nav = useNavigation();
  const [sort, setSort] = useState('most_copied');
  const [providers, setProviders] = useState([]);
  const [copiedIds, setCopiedIds] = useState(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await ApiService.getLeaderboard({ sort, limit: 30 });
        const list = Array.isArray(res) ? res : (Array.isArray(res?.items) ? res.items : []);
        if (!cancelled) setProviders(list);
      } catch (_) {
        if (!cancelled) setProviders([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [sort]);

  // Which masters the user is already copying — refreshed on focus so the
  // "Following" badge updates right after copying from the detail screen.
  const loadCopies = useCallback(async () => {
    try {
      const res = await ApiService.getMyCopies();
      const list = Array.isArray(res) ? res : (Array.isArray(res?.items) ? res.items : []);
      const ids = new Set();
      list.forEach((c) => {
        [c.master_id, c.provider_id, c.provider?.id, c.master?.id, c.provider_user_id]
          .map(copyKey).filter(Boolean).forEach((k) => ids.add(k));
      });
      setCopiedIds(ids);
    } catch (_) {}
  }, []);

  useFocusEffect(useCallback(() => { loadCopies(); }, [loadCopies]));

  const isFollowing = useCallback(
    (p) => copiedIds.has(copyKey(p?.id)) || copiedIds.has(copyKey(p?.provider_id)) || copiedIds.has(copyKey(p?.user_id)),
    [copiedIds]
  );

  // Your own master account — never show a Copy button for it (show "You").
  const { user } = useContext(AuthContext) || {};
  const myId = user?.id ? String(user.id) : null;
  const isSelf = useCallback(
    (p) => !!myId && [p?.user_id, p?.master_user_id, p?.owner_user_id, p?.provider_user_id].map(copyKey).includes(myId),
    [myId]
  );

  const top1 = providers[0];
  const rest = providers.slice(1);

  return (
    <View>
      <Card style={styles.becomeCard} onPress={() => nav.navigate('BecomeMaster')}>
        <View style={styles.becomeRow}>
          <View style={[styles.iconCircle, { backgroundColor: vantage.accentMuted }]}>
            <Ionicons name="ribbon-outline" size={22} color={vantage.accent} />
          </View>
          <Text style={styles.becomeTxt}>Become a Master</Text>
          <Ionicons name="chevron-forward" size={18} color={vantage.textMuted} />
        </View>
      </Card>

      {top1 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Best Overall Strategies</Text>
          <StrategyDeck
            items={providers.slice(0, 10)}
            isFollowing={isFollowing}
            isSelf={isSelf}
            onOpen={(p) => nav.navigate('StrategyDetail', { providerId: p.id || p.provider_id })}
          />
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Leaderboards</Text>
        <CategoryTabs value={sort} onChange={setSort} options={SORT_OPTIONS} />
        {loading ? (
          <Text style={styles.empty}>Loading…</Text>
        ) : rest.length === 0 ? (
          <Text style={styles.empty}>No strategies yet.</Text>
        ) : rest.map((p) => (
          <Pressable
            key={p.id || p.provider_id || p.name}
            onPress={() => nav.navigate('StrategyDetail', { providerId: p.id || p.provider_id })}
            android_ripple={{ color: vantage.bgPressed }}
            style={styles.row}
          >
            <StrategyMiniRow item={p} following={isFollowing(p)} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function FollowingBadge() {
  return (
    <View style={badgeStyles.following}>
      <Ionicons name="checkmark-circle" size={12} color={vantage.up} />
      <Text style={badgeStyles.followingTxt}>Following</Text>
    </View>
  );
}

function BigStrategyRow({ item, following }) {
  const ret = Number(item.total_return_pct ?? item.return_30d ?? item.roi_30d ?? 0);
  const positive = ret >= 0;
  const aum = item.total_aum ?? item.aum ?? item.aum_usd ?? null;
  const displayName = item.provider_name || item.name || 'Strategy';
  const displayCategory = item.strategy_info?.category || item.category || null;
  return (
    <View style={bigStyles.wrap}>
      <View style={bigStyles.head}>
        <SymbolIcon symbol={displayName.slice(0, 2).toUpperCase()} size={40} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={bigStyles.nameRow}>
            <Text style={bigStyles.name} numberOfLines={1}>{displayName}</Text>
            {following ? <FollowingBadge /> : null}
          </View>
          {displayCategory ? (
            <View style={bigStyles.badge}><Text style={bigStyles.badgeTxt}>{displayCategory}</Text></View>
          ) : null}
        </View>
        {item.is_full ? <Text style={bigStyles.full}>Full</Text> : null}
      </View>
      <View style={bigStyles.statsRow}>
        <View style={{ flex: 1 }}>
          <Text style={bigStyles.lab}>30D Return</Text>
          <Text style={[bigStyles.val, { color: positive ? vantage.up : vantage.down }]}>
            {`${positive ? '+' : ''}${ret.toFixed(2)}%`}
          </Text>
        </View>
        {aum != null ? (
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <Text style={bigStyles.lab}>AUM (USD)</Text>
            <Text style={bigStyles.aum}>{Number(aum).toLocaleString('en-US', { maximumFractionDigits: 2 })}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function StrategyMiniRow({ item, following }) {
  const ret = Number(item.total_return_pct ?? item.return_30d ?? item.roi_30d ?? 0);
  const positive = ret >= 0;
  const aum = item.total_aum ?? item.aum ?? item.aum_usd ?? null;
  const displayName = item.provider_name || item.name || 'Strategy';
  const followers = item.followers_count ?? item.follower_count ?? null;
  return (
    <View style={miniStyles.row}>
      <SymbolIcon symbol={displayName.slice(0, 2).toUpperCase()} size={36} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={bigStyles.nameRow}>
          <Text style={miniStyles.name} numberOfLines={1}>{displayName}</Text>
          {following ? <FollowingBadge /> : null}
        </View>
        {followers != null ? (
          <Text style={miniStyles.sub} numberOfLines={1}>{followers} followers</Text>
        ) : null}
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        {aum != null ? <Text style={miniStyles.aum}>{Number(aum).toLocaleString('en-US', { maximumFractionDigits: 0 })} USD</Text> : null}
        <Text style={[miniStyles.ret, { color: positive ? vantage.up : vantage.down }]}>
          {`${positive ? '+' : ''}${ret.toFixed(2)}%`}
        </Text>
      </View>
    </View>
  );
}

// Swipeable card stack — the front card can be flung left/right to reveal the
// next one behind it (cards peek out from the top, like a deck).
const SCREEN_W = Dimensions.get('window').width;
const SWIPE_THRESHOLD = SCREEN_W * 0.28;

function DeckCard({ item, following, self, onOpen }) {
  const ret = Number(item.total_return_pct ?? item.return_30d ?? item.roi_30d ?? 0);
  const positive = ret >= 0;
  const aum = item.total_aum ?? item.aum ?? item.aum_usd ?? null;
  const displayName = item.provider_name || item.name || 'Strategy';
  const displayCategory = item.strategy_info?.category || item.category || 'Forex';
  return (
    <View style={deckStyles.card}>
      <View style={deckStyles.head}>
        <SymbolIcon symbol={displayName.slice(0, 2).toUpperCase()} size={40} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={bigStyles.nameRow}>
            <Text style={deckStyles.name} numberOfLines={1}>{displayName}</Text>
            {following ? <FollowingBadge /> : null}
          </View>
          <View style={deckStyles.badge}><Text style={deckStyles.badgeTxt}>{displayCategory}</Text></View>
        </View>
        {self ? (
          <View style={deckStyles.youBadge}>
            <Text style={deckStyles.youTxt}>You</Text>
          </View>
        ) : (
          <Pressable
            onPress={() => onOpen(item)}
            style={deckStyles.copyBtn}
            accessibilityRole="button"
            accessibilityLabel={`Copy ${displayName}`}
          >
            <Text style={deckStyles.copyTxt}>{following ? 'Copied' : 'Copy'}</Text>
          </Pressable>
        )}
      </View>
      <View style={deckStyles.statsRow}>
        <View style={{ flex: 1 }}>
          <Text style={deckStyles.lab}>30D Return</Text>
          <Text style={[deckStyles.val, { color: positive ? vantage.up : vantage.down }]}>
            {`${positive ? '+' : ''}${ret.toFixed(2)}%`}
          </Text>
        </View>
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <Text style={deckStyles.lab}>AUM (USD)</Text>
          <Text style={deckStyles.aum}>
            {aum != null ? Number(aum).toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—'}
          </Text>
        </View>
      </View>
    </View>
  );
}

function StrategyDeck({ items, isFollowing, isSelf, onOpen }) {
  const [index, setIndex] = useState(0);
  const pan = useRef(new Animated.ValueXY()).current;
  const n = items.length;

  const advance = useCallback((dir) => {
    Animated.timing(pan, {
      toValue: { x: dir * SCREEN_W * 1.3, y: 0 },
      duration: 220,
      useNativeDriver: false,
    }).start(() => {
      pan.setValue({ x: 0, y: 0 });
      setIndex((i) => (i + 1) % n);
    });
  }, [pan, n]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
      onPanResponderRelease: (_, g) => {
        if (Math.abs(g.dx) > SWIPE_THRESHOLD) {
          advance(g.dx > 0 ? 1 : -1);
        } else {
          Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false, friction: 6 }).start();
        }
      },
    })
  ).current;

  if (!n) return null;

  const visible = Math.min(3, n);
  const rotate = pan.x.interpolate({
    inputRange: [-SCREEN_W, 0, SCREEN_W],
    outputRange: ['-7deg', '0deg', '7deg'],
  });

  const layers = [];
  for (let k = visible - 1; k >= 0; k--) {
    const item = items[(index + k) % n];
    const following = isFollowing(item);
    const self = isSelf ? isSelf(item) : false;
    if (k === 0) {
      layers.push(
        <Animated.View
          key={`front-${index}`}
          style={[deckStyles.layer, { transform: [{ translateX: pan.x }, { translateY: pan.y }, { rotate }] }]}
          {...panResponder.panHandlers}
        >
          <DeckCard item={item} following={following} self={self} onOpen={onOpen} />
        </Animated.View>
      );
    } else {
      layers.push(
        <Animated.View
          key={`back-${k}`}
          pointerEvents="none"
          style={[deckStyles.layer, { transform: [{ translateY: -k * 9 }, { scale: 1 - k * 0.05 }], opacity: 1 - k * 0.22 }]}
        >
          <DeckCard item={item} following={following} self={self} onOpen={onOpen} />
        </Animated.View>
      );
    }
  }

  return (
    <View>
      <View style={deckStyles.stack}>{layers}</View>
      <Text style={deckStyles.counter}>{`${(index % n) + 1} / ${n}  ·  swipe to browse`}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  becomeCard: { margin: space.lg },
  becomeRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  iconCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  becomeTxt: { flex: 1, color: vantage.textPrimary, fontFamily, fontSize: sizes.body, fontWeight: weights.semibold },
  section: { paddingHorizontal: space.lg, paddingVertical: space.md, gap: space.sm },
  sectionTitle: { color: vantage.textPrimary, fontFamily, fontSize: sizes.h2, fontWeight: weights.heavy, marginBottom: space.sm },
  empty: { color: vantage.textMuted, fontFamily, fontSize: sizes.body, padding: space.lg, textAlign: 'center' },
  row: { paddingVertical: space.sm },
});

const badgeStyles = StyleSheet.create({
  following: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: vantage.upMuted,
    paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: radius.pill,
  },
  followingTxt: { color: vantage.up, fontFamily, fontSize: sizes.micro, fontWeight: weights.bold },
});

const bigStyles = StyleSheet.create({
  wrap: { padding: space.sm, gap: space.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  name: { color: vantage.textPrimary, fontFamily, fontSize: sizes.h2, fontWeight: weights.heavy, flexShrink: 1 },
  badge: { alignSelf: 'flex-start', backgroundColor: vantage.bgPressed, paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: radius.sm, marginTop: 2 },
  badgeTxt: { color: vantage.textSecondary, fontFamily, fontSize: sizes.micro, fontWeight: weights.medium },
  full: { color: vantage.textMuted, fontFamily, fontSize: sizes.label, fontWeight: weights.semibold, backgroundColor: vantage.bgPressed, paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: radius.sm },
  statsRow: { flexDirection: 'row' },
  lab: { color: vantage.textMuted, fontFamily, fontSize: sizes.label },
  val: { fontFamily, fontSize: sizes.h1, fontWeight: weights.heavy, marginTop: 2 },
  aum: { color: vantage.textPrimary, fontFamily, fontSize: sizes.h2, fontWeight: weights.heavy, marginTop: 2 },
});

const miniStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  name: { color: vantage.textPrimary, fontFamily, fontSize: sizes.h3, fontWeight: weights.bold },
  sub: { color: vantage.textMuted, fontFamily, fontSize: sizes.label, marginTop: 2 },
  aum: { color: vantage.textPrimary, fontFamily, fontSize: sizes.body, fontWeight: weights.bold },
  ret: { fontFamily, fontSize: sizes.label, fontWeight: weights.bold, marginTop: 2 },
});

const deckStyles = StyleSheet.create({
  stack: { height: 158, marginTop: 4 },
  layer: { position: 'absolute', left: 0, right: 0, top: 16 },
  card: {
    backgroundColor: vantage.bgElevated,
    borderRadius: radius.lg,
    padding: space.lg,
    borderWidth: 1,
    borderColor: vantage.border,
    gap: space.lg,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  name: { color: vantage.textPrimary, fontFamily, fontSize: sizes.h2, fontWeight: weights.heavy, flexShrink: 1 },
  badge: { alignSelf: 'flex-start', backgroundColor: vantage.bgPressed, paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: radius.sm, marginTop: 3 },
  badgeTxt: { color: vantage.textSecondary, fontFamily, fontSize: sizes.micro, fontWeight: weights.medium },
  copyBtn: { backgroundColor: vantage.textPrimary, paddingHorizontal: space.lg, paddingVertical: space.sm, borderRadius: radius.pill },
  copyTxt: { color: vantage.textInverse, fontFamily, fontSize: sizes.label, fontWeight: weights.heavy },
  youBadge: { backgroundColor: vantage.accentMuted, borderWidth: 1, borderColor: vantage.accent, paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.pill },
  youTxt: { color: vantage.accent, fontFamily, fontSize: sizes.label, fontWeight: weights.heavy },
  statsRow: { flexDirection: 'row' },
  lab: { color: vantage.textMuted, fontFamily, fontSize: sizes.label },
  val: { fontFamily, fontSize: sizes.h1, fontWeight: weights.heavy, marginTop: 2 },
  aum: { color: vantage.textPrimary, fontFamily, fontSize: sizes.h1, fontWeight: weights.heavy, marginTop: 2 },
  counter: { color: vantage.textMuted, fontFamily, fontSize: sizes.micro, textAlign: 'center', marginTop: space.sm },
});
