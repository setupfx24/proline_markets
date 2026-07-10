'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useShellStore } from '@/stores/shellStore';
import { useViewOnly } from '@/stores/authStore';
import { cn } from '@/lib/utils';
import {
  LayoutGrid,
  Wallet,
  History,
  TrendingUp,
  Copy,
  Users,
  GraduationCap,
  Newspaper,
  ShieldCheck,
  Settings,
  Menu,
  FileText,
  HelpCircle,
  Headphones,
  Receipt,
  Calculator,
  Plug,
  Blocks,
} from 'lucide-react';

const NAV_ITEMS = [
  { label: 'Accounts', href: '/accounts', icon: LayoutGrid },
  { label: 'Deposit/Withdraw', href: '/wallet', icon: Wallet },
  { label: 'Transactions', href: '/transactions', icon: History },
  { label: 'Portfolio', href: '/portfolio', icon: Receipt },
  { label: 'PAMM', href: '/pamm', icon: TrendingUp },
  { label: 'MAMM', href: '/social', icon: Copy },
  { label: 'Affiliates', href: '/business', icon: Users },
  { label: 'ProlineMarkets Academy', href: '/academy', icon: GraduationCap },
  { label: 'Economic News', href: '/news', icon: Newspaper },
  { label: 'Risk Management', href: '/risk-calculator', icon: Calculator },
  { label: 'Algo Connector', href: '/algo-connector', icon: Plug },
  { label: 'Edge Builder', href: '/edge-builder', icon: Blocks },
  { label: 'KYC', href: '/kyc', icon: ShieldCheck },
  { label: 'Settings', href: '/profile', icon: Settings },
] as const;

// Read-only investor sessions only see their account + trading + transaction history.
const INVESTOR_NAV = [
  { label: 'Accounts', href: '/accounts', icon: LayoutGrid },
  { label: 'Trading', href: '/trading', icon: TrendingUp },
  { label: 'Transactions', href: '/transactions', icon: History },
] as const;

export default function AppSidebar() {
  const pathname = usePathname();
  const { sidebarOpen, setSidebarOpen } = useShellStore();
  const viewOnly = useViewOnly();
  const navItems = viewOnly ? INVESTOR_NAV : NAV_ITEMS;
  const logoHref = viewOnly ? '/accounts' : '/dashboard';

  return (
    <>
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-bg-base/75 z-[65] lg:hidden"
          aria-hidden
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          /* z-[70] above MobileBottomNav (z-[60]) so drawer links receive taps on small screens */
          'fixed top-0 left-0 z-[70] h-full w-[260px] flex flex-col overflow-hidden transition-transform duration-200',
          'bg-bg-base border-r border-border-primary',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center justify-between px-4 pt-4 pb-3 gap-2">
          <Link href={logoHref} className="flex items-center gap-2 min-w-0">
            <img
              src="/images/logo2.png"
              alt="ProlineMarketsFX"
              className="hidden dark:block h-7 w-auto object-contain"
            />
            <img
              src="/images/logowhite.png"
              alt="ProlineMarketsFX"
              className="block dark:hidden h-7 w-auto object-contain"
            />
          </Link>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="text-text-secondary hover:text-text-primary p-1.5 rounded-lg hover:bg-bg-hover transition-colors shrink-0"
            aria-label="Toggle sidebar"
          >
            <Menu size={20} strokeWidth={2} />
          </button>
        </div>

        <nav className="flex-1 min-h-0 overflow-y-auto overscroll-contain py-2 px-2 sidebar-scroll">
          {navItems.map((item) => {
            const itemPath = item.href.split('?')[0];
            const isActive = pathname === itemPath || pathname.startsWith(`${itemPath}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => {
                  if (window.innerWidth < 1024) setSidebarOpen(false);
                }}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors mb-0.5',
                  isActive
                    ? 'bg-accent/10 text-text-primary border border-accent/22'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover border border-transparent',
                )}
              >
                <item.icon
                  size={17}
                  strokeWidth={1.85}
                  className={cn(
                    'shrink-0 transition-[filter,color] sidebar-icon-glow text-[#22c55e]',
                    isActive
                      ? 'drop-shadow-[0_0_8px_rgba(34,197,94,0.55)]'
                      : 'drop-shadow-[0_0_6px_rgba(34,197,94,0.35)]',
                  )}
                />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="px-3 pb-4 pt-2 space-y-2.5 border-t border-border-primary bg-bg-base">
          <Link
            href="/terms"
            className="flex items-center gap-2 rounded-lg border border-border-primary bg-bg-secondary px-3 py-2.5 text-xs text-text-secondary hover:text-text-primary hover:border-border-accent transition-colors"
          >
            <FileText size={14} className="text-accent shrink-0 opacity-90" />
            <span>Terms & Conditions</span>
          </Link>

          <div className="rounded-xl p-3.5 border border-border-primary bg-card-nested">
            <div className="flex items-center gap-1.5 mb-1">
              <HelpCircle size={14} className="text-accent shrink-0" />
              <span className="text-xs font-semibold text-text-primary">Need Help?</span>
            </div>
            <p className="text-[10px] text-text-tertiary mb-3 leading-relaxed">Contact our 24/7 support team</p>
            <Link
              href="/support"
              className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg border border-border-primary text-xs text-text-secondary hover:text-text-primary hover:border-accent/35 hover:bg-accent/5 transition-colors"
            >
              <Headphones size={12} className="text-accent/80" />
              <span>Get Support</span>
            </Link>
          </div>

        </div>
      </aside>
    </>
  );
}
