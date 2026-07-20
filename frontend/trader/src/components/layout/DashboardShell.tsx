'use client';

import Link from 'next/link';
import { MessageSquare } from 'lucide-react';
import { useShellStore } from '@/stores/shellStore';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import AppSidebar from './AppSidebar';
import AppHeader from './AppHeader';

export default function DashboardShell({
  children,
  className,
  mainClassName,
}: {
  children: React.ReactNode;
  className?: string;
  mainClassName?: string;
}) {
  const { sidebarOpen } = useShellStore();
  const pathname = usePathname();

  return (
    <div
      // The installed app is terminal-only. StandaloneGuard redirects away
      // from these pages, but that runs in an effect — one frame too late to
      // stop the full site flashing up first. This marks the chrome so the
      // pre-hydration script in layout.tsx can hide it via CSS immediately.
      data-app-chrome=""
      className={cn(
        'h-[100dvh] flex overflow-hidden pb-[70px] lg:pb-0 bg-bg-base text-text-primary',
        className,
      )}
    >
      <AppSidebar />
      <div
        className={cn(
          'flex min-w-0 flex-1 flex-col bg-bg-base transition-[margin] duration-200',
          sidebarOpen && 'lg:ml-[260px]',
        )}
      >
        <AppHeader />
        <main
          key={pathname}
          className={cn(
            'dashboard-main-scroll min-h-0 flex-1 overflow-y-auto bg-bg-base p-2.5 sm:p-4 md:p-6 page-fade-in',
            mainClassName,
          )}
        >
          {children}
        </main>
      </div>
      <Link
        href="/support"
        className="fixed bottom-20 md:bottom-6 right-6 z-[75] w-12 h-12 rounded-full bg-[#22c55e] hover:bg-[#16a34a] shadow-lg shadow-[#22c55e]/20 flex items-center justify-center transition-colors"
        aria-label="Support"
      >
        <MessageSquare size={20} className="text-white" />
      </Link>
    </div>
  );
}
