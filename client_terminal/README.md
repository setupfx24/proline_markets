# Proline Terminal

A native **C++ / Qt6 desktop trading terminal** for Proline Markets. It talks
to the platform over REST + WebSocket and gives you a live watchlist,
candlestick charts, an order ticket (BUY / SELL / CLOSE), an open-positions
panel and an account summary, all updating in real time.

> **Status: rebranded, not yet wired up.** The code was inherited from another
> broker's build and every visible brand string now says Proline, but it still
> calls endpoints this platform does not serve. It will not connect until the
> API work in [Known gaps](#known-gaps) is done. Do not ship it to clients yet.

## Features

- **Live watchlist** — every instrument with bid / ask / spread, updated on
  every tick (green/red flash on price direction).
- **Chart** — TradingView Advanced Charts embedded via Qt WebEngine, with an
  on-chart position overlay and drag-to-edit SL/TP.
- **Order ticket** — volume + optional SL/TP, one-click BUY / SELL and a
  CLOSE-all for the selected symbol (with confirmation).
- **Positions panel** — open positions with live P/L and per-position close.
- **Account panel** — balance, credit, equity, margin used/free, margin level,
  leverage, open positions; auto-refreshes every 5s.
- **Live tick stream** over WebSocket with first-message auth and
  auto-reconnect.
- Dark theme, dockable panels.

## Architecture

```
src/
  core/
    Models.h        plain structs mirroring the API JSON
    Config.*        load/save token/API key + endpoints (JSON in AppConfig)
    ApiClient.*     async REST: account, symbols, prices, bars, trade
    PriceStream.*   WebSocket live tick stream + reconnect
    ChartBridge.*   QWebChannel bridge between C++ and the chart page
  ui/
    LoginDialog.*      credentials + endpoint entry
    WatchlistWidget.*  live quote table
    WebChartWidget.*   TradingView chart host
    OrderTicket.*      BUY / SELL / CLOSE entry
    PositionsPanel.*   open positions + close
    AccountPanel.*     balance / equity / margin summary
    WalletDialog.*     deposits / withdrawals
    MainWindow.*       wires services + widgets together
  main.cpp          theme + startup flow
web/                chart page loaded into QWebEngineView
```

The UI never talks to the network directly — `MainWindow` owns `ApiClient` and
`PriceStream` and connects their signals to the widgets.

## Known gaps

The terminal was built against a fork whose API is richer than this one. Four
endpoints it calls do not exist on our gateway:

| Terminal calls | Gateway |
|---|---|
| `POST /api/algo/terminal/login` | missing |
| `GET /api/algo/positions` | missing |
| `GET /api/algo/orders` | missing |
| `GET /api/algo/history` | missing |

Auth does not line up either. `ApiClient::makeRequest` sends a JWT bearer plus
`X-Account-Id`, and `PriceStream` sends `{"action":"auth","token":...}`, but
`backend/services/gateway/src/api/algo_connector.py` accepts only `X-Api-Key` +
`X-Api-Secret` and `algo_prices_ws` rejects an auth frame without them.

Two ways out, cheapest first:

1. **Repoint the terminal at `/api/v1` and log in with a JWT.** That surface
   already has `auth/login`, `accounts`, `instruments`, `orders`, `positions`
   and `portfolio/trades`, so no backend change is needed — only
   `ApiClient.cpp`, `LoginDialog.cpp` and `PriceStream.cpp` move.
2. Add the four endpoints plus bearer support to the algo API. More work, and
   it widens a surface that exists for external bots.

## Toolchain

Official Qt (MSVC) with WebEngine. See `build-msvc.ps1` for the expected
locations; `build.ps1` is the older MSYS2 UCRT64 path and does not build the
WebEngine chart.

## Build

```powershell
powershell -ExecutionPolicy Bypass -File build-msvc.ps1
powershell -ExecutionPolicy Bypass -File run-msvc.ps1
```

Credentials are saved to
`%APPDATA%\Proline Markets\Proline Terminal\config.json` in plaintext — it is a
local desktop config, keep the file private.

Production endpoints (defaults in `src/core/Config.h`):

- REST base: `https://api.prolinemarket.com/api/algo`
- WebSocket: `wss://api.prolinemarket.com/ws/algo/prices`

## Distribution: unsigned builds are blocked

`installer.iss` produces `ProlineTerminal-Setup.exe` via Inno Setup. It is
**unsigned**, and Windows Smart App Control blocks unsigned executables
outright. A self-signed certificate does not help — SAC only trusts
Microsoft-recognised signatures and reputation.

The only workaround for a locally-built binary is turning SAC off, which is
**irreversible** (re-enabling it requires resetting Windows). That is not
something to ask clients to do. Shipping this to real users needs a proper
code-signing certificate; budget for one before planning a public release.
