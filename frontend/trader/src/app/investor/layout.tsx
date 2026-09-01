import type { Metadata } from 'next';

/**
 * Server-rendered manifest link for the investor login page.
 *
 * This is the page an investor is told to add to their home screen, and both
 * iOS and Chrome read the manifest's start_url — not the current URL — when
 * they do. InstallApp can attach the same manifest from the client, but that
 * only lands after hydration; emitting it here means it is in the document the
 * moment Safari's "Add to Home Screen" reads it.
 */
export const metadata: Metadata = {
  title: 'Investor Login — ProlineMarketsFX',
  manifest: '/investor.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'Proline Investor',
    statusBarStyle: 'black-translucent',
  },
};

export default function InvestorLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
