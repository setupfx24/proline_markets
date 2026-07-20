import Link from 'next/link';
import { cn } from '@/lib/utils';

type Props = {
  href?: string;
  className?: string;
  /** Applied to the wordmark text (e.g. responsive sizes). */
  textClassName?: string;
  /** Default: sidebar / header. Rail: tiny terminal left bar. */
  variant?: 'default' | 'rail';
  /** Render as plain branding with no link — used in the terminal-only
   *  installed app, where there is nowhere for it to navigate to. */
  static?: boolean;
};

/**
 * Text wordmark for dashboard chrome (replaces raster logo).
 */
export function ProlineMarketsWordmark({
  href = '/dashboard',
  className,
  textClassName,
  variant = 'default',
  static: isStatic = false,
}: Props) {
  if (variant === 'rail') {
    const logo = (
      <img src="/images/logo1.png" alt="ProlineMarketsFX" className="w-7 h-7 object-contain" />
    );
    const railClass = cn(
      'flex items-center justify-center rounded-md w-9 h-9 transition-colors',
      !isStatic && 'hover:bg-bg-hover',
      'focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-[#22c55e]',
      className,
    );

    if (isStatic) return <div className={railClass}>{logo}</div>;

    return (
      <Link href={href} title="Trading home" className={railClass}>
        {logo}
      </Link>
    );
  }

  const mark = (
    <span className={cn('inline-flex items-center select-none', className)}>
      <img
        src="/images/logo1.png"
        alt="ProlineMarketsFX"
        className="h-8 sm:h-9 lg:h-11 w-auto object-contain shrink-0"
      />
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
