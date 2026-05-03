'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { adminApi } from '@/lib/api';
import toast from 'react-hot-toast';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  ChevronDown,
  Loader2,
  Search,
  X,
} from 'lucide-react';

interface SearchUser {
  id: string;
  name: string;
  email: string;
  accounts?: { id: string; name: string; balance?: number; currency?: string }[];
}

export default function CreateTradePage() {
  const router = useRouter();

  const [userSearch, setUserSearch] = useState('');
  const [userResults, setUserResults] = useState<SearchUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<SearchUser | null>(null);
  const [userSearchLoading, setUserSearchLoading] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  const [accountId, setAccountId] = useState('');
  const [symbol, setSymbol] = useState('');
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [orderType, setOrderType] = useState('market');
  const [lots, setLots] = useState('');
  const [price, setPrice] = useState('');
  const [sl, setSl] = useState('');
  const [tp, setTp] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (userSearch.length < 2) { setUserResults([]); setShowUserDropdown(false); return; }
    const t = setTimeout(async () => {
      setUserSearchLoading(true);
      try {
        const data = await adminApi.get<{ users: SearchUser[] }>('/users', { search: userSearch, limit: '10' });
        setUserResults(data.users || []);
        setShowUserDropdown(true);
      } catch { /* silent */ } finally {
        setUserSearchLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [userSearch]);

  const selectUser = (u: SearchUser) => {
    setSelectedUser(u);
    setUserResults([]);
    setUserSearch('');
    setShowUserDropdown(false);
    if (u.accounts?.[0]) setAccountId(u.accounts[0].id);
    else setAccountId('');
  };

  const clearUser = () => {
    setSelectedUser(null);
    setAccountId('');
  };

  const validate = (): string | null => {
    if (!selectedUser) return 'Select a user';
    if (!accountId) return 'Select or enter an account';
    if (!symbol.trim()) return 'Enter a symbol';
    if (!lots || parseFloat(lots) <= 0) return 'Enter valid lots';
    if (orderType !== 'market' && (!price || parseFloat(price) <= 0)) return 'Price is required for non-market orders';
    if (!reason.trim()) return 'Reason is required';
    return null;
  };

  const handleSubmit = () => {
    const err = validate();
    if (err) { toast.error(err); return; }
    setShowConfirm(true);
  };

  const confirmSubmit = async () => {
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        user_id: selectedUser!.id,
        account_id: accountId,
        symbol: symbol.toUpperCase().trim(),
        side,
        type: orderType,
        lots: parseFloat(lots),
        reason: reason.trim(),
      };
      if (price) body.price = parseFloat(price);
      if (sl) body.sl = parseFloat(sl);
      if (tp) body.tp = parseFloat(tp);

      await adminApi.post('/trades/create', body);
      toast.success('Trade created successfully');
      router.push('/trades');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create trade');
    } finally {
      setSubmitting(false);
      setShowConfirm(false);
    }
  };

  return (
    <>
      <div className="p-6 max-w-2xl mx-auto space-y-5">
        {/* Back */}
        <Link href="/trades" className="inline-flex items-center gap-1 text-xxs text-text-tertiary hover:text-text-primary transition-fast">
          <ArrowLeft size={12} /> Back to trades
        </Link>

        <div>
          <h1 className="text-lg font-semibold text-text-primary">Create Trade</h1>
          <p className="text-xxs text-text-tertiary mt-0.5">Open a trade on behalf of a user</p>
        </div>

        {/* Warning Banner */}
        <div className="flex items-start gap-3 p-4 rounded-md bg-warning/10 border border-warning/20">
          <AlertTriangle size={18} className="text-warning shrink-0 mt-0.5" />
          <div>
            <p className="text-xs text-warning font-medium">Stealth Trade</p>
            <p className="text-xxs text-text-secondary mt-0.5">
              This trade will appear as the user&apos;s own trade. The user will not be notified that this trade was placed by an administrator. Use responsibly and always provide a reason.
            </p>
          </div>
        </div>

        <div className="bg-bg-secondary border border-border-primary rounded-md p-5 space-y-4">
          {/* User Search */}
          <div>
            <label className="block text-xxs text-text-tertiary mb-1.5 uppercase tracking-wide">User <span className="text-danger">*</span></label>
            {selectedUser ? (
              <div className="flex items-center justify-between p-3 bg-bg-tertiary/50 border border-border-primary rounded-md">
                <div>
                  <p className="text-xs text-text-primary font-medium">{selectedUser.name}</p>
                  <p className="text-xxs text-text-secondary">{selectedUser.email} &middot; ID: {selectedUser.id}</p>
                </div>
                <button onClick={clearUser} className="p-1 rounded hover:bg-bg-hover text-text-tertiary hover:text-text-primary transition-fast"><X size={14} /></button>
              </div>
            ) : (
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                  onFocus={() => { if (userResults.length) setShowUserDropdown(true); }}
                  placeholder="Search by email or name..."
                  className="w-full pl-9 pr-3 py-2.5 text-xs bg-bg-input border border-border-primary rounded-md placeholder:text-text-tertiary focus:border-buy transition-fast"
                />
                {userSearchLoading && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-text-tertiary" />}
                {showUserDropdown && userResults.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-10 max-h-48 overflow-y-auto border border-border-primary rounded-md bg-bg-secondary shadow-dropdown">
                    {userResults.map(u => (
                      <button key={u.id} onClick={() => selectUser(u)} className="w-full text-left px-3 py-2.5 text-xs hover:bg-bg-hover transition-fast border-b border-border-primary/50 last:border-0">
                        <p className="text-text-primary font-medium">{u.name}</p>
                        <p className="text-xxs text-text-tertiary">{u.email} &middot; {u.accounts?.length || 0} account(s)</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Account */}
          <div>
            <label className="block text-xxs text-text-tertiary mb-1.5 uppercase tracking-wide">Trading Account <span className="text-danger">*</span></label>
            {selectedUser?.accounts && selectedUser.accounts.length > 0 ? (
              <div className="relative">
                <select value={accountId} onChange={e => setAccountId(e.target.value)} className="w-full text-xs py-2.5 pl-3 pr-8 appearance-none bg-bg-input border border-border-primary rounded-md">
                  <option value="">Select account</option>
                  {selectedUser.accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.name || a.id}{a.balance != null ? ` — $${a.balance.toLocaleString()}` : ''}{a.currency ? ` ${a.currency}` : ''}</option>
                  ))}
                </select>
                <ChevronDown size={12} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
              </div>
            ) : (
              <input type="text" value={accountId} onChange={e => setAccountId(e.target.value)} placeholder="Enter account ID" className="w-full px-3 py-2.5 text-xs bg-bg-input border border-border-primary rounded-md placeholder:text-text-tertiary focus:border-buy transition-fast" />
            )}
          </div>

          <hr className="border-border-primary" />

          {/* Symbol & Lots */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xxs text-text-tertiary mb-1.5 uppercase tracking-wide">Symbol <span className="text-danger">*</span></label>
              <input type="text" value={symbol} onChange={e => setSymbol(e.target.value)} placeholder="e.g. EURUSD" className="w-full px-3 py-2.5 text-xs bg-bg-input border border-border-primary rounded-md uppercase placeholder:text-text-tertiary focus:border-buy transition-fast font-medium" />
            </div>
            <div>
              <label className="block text-xxs text-text-tertiary mb-1.5 uppercase tracking-wide">Lots <span className="text-danger">*</span></label>
              <input type="number" step="0.01" min="0.01" value={lots} onChange={e => setLots(e.target.value)} placeholder="0.01" className="w-full px-3 py-2.5 text-xs bg-bg-input border border-border-primary rounded-md font-mono tabular-nums placeholder:text-text-tertiary focus:border-buy transition-fast" />
            </div>
          </div>

          {/* Side */}
          <div>
            <label className="block text-xxs text-text-tertiary mb-1.5 uppercase tracking-wide">Side <span className="text-danger">*</span></label>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setSide('buy')} className={cn(
                'py-3 rounded-md text-sm font-semibold border-2 transition-fast',
                side === 'buy' ? 'bg-buy/15 text-buy border-buy' : 'bg-bg-input text-text-secondary border-border-primary hover:border-border-secondary',
              )}>
                BUY
              </button>
              <button onClick={() => setSide('sell')} className={cn(
                'py-3 rounded-md text-sm font-semibold border-2 transition-fast',
                side === 'sell' ? 'bg-sell/15 text-sell border-sell' : 'bg-bg-input text-text-secondary border-border-primary hover:border-border-secondary',
              )}>
                SELL
              </button>
            </div>
          </div>

          {/* Order Type */}
          <div>
            <label className="block text-xxs text-text-tertiary mb-1.5 uppercase tracking-wide">Order Type <span className="text-danger">*</span></label>
            <div className="grid grid-cols-3 gap-2">
              {['market', 'limit', 'stop'].map(t => (
                <button key={t} onClick={() => setOrderType(t)} className={cn(
                  'py-2.5 rounded-md text-xs font-medium border transition-fast capitalize',
                  orderType === t ? 'bg-buy/15 text-buy border-buy/30' : 'bg-bg-input text-text-secondary border-border-primary hover:border-border-secondary',
                )}>{t}</button>
              ))}
            </div>
          </div>

          {/* Price (for limit/stop) */}
          {orderType !== 'market' && (
            <div>
              <label className="block text-xxs text-text-tertiary mb-1.5 uppercase tracking-wide">Price <span className="text-danger">*</span></label>
              <input type="number" step="any" value={price} onChange={e => setPrice(e.target.value)} placeholder="0.00000" className="w-full px-3 py-2.5 text-xs bg-bg-input border border-border-primary rounded-md font-mono tabular-nums placeholder:text-text-tertiary focus:border-buy transition-fast" />
            </div>
          )}

          {/* SL / TP */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xxs text-text-tertiary mb-1.5 uppercase tracking-wide">Stop Loss</label>
              <input type="number" step="any" value={sl} onChange={e => setSl(e.target.value)} placeholder="Optional" className="w-full px-3 py-2.5 text-xs bg-bg-input border border-border-primary rounded-md font-mono tabular-nums placeholder:text-text-tertiary focus:border-buy transition-fast" />
            </div>
            <div>
              <label className="block text-xxs text-text-tertiary mb-1.5 uppercase tracking-wide">Take Profit</label>
              <input type="number" step="any" value={tp} onChange={e => setTp(e.target.value)} placeholder="Optional" className="w-full px-3 py-2.5 text-xs bg-bg-input border border-border-primary rounded-md font-mono tabular-nums placeholder:text-text-tertiary focus:border-buy transition-fast" />
            </div>
          </div>

          <hr className="border-border-primary" />

          {/* Reason */}
          <div>
            <label className="block text-xxs text-text-tertiary mb-1.5 uppercase tracking-wide">Reason <span className="text-danger">*</span></label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} placeholder="Why is this trade being created? This is required for audit purposes." className="w-full px-3 py-2.5 text-xs bg-bg-input border border-border-primary rounded-md placeholder:text-text-tertiary focus:border-buy transition-fast resize-none" />
          </div>

          {/* Submit */}
          <div className="flex items-center justify-between pt-2">
            <Link href="/trades" className="text-xs text-text-tertiary hover:text-text-primary transition-fast">Cancel</Link>
            <button onClick={handleSubmit} disabled={submitting} className={cn(
              'px-6 py-2 rounded-md text-xs font-medium transition-fast',
              'bg-buy text-white hover:bg-buy-light disabled:opacity-50',
            )}>
              Review & Submit
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowConfirm(false)} />
          <div className="relative bg-bg-secondary border border-border-primary rounded-md shadow-modal w-full max-w-md mx-4 p-5 animate-slide-down">
            <h3 className="text-sm font-semibold text-text-primary mb-4">Confirm Trade</h3>

            <div className="space-y-2 p-3 bg-bg-tertiary/50 border border-border-primary rounded-md mb-4">
              <div className="flex justify-between text-xs">
                <span className="text-text-tertiary">User</span>
                <span className="text-text-primary">{selectedUser?.name}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-text-tertiary">Symbol</span>
                <span className="text-text-primary font-medium">{symbol.toUpperCase()}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-text-tertiary">Side</span>
                <span className={cn('font-medium', side === 'buy' ? 'text-buy' : 'text-sell')}>{side.toUpperCase()}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-text-tertiary">Type</span>
                <span className="text-text-primary capitalize">{orderType}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-text-tertiary">Lots</span>
                <span className="text-text-primary font-mono tabular-nums">{lots}</span>
              </div>
              {price && orderType !== 'market' && (
                <div className="flex justify-between text-xs">
                  <span className="text-text-tertiary">Price</span>
                  <span className="text-text-primary font-mono tabular-nums">{price}</span>
                </div>
              )}
              {sl && <div className="flex justify-between text-xs"><span className="text-text-tertiary">SL</span><span className="text-text-primary font-mono tabular-nums">{sl}</span></div>}
              {tp && <div className="flex justify-between text-xs"><span className="text-text-tertiary">TP</span><span className="text-text-primary font-mono tabular-nums">{tp}</span></div>}
            </div>

            <div className="p-2.5 rounded-md bg-warning/10 border border-warning/20 mb-4">
              <p className="text-xxs text-warning">This trade will appear as {selectedUser?.name}&apos;s own trade.</p>
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={() => setShowConfirm(false)} className="px-3 py-1.5 rounded-md text-xs font-medium text-text-secondary border border-border-primary hover:bg-bg-hover transition-fast">Go Back</button>
              <button onClick={confirmSubmit} disabled={submitting} className="px-4 py-1.5 rounded-md text-xs font-medium bg-buy text-white hover:bg-buy-light disabled:opacity-50 transition-fast">
                {submitting ? <Loader2 size={14} className="animate-spin" /> : 'Confirm & Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
