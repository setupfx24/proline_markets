'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import ShareTradeCard from '@/components/trading/ShareTradeCard';
import { getApiBase } from '@/lib/api/client';

interface SharedTradeData {
  short_code: string;
  status: 'active' | 'closed';
  is_live: boolean;
  symbol: string;
  side: string;
  lots: number;
  leverage: number;
  open_price: number;
  current_price: number;
  pnl: number;
  roi_pct: number;
  ticks: number;
  pip_size: number;
  description: string | null;
  link_description: string | null;
  display_mode: 'pnl' | 'roi' | 'ticks';
  opened_at: string | null;
  closed_at: string | null;
  expires_at: string;
}

export default function SharedTradePage() {
  const params = useParams();
  const code = Array.isArray(params?.code) ? params.code[0] : (params?.code as string);
  const [data, setData] = useState<SharedTradeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!code) return;
    let alive = true;

    const fetchOnce = async () => {
      try {
        const res = await fetch(`${getApiBase()}/public/share/${code}`, { cache: 'no-store' });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          if (alive) setError(body?.detail || `Error ${res.status}`);
          return;
        }
        const body = (await res.json()) as SharedTradeData;
        if (alive) {
          setData(body);
          setError(null);
        }
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        if (alive) setLoading(false);
      }
    };

    fetchOnce();
    pollingRef.current = setInterval(fetchOnce, 3000);

    return () => {
      alive = false;
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [code]);

  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-center p-4 md:p-8"
      style={{
        background:
          'radial-gradient(ellipse at top, rgba(30, 64, 175, 0.25) 0%, rgba(5, 7, 20, 1) 50%, #000 100%)',
      }}
    >
      {/* Header logo */}
      <div className="flex items-center gap-2 mb-8">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2L3 6V12C3 17.5 6.8 22.3 12 23C17.2 22.3 21 17.5 21 12V6L12 2Z" stroke="white" strokeWidth="1.6" fill="none" />
          <path d="M9 12L11 14L15 10" stroke="#10b981" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="text-white text-sm font-bold tracking-[0.25em]">ProlineMarkets FX</span>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-white/70">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading shared trade…</span>
        </div>
      ) : error || !data ? (
        <div className="max-w-md text-center">
          <p className="text-red-400 text-lg font-semibold mb-2">Unable to load trade</p>
          <p className="text-white/60 text-sm">{error || 'This link may have expired or been removed.'}</p>
        </div>
      ) : (
        <>
          <div className="w-full max-w-sm md:max-w-md">
            <ShareTradeCard
              symbol={data.symbol}
              side={data.side}
              lots={data.lots}
              leverage={data.leverage}
              openPrice={data.open_price}
              currentPrice={data.current_price}
              pnl={data.pnl}
              openedAt={data.opened_at}
              closedAt={data.closed_at}
              displayMode={data.display_mode}
              pipSize={data.pip_size}
              status={data.status}
              shortUrl={typeof window !== 'undefined' ? window.location.href : ''}
              roiPct={data.roi_pct}
              ticks={data.ticks}
            />
          </div>

          {data.description && (
            <div className="w-full max-w-sm md:max-w-md mt-6 p-4 rounded-xl bg-white/5 border border-white/10">
              <p className="text-white/90 text-sm leading-relaxed">{data.description}</p>
            </div>
          )}

          {data.link_description && (
            <div className="w-full max-w-sm md:max-w-md mt-4 p-4 rounded-xl bg-white/5 border border-white/10">
              <p className="text-white/70 text-xs mb-1 uppercase tracking-wider">Creator links</p>
              <p className="text-white/90 text-sm leading-relaxed whitespace-pre-wrap break-words">{data.link_description}</p>
            </div>
          )}

          <p className="text-white/40 text-xs mt-10">ProlineMarkets FX © {new Date().getFullYear()}. All rights reserved.</p>
        </>
      )}
    </div>
  );
}
