'use client';

import { clsx } from 'clsx';

interface Tab {
  id: string;
  label: string;
  count?: number;
}

interface TabsProps {
  tabs: Tab[];
  active: string;
  onChange: (tabId: string) => void;
  className?: string;
}

export function Tabs({ tabs, active, onChange, className }: TabsProps) {
  return (
    <div className={clsx('flex items-center border-b border-border-glass', className)}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={clsx(
            'px-3 py-2 text-xs font-medium transition-fast relative',
            active === tab.id
              ? 'text-buy'
              : 'text-text-secondary hover:text-text-primary',
          )}
        >
          {tab.label}
          {tab.count !== undefined && tab.count > 0 && (
            <span className="ml-1 px-1 py-0.5 text-xxs bg-bg-hover rounded-sm tabular-nums">
              {tab.count}
            </span>
          )}
          {active === tab.id && (
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-buy" />
          )}
        </button>
      ))}
    </div>
  );
}

export default Tabs;
