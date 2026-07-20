/*
 * Bull4x on-chart position overlay.
 *
 * The vendored charting_library is the *Advanced Charts* build: TradingView's
 * native position lines and Broker API are disabled there
 * ("createPositionLine is only available on Trading Platform"). So we draw the
 * position ourselves out of plain horizontal-line shapes, which Advanced
 * Charts does support:
 *
 *   ── TP 1.14500 ──────────────────  green, dashed, draggable
 *   ── BUY 0.01  +$0.09 ────────────  blue (buy) / orange (sell), solid, locked
 *   ── SL 1.14200 ──────────────────  red, dashed, draggable
 *
 * Dragging the SL or TP line sends the new level to the REAL server position
 * (bridge.modifyBrackets -> PUT /api/v1/positions/{id}); if the server rejects
 * it (MT5-style validation), the line snaps back to the server's value and a
 * toast explains why. A small panel in the top-right closes a position (✕).
 *
 * Positions come from the native side (MainWindow polls /positions and pushes
 * them over the bridge) — the same source the positions panel uses, so the
 * chart can never disagree with it.
 */

(function () {
  var COLORS = {
    buy:  "#2962FF",
    sell: "#FF6D00",
    sl:   "#EF5350",
    tp:   "#26A69A",
    profitPos: "#16A34A",
    profitNeg: "#DC2626",
  };
  var LINE_SOLID = 0, LINE_DASHED = 2;

  function fmt(price, digits) {
    var d = (digits == null ? 5 : digits);
    return Number(price).toFixed(d);
  }
  function fmtProfit(p) {
    var s = p >= 0 ? "+" : "-";
    return s + "$" + Math.abs(Number(p) || 0).toFixed(2);
  }

  function Overlay(widget, bridge) {
    this._w = widget;
    this._bridge = bridge;
    this._chart = null;
    this._symbol = null;
    this._shapes = {};    // posId -> { entry, sl, tp }  (shape ids)
    this._owner = {};     // shapeId -> { posId, kind }
    this._pos = {};       // posId -> server position record
    // Level we last drew per "posId|kind". The positions poll fires every few
    // seconds; re-seating a shape it already agrees with would yank the line
    // out from under a drag in progress, so we only move a line when the
    // server's level actually differs from what is on screen.
    this._drawn = {};
    this._meta = {};      // symbol -> spec (digits)
    this._suppress = false;   // true while WE move a shape programmatically

    try {
      JSON.parse(bridge.symbolsJson || "[]").forEach(function (s) { this._meta[s.symbol] = s; }, this);
    } catch (e) {}

    var self = this;
    widget.onChartReady(function () {
      self._chart = widget.activeChart();
      try { self._symbol = self._chart.symbol(); } catch (e) {}

      try {
        self._chart.onSymbolChanged().subscribe(null, function () {
          try { self._symbol = self._chart.symbol(); } catch (e) {}
          self._clearAll();
          self._sync();
        });
      } catch (e) {}

      // A finished drag on one of our SL/TP lines -> push it to the server.
      try {
        widget.subscribe("drawing_event", function (id, ev) { self._onDrawing(id, ev); });
      } catch (e) {}

      bridge.positionsChanged.connect(function () { self._sync(); });
      bridge.positionOp.connect(function (id, op, ok, msg) { self._onOp(id, op, ok, msg); });

      self._buildPanel();
      self._sync();
    });
  }

  // ---- shape helpers ------------------------------------------------------

  Overlay.prototype._digits = function (sym) {
    var m = this._meta[sym];
    return m && m.digits != null ? m.digits : 5;
  };

  Overlay.prototype._contract = function (sym) {
    var m = this._meta[sym];
    return m && m.contract_size > 0 ? m.contract_size : 1;
  };

  // What this position would realise if it closed at `level`. The server is
  // authoritative — this is the preview shown before committing an SL/TP.
  Overlay.prototype._pnlAt = function (p, level) {
    var dir = String(p.side).toLowerCase() === "sell" ? -1 : 1;
    return (level - Number(p.open_price)) * dir * Number(p.lots) * this._contract(p.symbol);
  };

  Overlay.prototype._makeLine = function (price, text, color, style, locked) {
    if (!this._chart) return null;
    try {
      return this._chart.createShape(
        { time: Math.floor(Date.now() / 1000), price: price },
        {
          shape: "horizontal_line",
          lock: !!locked,
          disableSelection: !!locked,
          disableSave: true,
          disableUndo: true,
          text: text,
          overrides: {
            linecolor: color,
            linestyle: style,
            linewidth: 2,
            showLabel: true,
            textcolor: color,
            fontsize: 11,
            bold: true,
            horzLabelsAlign: "left",
            vertLabelsAlign: "middle",
            showPrice: true,
          },
        }
      );
    } catch (e) { console.warn("createShape failed", e); return null; }
  };

  Overlay.prototype._moveLine = function (shapeId, price, text) {
    if (shapeId == null || !this._chart) return;
    this._suppress = true;
    try {
      var s = this._chart.getShapeById(shapeId);
      if (s) {
        s.setPoints([{ time: Math.floor(Date.now() / 1000), price: price }]);
        if (text != null) s.setProperties({ text: text });
      }
    } catch (e) { /* shape may have been removed by the user */ }
    this._suppress = false;
  };

  Overlay.prototype._removeShape = function (shapeId) {
    if (shapeId == null || !this._chart) return;
    try { this._chart.removeEntity(shapeId); } catch (e) {}
    delete this._owner[shapeId];
  };

  Overlay.prototype._removePosition = function (posId) {
    var g = this._shapes[posId];
    if (!g) return;
    this._removeShape(g.entry);
    this._removeShape(g.sl);
    this._removeShape(g.tp);
    delete this._shapes[posId];
    delete this._pos[posId];
    delete this._drawn[posId + "|sl"];
    delete this._drawn[posId + "|tp"];
  };

  Overlay.prototype._clearAll = function () {
    Object.keys(this._shapes).forEach(this._removePosition, this);
  };

  // ---- sync with server positions -----------------------------------------

  Overlay.prototype._sync = function () {
    if (!this._chart) return;
    var arr = [];
    try { arr = JSON.parse(this._bridge.positionsJson || "[]") || []; } catch (e) {}

    var sym = this._symbol;
    var mine = arr.filter(function (p) { return !sym || p.symbol === sym; });
    var seen = {};
    var self = this;

    mine.forEach(function (p) {
      var id = String(p.id);
      seen[id] = true;
      self._pos[id] = p;

      var d = self._digits(p.symbol);
      var isBuy = String(p.side).toLowerCase() !== "sell";
      var entryText = (isBuy ? "BUY " : "SELL ") + Number(p.lots).toFixed(2) + "   " + fmtProfit(p.profit);
      var entryColor = isBuy ? COLORS.buy : COLORS.sell;

      var g = self._shapes[id];
      if (!g) {
        g = self._shapes[id] = { entry: null, sl: null, tp: null };
        g.entry = self._makeLine(p.open_price, entryText, entryColor, LINE_SOLID, true);
      } else {
        self._moveLine(g.entry, p.open_price, entryText);
      }

      // SL / TP: create, move, or drop as the server dictates.
      [["sl", COLORS.sl, "SL "], ["tp", COLORS.tp, "TP "]].forEach(function (spec) {
        var kind = spec[0], color = spec[1], label = spec[2];
        var lvl = Number(p[kind]) || 0;
        var key = id + "|" + kind;
        if (lvl > 0) {
          // e.g. "SL 64681.58   -$1.35" — the level and what it would realise.
          var text = label + fmt(lvl, d) + "   " + fmtProfit(self._pnlAt(p, lvl));
          if (g[kind] == null) {
            g[kind] = self._makeLine(lvl, text, color, LINE_DASHED, false);
            if (g[kind] != null) self._owner[g[kind]] = { posId: id, kind: kind };
            self._drawn[key] = lvl;
          } else if (self._drawn[key] !== lvl) {
            // Server moved it (or rejected our drag) — re-seat the line.
            self._moveLine(g[kind], lvl, text);
            self._drawn[key] = lvl;
          }
        } else if (g[kind] != null) {
          self._removeShape(g[kind]);
          g[kind] = null;
          delete self._drawn[key];
        }
      });
    });

    // Positions that vanished (closed manually, by SL/TP, or elsewhere).
    Object.keys(this._shapes).forEach(function (id) {
      if (!seen[id]) self._removePosition(id);
    });

    this._currentPositions = mine;
    this._renderPanel(mine);
  };

  // ---- drag -> server ------------------------------------------------------

  Overlay.prototype._onDrawing = function (shapeId, ev) {
    if (this._suppress) return;
    var own = this._owner[shapeId];
    if (!own) return;

    if (ev === "remove") {
      // Deleting the drawing can't clear the bracket (the server has no way to
      // unset one), so put the line back rather than leaving the chart showing
      // a level the position no longer appears to have.
      var g0 = this._shapes[own.posId];
      if (g0) g0[own.kind] = null;
      delete this._owner[shapeId];
      this._toast(own.kind.toUpperCase() + " can't be removed — drag the line to move it");
      this._sync();
      return;
    }

    if (ev !== "points_changed" && ev !== "move" && ev !== "drag" && ev !== "properties_changed") return;

    var price = null;
    try {
      var pts = this._chart.getShapeById(shapeId).getPoints();
      if (pts && pts.length) price = pts[0].price;
    } catch (e) { return; }
    if (!(price > 0)) return;

    var p = this._pos[own.posId];
    if (!p) return;
    var d = this._digits(p.symbol);
    price = Number(price.toFixed(d));
    var self = this;

    if (own.draft) {
      // Still un-committed: re-open the dialog at wherever they dropped it.
      if (this._draft) this._draft.level = price;
      this._confirm(p, own.kind, price,
        function () { self._commit(p, own.kind, price); },
        function () { /* leave the draft so it can be dragged again */ });
      return;
    }

    // Moving a live bracket. Hold the line where the user dropped it so the
    // next poll (still carrying the old level) doesn't yank it back mid-decision.
    var key = own.posId + "|" + own.kind;
    this._drawn[key] = price;
    this._confirm(p, own.kind, price,
      function () { self._commit(p, own.kind, price); },
      function () { delete self._drawn[key]; self._sync(); });   // snap back
  };

  Overlay.prototype._onOp = function (posId, op, ok, msg) {
    if (ok) {
      var s = this._pendingSet;
      if (op === "modify" && s) {
        this._okToast((s.kind === "sl" ? "Stop Loss" : "Take Profit") +
                      " set @ " + fmt(s.level, s.digits));
      }
      this._pendingSet = null;
      return;                             // next poll confirms the new level
    }
    this._pendingSet = null;
    this._toast(msg || "Rejected");
    // Server said no: forget where we drew the dragged line so the next sync
    // re-seats it at the level the position actually has.
    delete this._drawn[posId + "|sl"];
    delete this._drawn[posId + "|tp"];
    this._sync();
  };

  // ---- close panel + toast -------------------------------------------------

  Overlay.prototype._buildPanel = function () {
    var el = document.createElement("div");
    el.id = "sc_pos_panel";
    el.style.cssText =
      "position:absolute;top:52px;right:70px;z-index:30;display:flex;flex-direction:column;gap:4px;" +
      "font:600 11px Inter,'Segoe UI',sans-serif;pointer-events:none;";
    document.body.appendChild(el);
    this._panel = el;
  };

  function mkBtn(label, bg, fg, title, width) {
    var b = document.createElement("button");
    b.textContent = label;
    b.title = title;
    b.style.cssText =
      "cursor:pointer;border:none;border-radius:4px;background:" + bg + ";color:" + fg + ";" +
      "height:18px;min-width:" + (width || 22) + "px;padding:0 5px;line-height:1;font:700 10px Inter,'Segoe UI',sans-serif;";
    return b;
  }

  Overlay.prototype._renderPanel = function (positions) {
    if (!this._panel) return;
    this._panel.innerHTML = "";
    var self = this;
    positions.forEach(function (p) {
      var isBuy = String(p.side).toLowerCase() !== "sell";
      var sideColor = isBuy ? COLORS.buy : COLORS.sell;
      var row = document.createElement("div");
      row.style.cssText =
        "pointer-events:auto;display:flex;align-items:center;gap:6px;padding:4px 6px 4px 9px;border-radius:6px;" +
        "background:rgba(20,22,28,.92);border:1px solid " + sideColor + ";color:#e6e8ec;";

      var pl = Number(p.profit) || 0;
      var info = document.createElement("span");
      info.innerHTML =
        '<span style="color:' + sideColor + '">' + (isBuy ? "BUY" : "SELL") + " " +
        Number(p.lots).toFixed(2) + "</span> " +
        '<span style="color:' + (pl >= 0 ? COLORS.profitPos : COLORS.profitNeg) + '">' + fmtProfit(pl) + "</span>";
      row.appendChild(info);

      // SL / TP toggles. With no native position brackets to drag out, these
      // are how a level gets created in the first place: click places it a
      // sensible distance away (server-validated), then drag the line to fine
      // tune. Click again to clear it.
      var slSet = Number(p.sl) > 0, tpSet = Number(p.tp) > 0;
      var slBtn = mkBtn("SL", slSet ? COLORS.sl : "#2a2d34", slSet ? "#fff" : "#c9ccd1",
                        slSet ? "Remove stop loss" : "Add stop loss");
      slBtn.onclick = function () { slBtn.disabled = true; self._addBracket(p, "sl"); };
      row.appendChild(slBtn);

      var tpBtn = mkBtn("TP", tpSet ? COLORS.tp : "#2a2d34", tpSet ? "#fff" : "#c9ccd1",
                        tpSet ? "Remove take profit" : "Add take profit");
      tpBtn.onclick = function () { tpBtn.disabled = true; self._addBracket(p, "tp"); };
      row.appendChild(tpBtn);

      var x = mkBtn("✕", "#2a2d34", "#c9ccd1", "Close position", 18);
      x.onmouseenter = function () { x.style.background = COLORS.sl; x.style.color = "#fff"; };
      x.onmouseleave = function () { x.style.background = "#2a2d34"; x.style.color = "#c9ccd1"; };
      x.onclick = function () { x.disabled = true; self._bridge.closePosition(String(p.id)); };
      row.appendChild(x);

      self._panel.appendChild(row);
    });
  };

  // Place (or clear) a bracket. A new level goes a safe distance from the
  // price the position would close at, on the only side the server accepts:
  //   BUY  -> SL below, TP above      SELL -> SL above, TP below
  // Add a bracket: drop a draft line a safe distance away on the only side the
  // server accepts (BUY -> SL below / TP above, SELL mirrored), then confirm.
  // The draft stays draggable, so Cancel → drag → release re-opens the dialog
  // at the new level.
  Overlay.prototype._addBracket = function (p, kind) {
    if (Number(p[kind]) > 0) {
      // The modify endpoint treats a missing field as "leave unchanged" and
      // rejects <= 0, so there is no way to clear a bracket server-side yet.
      this._toast(kind.toUpperCase() + " can't be removed — drag the line to move it");
      this._renderPanel(this._currentPositions || []);
      return;
    }

    var d = this._digits(p.symbol);
    var price = Number(p.current_price) || Number(p.open_price);
    // 0.3% keeps a sane distance across asset classes (forex ~30 pips, BTC a
    // few hundred dollars); never smaller than 10 pips.
    var off = Math.max(price * 0.003, Math.pow(10, -(d - 1)) * 10);
    var isBuy = String(p.side).toLowerCase() !== "sell";
    var lvl = (kind === "sl")
      ? (isBuy ? price - off : price + off)
      : (isBuy ? price + off : price - off);
    lvl = Number(lvl.toFixed(d));

    this._dropDraft();
    var color = kind === "sl" ? COLORS.sl : COLORS.tp;
    var sid = this._makeLine(lvl, (kind === "sl" ? "SL " : "TP ") + fmt(lvl, d),
                             color, LINE_DASHED, false);
    this._draft = { posId: String(p.id), kind: kind, shapeId: sid, level: lvl };
    if (sid != null) this._owner[sid] = { posId: String(p.id), kind: kind, draft: true };

    var self = this;
    this._confirm(p, kind, lvl,
      function () { self._commit(p, kind, lvl); },
      function () { self._dropDraft(); });
  };

  Overlay.prototype._dropDraft = function () {
    if (this._draft && this._draft.shapeId != null) this._removeShape(this._draft.shapeId);
    this._draft = null;
  };

  // Send an accepted level to the server.
  Overlay.prototype._commit = function (p, kind, level) {
    this._dropDraft();
    var sl = kind === "sl" ? level : (Number(p.sl) || 0);
    var tp = kind === "tp" ? level : (Number(p.tp) || 0);
    this._pendingSet = { kind: kind, level: level, digits: this._digits(p.symbol) };
    this._drawn[String(p.id) + "|" + kind] = level;
    this._bridge.modifyBrackets(String(p.id), sl, tp);
  };

  // Confirmation before an SL/TP is committed — shows the level and what the
  // position would realise there, so a drag can never silently place a level
  // the trader didn't mean.
  Overlay.prototype._confirm = function (p, kind, level, onYes, onNo) {
    var self = this;
    this._closeConfirm();

    var d = this._digits(p.symbol);
    var pnl = this._pnlAt(p, level);
    var isSL = kind === "sl";
    var word = isSL ? "Stop Loss" : "Take Profit";
    var side = String(p.side).toLowerCase() === "sell" ? "SELL" : "BUY";

    var back = document.createElement("div");
    back.style.cssText =
      "position:fixed;inset:0;z-index:60;background:rgba(0,0,0,.55);display:flex;" +
      "align-items:center;justify-content:center;";

    var box = document.createElement("div");
    box.style.cssText =
      "min-width:330px;background:#171a20;border:1px solid #2a2d34;border-radius:10px;" +
      "padding:18px 20px;box-shadow:0 20px 60px rgba(0,0,0,.6);" +
      "font:400 13px Inter,'Segoe UI',sans-serif;color:#e6e8ec;";

    var head = document.createElement("div");
    head.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:16px;";
    head.innerHTML = '<div style="font:700 15px Inter,\'Segoe UI\',sans-serif">Set ' +
      word + " @ " + fmt(level, d) + "</div>";
    var xb = document.createElement("button");
    xb.textContent = "✕";
    xb.style.cssText = "cursor:pointer;background:none;border:none;color:#8a8f98;font-size:15px;";
    xb.onclick = function () { self._closeConfirm(); if (onNo) onNo(); };
    head.appendChild(xb);
    box.appendChild(head);

    var sub = document.createElement("div");
    sub.style.cssText = "margin:9px 0 18px;color:#9aa0a8;";
    sub.innerHTML = side + " " + Number(p.lots).toFixed(2) + " " + p.symbol + " &rarr; " +
      (pnl >= 0 ? "profit " : "loss ") +
      '<span style="color:' + (pnl >= 0 ? COLORS.profitPos : COLORS.profitNeg) + ';font-weight:700">' +
      fmtProfit(pnl) + "</span>";
    box.appendChild(sub);

    var row = document.createElement("div");
    row.style.cssText = "display:flex;gap:10px;";
    var cancel = document.createElement("button");
    cancel.textContent = "Cancel";
    cancel.style.cssText =
      "flex:1;cursor:pointer;padding:9px;border-radius:7px;border:1px solid #2a2d34;" +
      "background:#1f232a;color:#c9ccd1;font:600 13px Inter,'Segoe UI',sans-serif;";
    cancel.onclick = function () { self._closeConfirm(); if (onNo) onNo(); };
    var ok = document.createElement("button");
    ok.textContent = "Set " + (isSL ? "SL" : "TP");
    ok.style.cssText =
      "flex:1;cursor:pointer;padding:9px;border-radius:7px;border:none;" +
      "background:#22a95b;color:#fff;font:700 13px Inter,'Segoe UI',sans-serif;";
    ok.onclick = function () { self._closeConfirm(); if (onYes) onYes(); };
    row.appendChild(cancel);
    row.appendChild(ok);
    box.appendChild(row);

    back.appendChild(box);
    document.body.appendChild(back);
    this._confirmEl = back;
  };

  Overlay.prototype._closeConfirm = function () {
    if (this._confirmEl) { this._confirmEl.remove(); this._confirmEl = null; }
  };

  Overlay.prototype._okToast = function (msg) {
    var t = document.createElement("div");
    t.innerHTML = '<span style="color:#22a95b">✓</span> ' + msg;
    t.style.cssText =
      "position:absolute;top:14px;left:50%;transform:translateX(-50%);z-index:40;" +
      "background:rgba(23,26,32,.97);border:1px solid #2a2d34;color:#e6e8ec;" +
      "padding:7px 14px;border-radius:6px;font:600 12px Inter,'Segoe UI',sans-serif;" +
      "box-shadow:0 6px 20px rgba(0,0,0,.5);";
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 3000);
  };

  Overlay.prototype._toast = function (msg) {
    var t = document.createElement("div");
    t.textContent = msg;
    t.style.cssText =
      "position:absolute;top:14px;left:50%;transform:translateX(-50%);z-index:40;" +
      "background:rgba(220,38,38,.95);color:#fff;padding:7px 13px;border-radius:6px;" +
      "font:600 12px Inter,'Segoe UI',sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.5);";
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 4000);
  };

  window.makePositionOverlay = function (widget, bridge) { return new Overlay(widget, bridge); };
})();
