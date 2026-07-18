# Proline Terminal (desktop)

Native **Qt 6 / C++** Windows trading terminal for Proline Markets. Connects
directly to the existing gateway REST + WebSocket API — no browser required.

## Prerequisites (one-time)

This machine has no C++ toolchain yet. Install it with:

```powershell
# elevated PowerShell
powershell -ExecutionPolicy Bypass -File scripts\setup-toolchain.ps1
```

Installs: CMake, Ninja, Python (for aqtinstall), MSVC Build Tools 2022 (C++),
and Qt 6.7.3 (msvc2019_64) into `C:\Qt`.

## Build & run

```powershell
scripts\build.ps1 -Config Debug -Run
```

## Backend it talks to

| Concern        | Endpoint                                        | Auth                          |
|----------------|-------------------------------------------------|-------------------------------|
| Login (+2FA)   | `POST /api/v1/auth/login`                       | body `access_token` → Bearer  |
| Account/equity | `GET /api/v1/accounts`                          | `Authorization: Bearer`       |
| Instruments    | `GET /api/v1/instruments/`                      | Bearer                        |
| Orders         | `POST/GET/PUT/DELETE /api/v1/orders`            | Bearer                        |
| Positions      | `GET/PUT /api/v1/positions`, `.../close`        | Bearer                        |
| Candles        | `GET /api/v1/instruments/{symbol}/bars`         | Bearer                        |
| Live prices    | `ws://…/ws/prices`                              | none (firehose)               |
| Trade events   | `ws://…/ws/trades/{account_id}?token=<JWT>`     | JWT in query                  |

Default dev target: `http://localhost:8000` / `ws://localhost:8000`
(prod: `https://api.prolinemarket.com`). Configurable at the login screen.

## Roadmap (phased)

- **Phase 0 — scaffold + toolchain** ✅ smoke-test window builds & runs.
- **Phase 1 — core + auth** ✅ config, REST client, session, login dialog (+2FA),
  account list, Bearer auth.
- **Phase 2 — market data** ✅ price WebSocket, instruments, Market Watch panel.
- **Phase 3 — trading** ✅ order ticket (market + pending, SL/TP), positions &
  orders tables, close/modify/cancel, live account summary bar, trade socket.
  *(pending compile-verify once the toolchain is installed)*
- **Phase 4 — charts** ✅ candlestick chart, timeframes (1m–1D), live
  last-candle updates from ticks. *(indicators/drawing tools: later)*
  *(pending compile-verify once the toolchain is installed)*
- **Phase 5 — history & resilience:** trade history/statements, settings,
  reconnection, notifications.
- **Phase 6 — packaging** ✅ `scripts\package.ps1` (build → windeployqt → Inno
  Setup) produces `dist\ProlineTerminal-Setup.exe`; per-user install, Start-menu
  + desktop shortcuts, `prolineterminal://` deep-link registration.
  *(runs once MSVC + a Release build are available)*
- **Phase 7 — web integration:** "Client Terminal" install button in the trader
  navbar (post-login) + installer hosting/download endpoint.

## Layout

```
desktop-terminal/
├─ CMakeLists.txt
├─ scripts/        setup-toolchain.ps1, build.ps1, package.ps1 (later), installer.iss (later)
├─ src/
│  ├─ main.cpp
│  ├─ core/        Config, Session, Logger        (phase 1+)
│  ├─ net/         RestApi, PriceSocket, TradeSocket (phase 1-3)
│  ├─ models/      Account, Instrument, Position, Order, table models (phase 1-3)
│  └─ ui/          LoginDialog, MainWindow, MarketWatch, OrderPanel, ChartView … (phase 1+)
└─ resources/      icons, qss theme               (phase 1+)
```
