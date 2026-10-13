"""Platform bridge — copy trades between two sister platforms by account number.

Opula Markets and Proline Markets run the same codebase on separate databases.
An admin links a local account to an account on the other platform:

    Opula 10  ──straight──▶  Proline 15     BUY  stays BUY
    Opula 10  ──reverse───▶  Proline 15     BUY  becomes SELL, SL/TP swapped

The SOURCE platform's `trade-bridge` worker watches its linked accounts and
calls the PEER's gateway (`/api/bridge/v1/*`), which executes the copy through
its own normal order path: real fill at its own price, margin, commission.

This module holds what both ends share: the side / SL / TP / lot maths, the
request signing, and the HTTP client. It has no database access, so the maths
can be unit-tested on its own.

Signing (both directions, same secret on both platforms):

    message   = TIMESTAMP_MS + METHOD + PATH + BODY
    signature = hex HMAC_SHA256(BRIDGE_SHARED_SECRET, message)

    headers: X-Bridge-Source, X-Bridge-Timestamp, X-Bridge-Signature
"""
from __future__ import annotations

import hashlib
import hmac
import json
import time
from decimal import ROUND_DOWN, Decimal
from typing import Any

import httpx

MODES = ("straight", "reverse")
API_PREFIX = "/api/bridge/v1"

HDR_SOURCE = "X-Bridge-Source"
HDR_TIMESTAMP = "X-Bridge-Timestamp"
HDR_SIGNATURE = "X-Bridge-Signature"


# ─── Trade mapping ────────────────────────────────────────────────────────

def norm_mode(mode: str | None) -> str:
    m = (mode or "straight").strip().lower()
    if m in ("same", "mirror"):
        m = "straight"
    if m not in MODES:
        raise ValueError("mode must be 'straight' or 'reverse'")
    return m


def norm_side(side) -> str:
    s = str(getattr(side, "value", side) or "").strip().lower()
    if s not in ("buy", "sell"):
        raise ValueError(f"invalid side: {side!r}")
    return s


def mirror_side(side, mode: str) -> str:
    """The side the copy is opened with."""
    s = norm_side(side)
    if norm_mode(mode) == "reverse":
        return "sell" if s == "buy" else "buy"
    return s


def mirror_sl_tp(stop_loss, take_profit, mode: str) -> tuple[Decimal | None, Decimal | None]:
    """SL/TP for the copy.

    Straight: unchanged. Reverse: the copy is the opposite position, so the
    source's take-profit level is where the copy loses (its stop-loss) and the
    source's stop-loss is where the copy wins (its take-profit). A BUY 100 with
    SL 95 / TP 110 becomes a SELL with SL 110 / TP 95.
    """
    sl = _dec_or_none(stop_loss)
    tp = _dec_or_none(take_profit)
    if norm_mode(mode) == "reverse":
        return tp, sl
    return sl, tp


def scale_lots(lots, multiplier=1, max_lots=None, lot_step="0.01") -> Decimal:
    """Copy volume: source lots × multiplier, rounded DOWN to the lot step.

    Raises ValueError when the result is zero or over the link's cap — the copy
    is refused rather than silently resized.
    """
    step = Decimal(str(lot_step or "0.01"))
    raw = Decimal(str(lots)) * Decimal(str(multiplier if multiplier is not None else 1))
    out = (raw / step).to_integral_value(rounding=ROUND_DOWN) * step
    if out <= 0:
        raise ValueError(f"copy volume rounds to 0 lots ({lots} × {multiplier})")
    if max_lots is not None and out > Decimal(str(max_lots)):
        raise ValueError(f"copy volume {out} exceeds this link's cap of {max_lots} lots")
    return out


def partial_close_lots(src_lots_before, src_lots_now, copy_lots, lot_step="0.01") -> Decimal:
    """Lots to close on the copy when the source went from `before` to `now` lots.

    The copy closes the same FRACTION the source closed, so a multiplier link
    stays in proportion. Rounded to the lot step; a result at or above the
    copy's volume means close it fully. Returns 0 when nothing should close.
    """
    before = Decimal(str(src_lots_before))
    now = Decimal(str(src_lots_now))
    copy = Decimal(str(copy_lots))
    if before <= 0 or now >= before or copy <= 0:
        return Decimal("0")
    if now <= 0:
        return copy
    step = Decimal(str(lot_step or "0.01"))
    raw = copy * (before - now) / before
    out = (raw / step).to_integral_value() * step   # nearest step
    if out <= 0:
        out = step
    return min(out, copy)


def _dec_or_none(v) -> Decimal | None:
    if v is None or v == "":
        return None
    d = Decimal(str(v))
    return d if d != 0 else None


# ─── Signing ──────────────────────────────────────────────────────────────

def sign(secret: str, timestamp: str, method: str, path: str, body: str) -> str:
    message = f"{timestamp}{method.upper()}{path}{body}".encode("utf-8")
    return hmac.new(secret.encode("utf-8"), message, hashlib.sha256).hexdigest()


def verify(secret: str, timestamp: str, method: str, path: str, body: str,
           signature: str, tolerance_ms: int, now_ms: int | None = None) -> bool:
    if not secret or not timestamp or not signature:
        return False
    try:
        ts = int(timestamp)
    except (TypeError, ValueError):
        return False
    now = int(time.time() * 1000) if now_ms is None else now_ms
    if abs(now - ts) > tolerance_ms:
        return False
    expected = sign(secret, timestamp, method, path, body)
    return hmac.compare_digest(expected, signature)


def signed_headers(secret: str, source: str, method: str, path: str, body: str) -> dict[str, str]:
    ts = str(int(time.time() * 1000))
    return {
        HDR_SOURCE: source,
        HDR_TIMESTAMP: ts,
        HDR_SIGNATURE: sign(secret, ts, method, path, body),
        "Content-Type": "application/json",
    }


# ─── Peer client ──────────────────────────────────────────────────────────

class PeerError(Exception):
    """A call to the peer failed.

    `definitive` is True when the peer understood the request and refused it
    (a 4xx other than 408/409/429) — retrying the same request cannot succeed.
    Anything else (timeouts, 5xx, connection errors, "still in progress") is
    transient: retry later. Inbound opens are idempotent, so a retry after an
    ambiguous failure never opens a second copy.
    """

    def __init__(self, message: str, status: int | None = None, definitive: bool = False):
        super().__init__(message)
        self.status = status
        self.definitive = definitive


class PeerClient:
    def __init__(self, base_url: str, secret: str, source: str, timeout: float = 15.0):
        self.base_url = (base_url or "").rstrip("/")
        self.secret = secret
        self.source = source
        self.timeout = timeout

    async def _call(self, method: str, path: str, payload: dict | None = None) -> dict:
        if not self.base_url or not self.secret:
            raise PeerError("bridge peer URL / shared secret not configured", definitive=True)
        full_path = f"{API_PREFIX}{path}"
        body = json.dumps(payload, separators=(",", ":"), default=str) if payload is not None else ""
        headers = signed_headers(self.secret, self.source, method, full_path, body)
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                r = await client.request(method, self.base_url + full_path,
                                         content=body.encode("utf-8") if body else None,
                                         headers=headers)
        except httpx.HTTPError as e:
            raise PeerError(f"peer unreachable: {type(e).__name__}: {e}") from e
        try:
            data: Any = r.json()
        except ValueError:
            data = {"detail": r.text[:300]}
        if r.status_code >= 400:
            detail = data.get("detail") if isinstance(data, dict) else str(data)
            definitive = 400 <= r.status_code < 500 and r.status_code not in (408, 409, 429)
            raise PeerError(f"peer {r.status_code}: {detail}", status=r.status_code, definitive=definitive)
        return data if isinstance(data, dict) else {"data": data}

    async def ping(self) -> dict:
        return await self._call("GET", "/ping")

    async def account(self, account_number: str) -> dict:
        return await self._call("GET", f"/accounts/{account_number}")

    async def open_trade(self, payload: dict) -> dict:
        return await self._call("POST", "/trades/open", payload)

    async def close_trade(self, payload: dict) -> dict:
        return await self._call("POST", "/trades/close", payload)

    async def modify_trade(self, payload: dict) -> dict:
        return await self._call("POST", "/trades/modify", payload)

    async def trade_status(self, payload: dict) -> dict:
        return await self._call("POST", "/trades/status", payload)


def peer_client_from_settings(settings) -> PeerClient:
    return PeerClient(
        base_url=settings.BRIDGE_PEER_URL,
        secret=settings.BRIDGE_SHARED_SECRET,
        source=settings.BRIDGE_PLATFORM_ID,
    )
