import { create } from 'zustand';

type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';

interface WSState {
  status: ConnectionStatus;
  ws: WebSocket | null;
  reconnectAttempt: number;
  subscriptions: Set<string>;

  setStatus: (status: ConnectionStatus) => void;
  setWs: (ws: WebSocket | null) => void;
  incrementReconnect: () => void;
  resetReconnect: () => void;
  addSubscription: (channel: string) => void;
  removeSubscription: (channel: string) => void;
}

export const useWSStore = create<WSState>((set, get) => ({
  status: 'disconnected',
  ws: null,
  reconnectAttempt: 0,
  subscriptions: new Set(),

  setStatus: (status) => set({ status }),
  setWs: (ws) => set({ ws }),
  incrementReconnect: () => set((s) => ({ reconnectAttempt: s.reconnectAttempt + 1 })),
  resetReconnect: () => set({ reconnectAttempt: 0 }),
  addSubscription: (channel) => {
    const subs = new Set(get().subscriptions);
    subs.add(channel);
    set({ subscriptions: subs });
  },
  removeSubscription: (channel) => {
    const subs = new Set(get().subscriptions);
    subs.delete(channel);
    set({ subscriptions: subs });
  },
}));
