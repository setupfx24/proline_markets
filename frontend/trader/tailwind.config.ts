import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: 'var(--bg-primary)',
          secondary: 'var(--bg-secondary)',
          tertiary: 'var(--bg-tertiary)',
          hover: 'var(--bg-hover)',
          active: 'var(--bg-active)',
          input: 'var(--bg-input)',
          glass: 'var(--bg-glass)',
          'glass-light': 'var(--bg-glass-light)',
          'glass-heavy': 'var(--bg-glass-heavy)',
          base: 'var(--bg-base)',
        },
        /* crucial-ui style surfaces */
        card: {
          DEFAULT: 'var(--bg-card)',
          nested: 'var(--bg-card-nested)',
        },
        border: {
          primary: 'var(--border-primary)',
          secondary: 'var(--border-secondary)',
          accent: 'var(--border-accent)',
          glass: 'var(--border-glass)',
          'glass-bright': 'var(--border-glass-bright)',
        },
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          tertiary: 'var(--text-tertiary)',
          inverse: 'var(--text-inverse)',
        },
        buy: {
          DEFAULT: '#22c55e',
          light: '#4ade80',
          dark: '#16a34a',
          bg: 'rgba(34,197,94,0.1)',
          glow: 'rgba(34,197,94,0.22)',
        },
        sell: {
          DEFAULT: '#ef4444',
          light: '#f87171',
          dark: '#dc2626',
          bg: 'rgba(239,68,68,0.1)',
          glow: 'rgba(239,68,68,0.2)',
        },
        accent: { DEFAULT: '#22c55e', light: '#4ade80', dark: '#16a34a' },
        success: '#16a34a',
        warning: '#FFB300',
        info: '#29B6F6',
        danger: '#FF1744',
        rainbow: {
          red: '#FF6B6B',
          orange: '#FFA94D',
          yellow: '#FFD43B',
          green: '#69DB7C',
          blue: '#4DABF7',
          purple: '#9775FA',
          pink: '#F06595',
        },
        /* Landing-page palette */
        'primary': {
          bg: '#0A0E1A',
          secondary: '#0F1628',
          accent: '#16a34a',
          purple: '#15803d',
        },
      },
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, #15803d, #16a34a)',
        'gradient-hero': 'linear-gradient(135deg, #0A0E1A 0%, #1A1F3A 50%, #2A1F4A 100%)',
        'gradient-section': 'linear-gradient(180deg, #0A0E1A 0%, #0F1628 100%)',
        'gradient-section-alt': 'linear-gradient(180deg, #0F1628 0%, #0A0E1A 100%)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'monospace'],
      },
      fontSize: {
        'xxs': ['10px', { lineHeight: '14px' }],
        'xs': ['11px', { lineHeight: '16px' }],
        'sm': ['12px', { lineHeight: '16px' }],
        'base': ['13px', { lineHeight: '20px' }],
        'md': ['14px', { lineHeight: '20px' }],
        'lg': ['16px', { lineHeight: '24px' }],
        'xl': ['20px', { lineHeight: '28px' }],
        '2xl': ['28px', { lineHeight: '36px' }],
        '3xl': ['36px', { lineHeight: '44px' }],
      },
      borderRadius: { sm: '4px', DEFAULT: '4px', md: '6px', lg: '8px', xl: '12px', '2xl': '16px', '3xl': '24px' },
      spacing: { '0.5': '2px', '1': '4px', '1.5': '6px', '2': '8px', '3': '12px', '4': '16px', '5': '20px', '6': '24px', '8': '32px', '10': '40px', '12': '48px' },
      backdropBlur: { xs: '2px', glass: '16px', 'glass-heavy': '24px', 'glass-ultra': '40px' },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-down': 'slideDown 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        'flash-blue': 'flashBlue 0.15s ease-out',
        'flash-red': 'flashRed 0.15s ease-out',
        'glow-pulse': 'glowPulse 2s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
        /** Wallet deposit/withdraw — Crucial-style neon tab + panel */
        'wallet-neon-tab': 'walletNeonTabGlow 2.6s ease-in-out infinite',
        'wallet-main-tab-glow': 'walletMainTabGlow 2.2s ease-in-out infinite',
        'wallet-main-tab-text': 'walletMainTabText 0.55s cubic-bezier(0.34, 1.45, 0.64, 1) both',
        'wallet-fund-enter': 'walletFundEnter 0.48s cubic-bezier(0.22, 1, 0.36, 1) both',
        'wallet-fund-enter-lg': 'walletFundEnterLg 0.65s cubic-bezier(0.22, 1, 0.36, 1) both',
        'wallet-sub-pill': 'walletSubPill 0.32s cubic-bezier(0.22, 1, 0.36, 1) both',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        slideDown: { '0%': { opacity: '0', transform: 'translateY(-8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        flashBlue: { '0%': { backgroundColor: 'rgba(34,197,94,0.22)' }, '100%': { backgroundColor: 'transparent' } },
        flashRed: { '0%': { backgroundColor: 'rgba(239,68,68,0.2)' }, '100%': { backgroundColor: 'transparent' } },
        glowPulse: { '0%, 100%': { boxShadow: '0 0 20px rgba(34,197,94,0.18)' }, '50%': { boxShadow: '0 0 40px rgba(34,197,94,0.32)' } },
        float: { '0%, 100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-10px)' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        walletNeonTabGlow: {
          '0%, 100%': {
            boxShadow:
              '0 -1px 20px rgba(34, 197, 94, 0.22), 0 0 32px rgba(34, 197, 94, 0.12), inset 0 0 24px rgba(34, 197, 94, 0.04)',
          },
          '50%': {
            boxShadow:
              '0 -1px 36px rgba(34, 197, 94, 0.45), 0 0 52px rgba(34, 197, 94, 0.22), inset 0 0 32px rgba(34, 197, 94, 0.08)',
          },
        },
        /** Deposit / Withdraw main tabs — stronger pulsing glow */
        walletMainTabGlow: {
          '0%, 100%': {
            boxShadow:
              '0 -6px 40px rgba(34, 197, 94, 0.38), 0 0 56px rgba(34, 197, 94, 0.2), inset 0 1px 0 rgba(34, 197, 94, 0.14)',
          },
          '50%': {
            boxShadow:
              '0 -10px 64px rgba(34, 197, 94, 0.62), 0 0 88px rgba(34, 197, 94, 0.32), inset 0 1px 0 rgba(34, 197, 94, 0.22)',
          },
        },
        walletMainTabText: {
          '0%': { opacity: '0.5', transform: 'scale(0.92) translateY(4px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        walletFundEnter: {
          '0%': { opacity: '0', transform: 'translateY(14px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        walletFundEnterLg: {
          '0%': { opacity: '0', transform: 'translateY(22px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        walletSubPill: {
          '0%': { opacity: '0.85', transform: 'scale(0.98)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      boxShadow: {
        'modal': '0 8px 32px rgba(0,0,0,0.6)',
        'dropdown': '0 4px 16px rgba(0,0,0,0.4)',
        'glass': '0 8px 32px 0 rgba(0,0,0,0.37)',
        'glass-sm': '0 4px 16px 0 rgba(0,0,0,0.25)',
        'glass-lg': '0 16px 48px 0 rgba(0,0,0,0.5)',
        'inner-light': 'inset 0 1px 0 0 rgba(255,255,255,0.05)',
        'skeu': 'inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -1px 0 rgba(0,0,0,0.2), 0 2px 8px rgba(0,0,0,0.3)',
        'glow-blue': '0 0 20px rgba(34,197,94,0.28), 0 0 60px rgba(34,197,94,0.1)',
        'glow-red': '0 0 20px rgba(239,68,68,0.3), 0 0 60px rgba(239,68,68,0.1)',
        'neon-green-sm': '0 0 20px rgba(34, 197, 94, 0.25), 0 0 48px rgba(34, 197, 94, 0.08)',
        'neon-green-lg': '0 0 28px rgba(34, 197, 94, 0.4), 0 0 64px rgba(34, 197, 94, 0.15)',
      },
    },
  },
  plugins: [],
}

export default config
