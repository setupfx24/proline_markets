'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { adminApi } from '@/lib/api';
import { Loader2, Plus, Trash2, ArrowLeft, Eye, Save, Briefcase } from 'lucide-react';
import toast from 'react-hot-toast';

interface DepositRow { date: string; amount: string }
interface MonthRow { year: string; month: string; pct: string }
interface AllocRow { symbol: string; weight_pct: string }

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
  const [allocs, setAllocs] = useState<AllocRow[]>(DEFAULT_ALLOC);

  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);

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
    if (months.filter((m) => m.year && m.month && m.pct !== '').length === 0) return 'At least one monthly return is required';
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
