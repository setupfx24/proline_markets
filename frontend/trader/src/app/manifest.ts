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
    description: 'Professional forex and CFD trading platform',
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
    shortcuts: [
      { name: 'Trading terminal', url: '/trading' },
      { name: 'Wallet', url: '/wallet' },
    ],
  };
}
