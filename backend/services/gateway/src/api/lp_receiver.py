"""LP price receiver — accepts HMAC-signed price pushes from Corecen.

Corecen's price-distribution service POSTs batches of bid/ask ticks to
`/api/lp/prices/batch`. We verify the HMAC signature (same scheme used by
Corecen's broker clients), push the ticks onto a Redis list consumed by the
market-data service, and return 200.

Signature scheme (must match Corecen's generateSignature in
`price-distribution.service.ts`):

    message = METHOD + PATH + TIMESTAMP + BODY
    signature = HMAC_SHA256(apiSecret, message) hex

Required headers:
    X-API-Key     — must equal settings.CORECEN_LP_API_KEY
    X-Timestamp   — unix ms; must be within CORECEN_LP_TIMESTAMP_TOLERANCE_MS of now
    X-Signature   — hex HMAC-SHA256 of the message above
"""
from __future__ import annotations

import hashlib
import hmac
import json
import logging
import time
from typing import Any

from fastapi import APIRouter, Header, HTTPException, Request

from packages.common.src.config import get_settings
from packages.common.src.redis_client import redis_client

router = APIRouter()
logger = logging.getLogger("lp-receiver")

LP_TICK_QUEUE = "lp:incoming_ticks"  # consumed by market-data CorecenLPFeed
LP_LAST_BATCH_AT_KEY = "lp:last_batch_at"  # monotonic heartbeat


def _verify(settings, method: str, path: str, timestamp: str, body: str, signature: str, api_key: str) -> bool:
    if not settings.CORECEN_LP_API_KEY or not settings.CORECEN_LP_API_SECRET:
        return False
    if not hmac.compare_digest(api_key, settings.CORECEN_LP_API_KEY):
        return False
    try:
        ts_ms = int(timestamp)
    except (TypeError, ValueError):
        return False
    now_ms = int(time.time() * 1000)
    if abs(now_ms - ts_ms) > settings.CORECEN_LP_TIMESTAMP_TOLERANCE_MS:
        return False

    message = f"{method.upper()}{path}{timestamp}{body}".encode("utf-8")
    expected = hmac.new(
        settings.CORECEN_LP_API_SECRET.encode("utf-8"),
        message,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


@router.post("/prices/batch")
async def receive_prices_batch(
    request: Request,
    x_api_key: str = Header(default="", alias="X-API-Key"),
    x_timestamp: str = Header(default="", alias="X-Timestamp"),
    x_signature: str = Header(default="", alias="X-Signature"),
):
    settings = get_settings()
    if not settings.CORECEN_LP_ENABLED:
        raise HTTPException(status_code=404, detail="LP receiver disabled")
    if not x_api_key or not x_timestamp or not x_signature:
        raise HTTPException(status_code=401, detail="Missing HMAC headers")

    raw = await request.body()
    body_str = raw.decode("utf-8") if raw else ""
    # Path must match what the sender signed. Corecen uses axios baseURL + '/api/lp/prices/batch';
    # when the gateway is mounted with prefix '/api/lp', request.url.path is that exact string.
    path = request.url.path

    if not _verify(
        settings,
        request.method,
        path,
        x_timestamp,
        body_str,
        x_signature,
        x_api_key,
    ):
        logger.warning("LP push rejected: bad HMAC (path=%s)", path)
        raise HTTPException(status_code=401, detail="Invalid signature")

    try:
        payload: Any = json.loads(body_str) if body_str else {}
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    ticks = payload.get("ticks") if isinstance(payload, dict) else None
    if not isinstance(ticks, list) or not ticks:
        return {"ok": True, "accepted": 0}

    accepted = 0
    pipe = redis_client.pipeline()
    for raw_tick in ticks:
        if not isinstance(raw_tick, dict):
            continue
        symbol = str(raw_tick.get("symbol") or "").strip().upper()
        try:
            bid = float(raw_tick.get("bid"))
            ask = float(raw_tick.get("ask"))
        except (TypeError, ValueError):
            continue
        if not symbol or bid <= 0 or ask <= 0 or ask < bid:
            continue

        ts_ms = raw_tick.get("timestamp")
        if isinstance(ts_ms, (int, float)) and ts_ms > 0:
            ts_num = float(ts_ms)
        else:
            ts_num = time.time() * 1000.0

        pipe.rpush(
            LP_TICK_QUEUE,
            json.dumps(
                {
                    "symbol": symbol,
                    "bid": bid,
                    "ask": ask,
                    "timestamp_ms": ts_num,
                    "source": str(raw_tick.get("source") or "CORECEN_LP"),
                }
            ),
        )
        accepted += 1

    if accepted:
        pipe.ltrim(LP_TICK_QUEUE, -100_000, -1)
        pipe.set(LP_LAST_BATCH_AT_KEY, str(int(time.time() * 1000)))
        await pipe.execute()

    return {"ok": True, "accepted": accepted}


@router.get("/health")
async def lp_health():
    return {"status": "ok", "service": "lp-receiver"}
