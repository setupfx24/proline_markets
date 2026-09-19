import { Coins, Zap, Moon, LineChart, Crown, GraduationCap } from "lucide-react";

/**
 * AccountVisual — the picture for an account type (cards, detail heroes).
 *
 * Drawn in code rather than stock photos so every account gets its own
 * recognisable mark, stays crisp at any size and follows the light/dark
 * theme: an icon medallion over a price-chart motif in the brand palette,
 * with the account name and its headline numbers.
 */
const LOOK = {
  cent:          { Icon: Coins,         motif: "Start small",       hue: "32 55% 65%" },
  ecn:           { Icon: Zap,           motif: "Raw spreads",       hue: "45 90% 55%" },
  islamic:       { Icon: Moon,          motif: "Swap-free",         hue: "150 45% 45%" },
  standard:      { Icon: LineChart,     motif: "For every trader",  hue: "205 60% 55%" },
  "proline-vip": { Icon: Crown,         motif: "Elite",             hue: "40 85% 60%" },
  demo:          { Icon: GraduationCap, motif: "Practice",          hue: "265 45% 62%" },
};

// A fixed, hand-shaped price line so the art is identical on every render.
const LINE = "M0 150 L40 138 L70 146 L105 118 L140 126 L175 96 L210 104 L245 74 L280 82 L315 52 L350 60 L400 28";
const CANDLES = [
  [30, 120, 150, 128, 142], [80, 110, 146, 122, 140], [130, 96, 134, 104, 126],
  [180, 84, 120, 92, 110], [230, 66, 106, 76, 98], [280, 58, 94, 64, 86], [330, 40, 76, 48, 66],
];

export function AccountVisual({ acc, variant = "card", className = "" }) {
  const look = LOOK[acc.slug] ?? LOOK.standard;
  const { Icon } = look;
  const hero = variant === "hero";
  const accent = `hsl(${look.hue})`;
  const stats = [
    { k: "Spread", v: acc.spread },
    { k: "Leverage", v: acc.leverage?.replace(/^Up to\s*/i, "") },
    { k: "Deposit", v: acc.minDeposit },
  ];

  return (
    <div
      role="img"
      aria-label={`${acc.name} account`}
      className={`relative overflow-hidden rounded-2xl border border-border ${hero ? "min-h-[420px] p-8" : "h-44 p-5"} ${className}`}
      style={{
        background: `radial-gradient(120% 90% at 85% 0%, hsl(${look.hue} / 0.28), transparent 60%),
                     radial-gradient(90% 80% at 0% 100%, hsl(var(--terra) / 0.35), transparent 65%),
                     hsl(var(--card))`,
      }}
    >
      {/* chart motif */}
      <svg
        className="absolute inset-x-0 bottom-0 w-full h-[70%] opacity-60"
        viewBox="0 0 400 170"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={`fill-${acc.slug}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity="0.35" />
            <stop offset="100%" stopColor={accent} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[40, 80, 120, 160].map((y) => (
          <line key={y} x1="0" x2="400" y1={y} y2={y} stroke="currentColor" strokeOpacity="0.07" />
        ))}
        {CANDLES.map(([x, hi, lo, o, c]) => (
          <g key={x} stroke={accent} strokeOpacity="0.45">
            <line x1={x} x2={x} y1={hi} y2={lo} />
            <rect x={x - 5} y={Math.min(o, c)} width="10" height={Math.abs(c - o) || 2} fill={accent} fillOpacity="0.25" />
          </g>
        ))}
        <path d={`${LINE} L400 170 L0 170 Z`} fill={`url(#fill-${acc.slug})`} />
        <path d={LINE} fill="none" stroke={accent} strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
      </svg>

      <div className={`relative flex h-full ${hero ? "flex-col justify-between gap-10" : "items-start justify-between"}`}>
        <div className="flex items-center gap-3">
          <span
            className={`grid place-items-center rounded-full ${hero ? "size-20" : "size-12"}`}
            style={{ background: `hsl(${look.hue} / 0.18)`, boxShadow: `0 0 0 1px hsl(${look.hue} / 0.45), 0 0 40px hsl(${look.hue} / 0.35)` }}
          >
            <Icon className={hero ? "size-10" : "size-6"} style={{ color: accent }} strokeWidth={1.8} />
          </span>
          <div className="flex flex-col">
            {/* Cards already title the account right below the picture. */}
            {hero && (
              <span className="font-display uppercase tracking-tight leading-none text-4xl">
                {acc.name}
              </span>
            )}
            <span className={`font-body uppercase tracking-[0.2em] text-foreground/70 ${hero ? "text-[11px] mt-1" : "text-xs"}`}>
              {look.motif}
            </span>
          </div>
        </div>

        {hero && (
          <div className="grid grid-cols-3 gap-3">
            {stats.map((s) => (
              <div key={s.k} className="liquid-glass rounded-xl px-3 py-3 bg-background/60">
                <span className="block font-body text-[10px] uppercase tracking-wide text-foreground/55">{s.k}</span>
                <span className="block font-display text-base mt-0.5 truncate">{s.v}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
