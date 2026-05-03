'use client';

import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Loader2, Plus, Pencil, RefreshCw, Gift } from 'lucide-react';
import toast from 'react-hot-toast';

interface BonusOffer {
  id: string;
  name: string;
  bonus_type: string;
  bonus_value: number;
  min_deposit: number;
  lots_required: number;
  target_audience: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  allocations_count?: number;
}

interface BonusAllocation {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  offer_name: string;
  bonus_amount: number;
  lots_completed: number;
  lots_required: number;
  status: string;
  allocated_at: string;
}

type Tab = 'offers' | 'allocations';

function formatMoney(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const EMPTY_FORM = {
  name: '',
  bonus_type: 'deposit',
  bonus_value: '',
  min_deposit: '',
  lots_required: '',
  target_audience: 'all',
  start_date: '',
  end_date: '',
};

export default function BonusPage() {
  const [tab, setTab] = useState<Tab>('offers');
  const [offers, setOffers] = useState<BonusOffer[]>([]);
  const [allocations, setAllocations] = useState<BonusAllocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === 'offers') {
        const res = await adminApi.get<{ offers: BonusOffer[] }>('/bonus/offers');
        setOffers(res.offers || []);
      } else {
        const res = await adminApi.get<{ allocations: BonusAllocation[] }>('/bonus/allocations');
        setAllocations(res.allocations || []);
      }
    } catch (e: any) {
      toast.error(e.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openCreate = () => {
    setEditId(null);
    setForm({ ...EMPTY_FORM });
    setShowModal(true);
  };

  const openEdit = (offer: BonusOffer) => {
    setEditId(offer.id);
    setForm({
      name: offer.name,
      bonus_type: offer.bonus_type,
      bonus_value: String(offer.bonus_value),
      min_deposit: String(offer.min_deposit),
      lots_required: String(offer.lots_required),
      target_audience: offer.target_audience,
      start_date: offer.start_date,
      end_date: offer.end_date,
    });
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    setSubmitting(true);
    try {
      const body = {
        name: form.name,
        bonus_type: form.bonus_type,
        bonus_value: parseFloat(form.bonus_value) || 0,
        min_deposit: parseFloat(form.min_deposit) || 0,
        lots_required: parseFloat(form.lots_required) || 0,
        target_audience: form.target_audience,
        start_date: form.start_date,
        end_date: form.end_date,
      };
      if (editId) {
        await adminApi.put(`/bonus/offers/${editId}`, body);
        toast.success('Offer updated');
      } else {
        await adminApi.post('/bonus/offers', body);
        toast.success('Offer created');
      }
      setShowModal(false);
      fetchData();
    } catch (e: any) {
      toast.error(e.message || 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  };

  const updateForm = (key: string, val: string) => setForm((f) => ({ ...f, [key]: val }));

  return (
    <>
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-text-primary">Bonus Management</h1>
            <p className="text-xxs text-text-tertiary mt-0.5">Create bonus offers and track allocations</p>
          </div>
          <div className="flex items-center gap-2">
            {tab === 'offers' && (
              <button onClick={openCreate} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-buy/15 text-buy border border-buy/30 hover:bg-buy/25 transition-fast">
                <Plus size={14} /> New Offer
              </button>
            )}
            <button onClick={fetchData} className="p-1.5 rounded-md border border-border-primary text-text-secondary hover:bg-bg-hover transition-fast">
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        <div className="bg-bg-secondary border border-border-primary rounded-md">
          <div className="flex gap-1 p-1 border-b border-border-primary">
            {([['offers', 'Offers'], ['allocations', 'Allocations']] as const).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-medium transition-fast',
                  tab === id
                    ? 'bg-bg-hover text-text-primary border border-border-primary'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover/60',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="p-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={20} className="animate-spin text-text-tertiary" />
              </div>
            ) : tab === 'offers' ? (
              offers.length === 0 ? (
                <div className="text-center text-xs text-text-tertiary py-12">No bonus offers created yet</div>
              ) : (
                <div className="border border-border-primary rounded-md overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px]">
                      <thead>
                        <tr className="border-b border-border-primary bg-bg-tertiary/40">
                          {['Name', 'Type', 'Value', 'Min Deposit', 'Lots Req.', 'Audience', 'Period', 'Status', 'Actions'].map((col) => (
                            <th key={col} className={cn('text-left px-4 py-2.5 text-xxs font-medium text-text-tertiary uppercase tracking-wide', ['Value', 'Min Deposit'].includes(col) && 'text-right', col === 'Actions' && 'text-right')}>
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {offers.map((offer) => (
                          <tr key={offer.id} className="border-b border-border-primary/50 transition-fast hover:bg-bg-hover">
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-1.5">
                                <Gift size={12} className="text-accent" />
                                <span className="text-xs text-text-primary">{offer.name}</span>
                              </div>
                            </td>
                            <td className="px-4 py-2.5">
                              <span className="inline-flex px-1.5 py-0.5 rounded-sm text-xxs font-medium bg-buy/15 text-buy">{offer.bonus_type}</span>
                            </td>
                            <td className="px-4 py-2.5 text-xs text-text-primary text-right font-mono tabular-nums">
                              {offer.bonus_type === 'percentage' ? `${offer.bonus_value}%` : `$${formatMoney(offer.bonus_value)}`}
                            </td>
                            <td className="px-4 py-2.5 text-xs text-text-secondary text-right font-mono tabular-nums">${formatMoney(offer.min_deposit)}</td>
                            <td className="px-4 py-2.5 text-xs text-text-secondary font-mono tabular-nums">{offer.lots_required}</td>
                            <td className="px-4 py-2.5 text-xs text-text-secondary">{offer.target_audience}</td>
                            <td className="px-4 py-2.5 text-xxs text-text-tertiary font-mono tabular-nums">
                              {offer.start_date || '—'} → {offer.end_date || '—'}
                            </td>
                            <td className="px-4 py-2.5">
                              <span className={cn('inline-flex px-1.5 py-0.5 rounded-sm text-xxs font-medium', offer.is_active ? 'bg-success/15 text-success' : 'bg-text-tertiary/15 text-text-tertiary')}>
                                {offer.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <button onClick={() => openEdit(offer)} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xxs font-medium text-text-secondary border border-border-primary hover:bg-bg-hover transition-fast">
                                <Pencil size={12} /> Edit
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            ) : allocations.length === 0 ? (
              <div className="text-center text-xs text-text-tertiary py-12">No allocations found</div>
            ) : (
              <div className="border border-border-primary rounded-md overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px]">
                    <thead>
                      <tr className="border-b border-border-primary bg-bg-tertiary/40">
                        {['User', 'Offer', 'Bonus Amount', 'Lots Progress', 'Status', 'Allocated'].map((col) => (
                          <th key={col} className={cn('text-left px-4 py-2.5 text-xxs font-medium text-text-tertiary uppercase tracking-wide', col === 'Bonus Amount' && 'text-right')}>
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {allocations.map((a) => (
                        <tr key={a.id} className="border-b border-border-primary/50 transition-fast hover:bg-bg-hover">
                          <td className="px-4 py-2.5">
                            <p className="text-xs text-text-primary">{a.user_name}</p>
                            <p className="text-xxs text-text-tertiary">{a.user_email}</p>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-text-secondary">{a.offer_name}</td>
                          <td className="px-4 py-2.5 text-xs text-text-primary text-right font-mono tabular-nums">${formatMoney(a.bonus_amount)}</td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <div className="w-20 h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
                                <div className="h-full bg-buy rounded-full" style={{ width: `${Math.min((a.lots_completed / (a.lots_required || 1)) * 100, 100)}%` }} />
                              </div>
                              <span className="text-xxs text-text-tertiary font-mono tabular-nums">{a.lots_completed}/{a.lots_required}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={cn('inline-flex px-1.5 py-0.5 rounded-sm text-xxs font-medium',
                              a.status === 'completed' ? 'bg-success/15 text-success' :
                              a.status === 'active' ? 'bg-buy/15 text-buy' :
                              a.status === 'cancelled' ? 'bg-danger/15 text-danger' :
                              'bg-warning/15 text-warning'
                            )}>
                              {a.status}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-text-tertiary font-mono tabular-nums">{a.allocated_at}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-bg-secondary border border-border-primary rounded-md shadow-modal w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-border-primary">
              <h3 className="text-sm font-semibold text-text-primary">{editId ? 'Edit Offer' : 'Create Bonus Offer'}</h3>
            </div>
            <div className="px-5 py-4 space-y-3 max-h-[60vh] overflow-y-auto">
              <div>
                <label className="block text-xxs text-text-tertiary mb-1">Name</label>
                <input value={form.name} onChange={(e) => updateForm('name', e.target.value)} className="w-full text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md" placeholder="e.g. Welcome Bonus 50%" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xxs text-text-tertiary mb-1">Bonus Type</label>
                  <select value={form.bonus_type} onChange={(e) => updateForm('bonus_type', e.target.value)} className="w-full text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md">
                    <option value="deposit">Deposit Bonus</option>
                    <option value="percentage">Percentage</option>
                    <option value="fixed">Fixed Amount</option>
                    <option value="no_deposit">No Deposit</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xxs text-text-tertiary mb-1">Bonus Value</label>
                  <input type="number" step="0.01" value={form.bonus_value} onChange={(e) => updateForm('bonus_value', e.target.value)} className="w-full text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md" placeholder="e.g. 50" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xxs text-text-tertiary mb-1">Min Deposit ($)</label>
                  <input type="number" step="0.01" value={form.min_deposit} onChange={(e) => updateForm('min_deposit', e.target.value)} className="w-full text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md" placeholder="e.g. 100" />
                </div>
                <div>
                  <label className="block text-xxs text-text-tertiary mb-1">Lots Required</label>
                  <input type="number" step="0.01" value={form.lots_required} onChange={(e) => updateForm('lots_required', e.target.value)} className="w-full text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md" placeholder="e.g. 5" />
                </div>
              </div>
              <div>
                <label className="block text-xxs text-text-tertiary mb-1">Target Audience</label>
                <select value={form.target_audience} onChange={(e) => updateForm('target_audience', e.target.value)} className="w-full text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md">
                  <option value="all">All Users</option>
                  <option value="new">New Users Only</option>
                  <option value="vip">VIP Users</option>
                  <option value="ib">IB Users</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xxs text-text-tertiary mb-1">Start Date</label>
                  <input type="date" value={form.start_date} onChange={(e) => updateForm('start_date', e.target.value)} className="w-full text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md" />
                </div>
                <div>
                  <label className="block text-xxs text-text-tertiary mb-1">End Date</label>
                  <input type="date" value={form.end_date} onChange={(e) => updateForm('end_date', e.target.value)} className="w-full text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md" />
                </div>
              </div>
            </div>
            <div className="px-5 py-3 border-t border-border-primary flex justify-end gap-2">
              <button onClick={() => setShowModal(false)} className="px-3 py-1.5 rounded-md text-xs text-text-secondary border border-border-primary hover:bg-bg-hover transition-fast">Cancel</button>
              <button onClick={handleSubmit} disabled={submitting} className="px-3 py-1.5 rounded-md text-xs font-medium bg-buy/15 text-buy border border-buy/30 hover:bg-buy/25 transition-fast disabled:opacity-50">
                {submitting ? 'Saving...' : editId ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
