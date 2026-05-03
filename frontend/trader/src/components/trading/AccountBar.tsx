'use client';

import { useTradingStore } from '@/stores/tradingStore';
import { cn } from '@/lib/utils';
import Badge from '@/components/ui/Badge';

export default function AccountBar() {
  const { activeAccount, positions } = useTradingStore();

  if (!activeAccount) {
    return (
      <div className="flex items-center h-7 px-3 bg-bg-primary border-b border-border-primary text-xxs text-text-tertiary">
        No account selected
      </div>
    );
  }

  const totalPnl = positions.reduce((sum, p) => sum + (p.profit || 0), 0);
  const equity = activeAccount.balance + activeAccount.credit + totalPnl;

  const items = [
    { label: 'Balance', value: `$${activeAccount.balance.toFixed(2)}` },
    { label: 'Equity', value: `$${equity.toFixed(2)}`, color: equity >= activeAccount.balance ? 'text-buy' : 'text-sell' },
    { label: 'Margin', value: `$${activeAccount.margin_used.toFixed(2)}` },
    { label: 'Free', value: `$${(equity - activeAccount.margin_used).toFixed(2)}` },
    { label: 'Level', value: activeAccount.margin_used > 0 ? `${((equity / activeAccount.margin_used) * 100).toFixed(1)}%` : '--' },
    { label: 'P&L', value: `${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}`, color: totalPnl >= 0 ? 'text-buy' : 'text-sell' },
    { label: 'Leverage', value: `1:${activeAccount.leverage}` },
  ];

  return null;
}
