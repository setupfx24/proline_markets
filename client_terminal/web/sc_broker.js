/*
 * Proline Broker API adapter for the TradingView Trading Terminal.
 *
 * This turns the read-only chart into a trading chart: it draws a line for
 * every open position (with live P&L + a close ✕), and lets the user drag the
 * SL / TP handles — each drag is sent to the REAL server position over the Qt
 * bridge (`sc.modifyBrackets` -> PUT /api/v1/positions/{id}) and validated
 * server-side. Closing (✕) calls `sc.closePosition` -> POST .../close.
 *
 * Positions are the source of truth from the native side: MainWindow polls
 * /positions every few seconds and pushes them across the bridge as
 * `positionsJson` + a `positionsChanged` signal; live ticks drive smooth P&L
 * between polls. Order *entry* stays in the native Order Ticket — this adapter
 * only manages existing positions (market/limit order entry is disabled).
 *
 * Bridge contract used here (C++ ChartBridge):
 *   property  string positionsJson              // [{id,symbol,side,lots,open_price,current_price,sl,tp,profit}]
 *   signal    positionsChanged()
 *   invokable modifyBrackets(id, sl, tp)         // sl/tp <= 0 clears that leg
 *   invokable closePosition(id)
 *   signal    positionOp(id, op, ok, message)    // op = "modify" | "close"
 *   signal    tick(symbol, bid, ask, tsMs)
 *   property  string symbolsJson
 */

(function () {
  var Side = { Buy: 1, Sell: -1 };
  var Connected = 1;

  function tickForDigits(d) { return Math.pow(10, -(d == null ? 5 : d)); }
  function pipForDigits(d)  { return Math.pow(10, -((d == null ? 5 : d) - 1)); }

  function ProlineBroker(host, bridge) {
    this._host = host;
    this._bridge = bridge;

    // symbol -> spec (digits etc.)
    this._meta = {};
    try {
      JSON.parse(bridge.symbolsJson || "[]").forEach(function (s) { this._meta[s.symbol] = s; }, this);
    } catch (e) { /* ignore */ }

    // id -> { pos, symbol, side, avgPrice, lastPl, lastLivePl, moneyPerPrice }
    this._positions = {};
    this._quotes = {};                 // symbol -> { bid, ask }
    this._pending = {};                // "id|op" -> { resolve, reject }
    this._openPl = host.createWatchedValue(0);
    this._equity = host.createWatchedValue(0);

    var self = this;
    bridge.tick.connect(function (sym, bid, ask) {
      self._quotes[sym] = { bid: bid, ask: ask };
      self._updatePL(sym);
    });
    bridge.positionsChanged.connect(function () { self._reconcile(); });
    bridge.positionOp.connect(function (id, op, ok, msg) { self._onOp(id, op, ok, msg); });

    this._reconcile();
  }

  // ---- helpers ------------------------------------------------------------

  ProlineBroker.prototype._tick = function (symbol) {
    var m = this._meta[symbol];
    return tickForDigits(m ? m.digits : 5);
  };

  ProlineBroker.prototype._parsePositions = function () {
    var arr = [];
    try { arr = JSON.parse(this._bridge.positionsJson || "[]") || []; } catch (e) {}
    return arr;
  };

  // Build a TradingView Position object from a bridge position record.
  ProlineBroker.prototype._toTv = function (p) {
    var side = (String(p.side).toLowerCase() === "sell") ? Side.Sell : Side.Buy;
    var pos = {
      id: String(p.id),
      symbol: p.symbol,
      qty: Math.abs(p.lots),
      side: side,
      avgPrice: p.open_price,
      last: p.current_price,
      pl: p.profit,
    };
    if (p.sl > 0) pos.stopLoss = p.sl;
    if (p.tp > 0) pos.takeProfit = p.tp;
    return pos;
  };

  // Reconcile the chart's position lines with the latest server snapshot.
  ProlineBroker.prototype._reconcile = function () {
    var arr = this._parsePositions();
    var seen = {};
    var self = this;

    arr.forEach(function (p) {
      var id = String(p.id);
      seen[id] = true;
      var pos = self._toTv(p);
      var rec = self._positions[id] || {};
      rec.pos = pos;
      rec.symbol = p.symbol;
      rec.side = pos.side;
      rec.avgPrice = p.open_price;
      rec.lastPl = p.profit;

      // Calibrate "money per unit of price" from the server's authoritative
      // P&L, so intra-poll ticks can move the line's P&L smoothly and stay in
      // sync with the server value at each poll.
      var move = pos.side === Side.Buy
        ? (p.current_price - p.open_price)
        : (p.open_price - p.current_price);
      if (Math.abs(move) > self._tick(p.symbol) * 2 && Math.abs(p.profit) > 1e-9) {
        rec.moneyPerPrice = p.profit / move;
      }
      self._positions[id] = rec;

      self._host.positionUpdate(pos);
      self._host.plUpdate(id, p.profit);
    });

    // A position that vanished from the snapshot was closed (manually, by an
    // SL/TP hit, or from another device) — remove its line (qty:0).
    Object.keys(this._positions).forEach(function (id) {
      if (!seen[id]) {
        var old = self._positions[id].pos;
        self._host.positionUpdate(Object.assign({}, old, { qty: 0 }));
        delete self._positions[id];
      }
    });

    this._recomputeTotals();
  };

  // Smooth live P&L for positions on `sym` between polls.
  ProlineBroker.prototype._updatePL = function (sym) {
    var q = this._quotes[sym];
    if (!q) return;
    var self = this;
    var touched = false;
    Object.keys(this._positions).forEach(function (id) {
      var r = self._positions[id];
      if (r.symbol !== sym || r.moneyPerPrice == null) return;
      var close = r.side === Side.Buy ? q.bid : q.ask;
      var move = r.side === Side.Buy ? (close - r.avgPrice) : (r.avgPrice - close);
      var pl = r.moneyPerPrice * move;
      r.lastLivePl = pl;
      self._host.plUpdate(id, pl);
      touched = true;
    });
    if (touched) this._recomputeTotals();
  };

  ProlineBroker.prototype._recomputeTotals = function () {
    var total = 0;
    var self = this;
    Object.keys(this._positions).forEach(function (id) {
      var r = self._positions[id];
      total += (r.lastLivePl != null) ? r.lastLivePl : (r.lastPl || 0);
    });
    this._openPl.setValue(total);
  };

  // Resolve/reject the pending modify/close promise; toast on rejection.
  ProlineBroker.prototype._onOp = function (id, op, ok, msg) {
    var key = id + "|" + op;
    var pend = this._pending[key];
    if (pend) {
      delete this._pending[key];
      if (ok) pend.resolve(); else pend.reject(new Error(msg || "Rejected"));
    }
    if (!ok) {
      // 1 == Error notification. The library snaps the dragged line back
      // automatically because the returned promise rejected.
      this._host.showNotification(op === "close" ? "Close rejected" : "Modify rejected",
                                  msg || "The server rejected this change.", 1);
    }
  };

  // ---- IBrokerCommon ------------------------------------------------------

  ProlineBroker.prototype.connectionStatus = function () { return Connected; };

  ProlineBroker.prototype.chartContextMenuActions = function (context, options) {
    return this._host.defaultContextMenuActions(context, options);
  };

  ProlineBroker.prototype.isTradable = function (symbol) {
    return Promise.resolve(true);
  };

  ProlineBroker.prototype.orders = function () { return Promise.resolve([]); };

  ProlineBroker.prototype.executions = function (symbol) { return Promise.resolve([]); };

  ProlineBroker.prototype.positions = function () {
    var self = this;
    return Promise.resolve(this._parsePositions().map(function (p) { return self._toTv(p); }));
  };

  ProlineBroker.prototype.symbolInfo = function (symbol) {
    var m = this._meta[symbol] || {};
    var d = (m.digits != null) ? m.digits : 5;
    return Promise.resolve({
      qty: { min: 0.01, max: 100, step: 0.01, uiStep: 0.01, default: 0.01 },
      pipValue: 1,
      pipSize: pipForDigits(d),
      minTick: tickForDigits(d),
      description: m.display_name || symbol,
      type: "forex",
      currency: "USD",
    });
  };

  ProlineBroker.prototype.accountManagerInfo = function () {
    return {
      accountTitle: "Proline",
      summary: [
        { text: "Open P&L", wValue: this._openPl, formatter: "profit" },
      ],
      orderColumns: [],
      positionColumns: [
        { label: "Symbol",    id: "symbol",    dataFields: ["symbol"],              formatter: "symbol" },
        { label: "Side",      id: "side",      dataFields: ["side"],                formatter: "side" },
        { label: "Qty",       id: "qty",       dataFields: ["qty"],                 formatter: "formatQuantity" },
        { label: "Avg Price", id: "avgPrice",  dataFields: ["avgPrice", "symbol"],  formatter: "formatPrice" },
        { label: "SL",        id: "sl",        dataFields: ["stopLoss", "symbol"],  formatter: "formatPrice" },
        { label: "TP",        id: "tp",        dataFields: ["takeProfit", "symbol"], formatter: "formatPrice" },
        { label: "P&L",       id: "pl",        dataFields: ["pl"],                  formatter: "profit" },
      ],
      pages: [],
    };
  };

  // ---- IBrokerAccountInfo -------------------------------------------------

  ProlineBroker.prototype.accountsMetainfo = function () {
    return Promise.resolve([{ id: "main", name: "Proline" }]);
  };

  ProlineBroker.prototype.currentAccount = function () { return "main"; };

  // ---- IBrokerTerminal ----------------------------------------------------

  // Order entry stays in the native Order Ticket; reject any chart order entry.
  ProlineBroker.prototype.placeOrder = function (order) {
    this._host.showNotification("Use the Order panel",
      "Open new trades from the terminal's Order Ticket.", 1);
    return Promise.reject(new Error("Order entry is disabled on the chart"));
  };

  ProlineBroker.prototype.modifyOrder = function () { return Promise.resolve(); };
  ProlineBroker.prototype.cancelOrder = function () { return Promise.resolve(); };

  // Drag SL/TP handle -> modify the real server position.
  ProlineBroker.prototype.editPositionBrackets = function (positionId, brackets) {
    var id = String(positionId);
    var sl = (brackets && brackets.stopLoss > 0) ? brackets.stopLoss : 0;
    var tp = (brackets && brackets.takeProfit > 0) ? brackets.takeProfit : 0;
    var self = this;
    return new Promise(function (resolve, reject) {
      self._pending[id + "|modify"] = { resolve: resolve, reject: reject };
      self._bridge.modifyBrackets(id, sl, tp);
    });
  };

  // ✕ on the line -> close the real server position.
  ProlineBroker.prototype.closePosition = function (positionId) {
    var id = String(positionId);
    var self = this;
    return new Promise(function (resolve, reject) {
      self._pending[id + "|close"] = { resolve: resolve, reject: reject };
      self._bridge.closePosition(id);
    });
  };

  // Broker config passed to TradingView.widget alongside broker_factory.
  window.PROLINE_BROKER_CONFIG = {
    configFlags: {
      supportPositions: true,
      supportPositionBrackets: true,   // draggable SL/TP on positions
      supportModifyBrackets: true,
      supportClosePosition: true,      // ✕ -> closePosition()
      supportPLUpdate: true,           // we push live P&L
      supportStopLoss: true,
      supportMarketOrders: false,      // order entry stays in the Order Ticket
      supportLimitOrders: false,
      supportStopOrders: false,
      supportModifyOrderPrice: false,
      supportEditAmount: false,
      supportReversePosition: false,
      supportLevel2Data: false,
      supportOrderBrackets: false,
      supportMarketBrackets: false,
      showQuantityInsteadOfAmount: true,
      supportDemoLiveSwitcher: false,
    },
    durations: [],
  };

  window.makeBroker = function (host, bridge) { return new ProlineBroker(host, bridge); };
})();
