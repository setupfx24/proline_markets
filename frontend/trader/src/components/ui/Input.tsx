'use client';

import { InputHTMLAttributes, forwardRef } from 'react';
import { clsx } from 'clsx';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  suffix?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, suffix, className, ...props }, ref) => (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-xs text-text-secondary font-medium tracking-wide uppercase">{label}</label>}
      <div className="relative group">
        {icon && (
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-tertiary group-focus-within:text-buy transition-colors duration-150">
            {icon}
          </div>
        )}
        <input
          ref={ref}
          className={clsx(
            'skeu-input w-full text-text-primary text-base rounded-xl',
            'py-3 px-4',
            icon && 'pl-11',
            suffix && 'pr-11',
            error && '!border-danger/50 focus:!shadow-[inset_0_2px_6px_rgba(0,0,0,0.5),0_0_0_3px_rgba(255,23,68,0.1)]',
            className
          )}
          {...props}
        />
        {suffix && (
          <div className="absolute right-3.5 top-1/2 z-10 -translate-y-1/2 text-text-tertiary pointer-events-auto">
            {suffix}
          </div>
        )}
      </div>
      {error && <span className="text-xxs text-danger pl-1">{error}</span>}
    </div>
  )
);
Input.displayName = 'Input';
