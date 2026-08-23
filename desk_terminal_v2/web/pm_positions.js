/*
 * Proline Markets on-chart position overlay — desktop port of the web terminal's
 * ChartingLibraryChart position layer (vxness_trade/frontend/src/components/
 * ChartingLibraryChart.jsx is the reference for the SL/TP interaction).
 *
 * The vendored charting_library is the *Advanced Charts* build, where
 * createPositionLine / the Broker API throw ("only available on Trading
 * Platform"). So, exactly like the web build (USE_NATIVE_BROKER = false), the
 * position layer is drawn by hand:
 *
 *   - entry / SL / TP price lines  -> createShape('horizontal_line'). Only the
 *     entry line carries an on-line label (its live P&L, right-aligned onto the
 *     price axis); the SL/TP lines are bare dashed lines — their price and
 *     projected P&L live on the pill that rides them.
 *   - one segmented pill per line  -> [badge][price][P&L][lots][✕], real HTML,
 *     pinned at the LEFT edge (clear of the drawing toolbar) on the line it
 *     describes. Entry pill's ✕ closes the position.
 *   - an UNSET bracket shows as a badge-only handle parked on the right at the
 *     entry line — drag it down/up to create the bracket.
 *   - press & drag a badge/price segment -> dashed preview line + shaded zone
 *     follow the cursor showing the target price and the P&L there; release
 *     saves immediately. A plain click (no drag) opens a type-a-price dialog
 *     instead (blank removes the bracket).
 *
 * price -> pixel: this build exposes no priceToCoordinate, so the SCALE comes
 * from the price scale (getVisiblePriceRange + pane height, re-read every
 * frame so things track zoom/pan) and the vertical OFFSET is pinned from
 * TradingView's own crosshair events. Pills therefore appear once the cursor
 * has moved over the chart — which it has by the time you go to drag one.
 *
 * Only the dragged bracket is sent. Unlike the vxness backend (which wipes an
 * omitted leg, so its web build re-sends both), the Proline Markets modify endpoint does
 * a PARTIAL update — re-sending the other bracket from a stale snapshot would
 * silently revert it. Keep this single-bracket.
 */

(function () {
  // Colours lifted from SwisDex ChartingLibraryChart: entry line coloured by
  // side (BUY blue / SELL red), its label coloured by P&L (profit blue / loss
  // red / break-even gray); SL amber, TP teal.
  var BUY_COLOR = "#3b82f6", SELL_COLOR = "#ef4444";
  var SL_COLOR  = "#f59e0b", TP_COLOR   = "#14b8a6";
  var SL_ZONE   = "rgba(239,68,68,0.10)", TP_ZONE = "rgba(20,184,166,0.10)";
  var PROFIT_POS = "#3b82f6", PROFIT_NEG = "#ef4444", BREAKEVEN = "#9ca3af";
  var LINE_SOLID = 0, LINE_DASHED = 2;
  var BTN_RIGHT_PX = 268;         // clear of the price axis + its P&L label
  var LEFT_PX      = 54;          // clear of the left drawing toolbar

  // Pill chrome — follows the app's light/dark theme (sc.theme + themeChanged).
  var PILL_BG, PILL_FG, PILL_DIM, PILL_DIV, DLG_BG, DLG_BORDER, DLG_FG, DLG_SUB, DLG_INPUT;
  var GREEN = "#16a34a", RED = "#dc2626";

  function applyThemeVars(theme) {
    var light = theme === "light";
    PILL_BG   = light ? "#ffffff" : "#1b1f27";
    PILL_FG   = light ? "#111827" : "#e5e7eb";
    PILL_DIM  = light ? "#6b7280" : "#9ca3af";
    PILL_DIV  = light ? "1px solid rgba(0,0,0,.10)" : "1px solid rgba(255,255,255,.08)";
    DLG_BG    = light ? "#ffffff" : "#171a20";
    DLG_BORDER= light ? "#dfe4ec" : "#2a2d34";
    DLG_FG    = light ? "#111827" : "#e6e8ec";
    DLG_SUB   = light ? "#6b7280" : "#9aa0a8";
    DLG_INPUT = light ? "#f7f9fc" : "#0e1014";
  }
  applyThemeVars("dark");

  function fmt(price, digits) {
    var d = (digits == null ? 5 : digits);
    return Number(price).toFixed(d);
  }
  function fmtProfit(p) {
    var v = Number(p) || 0;
    return (v >= 0 ? "+$" : "−$") + Math.abs(v).toFixed(2);
  }

  function Overlay(widget, bridge) {
    this._w = widget;
    this._bridge = bridge;
    this._chart = null;
    this._symbol = null;
    this._meta = {};
    this._pos = {};        // posId -> server record
    this._shapes = {};     // posId -> { entry, sl, tp } shape ids
    this._drawn = {};      // "posId|kind" -> level currently on screen
    this._rows = [];       // [{ p, entry, sl, tp }] pill rows
    this._rowKey = "";     // rebuild pills only when the position set changes
    this._quote = {};      // symbol -> { bid, ask } for live P&L between polls
    this._calibOffset = null;

    applyThemeVars(bridge.theme || "dark");

    var self = this;
    // Every bridge subscription is recorded so destroy() can undo it. app.js
    // rebuilds the whole widget (and this overlay) on a theme switch, and
    // without disconnecting, each switch would leave another live handler
    // driving a dead chart.
    this._binds = [];
    this._dead = false;
    var bind = function (sig, fn) {
      try { sig.connect(fn); self._binds.push([sig, fn]); } catch (e) {}
    };
    this._bind = bind;

    // The page boots before /symbols has answered, so symbolsJson is usually
    // still "[]" here. Read it now AND on every symbolsChanged — without the
    // refresh, contract_size stays unknown (falling back to 1), which made the
    // entry label's % and every SL/TP money preview wildly wrong.
    this._loadMeta();
    bind(bridge.symbolsChanged, function () {
      self._loadMeta();
      self._sync();
    });
    widget.onChartReady(function () {
      try { self._chart = widget.activeChart(); } catch (e) { return; }
      try { self._symbol = self._chart.symbol(); } catch (e) {}

      self._buildOverlayEl();
      self._subscribeCrosshair();

      try {
        self._chart.onSymbolChanged().subscribe(null, function () {
          try { self._symbol = self._chart.symbol(); } catch (e) {}
          self._clearAll();
          self._sync();
        });
      } catch (e) {}

      // The bridge only forwards ticks for the charted symbol — exactly what the
      // entry pill needs to move its P&L smoothly between position polls.
      bind(bridge.tick, function (sym, bid, ask) {
        self._quote[sym] = { bid: bid, ask: ask };
      });
      bind(bridge.positionsChanged, function () { self._sync(); });
      bind(bridge.positionOp, function (id, op, ok, msg) { self._onOp(id, op, ok, msg); });
      // No themeChanged handler here on purpose: app.js rebuilds the widget and
      // this overlay on a theme switch, and the new instance picks up the new
      // colours in its constructor.

      self._sync();
      self._startLoop();
    });
  }

  // ---- symbol helpers ------------------------------------------------------

  Overlay.prototype._loadMeta = function () {
    try {
      var m = {};
      JSON.parse(this._bridge.symbolsJson || "[]").forEach(function (s) { m[s.symbol] = s; });
      this._meta = m;
    } catch (e) {}
  };

  Overlay.prototype._digits = function (sym) {
    var m = this._meta[sym];
    return m && m.digits != null ? m.digits : 5;
  };
  Overlay.prototype._contract = function (sym) {
    var m = this._meta[sym];
    return m && m.contract_size > 0 ? m.contract_size : 1;
  };
  Overlay.prototype._isBuy = function (p) {
    return String(p.side).toLowerCase() !== "sell";
  };
  // What the position would realise if it closed at `level`. The server stays
  // authoritative — this only previews a level before it is committed.
  Overlay.prototype._pnlAt = function (p, level) {
    var dir = this._isBuy(p) ? 1 : -1;
    return (level - Number(p.open_price)) * dir * Number(p.lots) * this._contract(p.symbol);
  };
  // Live P&L for the entry pill: anchor on the server's authoritative profit and
  // add only the move since the price that profit was computed at. Exact at each
  // poll, smooth in between — better than recomputing from scratch, which would
  // drop swap/commission.
  Overlay.prototype._livePnl = function (p) {
    var base = Number(p.profit) || 0;
    var q = this._quote[p.symbol];
    var ref = Number(p.current_price) || 0;
    if (!q || !(ref > 0)) return base;
    var cur = this._isBuy(p) ? q.bid : q.ask;
    if (!(cur > 0)) return base;
    var dir = this._isBuy(p) ? 1 : -1;
    return base + (cur - ref) * dir * Number(p.lots) * this._contract(p.symbol);
  };

  // A bracket may only sit on the side of the entry that its purpose implies:
  // BUY  -> TP above entry, SL below.   SELL -> TP below entry, SL above.
  // Returns "" when the level is acceptable (0 = remove, always allowed).
  Overlay.prototype._invalidReason = function (p, kind, level) {
    if (!(level > 0)) return "";
    var isBuy = this._isBuy(p);

    // Judged against the CURRENT market, not the entry price. Checking the
    // entry rejected the single most common thing anyone does with a stop —
    // trailing it to break-even or into profit on a winner — before the
    // request ever left the terminal. The server allows exactly that and
    // validates this same way (trading_service.modify_position), so the
    // reference here is the price the position would CLOSE at: bid for a buy,
    // ask for a sell.
    var q = this._quote[p.symbol];
    var ref = q ? (isBuy ? q.bid : q.ask) : 0;
    // No tick yet — fall back to the server's last close price, and if there
    // is not even that, let it through: the server checks again anyway, and
    // guessing here would block a legitimate move on a quiet symbol.
    if (!(ref > 0)) ref = Number(p.current_price) || 0;
    if (!(ref > 0)) return "";

    if (kind === "tp") {
      if (isBuy  && level <= ref) return "Take Profit must be ABOVE the current price.";
      if (!isBuy && level >= ref) return "Take Profit must be BELOW the current price.";
    } else {
      if (isBuy  && level >= ref) return "Stop Loss must be BELOW the current price.";
      if (!isBuy && level <= ref) return "Stop Loss must be ABOVE the current price.";
    }
    return "";
  };

  // ---- price <-> pixel -----------------------------------------------------

  Overlay.prototype._buildOverlayEl = function () {
    // A sibling layer over the chart area (like SwisDex's overlayRef), NOT a
    // child of #tv_chart — the TradingView widget renders into an iframe there
    // and would stack over anything inside it. This sits on top, transparent to
    // pointer events except on the pills themselves.
    var chartEl = document.getElementById("tv_chart");
    var el = document.createElement("div");
    el.id = "tx_pos_overlay";
    el.style.cssText = "position:absolute;inset:0;pointer-events:none;z-index:20;overflow:hidden;";
    document.body.appendChild(el);
    this._overlay = el;
    this._host = chartEl || el;      // rect + height reference (same inset:0 box)
  };

  // Visible price window + pane height, re-read every frame so the overlay
  // tracks zoom/pan. Supports the linear and log price scales.
  Overlay.prototype._geom = function () {
    try {
      var pane = this._chart.getPanes()[0];
      var ps = pane && pane.getMainSourcePriceScale && pane.getMainSourcePriceScale();
      if (!ps) return null;
      var mode = ps.getMode ? ps.getMode() : 0;
      if (mode !== 0 && mode !== 1) return null;
      var range = ps.getVisiblePriceRange && ps.getVisiblePriceRange();
      var h = pane.getHeight ? pane.getHeight() : 0;
      if (!range || !(h > 0) || !(range.to > range.from)) return null;
      if (mode === 1 && !(range.from > 0)) return null;
      return { top: range.to, bottom: range.from, h: h, log: mode === 1 };
    } catch (e) { return null; }
  };

  Overlay.prototype._paneY = function (price, g) {
    if (g.log) {
      if (!(price > 0)) return NaN;
      var lt = Math.log(g.top), lb = Math.log(g.bottom);
      return (g.h * (lt - Math.log(price))) / (lt - lb);
    }
    return (g.h * (g.top - price)) / (g.top - g.bottom);
  };

  // The crosshair gives a (price, offsetY) pair, which pins the pane's top edge
  // in container coordinates. Zooming doesn't move that edge, so one sample
  // stays valid until the next mouse move refreshes it.
  Overlay.prototype._subscribeCrosshair = function () {
    var self = this;
    try {
      if (!this._chart.crossHairMoved) return;
      this._chart.crossHairMoved().subscribe(null, function (p) {
        if (!p || typeof p.price !== "number" || typeof p.offsetY !== "number") return;
        var g = self._geom();
        if (!g) return;
        var py = self._paneY(p.price, g);
        if (isFinite(py)) self._calibOffset = p.offsetY - py;
      });
    } catch (e) {}
  };

  Overlay.prototype._priceForY = function (containerY) {
    var g = this._geom();
    if (!g || this._calibOffset == null) return null;
    var py = containerY - this._calibOffset;
    if (g.log) {
      var lt = Math.log(g.top), lb = Math.log(g.bottom);
      return Math.exp(lt - (py / g.h) * (lt - lb));
    }
    return g.top - (py / g.h) * (g.top - g.bottom);
  };

  // ---- TradingView shapes for the lines themselves -------------------------

  // An empty `text` means no on-line label at all — that's the SL/TP case, where
  // the pill carries the price and P&L. The entry line passes its P&L text plus
  // a separate colour for it, right-aligned onto the price axis so it can't
  // drift.
  // NOTE: createShape() returns a **Promise<EntityId>** in this library build
  // (charting_library.d.ts: `createShape(...): Promise<EntityId>`), NOT the id
  // itself. Handing that promise to removeEntity()/getShapeById() throws, and
  // the try/catch swallowed it — which is why closed positions used to leave
  // their lines behind forever and the entry label stayed frozen at its
  // creation-time P&L. So every line is wrapped in a handle: the id is filled
  // in when the promise resolves, and moves/removals requested before then are
  // replayed onto it. A handle removed while still in flight kills the shape as
  // soon as it exists.
  Overlay.prototype._makeLine = function (price, text, color, style, locked, textColor) {
    var h = { id: null, dead: false, queued: null };
    var chart = this._chart;
    var opts = {
      shape: "horizontal_line",
      lock: !!locked, disableSelection: !!locked,
      disableSave: true, disableUndo: true,
      text: text || "",
      overrides: {
        linecolor: color, linestyle: style, linewidth: style === LINE_DASHED ? 1 : 2,
        showLabel: !!text, textcolor: textColor || color, fontsize: 11, bold: true,
        horzLabelsAlign: "right", vertLabelsAlign: "middle", showPrice: true,
      },
    };
    var res;
    try {
      res = chart.createShape({ time: Math.floor(Date.now() / 1000), price: price }, opts);
    } catch (e) { return h; }

    var self = this;
    var settle = function (id) {
      if (id == null) return;
      if (h.dead) { try { chart.removeEntity(id); } catch (e) {} return; }
      h.id = id;
      if (h.queued) { var q = h.queued; h.queued = null; self._moveLine(h, q.price, q.text, q.textColor); }
    };
    if (res && typeof res.then === "function") res.then(settle, function () {});
    else settle(res);                        // older builds return the id directly
    return h;
  };

  Overlay.prototype._pnlColor = function (pnl) {
    return Math.abs(pnl) < 0.10 ? BREAKEVEN : (pnl > 0 ? PROFIT_POS : PROFIT_NEG);
  };

  Overlay.prototype._moveLine = function (h, price, text, textColor) {
    if (!h || h.dead) return;
    if (h.id == null) {                      // still being created — replay on settle
      h.queued = { price: price, text: text, textColor: textColor };
      return;
    }
    try {
      var s = this._chart.getShapeById(h.id);
      if (!s) return;
      s.setPoints([{ time: Math.floor(Date.now() / 1000), price: price }]);
      var props = {};
      if (text != null) props.text = text;
      if (textColor) props.textcolor = textColor;
      s.setProperties(props);
    } catch (e) {}
  };

  Overlay.prototype._removeShape = function (h) {
    if (!h) return;
    h.dead = true;                           // kills it on settle if still in flight
    h.queued = null;
    if (h.id == null) return;
    try { this._chart.removeEntity(h.id); } catch (e) {}
    h.id = null;
  };

  Overlay.prototype._removePosition = function (posId) {
    var g = this._shapes[posId];
    if (g) {
      this._removeShape(g.entry); this._removeShape(g.sl); this._removeShape(g.tp);
      delete this._shapes[posId];
    }
    delete this._pos[posId];
    delete this._drawn[posId + "|sl"];
    delete this._drawn[posId + "|tp"];
  };

  Overlay.prototype._clearAll = function () {
    var self = this;
    Object.keys(this._shapes).forEach(function (id) { self._removePosition(id); });
    this._clearPills();
    this._rowKey = "";
  };

  // ---- sync with the server's positions ------------------------------------

  Overlay.prototype._sync = function () {
    if (!this._chart) return;
    var arr = [];
    try { arr = JSON.parse(this._bridge.positionsJson || "[]") || []; } catch (e) {}
    var sym = this._symbol;
    var mine = arr.filter(function (p) { return !sym || p.symbol === sym; });
    var seen = {}, self = this;

    mine.forEach(function (p) {
      var id = String(p.id);
      seen[id] = true;
      // Keep an in-flight bracket edit on screen. Positions are polled every few
      // seconds, and a poll issued before the server applied the change would
      // otherwise drag the line back to the old level for one frame and then
      // forward again. The optimistic value stands until positionOp resolves.
      var pend = self._pendingSet;
      if (pend && pend.id === id) p[pend.kind] = pend.level;
      self._pos[id] = p;

      var isBuy = self._isBuy(p);
      var pnl = Number(p.profit) || 0;
      var notional = Number(p.open_price) * Number(p.lots) * self._contract(p.symbol);
      var pct = notional > 0 ? (pnl / notional) * 100 : 0;
      var entryText = (isBuy ? "BUY " : "SELL ") + Number(p.lots).toFixed(2) + "  " +
                      fmtProfit(pnl) + " (" + (pct >= 0 ? "+" : "") + pct.toFixed(2) + "%)";
      var sideColor = isBuy ? BUY_COLOR : SELL_COLOR;

      var g = self._shapes[id];
      if (!g) {
        g = self._shapes[id] = { entry: null, sl: null, tp: null };
        g.entry = self._makeLine(p.open_price, entryText, sideColor, LINE_SOLID, true,
                                 self._pnlColor(pnl));
      } else {
        self._moveLine(g.entry, p.open_price, entryText, self._pnlColor(pnl));
      }

      // Bare dashed lines — no on-line text; the SL/TP pill carries price + P&L.
      [["sl", SL_COLOR], ["tp", TP_COLOR]].forEach(function (spec) {
        var kind = spec[0], color = spec[1];
        var lvl = Number(p[kind]) || 0;
        var key = id + "|" + kind;
        if (lvl > 0) {
          if (g[kind] == null) {
            g[kind] = self._makeLine(lvl, "", color, LINE_DASHED, true);
            self._drawn[key] = lvl;
          } else if (self._drawn[key] !== lvl) {
            self._moveLine(g[kind], lvl);
            self._drawn[key] = lvl;
          }
        } else if (g[kind] != null) {
          self._removeShape(g[kind]);
          g[kind] = null;
          delete self._drawn[key];
        }
      });
    });

    Object.keys(this._shapes).forEach(function (id) {
      if (!seen[id]) self._removePosition(id);
    });

    // Pills are rebuilt only when the position set itself changes; the rAF loop
    // keeps their position, text and the zones live from the latest prices.
    var key = mine.map(function (p) {
      return p.id + ":" + p.side + ":" + p.lots;
    }).join(",");
    if (key !== this._rowKey) {
      this._rowKey = key;
      this._buildPills(mine);
    }
  };

  // ---- segmented pills -----------------------------------------------------

  Overlay.prototype._clearPills = function () {
    var ov = this._overlay;
    if (!ov) { this._rows = []; return; }
    this._rows.forEach(function (r) {
      [r.entry.el, r.sl.el, r.tp.el, r.slZone, r.tpZone].forEach(function (el) {
        try { ov.removeChild(el); } catch (e) {}
      });
    });
    this._rows = [];
  };

  // [badge][price][P&L][lots][✕] — one flat pill, segments divided by hairlines.
  Overlay.prototype._mkPill = function () {
    var el = document.createElement("div");
    el.style.cssText =
      "position:absolute;left:" + LEFT_PX + "px;transform:translateY(-50%);display:none;" +
      "align-items:stretch;height:20px;border-radius:4px;overflow:hidden;pointer-events:auto;" +
      "z-index:6;font:700 10px Inter,'Segoe UI',sans-serif;box-shadow:0 1px 4px rgba(0,0,0,.5);" +
      "border:1px solid transparent;box-sizing:border-box;";

    function seg(extra) {
      var d = document.createElement("div");
      d.style.cssText = "display:flex;align-items:center;padding:0 6px;white-space:nowrap;" + (extra || "");
      return d;
    }
    var badge = seg("background:" + PILL_BG + ";font-weight:800;");
    var price = seg("background:" + PILL_BG + ";color:" + PILL_FG + ";border-left:" + PILL_DIV + ";");
    var pnl   = seg("background:" + PILL_BG + ";border-left:" + PILL_DIV + ";");
    var lots  = seg("background:" + PILL_BG + ";color:" + PILL_DIM + ";border-left:" + PILL_DIV + ";");

    var x = document.createElement("button");
    x.type = "button";
    x.textContent = "✕";
    x.style.cssText =
      "display:flex;align-items:center;justify-content:center;padding:0 7px;border:0;" +
      "border-left:" + PILL_DIV + ";background:" + PILL_BG + ";color:" + PILL_DIM + ";" +
      "cursor:pointer;font:700 10px Inter,'Segoe UI',sans-serif;";
    x.onmouseenter = function () { x.style.color = "#ef4444"; };
    x.onmouseleave = function () { x.style.color = PILL_DIM; };

    el.appendChild(badge); el.appendChild(price); el.appendChild(pnl);
    el.appendChild(lots);  el.appendChild(x);
    this._overlay.appendChild(el);
    return { el: el, badge: badge, price: price, pnl: pnl, lots: lots, x: x };
  };

  Overlay.prototype._buildPills = function (positions) {
    this._clearPills();
    var self = this, ov = this._overlay;
    if (!ov) return;

    positions.forEach(function (p) {
      var side = self._isBuy(p) ? "BUY" : "SELL";
      var sideColor = side === "BUY" ? GREEN : RED;

      // Entry pill — [B|S][entry][live P&L][lots][✕ close]
      var entry = self._mkPill();
      entry.badge.textContent = side === "BUY" ? "B" : "S";
      entry.badge.style.color = sideColor;
      entry.el.style.borderColor = sideColor;
      entry.x.title = "Close " + side + " " + Number(p.lots) + " " + p.symbol + " at market";
      entry.x.onclick = function (e) {
        e.stopPropagation();
        self._dialog({
          title: "Close position",
          body: "Close " + side + " " + Number(p.lots) + " " + p.symbol + " at market?",
          confirmLabel: "Close position",
          danger: true,
          onConfirm: function () { self._bridge.closePosition(String(p.id)); },
        });
      };

      // SL / TP pills — badge and price are the drag handles. No ✕: a bracket is
      // removed by clicking it and leaving the price blank.
      var sl = self._mkPill();
      sl.badge.textContent = "SL";
      sl.badge.style.color = SL_COLOR;
      sl.el.style.borderColor = SL_COLOR;
      sl.badge.title = sl.price.title = "Stop Loss — drag up/down to set, or click to type";
      self._attachDrag(sl.badge, p, "sl");
      self._attachDrag(sl.price, p, "sl");
      sl.x.remove();

      var tp = self._mkPill();
      tp.badge.textContent = "TP";
      tp.badge.style.color = TP_COLOR;
      tp.el.style.borderColor = TP_COLOR;
      tp.badge.title = tp.price.title = "Take Profit — drag up/down to set, or click to type";
      self._attachDrag(tp.badge, p, "tp");
      self._attachDrag(tp.price, p, "tp");
      tp.x.remove();

      // A full-width grab strip sitting on each bracket's own line.
      //
      // The line itself is a TradingView shape inside the chart iframe, so it
      // cannot take a DOM handler — which is why dragging used to work only on
      // the little pill at the left edge. This is an invisible 11px band across
      // the whole chart at the same price, carrying the same drag: the level
      // can now be grabbed anywhere along it, which is what "drag the line"
      // means to anyone who has used MT5.
      var mkGrab = function (kind) {
        var gEl = document.createElement("div");
        gEl.style.cssText = "position:absolute;left:0;right:0;top:0;height:11px;" +
          "transform:translateY(-50%);background:transparent;pointer-events:auto;" +
          "cursor:ns-resize;display:none;z-index:5;";
        gEl.title = kind === "sl" ? "Stop Loss — drag up/down to set"
                                  : "Take Profit — drag up/down to set";
        ov.appendChild(gEl);
        self._attachDrag(gEl, p, kind);
        return gEl;
      };
      var slGrab = mkGrab("sl");
      var tpGrab = mkGrab("tp");

      // Shaded entry->SL / entry->TP zones, positioned by the rAF loop.
      var slZone = document.createElement("div");
      slZone.style.cssText = "position:absolute;left:0;right:0;top:0;height:0;background:" +
        SL_ZONE + ";pointer-events:none;visibility:hidden;z-index:4;";
      var tpZone = document.createElement("div");
      tpZone.style.cssText = "position:absolute;left:0;right:0;top:0;height:0;background:" +
        TP_ZONE + ";pointer-events:none;visibility:hidden;z-index:4;";
      ov.appendChild(slZone); ov.appendChild(tpZone);

      self._rows.push({ p: p, entry: entry, sl: sl, tp: tp, slZone: slZone, tpZone: tpZone,
                        slGrab: slGrab, tpGrab: tpGrab });
    });
  };

  // Press & drag up/down -> preview line + shaded zone follow the cursor with
  // the target price and the P&L there; release saves it straight away (drag
  // again to move it). A plain click (no drag) opens the type-a-price dialog.
  Overlay.prototype._attachDrag = function (el, p, kind) {
    var self = this;
    var color = kind === "sl" ? SL_COLOR : TP_COLOR;
    var zoneBg = kind === "sl" ? "rgba(239,68,68,0.13)" : "rgba(20,184,166,0.13)";
    el.style.cursor = "ns-resize";
    el.style.touchAction = "none";

    el.onpointerdown = function (e) {
      e.preventDefault(); e.stopPropagation();
      try { el.setPointerCapture(e.pointerId); } catch (err) {}
      var startY = e.clientY, moved = false;

      var zone = document.createElement("div");
      zone.style.cssText = "position:absolute;left:0;right:0;top:0;height:0;background:" +
        zoneBg + ";pointer-events:none;z-index:6;";
      var line = document.createElement("div");
      line.style.cssText = "position:absolute;left:0;right:0;top:0;height:0;border-top:1px dashed " +
        color + ";pointer-events:none;z-index:7;";
      var lbl = document.createElement("div");
      lbl.style.cssText = "position:absolute;left:50%;top:0;transform:translate(-50%,-50%);background:" +
        color + ";color:#fff;font:700 11px Inter,'Segoe UI',sans-serif;padding:2px 9px;" +
        "border-radius:4px;pointer-events:none;z-index:8;white-space:nowrap;" +
        "box-shadow:0 1px 5px rgba(0,0,0,.5);";
      self._overlay.appendChild(zone);
      self._overlay.appendChild(line);
      self._overlay.appendChild(lbl);

      // Always drag against the LIVE record — `p` is the snapshot the pill was
      // built from and its open price may have been re-polled since.
      var live = function () { return self._pos[String(p.id)] || p; };
      var d = self._digits(p.symbol);
      var entryY = function () {
        var g = self._geom();
        if (!g || self._calibOffset == null) return null;
        return self._paneY(Number(live().open_price) || 0, g) + self._calibOffset;
      };
      var cleanup = function () {
        [zone, line, lbl].forEach(function (x) {
          try { self._overlay.removeChild(x); } catch (err) {}
        });
      };

      el.onpointermove = function (ev) {
        if (Math.abs(ev.clientY - startY) > 3) moved = true;
        var r = self._host.getBoundingClientRect();
        var cy = ev.clientY - r.top;
        var price = self._priceForY(cy);
        line.style.top = cy + "px";
        lbl.style.top = cy + "px";
        var t = (kind === "sl" ? "SL " : "TP ") + (price ? fmt(price, d) : "—");
        if (price) t += "   " + fmtProfit(self._pnlAt(live(), price));
        lbl.textContent = t;
        var ey = entryY();
        if (ey != null) {
          zone.style.top = Math.min(ey, cy) + "px";
          zone.style.height = Math.abs(ey - cy) + "px";
        }
      };

      el.onpointerup = function (ev) {
        el.onpointermove = null; el.onpointerup = null;
        try { el.releasePointerCapture(ev.pointerId); } catch (err) {}
        cleanup();

        if (!moved) { self._promptBracket(live(), kind); return; }   // plain click

        var r = self._host.getBoundingClientRect();
        var price = self._priceForY(ev.clientY - r.top);
        if (!price || !(price > 0)) { self._toast("Could not read price"); return; }
        // Drag release saves immediately — drag again to move it.
        self._commit(live(), kind, Number(price.toFixed(d)));
      };
    };
  };

  // Plain click on a bracket handle: type the level (blank asks to remove).
  Overlay.prototype._promptBracket = function (p, kind) {
    var self = this;
    var d = this._digits(p.symbol);
    var label = kind === "sl" ? "Stop Loss" : "Take Profit";
    var cur = Number(p[kind]) || 0;
    var dflt = cur > 0 ? fmt(cur, d) : "";
    this._dialog({
      title: label + " — " + String(p.side).toUpperCase() + " " +
             Number(p.lots).toFixed(2) + " " + p.symbol,
      body: "Enter the price. Leave blank to remove.",
      confirmLabel: "Save",
      input: { defaultValue: dflt, placeholder: "Price" },
      onConfirm: function (raw) {
        var t = (raw == null ? "" : String(raw)).trim();
        if (t === "") { self._commit(p, kind, 0); return; }     // remove
        var v = parseFloat(t);
        if (!(v > 0)) { self._toast("Invalid price"); return; }
        self._commit(p, kind, Number(v.toFixed(d)));
      },
    });
  };

  // Send ONLY the bracket being changed — the endpoint partial-updates, so
  // re-sending the other one from this (possibly stale) record would revert it.
  Overlay.prototype._commit = function (p, kind, level) {
    var why = this._invalidReason(p, kind, level);
    if (why) {
      this._dialog({
        title: "Invalid " + (kind === "tp" ? "Take Profit" : "Stop Loss"),
        body: why + (function (self) {
          var qq = self._quote[p.symbol];
          var r = qq ? (self._isBuy(p) ? qq.bid : qq.ask) : (Number(p.current_price) || 0);
          return r > 0 ? " (Current " + fmt(r, self._digits(p.symbol)) + ")" : "";
        })(this),
        confirmLabel: "OK",
        onConfirm: function () {},
      });
      this._sync();                             // snap the line back to the server value
      return;
    }
    var id = String(p.id);
    this._pendingSet = { id: id, kind: kind, level: level, digits: this._digits(p.symbol) };

    // Move it NOW rather than waiting for the round trip. The pill and its line
    // are drawn from this record, and positions are only re-polled every few
    // seconds — without this the level visibly snapped back to where it was and
    // sat there for seconds after the drag was released.
    var live = this._pos[id];
    if (live) live[kind] = level;
    if (level > 0) this._drawn[id + "|" + kind] = level;

    this._bridge.modifyBracket(id, kind, level);
  };

  Overlay.prototype._onOp = function (posId, op, ok, msg) {
    var s = this._pendingSet;
    this._pendingSet = null;
    if (ok) {
      if (op === "modify" && s) {
        this._okToast(s.level > 0
          ? (s.kind === "sl" ? "Stop Loss" : "Take Profit") + " set @ " + fmt(s.level, s.digits)
          : (s.kind === "sl" ? "Stop Loss" : "Take Profit") + " removed");
      }
      return;                                   // the next poll confirms it
    }
    this._toast(msg || "Rejected");
    delete this._drawn[posId + "|sl"];
    delete this._drawn[posId + "|tp"];
    this._sync();                               // put the line back where the server has it
  };

  // ---- per-frame positioning ----------------------------------------------

  // Detach completely: stop the rAF loop, drop every bridge subscription and
  // remove the DOM layer. Called by app.js before it rebuilds the widget.
  Overlay.prototype.destroy = function () {
    this._dead = true;
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = 0; }
    (this._binds || []).forEach(function (b) {
      try { b[0].disconnect(b[1]); } catch (e) {}
    });
    this._binds = [];
    try { this._clearPills(); } catch (e) {}
    if (this._dlg) { try { this._dlg.remove(); } catch (e) {} this._dlg = null; }
    if (this._overlay && this._overlay.parentNode) {
      try { this._overlay.parentNode.removeChild(this._overlay); } catch (e) {}
    }
    this._overlay = null;
    this._chart = null;
  };

  Overlay.prototype._startLoop = function () {
    var self = this;
    var step = function () {
      if (self._dead) return;
      self._raf = requestAnimationFrame(step);
      var g = self._geom();
      if (!g || self._calibOffset == null) {
        self._rows.forEach(function (r) {
          r.entry.el.style.display = "none";
          r.sl.el.style.display = "none";
          r.tp.el.style.display = "none";
          r.slZone.style.visibility = "hidden";
          r.tpZone.style.visibility = "hidden";
        });
        return;
      }
      var off = self._calibOffset;
      var h = self._host ? self._host.clientHeight : g.h;

      // Place a pill on `price`; false if it would fall outside the pane.
      var put = function (pill, price) {
        var y = self._paneY(price, g) + off;
        if (!(y > 8) || y > h - 8) { pill.el.style.display = "none"; return false; }
        pill.el.style.top = y + "px";
        pill.el.style.display = "flex";
        return true;
      };
      var setText = function (segEl, text) {
        if (segEl.textContent !== text) segEl.textContent = text;
      };
      var drawZone = function (el, entryY, price) {
        var pr = Number(price);
        if (!(pr > 0)) { el.style.visibility = "hidden"; return; }
        var zy = self._paneY(pr, g) + off;
        var top = Math.min(entryY, zy), ht = Math.abs(entryY - zy);
        if (ht < 1) { el.style.visibility = "hidden"; return; }
        el.style.top = top + "px";
        el.style.height = ht + "px";
        el.style.visibility = "visible";
      };

      self._rows.forEach(function (r) {
        var p = self._pos[String(r.p.id)] || r.p;
        var d = self._digits(p.symbol);
        var lots = Number(p.lots).toFixed(2);
        var open = Number(p.open_price) || 0;

        // Entry — live P&L off the current bid (buy) / ask (sell).
        if (put(r.entry, open)) {
          var pnl = self._livePnl(p);
          setText(r.entry.price, fmt(open, d));
          setText(r.entry.pnl, fmtProfit(pnl));
          r.entry.pnl.style.color = pnl >= 0 ? GREEN : RED;
          setText(r.entry.lots, lots);
        }

        // SL / TP: full pill on its own line when set, aligned on the left with
        // the entry pill so all three read as one column; badge-only
        // drag-to-create handle parked on the right at the entry line when unset.
        var bracket = function (pill, kind, grab) {
          var val = Number(p[kind]) || 0;
          var set = val > 0;
          // The grab strip only exists where a level does. Parking it on the
          // entry line when the bracket is unset would put an invisible
          // drag-catcher across the entry price, and every click meant for the
          // chart there would start setting a stop instead.
          if (grab) {
            if (set) {
              var gy = self._paneY(val, g) + off;
              if (gy > 8 && gy < h - 8) {
                grab.style.top = gy + "px";
                grab.style.display = "block";
              } else {
                grab.style.display = "none";
              }
            } else {
              grab.style.display = "none";
            }
          }
          if (!put(pill, set ? val : open)) return;
          if (set) {
            pill.el.style.left = LEFT_PX + "px";
            pill.el.style.right = "auto";
            var pl = self._pnlAt(p, val);
            setText(pill.price, fmt(val, d));
            setText(pill.pnl, fmtProfit(pl));
            pill.pnl.style.color = pl >= 0 ? GREEN : RED;
            setText(pill.lots, lots);
            pill.price.style.display = "flex";
            pill.pnl.style.display   = "flex";
            pill.lots.style.display  = "flex";
          } else {
            pill.el.style.left = "auto";
            pill.el.style.right = (BTN_RIGHT_PX + (kind === "tp" ? 34 : 72)) + "px";
            pill.price.style.display = "none";
            pill.pnl.style.display   = "none";
            pill.lots.style.display  = "none";
          }
        };
        var ey = self._paneY(open, g) + off;
        bracket(r.sl, "sl", r.slGrab);
        bracket(r.tp, "tp", r.tpGrab);
        drawZone(r.slZone, ey, p.sl);
        drawZone(r.tpZone, ey, p.tp);
      });
    };
    this._raf = requestAnimationFrame(step);
  };

  // ---- dialog + toasts -----------------------------------------------------

  Overlay.prototype._dialog = function (o) {
    var self = this;
    if (this._dlg) { this._dlg.remove(); this._dlg = null; }

    var back = document.createElement("div");
    back.style.cssText =
      "position:fixed;inset:0;z-index:60;background:rgba(0,0,0,.55);display:flex;" +
      "align-items:center;justify-content:center;";
    var box = document.createElement("div");
    box.style.cssText =
      "min-width:340px;max-width:420px;background:" + DLG_BG + ";border:1px solid " + DLG_BORDER + ";" +
      "border-radius:10px;padding:18px 20px;box-shadow:0 20px 60px rgba(0,0,0,.6);" +
      "font:400 13px Inter,'Segoe UI',sans-serif;color:" + DLG_FG + ";";

    var head = document.createElement("div");
    head.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:16px;";
    head.innerHTML = '<div style="font:700 15px Inter,\'Segoe UI\',sans-serif">' + o.title + "</div>";
    var xb = document.createElement("button");
    xb.textContent = "✕";
    xb.style.cssText = "cursor:pointer;background:none;border:none;color:#8a8f98;font-size:15px;";
    xb.onclick = function () { close(); };
    head.appendChild(xb);
    box.appendChild(head);

    var sub = document.createElement("div");
    sub.style.cssText = "margin:9px 0 16px;color:" + DLG_SUB + ";";
    sub.innerHTML = o.body || "";
    box.appendChild(sub);

    var input = null;
    if (o.input) {
      input = document.createElement("input");
      input.type = "text";
      input.value = o.input.defaultValue || "";
      input.placeholder = o.input.placeholder || "";
      input.style.cssText =
        "width:100%;box-sizing:border-box;margin-bottom:16px;padding:9px 11px;border-radius:7px;" +
        "border:1px solid " + DLG_BORDER + ";background:" + DLG_INPUT + ";color:" + DLG_FG + ";" +
        "font:600 13px Inter,'Segoe UI',sans-serif;outline:none;";
      input.onkeydown = function (e) { if (e.key === "Enter") confirm(); };
      box.appendChild(input);
    }

    var row = document.createElement("div");
    row.style.cssText = "display:flex;gap:10px;";
    var cancel = document.createElement("button");
    cancel.textContent = "Cancel";
    cancel.style.cssText =
      "flex:1;cursor:pointer;padding:9px;border-radius:7px;border:1px solid " + DLG_BORDER + ";" +
      "background:" + DLG_INPUT + ";color:" + DLG_FG + ";font:600 13px Inter,'Segoe UI',sans-serif;";
    cancel.onclick = function () { close(); };
    var ok = document.createElement("button");
    ok.textContent = o.confirmLabel || "Confirm";
    ok.style.cssText =
      "flex:1;cursor:pointer;padding:9px;border-radius:7px;border:none;color:#fff;" +
      "font:700 13px Inter,'Segoe UI',sans-serif;background:" + (o.danger ? "#dc2626" : "#22a95b") + ";";
    ok.onclick = function () { confirm(); };
    row.appendChild(cancel); row.appendChild(ok);
    box.appendChild(row);

    back.appendChild(box);
    document.body.appendChild(back);
    this._dlg = back;
    if (input) setTimeout(function () { input.focus(); input.select(); }, 0);

    function close() { if (self._dlg) { self._dlg.remove(); self._dlg = null; } }
    function confirm() {
      var v = input ? input.value : undefined;
      close();
      if (o.onConfirm) o.onConfirm(v);
    }
  };

  Overlay.prototype._okToast = function (msg) { this._showToast(msg, true); };
  Overlay.prototype._toast   = function (msg) { this._showToast(msg, false); };

  Overlay.prototype._showToast = function (msg, ok) {
    var t = document.createElement("div");
    t.innerHTML = ok ? '<span style="color:#22a95b">✓</span> ' + msg : msg;
    t.style.cssText =
      "position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:70;" +
      "padding:8px 14px;border-radius:6px;font:600 12px Inter,'Segoe UI',sans-serif;" +
      "box-shadow:0 6px 20px rgba(0,0,0,.5);" +
      (ok ? "background:" + DLG_BG + ";border:1px solid " + DLG_BORDER + ";color:" + DLG_FG + ";"
          : "background:rgba(220,38,38,.96);color:#fff;");
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, ok ? 3000 : 4500);
  };

  window.makePositionOverlay = function (widget, bridge) { return new Overlay(widget, bridge); };
})();
