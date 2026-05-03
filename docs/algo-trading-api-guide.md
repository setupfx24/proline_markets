# Proline MarketsFX — Trading API Documentation

> Public API reference for connecting trading bots and algorithms to the Proline MarketsFX platform.

---

## Base URL

```
https://Proline Marketsfx.com/api/v1
```

---

## Authentication

All trading endpoints require a Bearer token. Market data endpoints are public.

### Login
```http
POST /auth/login
Content-Type: application/json

{
  "email": "your@email.com",
  "password": "your_password"
}
```

**Response:**
```json
{
  "access_token": "<JWT_TOKEN>",
  "token_type": "bearer"
}
```

### Using the Token
```http
Authorization: Bearer <YOUR_TOKEN>
```

### Refresh Token (before 15 min expiry)
```http
POST /auth/refresh
Authorization: Bearer <YOUR_TOKEN>
```

---

## Market Data (Public — No Auth)

| Action | Method | Endpoint |
|--------|--------|----------|
| Instrument list | GET | `/instruments/` |
| Single price | GET | `/instruments/{symbol}/price` |
| All prices | GET | `/instruments/prices/all` |
| OHLCV candles | GET | `/instruments/{symbol}/bars?resolution=5&from=UNIX&to=UNIX` |
| Market status | GET | `/instruments/market-status` |

**Price Response:**
```json
{
  "symbol": "XAUUSD",
  "bid": 2350.15,
  "ask": 2350.40,
  "spread": 0.25
}
```

**Candle Resolutions:** `1`, `5`, `15`, `30`, `60`, `240`, `D`

---

## Account (Auth Required)

| Action | Method | Endpoint |
|--------|--------|----------|
| List accounts | GET | `/accounts/` |
| Account summary | GET | `/accounts/{account_id}/summary` |

**Summary Response:**
```json
{
  "balance": 10000.00,
  "equity": 10050.00,
  "margin_used": 500.00,
  "free_margin": 9550.00,
  "margin_level": 2010,
  "open_positions_count": 2
}
```

---

## Orders (Auth Required)

### Place Order
```http
POST /orders/
Authorization: Bearer <TOKEN>

{
  "account_id": "<UUID>",
  "symbol": "XAUUSD",
  "order_type": "market",
  "side": "buy",
  "lots": 0.01,
  "stop_loss": 2340.00,
  "take_profit": 2370.00,
  "magic_number": 12345,
  "comment": "Bot trade"
}
```

| Field | Required | Description |
|-------|----------|-------------|
| account_id | Yes | Your trading account UUID |
| symbol | Yes | Instrument symbol (e.g. XAUUSD, EURUSD) |
| order_type | Yes | `market`, `limit`, `stop`, `stop_limit` |
| side | Yes | `buy` or `sell` |
| lots | Yes | Trade size (0.01 — 100) |
| price | For limit/stop | Target price |
| stop_loss | Optional | Stop loss price |
| take_profit | Optional | Take profit price |
| magic_number | Optional | Bot tracking ID (integer) |
| comment | Optional | Trade label |

### Other Order Actions
| Action | Method | Endpoint |
|--------|--------|----------|
| List orders | GET | `/orders/?account_id=UUID&status=open` |
| Modify order | PUT | `/orders/{order_id}` |
| Cancel order | DELETE | `/orders/{order_id}` |

---

## Positions (Auth Required)

| Action | Method | Endpoint | Body |
|--------|--------|----------|------|
| List open | GET | `/positions/?account_id=UUID&status=open` | — |
| Update SL/TP | PUT | `/positions/{position_id}` | `{stop_loss?, take_profit?}` |
| Close (full) | POST | `/positions/{position_id}/close` | — |
| Close (partial) | POST | `/positions/{position_id}/close` | `{lots: 0.005}` |

---

## Trade History (Auth Required)

```http
GET /portfolio/trades?account_id=UUID&page=1&per_page=50
```
Optional filters: `symbol`, `side`, `date_from`, `date_to`

---

## WebSocket — Live Prices

**URL:** `wss://Proline Marketsfx.com/ws/prices`

No authentication required. Streams all symbol ticks continuously.

**Message format:**
```json
{"symbol":"EURUSD","bid":1.09501,"ask":1.09515,"spread":0.00014}
```

**Keep-alive:** Server sends `{"type":"ping"}` every 30s. Reply with `{"type":"pong"}`.

---

## WebSocket — Trade Updates

**URL:** `wss://Proline Marketsfx.com/ws/trades/{account_id}?token=YOUR_JWT`

Authentication required. Streams position/order events for your account.

**Events:**
```json
{"type":"position_opened","data":{"id":"...","symbol":"XAUUSD","side":"buy","lots":0.01,"open_price":2350.50}}
{"type":"position_closed","data":{"id":"...","profit":15.50,"close_price":2352.00}}
{"type":"sl_hit","data":{"id":"...","close_price":2348.00,"profit":-5.00}}
{"type":"tp_hit","data":{"id":"...","close_price":2370.00,"profit":19.50}}
{"type":"order_filled","data":{"id":"...","symbol":"EURUSD","fill_price":1.0950}}
```

---

## Error Codes

| Code | Meaning | What to do |
|------|---------|------------|
| 400 | Invalid request | Check request body |
| 401 | Token expired | Call `/auth/refresh` |
| 403 | Forbidden | Check account ownership |
| 404 | Not found | Verify resource ID |
| 503 | Maintenance | Retry later |

```json
{"detail": "Error description"}
```

---

## Bot Workflow

```
1. POST /auth/login              → Get token
2. GET  /accounts/                → Get account_id
3. GET  /accounts/{id}/summary    → Check free margin
4. Connect wss://domain/ws/prices → Receive live ticks
5. Bot generates signal           → Buy/Sell decision
6. POST /orders/                  → Place trade
7. Connect wss://domain/ws/trades → Receive fill events
8. PUT  /positions/{id}           → Update SL/TP
9. POST /positions/{id}/close     → Exit trade
10. Repeat from step 5
```

---

## Quick Start (Python)

```python
import requests
import json
import websocket
import threading

BASE = "https://Proline Marketsfx.com/api/v1"

# Login
token = requests.post(f"{BASE}/auth/login", json={
    "email": "your@email.com",
    "password": "your_password"
}).json()["access_token"]

headers = {"Authorization": f"Bearer {token}"}

# Get account
account_id = requests.get(f"{BASE}/accounts/", headers=headers).json()[0]["id"]

# Check balance
summary = requests.get(f"{BASE}/accounts/{account_id}/summary", headers=headers).json()
print(f"Free Margin: ${summary['free_margin']}")

# Get price
price = requests.get(f"{BASE}/instruments/XAUUSD/price").json()
print(f"XAUUSD: {price['bid']}/{price['ask']}")

# Place trade
order = requests.post(f"{BASE}/orders/", headers=headers, json={
    "account_id": account_id,
    "symbol": "XAUUSD",
    "order_type": "market",
    "side": "buy",
    "lots": 0.01,
    "stop_loss": price["bid"] - 5,
    "take_profit": price["bid"] + 10,
    "magic_number": 9999
}).json()
print(f"Order: {order}")

# Close position
positions = requests.get(
    f"{BASE}/positions/?account_id={account_id}&status=open", headers=headers
).json()
if positions:
    requests.post(f"{BASE}/positions/{positions[0]['id']}/close", headers=headers)

# WebSocket price stream (background)
def on_msg(ws, msg):
    data = json.loads(msg)
    if data.get("type") == "ping":
        ws.send('{"type":"pong"}')
        return
    print(f"{data['symbol']} {data['bid']}/{data['ask']}")

threading.Thread(target=lambda: websocket.WebSocketApp(
    "wss://Proline Marketsfx.com/ws/prices", on_message=on_msg
).run_forever(), daemon=True).start()
```

```bash
pip install requests websocket-client
```

---

## Guidelines

- Refresh token before 15-minute expiry
- Use WebSocket for prices instead of polling
- Keep request rate reasonable (1-2/sec)
- Use `magic_number` to identify bot trades
- Use `wss://` (encrypted) in production
- Store credentials securely — never hardcode in shared repos

---

*For API access, contact the platform administrator.*
