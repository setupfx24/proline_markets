import { WS_URL } from '../../constants';
import logger from '../../utils/logger';

// Live price stream only. (A trade stream with a token-in-URL pattern used to
// live here but was never called from anywhere — removed.)
class WebSocketService {
  constructor() {
    this.priceWs = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 12;
    this.reconnectDelay = 3000;
    this.priceListeners = new Set();
    this.isConnecting = false;
    // Set while WE close a socket on purpose — its onclose must not schedule
    // a reconnect (previously disconnectPriceStream() triggered an immediate
    // reconnect via its own close event).
    this.intentionalClose = { price: false };
  }

  async connectPriceStream() {
    if (this.priceWs && this.priceWs.readyState === WebSocket.OPEN) {
      logger.log('Price WebSocket already connected');
      return;
    }

    if (this.isConnecting) {
      logger.log('Price WebSocket connection already in progress');
      return;
    }

    this.isConnecting = true;

    try {
      const wsUrl = `${WS_URL}/ws/prices`;

      this.priceWs = new WebSocket(wsUrl);

      this.priceWs.onopen = () => {
        logger.log('Price WebSocket connected');
        this.reconnectAttempts = 0;
        this.isConnecting = false;
      };

      this.priceWs.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.notifyPriceListeners(data);
        } catch (error) {
          logger.error('Error parsing price message:', error);
        }
      };

      this.priceWs.onerror = () => {
        // Don't surface as logger.error — Expo Go shows that as an in-app red toast.
        // Reconnect logic handles the actual recovery.
        this.isConnecting = false;
      };

      this.priceWs.onclose = () => {
        this.isConnecting = false;
        if (this.intentionalClose.price) {
          this.intentionalClose.price = false;
          return;
        }
        this.handleReconnect();
      };
    } catch (error) {
      logger.error('Error connecting to price stream:', error);
      this.isConnecting = false;
    }
  }

  handleReconnect() {
    this.reconnectAttempts++;
    // Bounded, backed-off retries (prices also have a REST polling fallback,
    // so giving up is safe). reconnectAttempts resets to 0 on a successful
    // open; a fresh connectPriceStream() call from a screen also retries anew.
    if (this.reconnectAttempts > this.maxReconnectAttempts) return;
    const delay = Math.min(this.reconnectDelay * this.reconnectAttempts, 15000);

    setTimeout(() => {
      this.connectPriceStream();
    }, delay);
  }

  onPriceUpdate(callback) {
    this.priceListeners.add(callback);
    return () => this.priceListeners.delete(callback);
  }

  notifyPriceListeners(data) {
    this.priceListeners.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        logger.error('Error in price listener:', error);
      }
    });
  }

  disconnectPriceStream() {
    if (this.priceWs) {
      this.intentionalClose.price = true;
      this.priceWs.close();
      this.priceWs = null;
    }
  }

  disconnectAll() {
    this.disconnectPriceStream();
    this.priceListeners.clear();
  }

  getConnectionStatus() {
    return {
      price: this.priceWs ? this.priceWs.readyState : WebSocket.CLOSED,
    };
  }
}

export default new WebSocketService();
