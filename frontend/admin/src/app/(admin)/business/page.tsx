'use client';

import { cn } from '@/lib/utils';
import { Users, GitBranch, Network, ArrowRight } from 'lucide-react';
import Link from 'next/link';

const CARDS = [
  {
    title: 'IB Management',
    description: 'Manage Introducing Broker applications, commissions, and referral networks',
    icon: Users,
    href: '/business/ib',
    color: 'text-buy',
    bgColor: 'bg-buy/10',
    borderColor: 'border-buy/20',
  },
  {
    title: 'Sub-Broker Management',
    description: 'Manage sub-broker partnerships, payout structures, and performance tracking',
    icon: GitBranch,
    href: '/business/sub-broker',
    color: 'text-accent',
    bgColor: 'bg-accent/10',
    borderColor: 'border-accent/20',
  },
  {
    title: 'MLM Configuration',
    description: 'Configure multi-level marketing distribution levels and commission percentages',
    icon: Network,
    href: '/business/mlm',
    color: 'text-success',
    bgColor: 'bg-success/10',
    borderColor: 'border-success/20',
  },
];

export default function BusinessPage() {
  return (
    <>
      <div className="p-6 space-y-4">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Business</h1>
          <p className="text-xxs text-text-tertiary mt-0.5">IB, Sub-Broker, and MLM management</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {CARDS.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className={cn(
                'group bg-bg-secondary border border-border-primary rounded-md p-5',
                'transition-fast hover:border-border-secondary',
              )}
            >
              <div className={cn('inline-flex p-2.5 rounded-md mb-3', card.bgColor, card.borderColor, 'border')}>
                <card.icon size={18} className={card.color} />
              </div>
              <h2 className="text-sm font-semibold text-text-primary mb-1">{card.title}</h2>
              <p className="text-xxs text-text-tertiary leading-relaxed mb-4">{card.description}</p>
              <div className="flex items-center gap-1 text-xxs text-text-secondary group-hover:text-text-primary transition-fast">
                <span>Open</span>
                <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-fast" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
