import { getWebSocketBaseUrl } from './getWebSocketBaseUrl';

type MessageHandler = (data: any) => void;

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';

class WSManager {
  private ws: WebSocket | null = null;
  private handlers = new Map<string, Set<MessageHandler>>();
  private globalHandlers = new Set<MessageHandler>();
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnect = 10;
  private statusCallbacks = new Set<(s: ConnectionStatus) => void>();
  private _status: ConnectionStatus = 'disconnected';
  private subscribedChannels = new Set<string>();

  get status() { return this._status; }

  private setStatus(s: ConnectionStatus) {
    this._status = s;
    this.statusCallbacks.forEach((cb) => cb(s));
  }

  connect(token?: string) {
    if (this.ws?.readyState === WebSocket.OPEN) return;
    this.setStatus('connecting');

    const base = getWebSocketBaseUrl();
    const wsUrl = `${base}/ws/prices`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.setStatus('connected');
        this.reconnectAttempts = 0;
        if (this.subscribedChannels.size > 0) {
          this.ws?.send(JSON.stringify({
            action: 'subscribe',
            channels: Array.from(this.subscribedChannels),
          }));
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const type = data.type || data.symbol || 'unknown';

          this.globalHandlers.forEach((h) => h(data));

          const typeHandlers = this.handlers.get(type);
          if (typeHandlers) typeHandlers.forEach((h) => h(data));

          if (data.symbol) {
            const symbolHandlers = this.handlers.get(`tick:${data.symbol}`);
            if (symbolHandlers) symbolHandlers.forEach((h) => h(data));
          }
        } catch { /* ignore malformed */ }
      };

      this.ws.onclose = () => {
        this.setStatus('disconnected');
        this.scheduleReconnect(token);
      };

      this.ws.onerror = () => this.ws?.close();
    } catch {
      this.scheduleReconnect(token);
    }
  }

  private scheduleReconnect(token?: string) {
    if (this.reconnectAttempts >= this.maxReconnect) return;
    if (this.reconnectTimer) return;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect(token);
    }, delay);
  }

  subscribe(channel: string, handler: MessageHandler) {
    if (!this.handlers.has(channel)) this.handlers.set(channel, new Set());
    this.handlers.get(channel)!.add(handler);
    this.subscribedChannels.add(channel);
    return () => {
      this.handlers.get(channel)?.delete(handler);
      if (this.handlers.get(channel)?.size === 0) {
        this.handlers.delete(channel);
        this.subscribedChannels.delete(channel);
      }
    };
  }

  onMessage(handler: MessageHandler) {
    this.globalHandlers.add(handler);
    return () => this.globalHandlers.delete(handler);
  }

  onStatusChange(cb: (s: ConnectionStatus) => void) {
    this.statusCallbacks.add(cb);
    return () => this.statusCallbacks.delete(cb);
  }

  send(data: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.reconnectAttempts = this.maxReconnect;
    this.ws?.close();
    this.ws = null;
    this.setStatus('disconnected');
  }
}

export const wsManager = new WSManager();
