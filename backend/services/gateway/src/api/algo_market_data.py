"""Algo Market Data — Public endpoints for external algo bots to consume LP prices.

REST:
  GET /api/algo/symbols                          — list active instruments
  GET /api/algo/price?symbol=X                   — single-symbol snapshot
  GET /api/algo/prices?symbols=A,B               — multi-symbol snapshot
  GET /api/algo/bars?symbol=X&timeframe=1m&limit — historical OHLC bars

WebSocket (registered in main.py):
  /ws/algo/prices                                — live tick fanout

Auth: same X-Api-Key + X-Api-Secret used by /api/algo/trade.

Data sources (all shared with the internal frontend — friend's bot sees exact same prices):
  - Live snapshot:  Redis STRING  `tick:SYMBOL`              (written by publish_price)
  - Live stream:    Redis PUB/SUB `prices`                   (broadcast channel)
  - Historical:     Redis LIST    `bars:SYMBOL:TIMEFRAME`    (up to 1000 bars per key)
"""
import asyncio
import hashlib
import json
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Header, Query, WebSocket
from sqlalchemy import select

from packages.common.src.database import AsyncSessionLocal
from packages.common.src.models import AlgoApiKey, TradingAccount, Instrument, InstrumentSegment
from packages.common.src.redis_client import redis_client, PriceChannel

logger = logging.getLogger("algo_market_data")
router = APIRouter()

SUPPORTED_TIMEFRAMES = ("1m", "5m", "15m", "30m", "1h", "4h", "1d")

# WS close codes — 4xxx range is application-defined
WS_CLOSE_AUTH_TIMEOUT = 4001
WS_CLOSE_BAD_AUTH_MSG = 4002
WS_CLOSE_INVALID_CREDS = 4003
WS_CLOSE_ACCOUNT_INACTIVE = 4004

AUTH_TIMEOUT_SECONDS = 5
WS_HEARTBEAT_INTERVAL = 30


def _hash_secret(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


async def validate_api_credentials(api_key: str, api_secret: str) -> tuple[str, str]:
    """Validate X-Api-Key + X-Api-Secret against `algo_api_keys`.

    Returns (api_key_id_str, account_number) on success.
    Raises HTTPException(401) on missing/invalid creds, 403 on inactive account.
    Updates last_used_at on the key row.

    Shared by the REST handlers below and the WS handler in algo_prices_ws().
    """
    if not api_key or not api_secret:
        raise HTTPException(status_code=401, detail="Missing X-Api-Key or X-Api-Secret")

    secret_hash = _hash_secret(api_secret)

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(AlgoApiKey).where(
                AlgoApiKey.api_key == api_key,
                AlgoApiKey.is_active == True,
            )
        )
        key_row = result.scalar_one_or_none()
        if not key_row or key_row.secret_hash != secret_hash:
            raise HTTPException(status_code=401, detail="Invalid API credentials")

        account = await db.get(TradingAccount, key_row.account_id)
        if not account or not account.is_active:
            raise HTTPException(status_code=403, detail="Trading account is inactive")

        key_row.last_used_at = datetime.now(timezone.utc)
        account_number = account.account_number
        key_id = str(key_row.id)
        await db.commit()
        return key_id, account_number


# ---------------------------------------------------------------------------
# REST endpoints
# ---------------------------------------------------------------------------


@router.get("/symbols")
async def algo_symbols(
    x_api_key: str = Header(default="", alias="X-Api-Key"),
    x_api_secret: str = Header(default="", alias="X-Api-Secret"),
):
    """List every active instrument with its trading spec.

    Intended to be called once at bot startup and cached. The response is
    authoritative — symbols missing from this list are not tradable and
    won't appear on /price, /prices, /bars, or the WS stream.
    """
    await validate_api_credentials(x_api_key, x_api_secret)

    async with AsyncSessionLocal() as db:
        q = await db.execute(
            select(Instrument, InstrumentSegment)
            .join(InstrumentSegment, Instrument.segment_id == InstrumentSegment.id, isouter=True)
            .where(Instrument.is_active == True)
            .order_by(Instrument.symbol)
        )
        rows = q.all()

    return {
        "symbols": [
            {
                "symbol": inst.symbol,
                "display_name": inst.display_name or inst.symbol,
                "category": (seg.name if seg else "other"),
                "digits": int(inst.digits or 5),
                "min_lot": float(inst.min_lot or 0.01),
                "max_lot": float(inst.max_lot or 100),
                "lot_step": float(inst.lot_step or 0.01),
                "contract_size": float(inst.contract_size or 100000),
            }
            for inst, seg in rows
        ],
        "count": len(rows),
    }


@router.get("/price")
async def algo_price(
    symbol: str = Query(..., description="Instrument symbol, e.g. XAUUSD"),
    x_api_key: str = Header(default="", alias="X-Api-Key"),
    x_api_secret: str = Header(default="", alias="X-Api-Secret"),
):
    """Return the current bid/ask snapshot for one symbol."""
    await validate_api_credentials(x_api_key, x_api_secret)

    symbol_upper = symbol.upper()

    async with AsyncSessionLocal() as db:
        inst_q = await db.execute(
            select(Instrument).where(
                Instrument.symbol == symbol_upper,
                Instrument.is_active == True,
            )
        )
        if inst_q.scalar_one_or_none() is None:
            raise HTTPException(status_code=404, detail=f"Instrument {symbol_upper} not found")

    raw = await redis_client.get(PriceChannel.tick_key(symbol_upper))
    if not raw:
        raise HTTPException(status_code=503, detail=f"No price data for {symbol_upper}")

    tick = json.loads(raw)
    bid = float(tick["bid"])
    ask = float(tick["ask"])
    return {
        "symbol": symbol_upper,
        "bid": bid,
        "ask": ask,
        "spread": float(tick.get("spread", round(ask - bid, 8))),
        "timestamp": tick.get("timestamp"),
    }


@router.get("/prices")
async def algo_prices(
    symbols: Optional[str] = Query(
        default=None,
        description="Comma-separated list, e.g. 'XAUUSD,EURUSD,BTCUSD'. Omit to fetch all active instruments.",
    ),
    x_api_key: str = Header(default="", alias="X-Api-Key"),
    x_api_secret: str = Header(default="", alias="X-Api-Secret"),
):
    """Return snapshots for multiple symbols in one call. Symbols with no current
    tick are omitted from the response (not an error)."""
    await validate_api_credentials(x_api_key, x_api_secret)

    async with AsyncSessionLocal() as db:
        if symbols:
            requested = [s.strip().upper() for s in symbols.split(",") if s.strip()]
            if not requested:
                raise HTTPException(status_code=400, detail="symbols must be a non-empty list")
            if len(requested) > 50:
                raise HTTPException(status_code=400, detail="symbols list cannot exceed 50 items")
            q = await db.execute(
                select(Instrument.symbol).where(
                    Instrument.symbol.in_(requested),
                    Instrument.is_active == True,
                )
            )
            known = {r[0] for r in q.all()}
            unknown = [s for s in requested if s not in known]
            if unknown:
                raise HTTPException(
                    status_code=404,
                    detail=f"Unknown instrument(s): {','.join(unknown)}",
                )
            target_symbols = [s for s in requested if s in known]
        else:
            q = await db.execute(
                select(Instrument.symbol)
                .where(Instrument.is_active == True)
                .order_by(Instrument.symbol)
            )
            target_symbols = [r[0] for r in q.all()]

    if not target_symbols:
        return {"prices": [], "count": 0}

    keys = [PriceChannel.tick_key(s) for s in target_symbols]
    raws = await redis_client.mget(keys)

    prices = []
    for sym, raw in zip(target_symbols, raws):
        if not raw:
            continue
        try:
            tick = json.loads(raw)
            bid = float(tick["bid"])
            ask = float(tick["ask"])
        except (json.JSONDecodeError, KeyError, ValueError, TypeError):
            continue
        prices.append({
            "symbol": sym,
            "bid": bid,
            "ask": ask,
            "spread": float(tick.get("spread", round(ask - bid, 8))),
            "timestamp": tick.get("timestamp"),
        })

    return {"prices": prices, "count": len(prices)}


@router.get("/bars")
async def algo_bars(
    symbol: str = Query(..., description="Instrument symbol, e.g. XAUUSD"),
    timeframe: str = Query(..., description=f"One of: {', '.join(SUPPORTED_TIMEFRAMES)}"),
    limit: int = Query(default=100, ge=1, le=1000, description="Number of bars to return (max 1000)"),
    x_api_key: str = Header(default="", alias="X-Api-Key"),
    x_api_secret: str = Header(default="", alias="X-Api-Secret"),
):
    """Return historical OHLCV bars (newest first). Max 1000 bars per request.

    Bars are sourced from the same aggregator that feeds the charting frontend —
    identical OHLCV values.
    """
    await validate_api_credentials(x_api_key, x_api_secret)

    tf = timeframe.lower()
    if tf not in SUPPORTED_TIMEFRAMES:
        raise HTTPException(
            status_code=400,
            detail=f"timeframe must be one of: {', '.join(SUPPORTED_TIMEFRAMES)}",
        )

    symbol_upper = symbol.upper()
    async with AsyncSessionLocal() as db:
        inst_q = await db.execute(
            select(Instrument).where(
                Instrument.symbol == symbol_upper,
                Instrument.is_active == True,
            )
        )
        if inst_q.scalar_one_or_none() is None:
            raise HTTPException(status_code=404, detail=f"Instrument {symbol_upper} not found")

    list_key = f"bars:{symbol_upper}:{tf}"
    raws = await redis_client.lrange(list_key, 0, limit - 1)

    bars = []
    for raw in raws:
        try:
            b = json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            continue
        time_val = b.get("time")
        if isinstance(time_val, (int, float)):
            time_iso = datetime.fromtimestamp(int(time_val), tz=timezone.utc).strftime(
                "%Y-%m-%dT%H:%M:%SZ"
            )
        else:
            time_iso = str(time_val) if time_val else None
        try:
            bars.append({
                "time": time_iso,
                "open": float(b["open"]),
                "high": float(b["high"]),
                "low": float(b["low"]),
                "close": float(b["close"]),
                "volume": float(b.get("volume", 0)),
            })
        except (KeyError, ValueError, TypeError):
            continue

    return {
        "symbol": symbol_upper,
        "timeframe": tf,
        "bars": bars,
        "count": len(bars),
    }


# ---------------------------------------------------------------------------
# WebSocket live stream (registered in main.py at /ws/algo/prices)
# ---------------------------------------------------------------------------


async def algo_prices_ws(websocket: WebSocket) -> None:
    """Live tick stream for algo bots — first-message auth, then broadcasts every
    tick from the Redis `prices` pub/sub channel to the client.

    Handshake:
        1. Client connects (no auth in URL/headers — avoids secret leakage to logs).
        2. Server accepts and starts a 5-second auth timer.
        3. Client sends:
               {"action": "auth", "api_key": "ak_...", "api_secret": "sk_..."}
        4. On success server replies:
               {"status": "authenticated", "account": "100245"}
           and then streams ticks:
               {"type": "tick", "symbol": "XAUUSD", "bid": ..., "ask": ..., "timestamp": "..."}

    Heartbeat: server sends `{"type": "ping"}` every 30s.

    Close codes (4xxx = application):
        4001  auth_timeout          — no first message within 5s
        4002  bad_auth_message      — malformed / missing fields
        4003  invalid_credentials   — key+secret don't match
        4004  account_inactive      — key valid but trading account disabled
    """
    await websocket.accept()

    try:
        raw = await asyncio.wait_for(websocket.receive_text(), timeout=AUTH_TIMEOUT_SECONDS)
    except (asyncio.TimeoutError, Exception):
        try:
            await websocket.close(code=WS_CLOSE_AUTH_TIMEOUT, reason="auth_timeout")
        except Exception:
            pass
        return

    try:
        msg = json.loads(raw)
        if msg.get("action") != "auth":
            raise ValueError("action must be 'auth'")
        api_key = msg["api_key"]
        api_secret = msg["api_secret"]
        if not isinstance(api_key, str) or not isinstance(api_secret, str):
            raise ValueError("api_key/api_secret must be strings")
    except (json.JSONDecodeError, KeyError, TypeError, ValueError):
        try:
            await websocket.send_json({
                "status": "error",
                "detail": "First message must be JSON: "
                          "{\"action\":\"auth\",\"api_key\":\"...\",\"api_secret\":\"...\"}",
            })
        except Exception:
            pass
        try:
            await websocket.close(code=WS_CLOSE_BAD_AUTH_MSG, reason="bad_auth_message")
        except Exception:
            pass
        return

    try:
        _, account_number = await validate_api_credentials(api_key, api_secret)
    except HTTPException as exc:
        try:
            await websocket.send_json({"status": "error", "detail": exc.detail})
        except Exception:
            pass
        code = WS_CLOSE_ACCOUNT_INACTIVE if exc.status_code == 403 else WS_CLOSE_INVALID_CREDS
        try:
            await websocket.close(code=code, reason="auth_failed")
        except Exception:
            pass
        return

    await websocket.send_json({"status": "authenticated", "account": account_number})

    pubsub = redis_client.pubsub()
    await pubsub.subscribe(PriceChannel.PRICE_CHANNEL)

    try:
        last_ping = asyncio.get_event_loop().time()
        while True:
            message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=0.1)
            if message and message.get("type") == "message":
                try:
                    tick = json.loads(message["data"])
                    tick["type"] = "tick"
                    await websocket.send_json(tick)
                except (json.JSONDecodeError, TypeError):
                    continue

            now = asyncio.get_event_loop().time()
            if now - last_ping >= WS_HEARTBEAT_INTERVAL:
                try:
                    await websocket.send_json({"type": "ping"})
                except Exception:
                    break
                last_ping = now

            await asyncio.sleep(0.01)
    except Exception as exc:
        logger.debug("algo_prices_ws stream ended: %s", exc)
    finally:
        try:
            await pubsub.unsubscribe(PriceChannel.PRICE_CHANNEL)
            await pubsub.close()
        except Exception:
            pass
