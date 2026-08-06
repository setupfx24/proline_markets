"""Seed historical OHLCV bars into Redis for all active instruments.

Run once (or on demand) to backfill chart history so the TradingView
Advanced Chart has candles to display immediately.

Usage (inside the market-data container):
    python -m src.seed_bars

Crypto symbols: fetches REAL historical klines from Binance public API.
Other symbols: generates simulated bars anchored to the current live price.
"""
import asyncio
import json
import logging
import math
import random
import time

import httpx

from packages.common.src.redis_client import redis_client

logger = logging.getLogger("seed-bars")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)-5s %(message)s")

TIMEFRAMES = {
    "1m": 60,
    "5m": 300,
    "15m": 900,
    "30m": 1800,
    "1h": 3600,
    "4h": 14400,
    "1d": 86400,
}

# Binance kline interval names
_TF_TO_BINANCE_INTERVAL: dict[str, str] = {
    "1m": "1m", "5m": "5m", "15m": "15m", "30m": "30m",
    "1h": "1h", "4h": "4h", "1d": "1d",
}

# Platform symbol → Binance REST pair
BINANCE_PAIRS: dict[str, str] = {
    "BTCUSD": "BTCUSDT", "ETHUSD": "ETHUSDT", "LTCUSD": "LTCUSDT",
    "XRPUSD": "XRPUSDT", "SOLUSD": "SOLUSDT", "BNBUSD": "BNBUSDT",
    "DOGEUSD": "DOGEUSDT", "ADAUSD": "ADAUSDT",
}

BARS_COUNT = 500

# Per-bar sigma at a 1-minute bar; _generate_bars scales it by sqrt(tf/60).
#
# Sized so a full 500-bar seed spans a plausible range for the asset rather than
# a plausible-looking single bar. Cumulative drift is ~sqrt(500) * sigma * sqrt(tf/60),
# i.e. ~50x sigma over 500 5-minute bars — so the old commodities value of 0.0015
# painted gold swinging 7-10% inside 41 hours. The chart then had to fit that
# range on the price scale, which squashed the real intraday movement into a
# flat line and made a live, ticking candle look frozen.
#
# Targets over a 500-bar seed: forex ~0.5%, commodities ~2%, indices ~1.5%,
# stocks ~2.5%. Crypto keeps the widest band but is academic — those symbols
# seed from real Binance klines and never reach this function.
VOLATILITY = {
    "forex": 0.0001,
    "crypto": 0.001,
    "indices": 0.0003,
    "commodities": 0.0004,
    "stocks": 0.0005,
}


def _guess_segment(symbol: str) -> str:
    s = symbol.upper()
    if s in BINANCE_PAIRS:
        return "crypto"
    if s in ("XAUUSD", "XAGUSD", "USOIL"):
        return "commodities"
    if s in ("US30", "US500", "NAS100", "UK100", "GER40"):
        return "indices"
    return "forex"


async def _fetch_binance_klines(symbol: str, tf_name: str, count: int = 500) -> list[dict]:
    """Fetch real historical klines from Binance public REST API."""
    pair = BINANCE_PAIRS.get(symbol.upper())
    if not pair:
        return []

    interval = _TF_TO_BINANCE_INTERVAL.get(tf_name, "5m")
    params = {"symbol": pair, "interval": interval, "limit": min(count, 1000)}

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get("https://api.binance.com/api/v3/klines", params=params)
            if resp.status_code != 200:
                logger.warning("Binance HTTP %s for %s %s", resp.status_code, symbol, tf_name)
                return []
            data = resp.json()
    except Exception as exc:
        logger.warning("Binance fetch failed for %s %s: %s", symbol, tf_name, exc)
        return []

    bars = []
    for k in data:
        bars.append({
            "time": int(k[0]) // 1000,  # open_time ms → epoch seconds
            "open": float(k[1]),
            "high": float(k[2]),
            "low": float(k[3]),
            "close": float(k[4]),
            "volume": float(k[5]),
            "tick_count": int(k[8]) if len(k) > 8 else 0,  # number of trades
        })

    return bars


def _generate_bars(base_price: float, segment: str, tf_seconds: int, count: int) -> list[dict]:
    """Simulated OHLCV bars whose NEWEST bar closes on `base_price`.

    The walk is built newest -> oldest and reversed at the end, so the bar that
    sits next to the live one carries the live price and history joins it
    seamlessly. Drift accumulates backwards into the past, which is what a real
    chart looks like.

    It used to run the other way: the OLDEST bar opened on base_price and the
    walk ran forward, leaving the NEWEST seeded bar wherever ~500 random steps
    happened to land — 6-7% adrift at these volatilities. The chart then drew a
    cliff between the seeded history and the live candle (gold history at 3,750
    while the tick said 4,242), which read as "the candles aren't moving": the
    price scale was stretched across a gap that dwarfed the real movement.
    """
    vol = VOLATILITY.get(segment, 0.001)
    bar_vol = vol * math.sqrt(tf_seconds / 60)

    now = int(time.time())
    bar_start = (now // tf_seconds) * tf_seconds

    bars = []
    close_p = base_price   # the newest bar closes exactly on the live price

    for i in range(1, count + 1):
        t = bar_start - i * tf_seconds

        # Step backwards through the bar: from its close to its open.
        moves = [close_p]
        for _ in range(4):
            moves.append(moves[-1] + random.gauss(0, bar_vol * 0.5) * close_p)
        open_p = moves[-1]

        high_p = max(moves) + abs(random.gauss(0, bar_vol * 0.2) * close_p)
        low_p = min(moves) - abs(random.gauss(0, bar_vol * 0.2) * close_p)
        high_p = max(high_p, open_p, close_p)
        low_p = min(low_p, open_p, close_p)

        bars.append({
            "time": t,
            "open": round(open_p, 6),
            "high": round(high_p, 6),
            "low": round(low_p, 6),
            "close": round(close_p, 6),
            "volume": round(random.uniform(10, 1000), 2),
            "tick_count": random.randint(5, 200),
        })

        # The previous (older) bar closes where this one opened, so consecutive
        # bars stay continuous instead of gapping.
        close_p = open_p

    # Caller LPUSHes in order and expects oldest-first, so the newest lands at
    # the head of the Redis list — the same end the aggregator pushes to.
    bars.reverse()
    return bars


async def seed(force: bool = False):
    """Read current prices from Redis and seed historical bars.

    For crypto symbols, fetches real bars from Binance.
    For other symbols, generates simulated bars from current price.
    """
    # Discover symbols from tick:* keys (available even before bar aggregation starts)
    symbols: set[str] = set()

    # Try bar:current keys first
    cursor = 0
    while True:
        cursor, keys = await redis_client.scan(cursor, match="bar:current:*:1m", count=200)
        for k in keys:
            parts = k.split(":")
            if len(parts) >= 3:
                symbols.add(parts[2])
        if cursor == 0:
            break

    # Also check tick:* keys (available sooner after startup)
    cursor = 0
    while True:
        cursor, keys = await redis_client.scan(cursor, match="tick:*", count=200)
        for k in keys:
            parts = k.split(":")
            if len(parts) >= 2:
                sym = parts[1].upper()
                if sym and len(sym) <= 10:
                    symbols.add(sym)
        if cursor == 0:
            break

    if not symbols:
        logger.warning("No symbols found in Redis. Is market-data running?")
        return

    logger.info("Found %d symbols: %s", len(symbols), ", ".join(sorted(symbols)))

    for sym in sorted(symbols):
        segment = _guess_segment(sym)
        is_crypto = sym in BINANCE_PAIRS

        # Get current price for non-crypto simulation
        mid = 0.0
        if not is_crypto:
            raw = await redis_client.get(f"tick:{sym}")
            if raw:
                try:
                    d = json.loads(raw)
                    mid = (float(d.get("bid", 0)) + float(d.get("ask", 0))) / 2
                except Exception:
                    pass
            if mid <= 0:
                raw = await redis_client.get(f"bar:current:{sym}:1m")
                if raw:
                    try:
                        d = json.loads(raw)
                        mid = (float(d.get("open", 0)) + float(d.get("close", 0))) / 2
                    except Exception:
                        pass
            if mid <= 0:
                logger.info("Skipping %s — no current price available", sym)
                continue

        logger.info("Seeding %s (segment=%s, source=%s)", sym, segment, "binance" if is_crypto else "simulated")

        for tf_name, tf_seconds in TIMEFRAMES.items():
            list_key = f"bars:{sym}:{tf_name}"

            if not force:
                existing = await redis_client.llen(list_key)
                if existing >= 100:
                    logger.info("  %s:%s already has %d bars, skipping", sym, tf_name, existing)
                    continue

            if is_crypto:
                bars = await _fetch_binance_klines(sym, tf_name, BARS_COUNT)
                if not bars:
                    logger.warning("  %s:%s Binance fetch returned 0 bars", sym, tf_name)
                    continue
            else:
                bars = _generate_bars(mid, segment, tf_seconds, BARS_COUNT)

            # Clear old data and write new bars
            pipe = redis_client.pipeline()
            pipe.delete(list_key)
            for bar in bars:
                bar["symbol"] = sym
                bar["timeframe"] = tf_name
                pipe.lpush(list_key, json.dumps(bar))
            pipe.ltrim(list_key, 0, 999)
            await pipe.execute()
            logger.info("  %s:%s → %d bars seeded", sym, tf_name, len(bars))

            # Small delay to avoid rate-limiting on Binance
            if is_crypto:
                await asyncio.sleep(0.2)

    logger.info("Done seeding all symbols.")


if __name__ == "__main__":
    asyncio.run(seed())
