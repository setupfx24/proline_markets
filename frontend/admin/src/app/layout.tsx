import React from 'react';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import ThemeInitScript from '@/components/ThemeInitScript';
import AppToaster from '@/components/AppToaster';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'ProlineMarkets Admin',
  description: 'ProlineMarkets broker administration panel',
  icons: {
    icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable} style={{ ['--font-jetbrains' as string]: "ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace" }}>
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </head>
      <body className={`${inter.className} min-h-screen bg-bg-page text-text-primary antialiased`}>
        <ThemeInitScript />
        {children}
        <AppToaster />
      </body>
    </html>
  );
}
