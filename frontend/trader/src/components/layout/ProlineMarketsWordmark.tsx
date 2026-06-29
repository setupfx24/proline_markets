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
        <img src="/images/logo1.png" alt="ProlineMarketsFX" draggable={false} className="w-7 h-7 object-contain" />
      </Link>
    );
  }

  const mark = (
    <span className={cn('inline-flex items-center select-none', className)}>
      <img src="/images/logowhite.png" alt="Proline Markets" draggable={false} className="h-9 sm:h-11 w-auto object-contain shrink-0" />
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
