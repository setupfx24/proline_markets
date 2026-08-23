import { Platform } from 'react-native';

// ── Theme token sets ────────────────────────────────────────────────────────
// Two palettes share the same key names so every component can keep reading
// `vantage.<token>` unchanged. The active set is applied into the live `vantage`
// object at startup (before screens load) by applyVantageTheme().

const darkTokens = {
  // Surfaces — lifted off pure black so cards stand out against the
  // black→orange gradient background.
  bg:           '#000000',
  bgElevated:   '#242424',
  bgRaised:     '#2E2E2E',
  bgPressed:    '#383838',
  border:       '#303030',
  borderStrong: '#424242',

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

  // Trade-screen specific — Sell uses the brand orange-red.
  sellBg:       '#F04024',
  buyBg:        '#2E2E2E',
  spreadChip:   '#000000',

  // Sell/Buy action buttons — brand orange-red & green.
  sellBtn:      '#F04024',
  sellBtnDim:   'rgba(240,64,36,0.30)',
  buyBtn:       '#16C784',
  buyBtnDim:    'rgba(22,199,132,0.30)',
};

const lightTokens = {
  // Surfaces — clean white UI with subtle off-white panels and visible borders.
  bg:           '#FFFFFF',
  bgElevated:   '#F5F7FA',
  bgRaised:     '#EDF1F6',
  bgPressed:    '#E2E8F0',
  border:       '#E5E7EB',
  borderStrong: '#D1D5DB',

  // Text — strong contrast on white.
  textPrimary:   '#0F172A',
  textSecondary: '#475569',
  textMuted:     '#64748B',
  textInverse:   '#FFFFFF',

  // Brand — same warm accent in both themes.
  accent:       '#F26A1F',
  accentGlow:   '#FF8A3D',
  accentMuted:  'rgba(242,106,31,0.10)',

  // Directionals
  up:           '#16A34A',
  upMuted:      'rgba(22,163,74,0.10)',
  down:         '#DC2626',
  downMuted:    'rgba(220,38,38,0.10)',

  // Trade-screen specific
  sellBg:       '#F04024',
  buyBg:        '#EDF1F6',
  spreadChip:   '#FFFFFF',

  sellBtn:      '#F04024',
  sellBtnDim:   'rgba(240,64,36,0.18)',
  buyBtn:       '#16A34A',
  buyBtnDim:    'rgba(22,163,74,0.18)',
};

export const VANTAGE_TOKENS = { dark: darkTokens, light: lightTokens };

// Live token object. Components import this and read `vantage.<token>`. It is
// MUTATED in place (never reassigned) so existing destructured imports keep
// pointing at the up-to-date values. Defaults to dark; applyVantageTheme()
// overrides it at startup based on the saved preference.
export const vantage = { ...darkTokens, scheme: 'dark', isDark: true };

/** Swap the live tokens to the named theme ('dark' | 'light'). */
export function applyVantageTheme(name) {
  const isDark = name !== 'light';
  Object.assign(vantage, isDark ? darkTokens : lightTokens, {
    scheme: isDark ? 'dark' : 'light',
    isDark,
  });
  return vantage;
}

// SecureStore key used across the app for the theme preference.
export const THEME_PREF_KEY = 'themeMode';

export const fontFamily = Platform.select({ ios: 'System', android: 'Roboto' });

export const weights = {
  regular:  '400',
  medium:   '500',
  semibold: '600',
  bold:     '700',
  heavy:    '800',
};

export const sizes = {
  hero:  28,
  h1:    22,
  h2:    18,
  h3:    15,
  body:  14,
  label: 12,
  micro: 10,
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
  applyVantageTheme,
  fontFamily,
  weights,
  sizes,
  space,
  radius,
};
