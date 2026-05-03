import Link from 'next/link';
import { cn } from '@/lib/utils';

type Props = {
  href?: string;
  className?: string;
  /** Applied to the wordmark text (e.g. responsive sizes). */
  textClassName?: string;
  /** Default: sidebar / header. Rail: tiny terminal left bar. */
  variant?: 'default' | 'rail';
};

/**
 * Text wordmark for dashboard chrome (replaces raster logo).
 */
export function ProlineMarketsWordmark({
  href = '/dashboard',
  className,
  textClassName,
  variant = 'default',
}: Props) {
  if (variant === 'rail') {
    return (
      <Link
        href={href}
        title="Trading home"
        className={cn(
          'flex items-center justify-center rounded-md hover:bg-bg-hover w-9 h-9 transition-colors',
          'focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-[#22c55e]',
          className,
        )}
      >
        <img src="/images/logo1.png" alt="ProlineMarketsFX" className="w-7 h-7 object-contain" />
      </Link>
    );
  }

  const mark = (
    <span className={cn('inline-flex items-center gap-2 select-none', className)}>
      <img src="/images/logo1.png" alt="ProlineMarketsFX" className="w-8 h-8 object-contain shrink-0" />
      <span
        className={cn(
          'inline-flex items-baseline font-bold italic tracking-tight',
          'text-xl sm:text-2xl drop-shadow-[0_0_20px_rgba(34,197,94,0.12)]',
          textClassName,
        )}
      >
        <span className="text-text-primary">Trust</span>
        <span className="text-[#22c55e]">Edge</span>
      </span>
    </span>
  );

  return (
    <Link
      href={href}
      className={cn(
        'min-w-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#22c55e]/60 focus-visible:rounded-md',
        className,
      )}
    >
      {mark}
    </Link>
  );
}
