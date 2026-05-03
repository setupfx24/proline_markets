'use client';

import { clsx } from 'clsx';
import type { TradingAccount } from '@/stores/tradingStore';

type Variant = 'default' | 'compact';

/**
 * Shows the trading account number, Live/Demo, and optional group name so users always know which wallet they are on.
 */
export function ActiveAccountBadge({
  account,
  variant = 'default',
  className,
}: {
  account: TradingAccount;
  variant?: Variant;
  className?: string;
}) {
  const g = account.account_group?.name;
  const compact = variant === 'compact';

  return (
    <div
      className={clsx(
        'flex flex-wrap items-center gap-1.5 sm:gap-2 min-w-0',
        compact ? 'text-[10px] sm:text-xs' : 'text-xs sm:text-sm',
        className,
      )}
      title={`Trading account ${account.account_number}${g ? ` — ${g}` : ''}`}
    >
      <span
        className={clsx(
          'font-bold uppercase tracking-wider text-text-tertiary shrink-0',
          compact ? 'text-[9px]' : 'text-[10px]',
        )}
      >
        Account
      </span>
      <span
        className={clsx(
          'font-mono font-extrabold text-text-primary tracking-tight truncate max-w-[9rem] sm:max-w-[12rem]',
          compact ? 'text-xs' : 'text-sm sm:text-base',
        )}
      >
        {account.account_number}
      </span>
      <span
        className={clsx(
          'font-extrabold uppercase rounded-full border shrink-0',
          compact ? 'text-[8px] px-1.5 py-0.5' : 'text-[9px] sm:text-[10px] px-2 py-0.5',
          account.is_demo
            ? 'bg-warning/15 text-warning border-warning/25'
            : 'bg-buy/12 text-buy border-buy/25',
        )}
      >
        {account.is_demo ? 'Demo' : 'Live'}
      </span>
      {g ? (
        <span
          className={clsx(
            'font-semibold text-text-secondary bg-bg-primary border border-border-glass rounded-md truncate max-w-[6rem] sm:max-w-[8rem]',
            compact ? 'text-[9px] px-1.5 py-0.5' : 'text-[10px] px-2 py-0.5',
          )}
        >
          {g}
        </span>
      ) : null}
    </div>
  );
}
