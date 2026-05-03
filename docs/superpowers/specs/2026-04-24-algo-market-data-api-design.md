# Algo Market Data API — Design Spec

**Date:** 2026-04-24
**Status:** Approved (pending user review of written spec)
**Owner:** @vibhooti

## 1. Problem

Proline Markets currently exposes a minimal algo API (`POST /api/algo/trade`, `GET /api/algo/account`) that lets an external bot place trades and read account state using an `X-Api-Key` + `X-Api-Secret` pair tied to a single trading account.

An external partner running their own algo bot wants their bot's dashboard to display the **same live market data** that the Proline Markets frontend shows — live ticks, snapshots, and historical OHLC bars — so both sides are reading the exact same LP-sourced prices (with spread widening already applied).

No separate feed, no separate auth. The same `X-Api-Key` + `X-Api-Secret` should also unlock market data.

## 2. Goals

- Expose a full market data API (live tick stream + snapshot + historical bars + symbol list) authenticated with the existing algo API credentials.
- Zero changes to the LP ingestion path, the market-data service, or the `algo_api_keys` schema.
- Reuse the existing Redis `prices` pub/sub channel, `tick:{symbol}` cache, and TimescaleDB hypertable.
- Low latency live stream (same latency the internal `/ws/prices` sees).
- Production-safe: rate limited, zombie connection protection, consistent error shape.

## 3. Non-Goals

- Level 2 / order book depth (LP provides top-of-book only).
- Per-API-key spread customization.
- Webhook tick delivery (WebSocket is the push channel).
- Multiple API keys per trading account.
- Raw tick history REST endpoint (bars cover this use case at lower bandwidth).

## 4. Architecture

```
LP → POST /api/lp/prices/batch
   → Redis list (lp:incoming_ticks)
   → market-data service
        ├── spread widening (spread_cache.py)
        ├── TimescaleDB hypertable (ticks, bars_1m, bars_5m, bars_1h)
        └── Redis
              ├── SET tick:{symbol}        (hot snapshot, per-symbol latest tick)
              └── PUBLISH prices           (pub/sub fanout channel)
                         │
                         ├── [existing] /ws/prices           → public frontend feed
                         └── [new]      /ws/algo/prices      → algo-authenticated feed
                                                     │
                                                     └── friend's bot
```

No change to anything left of the Redis layer. New endpoints read from Redis (hot data) and TimescaleDB (bars), and gate access with the existing `algo_api_keys` table.

## 5. API Surface

### 5.1 REST — single price snapshot

```
GET /api/algo/price?symbol=XAUUSD
Headers: X-Api-Key, X-Api-Secret

200 OK
{
  "symbol": "XAUUSD",
  "bid": 2650.45,
  "ask": 2650.60,
  "spread": 0.15,
  "timestamp": "2026-04-24T14:35:22.123Z"
}
```

Source: Redis `tick:XAUUSD` string. Returns `503 { "detail": "No price data for XAUUSD" }` if the key is absent (fresh symbol, LP hasn't ticked yet).

### 5.2 REST — multi-symbol snapshot

```
GET /api/algo/prices?symbols=XAUUSD,EURUSD,BTCUSD
Headers: X-Api-Key, X-Api-Secret

200 OK
{
  "prices": [
    { "symbol": "XAUUSD", "bid": 2650.45, "ask": 2650.60, "spread": 0.15, "timestamp": "..." },
    { "symbol": "EURUSD", "bid": 1.0823,  "ask": 1.0824,  "spread": 0.0001, "timestamp": "..." },
    { "symbol": "BTCUSD", "bid": 67234.5, "ask": 67241.2, "spread": 6.7,   "timestamp": "..." }
  ],
  "count": 3
}
```

- `symbols` optional; if omitted, returns all 28 supported symbols.
- Max 28 symbols per request.
- Symbols with no tick yet are omitted from the array (don't fail the whole request). Client can diff against `/api/algo/symbols`.

### 5.3 REST — symbol list + metadata

```
GET /api/algo/symbols
Headers: X-Api-Key, X-Api-Secret

200 OK
{
  "symbols": [
    { "symbol": "XAUUSD", "category": "metals", "min_lot": 0.01, "lot_step": 0.01, "digits": 2 },
    { "symbol": "EURUSD", "category": "forex",  "min_lot": 0.01, "lot_step": 0.01, "digits": 5 },
    { "symbol": "BTCUSD", "category": "crypto", "min_lot": 0.01, "lot_step": 0.01, "digits": 1 },
    ...
  ],
  "count": 28
}
```

Static data from `backend/packages/common/src/symbol_spec.py`. Intended for bot startup — cache on client, no need to call repeatedly.

### 5.4 REST — historical OHLC bars

```
GET /api/algo/bars?symbol=XAUUSD&timeframe=1m&limit=500
Headers: X-Api-Key, X-Api-Secret

Query params:
  symbol     required   one of 28 supported
  timeframe  required   one of: 1m, 5m, 15m, 1h, 4h, 1d
  limit      optional   default 100, min 1, max 1000
  from       optional   ISO-8601 timestamp
  to         optional   ISO-8601 timestamp

200 OK
{
  "symbol": "XAUUSD",
  "timeframe": "1m",
  "bars": [
    { "time": "2026-04-24T14:30:00Z", "open": 2650.10, "high": 2650.80, "low": 2649.95, "close": 2650.45, "volume": 1247 },
    { "time": "2026-04-24T14:31:00Z", "open": 2650.45, "high": 2650.90, "low": 2650.30, "close": 2650.60, "volume": 982 },
    ...
  ],
  "count": 500
}
```

Bars are returned **newest first** (descending time). Client paginates by passing `to` = oldest bar's time on the next call.

**Timeframe source mapping:**

| Timeframe | Source table | Aggregation |
|-----------|--------------|-------------|
| 1m  | `bars_1m`  | direct SELECT |
| 5m  | `bars_5m`  | direct SELECT |
| 15m | `bars_1m`  | on-the-fly via `time_bucket('15 minutes', time)` |
| 1h  | `bars_1h`  | direct SELECT |
| 4h  | `bars_1h`  | on-the-fly via `time_bucket('4 hours', time)` |
| 1d  | `bars_1h`  | on-the-fly via `time_bucket('1 day', time)` |

Aggregation SQL template (for non-native timeframes):

```sql
SELECT
  time_bucket(:interval, time) AS bucket,
  first(open, time)  AS open,
  max(high)          AS high,
  min(low)           AS low,
  last(close, time)  AS close,
  sum(volume)        AS volume
FROM :source_table
WHERE symbol = :symbol
  AND time >= :from
  AND time <  :to
GROUP BY bucket
ORDER BY bucket DESC
LIMIT :limit;
```

### 5.5 WebSocket — live tick stream

```
Connect: wss://Proline Marketsfx.com/ws/algo/prices
(no headers, no query params at connect time)
```

**Auth flow (first-message pattern):**

```
1. Client connects → server accepts handshake, starts 5-second auth timer.
2. Client sends first message within 5s:
      { "action": "auth", "api_key": "ak_xxx", "api_secret": "sk_yyy" }
3. Server validates via shared validate_api_credentials().
   - Success → server sends { "status": "authenticated", "account": "100245" }
   - Failure → server sends { "status": "error", "detail": "Invalid API credentials" } then closes 4003.
4. On success server subscribes to Redis channel "prices" and fans out every tick:
      { "type": "tick", "symbol": "XAUUSD", "bid": 2650.45, "ask": 2650.60, "spread": 0.15, "timestamp": "..." }
5. Heartbeat: server sends { "type": "ping" } every 30s; client replies { "type": "pong" }.
   - No pong within 60s → server closes 1001.
6. Client disconnect → server unsubscribes and removes from registry.
```

**All 28 symbols stream automatically** — no subscribe/unsubscribe protocol. Client filters locally if it only cares about some symbols (matches the existing `/ws/prices` pattern).

**Close codes:**

| Code | Meaning |
|------|---------|
| 4001 | Auth timeout (no first message in 5s) |
| 4002 | Malformed auth message (bad JSON or wrong shape) |
| 4003 | Invalid API credentials |
| 4004 | Trading account inactive |
| 4008 | Replaced by a new connection from the same API key |
| 4029 | Rate limit exceeded on connect |
| 1001 | Heartbeat timeout |

**One connection per API key:** opening a second connection with the same key force-closes the older one with 4008. Prevents zombie connections and simplifies server-side fanout bookkeeping.

## 6. Authentication

Shared helper, already implemented in `algo_connector.py`:

```python
async def validate_api_credentials(api_key: str, api_secret: str) -> tuple[UUID, UUID]:
    """Returns (user_id, account_id) or raises HTTPException."""
    if not api_key or not api_secret:
        raise HTTPException(401, detail="Missing X-Api-Key or X-Api-Secret")

    secret_hash = sha256(api_secret.encode()).hexdigest()

    row = await db.fetch_one(
        select(AlgoApiKey, TradingAccount)
        .join(TradingAccount, ...)
        .where(AlgoApiKey.api_key == api_key)
        .where(AlgoApiKey.secret_hash == secret_hash)
        .where(AlgoApiKey.is_active == True)
    )
    if row is None:
        raise HTTPException(401, detail="Invalid API credentials")
    if not row.TradingAccount.is_active:
        raise HTTPException(403, detail="Trading account is inactive")

    # fire-and-forget last_used_at update
    asyncio.create_task(update_last_used(row.AlgoApiKey.id))

    return row.AlgoApiKey.user_id, row.AlgoApiKey.account_id
```

All 4 new REST routes call this helper. The WS handler calls the same helper after parsing the first message; on HTTPException it converts to a WS close with the matching code.

## 7. Rate Limiting

Redis-based fixed-window counter, key format:
`rate_limit:algo:{api_key}:{bucket}:{minute_epoch}` with TTL 60s.

| Bucket | Limit | Applies to |
|--------|-------|------------|
| `market_read` | 60 / min | `/price`, `/prices`, `/symbols` |
| `bars` | 20 / min | `/bars` only (heavier query) |
| `ws_connect` | 10 / min | WS connect attempts (prevents reconnect storms) |

Breach response:

```
429 Too Many Requests
{ "detail": "Rate limit exceeded (60/min). Retry in 23s" }
```

WS handler: breach on connect → close 4029 with `{ "status": "error", "detail": "Rate limit exceeded" }`.

## 8. Error Shape (consistent with existing algo API)

```json
// 400 — bad input
{ "detail": "symbol is required" }
{ "detail": "timeframe must be one of: 1m, 5m, 15m, 1h, 4h, 1d" }
{ "detail": "limit must be between 1 and 1000" }
{ "detail": "symbols list cannot exceed 28 items" }

// 401 — auth
{ "detail": "Missing X-Api-Key or X-Api-Secret" }
{ "detail": "Invalid API credentials" }

// 403 — disabled
{ "detail": "Trading account is inactive" }

// 404 — unknown symbol
{ "detail": "Instrument XYZABC not found" }

// 429 — rate limited
{ "detail": "Rate limit exceeded (60/min). Retry in 23s" }

// 503 — no price yet
{ "detail": "No price data for XAUUSD" }
```

## 9. File Layout

### Modified

| File | Change |
|---|---|
| `backend/services/gateway/src/api/algo_connector.py` | Register 4 new route handlers (delegate to `algo_market_data.py`). |
| `backend/services/gateway/src/main.py` | Register new WS route `/ws/algo/prices` (delegate to `ws/algo_prices.py`). |
| `ALGO_API.md` | Add sections for new endpoints, WS flow, Python example, updated error table. |

### New

| File | Purpose |
|---|---|
| `backend/services/gateway/src/api/algo_market_data.py` | REST handlers: `get_price`, `get_prices`, `get_symbols`, `get_bars`. Bar aggregation helper. |
| `backend/services/gateway/src/ws/algo_prices.py` | WS handler: first-message auth, Redis subscription loop, per-key connection registry, heartbeat. |
| `backend/services/gateway/src/core/algo_rate_limit.py` | Redis counter helper: `enforce_rate_limit(api_key, bucket, limit)`. |
| `backend/packages/common/src/symbol_spec.py` | Static 28-symbol metadata table (category, min_lot, lot_step, digits). |

### Database

No schema changes. No migrations.

## 10. Testing

| Test | Scope |
|---|---|
| Unit | `validate_api_credentials()` regression; `time_bucket` aggregation produces correct OHLC from synthetic 1m data for 15m / 4h / 1d timeframes; rate limit helper increments and expires correctly. |
| Integration | curl all 4 REST endpoints with valid + invalid creds; assert 200 / 401 / 403 / 404 / 429 / 503 paths; verify `/bars` returns descending-time order; verify empty-price response shape. |
| WebSocket | Python `websockets` client: connect + auth success receives ticks; auth timeout (no first message) closes 4001; bad JSON closes 4002; bad creds close 4003; double-connect with same key closes old with 4008; heartbeat ping/pong; unclean disconnect cleanup. |
| Load | 10 concurrent WS connections across different API keys; verify per-connection tick delivery < 50ms from Redis publish; verify no cross-contamination in the registry. |
| Manual | Partner's bot runs for 1 hour against staging; sample 100 tick timestamps vs internal `/ws/prices` on the same symbols — they must match exactly (same pub/sub source, same tick). |

## 11. Rollout

1. Feature merged to `master` (no feature flag — it's a new surface, zero blast radius on existing users).
2. Deploy to staging.
3. Self-smoke: curl all 4 REST endpoints with personal test API key. WS client connects, receives 100 ticks, disconnects cleanly.
4. Partner points their bot at staging URL. Let it run 30 min. Check gateway logs for errors, WS connection counts, rate-limit hits.
5. Deploy to production.
6. Partner switches to production URL.
7. Publish updated `ALGO_API.md` to partner.

## 12. Open Risks

- **TimescaleDB load from bar queries.** The 20/min rate limit on `/bars` is a first guess. If the partner's backtest tool fires 1000 bars × 28 symbols at startup, we may need to tune. Mitigation: the query is indexed by `(symbol, time)` and TimescaleDB handles time_bucket efficiently — monitor and adjust.
- **Fanout cost if many bots connect.** Current implementation uses one Redis subscription per WS connection. If 100 bots connect, that's 100 subscriptions on the same `prices` channel. Redis handles this, but gateway memory per connection matters. If we scale past ~50 concurrent connections, refactor to a single subscription + in-process fanout.
- **Clock skew in bar timestamps.** TimescaleDB stores UTC. Partner's bot must also treat all timestamps as UTC. Documented in `ALGO_API.md` but worth calling out to the partner verbally.
