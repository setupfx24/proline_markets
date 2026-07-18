'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useShellStore } from '@/stores/shellStore';
import { useAuthStore } from '@/stores/authStore';
import { NotificationBell } from '@/components/NotificationListener';
import api from '@/lib/api/client';
import { Menu, ChevronDown, Wallet, Download, Monitor } from 'lucide-react';

function formatUsd(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
}

export default function AppHeader() {
  const { toggleSidebar } = useShellStore();
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const [balance, setBalance] = useState(0);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handle = user?.first_name
    ? [user.first_name, user.last_name].filter(Boolean).join(' ')
    : user?.email ? user.email.split('@')[0] : 'Trader';
  const initials = user
    ? (
        user.first_name?.[0] && user.last_name?.[0]
          ? `${user.first_name[0]}${user.last_name[0]}`
          : user.first_name?.[0] || user.email?.[0] || 'U'
      ).toUpperCase()
    : 'U';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await api.get<{ main_wallet_balance?: number; balance?: number }>('/wallet/summary');
        if (cancelled) return;
        const v = Number(s.main_wallet_balance ?? s.balance ?? 0);
        setBalance(Number.isFinite(v) ? v : 0);
      } catch {
        if (!cancelled) setBalance(0);
      }
    })();
    const t = setInterval(() => {
      void (async () => {
        try {
          const s = await api.get<{ main_wallet_balance?: number; balance?: number }>('/wallet/summary');
          const v = Number(s.main_wallet_balance ?? s.balance ?? 0);
          setBalance(Number.isFinite(v) ? v : 0);
        } catch { /* ignore */ }
      })();
    }, 45_000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setUserMenuOpen(false);
    };
    if (userMenuOpen) document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [userMenuOpen]);

  return (
    /* Outer wrapper â€” sits on #050707 page bg */
    <div className="px-2 sm:px-3 pt-2 sm:pt-3 pb-0 shrink-0">
      <header
        className="h-[56px] sm:h-[65px] flex items-center justify-between px-3 sm:px-5 rounded-xl bg-bg-secondary border border-border-primary"
      >
        {/* LEFT — logo (opens sidebar when closed) */}
        <button
          type="button"
          onClick={toggleSidebar}
          className="shrink-0"
          aria-label="Toggle menu"
        >
          <img
            src="/images/logo1.png"
            alt="ProlineMarketsFX"
            className="w-10 h-10 object-contain"
          />
        </button>

        {/* RIGHT â€” balance + bell + user */}
        <div className="flex items-center gap-1.5 sm:gap-3">
          {/* Download Android app (APK) — served from trader public/ */}
          <a
            href="/proline_apk.apk"
            download
            title="Download Android App (APK)"
            aria-label="Download Android App (APK)"
            className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full border border-[#22c55e]/30 bg-[#22c55e]/5 hover:bg-[#22c55e]/10 transition-colors"
          >
            <Download size={14} className="text-[#22c55e] shrink-0" />
            <span className="text-[#22c55e] text-xs sm:text-sm font-medium hidden sm:inline">APK</span>
          </a>

          {/* Download Windows desktop trading terminal — served from trader public/downloads/ */}
          <a
            href="/downloads/ProlineTerminal-Setup.exe"
            download
            title="Download Windows Client Terminal"
            aria-label="Download Windows Client Terminal"
            className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full border border-[#3b82f6]/30 bg-[#3b82f6]/5 hover:bg-[#3b82f6]/10 transition-colors"
          >
            <Monitor size={14} className="text-[#3b82f6] shrink-0" />
            <span className="text-[#3b82f6] text-xs sm:text-sm font-medium hidden sm:inline">Terminal</span>
          </a>

          {/* Balance pill */}
          <Link
            href="/wallet"
            className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full border border-[#22c55e]/30 bg-[#22c55e]/5 hover:bg-[#22c55e]/10 transition-colors"
          >
            <Wallet size={14} className="text-[#22c55e] shrink-0" />
            <span className="text-[#22c55e] text-xs sm:text-sm font-medium truncate max-w-[90px] sm:max-w-none">{formatUsd(balance)}</span>
            <ChevronDown size={12} className="text-[#22c55e]/60 shrink-0 hidden sm:block" />
          </Link>

          {/* Notification bell */}
          <NotificationBell />

          {/* User avatar + menu */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#22c55e]/20 border border-[#22c55e]/30 flex items-center justify-center text-[#22c55e] text-[10px] sm:text-xs font-bold uppercase">
                {initials}
              </div>
              <span className="text-sm text-text-primary hidden sm:inline">{handle}</span>
              <ChevronDown size={13} className="text-text-tertiary hidden sm:inline" />
            </button>

            {userMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" aria-hidden onClick={() => setUserMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-2 w-48 bg-bg-primary border border-border-primary rounded-xl py-1 z-50 shadow-lg">
                  <Link
                    href="/profile"
                    className="block w-full text-left px-4 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    Profile & Settings
                  </Link>
                  <Link
                    href="/wallet"
                    className="block w-full text-left px-4 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    Wallet
                  </Link>
                  <Link
                    href="/kyc"
                    className="block w-full text-left px-4 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    KYC Verification
                  </Link>
                  <div className="border-t border-border-primary my-1" />
                  <button
                    type="button"
                    className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                    onClick={() => {
                      setUserMenuOpen(false);
                      // Investor (read-only) sessions log in at /investor — send them back there.
                      const dest = useAuthStore.getState().user?.role === 'investor' ? '/investor' : '/auth/login';
                      logout();
                      router.push(dest);
                    }}
                  >
                    Sign Out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>
    </div>
  );
}
