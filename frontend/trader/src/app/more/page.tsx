'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { NotificationBell } from '@/components/NotificationListener';
import { useAuthStore } from '@/stores/authStore';
import DashboardShell from '@/components/layout/DashboardShell';

export default function MorePage() {
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    router.push('/auth/login');
  };

  const initials = user
    ? (
        user.first_name?.[0] && user.last_name?.[0]
          ? `${user.first_name[0]}${user.last_name[0]}`
          : user.first_name?.[0] || user.email?.[0] || 'U'
      ).toUpperCase()
    : 'U';

  const menuItems = [
    { label: 'Social / Copy Trading', href: '/social', icon: '🫂' },
    { label: 'Business / IB', href: '/business', icon: '💼' },
    { label: 'Support & Help', href: '/support', icon: '🎧' },
  ];

  return (
    <DashboardShell mainClassName="p-0">
      <div className="flex-1 overflow-y-auto px-4 py-6 max-w-lg mx-auto w-full space-y-6">
        <h2 className="text-xl font-semibold text-text-primary">More</h2>

        {/* Profile Card */}
        <div className="glass-card rounded-2xl p-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full glass-card flex items-center justify-center text-lg font-bold text-text-primary">
              {initials}
            </div>
            <div>
              <p className="text-sm font-semibold text-text-primary">
                {user ? [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email?.split('@')[0] : 'Trader'}
              </p>
              <p className="text-xs text-text-tertiary">{user?.email}</p>
            </div>
          </div>
          
          <Link href="/profile" className="px-3 py-1.5 rounded-lg text-xs font-medium border border-border-glass text-text-secondary hover:text-text-primary hover:bg-bg-hover">
            Manage
          </Link>
        </div>

        {/* Centralized Actions */}
        <div className="grid grid-cols-2 gap-3">
          <div className="glass-card rounded-xl p-4 flex flex-col items-center justify-center gap-3">
            <span className="text-xs text-text-tertiary font-medium">Appearance</span>
            <div className="transform scale-110">
              <ThemeToggle />
            </div>
          </div>
          <div className="glass-card rounded-xl p-4 flex flex-col items-center justify-center gap-3">
            <span className="text-xs text-text-tertiary font-medium">Notifications</span>
            <div className="transform scale-110">
              <NotificationBell />
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <div className="glass-card rounded-2xl overflow-hidden divide-y divide-border-glass">
          {menuItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center justify-between p-4 hover:bg-bg-hover/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{item.icon}</span>
                <span className="text-sm font-medium text-text-primary">{item.label}</span>
              </div>
              <span className="text-text-tertiary text-xs">→</span>
            </Link>
          ))}
        </div>

        {/* Logout */}
        <button
          type="button"
          onClick={handleLogout}
          className="w-full glass-card rounded-2xl p-4 flex items-center justify-center gap-2 text-sell hover:bg-sell/10 transition-colors text-sm font-semibold"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Logout
        </button>
      </div>
    </DashboardShell>
  );
}
