import type { MetadataRoute } from 'next';

// Served at /manifest.webmanifest. Next.js injects the <link rel="manifest">
// into every page it renders — which is exactly the pages behind login, since
// the marketing site at / is served by the separate Vite app via the fallback
// rewrite in next.config.mjs and never passes through this layout.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/dashboard',
    name: 'ProlineMarketsFX',
    short_name: 'Proline',
    description:
      'Trade forex, metals, indices and crypto from a full charting terminal — live prices, ' +
      'one-click orders, and your positions, wallet and account history in one place.',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#0a0a0a',
    theme_color: '#0a0a0a',
    categories: ['finance', 'business'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-192-maskable.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    // Chrome only shows the rich install dialog — description + preview, like
    // hpanel.hostinger.com — when the manifest carries both a description and
    // at least one screenshot. Desktop needs `wide`, Android needs `narrow`,
    // and every screenshot sharing a form_factor must share an aspect ratio.
    screenshots: [
      {
        src: '/screenshots/terminal-wide.png',
        sizes: '1920x1080',
        type: 'image/png',
        form_factor: 'wide',
        label: 'Trading terminal with live chart, order ticket and open positions',
      },
    ],
    shortcuts: [
      { name: 'Trading terminal', url: '/trading' },
      { name: 'Wallet', url: '/wallet' },
    ],
  };
}
