import { cn } from '@/lib/utils';

// The Proline logo has white ink for dark mode and dark ink for light mode;
// the old single logo.png was white-on-transparent and vanished on the light
// theme. Both images render and the `dark` class on <html> picks one.
export default function BrandLogo({ variant = 'wordmark', className }: { variant?: 'wordmark' | 'mark'; className?: string }) {
  const base = variant === 'mark' ? '/logo-mark' : '/logo-wordmark';
  return (
    <>
      <img src={`${base}-dark.png`} alt="Proline Markets" className={cn('object-contain dark:hidden', className)} />
      <img src={`${base}-white.png`} alt="Proline Markets" className={cn('object-contain hidden dark:block', className)} />
    </>
  );
}
