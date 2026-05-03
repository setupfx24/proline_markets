'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { clsx } from 'clsx';
import { Info, Calculator, Search, ChevronDown, X } from 'lucide-react';
import DashboardShell from '@/components/layout/DashboardShell';
import { useTradingStore, type InstrumentInfo, type TradingAccount } from '@/stores/tradingStore';
import api from '@/lib/api/client';

type CalcTab = 'margin' | 'pnl' | 'lotsize' | 'swap';

const TABS: { id: CalcTab; label: string }[] = [
  { id: 'margin', label: 'Margin Calculator' },
  { id: 'pnl', label: 'Profit/Loss Calculator' },
  { id: 'lotsize', label: 'Lot Size Calculator' },
  { id: 'swap', label: 'Swap Calculator' },
];

/* ─── Searchable instrument picker ─── */
function InstrumentPicker({
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
        className="w-full flex items-center justify-between rounded-lg border border-border-primary bg-bg-primary px-3 py-2.5 text-sm font-medium text-text-primary cursor-pointer hover:border-accent/40 transition-colors"
      >
        <span className="truncate">{current ? `${current.symbol} — ${current.display_name}` : 'Select Instrument'}</span>
        <ChevronDown size={14} className={clsx('text-text-tertiary shrink-0 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute top-full left-0 z-50 w-full mt-1 rounded-xl border border-border-primary bg-bg-secondary shadow-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border-primary bg-bg-primary">
            <Search size={14} className="text-text-tertiary shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search instrument..."
              className="flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-tertiary"
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} className="text-text-tertiary hover:text-text-primary">
                <X size={13} />
              </button>
            )}
          </div>
          <div className="max-h-[240px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
            {filtered.length > 0 ? filtered.map((inst) => (
              <button
                key={inst.symbol}
                type="button"
                onClick={() => { onChange(inst.symbol); setOpen(false); setSearch(''); }}
                className={clsx(
                  'w-full flex items-center justify-between px-3 py-2 text-left text-sm transition-colors',
                  inst.symbol === value ? 'bg-accent/10 text-accent' : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary',
                )}
              >
                <div className="flex flex-col">
                  <span className="font-semibold text-[13px]">{inst.symbol}</span>
                  <span className="text-[10px] text-text-tertiary">{inst.display_name}</span>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-bg-primary text-text-tertiary border border-border-primary">{inst.segment}</span>
              </button>
            )) : (
              <div className="px-3 py-4 text-center text-xs text-text-tertiary">No instruments found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Tooltip icon ─── */
function Tip({ text }: { text: string }) {
  return (
    <span className="relative group cursor-help ml-1 inline-flex" title={text}>
      <Info size={13} className="text-text-tertiary group-hover:text-accent transition-colors" />
    </span>
  );
}

/* ─── Select field ─── */
function SelectField({
  label,
  tip,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  tip?: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4">
      <label className="text-[13px] font-medium text-text-secondary whitespace-nowrap sm:w-[180px] shrink-0 flex items-center">
        {label}
        {tip && <Tip text={tip} />}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 rounded-lg border border-border-primary bg-bg-primary px-3 py-2.5 text-sm text-text-primary outline-none appearance-none cursor-pointer font-medium"
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

/* ─── Input field ─── */
function InputField({
  label,
  tip,
  value,
  onChange,
  placeholder,
  suffix,
  type = 'number',
}: {
  label: string;
  tip?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  suffix?: string;
  type?: string;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4">
      <label className="text-[13px] font-medium text-text-secondary whitespace-nowrap sm:w-[180px] shrink-0 flex items-center">
        {label}
        {tip && <Tip text={tip} />}
      </label>
      <div className="flex-1 flex items-center rounded-lg border border-border-primary bg-bg-primary overflow-hidden">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 bg-transparent px-3 py-2.5 text-sm font-mono text-text-primary outline-none w-0 min-w-0 placeholder:text-text-tertiary"
        />
        {suffix && (
          <span className="pr-3 text-[11px] font-semibold text-text-tertiary shrink-0">{suffix}</span>
        )}
      </div>
    </div>
  );
}

/* ─── Result panel ─── */
function ResultPanel({ label, value, details }: { label: string; value: string; details?: { l: string; v: string }[] }) {
  return (
    <div className="rounded-2xl border border-accent/20 bg-gradient-to-br from-accent/10 via-accent/5 to-transparent flex flex-col items-center justify-center p-6 sm:p-8 min-h-[220px]">
      <span className="text-sm font-semibold text-text-secondary mb-2">{label}</span>
      <span className="text-3xl sm:text-4xl font-black font-mono text-accent">{value}</span>
      {details && details.length > 0 && (
        <div className="mt-4 w-full space-y-1.5 max-w-[260px]">
          {details.map((d) => (
            <div key={d.l} className="flex items-center justify-between text-[11px]">
              <span className="text-text-tertiary">{d.l}</span>
              <span className="font-mono font-semibold text-text-secondary">{d.v}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function mapApiAccount(a: Record<string, unknown>): TradingAccount {
  const g = a.account_group as Record<string, unknown> | null | undefined;
  return {
    id: String(a.id),
    account_number: String(a.account_number ?? ''),
    balance: Number(a.balance) || 0,
    credit: Number(a.credit) || 0,
    equity: Number(a.equity ?? a.balance) || 0,
    margin_used: Number(a.margin_used) || 0,
    free_margin: Number(a.free_margin ?? a.balance) || 0,
    margin_level: Number(a.margin_level) || 0,
    leverage: Number(a.leverage) || 100,
    currency: String(a.currency ?? 'USD'),
    is_demo: Boolean(a.is_demo),
    account_group: g
      ? {
          id: String(g.id),
          name: String(g.name ?? 'Account'),
          spread_markup: Number(g.spread_markup) || 0,
          commission_per_lot: Number(g.commission_per_lot) || 0,
          minimum_deposit: Number(g.minimum_deposit) || 0,
          swap_free: Boolean(g.swap_free),
          leverage_default: Number(g.leverage_default) || 100,
        }
      : null,
  };
}

/* ═══════════════════════════════════════════════════ */
export default function RiskCalculatorPage() {
  const { selectedSymbol, prices, instruments, activeAccount, accounts, setInstruments, setAccounts } = useTradingStore();

  // Fetch instruments + accounts if not already loaded
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        if (instruments.length === 0) {
          const res = await api.get<unknown>('/instruments/').catch(() => []);
          if (cancelled) return;
          const list = Array.isArray(res) ? res : ((res as { items?: unknown[] })?.items ?? []);
          if (list.length > 0) {
            setInstruments(
              list.map((i: Record<string, unknown>) => ({
                symbol: String(i.symbol),
                display_name: String(i.display_name || i.symbol),
                segment: String((i.segment as { name?: string })?.name || i.segment || ''),
                digits: Number(i.digits ?? 5),
                pip_size: Number(i.pip_size ?? 0.0001),
                min_lot: Number(i.min_lot ?? 0.01),
                max_lot: Number(i.max_lot ?? 100),
                lot_step: Number(i.lot_step ?? 0.01),
                contract_size: Number(i.contract_size ?? 100000),
              })),
            );
          }
        }
        if (accounts.length === 0) {
          const res = await api.get<unknown>('/accounts').catch(() => ({ items: [] }));
          if (cancelled) return;
          const list = Array.isArray(res) ? res : ((res as { items?: unknown[] })?.items ?? []);
          setAccounts((list as Record<string, unknown>[]).map(mapApiAccount));
        }
      } catch (err) {
        console.error('Risk calculator data load failed:', err);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const [tab, setTab] = useState<CalcTab>('margin');

  // ── Shared state ──
  const [selectedAccountId, setSelectedAccountId] = useState(activeAccount?.id ?? '');
  const [symbol, setSymbol] = useState(selectedSymbol || 'EURUSD');
  const [side, setSide] = useState('buy');
  const [lots, setLots] = useState('0.01');
  const [entryPrice, setEntryPrice] = useState('');
  const [exitPrice, setExitPrice] = useState('');
  const [riskPercent, setRiskPercent] = useState('1');
  const [stopLoss, setStopLoss] = useState('');
  const [daysHeld, setDaysHeld] = useState('1');

  const instrumentInfo = instruments.find((i: InstrumentInfo) => i.symbol === symbol);
  const tick = prices[symbol];
  const digits = instrumentInfo?.digits ?? 5;
  const pipSize = instrumentInfo?.pip_size ?? 0.0001;
  const contractSize = instrumentInfo?.contract_size ?? 100000;
  const selectedAccount = accounts.find((a) => a.id === selectedAccountId) || activeAccount;
  const balance = selectedAccount?.balance ?? 10000;
  const accountLeverage = selectedAccount?.leverage ?? 100;

  const accountOpts = accounts.map((a) => ({
    value: a.id,
    label: `${a.account_number} — $${a.balance.toFixed(2)} ${a.is_demo ? '(Demo)' : ''}`,
  }));

  // ── Margin calc ──
  const marginResult = useMemo(() => {
    const ep = parseFloat(entryPrice) || (tick ? (side === 'buy' ? tick.ask : tick.bid) : 0);
    const lev = accountLeverage;
    const lot = parseFloat(lots) || 0;
    if (!ep || !lot) return null;
    const margin = (lot * contractSize * ep) / lev;
    return { margin, ep, lot, lev };
  }, [entryPrice, accountLeverage, lots, side, tick, contractSize]);

  // ── P&L calc ──
  const pnlResult = useMemo(() => {
    const ep = parseFloat(entryPrice);
    const xp = parseFloat(exitPrice);
    const lot = parseFloat(lots) || 0;
    if (!ep || !xp || !lot) return null;
    const pips = side === 'buy' ? (xp - ep) / pipSize : (ep - xp) / pipSize;
    const pipVal = (pipSize / ep) * contractSize;
    const pnl = lot * pips * pipVal;
    return { pnl, pips, pipVal };
  }, [entryPrice, exitPrice, lots, side, pipSize, contractSize]);

  // ── Lot size calc ──
  const lotResult = useMemo(() => {
    const ep = parseFloat(entryPrice) || (tick ? (side === 'buy' ? tick.ask : tick.bid) : 0);
    const sl = parseFloat(stopLoss);
    const rp = parseFloat(riskPercent);
    if (!ep || !sl || !rp || ep <= 0 || sl <= 0) return null;
    const riskAmt = balance * (rp / 100);
    const slPips = Math.abs(ep - sl) / pipSize;
    if (slPips <= 0) return null;
    const pipVal = (pipSize / ep) * contractSize;
    const lotSize = riskAmt / (slPips * pipVal);
    return { lotSize: Math.max(0.01, parseFloat(lotSize.toFixed(2))), riskAmt, slPips, pipVal };
  }, [entryPrice, stopLoss, riskPercent, balance, side, tick, pipSize, contractSize]);

  // ── Swap calc (simplified estimate) ──
  const swapResult = useMemo(() => {
    const lot = parseFloat(lots) || 0;
    const days = parseInt(daysHeld) || 1;
    if (!lot) return null;
    // Simplified: typical swap ~0.5-2 pips/day for most pairs
    const swapPerLotPerDay = 0.5;
    const dailySwap = lot * swapPerLotPerDay * ((pipSize / (tick?.bid || 1)) * contractSize);
    const totalSwap = dailySwap * days;
    return { dailySwap, totalSwap, days };
  }, [lots, daysHeld, tick, pipSize, contractSize]);

  const handleCalculate = () => {
    // Auto-fill entry from live if empty
    if (!entryPrice && tick) {
      setEntryPrice((side === 'buy' ? tick.ask : tick.bid).toFixed(digits));
    }
  };

  return (
    <DashboardShell>
      <div className="max-w-5xl mx-auto w-full space-y-5">
        {/* Page header */}
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-text-primary flex items-center gap-2">
            <Calculator size={22} className="text-accent" />
            Risk Management
          </h1>
          <p className="text-xs sm:text-sm text-text-tertiary mt-1">
            Calculate margin, profit/loss, lot size, and swap before placing a trade
          </p>
        </div>

        {/* ── Tab bar ── */}
        <div className="flex items-center rounded-full border border-border-primary bg-bg-secondary p-1 overflow-x-auto scrollbar-none">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={clsx(
                'flex-1 sm:flex-none px-4 sm:px-6 py-2.5 rounded-full text-xs sm:text-sm font-semibold transition-all whitespace-nowrap',
                tab === t.id
                  ? 'bg-accent text-white shadow-lg shadow-accent/20'
                  : 'text-text-secondary hover:text-text-primary',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Calculator card ── */}
        <div className="rounded-2xl border border-border-primary bg-bg-secondary overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-5">

            {/* LEFT — Form fields */}
            <div className="lg:col-span-3 p-5 sm:p-6 space-y-4 border-b lg:border-b-0 lg:border-r border-border-primary">

              <SelectField
                label="Account"
                tip="Select your trading account"
                value={selectedAccountId}
                onChange={setSelectedAccountId}
                options={accountOpts}
                placeholder="Select Account"
              />

              {(tab === 'margin' || tab === 'pnl') && (
                <SelectField
                  label="Direction"
                  tip="Buy or Sell"
                  value={side}
                  onChange={setSide}
                  options={[{ value: 'buy', label: 'Buy' }, { value: 'sell', label: 'Sell' }]}
                />
              )}

              {tab === 'lotsize' && (
                <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4">
                  <label className="text-[13px] font-medium text-text-secondary whitespace-nowrap sm:w-[180px] shrink-0 flex items-center">
                    Account Balance
                    <Tip text="Your trading account balance" />
                  </label>
                  <div className="flex-1 rounded-lg border border-border-primary bg-bg-primary px-3 py-2.5 text-sm font-mono font-bold text-accent">
                    ${balance.toFixed(2)}
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4">
                <label className="text-[13px] font-medium text-text-secondary whitespace-nowrap sm:w-[180px] shrink-0 flex items-center">
                  Instrument
                  <Tip text="Search and select a trading instrument" />
                </label>
                <div className="flex-1">
                  <InstrumentPicker value={symbol} onChange={setSymbol} instruments={instruments} />
                </div>
              </div>

              <InputField
                label="Entry Price"
                tip="Enter your entry price"
                value={entryPrice}
                onChange={setEntryPrice}
                placeholder="Enter Entry Price"
              />

              {tab === 'pnl' && (
                <InputField
                  label="Exit Price"
                  tip="Enter your exit / take profit price"
                  value={exitPrice}
                  onChange={setExitPrice}
                  placeholder="Enter Exit Price"
                />
              )}

              {tab === 'margin' && (
                <>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4">
                    <label className="text-[13px] font-medium text-text-secondary whitespace-nowrap sm:w-[180px] shrink-0 flex items-center">
                      Leverage
                      <Tip text="Account leverage ratio" />
                    </label>
                    <div className="flex-1 rounded-lg border border-border-primary bg-bg-primary px-3 py-2.5 text-sm font-mono font-bold text-text-primary">
                      1:{accountLeverage}
                    </div>
                  </div>
                  <InputField
                    label="Lot Size"
                    tip="Position size in lots"
                    value={lots}
                    onChange={setLots}
                    placeholder="Enter Size"
                  />
                </>
              )}

              {tab === 'pnl' && (
                <>
                  <InputField
                    label="Lot Size"
                    tip="Position size in lots"
                    value={lots}
                    onChange={setLots}
                    placeholder="Enter Size"
                  />
                </>
              )}

              {tab === 'lotsize' && (
                <>
                  <InputField
                    label="Risk %"
                    tip="Percentage of balance to risk"
                    value={riskPercent}
                    onChange={setRiskPercent}
                    placeholder="1"
                    suffix="%"
                  />
                  <InputField
                    label="Stop Loss Price"
                    tip="Your stop loss level"
                    value={stopLoss}
                    onChange={setStopLoss}
                    placeholder="Enter SL price"
                  />
                </>
              )}

              {tab === 'swap' && (
                <>
                  <InputField
                    label="Lot Size"
                    tip="Position size in lots"
                    value={lots}
                    onChange={setLots}
                    placeholder="Enter Size"
                  />
                  <InputField
                    label="Days Held"
                    tip="Number of days position is open"
                    value={daysHeld}
                    onChange={setDaysHeld}
                    placeholder="1"
                    suffix="days"
                  />
                </>
              )}

              {/* Calculate button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleCalculate}
                  className="w-full sm:w-auto px-8 py-3 rounded-xl bg-accent/80 hover:bg-accent text-white text-sm font-bold transition-all active:scale-[0.98] shadow-lg shadow-accent/15"
                >
                  Calculate
                </button>
              </div>
            </div>

            {/* RIGHT — Result */}
            <div className="lg:col-span-2 flex items-stretch">
              <div className="flex-1 flex items-center justify-center p-5 sm:p-6">
                {tab === 'margin' && marginResult && (
                  <ResultPanel
                    label="Required Margin"
                    value={`$${marginResult.margin.toFixed(2)}`}
                    details={[
                      { l: 'Lots', v: marginResult.lot.toFixed(2) },
                      { l: 'Leverage', v: `1:${marginResult.lev}` },
                      { l: 'Price', v: marginResult.ep.toFixed(digits) },
                      { l: 'Contract Size', v: contractSize.toLocaleString() },
                    ]}
                  />
                )}
                {tab === 'pnl' && pnlResult && (
                  <ResultPanel
                    label={pnlResult.pnl >= 0 ? 'Profit' : 'Loss'}
                    value={`${pnlResult.pnl >= 0 ? '+' : '-'}$${Math.abs(pnlResult.pnl).toFixed(2)}`}
                    details={[
                      { l: 'Pips', v: pnlResult.pips.toFixed(1) },
                      { l: 'Pip Value', v: `$${pnlResult.pipVal.toFixed(4)}` },
                      { l: 'Direction', v: side.toUpperCase() },
                    ]}
                  />
                )}
                {tab === 'lotsize' && lotResult && (
                  <ResultPanel
                    label="Recommended Lot Size"
                    value={lotResult.lotSize.toFixed(2)}
                    details={[
                      { l: 'Risk Amount', v: `$${lotResult.riskAmt.toFixed(2)}` },
                      { l: 'SL Distance', v: `${lotResult.slPips.toFixed(1)} pips` },
                      { l: 'Pip Value/Lot', v: `$${lotResult.pipVal.toFixed(4)}` },
                    ]}
                  />
                )}
                {tab === 'swap' && swapResult && (
                  <ResultPanel
                    label="Estimated Swap"
                    value={`$${swapResult.totalSwap.toFixed(2)}`}
                    details={[
                      { l: 'Daily Swap', v: `$${swapResult.dailySwap.toFixed(4)}` },
                      { l: 'Days', v: String(swapResult.days) },
                      { l: 'Lots', v: lots },
                    ]}
                  />
                )}
                {!marginResult && tab === 'margin' && <ResultPanel label="Result" value="$0.00" />}
                {!pnlResult && tab === 'pnl' && <ResultPanel label="Result" value="$0.00" />}
                {!lotResult && tab === 'lotsize' && <ResultPanel label="Result" value="0.00" />}
                {!swapResult && tab === 'swap' && <ResultPanel label="Result" value="$0.00" />}
              </div>
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <p className="text-[10px] text-text-tertiary text-center leading-relaxed">
          Results are approximate. Actual values may vary based on market conditions, currency pair, and account currency.
        </p>
      </div>
    </DashboardShell>
  );
}
