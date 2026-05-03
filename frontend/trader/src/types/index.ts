// =============================================================
// Trader Frontend — Shared TypeScript types
// All API response shapes and domain models live here.
// Import from '@/types' — never define inline in stores/components.
// =============================================================

// ─── Auth ────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  country: string | null;
  role: string;
  status: string;
  kyc_status: 'pending' | 'approved' | 'rejected';
  two_factor_enabled: boolean;
  language: string;
  theme: string;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user_id: string;
  role: string;
  expires_at: string;
}

// ─── Trading Account ─────────────────────────────────────────

export interface TradingAccount {
  id: string;
  account_number: string;
  balance: number;
  credit: number;
  equity: number;
  margin_used: number;
  free_margin: number;
  margin_level: number;
  leverage: number;
  currency: string;
  is_demo: boolean;
  is_active: boolean;
}

export interface AccountSummary {
  balance: number;
  credit: number;
  equity: number;
  margin_used: number;
  free_margin: number;
  margin_level: number;
  unrealized_pnl: number;
  open_positions_count: number;
}

// ─── Orders ──────────────────────────────────────────────────

export type TradeDirection = 'buy' | 'sell';
export type OrderType = 'market' | 'limit' | 'stop' | 'stop_limit';
export type OrderStatus =
  | 'pending'
  | 'filled'
  | 'partially_filled'
  | 'cancelled'
  | 'rejected'
  | 'expired';

export interface PlaceOrderRequest {
  account_id: string;
  symbol: string;
  order_type: OrderType;
  side: TradeDirection;
  lots: number;
  price?: number;
  stop_loss?: number;
  take_profit?: number;
  stop_limit_price?: number;
  comment?: string;
}

export interface PendingOrder {
  id: string;
  account_id: string;
  symbol: string;
  order_type: OrderType;
  side: TradeDirection;
  status: OrderStatus;
  lots: number;
  price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  commission: number;
  swap: number;
  comment: string | null;
  created_at: string;
}

// ─── Positions ───────────────────────────────────────────────

export type PositionStatus = 'open' | 'closed' | 'partially_closed';

export interface OpenTrade {
  id: string;
  account_id: string;
  symbol: string;
  side: TradeDirection;
  lots: number;
  open_price: number;
  current_price?: number;
  stop_loss?: number;
  take_profit?: number;
  swap: number;
  commission: number;
  profit: number;
  created_at: string;
}

export interface Position {
  id: string;
  account_id: string;
  symbol: string;
  side: TradeDirection;
  lots: number;
  open_price: number;
  current_price?: number;
  stop_loss?: number;
  take_profit?: number;
  swap: number;
  commission: number;
  profit: number;
  status: string;
  contract_size: number;
  trade_type?: string;
  created_at: string;
}

export interface ClosedTrade {
  id: string;
  account_id: string;
  symbol: string;
  side: TradeDirection;
  lots: number;
  open_price: number;
  close_price: number;
  swap: number;
  commission: number;
  profit: number;
  close_reason: string | null;
  opened_at: string;
  closed_at: string;
}

// ─── Market Data ─────────────────────────────────────────────

export interface TickData {
  symbol: string;
  bid: number;
  ask: number;
  timestamp: string;
  spread: number;
}

export interface OHLCVBar {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// ─── Instruments ─────────────────────────────────────────────

export interface Instrument {
  id: string;
  symbol: string;
  display_name: string | null;
  segment: string | null;
  digits: number;
  pip_size: number;
  min_lot: number;
  max_lot: number;
  lot_step: number;
  contract_size: number;
  margin_rate: number;
  is_active: boolean;
}

// ─── Wallet / Deposits ────────────────────────────────────────

export interface DepositRequest {
  /** Optional; omitted = main-wallet deposit record */
  account_id?: string;
  amount: number;
  method: string;
  transaction_id?: string;
  screenshot_url?: string;
  crypto_tx_hash?: string;
  crypto_address?: string;
}

export interface DepositResponse {
  id: string;
  amount: number;
  currency: string;
  method: string;
  status: string;
  transaction_id: string | null;
  created_at: string;
}

export interface WithdrawalRequest {
  account_id: string;
  amount: number;
  method: string;
  bank_details?: Record<string, unknown>;
  crypto_address?: string;
}

export interface WithdrawalResponse {
  id: string;
  amount: number;
  currency: string;
  method: string;
  status: string;
  created_at: string;
}

// ─── Notifications ────────────────────────────────────────────

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  is_read: boolean;
  action_url: string | null;
  created_at: string;
}

// ─── Support ─────────────────────────────────────────────────

export interface SupportTicket {
  id: string;
  subject: string;
  status: 'open' | 'in_progress' | 'closed';
  priority: 'low' | 'medium' | 'high';
  created_at: string;
  updated_at: string;
  message_count: number;
}

export interface TicketMessage {
  id: string;
  ticket_id: string;
  sender_id: string;
  message: string;
  attachments: unknown[] | null;
  is_admin: boolean;
  created_at: string;
  sender_name: string | null;
}

// ─── Social / Copy Trading ────────────────────────────────────

export interface MasterAccount {
  id: string;
  user_id: string;
  account_id: string;
  status: string;
  master_type: string | null;
  performance_fee_pct: number;
  management_fee_pct: number;
  min_investment: number;
  total_return_pct: number;
  max_drawdown_pct: number;
  sharpe_ratio: number;
  followers_count: number;
  description: string | null;
  created_at: string;
}

// ─── Pagination ───────────────────────────────────────────────

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

// ─── WebSocket Messages ───────────────────────────────────────

export type WsMessageType =
  | 'tick'
  | 'position_update'
  | 'order_update'
  | 'account_update'
  | 'notification'
  | 'margin_call'
  | 'stop_out';

export interface WsMessage<T = unknown> {
  type: WsMessageType;
  data: T;
}
