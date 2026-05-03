'use client';

import { cn } from '@/lib/utils';

type BadgeVariant = 'default' | 'buy' | 'sell' | 'success' | 'warning' | 'danger' | 'info';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-bg-hover text-text-secondary',
  buy: 'bg-buy/15 text-buy',
  sell: 'bg-sell/15 text-sell',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  danger: 'bg-danger/15 text-danger',
  info: 'bg-info/15 text-info',
};

export default function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center px-1.5 py-0.5 text-xxs font-medium rounded-sm',
      variantClasses[variant],
      className,
    )}>
      {children}
    </span>
  );
}
