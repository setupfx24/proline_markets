'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { adminApi } from '@/lib/api';
import {
  LayoutDashboard, Users, CandlestickChart, Wallet, Landmark,
  Settings, Sliders, BarChart3, Gift, Image, HeadphonesIcon,
  UserCog, ChevronDown, ChevronRight, Network, Share2,
  DollarSign, Percent, ArrowLeftRight, PanelLeftClose, PanelLeft,
  Receipt, Layers, ShieldCheck, ScrollText, BookOpen,
} from 'lucide-react';

interface NavItem {
  label: string;
  href?: string;
  icon: any;
  badge?: number;
  perm?: string;
  children?: { label: string; href: string; perm?: string }[];
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Users', href: '/users', icon: Users, perm: 'users.view' },
  {
    label: 'Identity verification',
    href: '/kyc',
    icon: ShieldCheck,
    perm: 'kyc.view',
  },
  { label: 'Trades', href: '/trades', icon: CandlestickChart, perm: 'trades.view' },
  { label: 'Book Management', href: '/book', icon: BookOpen, perm: 'trades.view' },
  { label: 'Deposits', href: '/deposits', icon: Wallet, perm: 'deposits.view' },
  { label: 'Transactions', href: '/transactions', icon: Receipt, perm: 'deposits.view' },
  { label: 'Banks', href: '/banks', icon: Landmark, perm: 'banks.view' },
  { label: 'Account types', href: '/account-types', icon: Layers, perm: 'config.view' },
  {
    label: 'Config', icon: Sliders, perm: 'config.view',
    children: [
      { label: 'Overview', href: '/config' },
      { label: 'Charges', href: '/config/charges' },
      { label: 'Spreads', href: '/config/spreads' },
      { label: 'Swaps', href: '/config/swaps' },
    ],
  },
  { label: 'Social', href: '/social', icon: Share2, perm: 'social.view' },
  {
    label: 'Business', icon: Network, perm: 'ib.view',
    children: [
      { label: 'Overview', href: '/business' },
      { label: 'IB Program', href: '/business/ib' },
      { label: 'Sub-Broker', href: '/business/sub-broker' },
      { label: 'Copy Masters', href: '/business/masters' },
      { label: 'MLM Config', href: '/business/mlm' },
    ],
  },
  { label: 'Analytics', href: '/analytics', icon: BarChart3, perm: 'analytics.view' },
  { label: 'Audit logs', href: '/audit-logs', icon: ScrollText, perm: 'audit_logs.view' },
  { label: 'Bonus', href: '/bonus', icon: Gift, perm: 'bonus.view' },
  { label: 'Banners', href: '/banners', icon: Image, perm: 'banners.view' },
  { label: 'Support', href: '/support', icon: HeadphonesIcon, perm: 'tickets.view' },
  { label: 'Employees', href: '/employees', icon: UserCog, perm: '_super_admin' },
  { label: 'Settings', href: '/settings', icon: Settings, perm: '_super_admin' },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<string[]>(['Config', 'Business']);
  const [permissions, setPermissions] = useState<string[]>(['*']);
  const [employeeRole, setEmployeeRole] = useState<string>('super_admin');

  useEffect(() => {
    (async () => {
      try {
        const me = await adminApi.get<{ permissions: string[]; employee_role: string }>('/auth/me');
        setPermissions(me.permissions || []);
        setEmployeeRole(me.employee_role || '');
      } catch {}
    })();
  }, []);

  const hasAccess = (perm?: string) => {
    if (!perm) return true;
    if (permissions.includes('*')) return true;
    if (perm === '_super_admin') return employeeRole === 'super_admin';
    return permissions.includes(perm);
  };

  const toggleGroup = (label: string) => {
    setExpandedGroups((prev) =>
      prev.includes(label) ? prev.filter((g) => g !== label) : [...prev, label]
    );
  };

  const isActive = (href?: string) => href && pathname === href;

  const visibleItems = NAV_ITEMS.filter(item => hasAccess(item.perm));

  return (
    <div className={cn(
      'flex flex-col h-full glass-card border-r border-border-primary/50 transition-all duration-300',
      collapsed ? 'w-14' : 'w-60',
    )}>
      {/* Header */}
      <div className="flex items-center h-14 px-3 border-b border-border-primary/40">
        {collapsed ? (
          <img src="/logo.png" alt="ProlineMarketsFX" className="w-7 h-7 object-contain mx-auto" />
        ) : (
          <Link href="/" className="flex items-center gap-2 min-w-0">
            <img src="/logo.png" alt="ProlineMarketsFX" className="w-7 h-7 object-contain shrink-0" />
            <span className="font-bold tracking-tight text-sm select-none">
              <span className="text-text-primary">ProlineMarkets</span><span className="text-[#00e676]">FX</span>
            </span>
          </Link>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn('p-1.5 text-text-tertiary hover:text-accent transition-fast rounded-md hover:bg-accent/10', !collapsed && 'ml-auto')}
        >
          {collapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2">
        {visibleItems.map((item) => {
          if (item.children) {
            const isExpanded = expandedGroups.includes(item.label);
            const hasActiveChild = item.children.some((c) => pathname?.startsWith(c.href));
            return (
              <div key={item.label}>
                <button
                  onClick={() => toggleGroup(item.label)}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 text-xs font-medium transition-fast rounded-md mx-1',
                    hasActiveChild ? 'text-accent bg-accent/8' : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover',
                  )}
                >
                  <item.icon size={16} />
                  {!collapsed && (
                    <>
                      <span className="flex-1 text-left">{item.label}</span>
                      {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    </>
                  )}
                </button>
                {isExpanded && !collapsed && (
                  <div className="ml-4 border-l border-border-primary">
                    {item.children.filter(c => hasAccess(c.perm)).map((child) => (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={cn(
                          'block pl-4 pr-3 py-1.5 text-xs transition-fast',
                          isActive(child.href)
                            ? 'text-accent border-l-2 border-accent -ml-px font-semibold'
                            : 'text-text-tertiary hover:text-text-primary hover:text-accent/80',
                        )}
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          return (
            <Link
              key={item.label}
              href={item.href!}
              className={cn(
                'flex items-center gap-2 px-3 py-2 text-xs font-medium transition-fast relative rounded-md mx-1',
                isActive(item.href)
                  ? 'nav-active'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover',
              )}
            >
              <item.icon size={16} />
              {!collapsed && (
                <>
                  <span>{item.label}</span>
                  {item.badge && item.badge > 0 && (
                    <span className="ml-auto px-1.5 py-0.5 text-xxs bg-sell/20 text-sell rounded-sm tabular-nums">
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
