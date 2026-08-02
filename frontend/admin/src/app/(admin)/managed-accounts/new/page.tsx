'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { adminApi } from '@/lib/api';
import { Loader2, Plus, Trash2, ArrowLeft, Eye, Save, Briefcase, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

interface DepositRow { date: string; amount: string }
interface MonthRow { year: string; month: string; pct: string }
interface DayRow { date: string; pct: string }
interface ManualTradeRow {
  date: string; symbol: string; side: string;
  lots: string; open_price: string; close_price: string; pnl: string;
  /** Not editable in the form — carried through so re-saving an existing
      account keeps whatever close reason it was generated with. */
  close_reason: string;
  close_time: string;
  /** true once the admin types a P&L by hand — stops the auto calculation. */
  pnlManual?: boolean;
}
interface AllocRow { symbol: string; weight_pct: string }

/** One instrument from the live feed (Infoway / LP), as served by the admin API. */
interface Quote {
  symbol: string;
  display_name: string;
  segment: string;
  digits: number;
  contract_size: number;
  bid: number | null;
  ask: number | null;
  price: number | null;
  timestamp: string | null;
}

interface MonthPreview {
  year: number; month: number; pct: number; profit: number;
  withdrawn: boolean; withdraw_date?: string | null;
}
interface Preview {
  base_capital: number; total_deposits: number; total_withdrawn: number;
  final_balance: number; trades_count: number;
  months: MonthPreview[]; warnings: string[];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtMoney = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const DEFAULT_DEPOSITS: DepositRow[] = [
  { date: '2026-01-02', amount: '100000' },
  { date: '2026-01-04', amount: '50000' },
];
const DEFAULT_MONTHS: MonthRow[] = [
  { year: '2026', month: '1', pct: '4.2' },
  { year: '2026', month: '2', pct: '3.4' },
  { year: '2026', month: '3', pct: '4.9' },
  { year: '2026', month: '4', pct: '5.3' },
  { year: '2026', month: '5', pct: '4.6' },
  { year: '2026', month: '6', pct: '4.1' },
];
const DEFAULT_ALLOC: AllocRow[] = [
  { symbol: 'XAUUSD', weight_pct: '80' },
  { symbol: 'GBPUSD', weight_pct: '10' },
  { symbol: 'US100', weight_pct: '10' },
];

const inputCls =
  'w-full text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md text-text-primary';
const labelCls = 'block text-xxs text-text-tertiary mb-1';
const cardCls = 'border border-border-primary rounded-md bg-bg-secondary p-4 space-y-3';

function ManagedAccountForm() {
  const router = useRouter();
  const params = useSearchParams();
  const editId = params.get('id');

  const [loading, setLoading] = useState<boolean>(!!editId);
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [email, setEmail] = useState('');
  const [country, setCountry] = useState('United Arab Emirates');
  const [password, setPassword] = useState('Proline@2026');
  const [openDate, setOpenDate] = useState('2025-11-25');
  const [leverage, setLeverage] = useState('100');
  const [currency, setCurrency] = useState('USD');
  const [payMethod, setPayMethod] = useState('crypto_usdt');
  const [payCurrency, setPayCurrency] = useState('USDT');
  const [wallet, setWallet] = useState('');
  const [withdrawDay, setWithdrawDay] = useState('5');
  const [retainLast, setRetainLast] = useState(true);
  const [lossFraction, setLossFraction] = useState('0.14');

  const [deposits, setDeposits] = useState<DepositRow[]>(DEFAULT_DEPOSITS);
  const [months, setMonths] = useState<MonthRow[]>(DEFAULT_MONTHS);
  const [days, setDays] = useState<DayRow[]>([]);
  const [manualTrades, setManualTrades] = useState<ManualTradeRow[]>([]);
  const [allocs, setAllocs] = useState<AllocRow[]>(DEFAULT_ALLOC);

  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [quotesAt, setQuotesAt] = useState<string>('');
  const [quotesLoading, setQuotesLoading] = useState(false);

  const loadQuotes = useCallback(async (notify = false) => {
    setQuotesLoading(true);
    try {
      const r = await adminApi.get<{ items: Quote[] }>('/managed-accounts/instruments/live');
      setQuotes(r.items || []);
      setQuotesAt(new Date().toLocaleTimeString());
      if (notify) toast.success('Live prices refreshed');
    } catch (e: unknown) {
      if (notify) toast.error(e instanceof Error ? e.message : 'Failed to load live prices');
    } finally {
      setQuotesLoading(false);
    }
  }, []);

  // Keep the symbol picker's prices live while the form is open.
  useEffect(() => {
    void loadQuotes();
    const t = setInterval(() => { void loadQuotes(); }, 15000);
    return () => clearInterval(t);
  }, [loadQuotes]);

  const quoteOf = useCallback(
    (symbol: string) => quotes.find((q) => q.symbol === symbol.trim().toUpperCase()),
    [quotes],
  );

  // Segments in feed order, each with its instruments — drives the <optgroup>s.
  const quotesBySegment = quotes.reduce<Record<string, Quote[]>>((acc, q) => {
    (acc[q.segment] ||= []).push(q);
    return acc;
  }, {});

  const fmtPrice = (n: number | null | undefined, digits: number) =>
    n == null ? '—' : n.toFixed(Math.min(digits, 8));

  /** Live entry price for a side: buy fills at the ask, sell at the bid. */
  const entryPrice = (q: Quote | undefined, side: string): number | null => {
    if (!q) return null;
    const p = side === 'sell' ? q.bid : q.ask;
    return p ?? q.price ?? null;
  };

  /** (close − open) × direction × lots × contract size. */
  const calcPnl = (row: ManualTradeRow): string => {
    const q = quoteOf(row.symbol);
    const open = parseFloat(row.open_price);
    const close = parseFloat(row.close_price);
    const lots = parseFloat(row.lots);
    if (!q || !Number.isFinite(open) || !Number.isFinite(close) || !Number.isFinite(lots)) return row.pnl;
    const dir = row.side === 'sell' ? -1 : 1;
    return ((close - open) * dir * lots * q.contract_size).toFixed(2);
  };

  const loadExisting = useCallback(async () => {
    if (!editId) return;
    setLoading(true);
    try {
      const r = await adminApi.get<{ config: Record<string, unknown> }>(`/managed-accounts/${editId}`);
      const c = r.config as Record<string, unknown>;
      setFirst((c.first_name as string) || '');
      setLast((c.last_name as string) || '');
      setEmail((c.email as string) || '');
      setCountry((c.country as string) || '');
      setPassword((c.password as string) || '');
      setOpenDate((c.open_date as string) || '');
      setLeverage(String(c.leverage ?? '100'));
      setCurrency((c.currency as string) || 'USD');
      setPayMethod((c.pay_method as string) || 'crypto_usdt');
      setPayCurrency((c.pay_currency as string) || 'USDT');
      setWallet((c.wallet_address as string) || '');
      setWithdrawDay(String(c.withdraw_day ?? '5'));
      setRetainLast(c.retain_last_month !== false);
      setLossFraction(String(c.loss_fraction ?? '0.14'));
      setDeposits(((c.deposits as Array<{ date: string; amount: number }>) || []).map((d) => ({
        date: d.date, amount: String(d.amount),
      })));
      setMonths(((c.monthly_returns as Array<{ year: number; month: number; pct: number }>) || []).map((m) => ({
        year: String(m.year), month: String(m.month), pct: String(m.pct),
      })));
      setDays(((c.daily_returns as Array<{ date: string; pct: number }>) || []).map((d) => ({
        date: d.date, pct: String(d.pct),
      })));
      setManualTrades(((c.manual_trades as Array<{
        date: string; symbol: string; side: string; lots: number;
        open_price: number; close_price: number; pnl: number;
        close_reason?: string; close_time?: string | null;
      }>) || []).map((t) => ({
        date: t.date, symbol: t.symbol, side: t.side, lots: String(t.lots),
        open_price: String(t.open_price), close_price: String(t.close_price), pnl: String(t.pnl),
        close_reason: t.close_reason || 'manual', close_time: t.close_time || '',
        pnlManual: true,
      })));
      setAllocs(((c.instrument_allocation as Array<{ symbol: string; weight_pct: number }>) || []).map((a) => ({
        symbol: a.symbol, weight_pct: String(a.weight_pct),
      })));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [editId]);

  useEffect(() => {
    void loadExisting();
  }, [loadExisting]);

  const buildBody = () => ({
    first_name: first.trim(),
    last_name: last.trim(),
    email: email.trim(),
    country: country.trim() || null,
    password,
    open_date: openDate,
    leverage: parseInt(leverage, 10) || 100,
    currency: currency.trim() || 'USD',
    pay_method: payMethod.trim() || 'crypto_usdt',
    pay_currency: payCurrency.trim() || 'USDT',
    wallet_address: wallet.trim() || null,
    withdraw_day: parseInt(withdrawDay, 10) || 5,
    retain_last_month: retainLast,
    loss_fraction: parseFloat(lossFraction) || 0,
    deposits: deposits
      .filter((d) => d.date && d.amount)
      .map((d) => ({ date: d.date, amount: parseFloat(d.amount) || 0 })),
    monthly_returns: months
      .filter((m) => m.year && m.month && m.pct !== '')
      .map((m) => ({ year: parseInt(m.year, 10), month: parseInt(m.month, 10), pct: parseFloat(m.pct) || 0 })),
    daily_returns: days
      .filter((d) => d.date && d.pct !== '')
      .map((d) => ({ date: d.date, pct: parseFloat(d.pct) || 0 })),
    manual_trades: manualTrades
      .filter((t) => t.date && t.symbol && t.lots && t.open_price && t.close_price && t.pnl !== '')
      .map((t) => ({
        date: t.date, symbol: t.symbol.trim().toUpperCase(), side: t.side || 'buy',
        lots: parseFloat(t.lots) || 0, open_price: parseFloat(t.open_price) || 0,
        close_price: parseFloat(t.close_price) || 0, pnl: parseFloat(t.pnl) || 0,
        close_reason: t.close_reason || 'manual',
        close_time: t.close_time || null,
      })),
    instrument_allocation: allocs
      .filter((a) => a.symbol && a.weight_pct !== '')
      .map((a) => ({ symbol: a.symbol.trim().toUpperCase(), weight_pct: parseFloat(a.weight_pct) || 0 })),
  });

  const validate = (): string | null => {
    if (!first.trim()) return 'First name is required';
    if (!email.trim()) return 'Email is required';
    if (!password) return 'Password is required';
    if (!openDate) return 'Account open date is required';
    if (deposits.filter((d) => d.date && d.amount).length === 0) return 'At least one deposit is required';
    if (
      months.filter((m) => m.year && m.month && m.pct !== '').length === 0 &&
      days.filter((d) => d.date && d.pct !== '').length === 0 &&
      manualTrades.filter((t) => t.date && t.symbol && t.pnl !== '').length === 0
    )
      return 'Add at least one monthly return, daily return, or manual trade';
    if (allocs.filter((a) => a.symbol && a.weight_pct !== '').length === 0) return 'At least one instrument allocation is required';
    return null;
  };

  const runPreview = async () => {
    const err = validate();
    if (err) { toast.error(err); return; }
    setPreviewing(true);
    try {
      const res = await adminApi.post<Preview>('/managed-accounts/preview', buildBody());
      setPreview(res);
      (res.warnings || []).forEach((w) => toast(w, { icon: '⚠️' }));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Preview failed');
    } finally {
      setPreviewing(false);
    }
  };

  const save = async () => {
    const err = validate();
    if (err) { toast.error(err); return; }
    setSaving(true);
    try {
      if (editId) {
        await adminApi.put(`/managed-accounts/${editId}`, buildBody());
        toast.success('Managed account regenerated');
      } else {
        await adminApi.post('/managed-accounts/generate', buildBody());
        toast.success('Managed account created');
      }
      router.push('/managed-accounts');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="animate-spin text-text-tertiary" size={22} />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4 max-w-5xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <Briefcase size={18} className="text-buy" />
            {editId ? 'Edit managed account' : 'New managed account'}
          </h1>
          <p className="text-xxs text-text-tertiary mt-0.5">
            Fill the client facts. Use <b>Preview</b> to verify the numbers, then <b>Generate</b> to
            write the account, deposits, trades and withdrawals. Regenerating rebuilds only this
            client&apos;s data.
          </p>
        </div>
        <Link
          href="/managed-accounts"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs border border-border-primary text-text-secondary hover:bg-bg-hover"
        >
          <ArrowLeft size={14} /> Back
        </Link>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Identity */}
        <div className={cardCls}>
          <h3 className="text-sm font-semibold text-text-primary">Client identity</h3>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>First name</label>
              <input className={inputCls} value={first} onChange={(e) => setFirst(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Last name</label>
              <input className={inputCls} value={last} onChange={(e) => setLast(e.target.value)} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Email (login)</label>
            <input className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)}
              disabled={!!editId} placeholder="client@example.com" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>Password (login)</label>
              <input className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Country</label>
              <input className={inputCls} value={country} onChange={(e) => setCountry(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className={labelCls}>Account opened</label>
              <input type="date" className={inputCls} value={openDate} onChange={(e) => setOpenDate(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Leverage 1:</label>
              <input className={inputCls} value={leverage} onChange={(e) => setLeverage(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Currency</label>
              <input className={inputCls} value={currency} onChange={(e) => setCurrency(e.target.value)} />
            </div>
          </div>
        </div>

        {/* Funding / payout */}
        <div className={cardCls}>
          <h3 className="text-sm font-semibold text-text-primary">Funding &amp; payout</h3>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>Pay method</label>
              <input className={inputCls} value={payMethod} onChange={(e) => setPayMethod(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Pay currency</label>
              <input className={inputCls} value={payCurrency} onChange={(e) => setPayCurrency(e.target.value)} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Wallet address (optional)</label>
            <input className={inputCls} value={wallet} onChange={(e) => setWallet(e.target.value)}
              placeholder="TRC20 USDT address" />
          </div>
          <div className="grid grid-cols-3 gap-2 items-end">
            <div>
              <label className={labelCls}>Withdraw day</label>
              <input className={inputCls} value={withdrawDay} onChange={(e) => setWithdrawDay(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Loss fraction</label>
              <input className={inputCls} value={lossFraction} onChange={(e) => setLossFraction(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-xxs text-text-secondary pb-1.5">
              <input type="checkbox" checked={retainLast} onChange={(e) => setRetainLast(e.target.checked)} />
              Retain last month
            </label>
          </div>
          <p className="text-xxs text-text-tertiary">
            Each withdrawn month&apos;s profit is paid on the withdraw-day of the following month.
            “Retain last month” keeps the newest month&apos;s profit in the balance.
          </p>
        </div>
      </div>

      {/* Deposits */}
      <div className={cardCls}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-primary">Deposits</h3>
          <button type="button" onClick={() => setDeposits([...deposits, { date: '', amount: '' }])}
            className="inline-flex items-center gap-1 text-xxs text-buy hover:underline">
            <Plus size={12} /> Add deposit
          </button>
        </div>
        {deposits.map((d, i) => (
          <div key={i} className="flex gap-2 items-center">
            <input type="date" className={inputCls} value={d.date}
              onChange={(e) => setDeposits(deposits.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)))} />
            <input className={inputCls} value={d.amount} placeholder="Amount"
              onChange={(e) => setDeposits(deposits.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))} />
            <button type="button" onClick={() => setDeposits(deposits.filter((_, j) => j !== i))}
              className="p-1.5 rounded border border-danger/30 text-danger hover:bg-danger/10 shrink-0">
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Monthly returns */}
        <div className={cardCls}>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-primary">Monthly returns (%)</h3>
            <button type="button"
              onClick={() => setMonths([...months, { year: '2026', month: '1', pct: '' }])}
              className="inline-flex items-center gap-1 text-xxs text-buy hover:underline">
              <Plus size={12} /> Add month
            </button>
          </div>
          {months.map((m, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input className={`${inputCls} w-20`} value={m.year} placeholder="Year"
                onChange={(e) => setMonths(months.map((x, j) => (j === i ? { ...x, year: e.target.value } : x)))} />
              <select className={inputCls} value={m.month}
                onChange={(e) => setMonths(months.map((x, j) => (j === i ? { ...x, month: e.target.value } : x)))}>
                {MONTHS.map((mm, idx) => <option key={idx} value={idx + 1}>{mm}</option>)}
              </select>
              <input className={inputCls} value={m.pct} placeholder="% e.g. 4.2"
                onChange={(e) => setMonths(months.map((x, j) => (j === i ? { ...x, pct: e.target.value } : x)))} />
              <button type="button" onClick={() => setMonths(months.filter((_, j) => j !== i))}
                className="p-1.5 rounded border border-danger/30 text-danger hover:bg-danger/10 shrink-0">
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>

        {/* Instrument allocation */}
        <div className={cardCls}>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-primary">Instrument mix (%)</h3>
            <button type="button"
              onClick={() => setAllocs([...allocs, { symbol: '', weight_pct: '' }])}
              className="inline-flex items-center gap-1 text-xxs text-buy hover:underline">
              <Plus size={12} /> Add instrument
            </button>
          </div>
          {allocs.map((a, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input className={inputCls} value={a.symbol} placeholder="Symbol e.g. XAUUSD"
                onChange={(e) => setAllocs(allocs.map((x, j) => (j === i ? { ...x, symbol: e.target.value } : x)))} />
              <input className={`${inputCls} w-24`} value={a.weight_pct} placeholder="Weight %"
                onChange={(e) => setAllocs(allocs.map((x, j) => (j === i ? { ...x, weight_pct: e.target.value } : x)))} />
              <button type="button" onClick={() => setAllocs(allocs.filter((_, j) => j !== i))}
                className="p-1.5 rounded border border-danger/30 text-danger hover:bg-danger/10 shrink-0">
                <Trash2 size={12} />
              </button>
            </div>
          ))}
          <p className="text-xxs text-text-tertiary">
            The highest-weight instrument also carries a few realistic losing trades. Weights are
            normalised to 100%.
          </p>
        </div>
      </div>

      {/* Daily returns */}
      <div className={cardCls}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-primary">Daily returns (%)</h3>
          <button type="button"
            onClick={() => setDays([...days, { date: '', pct: '' }])}
            className="inline-flex items-center gap-1 text-xxs text-buy hover:underline">
            <Plus size={12} /> Add day
          </button>
        </div>
        <div className="grid md:grid-cols-2 gap-x-4 gap-y-2">
          {days.map((d, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input type="date" className={inputCls} value={d.date}
                onChange={(e) => setDays(days.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)))} />
              <input className={`${inputCls} w-24`} value={d.pct} placeholder="% e.g. 0.8"
                onChange={(e) => setDays(days.map((x, j) => (j === i ? { ...x, pct: e.target.value } : x)))} />
              <button type="button" onClick={() => setDays(days.filter((_, j) => j !== i))}
                className="p-1.5 rounded border border-danger/30 text-danger hover:bg-danger/10 shrink-0">
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
        <p className="text-xxs text-text-tertiary">
          Pin a return to a specific date. Any month that has at least one day here is driven
          entirely by its daily rows — that month&apos;s <em>Monthly returns</em> entry is ignored, and
          the month total is the sum of its daily %s. Negative % makes a losing day. Future dates
          are skipped.
        </p>
      </div>

      {/* Manual trades */}
      <div className={cardCls}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-primary">Manual trades</h3>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => void loadQuotes(true)}
              className="inline-flex items-center gap-1 text-xxs text-text-tertiary hover:text-text-primary">
              <RefreshCw size={11} className={quotesLoading ? 'animate-spin' : ''} />
              {quotes.length ? `${quotes.length} symbols${quotesAt ? ` · ${quotesAt}` : ''}` : 'Load live prices'}
            </button>
            <button type="button"
              onClick={() => setManualTrades([...manualTrades, {
                date: new Date().toISOString().slice(0, 10), symbol: '', side: 'buy',
                lots: '', open_price: '', close_price: '', pnl: '',
                close_reason: 'manual', close_time: '',
              }])}
              className="inline-flex items-center gap-1 text-xxs text-buy hover:underline">
              <Plus size={12} /> Add trade
            </button>
          </div>
        </div>

        {manualTrades.map((t, i) => {
          const rows = manualTrades;
          const upd = (patch: Partial<ManualTradeRow>) =>
            setManualTrades(rows.map((x, j) => {
              if (j !== i) return x;
              const next = { ...x, ...patch };
              // Keep P&L in step with symbol / side / lots / prices until the
              // admin overrides it by typing into the P&L box.
              if (!next.pnlManual && patch.pnl === undefined) next.pnl = calcPnl(next);
              return next;
            }));
          const q = quoteOf(t.symbol);
          const live = entryPrice(q, t.side);
          return (
            <div key={i} className="rounded-md border border-border-primary bg-bg-tertiary/30 p-2.5 space-y-2">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div>
                  <label className={labelCls}>Date</label>
                  <input type="date" className={inputCls} value={t.date}
                    onChange={(e) => upd({ date: e.target.value })} />
                </div>
                <div>
                  <label className={labelCls}>Symbol (live feed)</label>
                  <select className={inputCls} value={t.symbol}
                    onChange={(e) => {
                      const sym = e.target.value;
                      const nq = quotes.find((x) => x.symbol === sym);
                      const p = entryPrice(nq, t.side);
                      // Selecting a symbol stamps the price that is running right
                      // now as the open; the close stays the admin's to set.
                      upd(p != null
                        ? { symbol: sym, open_price: p.toFixed(Math.min(nq?.digits ?? 2, 8)) }
                        : { symbol: sym });
                    }}>
                    <option value="">Select symbol…</option>
                    {/* Symbol typed on an older row but missing from the feed. */}
                    {t.symbol && !q ? <option value={t.symbol}>{t.symbol} (no feed)</option> : null}
                    {Object.entries(quotesBySegment).map(([seg, list]) => (
                      <optgroup key={seg} label={seg.toUpperCase()}>
                        {list.map((qq) => (
                          <option key={qq.symbol} value={qq.symbol}>
                            {qq.symbol} — {qq.price != null ? fmtPrice(qq.price, qq.digits) : 'no feed'}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Side</label>
                  <select className={inputCls} value={t.side}
                    onChange={(e) => {
                      const side = e.target.value;
                      const p = entryPrice(q, side);
                      // Buy fills at the ask, sell at the bid — re-stamp the open.
                      upd(p != null && !t.open_price
                        ? { side, open_price: p.toFixed(Math.min(q?.digits ?? 2, 8)) }
                        : { side });
                    }}>
                    <option value="buy">Buy</option>
                    <option value="sell">Sell</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Qty (lots)</label>
                  <input className={inputCls} value={t.lots} placeholder="1.00"
                    onChange={(e) => upd({ lots: e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div>
                  <label className={labelCls}>
                    Open{live != null && <span className="text-buy"> · live {fmtPrice(live, q?.digits ?? 2)}</span>}
                  </label>
                  <div className="flex gap-1">
                    <input className={inputCls} value={t.open_price} placeholder="Open"
                      onChange={(e) => upd({ open_price: e.target.value })} />
                    {live != null && (
                      <button type="button" title="Use live price"
                        onClick={() => upd({ open_price: live.toFixed(Math.min(q?.digits ?? 2, 8)) })}
                        className="px-1.5 rounded border border-border-primary text-text-tertiary hover:text-buy hover:border-buy/40 shrink-0">
                        <RefreshCw size={11} />
                      </button>
                    )}
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Close</label>
                  <input className={inputCls} value={t.close_price} placeholder="Close"
                    onChange={(e) => upd({ close_price: e.target.value })} />
                </div>
                <div>
                  <label className={labelCls}>P&amp;L ($){!t.pnlManual && <span className="text-text-tertiary"> · auto</span>}</label>
                  <input className={inputCls} value={t.pnl} placeholder="P&L $"
                    onChange={(e) => upd({ pnl: e.target.value, pnlManual: true })} />
                </div>
                <div>
                  <label className={labelCls}>Closed at (optional)</label>
                  <div className="flex gap-1">
                    <input type="time" className={inputCls} value={t.close_time}
                      onChange={(e) => upd({ close_time: e.target.value })} />
                    <button type="button" onClick={() => setManualTrades(rows.filter((_, j) => j !== i))}
                      className="p-1.5 rounded border border-danger/30 text-danger hover:bg-danger/10 shrink-0">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        <p className="text-xxs text-text-tertiary">
          Each row is one exact closed trade on that date. Pick the symbol from the live feed — any
          segment — and its running price is stamped as the <em>Open</em>; the <em>Close</em> is
          yours to set. P&amp;L is calculated from the prices, lots and contract size, and is used
          verbatim once you type over it. On any day that has a manual trade, auto-generation is
          skipped for that day, so only these trades appear. Negative P&amp;L is a losing trade.
          Future dates are skipped.
        </p>
      </div>

      {/* Preview */}
      {preview && (
        <div className={cardCls}>
          <h3 className="text-sm font-semibold text-text-primary">Preview</h3>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
            <Stat label="Base capital" value={fmtMoney(preview.base_capital)} />
            <Stat label="Total deposits" value={fmtMoney(preview.total_deposits)} />
            <Stat label="Total withdrawn" value={fmtMoney(preview.total_withdrawn)} />
            <Stat label="Final balance" value={fmtMoney(preview.final_balance)} highlight />
            <Stat label="Trades" value={String(preview.trades_count)} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs mt-2">
              <thead className="bg-bg-tertiary text-text-tertiary text-left">
                <tr>
                  <th className="p-1.5 font-medium">Month</th>
                  <th className="p-1.5 font-medium text-right">%</th>
                  <th className="p-1.5 font-medium text-right">Profit</th>
                  <th className="p-1.5 font-medium">Withdrawn</th>
                </tr>
              </thead>
              <tbody>
                {preview.months.map((m, i) => (
                  <tr key={i} className="border-t border-border-primary">
                    <td className="p-1.5">{MONTHS[m.month - 1]} {m.year}</td>
                    <td className="p-1.5 text-right font-mono tabular-nums">{m.pct}</td>
                    <td className="p-1.5 text-right font-mono tabular-nums text-buy">{fmtMoney(m.profit)}</td>
                    <td className="p-1.5 text-xxs text-text-secondary">
                      {m.withdrawn ? `Yes · ${m.withdraw_date}` : 'Retained'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 sticky bottom-0 bg-bg-primary/80 backdrop-blur py-2">
        <button type="button" disabled={previewing} onClick={() => void runPreview()}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium border border-border-primary text-text-primary hover:bg-bg-hover disabled:opacity-50">
          {previewing ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />} Preview
        </button>
        <button type="button" disabled={saving} onClick={() => void save()}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium bg-buy/15 text-buy border border-buy/30 hover:bg-buy/25 disabled:opacity-50">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {editId ? 'Save & regenerate' : 'Generate account'}
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="border border-border-primary rounded-md p-2 bg-bg-tertiary/40">
      <div className="text-xxs text-text-tertiary">{label}</div>
      <div className={`font-mono tabular-nums ${highlight ? 'text-buy font-semibold' : 'text-text-primary'}`}>{value}</div>
    </div>
  );
}

export default function NewManagedAccountPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-24"><Loader2 className="animate-spin text-text-tertiary" size={22} /></div>}>
      <ManagedAccountForm />
    </Suspense>
  );
}
