"""Tick Store — Writes tick data to TimescaleDB."""
import logging
from datetime import datetime, timezone

from sqlalchemy import text
from packages.common.src.database import TimescaleSessionLocal

logger = logging.getLogger("market-data.store")


def _parse_tick_time(ts: str) -> datetime:
    """Infoway / feed timestamps are ISO strings; asyncpg needs datetime."""
    t = (ts or "").strip()
    if not t:
        return datetime.now(timezone.utc)
    if t.endswith("Z"):
        t = t[:-1] + "+00:00"
    try:
        dt = datetime.fromisoformat(t)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except ValueError:
        return datetime.now(timezone.utc)


class TickStore:
    def __init__(self):
        self._batch: list[tuple] = []
        self._batch_size = 100
        self._initialized = False

    async def init(self):
        self._initialized = True
        logger.info("Tick store initialized")

    async def insert_tick(self, symbol: str, bid: float, ask: float, timestamp: str):
        self._batch.append((_parse_tick_time(timestamp), symbol, bid, ask))

        if len(self._batch) >= self._batch_size:
            await self._flush()

    async def _flush(self):
        if not self._batch:
            return

        batch = self._batch[:]
        self._batch.clear()

        try:
            async with TimescaleSessionLocal() as session:
                for ts, symbol, bid, ask in batch:
                    await session.execute(
                        text(
                            "INSERT INTO ticks (time, symbol, bid, ask) "
                            "VALUES (:time, :symbol, :bid, :ask)"
                        ),
                        {"time": ts, "symbol": symbol, "bid": bid, "ask": ask},
                    )
                await session.commit()
        except Exception as e:
            logger.error(f"Failed to flush ticks: {e}")
