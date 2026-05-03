"""Corecen LP feed — consumes ticks pushed by the Corecen backend via the
gateway's `/api/lp/prices/batch` HMAC endpoint.

The gateway `lp_receiver` route validates the HMAC signature on the inbound
POST and RPUSHes each tick onto the Redis list `lp:incoming_ticks`. This feed
BLPOPs that list and hands the tick to the market-data tick processor so the
normal pipeline (admin spread widening, TimescaleDB storage, bar aggregation,
price channel publish) runs unchanged — only the data source has moved from
Infoway to Corecen LP.
"""
from __future__ import annotations

import asyncio
import contextlib
import json
import logging
from datetime import datetime, timezone
from typing import Optional

from packages.common.src.redis_client import redis_client

logger = logging.getLogger("market-data.corecen-lp")

LP_TICK_QUEUE = "lp:incoming_ticks"  # must match gateway lp_receiver.py


class CorecenLPFeed:
    """Drains LP ticks from Redis and exposes the same get_tick() API as the
    other feed implementations (InfowayFeed / FeedSimulator)."""

    def __init__(self) -> None:
        self._tick_queue: asyncio.Queue = asyncio.Queue(maxsize=50_000)
        self._running = False
        self._drain_task: Optional[asyncio.Task] = None

    @property
    def current_prices(self) -> dict:
        return {}

    async def start(self) -> None:
        self._running = True
        logger.info("Corecen LP feed starting — draining %s", LP_TICK_QUEUE)
        self._drain_task = asyncio.create_task(self._drain_loop(), name="corecen-lp-drain")
        # Keep start() alive while the drain task runs (matches InfowayFeed).
        try:
            await self._drain_task
        except asyncio.CancelledError:
            pass

    async def stop(self) -> None:
        self._running = False
        if self._drain_task:
            self._drain_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._drain_task
            self._drain_task = None
        logger.info("Corecen LP feed stopped")

    async def get_tick(self) -> Optional[dict]:
        try:
            return self._tick_queue.get_nowait()
        except asyncio.QueueEmpty:
            return None

    async def _drain_loop(self) -> None:
        while self._running:
            try:
                # BLPOP with a short timeout so we can observe the running flag.
                item = await redis_client.blpop(LP_TICK_QUEUE, timeout=1)
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                logger.warning("Corecen LP drain redis error: %s", exc)
                await asyncio.sleep(1.0)
                continue

            if not item:
                continue

            _key, raw = item
            try:
                data = json.loads(raw)
            except (TypeError, ValueError):
                continue

            symbol = str(data.get("symbol") or "").strip().upper()
            try:
                bid = float(data["bid"])
                ask = float(data["ask"])
            except (KeyError, TypeError, ValueError):
                continue
            if not symbol or bid <= 0 or ask <= 0 or ask < bid:
                continue

            ts_ms = data.get("timestamp_ms")
            if isinstance(ts_ms, (int, float)) and ts_ms > 0:
                sec = int(float(ts_ms) // 1000)
                ms = int(float(ts_ms) % 1000)
                dt = datetime.fromtimestamp(sec, tz=timezone.utc)
                timestamp = dt.strftime("%Y-%m-%dT%H:%M:%S.") + f"{ms:03d}Z"
            else:
                dt = datetime.now(timezone.utc)
                timestamp = dt.strftime("%Y-%m-%dT%H:%M:%S.") + f"{dt.microsecond // 1000:03d}Z"

            tick = {
                "symbol": symbol,
                "bid": bid,
                "ask": ask,
                "timestamp": timestamp,
                "volume": 1,
            }
            self._enqueue(tick)

    def _enqueue(self, tick: dict) -> None:
        try:
            self._tick_queue.put_nowait(tick)
        except asyncio.QueueFull:
            try:
                self._tick_queue.get_nowait()
            except asyncio.QueueEmpty:
                pass
            self._tick_queue.put_nowait(tick)
