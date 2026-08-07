/*
 * Boots the TradingView widget once the Qt WebChannel bridge is ready.
 * The native app selects the symbol (watchlist) -> bridge.symbolChanged ->
 * chart follows; the native light/dark switch -> bridge.themeChanged.
 */
(function () {
  // Candle colours stay put across themes (green up / red down); only the
  // surfaces and axis type flip.
  function overridesFor(theme, compact) {
    const light = theme === "light";
    return {
      // Split view: drop the "Bitcoin / US Dollar · 5 · Proline Markets" line from the
      // legend. The pane header above it already names the instrument, so in a
      // half or quarter pane it is a second copy of the same fact sitting on
      // top of the candles. The OHLC row underneath is left alone — that IS
      // data, and it has no other home on the chart.
      //
      // A legend property rather than the `legend_widget` feature: that flag
      // removes the whole block, OHLC included.
      "paneProperties.legendProperties.showSeriesTitle": !compact,
      "paneProperties.background": light ? "#ffffff" : "#0e0f13",
      "paneProperties.backgroundType": "solid",
      "paneProperties.vertGridProperties.color": light ? "#eef1f5" : "#191b20",
      "paneProperties.horzGridProperties.color": light ? "#eef1f5" : "#191b20",
      "scalesProperties.textColor": light ? "#6b7280" : "#8a8f98",
      "scalesProperties.lineColor": light ? "#dfe3ea" : "#2a2d34",
      "mainSeriesProperties.candleStyle.upColor": "#26a269",
      "mainSeriesProperties.candleStyle.downColor": "#e01b24",
      "mainSeriesProperties.candleStyle.borderUpColor": "#26a269",
      "mainSeriesProperties.candleStyle.borderDownColor": "#e01b24",
      "mainSeriesProperties.candleStyle.wickUpColor": "#26a269",
      "mainSeriesProperties.candleStyle.wickDownColor": "#e01b24",
    };
  }

  const surfaceFor = (t) => (t === "light" ? "#ffffff" : "#0e0f13");

  /*
   * Proline Markets watermark, centred on the chart canvas.
   *
   * Built as our own DOM layer rather than through the library: the charting
   * library's symbolWatermark only draws the SYMBOL text, and there is no hook
   * for a custom image. This sits above the chart iframe but below the position
   * overlay (z-index 5 vs 20) and is transparent to the pointer, so drawing,
   * dragging SL/TP and the crosshair all behave exactly as before.
   *
   * Only the emblem is an image — the wordmark's type is black and would
   * vanish on the dark theme, so the name is real text that takes the theme
   * colour instead. The emblem has the same problem (its ring is black brush
   * strokes), so it ships in two colourways and the theme picks one.
   */
  function ensureWatermark(theme) {
    let el = document.getElementById("pm_watermark");
    if (!el) {
      el = document.createElement("div");
      el.id = "pm_watermark";
      el.style.cssText =
        "position:absolute;inset:0;display:flex;align-items:center;justify-content:center;" +
        "gap:20px;pointer-events:none;user-select:none;z-index:5;";

      const img = document.createElement("img");
      img.id = "pm_watermark_mark";
      img.alt = "";
      img.style.cssText = "width:88px;height:88px;";

      const txt = document.createElement("span");
      txt.id = "pm_watermark_text";
      txt.textContent = "Proline Markets";
      txt.style.cssText =
        "font:800 44px -apple-system,'Segoe UI',sans-serif;letter-spacing:0.5px;";

      el.appendChild(img);
      el.appendChild(txt);
      document.body.appendChild(el);
    }
    // Faint enough that candles and grid lines stay fully readable through it.
    el.style.opacity = theme === "light" ? "0.09" : "0.12";
    document.getElementById("pm_watermark_mark").src =
      theme === "light" ? "prolinemarket-mark.png" : "prolinemarket-mark-light.png";
    document.getElementById("pm_watermark_text").style.color =
      theme === "light" ? "#0d1117" : "#e6e8ec";
  }

  let widget = null;
  let datafeed = null;

  /*
   * Builds the chart in `theme`, replacing any existing one.
   *
   * The whole widget is rebuilt rather than calling changeTheme(), because
   * `toolbar_bg` and `loading_screen` are CONSTRUCTOR-ONLY options: after a
   * changeTheme() the chart pane repainted but the left drawing toolbar and the
   * bottom timeframe bar kept the old theme's background, leaving their icons
   * dark-on-dark and effectively invisible in light mode.
   *
   * The datafeed is deliberately NOT rebuilt — it owns bridge signal handlers
   * (barsReady / symbolsChanged / tick) that would stack up on every switch.
   */
  function createChart(bridge, theme) {
    const t = theme === "light" ? "light" : "dark";
    // Read live rather than taking it as an argument: createChart is also
    // called from themeChanged, which knows nothing about the grid.
    const compact = !!bridge.compact;
    const surface = surfaceFor(t);
    document.body.style.background = surface;
    // Lives outside the widget, so a theme rebuild only restyles it.
    ensureWatermark(t);

    // Carry the user's current view across the rebuild. On the FIRST build there
    // is no widget to read from, so the bridge is the source: on a restored
    // layout it already holds the pane's saved symbol and timeframe.
    let symbol = bridge.currentSymbol || "EURUSD";
    let interval = bridge.currentInterval || "5";
    if (widget) {
      try {
        const ch = widget.activeChart();
        symbol = ch.symbol() || symbol;
        interval = ch.resolution() || interval;
      } catch (e) { /* chart not ready — fall back to the defaults */ }
    }

    // Tear the old one down first: the overlay holds a rAF loop, bridge signal
    // handlers and a DOM layer, all of which must go with its chart.
    if (window.txPositions && window.txPositions.destroy) {
      try { window.txPositions.destroy(); } catch (e) { console.warn("overlay destroy", e); }
    }
    window.txPositions = null;
    if (widget) {
      try { widget.remove(); } catch (e) { console.warn("widget remove", e); }
      widget = null;
    }

    widget = new TradingView.widget({
      container: "tv_chart",
      library_path: "vendor/charting_library/",
      datafeed: datafeed,
      symbol: symbol,
      interval: interval,
      timezone: "Etc/UTC",
      theme: t,
      autosize: true,
      locale: "en",
      toolbar_bg: surface,
      loading_screen: { backgroundColor: surface, foregroundColor: "#2d6df6" },
      // NOTE: deliberately no broker_factory. The vendored charting_library is
      // the *Advanced Charts* build, where the Broker API and native position
      // lines are disabled ("only available on Trading Platform"). Position
      // lines are drawn by our own overlay instead — see pm_positions.js.
      // (pm_broker.js stays ready for the day a Trading Platform build lands
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
        // Split view (2 or 4 panes): drop the drawing toolbar down the left and
        // the date-range bar along the bottom. Both are worth their space on a
        // full-window chart; in a quarter pane they take most of the height and
        // width that the candles need. sc.compact is set by ChartArea whenever
        // the grid crosses between one pane and several.
        //
        // These are CONSTRUCTOR-ONLY, like toolbar_bg — there is no runtime API
        // to toggle a feature, which is why compactChanged rebuilds the widget
        // rather than flipping something on the live chart.
        ...(compact ? ["left_toolbar", "timeframes_toolbar"] : []),
      ],
      // Left drawing toolbar stays open on a single full-size chart.
      enabled_features: [],
      overrides: overridesFor(t, compact),
    });

    window.tvWidget = widget;

    // Draw open positions on the chart: entry line + draggable SL/TP lines
    // wired to the real server position, plus a ✕ close control.
    window.txPositions = window.makePositionOverlay(widget, bridge);

    widget.onChartReady(() => {
      const l = document.getElementById("loading");
      if (l) l.style.display = "none";
      // Re-attached per widget: a theme switch rebuilds the chart, and with it
      // the iframe the observer was watching.
      watchDialogs(bridge);

      // Tell the host what this pane is showing, and keep telling it. The
      // timeframe toolbar and the chart's own symbol header never go through
      // the host, so without this the layout it saves is only ever what the
      // watchlist last set — and a pane left on H1 came back on M5.
      //
      // Subscribed per widget for the same reason watchDialogs is: a rebuild
      // throws the old chart (and its subscriptions) away.
      try {
        const ch = widget.activeChart();
        bridge.reportSymbol(String(ch.symbol() || ""));
        bridge.reportInterval(String(ch.resolution() || ""));
        ch.onSymbolChanged().subscribe(null, () => {
          try { bridge.reportSymbol(String(ch.symbol() || "")); } catch (e) { /* gone */ }
        });
        ch.onIntervalChanged().subscribe(null, (iv) => {
          try { bridge.reportInterval(String(iv || ch.resolution() || "")); } catch (e) { /* gone */ }
        });
      } catch (e) {
        console.warn("chart state reporting unavailable", e);
      }
    });
  }

  /*
   * Watches the chart for open dialogs (Indicators, chart settings, symbol
   * search …) and tells the native side to hide the one-click strip while one
   * is up.
   *
   * Why this is needed: the charting library renders its dialogs INSIDE its own
   * iframe. Anything in this document — the watermark, and the native Qt strip
   * floating over the web view — paints above that iframe's content, so a
   * dialog could never come out in front. Nothing about z-index can fix it from
   * our side; the covering elements have to get out of the way instead.
   *
   * The iframe is same-origin (both file://, and LocalContentCanAccessFileUrls
   * is enabled), so its document is reachable. If that ever stops being true we
   * log it and simply keep the old behaviour rather than breaking the chart.
   */
  function watchDialogs(bridge) {
    const host = document.getElementById("tv_chart");
    const frame = host && host.querySelector("iframe");
    let doc = null;
    try {
      doc = frame && (frame.contentDocument || (frame.contentWindow || {}).document);
    } catch (e) { /* cross-origin — handled below */ }
    if (!doc || !doc.body) {
      console.warn("dialog watch: chart iframe document unavailable; strip will not auto-hide");
      return;
    }

    // Two families to catch, with several selectors each because the library
    // has changed this markup across versions and a missed match means a
    // covered popup again:
    //   - modal dialogs   (Indicators, chart settings, symbol search)
    //   - dropdown menus  (the interval "5m" picker, the chart-type picker)
    const SEL = [
      '[data-dialog-name]', '[role="dialog"]', '.tv-dialog', '.ui-draggable-dialog',
      '[class*="dialog-"]',
      '[data-name="popup-menu-container"]', '[data-name="menu-inner"]',
      '.tv-dropdown-behavior__body', '[class*="menuWrap"]', '[class*="popupMenu"]'
    ].join(',');

    // Presence is not enough: some of these containers exist permanently and
    // are merely empty when closed, which would pin the strip hidden forever.
    // Require something actually laid out on screen.
    function anythingOpen() {
      const nodes = doc.querySelectorAll(SEL);
      for (let i = 0; i < nodes.length; i++) {
        const r = nodes[i].getBoundingClientRect();
        if (r.width > 1 && r.height > 1) return true;
      }
      return false;
    }

    let last = null;
    function update() {
      const open = anythingOpen();
      if (open === last) return;
      last = open;
      const wm = document.getElementById("pm_watermark");
      if (wm) wm.style.visibility = open ? "hidden" : "visible";
      try { bridge.setOverlayHidden(open); } catch (e) { console.warn("setOverlayHidden", e); }
    }

    // Menus often open by toggling style/class on an existing node rather than
    // inserting one, so attributes are watched too.
    new MutationObserver(update).observe(doc.body, {
      childList: true, subtree: true, attributes: true,
      attributeFilter: ["style", "class", "data-name"],
    });

    // Backstop poll. If a single mutation is ever missed the strip would stay
    // hidden with no way back; this guarantees it recovers within a tick.
    if (window.txDialogPoll) clearInterval(window.txDialogPoll);
    window.txDialogPoll = setInterval(update, 400);

    update();
    console.info("dialog watch: attached");
  }

  function boot(bridge) {
    window.sc = bridge;
    datafeed = window.makeDatafeed(bridge);
    createChart(bridge, bridge.theme);

    // Registered ONCE, outside createChart — they read the current `widget`, so
    // a rebuild swaps the chart underneath them without stacking handlers.
    bridge.symbolChanged.connect((sym) => {
      if (!sym || !widget) return;
      try { widget.activeChart().setSymbol(sym); } catch (e) { /* not ready yet */ }
    });
    // Host -> chart timeframe. Restoring a saved layout sets this before the
    // widget exists, which is why createChart also reads it off the bridge; this
    // handler covers the case where it arrives after the chart is already up.
    bridge.intervalChanged.connect((iv) => {
      if (!iv || !widget) return;
      try {
        const ch = widget.activeChart();
        if (String(ch.resolution()) !== String(iv)) ch.setResolution(String(iv));
      } catch (e) { /* not ready yet */ }
    });
    bridge.themeChanged.connect((theme) => createChart(bridge, theme));
    // Same rebuild path as a theme switch: the features that hide the drawing
    // toolbar and the bottom bar can only be set when the widget is built.
    // ChartBridge::setCompact only emits on an actual change, so switching
    // between 2 and 4 panes does not rebuild anything.
    bridge.compactChanged.connect(() => createChart(bridge, bridge.theme));
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
