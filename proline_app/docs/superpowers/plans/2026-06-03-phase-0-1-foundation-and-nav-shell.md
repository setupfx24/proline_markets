# Vantage Redesign — Phase 0 + 1: Foundation & Navigation Shell

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a runnable ProlineMarket APK with the Vantage design system in place (tokens + 25 reusable components) and the new 4-tab floating bottom-nav navigation shell hooked up to placeholder tab screens.

**Architecture:** Design-system-first. Build all atomic and compound components in `src/components/vantage/` against `src/theme/vantageTheme.js`. Then replace the existing single stack navigator in `App.js` with a `RootNavigator` that conditionally renders `AuthStack` (placeholder Login) or `MainTabs` (HomeTab + MarketsTab + TradeTab + FundsTab — each a stack with a placeholder root screen). Existing screens (Dashboard, MainTrading, Wallet, etc.) are NOT touched in this plan — they're replaced phase-by-phase later.

**Tech Stack:** React Native 0.81.5 + Expo 54 (Hermes, New Arch), `@react-navigation/native-stack` and `@react-navigation/bottom-tabs` (already in package.json), `react-native-svg` (transitive via Expo), `@expo/vector-icons` for icons. No new npm deps in this phase.

**Verification:** No automated test suite exists per spec §12. Each visual task is verified through the `ComponentGalleryScreen` (created in Task 2) — a dev-only screen that renders the component in isolation. Each navigation task is verified by manual smoke on Android Expo Go.

**Working directory:** `/Users/tarundewangan/Downloads/Projects/ProlineMarket/ProlineMarket_apk` for all paths below (paths shown relative to it).

---

### Task 1: Create theme tokens

**Files:**
- Create: `src/theme/vantageTheme.js`

- [ ] **Step 1: Write the token file**

Create `src/theme/vantageTheme.js`:

```js
import { Platform } from 'react-native';

export const vantage = {
  // Surfaces
  bg:           '#000000',
  bgElevated:   '#0F0F0F',
  bgRaised:     '#161616',
  bgPressed:    '#1F1F1F',
  border:       '#1F1F1F',
  borderStrong: '#2A2A2A',

  // Text
  textPrimary:   '#FFFFFF',
  textSecondary: '#9CA3AF',
  textMuted:     '#6B7280',
  textInverse:   '#000000',

  // Brand
  accent:       '#F26A1F',
  accentGlow:   '#FF8A3D',
  accentMuted:  'rgba(242,106,31,0.12)',

  // Directionals
  up:           '#22C55E',
  upMuted:      'rgba(34,197,94,0.10)',
  down:         '#EF4565',
  downMuted:    'rgba(239,69,101,0.10)',

  // Trade-screen specific
  sellBg:       '#EF4565',
  buyBg:        '#1F1F1F',
  spreadChip:   '#000000',
};

export const fontFamily = Platform.select({ ios: 'System', android: 'Roboto' });

export const weights = {
  regular:  '400',
  medium:   '500',
  semibold: '600',
  bold:     '700',
  heavy:    '800',
};

export const sizes = {
  hero:  32,
  h1:    24,
  h2:    20,
  h3:    17,
  body:  15,
  label: 13,
  micro: 11,
};

export const space = {
  xs:   4,
  sm:   8,
  md:   12,
  lg:   16,
  xl:   20,
  xxl:  24,
  xxxl: 32,
  huge: 48,
};

export const radius = {
  sm:   8,
  md:   12,
  lg:   16,
  xl:   20,
  pill: 999,
};

export default {
  vantage,
  fontFamily,
  weights,
  sizes,
  space,
  radius,
};
```

- [ ] **Step 2: Verify it loads without syntax errors**

Run from APK directory:
```bash
node -e "console.log(require('./src/theme/vantageTheme.js').vantage.accent)"
```
Expected output: `#F26A1F`

- [ ] **Step 3: Commit (if git initialized)**

```bash
git add src/theme/vantageTheme.js && git commit -m "feat(theme): add Vantage design tokens"
```
If `git` is not initialized in the APK folder, skip this step for all tasks. The plan does not require git.

---

### Task 2: Create dev-only ComponentGalleryScreen + initial folder structure

**Files:**
- Create: `src/components/vantage/index.js` (empty barrel — exports added per task)
- Create: `src/screens/_dev/ComponentGalleryScreen.js`

- [ ] **Step 1: Create the vantage components folder with an empty barrel**

Create `src/components/vantage/index.js`:

```js
// Barrel export. Each new component appends one line here.
```

- [ ] **Step 2: Write the gallery screen**

Create `src/screens/_dev/ComponentGalleryScreen.js`:

```js
import React, { useState } from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { vantage, space, sizes, weights, fontFamily } from '../../theme/vantageTheme';

// Components are imported and rendered here as they're built.
// Add a new Section() per component task.

export default function ComponentGalleryScreen() {
  return (
    <SafeAreaView style={styles.root} edges={['top']}>
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

        {/* TASKS BELOW APPEND <Section title="X"> blocks here */}
      </ScrollView>
    </SafeAreaView>
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
```

- [ ] **Step 3: Temporarily route the existing app to this gallery for smoke-testing**

Modify `App.js`. Find the `initialRouteName="Login"` and change it to `"Gallery"`, then add a `<Stack.Screen name="Gallery" component={ComponentGalleryScreen} />` entry. Import: `import ComponentGalleryScreen from './src/screens/_dev/ComponentGalleryScreen';`

This is reverted in Task 27 (when MainTabs takes over the root).

- [ ] **Step 4: Smoke check**

Run `npx expo start` from the APK directory. On the device or emulator, expect to see the gallery screen with theme swatches. The screen should be pure black background with white text and orange/green/red swatches.

- [ ] **Step 5: Commit**

```bash
git add src/components/vantage/index.js src/screens/_dev/ComponentGalleryScreen.js App.js && git commit -m "feat(gallery): add dev-only component gallery screen"
```

---

### Task 3: `Screen` wrapper

**Files:**
- Create: `src/components/vantage/Screen.js`
- Modify: `src/components/vantage/index.js`
- Modify: `src/screens/_dev/ComponentGalleryScreen.js`

- [ ] **Step 1: Write the component**

Create `src/components/vantage/Screen.js`:

```js
import React from 'react';
import { View, StatusBar, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { vantage } from '../../theme/vantageTheme';

export default function Screen({ children, edges = ['top'], style }) {
  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={vantage.bg} translucent={false} />
      <SafeAreaView style={[styles.safe, style]} edges={edges}>
        {children}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: vantage.bg },
  safe: { flex: 1, backgroundColor: vantage.bg },
});
```

- [ ] **Step 2: Add to barrel**

Append to `src/components/vantage/index.js`:
```js
export { default as Screen } from './Screen';
```

- [ ] **Step 3: Add to gallery**

In `ComponentGalleryScreen.js`, the gallery itself already uses `SafeAreaView` so no demo row needed. Add a confirmation section after `Theme tokens` section:
```jsx
<Section title="Screen">
  <Text style={{ color: vantage.textSecondary, fontFamily, fontSize: sizes.body }}>
    Screen wraps any route with bg + SafeArea + light StatusBar.
  </Text>
</Section>
```

- [ ] **Step 4: Smoke check**

Reload Expo. Section appears, no errors in console.

- [ ] **Step 5: Commit**

```bash
git add src/components/vantage/Screen.js src/components/vantage/index.js src/screens/_dev/ComponentGalleryScreen.js && git commit -m "feat(vantage): add Screen wrapper component"
```

---

### Task 4: `Card`

**Files:**
- Create: `src/components/vantage/Card.js`
- Modify: `src/components/vantage/index.js`
- Modify: `src/screens/_dev/ComponentGalleryScreen.js`

- [ ] **Step 1: Write the component**

Create `src/components/vantage/Card.js`:

```js
import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { vantage, space, radius } from '../../theme/vantageTheme';

export default function Card({
  children,
  padding = space.lg,
  borderRadius = radius.lg,
  variant = 'elevated', // 'elevated' | 'raised' | 'outline'
  onPress,
  style,
}) {
  const bg =
    variant === 'raised' ? vantage.bgRaised :
    variant === 'outline' ? 'transparent' :
    vantage.bgElevated;
  const border = variant === 'outline' ? vantage.borderStrong : 'transparent';

  const inner = (
    <View
      style={[
        styles.card,
        { backgroundColor: bg, borderColor: border, borderWidth: variant === 'outline' ? 1 : 0, padding, borderRadius },
        style,
      ]}
    >
      {children}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        android_ripple={{ color: vantage.bgPressed, borderless: false }}
        accessibilityRole="button"
      >
        {({ pressed }) => (
          <View style={pressed ? { opacity: 0.85 } : null}>{inner}</View>
        )}
      </Pressable>
    );
  }
  return inner;
}

const styles = StyleSheet.create({
  card: {},
});
```

- [ ] **Step 2: Add to barrel**

Append: `export { default as Card } from './Card';`

- [ ] **Step 3: Add demo to gallery**

In `ComponentGalleryScreen.js`, import `Card` from `../../components/vantage` and add:

```jsx
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
```

- [ ] **Step 4: Smoke check**

Three cards visible in gallery with different surfaces. Tap on the fourth → "card pressed" logs in Metro.

- [ ] **Step 5: Commit**

```bash
git add src/components/vantage/Card.js src/components/vantage/index.js src/screens/_dev/ComponentGalleryScreen.js && git commit -m "feat(vantage): add Card component"
```

---

### Task 5: `PillButton`

**Files:**
- Create: `src/components/vantage/PillButton.js`
- Modify: `src/components/vantage/index.js`
- Modify: `src/screens/_dev/ComponentGalleryScreen.js`

- [ ] **Step 1: Write the component**

Create `src/components/vantage/PillButton.js`:

```js
import React from 'react';
import { Pressable, Text, ActivityIndicator, View, StyleSheet } from 'react-native';
import { vantage, space, sizes, weights, fontFamily, radius } from '../../theme/vantageTheme';

const VARIANTS = {
  primary:   { bg: vantage.accent,   fg: vantage.textInverse, pressed: vantage.accentGlow },
  secondary: { bg: vantage.bgRaised, fg: vantage.textPrimary, pressed: vantage.bgPressed },
  sell:      { bg: vantage.sellBg,   fg: vantage.textPrimary, pressed: '#D63D5C' },
  buy:       { bg: vantage.up,       fg: vantage.textPrimary, pressed: '#1FA958' },
  danger:    { bg: 'transparent',    fg: vantage.down,        pressed: vantage.downMuted, borderColor: vantage.down },
  ghost:     { bg: 'transparent',    fg: vantage.textPrimary, pressed: vantage.bgPressed },
};

const SIZES = {
  sm: { paddingV: space.sm,  paddingH: space.lg, font: sizes.label, height: 36 },
  md: { paddingV: space.md,  paddingH: space.xl, font: sizes.body,  height: 48 },
  lg: { paddingV: space.lg,  paddingH: space.xxl,font: sizes.h3,    height: 56 },
};

export default function PillButton({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  leftIcon,
  rightIcon,
  fullWidth = true,
  style,
}) {
  const v = VARIANTS[variant];
  const s = SIZES[size];
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={isDisabled ? undefined : onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: pressed && !isDisabled ? v.pressed : v.bg,
          borderColor: v.borderColor || 'transparent',
          borderWidth: v.borderColor ? 1 : 0,
          paddingVertical: s.paddingV,
          paddingHorizontal: s.paddingH,
          opacity: isDisabled ? 0.5 : 1,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          minHeight: s.height,
        },
        style,
      ]}
    >
      <View style={styles.row}>
        {loading ? (
          <ActivityIndicator color={v.fg} />
        ) : (
          <>
            {leftIcon ? <View style={styles.iconL}>{leftIcon}</View> : null}
            <Text style={{ color: v.fg, fontFamily, fontSize: s.font, fontWeight: weights.bold }}>
              {label}
            </Text>
            {rightIcon ? <View style={styles.iconR}>{rightIcon}</View> : null}
          </>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  iconL: { marginRight: space.sm },
  iconR: { marginLeft: space.sm },
});
```

- [ ] **Step 2: Add to barrel**

Append: `export { default as PillButton } from './PillButton';`

- [ ] **Step 3: Add demo to gallery**

Import `PillButton`. Add:

```jsx
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
```

- [ ] **Step 4: Smoke check**

Reload. All 9 buttons render. Each one's tap shows the pressed-color flash. Disabled is dimmed and doesn't react. Loading shows spinner.

- [ ] **Step 5: Commit**

```bash
git add src/components/vantage/PillButton.js src/components/vantage/index.js src/screens/_dev/ComponentGalleryScreen.js && git commit -m "feat(vantage): add PillButton component with 6 variants"
```

---

### Task 6: `IconButton`

**Files:**
- Create: `src/components/vantage/IconButton.js`
- Modify: `src/components/vantage/index.js`
- Modify: `src/screens/_dev/ComponentGalleryScreen.js`

- [ ] **Step 1: Write the component**

Create `src/components/vantage/IconButton.js`:

```js
import React from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import { vantage, space } from '../../theme/vantageTheme';

const SIZES = { sm: 32, md: 40, lg: 48 };

export default function IconButton({
  icon,             // a rendered Ionicons / MaterialIcons element
  onPress,
  size = 'md',
  variant = 'ghost', // 'ghost' | 'filled' | 'badge'
  badgeColor,
  accessibilityLabel,
  style,
}) {
  const dim = SIZES[size];
  const bg = variant === 'filled' ? vantage.bgRaised : 'transparent';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.base,
        {
          width: dim,
          height: dim,
          borderRadius: dim / 2,
          backgroundColor: pressed ? vantage.bgPressed : bg,
        },
        style,
      ]}
    >
      {icon}
      {badgeColor ? (
        <View style={[styles.badge, { backgroundColor: badgeColor }]} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
```

- [ ] **Step 2: Add to barrel**

Append: `export { default as IconButton } from './IconButton';`

- [ ] **Step 3: Add demo to gallery**

Import `IconButton` and `Ionicons`:

```jsx
import { Ionicons } from '@expo/vector-icons';
// ...
<Section title="IconButton">
  <View style={{ flexDirection: 'row', gap: space.md }}>
    <IconButton icon={<Ionicons name="search" size={20} color={vantage.textPrimary} />} accessibilityLabel="Search" onPress={() => {}} />
    <IconButton icon={<Ionicons name="chatbubble-outline" size={20} color={vantage.textPrimary} />} badgeColor={vantage.down} accessibilityLabel="Support (unread)" onPress={() => {}} />
    <IconButton variant="filled" icon={<Ionicons name="chevron-back" size={20} color={vantage.textPrimary} />} accessibilityLabel="Back" onPress={() => {}} />
    <IconButton size="lg" variant="filled" icon={<Ionicons name="notifications-outline" size={22} color={vantage.textPrimary} />} accessibilityLabel="Notifications" onPress={() => {}} />
  </View>
</Section>
```

- [ ] **Step 4: Smoke check**

Reload. Four icon buttons in a row. The chat one has a red dot top-right.

- [ ] **Step 5: Commit**

```bash
git add src/components/vantage/IconButton.js src/components/vantage/index.js src/screens/_dev/ComponentGalleryScreen.js && git commit -m "feat(vantage): add IconButton component"
```

---

### Task 7: `CheckboxRow` + `NumberStepper`

Two small primitives bundled (each ~40 lines).

**Files:**
- Create: `src/components/vantage/CheckboxRow.js`
- Create: `src/components/vantage/NumberStepper.js`
- Modify: `src/components/vantage/index.js`
- Modify: `src/screens/_dev/ComponentGalleryScreen.js`

- [ ] **Step 1: Write CheckboxRow**

Create `src/components/vantage/CheckboxRow.js`:

```js
import React from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { vantage, space, sizes, fontFamily } from '../../theme/vantageTheme';

export default function CheckboxRow({ label, checked, onChange, disabled = false }) {
  return (
    <Pressable
      onPress={disabled ? undefined : () => onChange(!checked)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      style={styles.row}
    >
      <View style={[
        styles.box,
        { backgroundColor: checked ? vantage.accent : 'transparent', borderColor: checked ? vantage.accent : vantage.borderStrong, opacity: disabled ? 0.5 : 1 },
      ]}>
        {checked ? <Ionicons name="checkmark" size={14} color={vantage.textInverse} /> : null}
      </View>
      <Text style={[styles.label, { opacity: disabled ? 0.5 : 1 }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  box: { width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  label: { color: vantage.textPrimary, fontFamily, fontSize: sizes.body },
});
```

- [ ] **Step 2: Write NumberStepper**

Create `src/components/vantage/NumberStepper.js`:

```js
import React from 'react';
import { View, Text, Pressable, TextInput, StyleSheet } from 'react-native';
import { vantage, space, sizes, weights, fontFamily, radius } from '../../theme/vantageTheme';

export default function NumberStepper({
  value,
  onChange,
  min = 0,
  max = Infinity,
  step = 1,
  precision = 0,        // decimal places
  label,
  suffix,
}) {
  const clamp = (n) => Math.min(max, Math.max(min, n));
  const dec = () => onChange(clamp(Number(value) - step));
  const inc = () => onChange(clamp(Number(value) + step));
  const onText = (t) => {
    const n = Number(t.replace(',', '.'));
    if (Number.isFinite(n)) onChange(clamp(n));
  };
  const display = precision > 0 ? Number(value).toFixed(precision) : String(value);

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.row}>
        <Pressable onPress={dec} style={styles.btn} accessibilityRole="button" accessibilityLabel="Decrease">
          <Text style={styles.btnTxt}>−</Text>
        </Pressable>
        <View style={styles.center}>
          <TextInput
            value={display}
            onChangeText={onText}
            keyboardType="numeric"
            style={styles.input}
            selectTextOnFocus
          />
          {suffix ? <Text style={styles.suffix}>{suffix}</Text> : null}
        </View>
        <Pressable onPress={inc} style={styles.btn} accessibilityRole="button" accessibilityLabel="Increase">
          <Text style={styles.btnTxt}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  label: { color: vantage.textSecondary, fontFamily, fontSize: sizes.label },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: vantage.bgRaised,
    borderRadius: radius.md,
    paddingHorizontal: space.sm,
    height: 52,
  },
  btn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  btnTxt: { color: vantage.textPrimary, fontFamily, fontSize: sizes.h2, fontWeight: weights.heavy },
  center: { flex: 1, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  input: { color: vantage.textPrimary, fontFamily, fontSize: sizes.h3, fontWeight: weights.bold, textAlign: 'center', minWidth: 40, padding: 0 },
  suffix: { color: vantage.textMuted, fontFamily, fontSize: sizes.label, marginLeft: space.xs },
});
```

- [ ] **Step 3: Add to barrel**

Append:
```js
export { default as CheckboxRow } from './CheckboxRow';
export { default as NumberStepper } from './NumberStepper';
```

- [ ] **Step 4: Add demos to gallery**

```jsx
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
```

Render `<CheckboxDemo />` and `<StepperDemo />` inside the gallery's ScrollView.

- [ ] **Step 5: Smoke check**

Reload. Checkbox toggles state. Stepper +/- adjusts the value with 2 decimal places. Typing directly into the input works.

- [ ] **Step 6: Commit**

```bash
git add src/components/vantage/CheckboxRow.js src/components/vantage/NumberStepper.js src/components/vantage/index.js src/screens/_dev/ComponentGalleryScreen.js && git commit -m "feat(vantage): add CheckboxRow and NumberStepper"
```

---

### Task 8: `SegmentedTabs`

**Files:**
- Create: `src/components/vantage/SegmentedTabs.js`
- Modify: `src/components/vantage/index.js`
- Modify: `src/screens/_dev/ComponentGalleryScreen.js`

- [ ] **Step 1: Write the component**

Create `src/components/vantage/SegmentedTabs.js`:

```js
import React from 'react';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { vantage, space, sizes, weights, fontFamily } from '../../theme/vantageTheme';

export default function SegmentedTabs({ value, onChange, options }) {
  return (
    <View style={styles.row}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={styles.tab}
          >
            <Text style={[
              styles.label,
              { color: active ? vantage.textPrimary : vantage.textMuted, fontWeight: active ? weights.heavy : weights.medium }
            ]}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.xl, paddingVertical: space.sm },
  tab: { paddingVertical: space.xs },
  label: { fontFamily, fontSize: sizes.h2 },
});
```

- [ ] **Step 2: Add to barrel**

```js
export { default as SegmentedTabs } from './SegmentedTabs';
```

- [ ] **Step 3: Demo**

```jsx
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
```

- [ ] **Step 4: Smoke check**

Active tab is bold white, inactive is grey. Tap switches.

- [ ] **Step 5: Commit**

```bash
git add src/components/vantage/SegmentedTabs.js src/components/vantage/index.js src/screens/_dev/ComponentGalleryScreen.js && git commit -m "feat(vantage): add SegmentedTabs"
```

---

### Task 9: `CategoryTabs`

**Files:**
- Create: `src/components/vantage/CategoryTabs.js`
- Modify: `src/components/vantage/index.js`
- Modify: `src/screens/_dev/ComponentGalleryScreen.js`

- [ ] **Step 1: Write the component**

Create `src/components/vantage/CategoryTabs.js`:

```js
import React from 'react';
import { View, Pressable, Text, ScrollView, StyleSheet } from 'react-native';
import { vantage, space, sizes, weights, fontFamily } from '../../theme/vantageTheme';

export default function CategoryTabs({ value, onChange, options }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={styles.tab}
          >
            <Text style={[
              styles.label,
              { color: active ? vantage.textPrimary : vantage.textMuted, fontWeight: active ? weights.bold : weights.medium }
            ]}>
              {o.label}
            </Text>
            <View style={[styles.underline, { backgroundColor: active ? vantage.accent : 'transparent' }]} />
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: space.xl, paddingHorizontal: space.lg, paddingVertical: space.sm },
  tab: { paddingVertical: space.sm, alignItems: 'center' },
  label: { fontFamily, fontSize: sizes.h3, marginBottom: space.xs },
  underline: { height: 2, width: 24, borderRadius: 2 },
});
```

- [ ] **Step 2: Add to barrel**

```js
export { default as CategoryTabs } from './CategoryTabs';
```

- [ ] **Step 3: Demo**

```jsx
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
```

- [ ] **Step 4: Smoke check**

Horizontal scroll works. Active tab has orange underline below it. Tap switches.

- [ ] **Step 5: Commit**

```bash
git add src/components/vantage/CategoryTabs.js src/components/vantage/index.js src/screens/_dev/ComponentGalleryScreen.js && git commit -m "feat(vantage): add CategoryTabs"
```

---

### Task 10: `SymbolIcon`

Pure-CSS colored circle. No images needed.

**Files:**
- Create: `src/components/vantage/SymbolIcon.js`
- Modify: `src/components/vantage/index.js`
- Modify: `src/screens/_dev/ComponentGalleryScreen.js`

- [ ] **Step 1: Write the component**

Create `src/components/vantage/SymbolIcon.js`:

```js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { vantage, sizes, weights, fontFamily } from '../../theme/vantageTheme';

// Curated palette per symbol/asset class
const SYMBOL_COLORS = {
  XAUUSD:   { bg: '#E8A53A', initials: 'Au' },
  XAGUSD:   { bg: '#B8C2CC', initials: 'Ag' },
  BTCUSD:   { bg: '#F7931A', initials: '₿' },
  ETHUSD:   { bg: '#627EEA', initials: 'Ξ' },
  EURUSD:   { bg: '#3D7AC7', initials: 'EU' },
  GBPUSD:   { bg: '#7E3D7B', initials: 'UK' },
  USDJPY:   { bg: '#BC002D', initials: '¥' },
  NAS100:   { bg: '#3DA0E2', initials: '100' },
  Nikkei225:{ bg: '#1A2D5E', initials: '225' },
  JPN225ft: { bg: '#FFFFFF', initials: '•',  fg: '#BC002D' },
  HK50:     { bg: '#E5343D', initials: '✦' },
  HK50ft:   { bg: '#E5343D', initials: '✦' },
  DJ30:     { bg: '#3A8FE0', initials: 'DJ' },
  SP500:    { bg: '#4DA89B', initials: '500' },
};

function hashColor(sym) {
  let h = 0;
  for (let i = 0; i < sym.length; i++) h = (h * 31 + sym.charCodeAt(i)) & 0xffffff;
  const r = (h >> 16) & 0xff, g = (h >> 8) & 0xff, b = h & 0xff;
  return `rgb(${r},${g},${b})`;
}

export default function SymbolIcon({ symbol, size = 40 }) {
  const cfg = SYMBOL_COLORS[symbol];
  const bg = cfg ? cfg.bg : hashColor(symbol);
  const fg = cfg && cfg.fg ? cfg.fg : vantage.textPrimary;
  const initials = cfg ? cfg.initials : symbol.slice(0, 2).toUpperCase();
  const fontSize = Math.max(10, Math.floor(size * 0.36));

  return (
    <View style={[styles.base, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
      <Text style={{ color: fg, fontFamily, fontSize, fontWeight: weights.heavy }}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
});
```

- [ ] **Step 2: Add to barrel**

```js
export { default as SymbolIcon } from './SymbolIcon';
```

- [ ] **Step 3: Demo**

```jsx
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
```

- [ ] **Step 4: Smoke check**

7 circles render in a row. UNKNOWN gets a stable hashed color with first two letters as initials.

- [ ] **Step 5: Commit**

```bash
git add src/components/vantage/SymbolIcon.js src/components/vantage/index.js src/screens/_dev/ComponentGalleryScreen.js && git commit -m "feat(vantage): add SymbolIcon with curated palette + hash fallback"
```

---

### Task 11: `Sparkline`

SVG mini chart, green if up else red. No external dep.

**Files:**
- Create: `src/components/vantage/Sparkline.js`
- Modify: `src/components/vantage/index.js`
- Modify: `src/screens/_dev/ComponentGalleryScreen.js`

- [ ] **Step 1: Verify react-native-svg is available**

Run from APK directory:
```bash
node -e "require('react-native-svg')"
```
Expected: no error (it's a transitive dep through Expo). If error, install it: `npx expo install react-native-svg`.

- [ ] **Step 2: Write the component**

Create `src/components/vantage/Sparkline.js`:

```js
import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { vantage } from '../../theme/vantageTheme';

export default function Sparkline({
  data = [],
  width = 80,
  height = 28,
  strokeWidth = 1.5,
  color,            // explicit override
}) {
  const { path, autoColor } = useMemo(() => {
    if (!Array.isArray(data) || data.length < 2) {
      return { path: '', autoColor: vantage.textMuted };
    }
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const stepX = width / (data.length - 1);

    let d = '';
    data.forEach((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / range) * height;
      d += (i === 0 ? 'M' : 'L') + x.toFixed(2) + ' ' + y.toFixed(2) + ' ';
    });
    const up = data[data.length - 1] >= data[0];
    return { path: d.trim(), autoColor: up ? vantage.up : vantage.down };
  }, [data, width, height]);

  const stroke = color || autoColor;

  return (
    <View style={{ width, height }}>
      {path ? (
        <Svg width={width} height={height}>
          <Path d={path} stroke={stroke} strokeWidth={strokeWidth} fill="none" />
        </Svg>
      ) : null}
    </View>
  );
}
```

- [ ] **Step 3: Add to barrel**

```js
export { default as Sparkline } from './Sparkline';
```

- [ ] **Step 4: Demo**

```jsx
<Section title="Sparkline">
  <View style={{ flexDirection: 'row', gap: space.lg, alignItems: 'center' }}>
    <Sparkline data={[1,2,1.5,3,2.5,4,3.8,5]} />
    <Sparkline data={[5,4,4.5,3,3.2,2,2.4,1]} />
    <Sparkline data={[3,3.1,2.9,3,3.05,2.95,3.02,3]} />
    <Sparkline data={[]} />
  </View>
</Section>
```

- [ ] **Step 5: Smoke check**

3 sparklines render: first green (up), second red (down), third neutral grey (insufficient range). Fourth is empty placeholder.

- [ ] **Step 6: Commit**

```bash
git add src/components/vantage/Sparkline.js src/components/vantage/index.js src/screens/_dev/ComponentGalleryScreen.js && git commit -m "feat(vantage): add Sparkline SVG component"
```

---

### Task 12: `InstrumentRow`

Composes SymbolIcon + Sparkline + price display.

**Files:**
- Create: `src/components/vantage/InstrumentRow.js`
- Modify: `src/components/vantage/index.js`
- Modify: `src/screens/_dev/ComponentGalleryScreen.js`

- [ ] **Step 1: Write the component**

Create `src/components/vantage/InstrumentRow.js`:

```js
import React, { memo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import SymbolIcon from './SymbolIcon';
import Sparkline from './Sparkline';
import { vantage, space, sizes, weights, fontFamily } from '../../theme/vantageTheme';

function InstrumentRow({
  symbol,
  name,
  subtitle,
  price,
  changePct,
  sparkData,
  onPress,
  rightExtra,
}) {
  const positive = (changePct ?? 0) >= 0;
  const sparkColor = positive ? vantage.up : vantage.down;
  const rowTint = positive ? vantage.upMuted : vantage.downMuted;

  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: vantage.bgPressed }}
      accessibilityRole="button"
      style={styles.row}
    >
      <View style={[styles.tint, { backgroundColor: rowTint }]} />
      <SymbolIcon symbol={symbol} size={40} />
      <View style={styles.left}>
        <Text style={styles.name} numberOfLines={1}>{name || symbol}</Text>
        {subtitle ? <Text style={styles.sub} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      <View style={styles.spark}>
        <Sparkline data={sparkData || []} color={sparkColor} width={64} height={28} />
      </View>
      <View style={styles.right}>
        <Text style={styles.price}>{formatPrice(price)}</Text>
        <Text style={[styles.pct, { color: positive ? vantage.up : vantage.down }]}>
          {changePct != null ? `${positive ? '+' : ''}${changePct.toFixed(2)}%` : '—'}
        </Text>
      </View>
      {rightExtra}
    </Pressable>
  );
}

function formatPrice(p) {
  if (p == null || !Number.isFinite(p)) return '—';
  if (p >= 1000) return p.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (p >= 1) return p.toFixed(2);
  return p.toFixed(5);
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    gap: space.md,
    position: 'relative',
  },
  tint: { ...StyleSheet.absoluteFillObject, opacity: 0.6 },
  left: { flex: 1, minWidth: 0 },
  name: { color: vantage.textPrimary, fontFamily, fontSize: sizes.h3, fontWeight: weights.bold },
  sub: { color: vantage.textMuted, fontFamily, fontSize: sizes.label, marginTop: 2 },
  spark: { width: 64 },
  right: { alignItems: 'flex-end', minWidth: 90 },
  price: { color: vantage.textPrimary, fontFamily, fontSize: sizes.h3, fontWeight: weights.bold },
  pct: { fontFamily, fontSize: sizes.label, marginTop: 2 },
});

export default memo(InstrumentRow);
```

- [ ] **Step 2: Add to barrel**

```js
export { default as InstrumentRow } from './InstrumentRow';
```

- [ ] **Step 3: Demo**

```jsx
<Section title="InstrumentRow">
  <InstrumentRow symbol="XAUUSD" name="XAUUSD" subtitle="Gold/US Dollar"     price={4442.30} changePct={-1.02} sparkData={[5,4.5,4.2,4.4,4.1,4.0,3.95,3.9]} onPress={() => {}} />
  <InstrumentRow symbol="NAS100" name="NAS100" subtitle="NAS100 Cash"        price={30743.89} changePct={0.06}  sparkData={[1,1.05,1.1,1.05,1.1,1.15,1.12,1.16]} onPress={() => {}} />
  <InstrumentRow symbol="BTCUSD" name="BTCUSD" subtitle="Bitcoin"            price={66831.98} changePct={-1.10} sparkData={[2,2.1,2.05,2.0,1.95,1.9,1.92,1.88]} onPress={() => {}} />
</Section>
```

- [ ] **Step 4: Smoke check**

Three rows render with the tinted background (green-faint for positive, red-faint for negative). Sparkline color matches direction. Tap shows ripple on Android.

- [ ] **Step 5: Commit**

```bash
git add src/components/vantage/InstrumentRow.js src/components/vantage/index.js src/screens/_dev/ComponentGalleryScreen.js && git commit -m "feat(vantage): add InstrumentRow"
```

---

### Task 13: `StatCard`

**Files:**
- Create: `src/components/vantage/StatCard.js`
- Modify: `src/components/vantage/index.js`
- Modify: `src/screens/_dev/ComponentGalleryScreen.js`

- [ ] **Step 1: Write the component**

Create `src/components/vantage/StatCard.js`:

```js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Card from './Card';
import { vantage, space, sizes, weights, fontFamily } from '../../theme/vantageTheme';

export default function StatCard({ label, value, delta, deltaPositive }) {
  return (
    <Card style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
      {delta != null ? (
        <Text style={[styles.delta, { color: deltaPositive ? vantage.up : vantage.down }]}>
          {delta}
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  wrap: { minWidth: 110, gap: 2 },
  label: { color: vantage.textMuted, fontFamily, fontSize: sizes.label },
  value: { color: vantage.textPrimary, fontFamily, fontSize: sizes.h2, fontWeight: weights.heavy },
  delta: { fontFamily, fontSize: sizes.label, marginTop: 2 },
});
```

- [ ] **Step 2: Add to barrel**

```js
export { default as StatCard } from './StatCard';
```

- [ ] **Step 3: Demo**

```jsx
<Section title="StatCard">
  <View style={{ flexDirection: 'row', gap: space.md }}>
    <StatCard label="30D Return" value="+164.84%" delta="+12% MoM" deltaPositive />
    <StatCard label="AUM" value="$535K" />
    <StatCard label="Drawdown" value="-8.4%" delta="vs -5% avg" deltaPositive={false} />
  </View>
</Section>
```

- [ ] **Step 4: Smoke check** — three cards in a row, deltas colored correctly.

- [ ] **Step 5: Commit**

```bash
git add src/components/vantage/StatCard.js src/components/vantage/index.js src/screens/_dev/ComponentGalleryScreen.js && git commit -m "feat(vantage): add StatCard"
```

---

### Task 14: `QuickActionTile`

**Files:**
- Create: `src/components/vantage/QuickActionTile.js`
- Modify: `src/components/vantage/index.js`
- Modify: `src/screens/_dev/ComponentGalleryScreen.js`

- [ ] **Step 1: Write the component**

Create `src/components/vantage/QuickActionTile.js`:

```js
import React from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import { vantage, space, sizes, weights, fontFamily, radius } from '../../theme/vantageTheme';

export default function QuickActionTile({
  icon,
  label,
  onPress,
  badge,        // optional string e.g. "New"
  size = 56,
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={styles.wrap}>
      <View style={[styles.icon, { width: size, height: size, borderRadius: size / 2 }]}>
        {icon}
        {badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeTxt}>{badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.label} numberOfLines={2}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: space.xs, flex: 1 },
  icon: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: vantage.bgElevated,
    borderWidth: 1,
    borderColor: vantage.border,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -6,
    left: -10,
    backgroundColor: vantage.accent,
    paddingHorizontal: space.xs + 2,
    paddingVertical: 1,
    borderRadius: radius.sm,
  },
  badgeTxt: { color: vantage.textInverse, fontFamily, fontSize: sizes.micro, fontWeight: weights.heavy },
  label: { color: vantage.textPrimary, fontFamily, fontSize: sizes.label, textAlign: 'center' },
});
```

- [ ] **Step 2: Add to barrel**

```js
export { default as QuickActionTile } from './QuickActionTile';
```

- [ ] **Step 3: Demo**

```jsx
<Section title="QuickActionTile">
  <View style={{ flexDirection: 'row', gap: space.md }}>
    <QuickActionTile icon={<Ionicons name="gift-outline" size={24} color={vantage.textPrimary} />} label="Promotion" badge="New" onPress={() => {}} />
    <QuickActionTile icon={<Ionicons name="calendar-outline" size={24} color={vantage.textPrimary} />} label="Calendar" onPress={() => {}} />
    <QuickActionTile icon={<Ionicons name="school-outline" size={24} color={vantage.textPrimary} />} label="Academy" onPress={() => {}} />
    <QuickActionTile icon={<Ionicons name="people-outline" size={24} color={vantage.textPrimary} />} label="IB" onPress={() => {}} />
  </View>
</Section>
```

- [ ] **Step 4: Smoke check** — 4 tiles in a row, "Promotion" shows the orange "New" badge top-left.

- [ ] **Step 5: Commit**

```bash
git add src/components/vantage/QuickActionTile.js src/components/vantage/index.js src/screens/_dev/ComponentGalleryScreen.js && git commit -m "feat(vantage): add QuickActionTile"
```

---

### Task 15: `MenuRow`

Profile-menu row primitive (icon + label + value + chevron).

**Files:**
- Create: `src/components/vantage/MenuRow.js`
- Modify: `src/components/vantage/index.js`
- Modify: `src/screens/_dev/ComponentGalleryScreen.js`

- [ ] **Step 1: Write the component**

Create `src/components/vantage/MenuRow.js`:

```js
import React from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { vantage, space, sizes, weights, fontFamily } from '../../theme/vantageTheme';

export default function MenuRow({ icon, label, value, onPress, danger = false }) {
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: vantage.bgPressed }}
      accessibilityRole="button"
      style={styles.row}
    >
      <View style={styles.iconBox}>{icon}</View>
      <Text style={[styles.label, danger && { color: vantage.down }]}>{label}</Text>
      <View style={styles.right}>
        {value ? <Text style={styles.value}>{value}</Text> : null}
        <Ionicons name="chevron-forward" size={16} color={vantage.textMuted} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    gap: space.md,
    minHeight: 52,
  },
  iconBox: { width: 24, alignItems: 'center' },
  label: { flex: 1, color: vantage.textPrimary, fontFamily, fontSize: sizes.body, fontWeight: weights.medium },
  right: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  value: { color: vantage.textMuted, fontFamily, fontSize: sizes.label },
});
```

- [ ] **Step 2: Add to barrel**

```js
export { default as MenuRow } from './MenuRow';
```

- [ ] **Step 3: Demo**

```jsx
<Section title="MenuRow">
  <Card padding={0}>
    <MenuRow icon={<Ionicons name="card-outline" size={20} color={vantage.textPrimary} />} label="My Accounts" onPress={() => {}} />
    <MenuRow icon={<Ionicons name="shield-checkmark-outline" size={20} color={vantage.up} />} label="KYC" value="Verified" onPress={() => {}} />
    <MenuRow icon={<Ionicons name="globe-outline" size={20} color={vantage.textPrimary} />} label="Language" value="English" onPress={() => {}} />
    <MenuRow icon={<Ionicons name="log-out-outline" size={20} color={vantage.down} />} label="Log Out" danger onPress={() => {}} />
  </Card>
</Section>
```

- [ ] **Step 4: Smoke check** — 4 menu rows inside one card; logout label is red.

- [ ] **Step 5: Commit**

```bash
git add src/components/vantage/MenuRow.js src/components/vantage/index.js src/screens/_dev/ComponentGalleryScreen.js && git commit -m "feat(vantage): add MenuRow"
```

---

### Task 16: `StrategyCard`

**Files:**
- Create: `src/components/vantage/StrategyCard.js`
- Modify: `src/components/vantage/index.js`
- Modify: `src/screens/_dev/ComponentGalleryScreen.js`

- [ ] **Step 1: Write the component**

Create `src/components/vantage/StrategyCard.js`:

```js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Card from './Card';
import SymbolIcon from './SymbolIcon';
import { vantage, space, sizes, weights, fontFamily, radius } from '../../theme/vantageTheme';

export default function StrategyCard({
  name,
  category,
  return30d,
  aum,
  status,             // 'open' | 'full'
  avatarSymbol,       // used by SymbolIcon as a fallback avatar
  onPress,
  width = 220,
}) {
  const positive = (return30d ?? 0) >= 0;
  return (
    <Card onPress={onPress} style={{ width }} padding={space.lg}>
      <View style={styles.head}>
        <SymbolIcon symbol={avatarSymbol || name?.slice(0, 2) || '??'} size={36} />
        <View style={styles.headText}>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          {category ? <View style={styles.badge}><Text style={styles.badgeTxt}>{category}</Text></View> : null}
        </View>
        {status === 'full' ? <View style={styles.full}><Text style={styles.fullTxt}>Full</Text></View> : null}
      </View>
      <View style={styles.stats}>
        <Text style={styles.lab}>30D Return</Text>
        <Text style={[styles.val, { color: positive ? vantage.up : vantage.down }]}>
          {return30d != null ? `${positive ? '+' : ''}${return30d.toFixed(2)}%` : '—'}
        </Text>
      </View>
      {aum != null ? (
        <View style={styles.stats}>
          <Text style={styles.lab}>AUM</Text>
          <Text style={styles.aum}>${formatAum(aum)}</Text>
        </View>
      ) : null}
    </Card>
  );
}

function formatAum(v) {
  if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M';
  if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K';
  return v.toFixed(2);
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.md },
  headText: { flex: 1, minWidth: 0 },
  name: { color: vantage.textPrimary, fontFamily, fontSize: sizes.h3, fontWeight: weights.heavy },
  badge: { alignSelf: 'flex-start', backgroundColor: vantage.bgPressed, paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: radius.sm, marginTop: 2 },
  badgeTxt: { color: vantage.textSecondary, fontFamily, fontSize: sizes.micro, fontWeight: weights.medium },
  full: { backgroundColor: vantage.bgPressed, paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: radius.sm },
  fullTxt: { color: vantage.textMuted, fontFamily, fontSize: sizes.micro, fontWeight: weights.semibold },
  stats: { marginTop: space.sm },
  lab: { color: vantage.textMuted, fontFamily, fontSize: sizes.label },
  val: { fontFamily, fontSize: sizes.h2, fontWeight: weights.heavy },
  aum: { color: vantage.textPrimary, fontFamily, fontSize: sizes.h3, fontWeight: weights.bold },
});
```

- [ ] **Step 2: Add to barrel**

```js
export { default as StrategyCard } from './StrategyCard';
```

- [ ] **Step 3: Demo**

```jsx
<Section title="StrategyCard">
  <View style={{ flexDirection: 'row', gap: space.md }}>
    <StrategyCard name="MY CFD Master" category="Commodities" return30d={164.84} aum={535647} status="full" avatarSymbol="MC" onPress={() => {}} />
    <StrategyCard name="DINO Scalping" category="Indices"    return30d={100.45} avatarSymbol="DI" onPress={() => {}} />
  </View>
</Section>
```

- [ ] **Step 4: Smoke check** — two cards side by side, return is green, "Full" badge on first.

- [ ] **Step 5: Commit**

```bash
git add src/components/vantage/StrategyCard.js src/components/vantage/index.js src/screens/_dev/ComponentGalleryScreen.js && git commit -m "feat(vantage): add StrategyCard"
```

---

### Task 17: `BuySellSplit`

**Files:**
- Create: `src/components/vantage/BuySellSplit.js`
- Modify: `src/components/vantage/index.js`
- Modify: `src/screens/_dev/ComponentGalleryScreen.js`

- [ ] **Step 1: Write the component**

Create `src/components/vantage/BuySellSplit.js`:

```js
import React from 'react';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { vantage, space, sizes, weights, fontFamily, radius } from '../../theme/vantageTheme';

export default function BuySellSplit({
  bid,
  ask,
  spreadPoints,     // number, displayed in centered chip
  side,             // 'sell' | 'buy' — controls which side is colored
  onChange,         // (side) => void
  changePoints,     // optional small "-223" indicator below
}) {
  return (
    <View>
      <View style={styles.row}>
        <Pressable
          onPress={() => onChange('sell')}
          style={[styles.half, styles.left, { backgroundColor: side === 'sell' ? vantage.sellBg : vantage.buyBg }]}
          accessibilityRole="button"
          accessibilityState={{ selected: side === 'sell' }}
        >
          <Text style={styles.lab}>Sell</Text>
          <Text style={styles.price}>{formatPrice(bid)}</Text>
        </Pressable>
        <View style={styles.chip}>
          <Text style={styles.chipTxt}>{spreadPoints != null ? spreadPoints : '—'}</Text>
        </View>
        <Pressable
          onPress={() => onChange('buy')}
          style={[styles.half, styles.right, { backgroundColor: side === 'buy' ? vantage.up : vantage.buyBg }]}
          accessibilityRole="button"
          accessibilityState={{ selected: side === 'buy' }}
        >
          <Text style={styles.lab}>Buy</Text>
          <Text style={styles.price}>{formatPrice(ask)}</Text>
        </Pressable>
      </View>
      {changePoints != null ? (
        <View style={styles.changeRow}>
          <View style={styles.changeBar} />
          <Text style={[styles.changeTxt, { color: changePoints >= 0 ? vantage.up : vantage.down }]}>
            ▼ {changePoints}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function formatPrice(p) {
  if (p == null) return '—';
  if (p >= 1000) return p.toLocaleString('en-US', { maximumFractionDigits: 2 });
  return p.toFixed(5);
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'stretch', height: 80, position: 'relative' },
  half: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.md },
  left:  { borderTopLeftRadius: radius.lg, borderBottomLeftRadius: radius.lg },
  right: { borderTopRightRadius: radius.lg, borderBottomRightRadius: radius.lg },
  chip: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    transform: [{ translateX: -22 }, { translateY: -12 }],
    width: 44, height: 24,
    backgroundColor: vantage.spreadChip,
    borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: vantage.borderStrong,
    zIndex: 1,
  },
  chipTxt: { color: vantage.textPrimary, fontFamily, fontSize: sizes.label, fontWeight: weights.bold },
  lab: { color: vantage.textPrimary, fontFamily, fontSize: sizes.body, fontWeight: weights.semibold },
  price: { color: vantage.textPrimary, fontFamily, fontSize: sizes.h2, fontWeight: weights.heavy, marginTop: 2 },
  changeRow: { flexDirection: 'row', alignItems: 'center', marginTop: space.xs, justifyContent: 'flex-end' },
  changeBar: { flex: 1, height: 2, backgroundColor: vantage.down, marginRight: space.sm, borderRadius: 1 },
  changeTxt: { fontFamily, fontSize: sizes.label, fontWeight: weights.bold },
});
```

- [ ] **Step 2: Add to barrel**

```js
export { default as BuySellSplit } from './BuySellSplit';
```

- [ ] **Step 3: Demo**

```jsx
function BuySellDemo() {
  const [side, setSide] = useState('sell');
  return (
    <Section title="BuySellSplit">
      <BuySellSplit bid={68613.73} ask={68626.73} spreadPoints={1300} side={side} onChange={setSide} changePoints={-223} />
    </Section>
  );
}
```

- [ ] **Step 4: Smoke check** — Sell side pink with bid price, Buy side grey with ask, "1300" chip centered. Tap Buy → Buy turns green and Sell turns grey.

- [ ] **Step 5: Commit**

```bash
git add src/components/vantage/BuySellSplit.js src/components/vantage/index.js src/screens/_dev/ComponentGalleryScreen.js && git commit -m "feat(vantage): add BuySellSplit"
```

---

### Task 18: `BottomNavPill`

The floating 4-tab nav. Used by `MainTabs` in Task 25.

**Files:**
- Create: `src/components/vantage/BottomNavPill.js`
- Modify: `src/components/vantage/index.js`
- Modify: `src/screens/_dev/ComponentGalleryScreen.js`

- [ ] **Step 1: Write the component**

Create `src/components/vantage/BottomNavPill.js`:

```js
import React from 'react';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { vantage, space, sizes, weights, fontFamily, radius } from '../../theme/vantageTheme';

// Tabs: [{ key, label, icon (active el), iconInactive (inactive el) }]
export default function BottomNavPill({ tabs, activeKey, onChange }) {
  return (
    <View style={styles.outer} pointerEvents="box-none">
      <View style={styles.pill}>
        {tabs.map((t) => {
          const active = t.key === activeKey;
          return (
            <Pressable
              key={t.key}
              onPress={() => onChange(t.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={t.label}
              style={[styles.tab, active && styles.tabActive]}
            >
              <View style={styles.icon}>{active ? t.icon : t.iconInactive}</View>
              <Text style={[styles.label, active && { color: vantage.textPrimary, fontWeight: weights.bold }]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    position: 'absolute',
    bottom: space.md,
    left: space.lg,
    right: space.lg,
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    backgroundColor: vantage.bgElevated,
    borderRadius: radius.pill,
    paddingHorizontal: space.xs,
    paddingVertical: space.xs,
    borderWidth: 1,
    borderColor: vantage.border,
    alignItems: 'stretch',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: space.sm,
    paddingHorizontal: space.sm,
    borderRadius: radius.pill,
    gap: 2,
  },
  tabActive: { backgroundColor: vantage.bg },
  icon: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  label: { color: vantage.textMuted, fontFamily, fontSize: sizes.micro, fontWeight: weights.medium },
});
```

- [ ] **Step 2: Add to barrel**

```js
export { default as BottomNavPill } from './BottomNavPill';
```

- [ ] **Step 3: Demo**

```jsx
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
```

- [ ] **Step 4: Smoke check** — Pill with 4 tabs renders. Active tab has a dark capsule background and bold white label.

- [ ] **Step 5: Commit**

```bash
git add src/components/vantage/BottomNavPill.js src/components/vantage/index.js src/screens/_dev/ComponentGalleryScreen.js && git commit -m "feat(vantage): add BottomNavPill"
```

---

### Task 19: `BalanceBlock`

**Files:**
- Create: `src/components/vantage/BalanceBlock.js`
- Modify: `src/components/vantage/index.js`
- Modify: `src/screens/_dev/ComponentGalleryScreen.js`

- [ ] **Step 1: Write the component**

Create `src/components/vantage/BalanceBlock.js`:

```js
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { vantage, space, sizes, weights, fontFamily } from '../../theme/vantageTheme';

export default function BalanceBlock({
  label,
  amount,            // number
  currency = 'USD',
  hidden,
  onToggleHide,
  subLabel,
  subAmount,
  subPositive,
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.labRow}>
        <Text style={styles.label}>{label}</Text>
        {onToggleHide ? (
          <Pressable onPress={onToggleHide} hitSlop={10} accessibilityRole="button" accessibilityLabel={hidden ? 'Show balance' : 'Hide balance'}>
            <Ionicons name={hidden ? 'eye-off-outline' : 'eye-outline'} size={14} color={vantage.textMuted} />
          </Pressable>
        ) : null}
      </View>
      <View style={styles.amtRow}>
        <Text style={styles.amount}>
          {hidden ? '••••••' : formatMoney(amount)}
        </Text>
        <View style={styles.ccyChip}>
          <Text style={styles.ccyTxt}>{currency} ▾</Text>
        </View>
      </View>
      {subLabel ? (
        <View style={styles.subRow}>
          <Text style={styles.subLab}>{subLabel}</Text>
          <Text style={[styles.subAmt, { color: subPositive ? vantage.up : vantage.down }]}>
            {hidden ? '••' : (subAmount != null ? formatSigned(subAmount) : '—')}
          </Text>
          <Text style={styles.subLab}>{currency}</Text>
        </View>
      ) : null}
    </View>
  );
}

function formatMoney(v) {
  if (v == null || !Number.isFinite(v)) return '—';
  return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function formatSigned(v) {
  const sign = v >= 0 ? '+' : '−';
  return sign + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const styles = StyleSheet.create({
  wrap: { gap: 4, paddingVertical: space.sm },
  labRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  label: { color: vantage.textMuted, fontFamily, fontSize: sizes.label },
  amtRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  amount: { color: vantage.textPrimary, fontFamily, fontSize: sizes.hero, fontWeight: weights.heavy },
  ccyChip: { backgroundColor: vantage.bgRaised, paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: 6 },
  ccyTxt: { color: vantage.textSecondary, fontFamily, fontSize: sizes.label, fontWeight: weights.semibold },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: 2 },
  subLab: { color: vantage.textMuted, fontFamily, fontSize: sizes.label },
  subAmt: { fontFamily, fontSize: sizes.body, fontWeight: weights.bold },
});
```

- [ ] **Step 2: Add to barrel**

```js
export { default as BalanceBlock } from './BalanceBlock';
```

- [ ] **Step 3: Demo**

```jsx
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
```

- [ ] **Step 4: Smoke check** — Eye toggle hides/shows amount. PnL row shows in green.

- [ ] **Step 5: Commit**

```bash
git add src/components/vantage/BalanceBlock.js src/components/vantage/index.js src/screens/_dev/ComponentGalleryScreen.js && git commit -m "feat(vantage): add BalanceBlock"
```

---

### Task 20: `Sheet` (bottom modal)

**Files:**
- Create: `src/components/vantage/Sheet.js`
- Modify: `src/components/vantage/index.js`
- Modify: `src/screens/_dev/ComponentGalleryScreen.js`

- [ ] **Step 1: Write the component**

Create `src/components/vantage/Sheet.js`:

```js
import React from 'react';
import { Modal, View, Pressable, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { vantage, space, sizes, weights, fontFamily, radius } from '../../theme/vantageTheme';

export default function Sheet({ visible, onClose, title, children, height }) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onClose} />
      <SafeAreaView edges={['bottom']} style={[styles.sheet, height ? { height } : null]}>
        <View style={styles.handle} />
        {title ? (
          <View style={styles.titleRow}>
            <Text style={styles.title}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <Ionicons name="close" size={22} color={vantage.textPrimary} />
            </Pressable>
          </View>
        ) : null}
        <View style={styles.body}>{children}</View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: vantage.bgElevated,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.md,
    maxHeight: '85%',
  },
  handle: { width: 36, height: 4, backgroundColor: vantage.borderStrong, borderRadius: 2, alignSelf: 'center', marginBottom: space.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.md },
  title: { color: vantage.textPrimary, fontFamily, fontSize: sizes.h2, fontWeight: weights.heavy },
  body: {},
});
```

- [ ] **Step 2: Add to barrel**

```js
export { default as Sheet } from './Sheet';
```

- [ ] **Step 3: Demo**

```jsx
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
```

- [ ] **Step 4: Smoke check** — Tap button → bottom sheet slides up with two account rows. Backdrop tap or close icon dismisses.

- [ ] **Step 5: Commit**

```bash
git add src/components/vantage/Sheet.js src/components/vantage/index.js src/screens/_dev/ComponentGalleryScreen.js && git commit -m "feat(vantage): add Sheet (bottom modal)"
```

---

### Task 21: `Toast`

Lightweight, no extra dep. Singleton mounted at root.

**Files:**
- Create: `src/components/vantage/Toast.js`
- Modify: `src/components/vantage/index.js`
- Modify: `src/screens/_dev/ComponentGalleryScreen.js`

- [ ] **Step 1: Write the component**

Create `src/components/vantage/Toast.js`:

```js
import React, { useEffect, useState, useRef } from 'react';
import { View, Text, Animated, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { vantage, space, sizes, weights, fontFamily, radius } from '../../theme/vantageTheme';

let queue = [];
let listeners = new Set();

export function showToast({ message, kind = 'info', duration = 2500 }) {
  const id = Date.now() + Math.random();
  queue.push({ id, message, kind, duration });
  listeners.forEach((fn) => fn());
}

const KINDS = {
  info:    { icon: 'information-circle',     color: vantage.textPrimary },
  success: { icon: 'checkmark-circle',       color: vantage.up },
  error:   { icon: 'close-circle',           color: vantage.down },
  warn:    { icon: 'alert-circle',           color: vantage.accent },
};

export default function ToastHost() {
  const [current, setCurrent] = useState(null);
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const tick = () => {
      if (!current && queue.length) setCurrent(queue.shift());
    };
    listeners.add(tick);
    return () => listeners.delete(tick);
  }, [current]);

  useEffect(() => {
    if (!current) return;
    Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    const t = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
        setCurrent(null);
      });
    }, current.duration);
    return () => clearTimeout(t);
  }, [current, opacity]);

  if (!current) return null;
  const k = KINDS[current.kind] || KINDS.info;

  return (
    <Animated.View pointerEvents="none" style={[styles.host, { opacity }]}>
      <View style={styles.toast}>
        <Ionicons name={k.icon} size={18} color={k.color} />
        <Text style={styles.txt}>{current.message}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 64 : 48,
    left: space.lg,
    right: space.lg,
    alignItems: 'center',
    zIndex: 9999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: vantage.bgElevated,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderWidth: 1,
    borderColor: vantage.borderStrong,
  },
  txt: { color: vantage.textPrimary, fontFamily, fontSize: sizes.body, fontWeight: weights.semibold },
});
```

- [ ] **Step 2: Add to barrel**

```js
export { default as ToastHost, showToast } from './Toast';
```

- [ ] **Step 3: Mount the host at App root**

This step's app-level integration is done in Task 24 (RootNavigator). For now add the host inside the gallery for testing.

In `ComponentGalleryScreen.js` import `ToastHost, showToast` from `../../components/vantage` and add at the top of the SafeAreaView body:

```jsx
<ToastHost />
```

- [ ] **Step 4: Demo**

```jsx
<Section title="Toast">
  <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
    <PillButton label="Info"    variant="secondary" size="sm" fullWidth={false} onPress={() => showToast({ message: 'Just an info toast' })} />
    <PillButton label="Success" variant="secondary" size="sm" fullWidth={false} onPress={() => showToast({ kind: 'success', message: 'Order placed' })} />
    <PillButton label="Error"   variant="secondary" size="sm" fullWidth={false} onPress={() => showToast({ kind: 'error', message: 'Network error' })} />
    <PillButton label="Warn"    variant="secondary" size="sm" fullWidth={false} onPress={() => showToast({ kind: 'warn', message: 'KYC pending' })} />
  </View>
</Section>
```

- [ ] **Step 5: Smoke check** — Tap each → toast slides in from top, auto-dismisses after ~2.5s.

- [ ] **Step 6: Commit**

```bash
git add src/components/vantage/Toast.js src/components/vantage/index.js src/screens/_dev/ComponentGalleryScreen.js && git commit -m "feat(vantage): add Toast host + showToast helper"
```

---

### Task 22: `CalendarStrip`, `MoversBars`, `SpotlightCard`, `DiscreteSlider`, `EmptyState`

Five small/medium components that are visually-distinct enough that each gets its own file, but they're conceptually independent and not blocking each other — bundled into one task with separate steps.

**Files:**
- Create: `src/components/vantage/CalendarStrip.js`
- Create: `src/components/vantage/MoversBars.js`
- Create: `src/components/vantage/SpotlightCard.js`
- Create: `src/components/vantage/DiscreteSlider.js`
- Create: `src/components/vantage/EmptyState.js`
- Modify: `src/components/vantage/index.js`
- Modify: `src/screens/_dev/ComponentGalleryScreen.js`

- [ ] **Step 1: Write CalendarStrip**

Create `src/components/vantage/CalendarStrip.js`:

```js
import React from 'react';
import { ScrollView, Pressable, View, Text, StyleSheet } from 'react-native';
import { vantage, space, sizes, weights, fontFamily } from '../../theme/vantageTheme';

const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

export default function CalendarStrip({ days, activeDate, onChange }) {
  // days: array of Date objects (length 7 typical)
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {days.map((d) => {
        const active = isSameDay(d, activeDate);
        return (
          <Pressable
            key={d.toISOString()}
            onPress={() => onChange(d)}
            style={styles.cell}
            accessibilityRole="button"
            accessibilityLabel={d.toDateString()}
          >
            <Text style={styles.dow}>{DAY_NAMES[d.getDay()]}</Text>
            <View style={[styles.dotBg, active && styles.dotBgActive]}>
              <Text style={[styles.dom, active && { color: vantage.textPrimary, fontWeight: weights.heavy }]}>
                {String(d.getDate()).padStart(2, '0')}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function isSameDay(a, b) {
  return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

const styles = StyleSheet.create({
  row: { gap: space.lg, paddingHorizontal: space.lg, paddingVertical: space.sm },
  cell: { alignItems: 'center', gap: space.xs, minWidth: 48 },
  dow: { color: vantage.textMuted, fontFamily, fontSize: sizes.label },
  dotBg: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  dotBgActive: { backgroundColor: vantage.accent },
  dom: { color: vantage.textPrimary, fontFamily, fontSize: sizes.h3, fontWeight: weights.bold },
});
```

- [ ] **Step 2: Write MoversBars**

Create `src/components/vantage/MoversBars.js`:

```js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Rect, Defs, LinearGradient, Stop } from 'react-native-svg';
import { vantage, space, sizes, weights, fontFamily } from '../../theme/vantageTheme';

export default function MoversBars({ items, direction = 'up' }) {
  // items: [{ symbol, changePct }]
  const max = Math.max(...items.map(i => Math.abs(i.changePct)), 1);
  const color = direction === 'up' ? vantage.up : vantage.down;
  return (
    <View style={styles.row}>
      {items.map((it, idx) => {
        const h = Math.max(0.15, Math.abs(it.changePct) / max);
        const pctTxt = `${it.changePct >= 0 ? '+' : ''}${it.changePct.toFixed(2)}%`;
        return (
          <View key={it.symbol + idx} style={styles.col}>
            <Text style={[styles.pct, { color }]}>{pctTxt}</Text>
            <Svg width={36} height={120}>
              <Defs>
                <LinearGradient id={`g${idx}`} x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={color} stopOpacity="1" />
                  <Stop offset="1" stopColor={color} stopOpacity="0.2" />
                </LinearGradient>
              </Defs>
              <Rect x="8" y="0" width="20" height="120" fill={vantage.bgPressed} rx="4" />
              <Rect x="8" y={120 * (1 - h)} width="20" height={120 * h} fill={`url(#g${idx})`} rx="4" />
              <Rect x="6" y={120 * (1 - h) - 1} width="24" height="4" fill={color} rx="2" />
            </Svg>
            <Text style={styles.sym}>{it.symbol}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: space.sm, paddingVertical: space.sm },
  col: { alignItems: 'center', gap: space.xs },
  pct: { fontFamily, fontSize: sizes.label, fontWeight: weights.bold },
  sym: { color: vantage.textPrimary, fontFamily, fontSize: sizes.label, fontWeight: weights.semibold },
});
```

- [ ] **Step 3: Write SpotlightCard**

Create `src/components/vantage/SpotlightCard.js`:

```js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Circle, Text as SvgText } from 'react-native-svg';
import Card from './Card';
import SymbolIcon from './SymbolIcon';
import { vantage, space, sizes, weights, fontFamily } from '../../theme/vantageTheme';

export default function SpotlightCard({ title = 'Spotlight', items, brandLabel = 'PM' }) {
  return (
    <Card padding={0}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Svg width={56} height={56} style={styles.glow}>
          <Defs>
            <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={vantage.accentGlow} stopOpacity="0.95" />
              <Stop offset="1" stopColor={vantage.accent} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx="28" cy="28" r="26" fill="url(#glow)" />
          <SvgText
            x="28" y="34"
            fontSize="13" fontWeight="800"
            fill={vantage.textPrimary}
            textAnchor="middle"
          >{brandLabel}</SvgText>
        </Svg>
      </View>
      <Card variant="raised" style={styles.body}>
        {items.map((it, i) => (
          <View key={it.symbol} style={[styles.row, i < items.length - 1 && styles.rowBorder]}>
            <SymbolIcon symbol={it.symbol} size={36} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.sym}>{it.symbol}</Text>
              {it.subtitle ? <Text style={styles.sub}>{it.subtitle}</Text> : null}
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.price}>{Number(it.price).toLocaleString('en-US', { maximumFractionDigits: 2 })}</Text>
              <Text style={[styles.pct, { color: it.changePct >= 0 ? vantage.up : vantage.down }]}>
                {`${it.changePct >= 0 ? '+' : ''}${it.changePct.toFixed(2)}%`}
              </Text>
            </View>
          </View>
        ))}
      </Card>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: space.lg, paddingBottom: 0 },
  title: { color: vantage.textPrimary, fontFamily, fontSize: sizes.h2, fontWeight: weights.heavy },
  glow: {},
  body: { margin: space.md, padding: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  rowBorder: { borderBottomColor: vantage.border, borderBottomWidth: StyleSheet.hairlineWidth },
  sym: { color: vantage.textPrimary, fontFamily, fontSize: sizes.h3, fontWeight: weights.bold },
  sub: { color: vantage.textMuted, fontFamily, fontSize: sizes.label, marginTop: 2 },
  price: { color: vantage.textPrimary, fontFamily, fontSize: sizes.h3, fontWeight: weights.bold },
  pct: { fontFamily, fontSize: sizes.label, fontWeight: weights.semibold, marginTop: 2 },
});
```

- [ ] **Step 4: Write DiscreteSlider**

Create `src/components/vantage/DiscreteSlider.js`:

```js
import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { vantage, space } from '../../theme/vantageTheme';

export default function DiscreteSlider({ value, onChange, stops }) {
  // stops: number[] e.g. [0.1, 0.5, 1, 5, 20]
  return (
    <View style={styles.wrap}>
      <View style={styles.track} />
      <View style={styles.dotsRow}>
        {stops.map((s) => {
          const active = s === value;
          return (
            <Pressable
              key={s}
              onPress={() => onChange(s)}
              hitSlop={16}
              style={[styles.dot, active && styles.dotActive]}
              accessibilityRole="button"
              accessibilityLabel={`Set lots to ${s}`}
              accessibilityState={{ selected: active }}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { height: 32, justifyContent: 'center' },
  track: { position: 'absolute', left: 0, right: 0, height: 2, backgroundColor: vantage.borderStrong, borderRadius: 1 },
  dotsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: vantage.borderStrong, backgroundColor: vantage.bg },
  dotActive: { backgroundColor: vantage.accent, borderColor: vantage.accent, width: 16, height: 16, borderRadius: 8 },
});
```

- [ ] **Step 5: Write EmptyState**

Create `src/components/vantage/EmptyState.js`:

```js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { vantage, space, sizes, weights, fontFamily } from '../../theme/vantageTheme';

export default function EmptyState({ icon, title, subtitle, action }) {
  return (
    <View style={styles.wrap}>
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: space.huge, paddingHorizontal: space.xl, gap: space.sm },
  icon: { marginBottom: space.sm },
  title: { color: vantage.textPrimary, fontFamily, fontSize: sizes.h3, fontWeight: weights.bold, textAlign: 'center' },
  subtitle: { color: vantage.textMuted, fontFamily, fontSize: sizes.body, textAlign: 'center' },
  action: { marginTop: space.md, alignSelf: 'stretch' },
});
```

- [ ] **Step 6: Add all five to the barrel**

Append:
```js
export { default as CalendarStrip } from './CalendarStrip';
export { default as MoversBars } from './MoversBars';
export { default as SpotlightCard } from './SpotlightCard';
export { default as DiscreteSlider } from './DiscreteSlider';
export { default as EmptyState } from './EmptyState';
```

- [ ] **Step 7: Add demos**

```jsx
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
```

- [ ] **Step 8: Smoke check**

Reload. Each new component renders correctly:
- CalendarStrip: 7 day chips, today is orange circle, tap changes selection.
- MoversBars: 5 vertical green bars with %s on top and symbol on bottom.
- SpotlightCard: title + orange glow badge + 3 instrument rows nested.
- DiscreteSlider: 5 dots; tap any one moves the active state.
- EmptyState: centered icon + title + subtitle + button.

- [ ] **Step 9: Commit**

```bash
git add src/components/vantage/CalendarStrip.js src/components/vantage/MoversBars.js src/components/vantage/SpotlightCard.js src/components/vantage/DiscreteSlider.js src/components/vantage/EmptyState.js src/components/vantage/index.js src/screens/_dev/ComponentGalleryScreen.js && git commit -m "feat(vantage): add CalendarStrip, MoversBars, SpotlightCard, DiscreteSlider, EmptyState"
```

---

### Task 23: Placeholder tab screens

Skeleton screens for HomeTab / MarketsTab / TradeTab / FundsTab so navigation can be wired. Each is ~30 lines, just confirms the new bottom-nav routing works end-to-end. Real screens land in Plan B/C/D/E.

**Files:**
- Create: `src/screens/HomeScreen.js`
- Create: `src/screens/MarketsScreen.js`
- Create: `src/screens/TradeScreen.js`
- Create: `src/screens/funds/FundsScreen.js`

- [ ] **Step 1: HomeScreen placeholder**

Create `src/screens/HomeScreen.js`:

```js
import React from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { Screen } from '../components/vantage';
import { vantage, space, sizes, weights, fontFamily } from '../theme/vantageTheme';

export default function HomeScreen() {
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.h1}>Home</Text>
        <Text style={styles.sub}>Phase 2 will replace this with the real dashboard.</Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: space.lg, paddingBottom: 120 },
  h1: { color: vantage.textPrimary, fontFamily, fontSize: sizes.hero, fontWeight: weights.heavy },
  sub: { color: vantage.textMuted, fontFamily, fontSize: sizes.body, marginTop: space.sm },
});
```

- [ ] **Step 2: MarketsScreen placeholder**

Create `src/screens/MarketsScreen.js` — identical structure to HomeScreen but with the title "Markets" and subtitle "Phase 3 will replace this with Watchlist + Explore."

```js
import React from 'react';
import { ScrollView, Text, StyleSheet } from 'react-native';
import { Screen } from '../components/vantage';
import { vantage, space, sizes, weights, fontFamily } from '../theme/vantageTheme';

export default function MarketsScreen() {
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.h1}>Markets</Text>
        <Text style={styles.sub}>Phase 3 will replace this with Watchlist + Explore.</Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: space.lg, paddingBottom: 120 },
  h1: { color: vantage.textPrimary, fontFamily, fontSize: sizes.hero, fontWeight: weights.heavy },
  sub: { color: vantage.textMuted, fontFamily, fontSize: sizes.body, marginTop: space.sm },
});
```

- [ ] **Step 3: TradeScreen placeholder**

Create `src/screens/TradeScreen.js` analogously — title "Trade", subtitle "Phase 4 will replace this with the order ticket and Copy section.":

```js
import React from 'react';
import { ScrollView, Text, StyleSheet } from 'react-native';
import { Screen } from '../components/vantage';
import { vantage, space, sizes, weights, fontFamily } from '../theme/vantageTheme';

export default function TradeScreen() {
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.h1}>Trade</Text>
        <Text style={styles.sub}>Phase 4 will replace this with the order ticket and Copy section.</Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: space.lg, paddingBottom: 120 },
  h1: { color: vantage.textPrimary, fontFamily, fontSize: sizes.hero, fontWeight: weights.heavy },
  sub: { color: vantage.textMuted, fontFamily, fontSize: sizes.body, marginTop: space.sm },
});
```

- [ ] **Step 4: FundsScreen placeholder**

Create `src/screens/funds/FundsScreen.js`:

```js
import React from 'react';
import { ScrollView, Text, StyleSheet } from 'react-native';
import { Screen } from '../../components/vantage';
import { vantage, space, sizes, weights, fontFamily } from '../../theme/vantageTheme';

export default function FundsScreen() {
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.h1}>Funds</Text>
        <Text style={styles.sub}>Phase 5 will replace this with deposit / withdraw / transfer.</Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: space.lg, paddingBottom: 120 },
  h1: { color: vantage.textPrimary, fontFamily, fontSize: sizes.hero, fontWeight: weights.heavy },
  sub: { color: vantage.textMuted, fontFamily, fontSize: sizes.body, marginTop: space.sm },
});
```

- [ ] **Step 5: Commit**

```bash
git add src/screens/HomeScreen.js src/screens/MarketsScreen.js src/screens/TradeScreen.js src/screens/funds/FundsScreen.js && git commit -m "feat(screens): add Vantage placeholder tab screens"
```

---

### Task 24: Per-tab stack navigators

**Files:**
- Create: `src/navigation/HomeStack.js`
- Create: `src/navigation/MarketsStack.js`
- Create: `src/navigation/TradeStack.js`
- Create: `src/navigation/FundsStack.js`

Each stack hosts its tab's root screen plus space for future sub-screens.

- [ ] **Step 1: HomeStack**

Create `src/navigation/HomeStack.js`:

```js
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../screens/HomeScreen';

const Stack = createNativeStackNavigator();

export default function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#000' } }}>
      <Stack.Screen name="Home" component={HomeScreen} />
      {/* Future: EconomicCalendar, Notifications, Search, Portfolio, ProfileMenu */}
    </Stack.Navigator>
  );
}
```

- [ ] **Step 2: MarketsStack**

Create `src/navigation/MarketsStack.js`:

```js
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MarketsScreen from '../screens/MarketsScreen';

const Stack = createNativeStackNavigator();

export default function MarketsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#000' } }}>
      <Stack.Screen name="Markets" component={MarketsScreen} />
      {/* Future: InstrumentDetail, WatchlistEdit */}
    </Stack.Navigator>
  );
}
```

- [ ] **Step 3: TradeStack**

Create `src/navigation/TradeStack.js`:

```js
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import TradeScreen from '../screens/TradeScreen';

const Stack = createNativeStackNavigator();

export default function TradeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#000' } }}>
      <Stack.Screen name="Trade" component={TradeScreen} />
      {/* Future: StrategyDetail, OrderBook, PositionDetail */}
    </Stack.Navigator>
  );
}
```

- [ ] **Step 4: FundsStack**

Create `src/navigation/FundsStack.js`:

```js
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import FundsScreen from '../screens/funds/FundsScreen';

const Stack = createNativeStackNavigator();

export default function FundsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#000' } }}>
      <Stack.Screen name="Funds" component={FundsScreen} />
      {/* Future: Deposit*, Withdraw*, Transfer, TransactionHistory */}
    </Stack.Navigator>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add src/navigation/HomeStack.js src/navigation/MarketsStack.js src/navigation/TradeStack.js src/navigation/FundsStack.js && git commit -m "feat(nav): add per-tab stack navigators"
```

---

### Task 25: `MainTabs` — bottom-tab navigator with BottomNavPill

**Files:**
- Create: `src/navigation/MainTabs.js`

This wires the floating pill nav to the four stacks and hides the default React Navigation tab bar via a custom `tabBar` prop.

- [ ] **Step 1: Write the navigator**

Create `src/navigation/MainTabs.js`:

```js
import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import HomeStack from './HomeStack';
import MarketsStack from './MarketsStack';
import TradeStack from './TradeStack';
import FundsStack from './FundsStack';
import { BottomNavPill } from '../components/vantage';
import { vantage } from '../theme/vantageTheme';

const Tab = createBottomTabNavigator();

const TAB_META = {
  HomeTab:    { label: 'Home',    iconActive: 'triangle',         iconInactive: 'triangle-outline' },
  MarketsTab: { label: 'Markets', iconActive: 'bar-chart',        iconInactive: 'bar-chart-outline' },
  TradeTab:   { label: 'Trade',   iconActive: 'swap-horizontal',  iconInactive: 'swap-horizontal-outline' },
  FundsTab:   { label: 'Funds',   iconActive: 'pie-chart',        iconInactive: 'pie-chart-outline' },
};

function VantageTabBar({ state, navigation }) {
  const activeKey = state.routes[state.index].name;
  const tabs = state.routes.map((r) => {
    const m = TAB_META[r.name];
    return {
      key: r.name,
      label: m.label,
      icon:         <Ionicons name={m.iconActive}   size={18} color={vantage.textPrimary} />,
      iconInactive: <Ionicons name={m.iconInactive} size={18} color={vantage.textMuted} />,
    };
  });

  return (
    <BottomNavPill
      tabs={tabs}
      activeKey={activeKey}
      onChange={(k) => navigation.navigate(k)}
    />
  );
}

export default function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false, tabBarStyle: { display: 'none' } }}
      tabBar={(props) => <VantageTabBar {...props} />}
    >
      <Tab.Screen name="HomeTab"    component={HomeStack} />
      <Tab.Screen name="MarketsTab" component={MarketsStack} />
      <Tab.Screen name="TradeTab"   component={TradeStack} />
      <Tab.Screen name="FundsTab"   component={FundsStack} />
    </Tab.Navigator>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/navigation/MainTabs.js && git commit -m "feat(nav): add MainTabs with floating Vantage pill nav"
```

---

### Task 26: Placeholder `AuthStack` (keeps existing Login working)

Plan F (Auth) will rebuild these. For now, AuthStack just hosts the existing `LoginScreen.js` / `SignupScreen.js` / `ForgotPasswordScreen.js` so unauthenticated users can still log in.

**Files:**
- Create: `src/navigation/AuthStack.js`

- [ ] **Step 1: Write the stack**

Create `src/navigation/AuthStack.js`:

```js
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '../screens/LoginScreen';
import SignupScreen from '../screens/SignupScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';

const Stack = createNativeStackNavigator();

export default function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#000' } }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    </Stack.Navigator>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/navigation/AuthStack.js && git commit -m "feat(nav): add AuthStack (legacy screens, rebuilt in Plan F)"
```

---

### Task 27: `RootNavigator` + `App.js` swap

Replace the monolithic stack in `App.js` with a small `RootNavigator` that picks AuthStack vs MainTabs from AuthContext, mounted under existing providers. This is the moment the new shell goes live and the gallery is unmounted from the root.

**Files:**
- Create: `src/navigation/RootNavigator.js`
- Modify: `App.js` (full rewrite of the navigation portion)

- [ ] **Step 1: Write RootNavigator**

Create `src/navigation/RootNavigator.js`:

```js
import React, { useContext } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';

import { AuthContext } from '../context/AuthContext';
import AuthStack from './AuthStack';
import MainTabs from './MainTabs';
import { vantage } from '../theme/vantageTheme';

export default function RootNavigator() {
  const auth = useContext(AuthContext);
  const ready = auth && !auth.bootstrapping;

  return (
    <NavigationContainer
      theme={{
        dark: true,
        colors: {
          primary: vantage.accent,
          background: vantage.bg,
          card: vantage.bg,
          text: vantage.textPrimary,
          border: vantage.border,
          notification: vantage.accent,
        },
        fonts: {
          regular: { fontFamily: 'System', fontWeight: '400' },
          medium:  { fontFamily: 'System', fontWeight: '500' },
          bold:    { fontFamily: 'System', fontWeight: '700' },
          heavy:   { fontFamily: 'System', fontWeight: '800' },
        },
      }}
    >
      {!ready ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: vantage.bg }}>
          <ActivityIndicator color={vantage.accent} />
        </View>
      ) : auth.user ? (
        <MainTabs />
      ) : (
        <AuthStack />
      )}
    </NavigationContainer>
  );
}
```

> **Note for the implementer:** `AuthContext` currently may not expose a `bootstrapping` field. If it doesn't, treat `bootstrapping = false` (always ready) and rely solely on `auth.user`. Confirm by reading `src/context/AuthContext.js` before implementing.

- [ ] **Step 2: Modify `App.js` — full rewrite of the navigation portion**

Read the existing `App.js` first. Identify the section that creates the stack navigator and replace it with `<RootNavigator />`. Preserve all of: `ThemeProvider`, `SettingsProvider`, `I18nProvider`, `AuthProvider`, error boundary, and `expo-updates` check logic. Remove the import of `ComponentGalleryScreen` and the temporary Gallery route added in Task 2.

Final `App.js` should look like this (preserving the existing provider stack and updates logic — adapt the surrounding code if your existing file differs):

```js
import 'react-native-gesture-handler';
import 'react-native-reanimated';

import React, { useEffect } from 'react';
import * as Updates from 'expo-updates';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeProvider } from './src/context/ThemeContext';
import { SettingsProvider } from './src/context/SettingsContext';
import { I18nProvider } from './src/i18n';
import { AuthProvider } from './src/context/AuthContext';
import RootNavigator from './src/navigation/RootNavigator';
import { ToastHost } from './src/components/vantage';

export default function App() {
  useEffect(() => {
    async function checkUpdates() {
      try {
        if (!__DEV__) {
          const u = await Updates.checkForUpdateAsync();
          if (u.isAvailable) {
            await Updates.fetchUpdateAsync();
            await Updates.reloadAsync();
          }
        }
      } catch (_) {}
    }
    checkUpdates();
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <SettingsProvider>
          <I18nProvider>
            <AuthProvider>
              <RootNavigator />
              <ToastHost />
            </AuthProvider>
          </I18nProvider>
        </SettingsProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
```

- [ ] **Step 3: Smoke check (logged out)**

Reload Expo. With no token in SecureStore, you should see the legacy LoginScreen (still PipHigh-styled visually since it's rebuilt later in Plan F — but the route is now under AuthStack). Verify Sign up and Forgot password links still navigate.

- [ ] **Step 4: Smoke check (logged in)**

Log in with a valid ProlineMarket backend account. Expected:
- The app shows the new HomeScreen placeholder ("Home — Phase 2 will replace this...") with the **floating Vantage pill** at the bottom.
- Tapping Markets / Trade / Funds switches to the matching placeholder screen, each preserving its own back-stack state.
- The active tab is the one with a dark capsule background; inactive tabs are grey.
- Status bar text is light, background is pure black.
- Pulling down on the placeholder does nothing (no refresh wired) — that's expected.

- [ ] **Step 5: Commit**

```bash
git add src/navigation/RootNavigator.js App.js && git commit -m "feat(nav): swap App.js to RootNavigator (AuthStack ↔ MainTabs)"
```

---

### Task 28: Wrap-up — remove the Gallery dev route & verify clean tree

Gallery stays in the codebase but no longer mounts as the root. Add a tiny dev shortcut so you can still reach it from the menu later without restoring it to the navigator now.

**Files:**
- Modify: `src/screens/_dev/ComponentGalleryScreen.js` (no-op — kept as-is)
- Modify: `src/navigation/HomeStack.js` (add Gallery route, dev-only)

- [ ] **Step 1: Add a dev-only route in HomeStack so the gallery is still reachable**

Modify `src/navigation/HomeStack.js`:

```js
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../screens/HomeScreen';
import ComponentGalleryScreen from '../screens/_dev/ComponentGalleryScreen';

const Stack = createNativeStackNavigator();

export default function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#000' } }}>
      <Stack.Screen name="Home" component={HomeScreen} />
      {__DEV__ ? <Stack.Screen name="ComponentGallery" component={ComponentGalleryScreen} /> : null}
      {/* Future: EconomicCalendar, Notifications, Search, Portfolio, ProfileMenu */}
    </Stack.Navigator>
  );
}
```

- [ ] **Step 2: Add a hidden way to reach the Gallery from HomeScreen (long-press the title in DEV only)**

Modify `src/screens/HomeScreen.js`. Replace the body with:

```js
import React from 'react';
import { ScrollView, Text, StyleSheet, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Screen } from '../components/vantage';
import { vantage, space, sizes, weights, fontFamily } from '../theme/vantageTheme';

export default function HomeScreen() {
  const nav = useNavigation();
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.body}>
        <Pressable onLongPress={() => __DEV__ && nav.navigate('ComponentGallery')}>
          <Text style={styles.h1}>Home</Text>
        </Pressable>
        <Text style={styles.sub}>Phase 2 will replace this with the real dashboard.</Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: space.lg, paddingBottom: 120 },
  h1: { color: vantage.textPrimary, fontFamily, fontSize: sizes.hero, fontWeight: weights.heavy },
  sub: { color: vantage.textMuted, fontFamily, fontSize: sizes.body, marginTop: space.sm },
});
```

- [ ] **Step 3: Verify final smoke checklist**

Run `npx expo start` and on Android:
- Logged-out → AuthStack reaches Login.
- Log in → Home placeholder visible with floating pill.
- Long-press "Home" title → navigates to Component Gallery.
- Gallery shows every component built in Tasks 3–22 without errors.
- Switch tabs (Home / Markets / Trade / Funds) → each shows its placeholder.
- Quit the app and reopen → still logged in, lands on Home placeholder.

If anything throws, fix before claiming this task complete.

- [ ] **Step 4: Commit**

```bash
git add src/navigation/HomeStack.js src/screens/HomeScreen.js && git commit -m "chore(dev): keep ComponentGallery reachable via long-press in DEV builds"
```

---

## Done state for Plan A

After Task 28:

- `src/theme/vantageTheme.js` is the single source of truth for Vantage design tokens.
- `src/components/vantage/` contains 25 reusable presentational components, each smoke-tested in the gallery.
- `App.js` renders a new `RootNavigator` that switches between `AuthStack` (legacy login retained until Plan F) and `MainTabs` (4-tab floating Vantage pill).
- Each tab has its own stack with a Vantage-styled placeholder screen confirming the routing works.
- ComponentGallery is reachable via long-press on "Home" title in DEV builds, deleted from PRODUCTION roots.

Plan B will replace the HomeScreen placeholder with the real Vantage Home (BalanceBlock, QuickActions, PromoBanner, StrategyCarousel, Watchlist) using the components built here. Plan C → Markets. Plan D → Trade. Plan E → Funds + payment gateways. Plan F → Auth + Profile. Plan G → secondary screen restyling + deletions.
