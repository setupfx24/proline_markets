'use client';

import { clsx } from 'clsx';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'glass' | 'skeu' | 'flat';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const cardVariants = {
  glass: 'glass-card rounded-xl',
  skeu: 'skeu-surface rounded-xl',
  flat: 'bg-bg-secondary border border-border-primary rounded-xl',
};

const paddings = { none: '', sm: 'p-3', md: 'p-4', lg: 'p-5' };

export function Card({ children, className, variant = 'glass', padding = 'md' }: CardProps) {
  return (
    <div className={clsx(cardVariants[variant], paddings[padding], 'relative', className)}>
      {children}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  subValue?: string;
  trend?: 'up' | 'down' | 'neutral';
  className?: string;
}

export function StatCard({ label, value, subValue, trend, className }: StatCardProps) {
  return (
    <Card variant="glass" padding="none" className={clsx('noise-texture overflow-hidden p-2.5 sm:p-3 md:p-4', className)}>
      <div className="relative z-10 min-w-0">
        <div className="text-[10px] sm:text-xs text-text-secondary mb-1 leading-tight line-clamp-2">{label}</div>
        <div className={clsx(
          'text-base sm:text-lg md:text-xl font-bold tabular-nums font-mono leading-tight break-words',
          trend === 'up' ? 'text-buy' : trend === 'down' ? 'text-sell' : 'text-text-primary'
        )}>
          {value}
        </div>
        {subValue && (
          <div className="text-[9px] sm:text-xxs text-text-tertiary mt-1 leading-snug line-clamp-2 break-words">
            {subValue}
          </div>
        )}
      </div>
    </Card>
  );
}
