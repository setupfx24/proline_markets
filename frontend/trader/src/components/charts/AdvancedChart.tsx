'use client';

import { useEffect, useRef, memo, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import { useTradingStore } from '@/stores/tradingStore';
import { useUIStore } from '@/stores/uiStore';
import { ProlineMarketsDatafeed } from '@/lib/charting/datafeed';
import { createBroker } from '@/lib/charting/broker';

/**
 * Loads the charting_library standalone script once, resolves when window.TradingView
 * is available.
 */
let scriptPromise: Promise<void> | null = null;
function loadChartingLib(): Promise<void> {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    if ((window as any).TradingView?.widget) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = '/charting_library/charting_library.standalone.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load charting library'));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

function AdvancedChartInner() {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<any>(null);
  const pathname = usePathname();

  const selectedSymbol = useTradingStore((s) => s.selectedSymbol);
  const setSelectedSymbol = useTradingStore((s) => s.setSelectedSymbol);
  const theme = useUIStore((s) => s.theme);

  const onTradingTerminal = Boolean(pathname?.startsWith('/trading/terminal'));
  const tvTheme = theme === 'light' ? 'light' : 'dark';
  const interval = onTradingTerminal ? '5' : '15';
  const symbol = selectedSymbol || 'XAUUSD';

  // Track what the widget was created with â€” only recreate on theme/interval change, NOT symbol
  const createdWithRef = useRef({ theme: '', interval: '' });
  const chartReadyRef = useRef(false);
  const symbolRef = useRef(symbol);
  symbolRef.current = symbol;

  /** Create or recreate the widget (only on mount or theme change). */
  const createWidget = useCallback(async () => {
    if (!containerRef.current) return;

    // Skip recreation if only symbol changed â€” handled by setSymbol() below
    if (
      widgetRef.current &&
      createdWithRef.current.theme === tvTheme &&
      createdWithRef.current.interval === interval
    ) {
      return;
    }

    // Remove previous widget
    if (widgetRef.current) {
      try { widgetRef.current.remove(); } catch {}
      widgetRef.current = null;
      chartReadyRef.current = false;
    }

    await loadChartingLib();

    const TV = (window as any).TradingView;
    if (!TV?.widget || !containerRef.current) return;

    const w = new TV.widget({
      container: containerRef.current,
      locale: 'en',
      library_path: '/charting_library/',
      datafeed: ProlineMarketsDatafeed,
      symbol: symbolRef.current,
      interval,
      timezone: 'Etc/UTC',
      theme: tvTheme as 'dark' | 'light',
      fullscreen: false,
      autosize: true,
      debug: false,

      // Trading Terminal â€” built-in order panel
      broker_factory: (host: any) => createBroker(host),

      disabled_features: [
        'use_localstorage_for_settings',
        'header_compare',
        'header_symbol_search',
        'display_market_status',
        'popup_hints',
      ],
      enabled_features: [
        'study_templates',
        'side_toolbar_in_fullscreen_mode',
        'trading_notifications',
        'show_trading_notifications_history',
        'pinch_scale',
        'horz_touch_drag_scroll',
        'vert_touch_drag_scroll',
      ],
      overrides: {
        'mainSeriesProperties.style': 1, // candles
        'mainSeriesProperties.candleStyle.upColor': '#26a69a',
        'mainSeriesProperties.candleStyle.downColor': '#ef5350',
        'mainSeriesProperties.candleStyle.borderUpColor': '#26a69a',
        'mainSeriesProperties.candleStyle.borderDownColor': '#ef5350',
        'mainSeriesProperties.candleStyle.wickUpColor': '#26a69a',
        'mainSeriesProperties.candleStyle.wickDownColor': '#ef5350',
        'paneProperties.background': tvTheme === 'dark' ? '#0d0d0d' : '#ffffff',
        'paneProperties.backgroundType': 'solid',
        'scalesProperties.textColor': tvTheme === 'dark' ? '#aaaaaa' : '#555555',
        'scalesProperties.backgroundColor': tvTheme === 'dark' ? '#0d0d0d' : '#ffffff',
      },
      loading_screen: {
        backgroundColor: tvTheme === 'dark' ? '#0e0e0e' : '#f2efe9',
        foregroundColor: tvTheme === 'dark' ? '#2962FF' : '#2962FF',
      },
    });

    widgetRef.current = w;
    createdWithRef.current = { theme: tvTheme, interval };

    // Listen for symbol changes from within the chart
    w.onChartReady(() => {
      chartReadyRef.current = true;
      w.activeChart().onSymbolChanged().subscribe(null, () => {
        const newSym = w.activeChart().symbol();
        if (newSym) {
          const cleaned = newSym.includes(':') ? newSym.split(':').pop()! : newSym;
          if (cleaned.toUpperCase() !== (selectedSymbol || '').toUpperCase()) {
            setSelectedSymbol(cleaned.toUpperCase());
          }
        }
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tvTheme, interval, setSelectedSymbol]);

  // Mount / recreate only on theme or interval change
  useEffect(() => {
    createWidget();
    return () => {
      if (widgetRef.current) {
        try { widgetRef.current.remove(); } catch {}
        widgetRef.current = null;
        chartReadyRef.current = false;
      }
    };
  }, [createWidget]);

  // Fast symbol switch â€” just call setSymbol(), no widget recreation
  const prevSymbolRef = useRef(symbol);
  useEffect(() => {
    if (symbol !== prevSymbolRef.current) {
      prevSymbolRef.current = symbol;
      const w = widgetRef.current;
      if (w && chartReadyRef.current) {
        try {
          const current = w.activeChart().symbol();
          const currentClean = current?.includes(':') ? current.split(':').pop() : current;
          if ((currentClean || '').toUpperCase() !== symbol.toUpperCase()) {
            w.activeChart().setSymbol(symbol);
          }
        } catch {}
      } else if (w) {
        // Widget exists but not ready yet â€” wait for it
        w.onChartReady(() => {
          chartReadyRef.current = true;
          try { w.activeChart().setSymbol(symbol); } catch {}
        });
      }
    }
  }, [symbol]);

  const surface = tvTheme === 'light' ? 'bg-bg-base' : 'bg-[#0e0e0e]';

  return (
    <div
      ref={containerRef}
      className={clsx('w-full h-full min-h-[200px] min-w-0', surface)}
      style={{ touchAction: 'none' }}
      onWheel={(e) => e.stopPropagation()}
      data-tv-chart-root
    />
  );
}

export default memo(AdvancedChartInner);
