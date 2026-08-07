'use client';

import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '@/lib/api';
import {
  Loader2, Plus, Trash2, Search, Save, Eye, RefreshCw, PencilLine, RotateCcw,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface TradeRow {
  date: string; symbol: string; side: string;
  lots: string; open_price: string; close_price: string; pnl: string;
  close_reason: string; close_time: string; comment: string;
  /** true once the admin types a P&L by hand — stops the auto calculation. */
  pnlManual?: boolean;
}

/** One instrument from the live feed (Infoway / LP), as served by the admin API. */
interface Quote {
  symbol: string;
  display_name: string;
  segment: string;
  digits: number;
  contract_size: number;
  base_currency: string | null;
  quote_currency: string | null;
  bid: number | null;
  ask: number | null;
  price: number | null;
  timestamp: string | null;
}

interface ClientAccount {
  id: string;
  account_number: string;
  group: string | null;
  currency: string;
  leverage: number;
  is_demo: boolean;
  is_active: boolean;
  balance: number;
  equity: number;
  credit: number;
  booked_trades: number;
}

interface ClientInfo {
  id: string; email: string; name: string;
  status: string; book_type: string; kyc_status: string; country: string | null;
}

interface Lookup { user: ClientInfo; accounts: ClientAccount[] }

interface Preview {
  total_pnl: number;
  balance_before: number;
  balance_after: number;
  adjust_balance: boolean;
  trades: Array<{ date: string; symbol: string; side: string; lots: number; pnl: number }>;
}

interface BookedTrade {
  id: string; symbol: string; side: string; lots: number;
  open_price: number; close_price: number; profit: number;
  opened_at: string; closed_at: string; balance_adjusted: boolean;
}

const fmtMoney = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const inputCls =
  'w-full text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md text-text-primary';
const labelCls = 'block text-xxs text-text-tertiary mb-1';
const cardCls = 'border border-border-primary rounded-md bg-bg-secondary p-4 space-y-3';

const emptyRow = (): TradeRow => ({
  date: new Date().toISOString().slice(0, 10),
  symbol: '', side: 'buy',
  // A real 1, not a placeholder — P&L cannot compute without a quantity.
  lots: '1', open_price: '', close_price: '', pnl: '',
  close_reason: 'manual', close_time: '', comment: '',
});

export default function ManualTradesPage() {
  const [email, setEmail] = useState('');
  const [looking, setLooking] = useState(false);
  const [client, setClient] = useState<Lookup | null>(null);
  const [accountId, setAccountId] = useState('');

  const [rows, setRows] = useState<TradeRow[]>([emptyRow()]);
  const [adjustBalance, setAdjustBalance] = useState(true);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [booked, setBooked] = useState<BookedTrade[]>([]);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [quotesAt, setQuotesAt] = useState('');
  const [quotesLoading, setQuotesLoading] = useState(false);

  const account = client?.accounts.find((a) => a.id === accountId) || null;

  const loadQuotes = useCallback(async (notify = false) => {
    setQuotesLoading(true);
    try {
      const r = await adminApi.get<{ items: Quote[] }>('/manual-trades/instruments/live');
      setQuotes(r.items || []);
      setQuotesAt(new Date().toLocaleTimeString());
      if (notify) toast.success('Live prices refreshed');
    } catch (e: unknown) {
      if (notify) toast.error(e instanceof Error ? e.message : 'Failed to load live prices');
    } finally {
      setQuotesLoading(false);
    }
  }, []);

  // Keep the symbol picker's prices live while the page is open.
  useEffect(() => {
    void loadQuotes();
    const t = setInterval(() => { void loadQuotes(); }, 15000);
    return () => clearInterval(t);
  }, [loadQuotes]);

  const loadBooked = useCallback(async (accId: string) => {
    if (!accId) { setBooked([]); return; }
    try {
      const r = await adminApi.get<{ items: BookedTrade[] }>(`/manual-trades/account/${accId}`);
      setBooked(r.items || []);
    } catch {
      setBooked([]);
    }
  }, []);

  useEffect(() => {
    void loadBooked(accountId);
  }, [accountId, loadBooked]);

  const lookup = async () => {
    const e = email.trim();
    if (!e) { toast.error('Enter the client email'); return; }
    setLooking(true);
    setPreview(null);
    try {
      const r = await adminApi.get<Lookup>('/manual-trades/lookup', { email: e });
      setClient(r);
      // Prefer the first live account — that is where a booked trade belongs.
      const live = r.accounts.find((a) => !a.is_demo) || r.accounts[0];
      setAccountId(live?.id || '');
      toast.success(`${r.user.name} · ${r.accounts.length} account(s)`);
    } catch (err: unknown) {
      setClient(null);
      setAccountId('');
      toast.error(err instanceof Error ? err.message : 'Lookup failed');
    } finally {
      setLooking(false);
    }
  };

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

  /** Why the P&L box is not filling itself — an empty field with no reason
      looks broken, and the usual cause is a blank quantity. */
  const pnlHint = (row: TradeRow): string => {
    if (row.pnlManual) return 'typed';
    const missing: string[] = [];
    if (!Number.isFinite(parseFloat(row.lots))) missing.push('qty');
    if (!Number.isFinite(parseFloat(row.open_price))) missing.push('open');
    if (!Number.isFinite(parseFloat(row.close_price))) missing.push('close');
    if (missing.length) return `needs ${missing.join(', ')}`;
    // Without a feed row there is no contract size, so the number is only the
    // raw price move — say so rather than let it look authoritative.
    return quoteOf(row.symbol) ? 'auto' : 'auto · no contract size';
  };

  /** (close − open) × direction × qty × contract size, converted to the account
      currency — the same arithmetic the engine books a real close with. The
      stored profit is what the client sees, so type over the box for any other
      number. With no feed row for the symbol, contract size is unknown and this
      falls back to the raw price move. */
  const calcPnl = (row: TradeRow): string => {
    const open = parseFloat(row.open_price);
    const close = parseFloat(row.close_price);
    const lots = parseFloat(row.lots);
    if (!Number.isFinite(open) || !Number.isFinite(close) || !Number.isFinite(lots)) return row.pnl;
    const q = quoteOf(row.symbol);
    const dir = row.side === 'sell' ? -1 : 1;
    const size = q?.contract_size && q.contract_size > 0 ? q.contract_size : 1;
    let pnl = (close - open) * dir * lots * size;
    // Profit lands in the quote currency. USD-quoted (XAUUSD, US30, EURUSD…) is
    // already the account currency; USD-based (USDJPY…) divides by the rate.
    if (q && q.quote_currency && q.quote_currency !== 'USD' && q.base_currency === 'USD' && close) {
      pnl = pnl / close;
    }
    return pnl.toFixed(2);
  };

  const filled = rows.filter(
    (t) => t.date && t.symbol && t.lots && t.open_price && t.close_price && t.pnl !== '',
  );
  const totalPnl = filled.reduce((s, t) => s + (parseFloat(t.pnl) || 0), 0);

  const buildBody = () => ({
    email: (client?.user.email || email).trim(),
    account_id: accountId || null,
    adjust_balance: adjustBalance,
    trades: filled.map((t) => ({
      date: t.date,
      symbol: t.symbol.trim().toUpperCase(),
      side: t.side || 'buy',
      lots: parseFloat(t.lots) || 0,
      open_price: parseFloat(t.open_price) || 0,
      close_price: parseFloat(t.close_price) || 0,
      pnl: parseFloat(t.pnl) || 0,
      close_reason: t.close_reason || 'manual',
      close_time: t.close_time || null,
      comment: t.comment.trim() || null,
    })),
  });

  const validate = (): string | null => {
    if (!client) return 'Look up a client email first';
    if (!accountId) return 'Pick the trading account';
    if (filled.length === 0) return 'Fill at least one complete trade row';
    return null;
  };

  const runPreview = async () => {
    const err = validate();
    if (err) { toast.error(err); return; }
    setPreviewing(true);
    try {
      setPreview(await adminApi.post<Preview>('/manual-trades/preview', buildBody()));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Preview failed');
    } finally {
      setPreviewing(false);
    }
  };

  const apply = async () => {
    const err = validate();
    if (err) { toast.error(err); return; }
    setSaving(true);
    try {
      const res = await adminApi.post<{ message: string; balance: number }>(
        '/manual-trades/apply', buildBody(),
      );
      toast.success(res.message);
      setRows([emptyRow()]);
      setPreview(null);
      // Refresh the account's balance and the booked list from the server.
      const fresh = await adminApi.get<Lookup>('/manual-trades/lookup', { email: client!.user.email });
      setClient(fresh);
      void loadBooked(accountId);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Booking failed');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await adminApi.delete(`/manual-trades/${deleteId}`);
      toast.success('Booked trade removed');
      setDeleteId(null);
      if (client) setClient(await adminApi.get<Lookup>('/manual-trades/lookup', { email: client.user.email }));
      void loadBooked(accountId);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="p-6 space-y-4 max-w-5xl">
      <div>
        <h1 className="text-lg font-semibold text-text-primary flex items-center gap-2">
          <PencilLine size={18} className="text-buy" />
          Manual Trades
        </h1>
        <p className="text-xxs text-text-tertiary mt-0.5 max-w-3xl">
          Book exact closed trades onto any existing client&apos;s account. Find the client by login
          email, pick the account, then add one row per trade. Each row is written as a real closed
          trade — it shows in the client&apos;s history on web, mobile and the desktop terminal — and
          the account balance moves by the total P&amp;L unless you turn that off.
        </p>
      </div>

      {/* Client lookup */}
      <div className={cardCls}>
        <h3 className="text-sm font-semibold text-text-primary">Client</h3>
        <div className="flex gap-2">
          <input
            className={inputCls}
            value={email}
            placeholder="client@example.com"
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void lookup(); }}
          />
          <button
            type="button" disabled={looking} onClick={() => void lookup()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-buy/15 text-buy border border-buy/30 hover:bg-buy/25 disabled:opacity-50 shrink-0"
          >
            {looking ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />} Look up
          </button>
        </div>

        {client && (
          <>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-secondary">
              <span className="text-text-primary font-medium">{client.user.name}</span>
              <span>{client.user.email}</span>
              <span className="text-xxs text-text-tertiary">
                {client.user.status} · KYC {client.user.kyc_status} · {client.user.book_type}-book
                {client.user.country ? ` · ${client.user.country}` : ''}
              </span>
            </div>
            <div>
              <label className={labelCls}>Trading account</label>
              <select className={inputCls} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                {client.accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.account_number} — {a.currency} {fmtMoney(a.balance)}
                    {a.is_demo ? ' · DEMO' : ''}{a.group ? ` · ${a.group}` : ''}
                    {a.booked_trades ? ` · ${a.booked_trades} booked` : ''}
                  </option>
                ))}
              </select>
            </div>
            {account && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Balance" value={fmtMoney(account.balance)} />
                <Stat label="Equity" value={fmtMoney(account.equity)} />
                <Stat label="Leverage" value={`1:${account.leverage}`} />
                <Stat
                  label="After this batch"
                  value={fmtMoney(account.balance + (adjustBalance ? totalPnl : 0))}
                  highlight
                />
              </div>
            )}
            {account?.is_demo && (
              <p className="text-xxs text-warning">This is a DEMO account.</p>
            )}
          </>
        )}
      </div>

      {/* Trades */}
      <div className={cardCls}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-primary">Trades to book</h3>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => void loadQuotes(true)}
              className="inline-flex items-center gap-1 text-xxs text-text-tertiary hover:text-text-primary">
              <RefreshCw size={11} className={quotesLoading ? 'animate-spin' : ''} />
              {quotes.length ? `${quotes.length} symbols${quotesAt ? ` · ${quotesAt}` : ''}` : 'Load live prices'}
            </button>
            <button type="button" onClick={() => setRows([...rows, emptyRow()])}
              className="inline-flex items-center gap-1 text-xxs text-buy hover:underline">
              <Plus size={12} /> Add trade
            </button>
          </div>
        </div>

        {rows.map((t, i) => {
          const upd = (patch: Partial<TradeRow>) =>
            setRows(rows.map((x, j) => {
              if (j !== i) return x;
              const next = { ...x, ...patch };
              // Keep P&L in step with side / lots / prices until it is typed over.
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
                      // Selecting a symbol stamps the price running right now as
                      // the open; the close stays the admin's to set.
                      upd(p != null
                        ? { symbol: sym, open_price: p.toFixed(Math.min(nq?.digits ?? 2, 8)) }
                        : { symbol: sym });
                    }}>
                    <option value="">Select symbol…</option>
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
                  <label className={labelCls}>
                    P&amp;L ($){' '}
                    <span className={pnlHint(t).startsWith('needs') ? 'text-warning' : 'text-text-tertiary'}>
                      · {pnlHint(t)}
                    </span>
                  </label>
                  <input className={inputCls} value={t.pnl} placeholder="P&L $"
                    onChange={(e) => upd({ pnl: e.target.value, pnlManual: true })} />
                </div>
                <div>
                  <label className={labelCls}>Closed at (optional)</label>
                  <div className="flex gap-1">
                    <input type="time" className={inputCls} value={t.close_time}
                      onChange={(e) => upd({ close_time: e.target.value })} />
                    <button type="button" onClick={() => setRows(rows.filter((_, j) => j !== i))}
                      className="p-1.5 rounded border border-danger/30 text-danger hover:bg-danger/10 shrink-0">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div>
                  <label className={labelCls}>Close reason</label>
                  <select className={inputCls} value={t.close_reason}
                    onChange={(e) => upd({ close_reason: e.target.value })}>
                    <option value="manual">Manual</option>
                    <option value="tp">Take profit</option>
                    <option value="sl">Stop loss</option>
                    <option value="admin">Admin</option>
                    <option value="margin">Margin call</option>
                  </select>
                </div>
                <div className="md:col-span-3">
                  <label className={labelCls}>Internal note (optional — not shown to the client)</label>
                  <input className={inputCls} value={t.comment} placeholder="Why this trade was booked"
                    onChange={(e) => upd({ comment: e.target.value })} />
                </div>
              </div>
            </div>
          );
        })}

        <div className="flex items-center justify-between gap-3 pt-1">
          <label className="flex items-center gap-2 text-xxs text-text-secondary">
            <input type="checkbox" checked={adjustBalance}
              onChange={(e) => setAdjustBalance(e.target.checked)} />
            Move the account balance by the total P&amp;L
          </label>
          <div className="text-xs text-text-secondary">
            Total P&amp;L{' '}
            <span className={`font-mono tabular-nums ${totalPnl < 0 ? 'text-sell' : 'text-buy'}`}>
              {fmtMoney(totalPnl)}
            </span>
          </div>
        </div>

        <p className="text-xxs text-text-tertiary">
          Each row is one exact closed trade on that date. Pick the symbol from the live feed — any
          segment — and its running price is stamped as the <em>Open</em>; the <em>Close</em> is
          yours to set. P&amp;L is calculated the way a real close is — price move × lots × the
          instrument&apos;s contract size — and is stored verbatim once you type over it. Negative
          P&amp;L is a losing trade. Close dates in the future are rejected.
        </p>
      </div>

      {/* Preview */}
      {preview && (
        <div className={cardCls}>
          <h3 className="text-sm font-semibold text-text-primary">Preview</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <Stat label="Trades" value={String(preview.trades.length)} />
            <Stat label="Total P&L" value={fmtMoney(preview.total_pnl)} />
            <Stat label="Balance before" value={fmtMoney(preview.balance_before)} />
            <Stat label="Balance after" value={fmtMoney(preview.balance_after)} highlight />
          </div>
          {!preview.adjust_balance && (
            <p className="text-xxs text-warning">
              Balance adjustment is off — the trades will appear in history without changing the
              balance.
            </p>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 sticky bottom-0 bg-bg-primary/80 backdrop-blur py-2">
        <button type="button" disabled={previewing} onClick={() => void runPreview()}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium border border-border-primary text-text-primary hover:bg-bg-hover disabled:opacity-50">
          {previewing ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />} Preview
        </button>
        <button type="button" disabled={saving} onClick={() => void apply()}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium bg-buy/15 text-buy border border-buy/30 hover:bg-buy/25 disabled:opacity-50">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Book trades
        </button>
      </div>

      {/* Previously booked */}
      {accountId && booked.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-text-primary">
            Booked on this account{account ? ` (${account.account_number})` : ''}
          </h3>
          <div className="overflow-x-auto border border-border-primary rounded-md">
            <table className="w-full text-xs">
              <thead className="bg-bg-tertiary text-text-tertiary text-left">
                <tr>
                  <th className="p-2 font-medium">Closed</th>
                  <th className="p-2 font-medium">Symbol</th>
                  <th className="p-2 font-medium">Side</th>
                  <th className="p-2 font-medium text-right">Lots</th>
                  <th className="p-2 font-medium text-right">Open</th>
                  <th className="p-2 font-medium text-right">Close</th>
                  <th className="p-2 font-medium text-right">P&amp;L</th>
                  <th className="p-2 font-medium w-10" />
                </tr>
              </thead>
              <tbody>
                {booked.map((b) => (
                  <tr key={b.id} className="border-t border-border-primary hover:bg-bg-hover/40">
                    <td className="p-2 text-xxs text-text-tertiary">
                      {b.closed_at ? new Date(b.closed_at).toLocaleString() : '—'}
                    </td>
                    <td className="p-2 font-medium text-text-primary">{b.symbol || '—'}</td>
                    <td className={`p-2 uppercase ${b.side === 'sell' ? 'text-sell' : 'text-buy'}`}>{b.side}</td>
                    <td className="p-2 font-mono tabular-nums text-right">{b.lots}</td>
                    <td className="p-2 font-mono tabular-nums text-right">{b.open_price}</td>
                    <td className="p-2 font-mono tabular-nums text-right">{b.close_price}</td>
                    <td className={`p-2 font-mono tabular-nums text-right ${b.profit < 0 ? 'text-sell' : 'text-buy'}`}>
                      {fmtMoney(b.profit)}
                    </td>
                    <td className="p-2">
                      <button type="button" onClick={() => setDeleteId(b.id)}
                        title="Remove this booked trade"
                        className="p-1 rounded border border-danger/30 text-danger hover:bg-danger/10">
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setDeleteId(null)}>
          <div className="bg-bg-secondary border border-border-primary rounded-md shadow-modal w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-3 border-b border-border-primary">
              <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                <RotateCcw size={14} className="text-danger" /> Remove booked trade
              </h3>
            </div>
            <div className="px-5 py-4 text-xs text-text-secondary">
              The trade disappears from the client&apos;s history and its P&amp;L is taken back out of
              the balance (unless it was booked without a balance change). This cannot be undone.
            </div>
            <div className="px-5 py-3 border-t border-border-primary flex justify-end gap-2">
              <button type="button" onClick={() => setDeleteId(null)}
                className="px-3 py-1.5 rounded-md text-xs border border-border-primary text-text-secondary hover:bg-bg-hover">
                Cancel
              </button>
              <button type="button" disabled={deleting} onClick={() => void confirmDelete()}
                className="px-3 py-1.5 rounded-md text-xs font-medium bg-danger/15 text-danger border border-danger/30 hover:bg-danger/25 disabled:opacity-50">
                {deleting ? 'Removing…' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
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
