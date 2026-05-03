'use client';

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';

interface DropdownOption {
  value: string;
  label: string;
}

interface DropdownProps {
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  className?: string;
}

export default function Dropdown({ options, value, onChange, label, placeholder, className }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const selected = options.find(o => o.value === value);

  return (
    <div ref={ref} className={cn('relative', className)}>
      {label && <label className="text-xs text-text-secondary font-medium block mb-1">{label}</label>}
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'w-full flex items-center justify-between bg-bg-input border border-border-primary rounded-sm px-3 py-2 text-sm',
          'text-text-primary transition-fast focus-ring',
          open && 'border-buy',
        )}
      >
        <span className={selected ? '' : 'text-text-tertiary'}>
          {selected?.label || placeholder || 'Select...'}
        </span>
        <ChevronDown size={14} className={cn('text-text-tertiary transition-fast', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-bg-tertiary border border-border-primary rounded-sm shadow-dropdown z-50 animate-slide-down max-h-48 overflow-y-auto">
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={cn(
                'w-full text-left px-3 py-2 text-sm transition-fast',
                opt.value === value
                  ? 'text-buy bg-buy/10'
                  : 'text-text-primary hover:bg-bg-hover',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
