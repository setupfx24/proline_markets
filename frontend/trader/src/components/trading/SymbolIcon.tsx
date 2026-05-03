'use client';

import { useState } from 'react';
import { clsx } from 'clsx';

/* Aliases for tickers whose base in the trading platform differs from the
   conventional code used by icon libraries (e.g. "DOG" on our feed vs "doge"). */
const CRYPTO_ALIAS: Record<string, string> = {
  DOG: 'doge',
  LNK: 'link',
  DOGE: 'doge',
  SHIB: 'shib',
  MATIC: 'matic',
};

/* ISO 3-letter currency → 2-letter country for flagcdn. */
const CURRENCY_CC: Record<string, string> = {
  USD: 'us',
  EUR: 'eu',
  GBP: 'gb',
  JPY: 'jp',
  AUD: 'au',
  CAD: 'ca',
  CHF: 'ch',
  NZD: 'nz',
  CNH: 'cn',
  CNY: 'cn',
  HKD: 'hk',
  SGD: 'sg',
  SEK: 'se',
  NOK: 'no',
  DKK: 'dk',
  MXN: 'mx',
  ZAR: 'za',
  TRY: 'tr',
  PLN: 'pl',
  INR: 'in',
  KRW: 'kr',
  TWD: 'tw',
  THB: 'th',
  BRL: 'br',
  RUB: 'ru',
};

/* Index ticker → 2-letter country. */
const INDEX_CC: Record<string, string> = {
  US30: 'us',
  US500: 'us',
  SPX500: 'us',
  US100: 'us',
  NAS100: 'us',
  NDX: 'us',
  DJI: 'us',
  UK100: 'gb',
  FTSE100: 'gb',
  GER40: 'de',
  DE40: 'de',
  DAX40: 'de',
  FR40: 'fr',
  CAC40: 'fr',
  ESP35: 'es',
  ITA40: 'it',
  JP225: 'jp',
  JPN225: 'jp',
  NIK225: 'jp',
  HK50: 'hk',
  HSI: 'hk',
  CHINA50: 'cn',
  CHN50: 'cn',
  AUS200: 'au',
  ASX200: 'au',
  INDIA50: 'in',
};

/* Commodity / metal fallback styles. */
const METAL_COMMODITY: Record<string, { letter: string; gradient: string; textColor?: string }> = {
  XAUUSD: { letter: 'Au', gradient: 'from-amber-300 to-yellow-600', textColor: 'text-black' },
  XAGUSD: { letter: 'Ag', gradient: 'from-slate-200 to-slate-400', textColor: 'text-black' },
  XPTUSD: { letter: 'Pt', gradient: 'from-slate-300 to-slate-500', textColor: 'text-black' },
  XPDUSD: { letter: 'Pd', gradient: 'from-zinc-300 to-zinc-500', textColor: 'text-black' },
  USOIL: { letter: 'Oil', gradient: 'from-zinc-800 to-black', textColor: 'text-white' },
  UKOIL: { letter: 'Oil', gradient: 'from-zinc-800 to-black', textColor: 'text-white' },
  WTI: { letter: 'WTI', gradient: 'from-zinc-800 to-black', textColor: 'text-white' },
  BRENT: { letter: 'Br', gradient: 'from-zinc-800 to-black', textColor: 'text-white' },
  NATGAS: { letter: 'NG', gradient: 'from-sky-500 to-blue-700', textColor: 'text-white' },
  COPPER: { letter: 'Cu', gradient: 'from-orange-500 to-amber-700', textColor: 'text-white' },
};

/* Fallback gradient keyed by first char — keeps colors stable across re-renders. */
function fallbackGradient(symbol: string): string {
  const gradients = [
    'from-slate-500 to-slate-700',
    'from-indigo-500 to-purple-700',
    'from-emerald-500 to-teal-700',
    'from-rose-500 to-pink-700',
    'from-orange-500 to-red-700',
    'from-sky-500 to-blue-700',
    'from-violet-500 to-fuchsia-700',
    'from-lime-500 to-emerald-700',
  ];
  let hash = 0;
  for (let i = 0; i < symbol.length; i++) hash = (hash * 31 + symbol.charCodeAt(i)) >>> 0;
  return gradients[hash % gradients.length];
}

type IconKind =
  | { kind: 'crypto'; url: string }
  | { kind: 'forex'; leftCc: string; rightCc: string }
  | { kind: 'index'; cc: string }
  | { kind: 'letters'; letter: string; gradient: string; textColor: string };

function resolve(symbol: string): IconKind {
  const s = symbol.toUpperCase();

  /* Metal/commodity first — otherwise "XAUUSD" would look like forex. */
  const mc = METAL_COMMODITY[s];
  if (mc) return { kind: 'letters', letter: mc.letter, gradient: mc.gradient, textColor: mc.textColor || 'text-white' };

  /* Crypto: ends with USD/USDT/USDC → base ticker (3-5 chars) likely has an
     icon in the cryptocurrency-icons repo served via jsDelivr. */
  const cryptoMatch = s.match(/^([A-Z]{2,6})(USDT|USDC|USD)$/);
  if (cryptoMatch) {
    const rawBase = cryptoMatch[1];
    const base = (CRYPTO_ALIAS[rawBase] || rawBase).toLowerCase();
    return {
      kind: 'crypto',
      url: `https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/128/color/${base}.png`,
    };
  }

  /* Forex 6-char pair (ABC+DEF) where both halves are known currencies. */
  if (s.length === 6) {
    const a = CURRENCY_CC[s.slice(0, 3)];
    const b = CURRENCY_CC[s.slice(3, 6)];
    if (a && b) return { kind: 'forex', leftCc: a, rightCc: b };
  }

  /* Index. */
  const idxCc = INDEX_CC[s];
  if (idxCc) return { kind: 'index', cc: idxCc };

  /* Fallback: gradient + first 1-2 letters. */
  return {
    kind: 'letters',
    letter: s.slice(0, 2),
    gradient: fallbackGradient(s),
    textColor: 'text-white',
  };
}

interface SymbolIconProps {
  symbol: string;
  size?: number;
  className?: string;
}

export default function SymbolIcon({ symbol, size = 20, className }: SymbolIconProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const info = resolve(symbol);

  const wrapperStyle = { width: size, height: size };

  if (info.kind === 'crypto' && !imgFailed) {
    return (
      <img
        src={info.url}
        alt={symbol}
        width={size}
        height={size}
        loading="lazy"
        onError={() => setImgFailed(true)}
        className={clsx('rounded-full bg-bg-tertiary object-contain shrink-0', className)}
        style={wrapperStyle}
      />
    );
  }

  if (info.kind === 'forex' && !imgFailed) {
    const small = Math.round(size * 0.72);
    return (
      <div
        className={clsx('relative shrink-0', className)}
        style={wrapperStyle}
        aria-label={symbol}
      >
        <img
          src={`https://flagcdn.com/${info.leftCc}.svg`}
          alt=""
          width={small}
          height={small}
          loading="lazy"
          onError={() => setImgFailed(true)}
          className="absolute left-0 top-0 rounded-full object-cover ring-1 ring-bg-tertiary"
          style={{ width: small, height: small }}
        />
        <img
          src={`https://flagcdn.com/${info.rightCc}.svg`}
          alt=""
          width={small}
          height={small}
          loading="lazy"
          onError={() => setImgFailed(true)}
          className="absolute right-0 bottom-0 rounded-full object-cover ring-1 ring-bg-tertiary"
          style={{ width: small, height: small }}
        />
      </div>
    );
  }

  if (info.kind === 'index' && !imgFailed) {
    return (
      <img
        src={`https://flagcdn.com/${info.cc}.svg`}
        alt={symbol}
        width={size}
        height={size}
        loading="lazy"
        onError={() => setImgFailed(true)}
        className={clsx('rounded-full object-cover shrink-0 ring-1 ring-bg-tertiary', className)}
        style={wrapperStyle}
      />
    );
  }

  /* Letters tile / final fallback. */
  const fallback = info.kind === 'letters' ? info : {
    letter: symbol.slice(0, 2).toUpperCase(),
    gradient: fallbackGradient(symbol),
    textColor: 'text-white',
  };

  return (
    <div
      className={clsx(
        'rounded-full bg-gradient-to-br flex items-center justify-center font-bold shrink-0',
        fallback.gradient,
        fallback.textColor,
        className,
      )}
      style={{ ...wrapperStyle, fontSize: Math.max(8, Math.round(size * 0.42)) }}
      aria-label={symbol}
    >
      {fallback.letter}
    </div>
  );
}
