"""Corecen Broker API client — forwards A-Book trades to Corecen LP.

When a Proline Markets user with book_type='A' opens, closes, or modifies a
position, this client pushes the event to Corecen's broker API so Corecen
can route it to the real LP.

Endpoints used:
  POST /api/v1/broker-api/trades/push   — open trade
  POST /api/v1/broker-api/trades/close  — close trade
  POST /api/v1/broker-api/trades/update — update SL/TP
"""

import hashlib
import hmac
import json
import logging
import math
import time
from decimal import Decimal
from typing import Any

import httpx

from packages.common.src.config import get_settings

logger = logging.getLogger("corecen_trade_client")

# ---------------------------------------------------------------------------
# JSON serialisation that matches JavaScript's JSON.stringify exactly.
# Python: json.dumps(3.0) → '3.0'   JS: JSON.stringify(3.0) → '3'
# Python: json.dumps(Decimal('5')) → error   JS: never sees Decimal
# ---------------------------------------------------------------------------

def _js_val(v: Any) -> Any:
    """Convert a single value so json.dumps matches JS JSON.stringify."""
    if isinstance(v, Decimal):
        return int(v) if v == int(v) else float(v)
    if isinstance(v, float) and not math.isnan(v) and not math.isinf(v):
        return int(v) if v == int(v) else v
    if isinstance(v, dict):
        return {k: _js_val(val) for k, val in v.items()}
    if isinstance(v, (list, tuple)):
        return [_js_val(i) for i in v]
    return v


def _js_dumps(obj: Any) -> str:
    """Compact JSON identical to JS JSON.stringify."""
    return json.dumps(_js_val(obj), separators=(",", ":"), default=str)


# ---------------------------------------------------------------------------
# HMAC signing — matches Corecen's hmac.middleware.ts
# message = f"{timestamp}{METHOD}{path}{body}"
# ---------------------------------------------------------------------------

def _sign(api_secret: str, timestamp: str, method: str, path: str, body: str) -> str:
    message = f"{timestamp}{method.upper()}{path}{body}"
    return hmac.new(api_secret.encode(), message.encode(), hashlib.sha256).hexdigest()


def _is_configured() -> bool:
    s = get_settings()
    return bool(s.CORECEN_BROKER_API_URL and s.CORECEN_BROKER_API_KEY and s.CORECEN_BROKER_API_SECRET)


async def _request(method: str, path: str, payload: dict[str, Any] | None = None) -> dict:
    """Send an HMAC-signed request to Corecen broker API."""
    s = get_settings()
    if not _is_configured():
        logger.debug("Corecen broker API not configured — skipping trade forward")
        return {"skipped": True}

    url = s.CORECEN_BROKER_API_URL.rstrip("/") + path
    body = _js_dumps(payload) if payload else ""
    timestamp = str(int(time.time() * 1000))
    signature = _sign(s.CORECEN_BROKER_API_SECRET, timestamp, method, path, body)

    headers = {
        "Content-Type": "application/json",
        "X-API-Key": s.CORECEN_BROKER_API_KEY,
        "X-Timestamp": timestamp,
        "X-Signature": signature,
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.request(method, url, content=body, headers=headers)

        if resp.status_code in (200, 201):
            data = resp.json()
            logger.info("[CORECEN_FORWARD] %s %s → %s", method, path, resp.status_code)
            return data
        else:
            text = resp.text[:500]
            logger.error(
                "[CORECEN_FORWARD] %s %s → %s: %s", method, path, resp.status_code, text
            )
            return {"error": True, "status": resp.status_code, "detail": text}
    except Exception as exc:
        logger.error("[CORECEN_FORWARD] %s %s failed: %s", method, path, exc)
        return {"error": True, "detail": str(exc)}


# ---------------------------------------------------------------------------
# Public helpers called by trading_service.py
# ---------------------------------------------------------------------------

async def forward_trade_open(
    position_id: str,
    user_id: str,
    user_email: str,
    user_name: str,
    symbol: str,
    side: str,
    volume: float,
    open_price: float,
    sl: float | None = None,
    tp: float | None = None,
    leverage: int = 100,
    contract_size: float = 100_000,
    trading_account_id: str = "",
    opened_at: str | None = None,
) -> dict:
    """Push an A-Book trade open to Corecen."""
    if not _is_configured():
        return {"skipped": True}

    payload = {
        "external_trade_id": position_id,
        "user_id": user_id,
        "user_email": user_email,
        "user_name": user_name,
        "symbol": symbol,
        "side": side.upper(),
        "volume": volume,
        "open_price": open_price,
        "sl": sl or 0,
        "tp": tp or 0,
        "leverage": leverage,
        "contract_size": contract_size,
        "trading_account_id": trading_account_id,
    }
    if opened_at:
        payload["opened_at"] = opened_at

    logger.info(
        "[A-BOOK] Forwarding OPEN to Corecen: %s %s %.2f lots @ %.5f (pos=%s)",
        side.upper(), symbol, volume, open_price, position_id,
    )
    return await _request("POST", "/api/v1/broker-api/trades/push", payload)


async def forward_trade_close(
    position_id: str,
    close_price: float,
    pnl: float = 0,
    closed_by: str = "USER",
    closed_at: str | None = None,
) -> dict:
    """Push an A-Book trade close to Corecen."""
    if not _is_configured():
        return {"skipped": True}

    payload = {
        "external_trade_id": position_id,
        "close_price": close_price,
        "pnl": pnl,
        "closed_by": closed_by,
    }
    if closed_at:
        payload["closed_at"] = closed_at

    logger.info(
        "[A-BOOK] Forwarding CLOSE to Corecen: pos=%s @ %.5f pnl=%.2f",
        position_id, close_price, pnl,
    )
    return await _request("POST", "/api/v1/broker-api/trades/close", payload)


async def forward_trade_update(
    position_id: str,
    sl: float | None = None,
    tp: float | None = None,
) -> dict:
    """Push SL/TP update to Corecen."""
    if not _is_configured():
        return {"skipped": True}

    payload: dict[str, Any] = {"external_trade_id": position_id}
    if sl is not None:
        payload["sl"] = sl
    if tp is not None:
        payload["tp"] = tp

    logger.info("[A-BOOK] Forwarding UPDATE to Corecen: pos=%s sl=%s tp=%s", position_id, sl, tp)
    return await _request("POST", "/api/v1/broker-api/trades/update", payload)
