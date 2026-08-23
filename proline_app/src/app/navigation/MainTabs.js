import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Image, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LottieView from 'lottie-react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import HomeStack from './HomeStack';
import MarketsStack from './MarketsStack';
import TradeStack from './TradeStack';
import FundsStack from './FundsStack';
import { BottomNavPill } from '../../components/vantage';
import { BOTTOM_NAV_PILL_HEIGHT } from '../../components/vantage/BottomNavPill';
import { vantage } from '../../theme/vantageTheme';
import OnboardingTour from '../../components/onboarding/OnboardingTour';
import { hasSeenTour, markTourSeen, onTourReplay } from '../../components/onboarding/tourStorage';

// Active theme is already applied (index.js) before this module loads, so the
// branch below picks the right Home icon at evaluation time.
const LIGHT_THEME = vantage.isDark === false;

// Light theme uses the brand-coloured logo; dark theme uses the white cut-out.
const HOME_ICON = LIGHT_THEME
  ? require('../../../assets/brand/proline-homebar.png')
  : require('../../../assets/brand/proline-homebar-white.png');

// Each theme has its own Lottie set — the *-active variants are the brand-red
// (#f04024) icons used on the light theme.
const LOTTIE = LIGHT_THEME
  ? {
      MarketsTab: require('../../../assets/animations/market-active.json'),
      TradeTab:   require('../../../assets/animations/trade-active.json'),
      FundsTab:   require('../../../assets/animations/funds-active.json'),
    }
  : {
      MarketsTab: require('../../../assets/animations/market.json'),
      TradeTab:   require('../../../assets/animations/trade.json'),
      FundsTab:   require('../../../assets/animations/funds.json'),
    };

// Root screen of each tab's stack — used to pop back to root on active re-tap.
const TAB_ROOT = { HomeTab: 'Home', MarketsTab: 'Markets', TradeTab: 'Trade', FundsTab: 'Funds' };

const LOTTIE_SIZE = { width: 28, height: 28 };

// Plays the animation ONCE when its tab becomes active (i.e. on tap). Otherwise
// it sits on the first frame — no autonomous movement without a click.
function TabLottieIcon({ source, active }) {
  const ref = useRef(null);
  useEffect(() => {
    if (active) {
      ref.current?.reset?.();
      ref.current?.play?.();
    } else {
      ref.current?.reset?.();
    }
  }, [active]);
  return (
    <LottieView
      ref={ref}
      source={source}
      autoPlay={false}
      loop={false}
      style={[LOTTIE_SIZE, !active && { opacity: 0.45 }]}
    />
  );
}

const Tab = createBottomTabNavigator();

const TAB_META = {
  HomeTab:    { label: 'Home' },
  MarketsTab: { label: 'Markets' },
  TradeTab:   { label: 'Trade' },
  FundsTab:   { label: 'Funds' },
};

function VantageTabBar({ state, navigation }) {
  const activeKey = state.routes[state.index].name;
  const tabs = state.routes.map((r) => {
    const m = TAB_META[r.name];
    if (r.name === 'HomeTab') {
      return {
        key: r.name,
        label: m.label,
        icon:         <Image source={HOME_ICON} style={{ width: 22, height: 22 }} resizeMode="contain" />,
        iconInactive: <Image source={HOME_ICON} style={{ width: 22, height: 22, opacity: 0.4 }} resizeMode="contain" />,
      };
    }
    const src = LOTTIE[r.name];
    return {
      key: r.name,
      label: m.label,
      // Single persistent icon — plays only when it becomes active (on tap).
      renderIcon: (active) => <TabLottieIcon source={src} active={active} />,
    };
  });

  return (
    <View collapsable={false}>
    <BottomNavPill
      tabs={tabs}
      activeKey={activeKey}
      onChange={(k) => {
        // Reset the tab's stack to its root when:
        //  • re-tapping the already-active tab (e.g. Home while the profile
        //    drawer is open returns Home), OR
        //  • opening Home — leaving the profile menu (or any Home sub-screen)
        //    open, visiting another tab and coming back must show HOME, not
        //    the stale sub-screen, OR
        //  • opening Markets — it should ALWAYS show the instruments list, even
        //    if an instrument-detail chart was left open before switching away.
        // Trade/Funds intentionally keep their inner state (e.g. a deposit
        // flow in progress survives a quick tab hop).
        if (k === activeKey || k === 'HomeTab' || k === 'MarketsTab') {
          navigation.navigate(k, { screen: TAB_ROOT[k] });
        } else {
          navigation.navigate(k);
        }
      }}
    />
    </View>
  );
}

// ── First-run coach-mark tour ────────────────────────────────────────────────
// Shown once after the first login (replayable via Profile → Help → App Tour).
// The bottom bar's frame is measured and split into four equal segments; steps
// whose feature lives on the shell anchor to a tab spotlight, deeper features
// (chart, buy/sell) are icon cards. `tab` below is the anchoring segment
// index: 0 Home · 1 Markets · 2 Trade · 3 Funds · null = centred card.
const TOUR_STEPS = [
  { key: 'welcome',  icon: 'information-circle-outline', tab: null, title: 'Welcome to ProlineMarket',
    text: 'A short tour of the essentials — use Next / Back to move around, or Skip any time. Replay it later from Profile → Help.' },
  { key: 'market',   icon: 'stats-chart-outline',   tab: 1, title: 'Market Watch',
    text: 'Live prices for every instrument — FX, metals, indices and crypto — with daily change and sparklines.' },
  { key: 'search',   icon: 'search-outline',        tab: 1, title: 'Search',
    text: 'Find any symbol fast: open Markets and tap Add Symbol or the search field to filter the full instrument list.' },
  { key: 'chart',    icon: 'analytics-outline',     tab: 1, title: 'Chart',
    text: 'Tap any instrument to open the advanced chart — indicators, timeframes, and SL/TP you can drag right on the chart.' },
  { key: 'buy',      icon: 'trending-up-outline',   tab: null, title: 'Buy',
    text: 'On an instrument screen, tap the green Buy side to place a market Buy in one tap — or use Limit / Stop for pending orders.' },
  { key: 'sell',     icon: 'trending-down-outline', tab: null, title: 'Sell',
    text: 'The red Sell side works the same way — one tap to sell at market, with your chosen lot size.' },
  { key: 'positions', icon: 'layers-outline',       tab: 2, title: 'Positions',
    text: 'Every open position with live P&L. Set SL/TP, partial-close by percent, or bulk-close all / profitable / losing.' },
  { key: 'orders',   icon: 'time-outline',          tab: 2, title: 'Orders',
    text: 'Pending limit and stop orders live in the Pending tab — cancel or track them until they fill.' },
  { key: 'history',  icon: 'receipt-outline',       tab: 2, title: 'History',
    text: 'Review every closed trade with realized P&L, fees and close reason in the History tab.' },
  { key: 'funds',    icon: 'wallet-outline',        tab: 3, title: 'Funds',
    text: 'Deposit, withdraw, transfer between wallet and trading accounts, and export your transaction history as PDF.' },
  { key: 'profile',  icon: 'settings-outline',      tab: 0, title: 'Profile & Settings',
    text: 'Home hosts your profile menu — accounts, KYC, security (App Lock), theme, language and support.' },
  { key: 'done',     icon: 'checkmark-circle-outline', tab: null, title: 'Tour complete',
    text: 'You can replay this tour any time from Profile → Help → App Tour.' },
];

function useFirstRunTour() {
  const [steps, setSteps] = useState(null);
  const { width: winW, height: winH } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const buildAndShow = useCallback(() => {
    // The nav pill is absolutely positioned at bottom:0 with a known height
    // (BOTTOM_NAV_PILL_HEIGHT + bottom safe-area), so each tab's frame is
    // computed directly from the window dimensions — deterministic, no
    // measureInWindow (which returned zeros on some Fabric devices and
    // degraded the tour to floating cards).
    const barH = BOTTOM_NAV_PILL_HEIGHT + insets.bottom;
    const y = winH - barH;
    const segW = winW / 4;
    setSteps(TOUR_STEPS.map((s) => ({
      ...s,
      target: s.tab == null ? null : { x: s.tab * segW, y, width: segW, height: barH - insets.bottom },
    })));
  }, [winW, winH, insets.bottom]);

  // First run: show once after the tab bar has settled.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (await hasSeenTour()) return;
      setTimeout(() => { if (!cancelled) buildAndShow(); }, 900);
    })();
    return () => { cancelled = true; };
  }, [buildAndShow]);

  // Manual replay from Profile → Help → App Tour.
  useEffect(() => onTourReplay(() => setTimeout(buildAndShow, 250)), [buildAndShow]);

  const done = useCallback(() => {
    setSteps(null);
    markTourSeen();
  }, []);

  return { steps, done };
}

export default function MainTabs() {
  const { steps, done } = useFirstRunTour();

  return (
    <>
      <Tab.Navigator
        screenOptions={{ headerShown: false }}
        tabBar={(props) => <VantageTabBar {...props} />}
      >
        <Tab.Screen name="HomeTab"    component={HomeStack} />
        <Tab.Screen name="MarketsTab" component={MarketsStack} />
        <Tab.Screen name="TradeTab"   component={TradeStack} />
        <Tab.Screen name="FundsTab"   component={FundsStack} />
      </Tab.Navigator>
      <OnboardingTour visible={!!steps} steps={steps || []} onDone={done} />
    </>
  );
}
