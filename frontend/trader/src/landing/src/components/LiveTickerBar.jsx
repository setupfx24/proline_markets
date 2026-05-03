import { LIVE_TICKER } from "@/lib/forexData";
import { useLivePrices } from "@/hooks/useLivePrices";

export function LiveTickerBar() {
  const live = useLivePrices(LIVE_TICKER);
  const items = [...live, ...live];
  return (
    <div className="overflow-hidden border-b border-border bg-background/80 backdrop-blur-sm">
      <div
        className="flex w-max"
        style={{ animation: "var(--animate-marquee)" }}
      >
        {items.map((item, i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-6 py-2 border-r border-border shrink-0"
          >
            <span className="font-body text-xs font-medium text-foreground/90 tracking-wide">
              {item.pair}
            </span>
            <span className="font-display text-sm text-foreground tabular-nums">
              {item.price}
            </span>
            <span
              className={`font-body text-xs font-medium tabular-nums ${
                item.up ? "text-emerald-500" : "text-red-500"
              }`}
            >
              {item.change}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
