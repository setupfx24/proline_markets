'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { clsx } from 'clsx';
import { ChevronDown, Search, Star, Newspaper, BarChart3 } from 'lucide-react';
import { useTradingStore, type InstrumentInfo } from '@/stores/tradingStore';
import { tradingTerminalUrl } from '@/lib/tradingNav';
import SymbolIcon from './SymbolIcon';

type Trend = 'up' | 'down' | 'neutral';
type Segment = 'All' | 'Forex' | 'Crypto' | 'Indices' | 'Commodities' | 'Metals' | 'Stocks';
type View = 'instruments' | 'news';

const SEGMENTS: Segment[] = ['All', 'Forex', 'Crypto', 'Indices', 'Commodities', 'Metals', 'Stocks'];

const SYMBOL_DESC: Record<string, string> = {
  EURUSD: 'Euro vs US Dollar',
  GBPUSD: 'British Pound vs US Dollar',
  USDJPY: 'US Dollar vs Japanese Yen',
  AUDUSD: 'Australian Dollar vs US Dollar',
  USDCAD: 'US Dollar vs Canadian Dollar',
  USDCHF: 'US Dollar vs Swiss Franc',
  NZDUSD: 'New Zealand Dollar vs US Dollar',
  EURGBP: 'Euro vs British Pound',
  EURJPY: 'Euro vs Japanese Yen',
  GBPJPY: 'British Pound vs Japanese Yen',
  XAUUSD: 'Gold vs US Dollar',
  XAGUSD: 'Silver vs US Dollar',
  USOIL: 'Crude Oil',
  US30: 'Dow Jones Industrial',
  US500: 'S&P 500 Index',
  NAS100: 'NASDAQ 100 Index',
  UK100: 'FTSE 100 Index',
  GER40: 'DAX 40 Index',
  BTCUSD: 'Bitcoin vs US Dollar',
  ETHUSD: 'Ethereum vs US Dollar',
  LTCUSD: 'Litecoin vs US Dollar',
  XRPUSD: 'Ripple vs US Dollar',
  SOLUSD: 'Solana vs US Dollar',
  DOGUSD: 'Dogecoin vs US Dollar',
  DOGEUSD: 'Dogecoin vs US Dollar',
  ADAUSD: 'Cardano vs US Dollar',
  BCHUSD: 'Bitcoin Cash vs US Dollar',
  BNBUSD: 'Binance Coin vs US Dollar',
  DOTUSD: 'Polkadot vs US Dollar',
  LNKUSD: 'Chainlink vs US Dollar',
};

function getDigits(symbol: string): number {
  if (['USDJPY', 'EURJPY', 'GBPJPY', 'AUDJPY', 'CADJPY', 'NZDJPY'].includes(symbol)) return 3;
  if (symbol === 'XRPUSD') return 4;
  if (['XAUUSD', 'USOIL', 'BTCUSD', 'ETHUSD', 'LTCUSD', 'SOLUSD', 'DOGUSD', 'DOGEUSD'].includes(symbol))
    return 2;
  if (['US30', 'US500', 'NAS100', 'UK100', 'GER40'].includes(symbol)) return 1;
  return 5;
}

function segmentOf(symbol: string, instruments: InstrumentInfo[]): Segment {
  const u = symbol.toUpperCase();
  if (u === 'XAUUSD' || u === 'XAGUSD') return 'Metals';
  if (u === 'USOIL') return 'Commodities';
  const inst = instruments.find((i) => i.symbol === symbol);
  const seg = String(inst?.segment || '').toLowerCase();
  if (seg.includes('crypto')) return 'Crypto';
  if (seg.includes('indices') || seg.includes('index')) return 'Indices';
  if (seg.includes('commodit')) return 'Commodities';
  if (seg.includes('metal')) return 'Metals';
  if (seg.includes('stock') || seg.includes('equit')) return 'Stocks';
  return 'Forex';
}

function spreadInPips(
  symbol: string,
  bid: number,
  ask: number,
  instruments: InstrumentInfo[],
): number {
  const pip = instruments.find((i) => i.symbol === symbol)?.pip_size || 0.0001;
  return Math.max(0, Math.round(((ask - bid) / pip) * 10) / 10);
}

export type InstrumentsTableProps = {
  onExitMarkets?: () => void;
  onViewNews?: () => void;
};

export default function InstrumentsTable({ onExitMarkets, onViewNews }: InstrumentsTableProps) {
  const router = useRouter();
  const urlParams = useSearchParams();
  const { watchlist, prices, selectedSymbol, setSelectedSymbol, instruments, activeAccount } =
    useTradingStore();

  const [view, setView] = useState<View>('instruments');
  const [search, setSearch] = useState('');
  const [segment, setSegment] = useState<Segment>('All');
  const [segOpen, setSegOpen] = useState(false);
  const [starred, setStarred] = useState<Set<string>>(new Set());
  const [starredOnly, setStarredOnly] = useState(false);
  const [bidFlash, setBidFlash] = useState<Record<string, Trend>>({});
  const [askFlash, setAskFlash] = useState<Record<string, Trend>>({});
  const segRef = useRef<HTMLDivElement>(null);

  const dayLowRef = useRef<Record<string, number>>({});
  const dayHighRef = useRef<Record<string, number>>({});
  const prevTickRef = useRef<Record<string, { bid: number; ask: number }>>({});

  // Track Day High/Low
  useEffect(() => {
    for (const symbol of watchlist) {
      const tick = prices[symbol];
      if (!tick) continue;
      if (!(symbol in dayLowRef.current)) {
        dayLowRef.current[symbol] = tick.bid;
        dayHighRef.current[symbol] = tick.bid;
      } else {
        if (tick.bid < dayLowRef.current[symbol]) dayLowRef.current[symbol] = tick.bid;
        if (tick.bid > dayHighRef.current[symbol]) dayHighRef.current[symbol] = tick.bid;
      }
    }
  }, [prices, watchlist]);

  // Flash bid/ask on changes
  useEffect(() => {
    const nextBid: Record<string, Trend> = {};
    const nextAsk: Record<string, Trend> = {};
    for (const symbol of watchlist) {
      const tick = prices[symbol];
      if (!tick) continue;
      const prev = prevTickRef.current[symbol];
      if (prev) {
        if (tick.bid > prev.bid) nextBid[symbol] = 'up';
        else if (tick.bid < prev.bid) nextBid[symbol] = 'down';
        if (tick.ask > prev.ask) nextAsk[symbol] = 'up';
        else if (tick.ask < prev.ask) nextAsk[symbol] = 'down';
      }
      prevTickRef.current[symbol] = { bid: tick.bid, ask: tick.ask };
    }
    if (Object.keys(nextBid).length === 0 && Object.keys(nextAsk).length === 0) return;
    setBidFlash((p) => ({ ...p, ...nextBid }));
    setAskFlash((p) => ({ ...p, ...nextAsk }));
    const timer = setTimeout(() => {
      setBidFlash((p) => {
        const n = { ...p };
        for (const k of Object.keys(nextBid)) delete n[k];
        return n;
      });
      setAskFlash((p) => {
        const n = { ...p };
        for (const k of Object.keys(nextAsk)) delete n[k];
        return n;
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [prices, watchlist]);

  // Close segment dropdown on outside click
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (segRef.current && !segRef.current.contains(e.target as Node)) setSegOpen(false);
    };
    if (segOpen) document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [segOpen]);

  const rows = useMemo(() => {
    /* When the user is searching, broaden the source to every priced
       instrument so terms like 'silver'/'gold'/'bitcoin' can find symbols
       that aren't already on the watchlist. */
    const hasQuery = search.trim().length > 0;
    const source: string[] = hasQuery
      ? Array.from(new Set([...watchlist, ...instruments.map((i) => i.symbol)]))
      : watchlist;
    const q = search.toLowerCase();
    return source
      .filter((s) => prices[s] != null)
      .filter((s) => {
        if (hasQuery) {
          const inst = instruments.find((i) => i.symbol === s);
          const hay = `${s} ${inst?.display_name || ''} ${SYMBOL_DESC[s] || ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        if (starredOnly && !starred.has(s)) return false;
        if (segment !== 'All' && segmentOf(s, instruments) !== segment) return false;
        return true;
      });
  }, [watchlist, prices, search, segment, starred, starredOnly, instruments]);

  const leverage = activeAccount?.leverage ?? 500;

  const handleRowClick = (symbol: string) => {
    setSelectedSymbol(symbol);
    if (onExitMarkets) {
      onExitMarkets();
      return;
    }
    const acc = urlParams.get('account');
    if (acc) router.push(tradingTerminalUrl(acc, { view: 'chart' }));
  };

  const toggleStar = (symbol: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setStarred((p) => {
      const next = new Set(p);
      if (next.has(symbol)) next.delete(symbol);
      else next.add(symbol);
      return next;
    });
  };

  return (
    <div className="h-full min-h-0 flex flex-col bg-bg-base text-text-primary">
      {/* Top toolbar — view toggle + search + segment dropdown + star */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-2.5 border-b border-border-primary bg-bg-secondary">
        {/* View toggle: Instruments / News */}
        <div className="flex items-center gap-1 shrink-0 rounded-lg border border-border-primary bg-bg-secondary p-0.5">
          <button
            type="button"
            onClick={() => setView('instruments')}
            className={clsx(
              'flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold uppercase tracking-wide transition-colors',
              view === 'instruments'
                ? 'bg-accent/15 text-accent'
                : 'text-text-tertiary hover:text-text-primary',
            )}
            aria-label="Instruments"
          >
            <BarChart3 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              setView('news');
              if (onViewNews) onViewNews();
            }}
            className={clsx(
              'flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold uppercase tracking-wide transition-colors',
              view === 'news' ? 'bg-accent/15 text-accent' : 'text-text-tertiary hover:text-text-primary',
            )}
            aria-label="News"
          >
            <Newspaper className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-tertiary" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-border-primary bg-bg-secondary text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20"
          />
        </div>

        {/* Segment dropdown */}
        <div className="relative shrink-0" ref={segRef}>
          <button
            type="button"
            onClick={() => setSegOpen((p) => !p)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-border-primary bg-bg-secondary text-text-primary hover:border-border-secondary transition-colors min-w-[110px] justify-between"
          >
            <span>{segment}</span>
            <ChevronDown
              className={clsx('w-3.5 h-3.5 text-text-tertiary transition-transform', segOpen && 'rotate-180')}
            />
          </button>
          {segOpen && (
            <div className="absolute right-0 top-full mt-1 w-[140px] rounded-lg border border-border-primary bg-card shadow-2xl z-50 py-1">
              {SEGMENTS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setSegment(s);
                    setSegOpen(false);
                  }}
                  className={clsx(
                    'w-full text-left px-3 py-1.5 text-xs transition-colors',
                    s === segment
                      ? 'bg-accent/10 text-accent font-bold'
                      : 'text-text-secondary hover:bg-bg-hover',
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Starred filter toggle */}
        <button
          type="button"
          onClick={() => setStarredOnly((p) => !p)}
          className={clsx(
            'shrink-0 p-1.5 rounded-lg border transition-colors',
            starredOnly
              ? 'bg-accent/10 border-accent/40 text-accent'
              : 'bg-bg-secondary border-border-primary text-text-tertiary hover:text-text-primary',
          )}
          aria-label="Show starred only"
        >
          <Star className="w-3.5 h-3.5" fill={starredOnly ? 'currentColor' : 'none'} />
        </button>
      </div>

      {/* Table header */}
      <div className="shrink-0 grid grid-cols-[minmax(160px,1.6fr)_minmax(80px,1fr)_minmax(80px,1fr)_70px_80px_minmax(90px,1fr)_minmax(90px,1fr)_minmax(140px,1.4fr)] gap-3 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-text-tertiary border-b border-border-primary bg-bg-secondary">
        <div>Instruments</div>
        <div className="text-right">Bid</div>
        <div className="text-right">Ask</div>
        <div className="text-right">Spread</div>
        <div className="text-right">Leverage</div>
        <div className="text-right">Day High</div>
        <div className="text-right">Day Low</div>
        <div>Description</div>
      </div>

      {/* Table rows */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        {rows.length === 0 ? (
          <div className="flex items-center justify-center h-full text-xs text-text-tertiary">
            No instruments match
          </div>
        ) : (
          rows.map((symbol) => {
            const tick = prices[symbol];
            const digits = getDigits(symbol);
            const sel = symbol === selectedSymbol;
            const bFlash = bidFlash[symbol];
            const aFlash = askFlash[symbol];
            const dayHigh = dayHighRef.current[symbol];
            const dayLow = dayLowRef.current[symbol];
            const spread = tick ? spreadInPips(symbol, tick.bid, tick.ask, instruments) : null;
            const desc = SYMBOL_DESC[symbol] || '';
            const isStarred = starred.has(symbol);

            return (
              <button
                key={symbol}
                type="button"
                onClick={() => handleRowClick(symbol)}
                className={clsx(
                  'w-full grid grid-cols-[minmax(160px,1.6fr)_minmax(80px,1fr)_minmax(80px,1fr)_70px_80px_minmax(90px,1fr)_minmax(90px,1fr)_minmax(140px,1.4fr)] gap-3 px-3 py-2.5 text-left border-b border-border-primary transition-colors items-center',
                  sel
                    ? 'bg-accent/[0.06] border-l-[3px] border-l-accent pl-[9px]'
                    : 'border-l-[3px] border-l-transparent hover:bg-bg-hover',
                )}
              >
                {/* Instruments — star + dot + symbol + flag */}
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => toggleStar(symbol, e)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleStar(symbol, e as any); }}
                    className={clsx(
                      'shrink-0 transition-colors cursor-pointer',
                      isStarred ? 'text-accent' : 'text-text-tertiary/50 hover:text-text-tertiary',
                    )}
                    aria-label="Star"
                  >
                    <Star className="w-3 h-3" fill={isStarred ? 'currentColor' : 'none'} />
                  </span>
                  <SymbolIcon symbol={symbol} size={20} />
                  <span className="text-[13px] font-bold text-text-primary font-mono truncate">{symbol}</span>
                </div>

                {/* Bid */}
                <div
                  className={clsx(
                    'text-right text-[13px] font-mono font-semibold tabular-nums tracking-tight',
                    bFlash === 'up'
                      ? 'text-[#22c55e]'
                      : bFlash === 'down'
                        ? 'text-[#ef5350]'
                        : 'text-[#22c55e]',
                  )}
                >
                  {tick ? tick.bid.toFixed(digits) : '—'}
                </div>

                {/* Ask */}
                <div
                  className={clsx(
                    'text-right text-[13px] font-mono font-semibold tabular-nums tracking-tight',
                    aFlash === 'up'
                      ? 'text-[#22c55e]'
                      : aFlash === 'down'
                        ? 'text-[#ef5350]'
                        : 'text-[#22c55e]',
                  )}
                >
                  {tick ? tick.ask.toFixed(digits) : '—'}
                </div>

                {/* Spread */}
                <div className="text-right text-[12px] font-mono text-text-secondary tabular-nums">
                  {spread != null ? spread.toFixed(1) : '—'}
                </div>

                {/* Leverage */}
                <div className="text-right text-[12px] font-mono text-text-secondary tabular-nums">
                  {leverage}
                </div>

                {/* Day High */}
                <div className="text-right text-[12px] font-mono text-text-secondary tabular-nums">
                  {dayHigh != null ? dayHigh.toFixed(digits) : '—'}
                </div>

                {/* Day Low */}
                <div className="text-right text-[12px] font-mono text-text-secondary tabular-nums">
                  {dayLow != null ? dayLow.toFixed(digits) : '—'}
                </div>

                {/* Description */}
                <div className="text-[12px] text-text-secondary truncate">{desc}</div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
