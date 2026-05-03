'use client';

import { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { Check } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '@/components/ui/Modal';
import api from '@/lib/api/client';

export interface AvailableAccountGroup {
  id: string;
  name: string;
  description: string;
  leverage_default: number;
  minimum_deposit: number;
  spread_markup: number;
  commission_per_lot: number;
  swap_free: boolean;
}

function fmtMoney(n: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 2 }).format(n);
}

const CARD_BG = 'var(--bg-secondary)';
const CARD_BORDER = 'var(--border-primary)';

type Props = {
  open: boolean;
  onClose: () => void;
  /** Called after account is successfully created — parent should refetch accounts list. */
  onCreated?: (accountId: string) => void;
};

export default function AccountTypePickerModal({ open, onClose, onCreated }: Props) {
  const [groups, setGroups] = useState<AvailableAccountGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSelectedId(null);
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await api.get<{ items: AvailableAccountGroup[] }>('/accounts/available-groups');
        if (cancelled) return;
        setGroups(Array.isArray(res.items) ? res.items : []);
      } catch (e) {
        if (!cancelled) toast.error(e instanceof Error ? e.message : 'Could not load account types');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const handleContinue = async () => {
    if (!selectedId) {
      toast.error('Select an account type');
      return;
    }
    setCreating(true);
    try {
      const res = await api.post<{ id: string; account_number: string }>('/accounts/open', {
        account_group_id: selectedId,
      });
      toast.success('Trading account created');
      onClose();
      if (res?.id) {
        try {
          sessionStorage.setItem('ptd-accounts-expand', res.id);
        } catch {}
        onCreated?.(res.id);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      // Backend returns detail="KYC_REQUIRED" when KYC is not approved — show a friendly message.
      if (msg === 'KYC_REQUIRED') {
        toast.error('Please complete KYC verification before opening a live account.');
        onClose();
      } else {
        toast.error(msg || 'Could not open account');
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Choose account type"
      width="2xl"
      className="border border-border-primary bg-bg-card max-h-[90vh] flex flex-col shadow-2xl"
      headerClassName="border-b border-border-primary bg-bg-card [&_h3]:text-text-primary [&_button]:text-text-tertiary [&_button:hover]:text-text-primary [&_button:hover]:bg-bg-hover"
      bodyClassName="bg-bg-card p-4 sm:p-5"
    >
      <div className="space-y-4">
        <p className="text-xs text-text-secondary leading-relaxed">
          Pick the account that fits how you trade. You can open more accounts later from Accounts.
        </p>

        {loading ? (
          <div className="flex flex-col items-center gap-3 py-12">
            <div className="w-8 h-8 border-2 border-[#22c55e] border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-text-secondary">Loading account types…</span>
          </div>
        ) : groups.length === 0 ? (
          <div
            className="rounded-xl border p-6 text-center text-sm text-text-secondary"
            style={{ backgroundColor: CARD_BG, borderColor: CARD_BORDER }}
          >
            No account types are available yet. Please contact support.
          </div>
        ) : (
          <ul className="space-y-3 max-h-[min(60vh,420px)] overflow-y-auto pr-1">
            {groups.map((g) => {
              const isSel = selectedId === g.id;
              return (
                <li key={g.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(g.id)}
                    className={clsx(
                      'w-full text-left rounded-xl border-2 p-4 sm:p-5 transition-all',
                      isSel
                        ? 'border-[#22c55e] bg-[#22c55e]/[0.06] shadow-[0_0_0_3px_rgba(34,197,94,0.15)]'
                        : 'border-border-primary bg-bg-secondary hover:border-[#22c55e]/40 hover:bg-bg-hover',
                    )}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-base font-bold text-text-primary">{g.name}</span>
                          {g.swap_free ? (
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-[#22c55e]/15 text-[#22c55e] border border-[#22c55e]/25">
                              Swap-free
                            </span>
                          ) : null}
                        </div>
                        {g.description ? (
                          <p className="text-xs text-text-secondary leading-snug">{g.description}</p>
                        ) : null}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-5 gap-y-2 pt-1 text-[11px]">
                          <div className="space-y-0.5">
                            <span className="block text-text-tertiary uppercase tracking-wider font-bold">
                              Min. balance
                            </span>
                            <span className="block text-text-primary font-mono font-bold tabular-nums text-sm">
                              {fmtMoney(g.minimum_deposit)}
                            </span>
                          </div>
                          <div className="space-y-0.5">
                            <span className="block text-text-tertiary uppercase tracking-wider font-bold">
                              Leverage
                            </span>
                            <span className="block text-text-primary font-mono font-bold tabular-nums text-sm">
                              1:{g.leverage_default}
                            </span>
                          </div>
                          <div className="space-y-0.5">
                            <span className="block text-text-tertiary uppercase tracking-wider font-bold">
                              Commission / lot
                            </span>
                            <span className="block text-text-primary font-mono font-bold tabular-nums text-sm">
                              {g.commission_per_lot}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div
                        className={clsx(
                          'shrink-0 mt-1 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all',
                          isSel
                            ? 'border-[#22c55e] bg-[#22c55e]'
                            : 'border-border-secondary bg-bg-card',
                        )}
                      >
                        {isSel ? <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} /> : null}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-3 border-t border-border-primary">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-lg border border-border-primary bg-bg-card text-sm font-semibold text-text-primary hover:bg-bg-hover transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={loading || creating || groups.length === 0 || !selectedId}
            onClick={() => void handleContinue()}
            className="px-5 py-2.5 rounded-lg bg-[#22c55e] text-white text-sm font-bold hover:bg-[#16a34a] disabled:opacity-40 disabled:pointer-events-none transition-colors shadow-[0_2px_8px_rgba(34,197,94,0.25)]"
          >
            {creating ? 'Creating…' : 'Open Account'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
