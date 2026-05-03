'use client';

import { useMemo, memo } from 'react';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import { useTradingStore } from '@/stores/tradingStore';
import { useUIStore } from '@/stores/uiStore';
import { toTradingViewSymbol } from '@/lib/tradingViewSymbols';

/**
 * Classic widgetembed iframe â€” avoids injecting TVâ€™s script into the DOM.
 * That pattern breaks under React Strict Mode (double mount): cleanup removes the node
 * while TradingView still touches iframe.contentWindow â†’ console error + blank chart.
 */
function buildWidgetEmbedUrl(
  symbol: string,
  theme: 'Dark' | 'Light',
  interval: string,
): string {
  const tvSymbol = toTradingViewSymbol(symbol);
  const params = new URLSearchParams({
    frameElementId: 'pt_tradingview_chart',
    symbol: tvSymbol,
    interval,
    hidesidetoolbar: '0',
    hidetoptoolbar: '0',
    symboledit: '0',
    saveimage: '1',
    toolbarbg: theme === 'Dark' ? '131722' : 'f1f3f6',
    studies: '[]',
    hideideas: '1',
    theme,
    style: '1',
    timezone: 'Etc/UTC',
    studies_overrides: '{}',
    overrides: '{}',
    enabled_features: '[]',
    disabled_features: '[]',
    locale: 'en',
    utm_source: typeof window !== 'undefined' ? window.location.hostname || 'ProlineMarkets' : 'ProlineMarkets',
    utm_medium: 'widget',
    utm_campaign: 'chart',
    utm_term: tvSymbol,
    withdateranges: '1',
  });
  return `https://www.tradingview.com/widgetembed/?${params.toString()}`;
}

function TradingViewChartInner() {
  const pathname = usePathname();
  const selectedSymbol = useTradingStore((s) => s.selectedSymbol);
  const theme = useUIStore((s) => s.theme);
  const onTradingTerminal = Boolean(pathname?.startsWith('/trading/terminal'));
  const tvTheme: 'Dark' | 'Light' = theme === 'light' ? 'Light' : 'Dark';
  const interval = onTradingTerminal ? '5' : '15';

  const src = useMemo(
    () => buildWidgetEmbedUrl(selectedSymbol ?? 'EURUSD', tvTheme, interval),
    [selectedSymbol, tvTheme, interval],
  );

  const surface = tvTheme === 'Light' ? 'bg-bg-base' : 'bg-[#0e0e0e]';

  return (
    <div className={clsx('w-full h-full min-h-[200px] min-w-0', surface)} data-tv-chart-root>
      <iframe
        key={src}
        title={`Chart ${selectedSymbol || 'EURUSD'}`}
        src={src}
        className={clsx('h-full w-full min-h-[200px] border-0', surface)}
        allow="clipboard-write; fullscreen"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </div>
  );
}

export default memo(TradingViewChartInner);
