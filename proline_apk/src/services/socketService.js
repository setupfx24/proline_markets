import { API_BASE_URL } from '../config';

// The FastAPI gateway streams live prices over a RAW WebSocket at /ws/prices.
// Each message is a single tick: { symbol, bid, ask, spread, timestamp }.
// (The previous build used socket.io with priceStream/priceUpdate events; the
//  gateway does NOT speak socket.io — api.prolinemarket.com/socket.io/ is 404 —
//  which is why no prices were ever arriving. This uses the same contract as
//  the web trader frontend's PriceSocket.)
const toWsUrl = (base) => base.replace(/^http/i, 'ws').replace(/\/+$/, '');
const PRICE_WS_URL = `${toWsUrl(API_BASE_URL)}/ws/prices`;

class SocketService {
  constructor() {
    this.ws = null;
    this.isConnected = false;
    this.priceListeners = new Set();
    this.tradeListeners = new Set();
    this.accountListeners = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectTimer = null;
    this.prices = {};
  }

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    console.log('[Socket] Connecting to', PRICE_WS_URL);

    try {
      this.ws = new WebSocket(PRICE_WS_URL);
    } catch (e) {
      console.log('[Socket] Connection failed:', e.message);
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      console.log('[Socket] Connected!');
      this.isConnected = true;
      this.reconnectAttempts = 0;
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        // Gateway heartbeat is { type: 'ping' } — ignore anything without a symbol.
        if (!data || !data.symbol) return;
        this.prices[data.symbol] = {
          bid: data.bid,
          ask: data.ask,
          spread: data.spread,
          timestamp: data.timestamp,
        };
        this.notifyPriceListeners(this.prices);
      } catch (e) {
        // ignore malformed messages
      }
    };

    this.ws.onclose = () => {
      this.isConnected = false;
      this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      // onerror is followed by onclose, which schedules the reconnect.
      try { this.ws?.close(); } catch (e) {}
    };

    return this.ws;
  }

  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;
    if (this.reconnectTimer) return;

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 5000);
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try { this.ws.close(); } catch (e) {}
      this.ws = null;
    }
    this.isConnected = false;
    console.log('[Socket] Disconnected manually');
  }

  // The raw price stream broadcasts every symbol; there is no per-symbol
  // subscribe handshake. Kept as no-ops so existing callers keep working.
  subscribeToPrices() {}
  unsubscribePrices() {}

  // Per-account trade/balance updates live on /ws/trades/{id}?token=<jwt> and are
  // not wired up here — the trading screens poll REST for that data. These remain
  // so callers (addAccountListener consumers) don't crash.
  subscribeToAccount() {}
  unsubscribeFromAccount() {}

  // Add price listener (fires immediately with whatever we already have)
  addPriceListener(callback) {
    this.priceListeners.add(callback);
    if (Object.keys(this.prices).length > 0) {
      callback(this.prices);
    }
    return () => this.priceListeners.delete(callback);
  }

  removePriceListener(callback) {
    this.priceListeners.delete(callback);
  }

  addTradeListener(callback) {
    this.tradeListeners.add(callback);
    return () => this.tradeListeners.delete(callback);
  }

  addAccountListener(tradingAccountId, callback) {
    if (!this.accountListeners.has(tradingAccountId)) {
      this.accountListeners.set(tradingAccountId, new Set());
    }
    this.accountListeners.get(tradingAccountId).add(callback);
    return () => {
      const listeners = this.accountListeners.get(tradingAccountId);
      if (listeners) {
        listeners.delete(callback);
      }
    };
  }

  notifyPriceListeners(prices) {
    this.priceListeners.forEach(callback => {
      try {
        callback(prices);
      } catch (e) {
        console.error('[Socket] Price listener error:', e);
      }
    });
  }

  getPrices() {
    return this.prices;
  }

  getPrice(symbol) {
    return this.prices[symbol];
  }

  isSocketConnected() {
    return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
  }
}

// Singleton instance
const socketService = new SocketService();
export default socketService;
