import { useEffect } from 'react';
import { useTradingStore } from '@/stores/tradingStore';
import { BRAND_NAME } from '@/lib/brand';

/**
 * Updates the browser tab title with the selected symbol and live price,
 * e.g. "â–² XAUUSD 4,757.37 | ProlineMarkets". Restores original title on unmount.
 */
export function useDocumentTitle() {
  const selectedSymbol = useTradingStore((s) => s.selectedSymbol);
  const tick = useTradingStore((s) => s.prices[s.selectedSymbol]);
  const prevBid = useTradingStore((s) => s.prevPrices[s.selectedSymbol]);
  const instruments = useTradingStore((s) => s.instruments);

  useEffect(() => {
    const original = BRAND_NAME;

    if (!selectedSymbol) {
      document.title = original;
      return;
    }

    const inst = instruments.find((i) => i.symbol === selectedSymbol);
    const digits = inst?.digits ?? 2;

    if (!tick) {
      document.title = `${selectedSymbol} | ${original}`;
      return;
    }

    const price = tick.bid.toFixed(digits);
    let arrow = '';
    if (prevBid !== undefined) {
      if (tick.bid > prevBid) arrow = 'â–² ';
      else if (tick.bid < prevBid) arrow = 'â–¼ ';
    }

    document.title = `${arrow}${selectedSymbol} ${price} | ${original}`;

    return () => {
      document.title = original;
    };
  }, [selectedSymbol, tick, prevBid, instruments]);
}
