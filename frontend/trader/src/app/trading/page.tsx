'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Trash2 } from 'lucide-react';
import { useTradingStore, type TradingAccount } from '@/stores/tradingStore';
import { useAuthStore } from '@/stores/authStore';
import {
  tradingTerminalUrl,
  setPersistedTradingAccountId,
  getPersistedTradingAccountId,
} from '@/lib/tradingNav';
import api from '@/lib/api/client';
import Modal from '@/components/ui/Modal';
import { clsx } from 'clsx';

function fmtMoney(n: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 2 }).format(n);
}

/** Primary CTA — same skeu primary blue as “Open terminal”, with + for scanability */
function OpenAccountCta({
  href,
  label,
  className,
}: {
  href: string;
  label: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={clsx(
        'skeu-btn-buy inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3 sm:py-3.5 rounded-xl',
        'text-sm sm:text-base font-extrabold text-white',
        'transition-transform duration-200 active:scale-[0.99]',
        className,
      )}
    >
      <span className="text-xl leading-none font-semibold opacity-95" aria-hidden>
        +
      </span>
      {label}
    </Link>
  );
}

export default function TradingAccountPickerPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const accounts = useTradingStore((s) => s.accounts);
  const removeAccount = useTradingStore((s) => s.removeAccount);
  const [accountToDelete, setAccountToDelete] = useState<TradingAccount | null>(null);
  const [deleting, setDeleting] = useState(false);

  const visibleAccounts = useMemo(() => {
    if (user?.is_demo) {
      return accounts.filter((a) => a.is_demo);
    }
    return accounts;
  }, [accounts, user?.is_demo]);

  const startTrade = (id: string) => {
    setPersistedTradingAccountId(id);
    router.push(tradingTerminalUrl(id, { view: 'chart' }));
  };

  const isDemoUser = Boolean(user?.is_demo);

  const confirmDeleteAccount = async () => {
    if (!accountToDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/accounts/${accountToDelete.id}`);
      if (getPersistedTradingAccountId() === accountToDelete.id) {
        setPersistedTradingAccountId(null);
      }
      removeAccount(accountToDelete.id);
      toast.success('Trading account permanently deleted.');
      setAccountToDelete(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not delete account');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-bg-primary">
      <div className="page-main max-w-6xl mx-auto w-full py-6 sm:py-8 space-y-6">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-text-primary">Trading</h1>
          <p className="text-xs sm:text-sm text-text-tertiary mt-1">
            {isDemoUser
              ? 'You are on the shared demo profile — only your demo wallet is shown here. Open a live account with a real registration to trade funded accounts.'
              : 'Open a live account type from your broker, then launch the terminal.'}
          </p>
        </div>

        {visibleAccounts.length === 0 ? (
          <div className="rounded-2xl border-2 border-buy/30 bg-gradient-to-b from-buy/10 to-transparent p-8 sm:p-10 text-center space-y-5">
            <p className="text-sm sm:text-base text-text-secondary font-medium max-w-md mx-auto leading-relaxed">
              {isDemoUser
                ? 'No demo trading account is linked yet. Use Try with Demo again or contact support.'
                : 'You do not have a trading account yet. Choose a live account type (Standard, ECN, Islamic, etc.), then fund it to meet the minimum balance before placing orders.'}
            </p>
            {!isDemoUser ? (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-1">
                <OpenAccountCta href="/trading/open-account" label="Open account" />
              </div>
            ) : (
              <Link
                href="/dashboard"
                className="inline-block text-sm font-semibold text-buy hover:underline"
              >
                Back to dashboard
              </Link>
            )}
          </div>
        ) : (
          <ul className="space-y-3">
            {visibleAccounts.map((a) => {
              const g = a.account_group;
              return (
                <li
                  key={a.id}
                  className="rounded-xl border border-border-glass bg-bg-secondary overflow-hidden shadow-sm"
                >
                  <div className="p-4 sm:p-5 flex flex-col gap-5 w-full">
                    <div className="w-full min-w-0 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-bold text-text-primary">{a.account_number}</span>
                        <span
                          className={clsx(
                            'text-xxs font-bold uppercase px-2 py-0.5 rounded-full',
                            a.is_demo ? 'bg-warning/15 text-warning' : 'bg-buy/15 text-buy',
                          )}
                        >
                          {a.is_demo ? 'Demo' : 'Live'}
                        </span>
                        {g?.name ? (
                          <span className="text-xxs font-semibold text-text-secondary bg-bg-primary px-2 py-0.5 rounded-md border border-border-glass">
                            {g.name}
                          </span>
                        ) : null}
                      </div>
                      <div className="grid w-full grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        <div className="rounded-lg border border-border-glass/50 bg-bg-primary/40 px-3 py-2.5 min-h-[4.25rem]">
                          <div className="text-[10px] font-semibold uppercase tracking-wide text-text-tertiary">
                            Balance
                          </div>
                          <div className="mt-1 text-base sm:text-lg font-mono font-semibold tabular-nums text-text-primary">
                            {fmtMoney(a.balance, a.currency)}
                          </div>
                        </div>
                        <div className="rounded-lg border border-border-glass/50 bg-bg-primary/40 px-3 py-2.5 min-h-[4.25rem]">
                          <div className="text-[10px] font-semibold uppercase tracking-wide text-text-tertiary">
                            Leverage
                          </div>
                          <div className="mt-1 text-base font-mono font-semibold text-text-primary">
                            1:{a.leverage}
                          </div>
                        </div>
                        {g ? (
                          <>
                            <div className="rounded-lg border border-border-glass/50 bg-bg-primary/40 px-3 py-2.5 min-h-[4.25rem]">
                              <div className="text-[10px] font-semibold uppercase tracking-wide text-text-tertiary">
                                Spread markup
                              </div>
                              <div className="mt-1 text-base font-mono text-text-primary">
                                {g.spread_markup}
                              </div>
                            </div>
                            <div className="rounded-lg border border-border-glass/50 bg-bg-primary/40 px-3 py-2.5 min-h-[4.25rem]">
                              <div className="text-[10px] font-semibold uppercase tracking-wide text-text-tertiary">
                                Commission / lot
                              </div>
                              <div className="mt-1 text-base font-mono text-text-primary">
                                {g.commission_per_lot}
                              </div>
                            </div>
                            <div className="rounded-lg border border-border-glass/50 bg-bg-primary/40 px-3 py-2.5 min-h-[4.25rem]">
                              <div className="text-[10px] font-semibold uppercase tracking-wide text-text-tertiary">
                                Min. deposit
                              </div>
                              <div className="mt-1 text-base font-mono tabular-nums text-text-primary">
                                {fmtMoney(g.minimum_deposit, a.currency)}
                              </div>
                            </div>
                            {g.swap_free ? (
                              <div className="sm:col-span-2 lg:col-span-3 rounded-lg border border-buy/25 bg-buy/5 px-3 py-2.5 text-buy text-xs font-semibold">
                                Swap-free
                              </div>
                            ) : null}
                          </>
                        ) : (
                          <div className="sm:col-span-2 lg:col-span-3 text-xs text-text-tertiary/80 px-1 py-2">
                            Default pricing
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="w-full flex flex-col gap-3 border-t border-border-glass/60 pt-4">
                      <div className="flex flex-wrap gap-2">
                        {!a.is_demo ? (
                          <>
                            <Link
                              href={`/wallet?account=${encodeURIComponent(a.id)}`}
                              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-buy border border-buy/35 bg-buy/5 hover:bg-buy/10 transition-colors text-center min-h-[44px]"
                            >
                              Add funds
                            </Link>
                            <button
                              type="button"
                              onClick={() => setAccountToDelete(a)}
                              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-sell border border-sell/35 bg-sell/5 hover:bg-sell/10 transition-colors min-h-[44px]"
                            >
                              <Trash2 className="w-4 h-4 shrink-0" aria-hidden />
                              Delete account
                            </button>
                          </>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => startTrade(a.id)}
                          className="inline-flex flex-1 min-w-[140px] justify-center px-6 py-3 rounded-xl skeu-btn-buy text-white text-sm font-bold sm:flex-none sm:ml-auto"
                        >
                          Open terminal
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {visibleAccounts.length > 0 && !isDemoUser ? (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-2 border-t border-border-glass">
            <OpenAccountCta href="/trading/open-account" label="Open another account" className="w-full sm:w-auto" />
            <Link
              href="/dashboard"
              className="text-sm font-semibold text-buy hover:text-buy-light hover:underline text-center sm:text-right"
            >
              Dashboard
            </Link>
          </div>
        ) : visibleAccounts.length > 0 && isDemoUser ? (
          <p className="text-sm text-text-tertiary">
            <Link href="/dashboard" className="font-semibold text-buy hover:underline">
              Back to dashboard
            </Link>
          </p>
        ) : !isDemoUser ? (
          <p className="text-sm text-text-tertiary text-center sm:text-left">
            <Link href="/dashboard" className="font-semibold text-buy hover:underline">
              Back to dashboard
            </Link>
          </p>
        ) : null}
      </div>

      <Modal
        open={accountToDelete != null}
        onClose={() => !deleting && setAccountToDelete(null)}
        title="Delete trading account?"
        width="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-text-secondary leading-relaxed">
            This will <strong className="text-text-primary">permanently delete</strong> trading account{' '}
            <span className="font-mono font-bold text-text-primary">{accountToDelete?.account_number}</span>.
            Open positions must be closed, pending orders cleared, and balance and credit must be zero. This
            cannot be undone.
          </p>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
            <button
              type="button"
              disabled={deleting}
              onClick={() => setAccountToDelete(null)}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-border-glass bg-bg-secondary text-text-secondary hover:bg-bg-hover disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={deleting}
              onClick={() => void confirmDeleteAccount()}
              className="px-4 py-2.5 rounded-xl text-sm font-bold bg-sell text-white hover:opacity-95 disabled:opacity-50"
            >
              {deleting ? 'Deleting…' : 'Delete permanently'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
