"""Market Data Service — Connects to price feeds, normalizes, distributes via Redis pub/sub and stores in TimescaleDB."""
import asyncio
import json
import logging
import signal
import time
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from packages.common.src.config import get_settings
from packages.common.src.database import AsyncSessionLocal
from packages.common.src.models import Instrument
from packages.common.src.redis_client import (
    CONFIG_INSTRUMENTS_RELOAD_CHANNEL,
    PriceChannel,
    redis_client,
    publish_price,
)
from packages.common.src.kafka_client import close_producer

from .feed_handler import FeedSimulator, INSTRUMENTS
from .infoway_config import usable_infoway_api_key
from .infoway_feed import InfowayFeed
from .corecen_lp_feed import CorecenLPFeed
from .bar_aggregator import BarAggregator
from .seed_bars import seed as seed_bars
from .spread_cache import StreamSpreadCache, RELOAD_INTERVAL_SEC
from .store import TickStore

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)-5s [%(name)s] %(message)s")
logger = logging.getLogger("market-data")

try:
    from packages.common.src.instrumentation import init_sentry
    init_sentry("market-data")
except Exception:
    pass

settings = get_settings()

# If Infoway (or another feed) stops sending a symbol, Redis keeps a frozen tick; refresh
# with last mid + current admin spread so Spr matches config until live ticks resume.
STALE_TICK_AFTER_SEC = 90.0
STALE_REFRESH_INTERVAL_SEC = 30.0

# Segments the platform does not quote — never subscribed on the upstream feed.
# Segments the feed does not subscribe to.
#
# Empty on purpose. This used to hold {"stocks", "equities", "shares"}, which
# quietly dropped the eight US equities from the Infoway subscription: the
# platform listed 61 instruments while only 53 were ever asked for and 49
# quoted, and both terminals showed the shorter list. Whether a code returns
# data is Infoway's call — an unknown one is accepted and simply stays silent,
# which is how GOLD/SILVER/US100/NATGAS already behave — so excluding a whole
# segment here bought nothing and hid the instruments from every client.
EXCLUDED_FEED_SEGMENTS: set[str] = set()

# Infoway fallback timing. The wait must outlast a redeploy handover: until the
# old container's sockets are released the key is over its connection limit and
# every attempt is answered with HTTP 429.
INFOWAY_FALLBACK_AFTER_SEC = 180.0
INFOWAY_RETRY_INTERVAL_SEC = 300.0
INFOWAY_PROBE_SEC = 45.0


def _feed_category(segment_name: str) -> str:
    """Map a DB segment to the feed's category (only 'crypto' is behaviourally
    special — it rides Infoway's separate crypto socket)."""
    s = (segment_name or "").lower()
    if "crypto" in s:
        return "crypto"
    if "metal" in s or "commodit" in s or "energ" in s:
        return "commodity"
    if "ind" in s:
        return "index"
    return "forex_major"


class MarketDataService:
    def __init__(self):
        raw_key = (settings.INFOWAY_API_KEY or "").strip()
        self._tick_count = 0
        self._infoway_watchdog_armed = False
        if getattr(settings, "CORECEN_LP_ENABLED", False):
            if not settings.CORECEN_LP_API_KEY or not settings.CORECEN_LP_API_SECRET:
                logger.error(
                    "CORECEN_LP_ENABLED=true but CORECEN_LP_API_KEY / CORECEN_LP_API_SECRET "
                    "are not set — gateway will reject LP pushes and no ticks will arrive."
                )
            self.feed = CorecenLPFeed()
            logger.info("Price feed: Corecen LP (receiving pushes on /api/lp/prices/batch)")
        elif usable_infoway_api_key(raw_key):
            # Subscribed symbols are refreshed from the DB in start(); this is
            # the fallback list if that lookup fails.
            self._infoway_key = raw_key
            self.feed = InfowayFeed(raw_key, INSTRUMENTS)
            self._infoway_watchdog_armed = True
            logger.info("Price feed: Infoway WebSocket (depth)")
        else:
            self.feed = FeedSimulator(tick_rate_multiplier=1.0)
            if raw_key:
                logger.warning(
                    "INFOWAY_API_KEY unset or looks like a placeholder — using simulated feed + Binance crypto"
                )
            else:
                logger.warning(
                    "INFOWAY_API_KEY not set — using simulated forex/indices + Binance crypto"
                )
        self.aggregator = BarAggregator()
        self.store = TickStore()
        self.spread_cache = StreamSpreadCache()
        self.running = True
        self._last_mid: dict[str, float] = {}
        self._last_live_mono: dict[str, float] = {}

    async def _instruments_from_db(self) -> dict[str, dict] | None:
        """Feed subscription list built from the admin's instrument table.

        Every active instrument (minus the segments we don't quote) gets a live
        subscription, so adding an instrument in admin is enough to make it
        stream — no code change. Returns None to keep the built-in catalog.
        """
        try:
            async with AsyncSessionLocal() as db:
                r = await db.execute(
                    select(Instrument)
                    .where(Instrument.is_active == True)  # noqa: E712
                    .options(selectinload(Instrument.segment))
                )
                rows = r.scalars().unique().all()
        except Exception as exc:
            logger.warning("Instrument list from DB failed (%s) — using built-in catalog", exc)
            return None

        out: dict[str, dict] = {}
        for inst in rows:
            sym = (inst.symbol or "").strip().upper()
            if not sym:
                continue
            seg = (inst.segment.name if inst.segment else "").lower()
            if seg in EXCLUDED_FEED_SEGMENTS:
                continue
            builtin = INSTRUMENTS.get(sym, {})
            out[sym] = {
                **builtin,
                "category": _feed_category(seg) if seg else builtin.get("category", "forex_major"),
                "decimals": int(inst.digits if inst.digits is not None else builtin.get("decimals", 5)),
                "pip": float(inst.pip_size if inst.pip_size is not None else builtin.get("pip", 0.0001)),
            }
        return out or None

    async def start(self):
        logger.info("Starting Market Data Service...")

        signal.signal(signal.SIGINT, lambda *_: setattr(self, "running", False))
        signal.signal(signal.SIGTERM, lambda *_: setattr(self, "running", False))

        await self.store.init()

        # Widen the Infoway subscription to every instrument the admin has live.
        if isinstance(self.feed, InfowayFeed):
            db_instruments = await self._instruments_from_db()
            if db_instruments:
                self.feed = InfowayFeed(self._infoway_key, db_instruments)
                logger.info(
                    "Infoway subscription from DB: %d instruments (built-in catalog has %d)",
                    len(db_instruments), len(INSTRUMENTS),
                )

        await self.spread_cache.reload_if_stale(force=True)
        await self._seed_last_mid_from_redis()

        tasks = [
            asyncio.create_task(self.feed.start()),
            asyncio.create_task(self._process_ticks()),
            asyncio.create_task(self._spread_reload_loop()),
            asyncio.create_task(self._spread_config_subscriber()),
            asyncio.create_task(self._stale_quote_refresher()),
            asyncio.create_task(self.aggregator.run_aggregation_loop()),
            asyncio.create_task(self._auto_seed_bars()),
        ]
        if self._infoway_watchdog_armed:
            tasks.append(asyncio.create_task(self._infoway_fallback_watchdog()))

        await asyncio.gather(*tasks)

    async def _spread_reload_loop(self):
        while self.running:
            await asyncio.sleep(RELOAD_INTERVAL_SEC)
            if self.running:
                await self.spread_cache.reload_if_stale(force=True)

    async def _spread_config_subscriber(self):
        """Reload spread cache when admin saves spreads (same channel as instrument config)."""
        channel = CONFIG_INSTRUMENTS_RELOAD_CHANNEL
        while self.running:
            pubsub = redis_client.pubsub()
            try:
                await pubsub.subscribe(channel)
                while self.running:
                    msg = await pubsub.get_message(
                        ignore_subscribe_messages=True, timeout=1.0
                    )
                    if msg and msg.get("type") == "message":
                        logger.info("Config reload signal — refreshing spread cache")
                        await self.spread_cache.reload_if_stale(force=True)
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                logger.warning("Spread config subscriber error (retrying): %s", exc)
                await asyncio.sleep(2.0)
            finally:
                try:
                    await pubsub.unsubscribe(channel)
                    await pubsub.aclose()
                except Exception:
                    pass

    async def _seed_last_mid_from_redis(self) -> None:
        """Prime last mid from existing tick:* keys so stale-quote refresh can fix spread after restart."""
        try:
            mono = time.monotonic()
            n = 0
            async for key in redis_client.scan_iter(f"{PriceChannel.TICK_PREFIX}*"):
                raw = await redis_client.get(key)
                if not raw:
                    continue
                try:
                    d = json.loads(raw)
                    sym = str(d.get("symbol") or "").strip().upper()
                    if not sym:
                        continue
                    b, a = float(d["bid"]), float(d["ask"])
                except (KeyError, TypeError, ValueError, json.JSONDecodeError):
                    continue
                self._last_mid[sym] = (b + a) / 2.0
                self._last_live_mono[sym] = mono - STALE_TICK_AFTER_SEC - 1.0
                n += 1
            if n:
                logger.info("Seeded last mid from Redis for %d symbols (stale refresh eligible)", n)
        except Exception as exc:
            logger.warning("Seed last_mid from Redis failed: %s", exc)

    async def _stale_quote_refresher(self) -> None:
        while self.running:
            await asyncio.sleep(STALE_REFRESH_INTERVAL_SEC)
            if not self.running:
                break
            await self.spread_cache.reload_if_stale(force=False)
            now = time.monotonic()
            ts_dt = datetime.now(timezone.utc)
            ts = ts_dt.strftime("%Y-%m-%dT%H:%M:%S.") + f"{ts_dt.microsecond // 1000:03d}Z"
            for symbol, mid in list(self._last_mid.items()):
                if now - self._last_live_mono.get(symbol, 0) < STALE_TICK_AFTER_SEC:
                    continue
                try:
                    bid, ask = self.spread_cache.widen(symbol, mid)
                    await publish_price(symbol, bid, ask, ts)
                except Exception as exc:
                    logger.debug("Stale quote refresh failed for %s: %s", symbol, exc)

    async def _process_ticks(self):
        logger.info("Tick processor started")
        while self.running:
            tick = await self.feed.get_tick()
            if tick is None:
                await asyncio.sleep(0.01)
                continue

            symbol = str(tick["symbol"] or "").strip().upper()
            if not symbol:
                continue
            bid = float(tick["bid"])
            ask = float(tick["ask"])
            ts = tick.get("timestamp", datetime.now(timezone.utc).isoformat())

            mid = (bid + ask) / 2.0
            self._last_mid[symbol] = mid
            self._last_live_mono[symbol] = time.monotonic()
            bid, ask = self.spread_cache.widen(symbol, mid)

            await publish_price(symbol, bid, ask, ts)

            await self.store.insert_tick(symbol, bid, ask, ts)

            self.aggregator.update(symbol, bid, ask, ts)
            self._tick_count += 1

    async def _use_simulator(self) -> None:
        try:
            await self.feed.stop()
        except Exception as exc:
            logger.warning("Stopping feed: %s", exc)
        self.feed = FeedSimulator(tick_rate_multiplier=1.0)
        asyncio.create_task(self.feed.start())

    async def _use_infoway(self) -> None:
        try:
            await self.feed.stop()
        except Exception as exc:
            logger.warning("Stopping feed: %s", exc)
        instruments = await self._instruments_from_db() or INSTRUMENTS
        self.feed = InfowayFeed(self._infoway_key, instruments)
        asyncio.create_task(self.feed.start())

    async def _infoway_fallback_watchdog(self) -> None:
        """Keep quotes moving if Infoway is unreachable — but never permanently.

        Right after a redeploy the previous container's sockets are still counted
        against the key, so the new one is answered with HTTP 429 for up to a
        minute. The old 55s window turned that into a one-way switch to simulated
        prices that survived until somebody noticed and restarted the service, so
        the platform quietly served fake quotes. Now the wait is long enough to
        ride out the handover, and the simulator is only ever temporary.
        """
        try:
            await asyncio.sleep(INFOWAY_FALLBACK_AFTER_SEC)
        except asyncio.CancelledError:
            raise
        if not self.running or self._tick_count > 0 or not isinstance(self.feed, InfowayFeed):
            return

        logger.error(
            "Infoway: no ticks in %.0fs — check INFOWAY_API_KEY, outbound HTTPS/WSS, symbol codes "
            "and the plan's connection limit. Serving SIMULATED prices meanwhile; retrying every %.0fs.",
            INFOWAY_FALLBACK_AFTER_SEC, INFOWAY_RETRY_INTERVAL_SEC,
        )
        await self._use_simulator()

        while self.running:
            await asyncio.sleep(INFOWAY_RETRY_INTERVAL_SEC)
            if not self.running or isinstance(self.feed, InfowayFeed):
                return

            logger.warning("Retrying Infoway (currently on SIMULATED prices)…")
            await self._use_infoway()
            await asyncio.sleep(3.0)          # let the simulator's queue drain
            before = self._tick_count
            await asyncio.sleep(INFOWAY_PROBE_SEC)

            if self._tick_count > before:
                logger.info("Infoway is delivering again — live prices restored")
                return
            logger.warning("Infoway still unavailable — back to simulated prices")
            await self._use_simulator()

    async def _auto_seed_bars(self) -> None:
        """Wait for first ticks to arrive, then seed historical bars if Redis is empty."""
        try:
            await asyncio.sleep(30.0)  # give feed time to start delivering ticks
        except asyncio.CancelledError:
            raise
        if not self.running:
            return
        # Check if bars already exist for a common symbol
        sample_count = await redis_client.llen("bars:BTCUSD:5m")
        if sample_count >= 50:
            logger.info("Bars already seeded (%d bars for BTCUSD:5m), skipping auto-seed", sample_count)
            return
        logger.info("Auto-seeding historical bars (first run or bars missing)...")
        try:
            await seed_bars()
        except Exception as exc:
            logger.warning("Auto-seed bars failed: %s", exc)

    async def shutdown(self):
        logger.info("Shutting down Market Data Service...")
        self.running = False
        await self.feed.stop()
        await close_producer()
        await redis_client.close()


async def main():
    service = MarketDataService()
    try:
        await service.start()
    except KeyboardInterrupt:
        await service.shutdown()


if __name__ == "__main__":
    asyncio.run(main())
