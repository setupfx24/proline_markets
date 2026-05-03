'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { clsx } from 'clsx';
import { Info, Calculator, RotateCcw, Search, ChevronDown, X } from 'lucide-react';
import { useTradingStore, type InstrumentInfo } from '@/stores/tradingStore';

type CalcTab = 'margin' | 'pnl' | 'lotsize' | 'swap';

const TABS: { id: CalcTab; label: string }[] = [
  { id: 'margin', label: 'Margin' },
  { id: 'pnl', label: 'P&L' },
  { id: 'lotsize', label: 'Lot Size' },
  { id: 'swap', label: 'Swap' },
];

/* ─── Compact field row ─── */
function Row({
  label,
  tip,
  children,
}: {
  label: string;
  tip?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="flex items-center text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
        {label}
        {tip && (
          <span className="ml-1 cursor-help" title={tip}>
            <Info size={11} className="text-text-tertiary" />
          </span>
        )}
      </label>
      {children}
    </div>
  );
}

function CompactSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg py-2 px-2.5 text-[12px] font-medium text-text-primary outline-none appearance-none cursor-pointer bg-bg-secondary border border-border-primary"
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

function CompactInput({
  value,
  onChange,
  placeholder,
  suffix,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  suffix?: string;
}) {
  return (
    <div
      className="flex items-center rounded-lg overflow-hidden bg-bg-secondary border border-border-primary"
    >
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 bg-transparent px-2.5 py-2 text-[12px] font-mono font-bold text-text-primary outline-none w-0 min-w-0 placeholder:text-text-tertiary"
      />
      {suffix && (
        <span className="pr-2.5 text-[10px] font-semibold text-text-tertiary shrink-0">{suffix}</span>
      )}
    </div>
  );
}

/* ─── Compact searchable instrument picker ─── */
function CompactInstrumentPicker({
  value,
  onChange,
  instruments,
}: {
  value: string;
  onChange: (v: string) => void;
  instruments: InstrumentInfo[];
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  const filtered = instruments.filter((i) =>
    i.symbol.toLowerCase().includes(search.toLowerCase()) ||
    i.display_name.toLowerCase().includes(search.toLowerCase()) ||
    i.segment.toLowerCase().includes(search.toLowerCase())
  );

  const current = instruments.find((i) => i.symbol === value);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => { setOpen(!open); setSearch(''); }}
        className="w-full flex items-center justify-between rounded-lg px-2.5 py-2 text-[12px] font-medium text-text-primary cursor-pointer transition-colors bg-bg-secondary border border-border-primary"
      >
        <span className="truncate">{current?.symbol || 'Select Instrument'}</span>
        <ChevronDown size={12} className={`text-text-tertiary shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 z-50 w-full mt-1 rounded-lg overflow-hidden shadow-2xl bg-card border border-border-primary">
          <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-border-primary bg-bg-secondary">
            <Search size={12} className="text-text-tertiary shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="flex-1 bg-transparent text-[11px] text-text-primary outline-none placeholder:text-text-tertiary"
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} className="text-text-tertiary hover:text-text-primary">
                <X size={11} />
              </button>
            )}
          </div>
          <div className="max-h-[180px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
            {filtered.length > 0 ? filtered.map((inst) => (
              <button
                key={inst.symbol}
                type="button"
                onClick={() => { onChange(inst.symbol); setOpen(false); setSearch(''); }}
                className="w-full flex items-center justify-between px-2 py-1.5 text-left transition-colors hover:bg-bg-hover"
                style={{ color: inst.symbol === value ? 'var(--accent, #2962FF)' : 'var(--text-secondary)' }}
              >
                <span className="text-[11px] font-semibold">{inst.symbol}</span>
                <span className="text-[9px] text-text-tertiary">{inst.segment}</span>
              </button>
            )) : (
              <div className="px-2 py-3 text-center text-[10px] text-text-tertiary">No results</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function RiskCalculator() {
  const { selectedSymbol, prices, instruments, activeAccount, accounts } = useTradingStore();

  const [tab, setTab] = useState<CalcTab>('margin');
  const [selectedAccountId, setSelectedAccountId] = useState(activeAccount?.id ?? '');
  const [symbol, setSymbol] = useState(selectedSymbol || 'EURUSD');

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId) || activeAccount;
  const instrumentInfo = instruments.find((i: InstrumentInfo) => i.symbol === symbol);
  const tick = prices[symbol];
  const digits = instrumentInfo?.digits ?? 5;
  const pipSize = instrumentInfo?.pip_size ?? 0.0001;
  const contractSize = instrumentInfo?.contract_size ?? 100000;
  const balance = selectedAccount?.balance ?? 10000;
  const accountLeverage = selectedAccount?.leverage ?? 100;
  const [side, setSide] = useState('buy');
  const [lots, setLots] = useState('0.01');
  const [entryPrice, setEntryPrice] = useState('');
  const [exitPrice, setExitPrice] = useState('');
  const [riskPercent, setRiskPercent] = useState('1');
  const [stopLoss, setStopLoss] = useState('');
  const [daysHeld, setDaysHeld] = useState('1');

  const livePrice = tick ? (side === 'buy' ? tick.ask : tick.bid) : 0;

  // ── Margin ──
  const marginResult = useMemo(() => {
    const ep = parseFloat(entryPrice) || livePrice;
    const lev = accountLeverage;
    const lot = parseFloat(lots) || 0;
    if (!ep || !lot) return null;
    return { margin: (lot * contractSize * ep) / lev, ep, lot, lev };
  }, [entryPrice, accountLeverage, lots, livePrice, contractSize]);

  // ── P&L ──
  const pnlResult = useMemo(() => {
    const ep = parseFloat(entryPrice);
    const xp = parseFloat(exitPrice);
    const lot = parseFloat(lots) || 0;
    if (!ep || !xp || !lot) return null;
    const pips = side === 'buy' ? (xp - ep) / pipSize : (ep - xp) / pipSize;
    const pipVal = (pipSize / ep) * contractSize;
    return { pnl: lot * pips * pipVal, pips, pipVal };
  }, [entryPrice, exitPrice, lots, side, pipSize, contractSize]);

  // ── Lot Size ──
  const lotResult = useMemo(() => {
    const ep = parseFloat(entryPrice) || livePrice;
    const sl = parseFloat(stopLoss);
    const rp = parseFloat(riskPercent);
    if (!ep || !sl || !rp || ep <= 0 || sl <= 0) return null;
    const riskAmt = balance * (rp / 100);
    const slPips = Math.abs(ep - sl) / pipSize;
    if (slPips <= 0) return null;
    const pipVal = (pipSize / ep) * contractSize;
    return { lotSize: Math.max(0.01, parseFloat((riskAmt / (slPips * pipVal)).toFixed(2))), riskAmt, slPips, pipVal };
  }, [entryPrice, stopLoss, riskPercent, balance, livePrice, pipSize, contractSize]);

  // ── Swap ──
  const swapResult = useMemo(() => {
    const lot = parseFloat(lots) || 0;
    const days = parseInt(daysHeld) || 1;
    if (!lot) return null;
    const dailySwap = lot * 0.5 * ((pipSize / (tick?.bid || 1)) * contractSize);
    return { dailySwap, totalSwap: dailySwap * days, days };
  }, [lots, daysHeld, tick, pipSize, contractSize]);

  // Current result
  const resultLabel =
    tab === 'margin' ? 'Required Margin' :
    tab === 'pnl' ? (pnlResult && pnlResult.pnl >= 0 ? 'Profit' : 'Loss') :
    tab === 'lotsize' ? 'Lot Size' : 'Est. Swap';

  const resultValue =
    tab === 'margin' ? (marginResult ? `$${marginResult.margin.toFixed(2)}` : '$0.00') :
    tab === 'pnl' ? (pnlResult ? `${pnlResult.pnl >= 0 ? '+' : '-'}$${Math.abs(pnlResult.pnl).toFixed(2)}` : '$0.00') :
    tab === 'lotsize' ? (lotResult ? lotResult.lotSize.toFixed(2) : '0.00') :
    (swapResult ? `$${swapResult.totalSwap.toFixed(2)}` : '$0.00');

  const resultDetails: { l: string; v: string }[] =
    tab === 'margin' && marginResult ? [
      { l: 'Lots', v: marginResult.lot.toFixed(2) },
      { l: 'Leverage', v: `1:${marginResult.lev}` },
      { l: 'Price', v: marginResult.ep.toFixed(digits) },
    ] :
    tab === 'pnl' && pnlResult ? [
      { l: 'Pips', v: pnlResult.pips.toFixed(1) },
      { l: 'Pip Value', v: `$${pnlResult.pipVal.toFixed(4)}` },
    ] :
    tab === 'lotsize' && lotResult ? [
      { l: 'Risk', v: `$${lotResult.riskAmt.toFixed(2)}` },
      { l: 'SL Pips', v: lotResult.slPips.toFixed(1) },
    ] :
    tab === 'swap' && swapResult ? [
      { l: 'Daily', v: `$${swapResult.dailySwap.toFixed(4)}` },
      { l: 'Days', v: String(swapResult.days) },
    ] : [];

  const handleReset = () => {
    setEntryPrice('');
    setExitPrice('');
    setLots('0.01');
    setStopLoss('');
    setRiskPercent('1');
    setDaysHeld('1');
  };

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden bg-bg-base">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-2.5 py-2 border-b border-border-primary bg-bg-secondary">
        <div className="flex items-center gap-2">
          <Calculator size={14} className="text-accent" />
          <span className="text-xs font-bold text-text-primary">Risk Calculator</span>
        </div>
        <button
          type="button"
          onClick={handleReset}
          className="w-7 h-7 rounded-md flex items-center justify-center text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors"
          title="Reset"
        >
          <RotateCcw size={12} />
        </button>
      </div>

      <div className="h-px w-full shrink-0 bg-accent" aria-hidden />

      {/* Tabs */}
      <div className="shrink-0 flex items-center gap-0 px-1 py-1.5 border-b border-border-primary bg-bg-secondary">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={clsx(
              'flex-1 py-1.5 rounded-md text-[10px] font-bold transition-all',
              tab === t.id
                ? 'bg-accent text-white shadow-md shadow-accent/20'
                : 'text-text-tertiary hover:text-text-primary',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Scrollable body */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain" style={{ scrollbarWidth: 'none' }}>
        <div className="px-2.5 py-2.5 space-y-2.5">

          {/* Account */}
          <Row label="Account" tip="Select your trading account">
            <CompactSelect
              value={selectedAccountId}
              onChange={setSelectedAccountId}
              options={accounts.map((a) => ({ value: a.id, label: `${a.account_number} — $${a.balance.toFixed(2)}${a.is_demo ? ' (D)' : ''}` }))}
              placeholder="Select Account"
            />
          </Row>

          {/* Direction (margin uses it for live price, P&L for calc) */}
          {(tab === 'margin' || tab === 'pnl') && (
            <Row label="Direction" tip="Buy or Sell">
              <CompactSelect
                value={side}
                onChange={setSide}
                options={[{ value: 'buy', label: 'Buy' }, { value: 'sell', label: 'Sell' }]}
              />
            </Row>
          )}

          {/* Lot Size: Balance */}
          {tab === 'lotsize' && (
            <Row label="Account Balance" tip="Your balance">
              <div
                className="rounded-lg px-2.5 py-2 text-[12px] font-mono font-bold text-accent bg-bg-secondary border border-border-primary"
              >
                ${balance.toFixed(2)}
              </div>
            </Row>
          )}

          {/* Instrument with search */}
          <Row label="Instrument" tip="Search instruments">
            <CompactInstrumentPicker value={symbol} onChange={setSymbol} instruments={instruments} />
          </Row>

          {/* Entry Price */}
          <Row label="Entry Price" tip="Enter your entry price">
            <CompactInput
              value={entryPrice}
              onChange={setEntryPrice}
              placeholder="Enter Entry Price"
            />
          </Row>

          {/* Exit Price — only for P&L */}
          {tab === 'pnl' && (
            <Row label="Exit Price" tip="Enter your exit / TP price">
              <CompactInput
                value={exitPrice}
                onChange={setExitPrice}
                placeholder="Enter Exit Price"
              />
            </Row>
          )}

          {/* Margin-specific */}
          {tab === 'margin' && (
            <>
              <Row label="Leverage" tip="Account leverage">
                <div
                  className="rounded-lg px-2.5 py-2 text-[12px] font-mono font-bold text-text-primary bg-bg-secondary border border-border-primary"
                >
                  1:{accountLeverage}
                </div>
              </Row>
              <Row label="Lot Size" tip="Position size">
                <CompactInput value={lots} onChange={setLots} placeholder="Enter Size" />
              </Row>
            </>
          )}

          {/* P&L-specific */}
          {tab === 'pnl' && (
            <>
              <Row label="Lot Size" tip="Position size">
                <CompactInput value={lots} onChange={setLots} placeholder="Enter Size" />
              </Row>
            </>
          )}

          {/* Lot Size-specific */}
          {tab === 'lotsize' && (
            <>
              <Row label="Risk %" tip="% of balance to risk">
                <CompactInput value={riskPercent} onChange={setRiskPercent} placeholder="1" suffix="%" />
              </Row>
              <Row label="Stop Loss Price" tip="SL level">
                <CompactInput value={stopLoss} onChange={setStopLoss} placeholder="Enter SL price" />
              </Row>
            </>
          )}

          {/* Swap-specific */}
          {tab === 'swap' && (
            <>
              <Row label="Lot Size" tip="Position size">
                <CompactInput value={lots} onChange={setLots} placeholder="Enter Size" />
              </Row>
              <Row label="Days Held" tip="Days position open">
                <CompactInput value={daysHeld} onChange={setDaysHeld} placeholder="1" suffix="days" />
              </Row>
            </>
          )}

          {/* Calculate button */}
          <button
            type="button"
            onClick={() => {
              if (!entryPrice && livePrice > 0) setEntryPrice(livePrice.toFixed(digits));
            }}
            className="w-full py-2.5 rounded-lg text-[11px] font-bold text-white bg-accent transition-all active:scale-[0.98] shadow-md shadow-accent/20"
          >
            Calculate
          </button>

          {/* ─── Result panel ─── */}
          <div
            className="rounded-xl flex flex-col items-center justify-center p-5"
            style={{
              background: 'linear-gradient(135deg, rgba(41,98,255,0.12) 0%, rgba(94,179,255,0.06) 100%)',
              border: '1px solid rgba(41,98,255,0.2)',
            }}
          >
            <span className="text-[11px] font-semibold text-text-secondary mb-1">{resultLabel}</span>
            <span className="text-2xl font-black font-mono text-[#5eb3ff]">{resultValue}</span>
            {resultDetails.length > 0 && (
              <div className="mt-3 w-full space-y-1">
                {resultDetails.map((d) => (
                  <div key={d.l} className="flex items-center justify-between text-[10px]">
                    <span className="text-text-tertiary">{d.l}</span>
                    <span className="font-mono font-semibold text-text-secondary">{d.v}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <p className="text-[8px] text-text-tertiary/50 text-center leading-relaxed pb-1">
            Approximate values. May vary by market conditions.
          </p>
        </div>
      </div>
    </div>
  );
}
