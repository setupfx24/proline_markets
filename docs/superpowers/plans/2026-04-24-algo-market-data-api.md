# Algo Market Data API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing Proline Markets algo API so the same `X-Api-Key` + `X-Api-Secret` that places trades also delivers full market data (live WebSocket stream, snapshot REST, historical OHLC bars, symbol list) — sourced from the same LP pipeline that feeds the internal frontend.

**Architecture:** Reuse the existing Redis `prices` pub/sub channel, `tick:{symbol}` hot cache, and TimescaleDB hypertable. Add one WebSocket route with first-message auth, and four REST routes that delegate to the existing `validate_api_credentials()` helper. Zero DB migrations; zero changes to LP ingestion or market-data service.

**Tech Stack:** FastAPI, SQLAlchemy 2.0 (async), asyncpg, Redis (pub/sub + counters), TimescaleDB (`time_bucket` for on-the-fly 15m/4h/1d aggregation), pytest, pytest-asyncio, `websockets` client for WS tests.

**Spec:** [docs/superpowers/specs/2026-04-24-algo-market-data-api-design.md](../specs/2026-04-24-algo-market-data-api-design.md)

---

## Task Ordering Rationale

1. **Symbol spec first** — pure data, no dependencies, lets `/symbols` and validation in every later task reference a single source of truth.
2. **Rate limit helper** — small utility, zero dependencies, reused by all REST routes and WS handler.
3. **Bar aggregation helper** — used only by `/bars`, but complex enough (SQL + time_bucket) to isolate and test alone.
4. **REST endpoints** — build in order of complexity: `/symbols` (static) → `/price` (single Redis read) → `/prices` (multi Redis read) → `/bars` (TimescaleDB + aggregation).
5. **WS endpoint last** — most complex (auth flow, registry, heartbeat, Redis subscription). All dependencies already in place.
6. **Docs + rollout** — after code is tested end-to-end.

---

## Task 1: Symbol Spec Module

**Files:**
- Create: `backend/packages/common/src/symbol_spec.py`
- Test: `backend/packages/common/tests/test_symbol_spec.py`

**Purpose:** Single source of truth for the 28 supported symbols with their metadata. Used by `/api/algo/symbols`, input validation on other endpoints, and future trading logic.

- [ ] **Step 1: Write the failing test**

```python
# backend/packages/common/tests/test_symbol_spec.py
import pytest
from common.symbol_spec import (
    SUPPORTED_SYMBOLS,
    SYMBOL_MAP,
    SymbolSpec,
    is_supported,
    get_symbol_spec,
)


def test_supported_symbols_has_28_entries():
    assert len(SUPPORTED_SYMBOLS) == 28


def test_all_entries_are_symbol_spec_instances():
    for spec in SUPPORTED_SYMBOLS:
        assert isinstance(spec, SymbolSpec)
        assert spec.symbol.isupper()
        assert spec.category in {"forex", "metals", "crypto", "indices"}
        assert spec.min_lot > 0
        assert spec.lot_step > 0
        assert spec.digits >= 0


def test_symbol_map_keyed_by_uppercase_symbol():
    assert "XAUUSD" in SYMBOL_MAP
    assert SYMBOL_MAP["XAUUSD"].category == "metals"


def test_is_supported_case_insensitive():
    assert is_supported("xauusd") is True
    assert is_supported("XAUUSD") is True
    assert is_supported("FAKEPAIR") is False


def test_get_symbol_spec_case_insensitive():
    spec = get_symbol_spec("xauusd")
    assert spec.symbol == "XAUUSD"


def test_get_symbol_spec_returns_none_for_unknown():
    assert get_symbol_spec("FAKEPAIR") is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend/packages/common && pytest tests/test_symbol_spec.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'common.symbol_spec'`

- [ ] **Step 3: Write minimal implementation**

```python
# backend/packages/common/src/symbol_spec.py
from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class SymbolSpec:
    symbol: str
    category: str  # "forex" | "metals" | "crypto" | "indices"
    min_lot: float
    lot_step: float
    digits: int


SUPPORTED_SYMBOLS: list[SymbolSpec] = [
    # Forex majors
    SymbolSpec("EURUSD", "forex", 0.01, 0.01, 5),
    SymbolSpec("GBPUSD", "forex", 0.01, 0.01, 5),
    SymbolSpec("USDJPY", "forex", 0.01, 0.01, 3),
    SymbolSpec("USDCHF", "forex", 0.01, 0.01, 5),
    SymbolSpec("AUDUSD", "forex", 0.01, 0.01, 5),
    SymbolSpec("NZDUSD", "forex", 0.01, 0.01, 5),
    SymbolSpec("USDCAD", "forex", 0.01, 0.01, 5),
    # Forex crosses
    SymbolSpec("EURGBP", "forex", 0.01, 0.01, 5),
    SymbolSpec("EURJPY", "forex", 0.01, 0.01, 3),
    SymbolSpec("GBPJPY", "forex", 0.01, 0.01, 3),
    SymbolSpec("EURAUD", "forex", 0.01, 0.01, 5),
    SymbolSpec("EURCAD", "forex", 0.01, 0.01, 5),
    SymbolSpec("EURCHF", "forex", 0.01, 0.01, 5),
    SymbolSpec("GBPAUD", "forex", 0.01, 0.01, 5),
    SymbolSpec("GBPCAD", "forex", 0.01, 0.01, 5),
    # Metals
    SymbolSpec("XAUUSD", "metals", 0.01, 0.01, 2),
    SymbolSpec("XAGUSD", "metals", 0.01, 0.01, 3),
    # Crypto
    SymbolSpec("BTCUSD", "crypto", 0.01, 0.01, 1),
    SymbolSpec("ETHUSD", "crypto", 0.01, 0.01, 2),
    SymbolSpec("XRPUSD", "crypto", 0.01, 0.01, 4),
    SymbolSpec("LTCUSD", "crypto", 0.01, 0.01, 2),
    SymbolSpec("BCHUSD", "crypto", 0.01, 0.01, 2),
    # Indices
    SymbolSpec("US30",   "indices", 0.01, 0.01, 1),
    SymbolSpec("US500",  "indices", 0.01, 0.01, 2),
    SymbolSpec("USTEC",  "indices", 0.01, 0.01, 2),
    SymbolSpec("UK100",  "indices", 0.01, 0.01, 1),
    SymbolSpec("GER40",  "indices", 0.01, 0.01, 1),
    SymbolSpec("JPN225", "indices", 0.01, 0.01, 1),
]

SYMBOL_MAP: dict[str, SymbolSpec] = {s.symbol: s for s in SUPPORTED_SYMBOLS}


def is_supported(symbol: str) -> bool:
    return symbol.upper() in SYMBOL_MAP


def get_symbol_spec(symbol: str) -> Optional[SymbolSpec]:
    return SYMBOL_MAP.get(symbol.upper())
```

> **Note to engineer:** Confirm the exact 28 symbols with the existing `feed_handler.py` in `backend/services/market-data/` — replace the list above if the canonical set differs. The count must be 28 (spec requirement).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend/packages/common && pytest tests/test_symbol_spec.py -v`
Expected: all 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/packages/common/src/symbol_spec.py backend/packages/common/tests/test_symbol_spec.py
git commit -m "feat: add symbol_spec module — single source of truth for 28 supported instruments"
```

---

## Task 2: Rate Limit Helper

**Files:**
- Create: `backend/services/gateway/src/core/algo_rate_limit.py`
- Test: `backend/services/gateway/tests/core/test_algo_rate_limit.py`

**Purpose:** Redis-backed fixed-window counter. Used by all algo market-data routes to enforce per-key limits.

- [ ] **Step 1: Write the failing test**

```python
# backend/services/gateway/tests/core/test_algo_rate_limit.py
import pytest
from unittest.mock import AsyncMock
from gateway.core.algo_rate_limit import (
    enforce_rate_limit,
    RateLimitExceeded,
)


@pytest.mark.asyncio
async def test_under_limit_allows_request():
    redis = AsyncMock()
    redis.incr.return_value = 5
    redis.expire.return_value = True

    # Should not raise
    await enforce_rate_limit(redis, api_key="ak_test", bucket="market_read", limit=60)

    redis.incr.assert_awaited_once()
    redis.expire.assert_awaited_once()


@pytest.mark.asyncio
async def test_at_limit_raises():
    redis = AsyncMock()
    redis.incr.return_value = 61  # 61st call in the same minute
    redis.ttl.return_value = 23

    with pytest.raises(RateLimitExceeded) as exc:
        await enforce_rate_limit(redis, api_key="ak_test", bucket="market_read", limit=60)

    assert "60/min" in exc.value.detail
    assert "23s" in exc.value.detail


@pytest.mark.asyncio
async def test_expire_only_set_on_first_increment():
    redis = AsyncMock()
    redis.incr.return_value = 1  # first call of this minute
    await enforce_rate_limit(redis, api_key="ak_test", bucket="market_read", limit=60)
    redis.expire.assert_awaited_once()

    redis2 = AsyncMock()
    redis2.incr.return_value = 2  # second call
    await enforce_rate_limit(redis2, api_key="ak_test", bucket="market_read", limit=60)
    redis2.expire.assert_not_awaited()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend/services/gateway && pytest tests/core/test_algo_rate_limit.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'gateway.core.algo_rate_limit'`

- [ ] **Step 3: Write minimal implementation**

```python
# backend/services/gateway/src/core/algo_rate_limit.py
import time
from dataclasses import dataclass


@dataclass
class RateLimitExceeded(Exception):
    detail: str
    retry_after_seconds: int


async def enforce_rate_limit(redis, *, api_key: str, bucket: str, limit: int) -> None:
    """Fixed-window counter. Raises RateLimitExceeded on breach.

    Key format: rate_limit:algo:{api_key}:{bucket}:{minute_epoch}
    TTL: 60s (set only on first increment of the window).
    """
    minute_bucket = int(time.time()) // 60
    key = f"rate_limit:algo:{api_key}:{bucket}:{minute_bucket}"

    count = await redis.incr(key)
    if count == 1:
        await redis.expire(key, 60)

    if count > limit:
        ttl = await redis.ttl(key)
        raise RateLimitExceeded(
            detail=f"Rate limit exceeded ({limit}/min). Retry in {ttl}s",
            retry_after_seconds=ttl,
        )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend/services/gateway && pytest tests/core/test_algo_rate_limit.py -v`
Expected: all 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/services/gateway/src/core/algo_rate_limit.py backend/services/gateway/tests/core/test_algo_rate_limit.py
git commit -m "feat: algo rate-limit helper — Redis fixed-window counter per (api_key, bucket)"
```

---

## Task 3: Bar Aggregation Helper

**Files:**
- Create: `backend/services/gateway/src/api/algo_market_data.py` (start the module with only the bar helper)
- Test: `backend/services/gateway/tests/api/test_algo_bars_aggregation.py`

**Purpose:** Convert a requested timeframe to a (source_table, time_bucket_interval) pair, and run the aggregated query against TimescaleDB. Isolated here because SQL + time_bucket is the trickiest piece.

- [ ] **Step 1: Write the failing test**

```python
# backend/services/gateway/tests/api/test_algo_bars_aggregation.py
import pytest
from gateway.api.algo_market_data import (
    resolve_bar_source,
    BarSource,
    InvalidTimeframe,
)


def test_1m_maps_to_bars_1m_no_aggregation():
    src = resolve_bar_source("1m")
    assert src == BarSource(table="bars_1m", interval=None)


def test_5m_maps_to_bars_5m_no_aggregation():
    src = resolve_bar_source("5m")
    assert src == BarSource(table="bars_5m", interval=None)


def test_15m_aggregates_from_bars_1m():
    src = resolve_bar_source("15m")
    assert src == BarSource(table="bars_1m", interval="15 minutes")


def test_1h_maps_to_bars_1h_no_aggregation():
    src = resolve_bar_source("1h")
    assert src == BarSource(table="bars_1h", interval=None)


def test_4h_aggregates_from_bars_1h():
    src = resolve_bar_source("4h")
    assert src == BarSource(table="bars_1h", interval="4 hours")


def test_1d_aggregates_from_bars_1h():
    src = resolve_bar_source("1d")
    assert src == BarSource(table="bars_1h", interval="1 day")


def test_unknown_timeframe_raises():
    with pytest.raises(InvalidTimeframe):
        resolve_bar_source("3m")

    with pytest.raises(InvalidTimeframe):
        resolve_bar_source("1w")


def test_case_insensitive():
    assert resolve_bar_source("1M") == BarSource(table="bars_1m", interval=None)
    assert resolve_bar_source("1H") == BarSource(table="bars_1h", interval=None)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend/services/gateway && pytest tests/api/test_algo_bars_aggregation.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'gateway.api.algo_market_data'`

- [ ] **Step 3: Write minimal implementation**

```python
# backend/services/gateway/src/api/algo_market_data.py
from dataclasses import dataclass
from typing import Optional


class InvalidTimeframe(ValueError):
    pass


@dataclass(frozen=True)
class BarSource:
    table: str
    interval: Optional[str]  # None = direct SELECT; non-None = time_bucket aggregation


_TIMEFRAME_MAP: dict[str, BarSource] = {
    "1m":  BarSource(table="bars_1m", interval=None),
    "5m":  BarSource(table="bars_5m", interval=None),
    "15m": BarSource(table="bars_1m", interval="15 minutes"),
    "1h":  BarSource(table="bars_1h", interval=None),
    "4h":  BarSource(table="bars_1h", interval="4 hours"),
    "1d":  BarSource(table="bars_1h", interval="1 day"),
}


def resolve_bar_source(timeframe: str) -> BarSource:
    tf = timeframe.lower()
    if tf not in _TIMEFRAME_MAP:
        valid = ", ".join(_TIMEFRAME_MAP.keys())
        raise InvalidTimeframe(f"timeframe must be one of: {valid}")
    return _TIMEFRAME_MAP[tf]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend/services/gateway && pytest tests/api/test_algo_bars_aggregation.py -v`
Expected: all 8 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/services/gateway/src/api/algo_market_data.py backend/services/gateway/tests/api/test_algo_bars_aggregation.py
git commit -m "feat: algo bars — timeframe→source resolver (1m/5m/1h direct, 15m/4h/1d aggregated)"
```

---

## Task 4: GET /api/algo/symbols Endpoint

**Files:**
- Modify: `backend/services/gateway/src/api/algo_market_data.py` (add handler)
- Modify: `backend/services/gateway/src/api/algo_connector.py` (register route)
- Test: `backend/services/gateway/tests/api/test_algo_symbols.py`

**Purpose:** Simplest endpoint — returns static metadata for all 28 symbols. Lets us wire up the auth + rate-limit plumbing and verify routing before tackling data-heavy endpoints.

- [ ] **Step 1: Write the failing test**

```python
# backend/services/gateway/tests/api/test_algo_symbols.py
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_symbols_returns_28_entries(algo_client: AsyncClient, valid_api_headers):
    r = await algo_client.get("/api/algo/symbols", headers=valid_api_headers)
    assert r.status_code == 200

    body = r.json()
    assert body["count"] == 28
    assert len(body["symbols"]) == 28

    first = body["symbols"][0]
    assert set(first.keys()) == {"symbol", "category", "min_lot", "lot_step", "digits"}


@pytest.mark.asyncio
async def test_symbols_requires_auth(algo_client: AsyncClient):
    r = await algo_client.get("/api/algo/symbols")
    assert r.status_code == 401
    assert r.json()["detail"] == "Missing X-Api-Key or X-Api-Secret"


@pytest.mark.asyncio
async def test_symbols_rejects_bad_creds(algo_client: AsyncClient):
    r = await algo_client.get(
        "/api/algo/symbols",
        headers={"X-Api-Key": "ak_fake", "X-Api-Secret": "sk_fake"},
    )
    assert r.status_code == 401
    assert r.json()["detail"] == "Invalid API credentials"
```

> **Fixture note:** `algo_client` and `valid_api_headers` fixtures must exist in the gateway's `conftest.py`. If not, add them: `valid_api_headers` seeds one `algo_api_keys` row and returns `{"X-Api-Key": key, "X-Api-Secret": secret}`. Check `backend/services/gateway/tests/conftest.py` first — the existing `/api/algo/trade` tests likely have these fixtures already.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend/services/gateway && pytest tests/api/test_algo_symbols.py -v`
Expected: FAIL — route not registered, 404 instead of 200.

- [ ] **Step 3: Implement handler in algo_market_data.py**

Append to `backend/services/gateway/src/api/algo_market_data.py`:

```python
from fastapi import APIRouter, Header, HTTPException, Request
from typing import Optional
from common.symbol_spec import SUPPORTED_SYMBOLS
from gateway.api.algo_connector import validate_api_credentials
from gateway.core.algo_rate_limit import enforce_rate_limit, RateLimitExceeded

router = APIRouter(prefix="/api/algo", tags=["algo-market-data"])


def _bad_creds_guard(api_key: Optional[str], api_secret: Optional[str]) -> None:
    if not api_key or not api_secret:
        raise HTTPException(status_code=401, detail="Missing X-Api-Key or X-Api-Secret")


@router.get("/symbols")
async def get_symbols(
    request: Request,
    x_api_key: Optional[str] = Header(None, alias="X-Api-Key"),
    x_api_secret: Optional[str] = Header(None, alias="X-Api-Secret"),
):
    _bad_creds_guard(x_api_key, x_api_secret)
    await validate_api_credentials(x_api_key, x_api_secret)

    try:
        await enforce_rate_limit(
            request.app.state.redis,
            api_key=x_api_key,
            bucket="market_read",
            limit=60,
        )
    except RateLimitExceeded as exc:
        raise HTTPException(status_code=429, detail=exc.detail)

    return {
        "symbols": [
            {
                "symbol": s.symbol,
                "category": s.category,
                "min_lot": s.min_lot,
                "lot_step": s.lot_step,
                "digits": s.digits,
            }
            for s in SUPPORTED_SYMBOLS
        ],
        "count": len(SUPPORTED_SYMBOLS),
    }
```

- [ ] **Step 4: Register router in algo_connector.py**

In `backend/services/gateway/src/api/algo_connector.py`, near the existing `router` registration, add:

```python
# At the bottom of the file (or wherever the app/main includes sub-routers)
from gateway.api.algo_market_data import router as algo_market_data_router
# Then in the main app setup (wherever other routers are included):
# app.include_router(algo_market_data_router)
```

> **Engineer:** Check how existing routers are included in `main.py`. If `algo_connector.py` exposes a `router` that is included in `main.py`, do the same for `algo_market_data_router` there. Don't guess — open `main.py` and mirror the existing pattern.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend/services/gateway && pytest tests/api/test_algo_symbols.py -v`
Expected: all 3 tests PASS

- [ ] **Step 6: Commit**

```bash
git add backend/services/gateway/src/api/algo_market_data.py backend/services/gateway/src/api/algo_connector.py backend/services/gateway/src/main.py backend/services/gateway/tests/api/test_algo_symbols.py
git commit -m "feat: GET /api/algo/symbols — list 28 supported instruments with spec"
```

---

## Task 5: GET /api/algo/price (Single Snapshot)

**Files:**
- Modify: `backend/services/gateway/src/api/algo_market_data.py`
- Test: `backend/services/gateway/tests/api/test_algo_price.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/services/gateway/tests/api/test_algo_price.py
import json
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_price_returns_current_snapshot(algo_client: AsyncClient, valid_api_headers, redis_client):
    await redis_client.set(
        "tick:XAUUSD",
        json.dumps({
            "symbol": "XAUUSD",
            "bid": 2650.45,
            "ask": 2650.60,
            "timestamp": "2026-04-24T14:35:22.123Z",
            "spread": 0.15,
        }),
    )

    r = await algo_client.get("/api/algo/price?symbol=XAUUSD", headers=valid_api_headers)
    assert r.status_code == 200
    body = r.json()
    assert body["symbol"] == "XAUUSD"
    assert body["bid"] == 2650.45
    assert body["ask"] == 2650.60
    assert body["spread"] == 0.15
    assert body["timestamp"] == "2026-04-24T14:35:22.123Z"


@pytest.mark.asyncio
async def test_price_is_case_insensitive(algo_client, valid_api_headers, redis_client):
    await redis_client.set("tick:XAUUSD", json.dumps({
        "symbol": "XAUUSD", "bid": 1, "ask": 2, "timestamp": "2026-04-24T00:00:00Z", "spread": 1
    }))
    r = await algo_client.get("/api/algo/price?symbol=xauusd", headers=valid_api_headers)
    assert r.status_code == 200
    assert r.json()["symbol"] == "XAUUSD"


@pytest.mark.asyncio
async def test_price_unknown_symbol_returns_404(algo_client, valid_api_headers):
    r = await algo_client.get("/api/algo/price?symbol=FAKEPAIR", headers=valid_api_headers)
    assert r.status_code == 404
    assert r.json()["detail"] == "Instrument FAKEPAIR not found"


@pytest.mark.asyncio
async def test_price_no_data_yet_returns_503(algo_client, valid_api_headers, redis_client):
    # Known symbol, but no tick yet in Redis
    await redis_client.delete("tick:GER40")
    r = await algo_client.get("/api/algo/price?symbol=GER40", headers=valid_api_headers)
    assert r.status_code == 503
    assert r.json()["detail"] == "No price data for GER40"


@pytest.mark.asyncio
async def test_price_missing_symbol_param_returns_400(algo_client, valid_api_headers):
    r = await algo_client.get("/api/algo/price", headers=valid_api_headers)
    assert r.status_code == 400
    assert "symbol is required" in r.json()["detail"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend/services/gateway && pytest tests/api/test_algo_price.py -v`
Expected: FAIL — route not registered.

- [ ] **Step 3: Add handler to algo_market_data.py**

Append:

```python
import json
from common.symbol_spec import is_supported, get_symbol_spec


@router.get("/price")
async def get_price(
    request: Request,
    symbol: Optional[str] = None,
    x_api_key: Optional[str] = Header(None, alias="X-Api-Key"),
    x_api_secret: Optional[str] = Header(None, alias="X-Api-Secret"),
):
    _bad_creds_guard(x_api_key, x_api_secret)
    await validate_api_credentials(x_api_key, x_api_secret)

    if not symbol:
        raise HTTPException(status_code=400, detail="symbol is required")

    symbol_upper = symbol.upper()
    if not is_supported(symbol_upper):
        raise HTTPException(status_code=404, detail=f"Instrument {symbol_upper} not found")

    try:
        await enforce_rate_limit(
            request.app.state.redis,
            api_key=x_api_key,
            bucket="market_read",
            limit=60,
        )
    except RateLimitExceeded as exc:
        raise HTTPException(status_code=429, detail=exc.detail)

    raw = await request.app.state.redis.get(f"tick:{symbol_upper}")
    if raw is None:
        raise HTTPException(status_code=503, detail=f"No price data for {symbol_upper}")

    tick = json.loads(raw)
    return {
        "symbol": symbol_upper,
        "bid": tick["bid"],
        "ask": tick["ask"],
        "spread": tick.get("spread", tick["ask"] - tick["bid"]),
        "timestamp": tick["timestamp"],
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend/services/gateway && pytest tests/api/test_algo_price.py -v`
Expected: all 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/services/gateway/src/api/algo_market_data.py backend/services/gateway/tests/api/test_algo_price.py
git commit -m "feat: GET /api/algo/price — single-symbol snapshot from Redis tick cache"
```

---

## Task 6: GET /api/algo/prices (Multi-Symbol Snapshot)

**Files:**
- Modify: `backend/services/gateway/src/api/algo_market_data.py`
- Test: `backend/services/gateway/tests/api/test_algo_prices_multi.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/services/gateway/tests/api/test_algo_prices_multi.py
import json
import pytest


@pytest.mark.asyncio
async def test_prices_multi_filtered(algo_client, valid_api_headers, redis_client):
    await redis_client.set("tick:XAUUSD", json.dumps({
        "symbol": "XAUUSD", "bid": 2650.45, "ask": 2650.60, "timestamp": "2026-04-24T00:00:00Z", "spread": 0.15
    }))
    await redis_client.set("tick:EURUSD", json.dumps({
        "symbol": "EURUSD", "bid": 1.0823, "ask": 1.0824, "timestamp": "2026-04-24T00:00:00Z", "spread": 0.0001
    }))

    r = await algo_client.get(
        "/api/algo/prices?symbols=XAUUSD,EURUSD",
        headers=valid_api_headers,
    )
    assert r.status_code == 200
    body = r.json()
    assert body["count"] == 2
    symbols = {p["symbol"] for p in body["prices"]}
    assert symbols == {"XAUUSD", "EURUSD"}


@pytest.mark.asyncio
async def test_prices_missing_tick_is_omitted_not_erroring(algo_client, valid_api_headers, redis_client):
    await redis_client.set("tick:XAUUSD", json.dumps({
        "symbol": "XAUUSD", "bid": 1, "ask": 2, "timestamp": "2026-04-24T00:00:00Z", "spread": 1
    }))
    await redis_client.delete("tick:EURUSD")

    r = await algo_client.get(
        "/api/algo/prices?symbols=XAUUSD,EURUSD",
        headers=valid_api_headers,
    )
    assert r.status_code == 200
    body = r.json()
    assert body["count"] == 1
    assert body["prices"][0]["symbol"] == "XAUUSD"


@pytest.mark.asyncio
async def test_prices_unknown_symbol_returns_404(algo_client, valid_api_headers):
    r = await algo_client.get(
        "/api/algo/prices?symbols=FAKEPAIR,XAUUSD",
        headers=valid_api_headers,
    )
    assert r.status_code == 404
    assert "FAKEPAIR" in r.json()["detail"]


@pytest.mark.asyncio
async def test_prices_omitted_symbols_returns_all_28(algo_client, valid_api_headers, redis_client):
    # seed ticks for 3 symbols
    for sym in ["XAUUSD", "EURUSD", "BTCUSD"]:
        await redis_client.set(f"tick:{sym}", json.dumps({
            "symbol": sym, "bid": 1, "ask": 2, "timestamp": "2026-04-24T00:00:00Z", "spread": 1
        }))

    r = await algo_client.get("/api/algo/prices", headers=valid_api_headers)
    assert r.status_code == 200
    body = r.json()
    assert body["count"] == 3  # only symbols with ticks are returned


@pytest.mark.asyncio
async def test_prices_too_many_symbols_returns_400(algo_client, valid_api_headers):
    too_many = ",".join([f"SYM{i}" for i in range(29)])
    r = await algo_client.get(
        f"/api/algo/prices?symbols={too_many}",
        headers=valid_api_headers,
    )
    assert r.status_code == 400
    assert "cannot exceed 28" in r.json()["detail"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend/services/gateway && pytest tests/api/test_algo_prices_multi.py -v`
Expected: FAIL — route not registered.

- [ ] **Step 3: Add handler to algo_market_data.py**

Append:

```python
from common.symbol_spec import SUPPORTED_SYMBOLS


@router.get("/prices")
async def get_prices(
    request: Request,
    symbols: Optional[str] = None,
    x_api_key: Optional[str] = Header(None, alias="X-Api-Key"),
    x_api_secret: Optional[str] = Header(None, alias="X-Api-Secret"),
):
    _bad_creds_guard(x_api_key, x_api_secret)
    await validate_api_credentials(x_api_key, x_api_secret)

    if symbols:
        requested = [s.strip().upper() for s in symbols.split(",") if s.strip()]
        if len(requested) > 28:
            raise HTTPException(status_code=400, detail="symbols list cannot exceed 28 items")
        for s in requested:
            if not is_supported(s):
                raise HTTPException(status_code=404, detail=f"Instrument {s} not found")
    else:
        requested = [s.symbol for s in SUPPORTED_SYMBOLS]

    try:
        await enforce_rate_limit(
            request.app.state.redis,
            api_key=x_api_key,
            bucket="market_read",
            limit=60,
        )
    except RateLimitExceeded as exc:
        raise HTTPException(status_code=429, detail=exc.detail)

    redis = request.app.state.redis
    keys = [f"tick:{s}" for s in requested]
    raws = await redis.mget(keys)

    prices = []
    for sym, raw in zip(requested, raws):
        if raw is None:
            continue
        tick = json.loads(raw)
        prices.append({
            "symbol": sym,
            "bid": tick["bid"],
            "ask": tick["ask"],
            "spread": tick.get("spread", tick["ask"] - tick["bid"]),
            "timestamp": tick["timestamp"],
        })

    return {"prices": prices, "count": len(prices)}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend/services/gateway && pytest tests/api/test_algo_prices_multi.py -v`
Expected: all 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/services/gateway/src/api/algo_market_data.py backend/services/gateway/tests/api/test_algo_prices_multi.py
git commit -m "feat: GET /api/algo/prices — multi-symbol snapshot via MGET (max 28 symbols)"
```

---

## Task 7: GET /api/algo/bars (Historical OHLC)

**Files:**
- Modify: `backend/services/gateway/src/api/algo_market_data.py`
- Test: `backend/services/gateway/tests/api/test_algo_bars.py`

**Purpose:** Query TimescaleDB for historical bars. For 1m/5m/1h return rows directly from the native bars tables; for 15m/4h/1d, aggregate on-the-fly with `time_bucket`.

- [ ] **Step 1: Write the failing test**

```python
# backend/services/gateway/tests/api/test_algo_bars.py
import pytest
from datetime import datetime, timezone, timedelta


@pytest.mark.asyncio
async def test_bars_1m_direct_query(algo_client, valid_api_headers, db_session):
    # Seed 5 minute-bars for XAUUSD
    base = datetime(2026, 4, 24, 14, 0, tzinfo=timezone.utc)
    for i in range(5):
        await db_session.execute(
            "INSERT INTO bars_1m (time, symbol, open, high, low, close, volume) "
            "VALUES (:t, 'XAUUSD', :o, :h, :l, :c, 100)",
            {"t": base + timedelta(minutes=i), "o": 2650 + i, "h": 2651 + i, "l": 2649 + i, "c": 2650 + i},
        )
    await db_session.commit()

    r = await algo_client.get(
        "/api/algo/bars?symbol=XAUUSD&timeframe=1m&limit=5",
        headers=valid_api_headers,
    )
    assert r.status_code == 200
    body = r.json()
    assert body["symbol"] == "XAUUSD"
    assert body["timeframe"] == "1m"
    assert body["count"] == 5
    # Newest first
    assert body["bars"][0]["time"] > body["bars"][-1]["time"]


@pytest.mark.asyncio
async def test_bars_15m_aggregation_from_1m(algo_client, valid_api_headers, db_session):
    # Seed 30 minute-bars, expect 2 × 15m aggregated bars
    base = datetime(2026, 4, 24, 14, 0, tzinfo=timezone.utc)
    for i in range(30):
        await db_session.execute(
            "INSERT INTO bars_1m (time, symbol, open, high, low, close, volume) "
            "VALUES (:t, 'XAUUSD', :o, :h, :l, :c, 100)",
            {"t": base + timedelta(minutes=i), "o": 2650, "h": 2651, "l": 2649, "c": 2650},
        )
    await db_session.commit()

    r = await algo_client.get(
        "/api/algo/bars?symbol=XAUUSD&timeframe=15m&limit=10",
        headers=valid_api_headers,
    )
    assert r.status_code == 200
    body = r.json()
    assert body["count"] == 2
    # Each bucket aggregates 15 × 100 volume
    assert all(b["volume"] == 1500 for b in body["bars"])


@pytest.mark.asyncio
async def test_bars_invalid_timeframe_returns_400(algo_client, valid_api_headers):
    r = await algo_client.get(
        "/api/algo/bars?symbol=XAUUSD&timeframe=3m",
        headers=valid_api_headers,
    )
    assert r.status_code == 400
    assert "must be one of" in r.json()["detail"]


@pytest.mark.asyncio
async def test_bars_limit_above_1000_returns_400(algo_client, valid_api_headers):
    r = await algo_client.get(
        "/api/algo/bars?symbol=XAUUSD&timeframe=1m&limit=1001",
        headers=valid_api_headers,
    )
    assert r.status_code == 400
    assert "between 1 and 1000" in r.json()["detail"]


@pytest.mark.asyncio
async def test_bars_unknown_symbol_returns_404(algo_client, valid_api_headers):
    r = await algo_client.get(
        "/api/algo/bars?symbol=FAKE&timeframe=1m",
        headers=valid_api_headers,
    )
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_bars_uses_bars_bucket_rate_limit(algo_client, valid_api_headers, redis_client):
    # 21st call within a minute should 429 (bucket=bars, limit=20)
    for _ in range(20):
        r = await algo_client.get(
            "/api/algo/bars?symbol=XAUUSD&timeframe=1m",
            headers=valid_api_headers,
        )
        assert r.status_code in (200, 404, 503)  # any non-429 is fine

    r = await algo_client.get(
        "/api/algo/bars?symbol=XAUUSD&timeframe=1m",
        headers=valid_api_headers,
    )
    assert r.status_code == 429
    assert "20/min" in r.json()["detail"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend/services/gateway && pytest tests/api/test_algo_bars.py -v`
Expected: FAIL — route not registered.

- [ ] **Step 3: Add handler to algo_market_data.py**

Append:

```python
from datetime import datetime, timezone


@router.get("/bars")
async def get_bars(
    request: Request,
    symbol: Optional[str] = None,
    timeframe: Optional[str] = None,
    limit: int = 100,
    from_: Optional[str] = None,
    to: Optional[str] = None,
    x_api_key: Optional[str] = Header(None, alias="X-Api-Key"),
    x_api_secret: Optional[str] = Header(None, alias="X-Api-Secret"),
):
    _bad_creds_guard(x_api_key, x_api_secret)
    await validate_api_credentials(x_api_key, x_api_secret)

    if not symbol:
        raise HTTPException(status_code=400, detail="symbol is required")
    if not timeframe:
        raise HTTPException(status_code=400, detail="timeframe is required")

    symbol_upper = symbol.upper()
    if not is_supported(symbol_upper):
        raise HTTPException(status_code=404, detail=f"Instrument {symbol_upper} not found")

    try:
        src = resolve_bar_source(timeframe)
    except InvalidTimeframe as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    if limit < 1 or limit > 1000:
        raise HTTPException(status_code=400, detail="limit must be between 1 and 1000")

    try:
        await enforce_rate_limit(
            request.app.state.redis,
            api_key=x_api_key,
            bucket="bars",
            limit=20,
        )
    except RateLimitExceeded as exc:
        raise HTTPException(status_code=429, detail=exc.detail)

    from_ts = datetime.fromisoformat(from_.replace("Z", "+00:00")) if from_ else None
    to_ts = datetime.fromisoformat(to.replace("Z", "+00:00")) if to else datetime.now(timezone.utc)

    bars = await _query_bars(
        db=request.app.state.db,
        source=src,
        symbol=symbol_upper,
        from_ts=from_ts,
        to_ts=to_ts,
        limit=limit,
    )

    return {
        "symbol": symbol_upper,
        "timeframe": timeframe.lower(),
        "bars": bars,
        "count": len(bars),
    }


async def _query_bars(*, db, source: BarSource, symbol: str, from_ts, to_ts, limit: int):
    where_from = "AND time >= :from_ts" if from_ts else ""
    params = {"symbol": symbol, "to_ts": to_ts, "limit": limit}
    if from_ts:
        params["from_ts"] = from_ts

    if source.interval is None:
        sql = f"""
            SELECT time, open, high, low, close, volume
            FROM {source.table}
            WHERE symbol = :symbol AND time < :to_ts {where_from}
            ORDER BY time DESC
            LIMIT :limit
        """
        rows = await db.fetch_all(sql, params)
        return [
            {
                "time": r["time"].isoformat().replace("+00:00", "Z"),
                "open": float(r["open"]),
                "high": float(r["high"]),
                "low": float(r["low"]),
                "close": float(r["close"]),
                "volume": float(r["volume"]),
            }
            for r in rows
        ]

    sql = f"""
        SELECT
          time_bucket(:interval, time) AS bucket,
          first(open, time)  AS open,
          max(high)          AS high,
          min(low)           AS low,
          last(close, time)  AS close,
          sum(volume)        AS volume
        FROM {source.table}
        WHERE symbol = :symbol AND time < :to_ts {where_from}
        GROUP BY bucket
        ORDER BY bucket DESC
        LIMIT :limit
    """
    params["interval"] = source.interval
    rows = await db.fetch_all(sql, params)
    return [
        {
            "time": r["bucket"].isoformat().replace("+00:00", "Z"),
            "open": float(r["open"]),
            "high": float(r["high"]),
            "low": float(r["low"]),
            "close": float(r["close"]),
            "volume": float(r["volume"]),
        }
        for r in rows
    ]
```

> **Note:** `from_` is the Python parameter name because `from` is a keyword. FastAPI needs a `Query(alias="from")` for the URL param — add `from fastapi import Query` and change the signature to `from_: Optional[str] = Query(None, alias="from")`.

- [ ] **Step 4: Fix the `from` alias**

Update the handler signature:

```python
from fastapi import Query

@router.get("/bars")
async def get_bars(
    request: Request,
    symbol: Optional[str] = None,
    timeframe: Optional[str] = None,
    limit: int = 100,
    from_: Optional[str] = Query(None, alias="from"),
    to: Optional[str] = None,
    x_api_key: Optional[str] = Header(None, alias="X-Api-Key"),
    x_api_secret: Optional[str] = Header(None, alias="X-Api-Secret"),
):
    ...
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend/services/gateway && pytest tests/api/test_algo_bars.py -v`
Expected: all 6 tests PASS

- [ ] **Step 6: Commit**

```bash
git add backend/services/gateway/src/api/algo_market_data.py backend/services/gateway/tests/api/test_algo_bars.py
git commit -m "feat: GET /api/algo/bars — historical OHLC, direct for 1m/5m/1h, time_bucket for 15m/4h/1d"
```

---

## Task 8: WebSocket Handler — First-Message Auth

**Files:**
- Create: `backend/services/gateway/src/ws/algo_prices.py`
- Test: `backend/services/gateway/tests/ws/test_algo_prices_auth.py`

**Purpose:** Isolate the auth handshake logic from the streaming logic. Once this task is done, the handler accepts the connection, validates the first message within 5s, and either closes with the right code or greenlights streaming.

- [ ] **Step 1: Write the failing test**

```python
# backend/services/gateway/tests/ws/test_algo_prices_auth.py
import asyncio
import json
import pytest
from fastapi.testclient import TestClient
from gateway.main import app


def test_ws_auth_timeout_closes_4001(valid_api_headers):
    with TestClient(app) as client:
        with pytest.raises(Exception) as exc:
            with client.websocket_connect("/ws/algo/prices") as ws:
                # send nothing; server should close after 5s
                # TestClient receives the close frame
                msg = ws.receive_json(timeout=7)
                # If we reach here, server didn't close — fail
                assert False, f"expected close, got {msg}"
        assert "4001" in str(exc.value) or "auth_timeout" in str(exc.value)


def test_ws_malformed_first_message_closes_4002():
    with TestClient(app) as client:
        with pytest.raises(Exception) as exc:
            with client.websocket_connect("/ws/algo/prices") as ws:
                ws.send_text("not-json")
                ws.receive_json(timeout=2)
        assert "4002" in str(exc.value)


def test_ws_bad_creds_closes_4003():
    with TestClient(app) as client:
        with pytest.raises(Exception) as exc:
            with client.websocket_connect("/ws/algo/prices") as ws:
                ws.send_json({"action": "auth", "api_key": "ak_fake", "api_secret": "sk_fake"})
                msg = ws.receive_json(timeout=2)
                assert msg["status"] == "error"
                assert msg["detail"] == "Invalid API credentials"
                ws.receive_json(timeout=2)  # should now be closed
        assert "4003" in str(exc.value)


def test_ws_valid_creds_returns_authenticated(valid_api_creds):
    with TestClient(app) as client:
        with client.websocket_connect("/ws/algo/prices") as ws:
            ws.send_json({"action": "auth", "api_key": valid_api_creds["key"], "api_secret": valid_api_creds["secret"]})
            msg = ws.receive_json(timeout=2)
            assert msg["status"] == "authenticated"
            assert "account" in msg
```

> **Fixture note:** `valid_api_creds` must return `{"key": "ak_...", "secret": "sk_..."}` (raw secret, not headers). Add to `conftest.py` alongside `valid_api_headers`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend/services/gateway && pytest tests/ws/test_algo_prices_auth.py -v`
Expected: FAIL — route not registered.

- [ ] **Step 3: Implement handler skeleton (auth only, no streaming yet)**

```python
# backend/services/gateway/src/ws/algo_prices.py
import asyncio
import json
from fastapi import WebSocket, WebSocketDisconnect, HTTPException
from gateway.api.algo_connector import validate_api_credentials

AUTH_TIMEOUT_SECONDS = 5

# close codes
CLOSE_AUTH_TIMEOUT = 4001
CLOSE_BAD_AUTH_MSG = 4002
CLOSE_INVALID_CREDS = 4003
CLOSE_ACCOUNT_INACTIVE = 4004
CLOSE_REPLACED = 4008
CLOSE_RATE_LIMITED = 4029


async def algo_prices_ws(ws: WebSocket):
    await ws.accept()

    try:
        raw = await asyncio.wait_for(ws.receive_text(), timeout=AUTH_TIMEOUT_SECONDS)
    except asyncio.TimeoutError:
        await ws.close(code=CLOSE_AUTH_TIMEOUT)
        return

    try:
        msg = json.loads(raw)
        assert msg.get("action") == "auth"
        api_key = msg["api_key"]
        api_secret = msg["api_secret"]
    except (json.JSONDecodeError, AssertionError, KeyError, TypeError):
        await ws.close(code=CLOSE_BAD_AUTH_MSG)
        return

    try:
        user_id, account_id = await validate_api_credentials(api_key, api_secret)
    except HTTPException as exc:
        await ws.send_json({"status": "error", "detail": exc.detail})
        code = CLOSE_ACCOUNT_INACTIVE if exc.status_code == 403 else CLOSE_INVALID_CREDS
        await ws.close(code=code)
        return

    await ws.send_json({"status": "authenticated", "account": str(account_id)})

    # Streaming comes in Task 9
    try:
        while True:
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        pass
```

- [ ] **Step 4: Register route in main.py**

```python
# backend/services/gateway/src/main.py (add near the existing /ws/prices route)
from gateway.ws.algo_prices import algo_prices_ws

@app.websocket("/ws/algo/prices")
async def algo_prices_endpoint(ws: WebSocket):
    await algo_prices_ws(ws)
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend/services/gateway && pytest tests/ws/test_algo_prices_auth.py -v`
Expected: all 4 tests PASS

- [ ] **Step 6: Commit**

```bash
git add backend/services/gateway/src/ws/algo_prices.py backend/services/gateway/src/main.py backend/services/gateway/tests/ws/test_algo_prices_auth.py
git commit -m "feat: /ws/algo/prices auth handshake — first-message JSON, 4001/4002/4003/4004 close codes"
```

---

## Task 9: WebSocket Handler — Redis Fanout + Registry + Heartbeat

**Files:**
- Modify: `backend/services/gateway/src/ws/algo_prices.py`
- Test: `backend/services/gateway/tests/ws/test_algo_prices_stream.py`

**Purpose:** After auth, subscribe to Redis `prices` channel, forward every tick as JSON. Enforce one-connection-per-API-key (force-close old). Heartbeat ping every 30s.

- [ ] **Step 1: Write the failing test**

```python
# backend/services/gateway/tests/ws/test_algo_prices_stream.py
import json
import pytest
from fastapi.testclient import TestClient
from gateway.main import app


def test_ws_receives_published_ticks(valid_api_creds, redis_client):
    with TestClient(app) as client:
        with client.websocket_connect("/ws/algo/prices") as ws:
            ws.send_json({"action": "auth", **{f"api_{k}": v for k, v in valid_api_creds.items()}})
            auth_msg = ws.receive_json(timeout=2)
            assert auth_msg["status"] == "authenticated"

            # Publish a tick via Redis (simulate LP feed)
            import asyncio
            asyncio.run(redis_client.publish("prices", json.dumps({
                "symbol": "XAUUSD", "bid": 2650.45, "ask": 2650.60,
                "timestamp": "2026-04-24T14:35:22.123Z", "spread": 0.15,
            })))

            tick = ws.receive_json(timeout=2)
            assert tick["type"] == "tick"
            assert tick["symbol"] == "XAUUSD"
            assert tick["bid"] == 2650.45


def test_ws_double_connect_closes_old_with_4008(valid_api_creds):
    with TestClient(app) as client:
        with client.websocket_connect("/ws/algo/prices") as ws1:
            ws1.send_json({"action": "auth", **{f"api_{k}": v for k, v in valid_api_creds.items()}})
            ws1.receive_json(timeout=2)

            # Open a second connection with same key
            with client.websocket_connect("/ws/algo/prices") as ws2:
                ws2.send_json({"action": "auth", **{f"api_{k}": v for k, v in valid_api_creds.items()}})
                ws2.receive_json(timeout=2)

                # ws1 should now be closed with 4008
                with pytest.raises(Exception) as exc:
                    ws1.receive_json(timeout=2)
                assert "4008" in str(exc.value)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend/services/gateway && pytest tests/ws/test_algo_prices_stream.py -v`
Expected: FAIL — streaming not implemented yet.

- [ ] **Step 3: Replace the post-auth loop in algo_prices.py**

```python
# backend/services/gateway/src/ws/algo_prices.py  (replace the post-auth block)
import asyncio
import json
from fastapi import WebSocket, WebSocketDisconnect, HTTPException
from gateway.api.algo_connector import validate_api_credentials

AUTH_TIMEOUT_SECONDS = 5
HEARTBEAT_INTERVAL_SECONDS = 30
HEARTBEAT_TIMEOUT_SECONDS = 60

CLOSE_AUTH_TIMEOUT = 4001
CLOSE_BAD_AUTH_MSG = 4002
CLOSE_INVALID_CREDS = 4003
CLOSE_ACCOUNT_INACTIVE = 4004
CLOSE_REPLACED = 4008
CLOSE_RATE_LIMITED = 4029
CLOSE_HEARTBEAT_TIMEOUT = 1001

# module-level registry: api_key -> WebSocket
_active_connections: dict[str, WebSocket] = {}


async def algo_prices_ws(ws: WebSocket, redis):
    await ws.accept()

    # --- Auth (same as Task 8) ---
    try:
        raw = await asyncio.wait_for(ws.receive_text(), timeout=AUTH_TIMEOUT_SECONDS)
    except asyncio.TimeoutError:
        await ws.close(code=CLOSE_AUTH_TIMEOUT)
        return

    try:
        msg = json.loads(raw)
        assert msg.get("action") == "auth"
        api_key = msg["api_key"]
        api_secret = msg["api_secret"]
    except (json.JSONDecodeError, AssertionError, KeyError, TypeError):
        await ws.close(code=CLOSE_BAD_AUTH_MSG)
        return

    try:
        user_id, account_id = await validate_api_credentials(api_key, api_secret)
    except HTTPException as exc:
        await ws.send_json({"status": "error", "detail": exc.detail})
        code = CLOSE_ACCOUNT_INACTIVE if exc.status_code == 403 else CLOSE_INVALID_CREDS
        await ws.close(code=code)
        return

    # --- Evict any existing connection for this API key ---
    old = _active_connections.get(api_key)
    if old is not None:
        try:
            await old.close(code=CLOSE_REPLACED)
        except Exception:
            pass
    _active_connections[api_key] = ws

    await ws.send_json({"status": "authenticated", "account": str(account_id)})

    # --- Subscribe + fanout + heartbeat ---
    pubsub = redis.pubsub()
    await pubsub.subscribe("prices")

    async def reader():
        async for message in pubsub.listen():
            if message["type"] != "message":
                continue
            tick = json.loads(message["data"])
            tick["type"] = "tick"
            await ws.send_json(tick)

    async def heartbeat():
        last_pong = asyncio.get_event_loop().time()
        while True:
            await asyncio.sleep(HEARTBEAT_INTERVAL_SECONDS)
            await ws.send_json({"type": "ping"})
            # The pong handler updates last_pong; if it hasn't been updated for > timeout, bail
            if asyncio.get_event_loop().time() - last_pong > HEARTBEAT_TIMEOUT_SECONDS:
                await ws.close(code=CLOSE_HEARTBEAT_TIMEOUT)
                return

    async def client_listener():
        nonlocal_last_pong = asyncio.get_event_loop().time()
        try:
            while True:
                data = await ws.receive_text()
                try:
                    body = json.loads(data)
                    if body.get("type") == "pong":
                        pass  # heartbeat will re-check time
                except Exception:
                    pass
        except WebSocketDisconnect:
            pass

    reader_task = asyncio.create_task(reader())
    heartbeat_task = asyncio.create_task(heartbeat())
    listener_task = asyncio.create_task(client_listener())

    try:
        done, pending = await asyncio.wait(
            {reader_task, heartbeat_task, listener_task},
            return_when=asyncio.FIRST_COMPLETED,
        )
        for t in pending:
            t.cancel()
    finally:
        await pubsub.unsubscribe("prices")
        await pubsub.close()
        if _active_connections.get(api_key) is ws:
            del _active_connections[api_key]
```

- [ ] **Step 4: Update main.py signature to pass redis**

```python
# backend/services/gateway/src/main.py
@app.websocket("/ws/algo/prices")
async def algo_prices_endpoint(ws: WebSocket):
    await algo_prices_ws(ws, app.state.redis)
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend/services/gateway && pytest tests/ws/ -v`
Expected: all Task 8 + Task 9 tests PASS (6 total)

- [ ] **Step 6: Commit**

```bash
git add backend/services/gateway/src/ws/algo_prices.py backend/services/gateway/src/main.py backend/services/gateway/tests/ws/test_algo_prices_stream.py
git commit -m "feat: /ws/algo/prices streaming — Redis prices fanout, 1-conn-per-key eviction, heartbeat"
```

---

## Task 10: Rate-Limit the WS Connect Path

**Files:**
- Modify: `backend/services/gateway/src/ws/algo_prices.py`
- Test: add to `backend/services/gateway/tests/ws/test_algo_prices_auth.py`

- [ ] **Step 1: Write the failing test**

```python
def test_ws_rate_limit_on_connect_closes_4029(valid_api_creds):
    # Open 10 successful auth'd connections within a minute,
    # 11th should close with 4029 after auth.
    clients = []
    try:
        for _ in range(10):
            c = TestClient(app)
            ws = c.websocket_connect("/ws/algo/prices").__enter__()
            ws.send_json({"action": "auth", **{f"api_{k}": v for k, v in valid_api_creds.items()}})
            ws.receive_json(timeout=2)
            clients.append((c, ws))

        # 11th connection
        with pytest.raises(Exception) as exc:
            with TestClient(app).websocket_connect("/ws/algo/prices") as ws11:
                ws11.send_json({"action": "auth", **{f"api_{k}": v for k, v in valid_api_creds.items()}})
                ws11.receive_json(timeout=2)
        assert "4029" in str(exc.value) or "Rate limit" in str(exc.value)
    finally:
        for _, ws in clients:
            try:
                ws.close()
            except Exception:
                pass
```

> **Note:** Because of the 1-connection-per-API-key eviction rule, this test needs either a special test API key with eviction disabled, OR you should count connect *attempts* not active connections. Adjust the `enforce_rate_limit` call to run **before** eviction. The spec's ws_connect bucket = 10/min is for attempts, not concurrent.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend/services/gateway && pytest tests/ws/test_algo_prices_auth.py::test_ws_rate_limit_on_connect_closes_4029 -v`
Expected: FAIL — rate limit not yet wired into WS handler.

- [ ] **Step 3: Wire rate limit into algo_prices.py right after successful creds validation**

Insert after the `validate_api_credentials` success block, before eviction:

```python
from gateway.core.algo_rate_limit import enforce_rate_limit, RateLimitExceeded

# ... inside algo_prices_ws, right after the validate_api_credentials success:
try:
    await enforce_rate_limit(redis, api_key=api_key, bucket="ws_connect", limit=10)
except RateLimitExceeded as exc:
    await ws.send_json({"status": "error", "detail": exc.detail})
    await ws.close(code=CLOSE_RATE_LIMITED)
    return
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend/services/gateway && pytest tests/ws/ -v`
Expected: all tests PASS (7 total)

- [ ] **Step 5: Commit**

```bash
git add backend/services/gateway/src/ws/algo_prices.py backend/services/gateway/tests/ws/test_algo_prices_auth.py
git commit -m "feat: /ws/algo/prices connect-rate-limit — 10/min per API key, 4029 on breach"
```

---

## Task 11: End-to-End Smoke Test Script

**Files:**
- Create: `scripts/smoke_algo_market_data.py`

**Purpose:** One script that hits every new endpoint with a real API key, prints pass/fail. Used for staging + production validation after deploy.

- [ ] **Step 1: Create the smoke script**

```python
# scripts/smoke_algo_market_data.py
"""
Smoke test for algo market data API.
Usage:
  export ALGO_API_KEY=ak_...
  export ALGO_API_SECRET=sk_...
  export ALGO_BASE=https://staging.Proline Marketsfx.com
  python scripts/smoke_algo_market_data.py
"""
import asyncio
import json
import os
import sys
import httpx
import websockets

BASE = os.environ["ALGO_BASE"]
KEY = os.environ["ALGO_API_KEY"]
SECRET = os.environ["ALGO_API_SECRET"]
HEADERS = {"X-Api-Key": KEY, "X-Api-Secret": SECRET}


async def check(name: str, ok: bool, detail: str = ""):
    marker = "✓" if ok else "✗"
    print(f"{marker} {name}{' — ' + detail if detail else ''}")
    if not ok:
        sys.exit(1)


async def test_symbols():
    async with httpx.AsyncClient() as c:
        r = await c.get(f"{BASE}/api/algo/symbols", headers=HEADERS)
        await check("GET /symbols", r.status_code == 200 and r.json()["count"] == 28)


async def test_price():
    async with httpx.AsyncClient() as c:
        r = await c.get(f"{BASE}/api/algo/price?symbol=XAUUSD", headers=HEADERS)
        await check("GET /price XAUUSD", r.status_code == 200, f"bid={r.json().get('bid')}")


async def test_prices_multi():
    async with httpx.AsyncClient() as c:
        r = await c.get(f"{BASE}/api/algo/prices?symbols=XAUUSD,EURUSD,BTCUSD", headers=HEADERS)
        await check("GET /prices multi", r.status_code == 200 and r.json()["count"] >= 1)


async def test_bars():
    async with httpx.AsyncClient() as c:
        r = await c.get(f"{BASE}/api/algo/bars?symbol=XAUUSD&timeframe=1m&limit=10", headers=HEADERS)
        await check("GET /bars XAUUSD 1m", r.status_code == 200)


async def test_ws():
    ws_url = BASE.replace("http", "ws") + "/ws/algo/prices"
    async with websockets.connect(ws_url) as ws:
        await ws.send(json.dumps({"action": "auth", "api_key": KEY, "api_secret": SECRET}))
        auth_resp = json.loads(await asyncio.wait_for(ws.recv(), timeout=5))
        await check("WS auth", auth_resp.get("status") == "authenticated")

        # Receive 3 ticks or time out after 15s
        tick_count = 0
        try:
            while tick_count < 3:
                msg = json.loads(await asyncio.wait_for(ws.recv(), timeout=15))
                if msg.get("type") == "tick":
                    tick_count += 1
        except asyncio.TimeoutError:
            pass
        await check("WS tick stream", tick_count >= 3, f"received {tick_count} ticks")


async def main():
    await test_symbols()
    await test_price()
    await test_prices_multi()
    await test_bars()
    await test_ws()
    print("\nAll smoke tests passed.")


if __name__ == "__main__":
    asyncio.run(main())
```

- [ ] **Step 2: Verify script runs against a local dev gateway**

Prerequisites: gateway running at `http://localhost:8000`, a test API key seeded in DB, some ticks being published to Redis (either LP forwarding or a manual `redis-cli publish prices '...'`).

Run:
```bash
export ALGO_BASE=http://localhost:8000
export ALGO_API_KEY=ak_testkey
export ALGO_API_SECRET=sk_testsecret
python scripts/smoke_algo_market_data.py
```
Expected: all checks print `✓`.

- [ ] **Step 3: Commit**

```bash
git add scripts/smoke_algo_market_data.py
git commit -m "test: smoke script for algo market data API (symbols, price, prices, bars, ws)"
```

---

## Task 12: Update ALGO_API.md

**Files:**
- Modify: `ALGO_API.md`

**Purpose:** Partner-facing documentation. Add sections covering all 5 new endpoints with request/response examples, auth, error table update, Python snippets.

- [ ] **Step 1: Append new sections to ALGO_API.md**

Add after existing Section 4 (Account Info) and before Section 5 (Error responses). Renumber as needed.

Add these sections verbatim (copy from the spec's Section 5 — the spec already has everything including request/response JSON):

- `## 5. Live Tick Stream (WebSocket)` — full handshake, close codes, heartbeat, sample Python client
- `## 6. Price Snapshot (single symbol)` — request + response
- `## 7. Multi-Symbol Snapshot` — request + response
- `## 8. Symbol List` — request + response
- `## 9. Historical Bars (OHLC)` — request + response + timeframe list

Then update the existing error table (currently Section 5, renumber to 10) to include:

| Status | Meaning | Example detail |
|---|---|---|
| 400 | Bad timeframe | `"timeframe must be one of: 1m, 5m, 15m, 1h, 4h, 1d"` |
| 400 | Bad limit | `"limit must be between 1 and 1000"` |
| 400 | Too many symbols | `"symbols list cannot exceed 28 items"` |
| 429 | Rate limited | `"Rate limit exceeded (60/min). Retry in 23s"` |
| 503 | No price yet | `"No price data for XAUUSD"` |

Add a new Python example section showing a complete bot skeleton that uses all 5 endpoints:

```python
import asyncio
import json
import websockets
import requests

BASE = "https://Proline Marketsfx.com/api/algo"
WS_URL = "wss://Proline Marketsfx.com/ws/algo/prices"
HEADERS = {"X-Api-Key": "YOUR_KEY", "X-Api-Secret": "YOUR_SECRET", "Content-Type": "application/json"}

# Bootstrap: load symbol specs + initial snapshot
symbols = requests.get(f"{BASE}/symbols", headers=HEADERS).json()["symbols"]
initial = requests.get(f"{BASE}/prices", headers=HEADERS).json()["prices"]

# Load 100 historical 1m bars for XAUUSD
bars = requests.get(f"{BASE}/bars", params={"symbol": "XAUUSD", "timeframe": "1m", "limit": 100}, headers=HEADERS).json()["bars"]

# Subscribe to live ticks
async def stream():
    async with websockets.connect(WS_URL) as ws:
        await ws.send(json.dumps({"action": "auth", "api_key": "YOUR_KEY", "api_secret": "YOUR_SECRET"}))
        auth = json.loads(await ws.recv())
        assert auth["status"] == "authenticated"

        async for raw in ws:
            msg = json.loads(raw)
            if msg.get("type") == "tick":
                print(msg["symbol"], msg["bid"], msg["ask"])
            elif msg.get("type") == "ping":
                await ws.send(json.dumps({"type": "pong"}))

asyncio.run(stream())
```

- [ ] **Step 2: Commit**

```bash
git add ALGO_API.md
git commit -m "docs: ALGO_API.md — document market data endpoints (ws, price, prices, symbols, bars)"
```

---

## Task 13: Rollout Checklist

Not code — a manual checklist to run after merge.

- [ ] **Staging deploy**

```bash
# CI/CD flow (usual merge → staging deploy)
```

- [ ] **Staging smoke test**

```bash
export ALGO_BASE=https://staging.Proline Marketsfx.com
export ALGO_API_KEY=<your personal staging key>
export ALGO_API_SECRET=<your personal staging secret>
python scripts/smoke_algo_market_data.py
```
Expected: all 5 checks pass.

- [ ] **Partner runs bot against staging for 30 minutes**

Share staging URL + key with partner. Monitor:
```bash
docker logs Proline Markets-gateway -f | grep "algo"
```
Check for: no 5xx errors, tick fanout latency < 100ms, no heartbeat timeouts.

- [ ] **Production deploy**

Same flow as staging. Run smoke script against production.

- [ ] **Partner switches to production URL**

Share final `ALGO_API.md` with partner. Partner confirms bot is consuming prod feed.

- [ ] **Monitor for 24 hours**

Check gateway logs daily for first 3 days. Metrics to watch:
- Total WS connections peak
- `/bars` rate-limit hits (if partner hits this, may need to raise the 20/min limit)
- 503 "No price data" count (if high, tick publish pipeline has a gap)

---

## Summary of Files Touched

| Category | File | Action |
|---|---|---|
| New | `backend/packages/common/src/symbol_spec.py` | create |
| New | `backend/packages/common/tests/test_symbol_spec.py` | create |
| New | `backend/services/gateway/src/core/algo_rate_limit.py` | create |
| New | `backend/services/gateway/tests/core/test_algo_rate_limit.py` | create |
| New | `backend/services/gateway/src/api/algo_market_data.py` | create |
| New | `backend/services/gateway/tests/api/test_algo_bars_aggregation.py` | create |
| New | `backend/services/gateway/tests/api/test_algo_symbols.py` | create |
| New | `backend/services/gateway/tests/api/test_algo_price.py` | create |
| New | `backend/services/gateway/tests/api/test_algo_prices_multi.py` | create |
| New | `backend/services/gateway/tests/api/test_algo_bars.py` | create |
| New | `backend/services/gateway/src/ws/algo_prices.py` | create |
| New | `backend/services/gateway/tests/ws/test_algo_prices_auth.py` | create |
| New | `backend/services/gateway/tests/ws/test_algo_prices_stream.py` | create |
| New | `scripts/smoke_algo_market_data.py` | create |
| Modify | `backend/services/gateway/src/api/algo_connector.py` | include new router |
| Modify | `backend/services/gateway/src/main.py` | register WS route |
| Modify | `ALGO_API.md` | document new endpoints |

**DB migrations:** zero.
**Commits:** 13 (one per task).
