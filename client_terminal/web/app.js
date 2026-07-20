/*
 * Boots the TradingView widget once the Qt WebChannel bridge is ready.
 * The native app selects the symbol (watchlist) -> bridge.symbolChanged ->
 * chart follows.
 */
(function () {
  const DARK_OVERRIDES = {
    "paneProperties.background": "#0e0f13",
    "paneProperties.backgroundType": "solid",
    "paneProperties.vertGridProperties.color": "#191b20",
    "paneProperties.horzGridProperties.color": "#191b20",
    "scalesProperties.textColor": "#8a8f98",
    "scalesProperties.lineColor": "#2a2d34",
    "mainSeriesProperties.candleStyle.upColor": "#26a269",
    "mainSeriesProperties.candleStyle.downColor": "#e01b24",
    "mainSeriesProperties.candleStyle.borderUpColor": "#26a269",
    "mainSeriesProperties.candleStyle.borderDownColor": "#e01b24",
    "mainSeriesProperties.candleStyle.wickUpColor": "#26a269",
    "mainSeriesProperties.candleStyle.wickDownColor": "#e01b24",
  };

  function boot(bridge) {
    window.sc = bridge;
    const datafeed = window.makeDatafeed(bridge);
    const initialSymbol = bridge.currentSymbol || "EURUSD";

    const widget = new TradingView.widget({
      container: "tv_chart",
      library_path: "vendor/charting_library/",
      datafeed: datafeed,
      symbol: initialSymbol,
      interval: "5",
      timezone: "Etc/UTC",
      theme: "dark",
      autosize: true,
      locale: "en",
      toolbar_bg: "#0e0f13",
      loading_screen: { backgroundColor: "#0e0f13", foregroundColor: "#2d6df6" },
      // NOTE: deliberately no broker_factory. The vendored charting_library is
      // the *Advanced Charts* build, where the Broker API and native position
      // lines are disabled ("only available on Trading Platform"). Position
      // lines are drawn by our own overlay instead — see sc_positions.js.
      // (sc_broker.js stays ready for the day a Trading Platform build lands
      // in vendor/.)
      // Quick-access timeframe buttons in the header (1m 3m 5m … D W M),
      // matching the web terminal's toolbar.
      favorites: {
        intervals: ["1", "3", "5", "10", "15", "30", "45", "60", "120", "180", "240", "1D", "1W", "1M"],
      },
      disabled_features: [
        "use_localstorage_for_settings",
        "header_saveload",
        "header_compare",
      ],
      // Left drawing toolbar stays open (as on the web chart).
      enabled_features: [],
      overrides: DARK_OVERRIDES,
    });

    window.tvWidget = widget;

    // Draw open positions on the chart: entry line + draggable SL/TP lines
    // wired to the real server position, plus a ✕ close control.
    window.scPositions = window.makePositionOverlay(widget, bridge);

    widget.onChartReady(() => {
      const l = document.getElementById("loading");
      if (l) l.style.display = "none";

      // Native watchlist selection -> switch chart symbol.
      bridge.symbolChanged.connect((sym) => {
        if (sym) widget.activeChart().setSymbol(sym);
      });
    });
  }

  function fail(msg) {
    const l = document.getElementById("loading");
    if (l) l.textContent = msg;
    console.error(msg);
  }

  if (typeof qt !== "undefined" && qt.webChannelTransport) {
    new QWebChannel(qt.webChannelTransport, (channel) => {
      const bridge = channel.objects.sc;
      if (bridge) boot(bridge);
      else fail("Chart bridge not found");
    });
  } else {
    fail("Qt WebChannel transport unavailable");
  }
})();
