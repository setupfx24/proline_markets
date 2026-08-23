import React, { useState } from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { vantage, space, sizes, weights, fontFamily, radius } from '../../theme/vantageTheme';
import { Card, PillButton, IconButton, CheckboxRow, NumberStepper, SegmentedTabs, CategoryTabs, SymbolIcon, Sparkline, InstrumentRow, StatCard, QuickActionTile, MenuRow, StrategyCard, BuySellSplit, BottomNavPill, BalanceBlock, Sheet, ToastHost, showToast, CalendarStrip, MoversBars, SpotlightCard, DiscreteSlider, EmptyState } from '../../components/vantage';

// Components are imported and rendered here as they're built.
// Add a new Section() per component task.

function CalendarDemo() {
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - 3 + i);
    return d;
  });
  const [active, setActive] = useState(today);
  return (
    <Section title="CalendarStrip"><CalendarStrip days={days} activeDate={active} onChange={setActive} /></Section>
  );
}

function SliderDemo() {
  const [v, setV] = useState(1);
  return (
    <Section title="DiscreteSlider">
      <DiscreteSlider value={v} onChange={setV} stops={[0.1, 0.5, 1, 5, 20]} />
    </Section>
  );
}

export default function ComponentGalleryScreen() {
  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ToastHost />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.h1}>Component Gallery</Text>
        <Text style={styles.subtitle}>Dev-only smoke harness</Text>

        <Section title="Theme tokens">
          <Swatch color={vantage.bg} label="bg" />
          <Swatch color={vantage.bgElevated} label="bgElevated" />
          <Swatch color={vantage.accent} label="accent" />
          <Swatch color={vantage.up} label="up" />
          <Swatch color={vantage.down} label="down" />
        </Section>

        <Section title="Screen">
          <Text style={{ color: vantage.textSecondary, fontFamily, fontSize: sizes.body }}>
            Screen wraps any route with bg + SafeArea + light StatusBar.
          </Text>
        </Section>

        <Section title="Card">
          <Card>
            <Text style={{ color: vantage.textPrimary, fontFamily, fontSize: sizes.body }}>Elevated card (default)</Text>
          </Card>
          <Card variant="raised">
            <Text style={{ color: vantage.textPrimary, fontFamily, fontSize: sizes.body }}>Raised card</Text>
          </Card>
          <Card variant="outline">
            <Text style={{ color: vantage.textPrimary, fontFamily, fontSize: sizes.body }}>Outline card</Text>
          </Card>
          <Card onPress={() => console.log('card pressed')}>
            <Text style={{ color: vantage.textPrimary, fontFamily, fontSize: sizes.body }}>Pressable card (tap me)</Text>
          </Card>
        </Section>

        <Section title="PillButton">
          <PillButton label="Primary" onPress={() => {}} />
          <PillButton label="Secondary" variant="secondary" onPress={() => {}} />
          <PillButton label="Sell" variant="sell" onPress={() => {}} />
          <PillButton label="Buy" variant="buy" onPress={() => {}} />
          <PillButton label="Danger" variant="danger" onPress={() => {}} />
          <PillButton label="Loading" loading onPress={() => {}} />
          <PillButton label="Disabled" disabled onPress={() => {}} />
          <PillButton label="Small" size="sm" onPress={() => {}} />
          <PillButton label="Large" size="lg" onPress={() => {}} />
        </Section>

        <Section title="IconButton">
          <View style={{ flexDirection: 'row', gap: space.md }}>
            <IconButton icon={<Ionicons name="search" size={20} color={vantage.textPrimary} />} accessibilityLabel="Search" onPress={() => {}} />
            <IconButton icon={<Ionicons name="chatbubble-outline" size={20} color={vantage.textPrimary} />} badgeColor={vantage.down} accessibilityLabel="Support (unread)" onPress={() => {}} />
            <IconButton variant="filled" icon={<Ionicons name="chevron-back" size={20} color={vantage.textPrimary} />} accessibilityLabel="Back" onPress={() => {}} />
            <IconButton size="lg" variant="filled" icon={<Ionicons name="notifications-outline" size={22} color={vantage.textPrimary} />} accessibilityLabel="Notifications" onPress={() => {}} />
          </View>
        </Section>

        <CheckboxDemo />
        <StepperDemo />
        <SegmentedDemo />
        <CategoryDemo />

        <Section title="SymbolIcon">
          <View style={{ flexDirection: 'row', gap: space.md, flexWrap: 'wrap' }}>
            {['XAUUSD','BTCUSD','NAS100','Nikkei225','HK50','EURUSD','UNKNOWN'].map((s) =>
              <View key={s} style={{ alignItems: 'center', gap: 4 }}>
                <SymbolIcon symbol={s} size={48} />
                <Text style={{ color: vantage.textMuted, fontFamily, fontSize: sizes.micro }}>{s}</Text>
              </View>
            )}
          </View>
        </Section>

        <Section title="Sparkline">
          <View style={{ flexDirection: 'row', gap: space.lg, alignItems: 'center' }}>
            <Sparkline data={[1,2,1.5,3,2.5,4,3.8,5]} />
            <Sparkline data={[5,4,4.5,3,3.2,2,2.4,1]} />
            <Sparkline data={[3,3.1,2.9,3,3.05,2.95,3.02,3]} />
            <Sparkline data={[]} />
          </View>
        </Section>

        <Section title="InstrumentRow">
          <InstrumentRow symbol="XAUUSD" name="XAUUSD" subtitle="Gold/US Dollar"     price={4442.30} changePct={-1.02} sparkData={[5,4.5,4.2,4.4,4.1,4.0,3.95,3.9]} onPress={() => {}} />
          <InstrumentRow symbol="NAS100" name="NAS100" subtitle="NAS100 Cash"        price={30743.89} changePct={0.06}  sparkData={[1,1.05,1.1,1.05,1.1,1.15,1.12,1.16]} onPress={() => {}} />
          <InstrumentRow symbol="BTCUSD" name="BTCUSD" subtitle="Bitcoin"            price={66831.98} changePct={-1.10} sparkData={[2,2.1,2.05,2.0,1.95,1.9,1.92,1.88]} onPress={() => {}} />
        </Section>

        <Section title="StatCard">
          <View style={{ flexDirection: 'row', gap: space.md }}>
            <StatCard label="30D Return" value="+164.84%" delta="+12% MoM" deltaPositive />
            <StatCard label="AUM" value="$535K" />
            <StatCard label="Drawdown" value="-8.4%" delta="vs -5% avg" deltaPositive={false} />
          </View>
        </Section>

        <Section title="QuickActionTile">
          <View style={{ flexDirection: 'row', gap: space.md }}>
            <QuickActionTile icon={<Ionicons name="gift-outline" size={24} color={vantage.textPrimary} />} label="Promotion" badge="New" onPress={() => {}} />
            <QuickActionTile icon={<Ionicons name="calendar-outline" size={24} color={vantage.textPrimary} />} label="Calendar" onPress={() => {}} />
            <QuickActionTile icon={<Ionicons name="school-outline" size={24} color={vantage.textPrimary} />} label="Academy" onPress={() => {}} />
            <QuickActionTile icon={<Ionicons name="people-outline" size={24} color={vantage.textPrimary} />} label="IB" onPress={() => {}} />
          </View>
        </Section>

        <Section title="MenuRow">
          <Card padding={0}>
            <MenuRow icon={<Ionicons name="card-outline" size={20} color={vantage.textPrimary} />} label="My Accounts" onPress={() => {}} />
            <MenuRow icon={<Ionicons name="shield-checkmark-outline" size={20} color={vantage.up} />} label="KYC" value="Verified" onPress={() => {}} />
            <MenuRow icon={<Ionicons name="globe-outline" size={20} color={vantage.textPrimary} />} label="Language" value="English" onPress={() => {}} />
            <MenuRow icon={<Ionicons name="log-out-outline" size={20} color={vantage.down} />} label="Log Out" danger onPress={() => {}} />
          </Card>
        </Section>

        <Section title="StrategyCard">
          <View style={{ flexDirection: 'row', gap: space.md }}>
            <StrategyCard name="MY CFD Master" category="Commodities" return30d={164.84} aum={535647} status="full" avatarSymbol="MC" onPress={() => {}} />
            <StrategyCard name="DINO Scalping" category="Indices"    return30d={100.45} avatarSymbol="DI" onPress={() => {}} />
          </View>
        </Section>

        <BuySellDemo />
        <BottomNavDemo />
        <BalanceDemo />
        <SheetDemo />
        <ToastDemo />

        <CalendarDemo />
        <SliderDemo />

        <Section title="MoversBars">
          <Card>
            <MoversBars
              direction="up"
              items={[
                { symbol: 'MRVL',  changePct: 30.42 },
                { symbol: 'FCEL',  changePct: 18.01 },
                { symbol: 'WLDUSD',changePct: 17.54 },
                { symbol: 'COHR',  changePct: 16.84 },
                { symbol: 'HPE',   changePct: 16.05 },
              ]}
            />
          </Card>
        </Section>

        <Section title="SpotlightCard">
          <SpotlightCard
            brandLabel="PM"
            items={[
              { symbol: 'XAUUSD', subtitle: 'Gold/US Dollar', price: 4446.11, changePct: -0.94 },
              { symbol: 'Nikkei225', subtitle: 'Nikkei Index Cash CFD (JPY)', price: 68603.73, changePct: 1.63 },
              { symbol: 'BTCUSD', subtitle: 'Bitcoin', price: 66745.44, changePct: -1.23 },
            ]}
          />
        </Section>

        <Section title="EmptyState">
          <Card padding={0}>
            <EmptyState
              icon={<Ionicons name="cube-outline" size={48} color={vantage.textMuted} />}
              title="No positions yet"
              subtitle="Place your first trade to see it here."
              action={<PillButton label="Trade now" variant="primary" onPress={() => {}} />}
            />
          </Card>
        </Section>

        {/* TASKS BELOW APPEND <Section title="X"> blocks here */}
      </ScrollView>
    </SafeAreaView>
  );
}

function BottomNavDemo() {
  const [k, setK] = useState('home');
  const tabs = [
    { key: 'home',    label: 'Home',    icon: <Ionicons name="triangle" size={18} color={vantage.textPrimary} />, iconInactive: <Ionicons name="triangle-outline" size={18} color={vantage.textMuted} /> },
    { key: 'markets', label: 'Markets', icon: <Ionicons name="bar-chart" size={18} color={vantage.textPrimary} />, iconInactive: <Ionicons name="bar-chart-outline" size={18} color={vantage.textMuted} /> },
    { key: 'trade',   label: 'Trade',   icon: <Ionicons name="swap-horizontal" size={18} color={vantage.textPrimary} />, iconInactive: <Ionicons name="swap-horizontal-outline" size={18} color={vantage.textMuted} /> },
    { key: 'funds',   label: 'Funds',   icon: <Ionicons name="pie-chart" size={18} color={vantage.textPrimary} />, iconInactive: <Ionicons name="pie-chart-outline" size={18} color={vantage.textMuted} /> },
  ];
  return (
    <Section title="BottomNavPill">
      <View style={{ height: 100, justifyContent: 'flex-end' }}>
        <BottomNavPill tabs={tabs} activeKey={k} onChange={setK} />
      </View>
    </Section>
  );
}

function BalanceDemo() {
  const [hidden, setHidden] = useState(false);
  return (
    <Section title="BalanceBlock">
      <BalanceBlock
        label="Total Value"
        amount={12345.67}
        hidden={hidden}
        onToggleHide={() => setHidden(!hidden)}
        subLabel="Today's PnL"
        subAmount={24.50}
        subPositive
      />
    </Section>
  );
}

function Section({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Swatch({ color, label }) {
  return (
    <View style={styles.swatchRow}>
      <View style={[styles.swatchBox, { backgroundColor: color }]} />
      <Text style={styles.swatchLabel}>{label}  {color}</Text>
    </View>
  );
}

function BuySellDemo() {
  const [side, setSide] = useState('sell');
  return (
    <Section title="BuySellSplit">
      <BuySellSplit bid={68613.73} ask={68626.73} spreadPoints={1300} side={side} onChange={setSide} changePoints={-223} />
    </Section>
  );
}

function CheckboxDemo() {
  const [c, setC] = useState(false);
  return (
    <Section title="CheckboxRow">
      <CheckboxRow label="TP/SL" checked={c} onChange={setC} />
      <CheckboxRow label="Hide Other Symbols" checked onChange={() => {}} />
      <CheckboxRow label="Disabled" checked={false} onChange={() => {}} disabled />
    </Section>
  );
}

function StepperDemo() {
  const [v, setV] = useState(1);
  return (
    <Section title="NumberStepper">
      <NumberStepper label="Volume" value={v} onChange={setV} step={0.1} precision={2} suffix="Lots" />
    </Section>
  );
}

function SegmentedDemo() {
  const [v, setV] = useState('watchlist');
  return (
    <Section title="SegmentedTabs">
      <SegmentedTabs
        value={v}
        onChange={setV}
        options={[
          { value: 'watchlist', label: 'Watchlist' },
          { value: 'explore', label: 'Explore' },
        ]}
      />
    </Section>
  );
}

function CategoryDemo() {
  const [v, setV] = useState('overview');
  return (
    <Section title="CategoryTabs">
      <CategoryTabs
        value={v}
        onChange={setV}
        options={[
          { value: 'overview', label: 'Overview' },
          { value: 'indices',  label: 'Indices' },
          { value: 'forex',    label: 'Forex' },
          { value: 'crypto',   label: 'Crypto' },
          { value: 'metals',   label: 'Metals' },
          { value: 'shares',   label: 'Shares' },
        ]}
      />
    </Section>
  );
}

function SheetDemo() {
  const [open, setOpen] = useState(false);
  return (
    <Section title="Sheet">
      <PillButton label="Open sheet" variant="secondary" onPress={() => setOpen(true)} />
      <Sheet visible={open} onClose={() => setOpen(false)} title="Pick account">
        <MenuRow icon={<Ionicons name="card-outline" size={20} color={vantage.textPrimary} />} label="Live #24863411" value="$8,345.67" onPress={() => setOpen(false)} />
        <MenuRow icon={<Ionicons name="card-outline" size={20} color={vantage.textPrimary} />} label="Demo #12345"   value="$10,000.00" onPress={() => setOpen(false)} />
      </Sheet>
    </Section>
  );
}

function ToastDemo() {
  return (
    <Section title="Toast">
      <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
        <PillButton label="Info"    variant="secondary" size="sm" fullWidth={false} onPress={() => showToast({ message: 'Just an info toast' })} />
        <PillButton label="Success" variant="secondary" size="sm" fullWidth={false} onPress={() => showToast({ kind: 'success', message: 'Order placed' })} />
        <PillButton label="Error"   variant="secondary" size="sm" fullWidth={false} onPress={() => showToast({ kind: 'error', message: 'Network error' })} />
        <PillButton label="Warn"    variant="secondary" size="sm" fullWidth={false} onPress={() => showToast({ kind: 'warn', message: 'KYC pending' })} />
      </View>
    </Section>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: vantage.bg },
  scroll: { padding: space.lg, paddingBottom: space.huge },
  h1: {
    color: vantage.textPrimary,
    fontFamily,
    fontSize: sizes.hero,
    fontWeight: weights.heavy,
  },
  subtitle: {
    color: vantage.textMuted,
    fontFamily,
    fontSize: sizes.label,
    marginBottom: space.xxl,
  },
  section: { marginBottom: space.xxxl },
  sectionTitle: {
    color: vantage.textSecondary,
    fontFamily,
    fontSize: sizes.label,
    fontWeight: weights.semibold,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: space.md,
  },
  sectionBody: { gap: space.md },
  swatchRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  swatchBox: { width: 32, height: 32, borderRadius: 8, borderWidth: 1, borderColor: vantage.border },
  swatchLabel: { color: vantage.textPrimary, fontFamily, fontSize: sizes.body },
});
