# SwissCresta Terminal

A native **C++ / Qt6 desktop trading terminal** for the SwissCresta platform.
It connects to the [SwissCresta Algo API](../swissCresta/SwissCresta/ALGO_API.md)
over REST + WebSocket and gives you a live watchlist, candlestick charts,
an order ticket (BUY / SELL / CLOSE), and an account panel — all updating in
real time from the same LP feed as the web platform.

![layout](docs/layout.png)

## Features

- **Live watchlist** — every instrument with bid / ask / spread, updated on
  every tick (green/red flash on price direction).
- **Candlestick chart** — QtCharts, selectable timeframe (1m…1d), the last
  candle updates live from the tick stream.
- **Order ticket** — volume + optional SL/TP, one-click BUY / SELL and a
  CLOSE-all for the selected symbol (with confirmation).
- **Account panel** — balance, credit, equity, margin used/free, margin
  level, leverage, open positions; auto-refreshes every 5s.
- **Live tick stream** over WebSocket with first-message auth and
  auto-reconnect.
- **Dark theme**, dockable panels.

## Architecture

```
src/
  core/
    Models.h        plain structs mirroring the API JSON
    Config.*        load/save API key+secret+endpoints (JSON in AppConfig)
    ApiClient.*     async REST: account, symbols, prices, bars, trade
    PriceStream.*   WebSocket live tick stream + reconnect
  ui/
    LoginDialog.*   credentials + endpoints entry
    WatchlistWidget.*  live quote table
    ChartWidget.*      candlestick chart + timeframe selector
    OrderTicket.*      BUY / SELL / CLOSE entry
    AccountPanel.*     balance / equity / margin summary
    MainWindow.*       wires services + widgets together
  main.cpp          theme + startup flow
```

The UI never talks to the network directly — `MainWindow` owns `ApiClient`
and `PriceStream` and connects their signals to the widgets.

## Toolchain

Built with the **MSYS2 UCRT64** toolchain (installed at `E:\msys64`):

- g++ 16.x, CMake, Ninja
- Qt6: Widgets, Network, WebSockets, Charts

If you move MSYS2, update the `E:\msys64` paths in `build.ps1` / `run.ps1`.

## Build

```powershell
powershell -ExecutionPolicy Bypass -File build.ps1
```

> The build is intentionally single-threaded with `-O1` — the Qt/Charts
> headers are memory-heavy and this machine's system drive (C:) is nearly
> full, so a parallel `-O3` build runs the compiler out of memory. Bump
> `-j` / `-O` in `build.ps1` once there's free RAM/pagefile headroom.

## Run

```powershell
powershell -ExecutionPolicy Bypass -File run.ps1
```

On first launch you'll be asked for your **API Key** and **API Secret**
(generate them from your SwissCresta dashboard). For production leave the
endpoints as the defaults:

- REST base: `https://api.swisscresta.com/api/algo`
- WebSocket: `wss://api.swisscresta.com/ws/algo/prices`

For a local backend, point them at your local gateway instead.
Credentials are saved to
`%APPDATA%\SwissCresta\SwissCresta Terminal\config.json`.

## ⚠️ Smart App Control must be off to run

This machine has **Windows Smart App Control (SAC) in Enforcement mode**,
which blocks *all* unsigned executables — including this freshly-compiled
`terminal.exe`. The app builds fine but Windows refuses to launch it.

A self-signed certificate does **not** help — SAC only trusts
Microsoft-recognised signatures / reputation. To run a locally-built app you
must turn SAC off:

**Windows Security → App & browser control → Smart App Control → Off**

> Turning SAC off is **irreversible** — re-enabling it requires resetting
> Windows. It's a deliberate security trade-off; decide consciously. Once
> off, `run.ps1` launches the terminal normally.

## Roadmap ideas

- Open-positions table with live floating P/L and per-position close.
- SL/TP modification on existing positions.
- Multiple charts / symbol tabs.
- Depth-of-market / one-click trading from the chart.
- Persist window layout and last-selected symbol.
