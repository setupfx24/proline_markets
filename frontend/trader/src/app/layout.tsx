import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Suspense } from 'react';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from '@/components/ThemeProvider';
import MobileBottomNav from '@/components/layout/MobileBottomNav';
import { AuthProvider } from '@/components/providers/AuthProvider';
import NotificationListener from '@/components/NotificationListener';
import TopLoader from '@/components/TopLoader';
import InstallApp from '@/components/pwa/InstallApp';
import StandaloneGuard from '@/components/pwa/StandaloneGuard';

export const metadata: Metadata = {
  title: 'ProlineMarketsFX',
  description: 'ProlineMarketsFX â€” professional forex and CFD trading platform',
  icons: {
    icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
    // iOS ignores the web app manifest and reads this instead.
    apple: [{ url: '/icons/icon-180.png', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: {
    capable: true,
    title: 'Proline',
    statusBarStyle: 'black-translucent',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#ffffff',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var L='ProlineMarkets-ui',N='ProlineMarkets-ui';var o=localStorage.getItem(L),n=localStorage.getItem(N);if(o&&!n){localStorage.setItem(N,o);localStorage.removeItem(L);}var s=localStorage.getItem(N);var t='dark';if(s){var j=JSON.parse(s);t=(j&&j.state&&j.state.theme)||(j&&j.theme)||'dark';}var d=document.documentElement;d.setAttribute('data-theme',t);d.classList.add(t==='light'?'theme-light':'theme-dark');if(t==='light'){d.style.backgroundColor='#ffffff';d.style.color='#111827';}else{d.style.backgroundColor='#0a0a0a';d.style.color='#ffffff';}}catch(e){document.documentElement.setAttribute('data-theme','light');document.documentElement.style.backgroundColor='#ffffff';document.documentElement.style.color='#111827';}})();`,
          }}
        />
        {/* Marks the document before first paint when running as the installed
            app, so the CSS in globals.css can hide the full-site chrome
            straight away. StandaloneGuard still does the redirect — this only
            stops the dashboard flashing up in the frame before it runs. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if(window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true){document.documentElement.setAttribute('data-standalone','1');}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full">
        <Suspense fallback={null}>
          <TopLoader />
        </Suspense>
        <ThemeProvider>
          <AuthProvider>
            <NotificationListener />
            <InstallApp />
            <Suspense fallback={null}>
              <StandaloneGuard />
            </Suspense>
            {children}
            <Suspense fallback={null}>
              <MobileBottomNav />
            </Suspense>
            <Toaster
              position="top-center"
              containerClassName="ProlineMarkets-toaster"
              toastOptions={{
                duration: 1500,
                className: 'ProlineMarkets-hot-toast',
                style: {
                  background: 'var(--toast-bg)',
                  color: 'var(--toast-fg)',
                  border: '1px solid var(--toast-border)',
                  fontSize: '13px',
                  borderRadius: '12px',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                },
                success: {
                  duration: 1500,
                  className: 'ProlineMarkets-hot-toast',
                  iconTheme: { primary: '#22c55e', secondary: 'var(--toast-bg)' },
                },
                error: {
                  duration: 2500,
                  className: 'ProlineMarkets-hot-toast',
                  iconTheme: { primary: '#f87171', secondary: 'var(--toast-bg)' },
                },
                loading: { className: 'ProlineMarkets-hot-toast' },
              }}
            />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
