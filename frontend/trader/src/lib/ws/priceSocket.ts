import { getWebSocketBaseUrl } from './getWebSocketBaseUrl';

type PriceCallback = (data: TickData) => void;

export interface TickData {
  symbol: string;
  bid: number;
  ask: number;
  timestamp: string;
  spread: number;
}

class PriceSocket {
  private ws: WebSocket | null = null;
  private callbacks: Set<PriceCallback> = new Set();
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    const wsUrl = `${getWebSocketBaseUrl()}/ws/prices`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        console.log('Price socket connected');
      };

      this.ws.onmessage = (event) => {
        try {
          const data: TickData = JSON.parse(event.data);
          this.callbacks.forEach((cb) => cb(data));
        } catch {
          // ignore malformed messages
        }
      };

      this.ws.onclose = () => {
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        this.ws?.close();
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;
    if (this.reconnectTimer) return;

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  subscribe(callback: PriceCallback) {
    this.callbacks.add(callback);
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.connect();
    }
    return () => {
      this.callbacks.delete(callback);
    };
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
    this.callbacks.clear();
  }
}

export const priceSocket = new PriceSocket();
