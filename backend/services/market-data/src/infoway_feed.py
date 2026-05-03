"""Real-time bid/ask from Infoway.io WebSocket (depth). No simulation."""

from __future__ import annotations

import asyncio
import contextlib
import json
import logging
import secrets
import urllib.parse
from datetime import datetime, timezone
from typing import Dict, List, Optional

import websockets

logger = logging.getLogger("market-data.infoway")

INFOWAY_WS_BASE = "wss://data.infoway.io/ws"

# Platform symbol -> Infoway product code (crypto uses *USDT on Infoway).
CRYPTO_INFOWAY_CODES: Dict[str, str] = {
    "BTCUSD": "BTCUSDT",
    "ETHUSD": "ETHUSDT",
    "LTCUSD": "LTCUSDT",
    "XRPUSD": "XRPUSDT",
    "SOLUSD": "SOLUSDT",
}

# Infoway may use alternate product codes vs our DB symbols.
INFOWAY_SYMBOL_ALIASES: Dict[str, str] = {
    # WTI / crude aliases → our USOIL instrument
    "XTIUSD": "USOIL",
    "WTIUSD": "USOIL",
    "CLUSD": "USOIL",
}


# Infoway push symbol -> platform symbol (handles USDT pairs and aliases).
def _build_infoway_to_platform(instruments: Dict[str, dict]) -> Dict[str, str]:
    m: Dict[str, str] = {}
    for plat, _info in instruments.items():
        code = CRYPTO_INFOWAY_CODES.get(plat, plat)
        m[code.upper()] = plat
        m[plat.upper()] = plat
    for infoway_sym, plat in INFOWAY_SYMBOL_ALIASES.items():
        if plat in instruments:
            m[infoway_sym.upper()] = plat
    return m


def _trace() -> str:
    return secrets.token_hex(16)


class InfowayFeed:
    """Streams depth (best bid/ask) from Infoway `common` + `crypto` sockets."""

    def __init__(self, api_key: str, instruments: Dict[str, dict]):
        self._api_key = api_key.strip()
        self._instruments = instruments
        self._infoway_to_platform = _build_infoway_to_platform(instruments)

        self._tick_queue: asyncio.Queue = asyncio.Queue(maxsize=50_000)
        self._running = False
        self._tasks: List[asyncio.Task] = []

    @property
    def current_prices(self) -> Dict[str, float]:
        return {}

    async def start(self) -> None:
        self._running = True
        common_codes = [
            CRYPTO_INFOWAY_CODES.get(s, s)
            for s, info in self._instruments.items()
            if info["category"] != "crypto"
        ]
        crypto_codes = [
            CRYPTO_INFOWAY_CODES[s]
            for s in self._instruments
            if self._instruments[s]["category"] == "crypto"
        ]
        logger.info(
            "Infoway feed starting — common=%d symbols, crypto=%d symbols",
            len(common_codes),
            len(crypto_codes),
        )

        if common_codes:
            self._tasks.append(
                asyncio.create_task(
                    self._run_socket("common", common_codes),
                    name="infoway-common",
                )
            )
        if crypto_codes:
            self._tasks.append(
                asyncio.create_task(
                    self._run_socket("crypto", crypto_codes),
                    name="infoway-crypto",
                )
            )

        if not self._tasks:
            logger.error("No instruments configured for Infoway")
            return

        await asyncio.gather(*self._tasks, return_exceptions=True)

    async def stop(self) -> None:
        self._running = False
        for t in self._tasks:
            t.cancel()
        if self._tasks:
            await asyncio.gather(*self._tasks, return_exceptions=True)
        self._tasks.clear()
        logger.info("Infoway feed stopped")

    async def get_tick(self) -> Optional[dict]:
        try:
            return self._tick_queue.get_nowait()
        except asyncio.QueueEmpty:
            return None

    def _ws_url(self, business: str) -> str:
        q = urllib.parse.urlencode({"business": business, "apikey": self._api_key})
        return f"{INFOWAY_WS_BASE}?{q}"

    def _enqueue(self, tick: dict) -> None:
        try:
            self._tick_queue.put_nowait(tick)
        except asyncio.QueueFull:
            try:
                self._tick_queue.get_nowait()
            except asyncio.QueueEmpty:
                pass
            self._tick_queue.put_nowait(tick)

    def _platform_symbol(self, raw: str) -> Optional[str]:
        if not raw:
            return None
        key = raw.strip().upper()
        return self._infoway_to_platform.get(key)

    def _emit_depth(self, data: dict) -> None:
        raw_sym = data.get("s") or ""
        symbol = self._platform_symbol(str(raw_sym))
        if not symbol or symbol not in self._instruments:
            return

        b = data.get("b") or []
        a = data.get("a") or []
        try:
            bid_prices = b[0] if b else []
            ask_prices = a[0] if a else []
            if not bid_prices or not ask_prices:
                return
            bid = float(bid_prices[0])
            ask = float(ask_prices[0])
        except (TypeError, ValueError, IndexError):
            return

        if bid <= 0 or ask <= 0 or ask < bid:
            return

        info = self._instruments[symbol]
        decimals = int(info["decimals"])
        # Collapse provider bid/ask to mid so Infoway's own spread is not shown or
        # double-counted. Platform spread is applied when publishing (see market-data main).
        mid = (bid + ask) / 2.0
        mid_r = round(mid, decimals)
        bid_r = mid_r
        ask_r = mid_r

        ts_ms = data.get("t")
        if isinstance(ts_ms, (int, float)) and ts_ms > 0:
            sec = int(ts_ms // 1000)
            ms = int(ts_ms % 1000)
            dt = datetime.fromtimestamp(sec, tz=timezone.utc)
            timestamp = dt.strftime("%Y-%m-%dT%H:%M:%S.") + f"{ms:03d}Z"
        else:
            ts = datetime.now(timezone.utc)
            timestamp = ts.strftime("%Y-%m-%dT%H:%M:%S.") + f"{ts.microsecond // 1000:03d}Z"

        vol_b = b[1] if len(b) > 1 and b[1] else []
        vol_a = a[1] if len(a) > 1 and a[1] else []
        try:
            volume = int(float(vol_b[0]) + float(vol_a[0])) if vol_b and vol_a else 0
        except (TypeError, ValueError, IndexError):
            volume = 0

        tick = {
            "symbol": symbol,
            "bid": bid_r,
            "ask": ask_r,
            "timestamp": timestamp,
            "volume": max(volume, 1),
        }
        self._enqueue(tick)

    async def _heartbeat_loop(self, ws) -> None:
        while self._running:
            await asyncio.sleep(45.0)
            if not self._running:
                break
            try:
                msg = json.dumps({"code": 10010, "trace": _trace()})
                await ws.send(msg)
            except Exception as exc:
                logger.debug("Infoway heartbeat send failed: %s", exc)
                break

    async def _run_socket(self, business: str, codes: List[str]) -> None:
        if not codes:
            return
        # One depth subscription per connection; comma-separated codes.
        codes_str = ",".join(sorted(set(codes)))
        url = self._ws_url(business)

        while self._running:
            hb_task: Optional[asyncio.Task] = None
            try:
                logger.info("Infoway [%s] connecting…", business)
                async with websockets.connect(
                    url,
                    ping_interval=20,
                    ping_timeout=25,
                    close_timeout=10,
                ) as ws:
                    sub = json.dumps(
                        {
                            "code": 10003,
                            "trace": _trace(),
                            "data": {"codes": codes_str},
                        }
                    )
                    await ws.send(sub)
                    logger.info(
                        "Infoway [%s] subscribed depth for %d codes",
                        business,
                        len(set(codes)),
                    )

                    hb_task = asyncio.create_task(self._heartbeat_loop(ws))

                    async for raw in ws:
                        if not self._running:
                            break
                        try:
                            msg = json.loads(raw)
                        except json.JSONDecodeError:
                            continue
                        code = msg.get("code")
                        if code == 10005:
                            self._emit_depth(msg.get("data") or {})
                        elif code in (10004, 10001):
                            logger.debug("Infoway [%s] ack: %s", business, msg.get("msg"))
                        elif code and code >= 400:
                            logger.warning(
                                "Infoway [%s] error (check API key / plan / symbol limits): %s",
                                business,
                                msg,
                            )
            except asyncio.CancelledError:
                break
            except Exception as exc:
                logger.warning("Infoway [%s] WebSocket error: %s — reconnect in 5s", business, exc)
                await asyncio.sleep(5)
            finally:
                if hb_task:
                    hb_task.cancel()
                    with contextlib.suppress(asyncio.CancelledError):
                        await hb_task

        logger.info("Infoway [%s] task ended", business)
