import { getWebSocketBaseUrl } from './getWebSocketBaseUrl';

type TradeCallback = (data: TradeEvent) => void;

export interface TradeEvent {
  type: string;
  [key: string]: unknown;
}

class TradeSocket {
  private ws: WebSocket | null = null;
  private callbacks: Set<TradeCallback> = new Set();
  private accountId: string | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;

  connect(accountId: string, token: string) {
    this.accountId = accountId;
    if (this.ws?.readyState === WebSocket.OPEN) return;

    const base = getWebSocketBaseUrl();
    const qs = token ? `?token=${encodeURIComponent(token)}` : '';
    const wsUrl = `${base}/ws/trades/${accountId}${qs}`;

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log(`Trade socket connected for account ${accountId}`);
    };

    this.ws.onmessage = (event) => {
      try {
        const data: TradeEvent = JSON.parse(event.data);
        this.callbacks.forEach((cb) => cb(data));
      } catch {
        // ignore
      }
    };

    this.ws.onclose = () => {
      if (this.accountId) {
        this.reconnectTimer = setTimeout(() => this.connect(accountId, token), 3000);
      }
    };

    this.ws.onerror = () => this.ws?.close();
  }

  subscribe(callback: TradeCallback) {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  disconnect() {
    this.accountId = null;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
    this.callbacks.clear();
  }
}

export const tradeSocket = new TradeSocket();
