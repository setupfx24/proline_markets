'use client';

import { useState } from 'react';
import { useTradingStore } from '@/stores/tradingStore';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { sounds, unlockAudio } from '@/lib/sounds';

interface MobileOrderSheetProps {
  symbol: string;
  onClose: () => void;
  onGoToChart?: () => void;
}

type PendingSubtype = 'buy_limit' | 'sell_limit' | 'buy_stop' | 'sell_stop';

function pendingSubtypeToApi(sub: PendingSubtype): { order_type: 'limit' | 'stop'; side: 'buy' | 'sell' } {
  switch (sub) {
    case 'buy_limit':
      return { order_type: 'limit', side: 'buy' };
    case 'sell_limit':
      return { order_type: 'limit', side: 'sell' };
    case 'buy_stop':
      return { order_type: 'stop', side: 'buy' };
    case 'sell_stop':
      return { order_type: 'stop', side: 'sell' };
  }
}

export default function MobileOrderSheet({ symbol, onClose, onGoToChart }: MobileOrderSheetProps) {
  const { prices, instruments, activeAccount, placeOrder } = useTradingStore();
  const [orderType, setOrderType] = useState<'market' | 'pending'>('market');
  const [pendingSubtype, setPendingSubtype] = useState<PendingSubtype>('buy_limit');
  const [submitting, setSubmitting] = useState(false);
  const [lots, setLots] = useState(0.01);
  const [lotsInput, setLotsInput] = useState('0.01');
  const [leverage, setLeverage] = useState('1:100');
  const [sl, setSl] = useState('');
  const [tp, setTp] = useState('');
  const [entryPrice, setEntryPrice] = useState('');
  
  const instrument = instruments.find(i => i.symbol === symbol);
  const price = prices[symbol];
  const digits = instrument?.digits ?? 5;
  const spread = price ? (price.ask - price.bid) * Math.pow(10, digits - 1) : 0;

  const handleAdjustLots = (delta: number) => {
    setLots(prev => {
      const next = Math.max(0.01, parseFloat((prev + delta).toFixed(2)));
      setLotsInput(next.toString());
      return next;
    });
  };

  const handlePlaceOrder = async (overrideSide?: 'buy' | 'sell') => {
    if (!activeAccount) {
      toast.error('No active account selected');
      return;
    }
    unlockAudio();

    let apiOrderType: 'market' | 'limit' | 'stop';
    let side: 'buy' | 'sell';
    let priceVal: number | undefined;

    if (orderType === 'market') {
      if (!overrideSide) {
        toast.error('Select Buy or Sell');
        return;
      }
      apiOrderType = 'market';
      side = overrideSide;
      priceVal = undefined;
    } else {
      const mapped = pendingSubtypeToApi(pendingSubtype);
      apiOrderType = mapped.order_type;
      side = mapped.side;
      const p = parseFloat(entryPrice);
      if (!Number.isFinite(p) || p <= 0) {
        toast.error('Enter a valid entry price');
        return;
      }
      priceVal = p;
    }

    if (!Number.isFinite(lots) || lots <= 0) {
      toast.error('Invalid volume');
      return;
    }

    const slNum = sl.trim() ? parseFloat(sl) : NaN;
    const tpNum = tp.trim() ? parseFloat(tp) : NaN;

    // Optimistic: instant feedback, API fires in background
    sounds.orderPlaced();
    const label =
      orderType === 'market'
        ? `${side.toUpperCase()} ${lots} ${symbol}`
        : `${apiOrderType} ${side} ${lots} ${symbol}`;
    toast.success(label);
    onClose();
    placeOrder({
      account_id: activeAccount.id,
      symbol,
      side,
      order_type: apiOrderType,
      lots,
      price: priceVal,
      stop_loss: Number.isFinite(slNum) ? slNum : undefined,
      take_profit: Number.isFinite(tpNum) ? tpNum : undefined,
    }).catch((err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Failed to place order');
    });
  };

  return (
    <div className="fixed inset-0 z-[80] md:hidden">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
        onClick={onClose}
      />
      
      {/* Sheet */}
      <div className="absolute bottom-0 left-0 right-0 bg-bg-primary rounded-t-[32px] border-t border-border-glass shadow-2xl animate-in slide-in-from-bottom duration-150 flex flex-col max-h-[92vh] select-none">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-text-tertiary/30 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-6 py-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-text-primary tracking-tight">{symbol}</h2>
            <p className="text-[10px] text-text-tertiary font-bold uppercase tracking-widest mt-0.5">
              {instrument?.display_name || symbol}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {onGoToChart && (
              <button
                onClick={() => { onClose(); onGoToChart(); }}
                className="w-9 h-9 flex items-center justify-center bg-bg-secondary rounded-full text-text-tertiary hover:text-buy transition-colors border border-border-glass"
                title="Open chart"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v18h18"/><path d="m7 14 4-4 4 4 5-5"/></svg>
              </button>
            )}
            <button 
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center bg-bg-secondary rounded-full text-text-tertiary hover:text-text-primary transition-colors border border-border-glass"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>
        </div>

        <div className="px-6 pb-10 flex-1 overflow-y-auto space-y-5 scrollbar-none">
          {/* Leverage Selector */}
          <div className="flex items-center justify-between p-3.5 bg-bg-secondary rounded-xl border border-border-glass">
            <span className="text-xs font-bold text-text-tertiary">Leverage</span>
            <div className="flex items-center gap-1.5 text-warning font-black text-xs">
              {leverage}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m6 9 6 6 6-6"/></svg>
            </div>
          </div>

          {/* Quick Bid/Ask Boxes */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-sell rounded-xl p-3 flex flex-col items-center justify-center shadow-lg shadow-sell/20">
              <span className="text-[9px] font-black text-white/60 uppercase tracking-widest mb-0.5">Sell Price</span>
              <span className="text-xl font-black text-white font-mono tabular-nums tracking-tighter">
                {price?.bid.toFixed(digits) || '--'}
              </span>
            </div>
            <div className="bg-buy rounded-xl p-3 flex flex-col items-center justify-center shadow-lg shadow-buy/20">
              <span className="text-[9px] font-black text-white/60 uppercase tracking-widest mb-0.5">Buy Price</span>
              <span className="text-xl font-black text-white font-mono tabular-nums tracking-tighter">
                {price?.ask.toFixed(digits) || '--'}
              </span>
            </div>
          </div>

          <div className="text-center">
            <span className="text-[9px] font-bold text-text-tertiary/40 uppercase tracking-[0.2em] -mt-2 block">Spread: {spread.toFixed(1)} pips</span>
          </div>

          {/* Market/Pending Switch */}
          <div className="grid grid-cols-2 bg-bg-secondary p-1 rounded-xl border border-border-glass">
            <button 
              onClick={() => setOrderType('market')}
              className={clsx(
                "py-2.5 rounded-lg text-[11px] font-black transition-all uppercase tracking-widest",
                orderType === 'market' ? "bg-bg-hover text-text-primary shadow-xl" : "text-text-tertiary hover:text-text-primary"
              )}
            >
              Market
            </button>
            <button 
              onClick={() => setOrderType('pending')}
              className={clsx(
                "py-2.5 rounded-lg text-[11px] font-black transition-all uppercase tracking-widest",
                orderType === 'pending' ? "bg-buy text-white shadow-lg shadow-buy/20" : "text-text-tertiary hover:text-text-primary"
              )}
            >
              Pending
            </button>
          </div>

          {/* Pending Specific Section */}
          {orderType === 'pending' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-text-tertiary uppercase tracking-widest block ml-1">Order Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'buy_limit', label: 'Buy Limit' },
                    { id: 'sell_limit', label: 'Sell Limit' },
                    { id: 'buy_stop', label: 'Buy Stop' },
                    { id: 'sell_stop', label: 'Sell Stop' }
                  ].map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setPendingSubtype(t.id as PendingSubtype)}
                      className={clsx(
                        "py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all",
                        pendingSubtype === t.id 
                          ? (t.id.includes('buy') ? "bg-buy border-buy text-white" : "bg-sell border-sell text-white")
                          : "bg-bg-secondary border-border-glass text-text-tertiary"
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black text-text-tertiary uppercase tracking-widest block ml-1">Entry Price</label>
                <div className="relative">
                  <input 
                    type="number" 
                    placeholder="Enter price"
                    value={entryPrice}
                    onChange={(e) => setEntryPrice(e.target.value)}
                    className="w-full h-11 bg-bg-secondary rounded-xl border border-border-glass pl-4 pr-4 text-text-primary text-base font-bold placeholder:text-text-tertiary/30 focus:outline-none focus:border-buy/50 transition-all font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Volume Control */}
          <div className="space-y-2">
             <label className="text-[9px] font-black text-text-tertiary uppercase tracking-widest block ml-1">Volume (Lots)</label>
             <div className="flex items-center gap-3">
                <button 
                  onClick={() => handleAdjustLots(-0.01)}
                  className="w-11 h-11 flex items-center justify-center rounded-xl bg-bg-secondary border border-border-glass text-text-primary active:scale-90 transition-transform shadow-sm"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12h14"/></svg>
                </button>
                <input
                  type="text"
                  inputMode="decimal"
                  value={lotsInput}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === '' || /^\d*\.?\d*$/.test(raw)) {
                      setLotsInput(raw);
                      const v = parseFloat(raw);
                      if (Number.isFinite(v) && v > 0) setLots(v);
                    }
                  }}
                  onBlur={() => {
                    const v = parseFloat(lotsInput);
                    const safe = Number.isFinite(v) && v >= 0.01 ? parseFloat(v.toFixed(2)) : 0.01;
                    setLots(safe);
                    setLotsInput(safe.toString());
                  }}
                  className="flex-1 h-11 bg-bg-secondary rounded-xl border border-border-glass text-center text-lg font-black text-text-primary font-mono tabular-nums outline-none focus:border-accent"
                />
                <button 
                  onClick={() => handleAdjustLots(0.01)}
                  className="w-11 h-11 flex items-center justify-center rounded-xl bg-bg-secondary border border-border-glass text-text-primary active:scale-90 transition-transform shadow-sm"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 5v14M5 12h14"/></svg>
                </button>
             </div>
          </div>

          {/* SL/TP Controls */}
          <div className="grid grid-cols-2 gap-3">
             <div className="space-y-2">
               <label className="text-[9px] font-black text-text-tertiary uppercase tracking-widest block ml-1">Stop Loss</label>
               <input 
                 type="number" 
                 placeholder="Optional"
                 value={sl}
                 onChange={(e) => setSl(e.target.value)}
                 className="w-full h-11 bg-bg-secondary rounded-xl border border-border-glass text-center text-sm text-text-primary font-mono tabular-nums placeholder:text-text-tertiary/30 focus:outline-none focus:border-sell/40 font-bold"
               />
             </div>
             <div className="space-y-2">
               <label className="text-[9px] font-black text-text-tertiary uppercase tracking-widest block ml-1">Take Profit</label>
               <input 
                 type="number" 
                 placeholder="Optional"
                 value={tp}
                 onChange={(e) => setTp(e.target.value)}
                 className="w-full h-11 bg-bg-secondary rounded-xl border border-border-glass text-center text-sm text-text-primary font-mono tabular-nums placeholder:text-text-tertiary/30 focus:outline-none focus:border-success/40 font-bold"
               />
             </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-3">
             {orderType === 'market' ? (
                <div className="grid grid-cols-2 gap-4">
                  <button 
                    type="button"
                    disabled={submitting}
                    onClick={() => handlePlaceOrder('sell')}
                    className="h-14 bg-sell rounded-xl flex items-center justify-center text-lg font-black text-white uppercase tracking-widest shadow-xl shadow-sell/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none"
                  >
                    Sell
                  </button>
                  <button 
                    type="button"
                    disabled={submitting}
                    onClick={() => handlePlaceOrder('buy')}
                    className="h-14 bg-buy rounded-xl flex items-center justify-center text-lg font-black text-white uppercase tracking-widest shadow-xl shadow-buy/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none"
                  >
                    Buy
                  </button>
                </div>
             ) : (
                <button 
                  type="button"
                  onClick={() => handlePlaceOrder()}
                  disabled={!entryPrice.trim() || submitting}
                  className={clsx(
                    "w-full h-14 rounded-xl flex items-center justify-center text-lg font-black uppercase tracking-widest shadow-xl transition-all active:scale-[0.98]",
                    entryPrice.trim() && !submitting
                      ? "bg-buy text-white shadow-buy/20" 
                      : "bg-bg-secondary text-text-tertiary border border-border-glass cursor-not-allowed"
                  )}
                >
                  {submitting ? 'Placing…' : `Place ${pendingSubtype.replace('_', ' ')}`}
                </button>
             )}
          </div>
        </div>
      </div>
    </div>
  );
}
