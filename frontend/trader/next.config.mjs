import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
// API proxying is handled by the route handler at src/app/api/v1/[...path]/route.ts.
// Do NOT use rewrites() for /api/v1/* — in standalone mode, Next.js can leak the
// internal gateway URL (http://gateway:8000) to the browser, causing mixed-content
// blocks on HTTPS sites.

const isDev = process.env.NODE_ENV !== 'production';

const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  ...(isDev && {
    experimental: {
      staleTimes: { dynamic: 0, static: 0 },
    },
  }),
  /** Any URL Next.js can't match falls through to the landing Vite app
      (Docker service on the same network). Keeps the same host (localhost:3010) for users. */
  async rewrites() {
    return {
      fallback: [
        {
          source: '/:path*',
          destination: `${process.env.LANDING_PROXY_TARGET || 'http://landing:5173'}/:path*`,
        },
      ],
    };
  },
  /** Set NEXT_PUBLIC_APP_VERSION at Docker build so each deploy gets new `_next/static` hashes. */
  generateBuildId: async () => {
    const v = process.env.NEXT_PUBLIC_APP_VERSION?.trim();
    if (v) return v.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 48) || 'release';
    return 'development';
  },
  images: {
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'https', hostname: '**' },
    ],
  },
  async headers() {
    if (!isDev) return [];
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' },
          { key: 'Pragma', value: 'no-cache' },
        ],
      },
    ];
  },
};

export default nextConfig;
