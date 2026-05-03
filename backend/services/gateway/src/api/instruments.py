"""Instruments API — List instruments, get current prices."""
import json as _json
import logging
import time as _time
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import get_db
from packages.common.src.redis_client import redis_client
from packages.common.src.schemas import InstrumentResponse, TickData
from packages.common.src.instrumentation import get_rate_limiter
from ..services import instrument_service

router = APIRouter()
_limiter = get_rate_limiter()
_logger = logging.getLogger("gateway.instruments")

# TradingView resolution string → bar aggregator timeframe key
_TV_RESOLUTION_TO_TF: dict[str, str] = {
    "1": "1m", "5": "5m", "15": "15m", "30": "30m",
    "60": "1h", "240": "4h", "D": "1d", "1D": "1d",
}

# Resolution → Binance kline interval string
_TV_RESOLUTION_TO_BINANCE: dict[str, str] = {
    "1": "1m", "5": "5m", "15": "15m", "30": "30m",
    "60": "1h", "240": "4h", "D": "1d", "1D": "1d",
}

# Platform symbol → Binance REST pair (crypto only)
_BINANCE_PAIRS: dict[str, str] = {
    "BTCUSD": "BTCUSDT", "ETHUSD": "ETHUSDT", "LTCUSD": "LTCUSDT",
    "XRPUSD": "XRPUSDT", "SOLUSD": "SOLUSDT", "BNBUSD": "BNBUSDT",
    "DOGEUSD": "DOGEUSDT", "ADAUSD": "ADAUSDT",
}


async def _fetch_binance_klines(
    symbol: str, resolution: str, from_time: int, to_time: int,
) -> list[dict]:
    """Fetch historical klines from Binance public REST API (no key needed).

    Results are cached in Redis for 60s to avoid repeated API calls on chart
    pan/zoom, which makes subsequent loads instant.
    """
    import httpx

    pair = _BINANCE_PAIRS.get(symbol.upper())
    if not pair:
        return []

    tf = _TV_RESOLUTION_TO_BINANCE.get(resolution, "5m")

    # --- Check Redis cache first ---
    cache_key = f"binance_cache:{symbol}:{tf}"
    try:
        cached = await redis_client.get(cache_key)
        if cached:
            all_bars: list[dict] = _json.loads(cached)
            # Filter by requested time range
            return [
                b for b in all_bars
                if (not from_time or b["time"] >= from_time)
                and (not to_time or b["time"] <= to_time)
            ]
    except Exception:
        pass

    # --- Fetch from Binance ---
    start_ms = from_time * 1000 if from_time else None
    end_ms = to_time * 1000 if to_time else None

    params: dict = {"symbol": pair, "interval": tf, "limit": 1000}
    if start_ms:
        params["startTime"] = start_ms
    if end_ms:
        params["endTime"] = end_ms

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get("https://api.binance.com/api/v3/klines", params=params)
            if resp.status_code != 200:
                _logger.warning("Binance klines HTTP %s for %s", resp.status_code, symbol)
                return []
            data = resp.json()
    except Exception as exc:
        _logger.warning("Binance klines fetch failed for %s: %s", symbol, exc)
        return []

    bars = []
    for k in data:
        bars.append({
            "time": int(k[0]) // 1000,
            "open": float(k[1]),
            "high": float(k[2]),
            "low": float(k[3]),
            "close": float(k[4]),
            "volume": float(k[5]),
        })

    # --- Cache in Redis (60s TTL) ---
    if bars:
        try:
            await redis_client.set(cache_key, _json.dumps(bars), ex=60)
        except Exception:
            pass

    return bars


@router.get("/", response_model=list[InstrumentResponse])
async def list_instruments(
    segment: str | None = None,
    active_only: bool = True,
    db: AsyncSession = Depends(get_db),
):
    return await instrument_service.list_instruments(
        segment=segment, active_only=active_only, db=db,
    )


@router.get("/market-status")
async def get_market_status(db: AsyncSession = Depends(get_db)):
    """Return market open/closed status for every active instrument.

    Clients should poll this every 60 s (or on page focus) to refresh
    the market-open state without spamming the server.
    """
    return await instrument_service.get_market_status(db=db)


@router.get("/market-status/{symbol}")
async def get_symbol_market_status(symbol: str, db: AsyncSession = Depends(get_db)):
    """Return market status for a single symbol."""
    return await instrument_service.get_symbol_market_status(symbol=symbol, db=db)


@router.get("/prices/all")
async def get_all_prices():
    """Static path before /{symbol}/price so it is never captured as a symbol."""
    return await instrument_service.get_all_prices()


@router.get("/{symbol}/price", response_model=TickData)
async def get_price(symbol: str):
    return await instrument_service.get_price(symbol=symbol)


@router.get("/{symbol}/bars")
@_limiter.exempt
async def get_bars(
    symbol: str,
    resolution: str = Query(default="5"),
    from_time: int = Query(default=0, alias="from"),
    to_time: int = Query(default=0, alias="to"),
):
    """Return OHLCV bars for the TradingView charting library.

    Priority:
    1. Real bars from Redis (BarAggregator)
    2. Binance REST API fallback (crypto symbols)
    3. Empty response

    Bars are stored by BarAggregator in Redis as a list (newest first).
    We read up to 1000 bars, filter by time range, sort ascending, and
    append the current in-progress bar so the chart stays live.
    """
    tf = _TV_RESOLUTION_TO_TF.get(resolution, "5m")
    sym = symbol.upper()
    _TF_SECONDS = {"1m": 60, "5m": 300, "15m": 900, "30m": 1800, "1h": 3600, "4h": 14400, "1d": 86400}
    bar_sec = _TF_SECONDS.get(tf, 300)

    # --- 1. Completed bars from Redis (lpush → newest first) ---
    raw_list: list[bytes] = await redis_client.lrange(f"bars:{sym}:{tf}", 0, 999)

    bars = []
    for raw in raw_list:
        try:
            b = _json.loads(raw)
            t = int(b.get("time", 0))
            if from_time and t < from_time:
                continue
            if to_time and t > to_time:
                continue
            bars.append({
                "time": t,
                "open": float(b["open"]),
                "high": float(b["high"]),
                "low": float(b["low"]),
                "close": float(b["close"]),
                "volume": float(b.get("volume", 0.0)),
            })
        except Exception:
            continue

    # Sort oldest → newest (TradingView requires ascending order)
    bars.sort(key=lambda x: x["time"])

    # --- 2. Binance fallback for crypto when Redis is empty or stale ---
    now_epoch = int(_time.time())
    has_recent = bars and (now_epoch - bars[-1]["time"]) < bar_sec * 3
    if not has_recent and sym in _BINANCE_PAIRS:
        binance_bars = await _fetch_binance_klines(sym, resolution, from_time, to_time)
        if binance_bars:
            # Merge: keep Redis bars that don't overlap, then add Binance bars
            binance_times = {b["time"] for b in binance_bars}
            bars = [b for b in bars if b["time"] not in binance_times] + binance_bars
            bars.sort(key=lambda x: x["time"])

    # --- 3. Append current in-progress bar ---
    current_raw = await redis_client.get(f"bar:current:{sym}:{tf}")
    if current_raw:
        try:
            b = _json.loads(current_raw)
            bar_start = (now_epoch // bar_sec) * bar_sec
            if (not from_time or bar_start >= from_time) and (not to_time or bar_start <= to_time):
                # Remove any bar at same time to avoid duplicate
                bars = [x for x in bars if x["time"] != bar_start]
                bars.append({
                    "time": bar_start,
                    "open": float(b["open"]),
                    "high": float(b["high"]),
                    "low": float(b["low"]),
                    "close": float(b["close"]),
                    "volume": float(b.get("volume", 0.0)),
                })
        except Exception:
            pass

    return {"s": "ok", "bars": bars, "noData": len(bars) == 0}
