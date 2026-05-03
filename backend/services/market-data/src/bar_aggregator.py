"""Bar Aggregator — Aggregates ticks into OHLCV bars for multiple timeframes."""
import asyncio
import logging
from datetime import datetime, timezone
from collections import defaultdict

from packages.common.src.redis_client import redis_client

logger = logging.getLogger("market-data.aggregator")

TIMEFRAMES = {
    "1m": 60,
    "5m": 300,
    "15m": 900,
    "30m": 1800,
    "1h": 3600,
    "4h": 14400,
    "1d": 86400,
}


class BarData:
    __slots__ = ("open", "high", "low", "close", "volume", "tick_count", "timestamp")

    def __init__(self, price: float, timestamp: str):
        self.open = price
        self.high = price
        self.low = price
        self.close = price
        self.volume = 0.0
        self.tick_count = 1
        self.timestamp = timestamp

    def update(self, price: float):
        self.high = max(self.high, price)
        self.low = min(self.low, price)
        self.close = price
        self.tick_count += 1


class BarAggregator:
    def __init__(self):
        self._bars: dict[str, dict[str, BarData]] = defaultdict(dict)
        self._bar_timestamps: dict[str, dict[str, int]] = defaultdict(dict)

    def update(self, symbol: str, bid: float, ask: float, timestamp: str):
        mid = (bid + ask) / 2
        now = datetime.fromisoformat(timestamp).replace(tzinfo=timezone.utc)
        epoch = int(now.timestamp())

        for tf_name, tf_seconds in TIMEFRAMES.items():
            bar_start = (epoch // tf_seconds) * tf_seconds
            key = f"{symbol}:{tf_name}"

            current_start = self._bar_timestamps.get(symbol, {}).get(tf_name)

            if current_start != bar_start:
                if current_start is not None and key in self._bars.get(symbol, {}):
                    old_bar = self._bars[symbol].pop(tf_name, None)
                    if old_bar:
                        asyncio.create_task(self._store_bar(symbol, tf_name, old_bar, current_start))

                if symbol not in self._bars:
                    self._bars[symbol] = {}
                self._bars[symbol][tf_name] = BarData(mid, timestamp)

                if symbol not in self._bar_timestamps:
                    self._bar_timestamps[symbol] = {}
                self._bar_timestamps[symbol][tf_name] = bar_start
            else:
                if symbol in self._bars and tf_name in self._bars[symbol]:
                    self._bars[symbol][tf_name].update(mid)

    async def _store_bar(self, symbol: str, timeframe: str, bar: BarData, bar_start: int):
        import json
        bar_data = {
            "symbol": symbol,
            "timeframe": timeframe,
            "time": bar_start,
            "open": bar.open,
            "high": bar.high,
            "low": bar.low,
            "close": bar.close,
            "volume": bar.volume,
            "tick_count": bar.tick_count,
        }

        bar_key = f"bar:{symbol}:{timeframe}"
        await redis_client.set(bar_key, json.dumps(bar_data))

        list_key = f"bars:{symbol}:{timeframe}"
        await redis_client.lpush(list_key, json.dumps(bar_data))
        await redis_client.ltrim(list_key, 0, 999)

    async def run_aggregation_loop(self):
        """Periodically publish current bar state to Redis for chart consumers."""
        import json
        while True:
            for symbol, timeframes in list(self._bars.items()):
                for tf_name, bar in list(timeframes.items()):
                    bar_data = {
                        "symbol": symbol,
                        "timeframe": tf_name,
                        "open": bar.open,
                        "high": bar.high,
                        "low": bar.low,
                        "close": bar.close,
                        "volume": bar.volume,
                        "tick_count": bar.tick_count,
                    }
                    bar_key = f"bar:current:{symbol}:{tf_name}"
                    await redis_client.set(bar_key, json.dumps(bar_data))

            await asyncio.sleep(1)
