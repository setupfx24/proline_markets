"""Feed Handler — Infoway (see `infoway_feed`) when `INFOWAY_API_KEY` is set.

Fallback (no API key): Binance for crypto + GBM simulator for other symbols.
"""

import asyncio
import json
import logging
import math
import random
import time
from datetime import datetime, timezone
from typing import Dict, List, Optional

import websockets

from packages.common.src.redis_client import redis_client

logger = logging.getLogger("market-data.feed")

BINANCE_WS = "wss://stream.binance.com:9443/ws"
BINANCE_MAP = {
    "btcusdt": "BTCUSD",
    "ethusdt": "ETHUSD",
    "ltcusdt": "LTCUSD",
    "xrpusdt": "XRPUSD",
    "solusdt": "SOLUSD",
}
LIVE_CRYPTO_SYMBOLS = set(BINANCE_MAP.values())

INSTRUMENTS: Dict[str, dict] = {
    "EURUSD":  {"base_price": 1.0845,   "category": "forex_major", "pip": 0.0001,  "decimals": 5},
    "GBPUSD":  {"base_price": 1.2650,   "category": "forex_major", "pip": 0.0001,  "decimals": 5},
    "USDJPY":  {"base_price": 149.50,   "category": "forex_major", "pip": 0.01,    "decimals": 3},
    "AUDUSD":  {"base_price": 0.6580,   "category": "forex_major", "pip": 0.0001,  "decimals": 5},
    "USDCAD":  {"base_price": 1.3650,   "category": "forex_major", "pip": 0.0001,  "decimals": 5},
    "USDCHF":  {"base_price": 0.8820,   "category": "forex_major", "pip": 0.0001,  "decimals": 5},
    "NZDUSD":  {"base_price": 0.6120,   "category": "forex_minor", "pip": 0.0001,  "decimals": 5},
    "EURGBP":  {"base_price": 0.8575,   "category": "forex_minor", "pip": 0.0001,  "decimals": 5},
    "EURJPY":  {"base_price": 162.10,   "category": "forex_minor", "pip": 0.01,    "decimals": 3},
    "GBPJPY":  {"base_price": 189.20,   "category": "forex_minor", "pip": 0.01,    "decimals": 3},
    "XAUUSD":  {"base_price": 2650.50,  "category": "commodity",   "pip": 0.01,    "decimals": 2},
    "XAGUSD":  {"base_price": 31.25,    "category": "commodity",   "pip": 0.001,   "decimals": 3},
    "USOIL":   {"base_price": 78.50,    "category": "commodity",   "pip": 0.01,    "decimals": 2},
    "US30":    {"base_price": 39250.0,  "category": "index",       "pip": 0.1,     "decimals": 1},
    "US500":   {"base_price": 5180.0,   "category": "index",       "pip": 0.01,    "decimals": 2},
    "NAS100":  {"base_price": 18250.0,  "category": "index",       "pip": 0.1,     "decimals": 1},
    "UK100":   {"base_price": 8150.0,   "category": "index",       "pip": 0.1,     "decimals": 1},
    "GER40":   {"base_price": 17850.0,  "category": "index",       "pip": 0.1,     "decimals": 1},
    "BTCUSD":  {"base_price": 67500.0,  "category": "crypto",      "pip": 0.01,    "decimals": 2},
    "ETHUSD":  {"base_price": 3450.0,   "category": "crypto",      "pip": 0.01,    "decimals": 2},
    "LTCUSD":  {"base_price": 95.0,     "category": "crypto",      "pip": 0.01,    "decimals": 2},
    "XRPUSD":  {"base_price": 0.52,     "category": "crypto",      "pip": 0.0001,  "decimals": 4},
    "SOLUSD":  {"base_price": 145.0,    "category": "crypto",      "pip": 0.01,    "decimals": 2},
    "EURCHF":  {"base_price": 0.9340,   "category": "forex_minor", "pip": 0.0001,  "decimals": 5},
    "GBPCHF":  {"base_price": 1.1180,   "category": "forex_minor", "pip": 0.0001,  "decimals": 5},
    "AUDJPY":  {"base_price": 98.50,    "category": "forex_minor", "pip": 0.01,    "decimals": 3},
    "CADJPY":  {"base_price": 110.20,   "category": "forex_minor", "pip": 0.01,    "decimals": 3},
    "NZDJPY":  {"base_price": 91.40,    "category": "forex_minor", "pip": 0.01,    "decimals": 3},
    "USDHKD":  {"base_price": 7.7850,   "category": "forex_minor", "pip": 0.0001,  "decimals": 5},
}

ANNUAL_VOLATILITY = {
    "forex_major": 0.08,
    "forex_minor": 0.08,
    "commodity":   0.20,
    "index":       0.15,
    "crypto":      0.50,
}

SPREAD_RANGE: Dict[str, tuple] = {
    "EURUSD":  (0.00005, 0.00015),
    "GBPUSD":  (0.00005, 0.00015),
    "USDJPY":  (0.005,   0.015),
    "AUDUSD":  (0.00005, 0.00015),
    "USDCAD":  (0.00005, 0.00015),
    "USDCHF":  (0.00005, 0.00015),
    "NZDUSD":  (0.00010, 0.00030),
    "EURGBP":  (0.00010, 0.00030),
    "EURJPY":  (0.010,   0.030),
    "GBPJPY":  (0.010,   0.030),
    "XAUUSD":  (0.15,    0.30),
    "XAGUSD":  (0.02,    0.05),
    "USOIL":   (0.03,    0.05),
    "US30":    (1.0,     3.0),
    "US500":   (0.5,     1.5),
    "NAS100":  (1.0,     3.0),
    "UK100":   (0.5,     2.0),
    "GER40":   (0.5,     2.0),
    "BTCUSD":  (10.0,    50.0),
    "ETHUSD":  (1.0,     5.0),
    "LTCUSD":  (0.05,    0.15),
    "XRPUSD":  (0.0002,  0.0008),
    "SOLUSD":  (0.05,    0.20),
    "EURCHF":  (0.00010, 0.00030),
    "GBPCHF":  (0.00015, 0.00040),
    "AUDJPY":  (0.010,   0.030),
    "CADJPY":  (0.010,   0.030),
    "NZDJPY":  (0.012,   0.035),
    "USDHKD":  (0.0002,  0.0006),
}

TICK_FREQ: Dict[str, tuple] = {
    "forex_major": (2, 5),
    "forex_minor": (2, 5),
    "commodity":   (1, 3),
    "index":       (1, 3),
    "crypto":      (3, 8),
}

VOLUME_RANGE: Dict[str, tuple] = {
    "forex_major": (50, 500),
    "forex_minor": (20, 200),
    "commodity":   (10, 150),
    "index":       (5, 100),
    "crypto":      (1, 50),
}

CORRELATIONS: List[tuple] = [
    ("EURUSD", "EURGBP",  0.60),
    ("EURUSD", "EURJPY",  0.70),
    ("EURUSD", "USDCHF", -0.80),
    ("EURUSD", "USDCAD", -0.40),
    ("GBPUSD", "EURGBP", -0.50),
    ("GBPUSD", "GBPJPY",  0.70),
    ("USDJPY", "EURJPY",  0.50),
    ("USDJPY", "GBPJPY",  0.50),
    ("XAUUSD", "XAGUSD",  0.85),
    ("XAUUSD", "EURUSD",  0.30),
    ("US500",  "NAS100",  0.90),
    ("US500",  "US30",    0.85),
    ("UK100",  "GER40",   0.65),
    ("BTCUSD", "ETHUSD",  0.75),
    ("BTCUSD", "LTCUSD",  0.70),
    ("ETHUSD", "SOLUSD",  0.72),
]

TRADING_SECONDS_PER_YEAR = 252 * 24 * 3600
MEAN_REVERSION_SPEED = 0.01


class FeedSimulator:
    """Realistic market data feed simulator.

    Generates price ticks for all 18 instruments using geometric Brownian
    motion with mean reversion, cross-instrument correlations, and random
    volatility bursts. Publishes to Redis and exposes a tick queue for
    downstream consumers.
    """

    def __init__(self, tick_rate_multiplier: float = 1.0):
        self.tick_rate_multiplier = tick_rate_multiplier

        self._tick_queue: asyncio.Queue = asyncio.Queue(maxsize=50_000)
        self._running = False
        self._tasks: List[asyncio.Task] = []

        self._prices: Dict[str, float] = {
            sym: info["base_price"] for sym, info in INSTRUMENTS.items()
        }
        self._last_returns: Dict[str, float] = dict.fromkeys(INSTRUMENTS, 0.0)
        self._vol_mult: Dict[str, float] = dict.fromkeys(INSTRUMENTS, 1.0)
        self._burst_until: Dict[str, float] = dict.fromkeys(INSTRUMENTS, 0.0)

        self._corr_targets: Dict[str, List[tuple]] = {sym: [] for sym in INSTRUMENTS}
        for source, target, factor in CORRELATIONS:
            self._corr_targets[target].append((source, factor))

    @property
    def current_prices(self) -> Dict[str, float]:
        return dict(self._prices)

    async def start(self):
        """Start live crypto feed + simulated feed for other instruments."""
        self._running = True
        logger.info(
            "Feed starting — %d instruments (crypto=LIVE via Binance, rest=simulated)",
            len(INSTRUMENTS),
        )

        for symbol in INSTRUMENTS:
            if symbol not in LIVE_CRYPTO_SYMBOLS:
                self._tasks.append(asyncio.create_task(self._symbol_loop(symbol)))

        self._tasks.append(asyncio.create_task(self._burst_scheduler()))
        self._tasks.append(asyncio.create_task(self._binance_feed()))

        await asyncio.gather(*self._tasks, return_exceptions=True)

    async def stop(self):
        """Gracefully stop all tick generators."""
        self._running = False
        for task in self._tasks:
            task.cancel()
        if self._tasks:
            await asyncio.gather(*self._tasks, return_exceptions=True)
        self._tasks.clear()
        logger.info("Feed simulator stopped")

    async def get_tick(self) -> Optional[dict]:
        """Non-blocking dequeue of the next tick for downstream consumers."""
        try:
            return self._tick_queue.get_nowait()
        except asyncio.QueueEmpty:
            return None

    # ------------------------------------------------------------------
    # Per-symbol tick loop
    # ------------------------------------------------------------------

    async def _symbol_loop(self, symbol: str):
        info = INSTRUMENTS[symbol]
        category = info["category"]
        decimals = info["decimals"]
        last_t = time.monotonic()

        while self._running:
            freq_lo, freq_hi = TICK_FREQ[category]
            freq = random.uniform(freq_lo, freq_hi) * self.tick_rate_multiplier
            await asyncio.sleep(1.0 / max(freq, 0.1))

            now = time.monotonic()
            dt = now - last_t
            last_t = now

            step = self._price_step(symbol, dt)
            new_price = self._prices[symbol] + step
            if new_price <= 0:
                new_price = self._prices[symbol] * 0.999

            pct_return = (new_price - self._prices[symbol]) / self._prices[symbol]
            self._prices[symbol] = new_price
            self._last_returns[symbol] = pct_return

            spread = self._spread(symbol)
            half = spread / 2.0
            bid = round(new_price - half, decimals)
            ask = round(new_price + half, decimals)

            ts = datetime.now(timezone.utc)
            timestamp = ts.strftime("%Y-%m-%dT%H:%M:%S.") + f"{ts.microsecond // 1000:03d}Z"

            vol_lo, vol_hi = VOLUME_RANGE[category]
            volume = random.randint(vol_lo, vol_hi)

            tick = {
                "symbol": symbol,
                "bid": bid,
                "ask": ask,
                "timestamp": timestamp,
                "volume": volume,
            }

            self._enqueue(tick)
            await self._publish_redis(tick, spread)

    # ------------------------------------------------------------------
    # Price model
    # ------------------------------------------------------------------

    def _price_step(self, symbol: str, dt: float) -> float:
        """GBM step with mean reversion: dS = θ(μ−S)dt + σ·S·dW"""
        info = INSTRUMENTS[symbol]
        base = info["base_price"]
        price = self._prices[symbol]
        sigma = ANNUAL_VOLATILITY[info["category"]] * self._vol_mult[symbol]

        dt_years = dt / TRADING_SECONDS_PER_YEAR
        vol_tick = sigma * math.sqrt(dt_years)
        diffusion = price * vol_tick * random.gauss(0, 1)

        deviation = (price - base) / base
        reversion = -MEAN_REVERSION_SPEED * deviation * price * dt_years * 252

        corr_adj = 0.0
        for source, factor in self._corr_targets[symbol]:
            corr_adj += self._last_returns[source] * factor * price * 0.1

        return diffusion + reversion + corr_adj

    def _spread(self, symbol: str) -> float:
        lo, hi = SPREAD_RANGE[symbol]
        base_spread = random.uniform(lo, hi)
        return base_spread * (0.8 + 0.4 * self._vol_mult[symbol])

    # ------------------------------------------------------------------
    # Volatility bursts
    # ------------------------------------------------------------------

    async def _burst_scheduler(self):
        """Randomly trigger volatility bursts simulating news events."""
        while self._running:
            await asyncio.sleep(random.uniform(5.0, 30.0))

            count = random.randint(1, 3)
            symbols = random.sample(list(INSTRUMENTS.keys()), count)
            mult = random.uniform(2.0, 5.0)
            duration = random.uniform(2.0, 10.0)
            now = time.monotonic()

            for sym in symbols:
                self._vol_mult[sym] = mult
                self._burst_until[sym] = now + duration
                logger.debug("Vol burst: %s x%.1f for %.1fs", sym, mult, duration)

            for source, target, factor in CORRELATIONS:
                if source in symbols and abs(factor) > 0.5:
                    self._vol_mult[target] = max(
                        self._vol_mult[target],
                        1.0 + (mult - 1.0) * abs(factor),
                    )
                    self._burst_until[target] = max(
                        self._burst_until[target],
                        now + duration * 0.7,
                    )

            await asyncio.sleep(duration)

            now2 = time.monotonic()
            for sym in INSTRUMENTS:
                if self._burst_until[sym] <= now2:
                    self._vol_mult[sym] = 1.0

    # ------------------------------------------------------------------
    # Live Binance crypto feed
    # ------------------------------------------------------------------

    async def _binance_feed(self):
        streams = [f"{pair}@trade" for pair in BINANCE_MAP]
        url = f"{BINANCE_WS}/{'/'.join(streams)}"

        while self._running:
            try:
                logger.info("Connecting to Binance WebSocket: %s", url)
                async with websockets.connect(url, ping_interval=20, ping_timeout=10) as ws:
                    logger.info("Binance WebSocket connected — live crypto prices active")
                    async for raw in ws:
                        if not self._running:
                            break
                        try:
                            data = json.loads(raw)
                            pair = data.get("s", "").lower()
                            symbol = BINANCE_MAP.get(pair)
                            if not symbol:
                                continue

                            price = float(data["p"])
                            info = INSTRUMENTS[symbol]
                            decimals = info["decimals"]
                            spread_lo, spread_hi = SPREAD_RANGE[symbol]
                            spread = random.uniform(spread_lo, spread_hi)
                            half = spread / 2.0
                            bid = round(price - half, decimals)
                            ask = round(price + half, decimals)

                            ts = datetime.now(timezone.utc)
                            timestamp = ts.strftime("%Y-%m-%dT%H:%M:%S.") + f"{ts.microsecond // 1000:03d}Z"

                            self._prices[symbol] = price

                            tick = {
                                "symbol": symbol,
                                "bid": bid,
                                "ask": ask,
                                "timestamp": timestamp,
                                "volume": int(float(data.get("q", 1))),
                            }
                            self._enqueue(tick)
                            await self._publish_redis(tick, spread)
                        except (KeyError, ValueError):
                            continue
            except Exception as e:
                logger.warning("Binance WS error: %s — reconnecting in 5s", e)
                await asyncio.sleep(5)

    # ------------------------------------------------------------------
    # Queue & Redis helpers
    # ------------------------------------------------------------------

    def _enqueue(self, tick: dict):
        try:
            self._tick_queue.put_nowait(tick)
        except asyncio.QueueFull:
            try:
                self._tick_queue.get_nowait()
            except asyncio.QueueEmpty:
                pass
            self._tick_queue.put_nowait(tick)

    async def _publish_redis(self, tick: dict, spread: float):
        try:
            tick_json = json.dumps(tick)
            price_json = json.dumps({
                "bid": tick["bid"],
                "ask": tick["ask"],
                "timestamp": tick["timestamp"],
                "spread": round(spread, 8),
            })

            await redis_client.publish("ticks:all", tick_json)
            await redis_client.hset("prices", tick["symbol"], price_json)
        except Exception as exc:
            logger.warning("Redis publish failed for %s: %s", tick["symbol"], exc)
