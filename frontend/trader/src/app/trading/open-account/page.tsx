'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api/client';
import { Button } from '@/components/ui/Button';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';
import { tradingTerminalUrl, setPersistedTradingAccountId } from '@/lib/tradingNav';

interface OpenAccountResponse {
  id: string;
  account_number: string;
  balance: number;
  account_group_id: string;
  account_group_name: string;
}

interface GroupItem {
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

function OpenAccountPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<{ items: GroupItem[] }>('/accounts/available-groups');
        if (!cancelled) setGroups(Array.isArray(res.items) ? res.items : []);
      } catch (e) {
        if (!cancelled) toast.error(e instanceof Error ? e.message : 'Could not load account types');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const preselectId = searchParams.get('group');
  useEffect(() => {
    if (!preselectId || groups.length === 0) return;
    if (groups.some((g) => g.id === preselectId)) setSelected(preselectId);
  }, [preselectId, groups]);

  const openAccount = async (groupId: string) => {
    setOpening(groupId);
    try {
      const res = await api.post<OpenAccountResponse>('/accounts/open', { account_group_id: groupId });
      toast.success('Trading account created — opening terminal…');
      if (res?.id) {
        setPersistedTradingAccountId(res.id);
        router.push(tradingTerminalUrl(res.id, { view: 'chart' }));
      } else {
        router.push('/trading');
      }
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not open account');
    } finally {
      setOpening(null);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-bg-primary">
      <div className="page-main max-w-3xl mx-auto py-6 sm:py-8 space-y-6">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-text-primary">Open live account</h1>
          <p className="text-xs sm:text-sm text-text-tertiary mt-1">
            Choose an account type configured by your broker. If a minimum opening amount is set and you already have
            funded live accounts, that amount is moved from your existing balances into this new account. Your first
            account opens at $0 until you deposit; you must meet the minimum balance before placing trades.
          </p>
        </div>

        {loading ? (
          <div className="text-sm text-text-tertiary py-12 text-center">Loading account types…</div>
        ) : groups.length === 0 ? (
          <div className="rounded-xl border border-border-glass bg-bg-secondary p-8 text-center text-sm text-text-tertiary">
            No account types are available yet. Please contact support.
          </div>
        ) : (
          <ul className="space-y-3">
            {groups.map((g) => {
              const isSel = selected === g.id;
              return (
                <li
                  key={g.id}
                  className={clsx(
                    'rounded-xl border overflow-hidden transition-colors',
                    isSel ? 'border-buy bg-buy/5' : 'border-border-glass bg-bg-secondary',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setSelected(g.id)}
                    className="w-full text-left p-4 sm:p-5 space-y-2"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-text-primary">{g.name}</span>
                      {g.swap_free ? (
                        <span className="text-xxs font-bold uppercase px-2 py-0.5 rounded-full bg-buy/15 text-buy">
                          Swap-free
                        </span>
                      ) : null}
                    </div>
                    {g.description ? (
                      <p className="text-xxs sm:text-xs text-text-tertiary">{g.description}</p>
                    ) : null}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-xxs text-text-tertiary">
                      <div>
                        Min. balance (to trade){' '}
                        <span className="text-text-primary font-mono">{fmtMoney(g.minimum_deposit)}</span>
                      </div>
                      <div>
                        Leverage <span className="text-text-primary font-mono">1:{g.leverage_default}</span>
                      </div>
                      <div>
                        Commission / lot{' '}
                        <span className="text-text-primary font-mono">{g.commission_per_lot}</span>
                      </div>
                    </div>
                  </button>
                  {isSel ? (
                    <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-0 flex flex-col sm:flex-row gap-2 sm:justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="md"
                        onClick={() => setSelected(null)}
                        className="sm:w-auto"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        variant="primary"
                        size="md"
                        loading={opening === g.id}
                        onClick={() => openAccount(g.id)}
                        className="sm:w-auto"
                      >
                        Open this account
                      </Button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}

        <p className="text-xxs text-text-tertiary">
          <Link href="/trading" className="text-buy hover:underline">
            Back to trading
          </Link>
          {' · '}
          <Link href="/dashboard" className="text-buy hover:underline">
            Dashboard
          </Link>
          {' · '}
          <Link href="/accounts" className="text-buy hover:underline">
            Accounts
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function OpenAccountPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 overflow-y-auto bg-bg-primary">
          <div className="page-main max-w-3xl mx-auto py-6 sm:py-8">
            <div className="text-sm text-text-tertiary py-12 text-center">Loading…</div>
          </div>
        </div>
      }
    >
      <OpenAccountPageInner />
    </Suspense>
  );
}
