// =============================================================
// Admin Frontend — Shared TypeScript types
// All API response shapes and domain models live here.
// Import from '@/types' — never define inline in stores/components.
// =============================================================

// ─── Auth ────────────────────────────────────────────────────

export interface AdminUser {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: 'admin' | 'super_admin';
  employee_role: string | null;
  permissions: string[];
}

// ─── Users ───────────────────────────────────────────────────

export type KycStatus = 'pending' | 'approved' | 'rejected';
export type UserStatus = 'active' | 'blocked' | 'banned';

export interface UserOut {
  id: string;
  email: string;
  phone: string | null;
  first_name: string | null;
  last_name: string | null;
  date_of_birth: string | null;
  country: string | null;
  address: string | null;
  role: string;
  status: UserStatus;
  kyc_status: KycStatus;
  is_demo: boolean;
  language: string | null;
  theme: string | null;
  trading_blocked_until: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface TradingAccountOut {
  id: string;
  user_id: string;
  account_group_id: string | null;
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
  created_at: string | null;
}

export interface UserDetailOut {
  user: UserOut;
  accounts: TradingAccountOut[];
  total_deposit: number;
  total_withdrawal: number;
  total_trades: number;
  open_positions: number;
}

// ─── Trades ──────────────────────────────────────────────────

export type TradeSide = 'buy' | 'sell';
export type PositionStatus = 'open' | 'closed' | 'partially_closed';
export type OrderStatus = 'pending' | 'filled' | 'partially_filled' | 'cancelled' | 'rejected' | 'expired';
export type OrderType = 'market' | 'limit' | 'stop' | 'stop_limit';

export interface PositionOut {
  id: string;
  account_id: string;
  instrument_symbol: string | null;
  side: TradeSide;
  status: PositionStatus;
  lots: number;
  open_price: number;
  close_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  swap: number;
  commission: number;
  profit: number;
  comment: string | null;
  is_admin_modified: boolean;
  created_at: string | null;
  user_email: string | null;
  account_number: string | null;
}

export interface OrderOut {
  id: string;
  account_id: string;
  instrument_symbol: string | null;
  order_type: OrderType;
  side: TradeSide;
  status: OrderStatus;
  lots: number;
  price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  filled_price: number | null;
  commission: number;
  swap: number;
  comment: string | null;
  is_admin_created: boolean;
  created_at: string | null;
  user_email: string | null;
  account_number: string | null;
}

export interface TradeHistoryOut {
  id: string;
  account_id: string;
  instrument_symbol: string | null;
  side: TradeSide;
  lots: number;
  open_price: number;
  close_price: number;
  swap: number;
  commission: number;
  profit: number;
  close_reason: string | null;
  opened_at: string | null;
  closed_at: string | null;
  user_email: string | null;
  account_number: string | null;
}

// ─── Deposits / Withdrawals ───────────────────────────────────

export type TransactionStatus = 'pending' | 'approved' | 'rejected' | 'completed';

export interface DepositOut {
  id: string;
  user_id: string;
  account_id: string | null;
  amount: number;
  currency: string;
  method: string | null;
  status: TransactionStatus;
  transaction_id: string | null;
  screenshot_url: string | null;
  rejection_reason: string | null;
  created_at: string | null;
  user_email: string | null;
  user_name: string | null;
}

export interface WithdrawalOut {
  id: string;
  user_id: string;
  account_id: string | null;
  amount: number;
  currency: string;
  method: string | null;
  status: TransactionStatus;
  bank_details: Record<string, unknown> | null;
  crypto_address: string | null;
  rejection_reason: string | null;
  created_at: string | null;
  user_email: string | null;
  user_name: string | null;
}

export interface TransactionOut {
  id: string;
  user_id: string;
  account_id: string | null;
  type: string;
  amount: number;
  balance_after: number | null;
  description: string | null;
  created_at: string | null;
}

// ─── Banks ───────────────────────────────────────────────────

export interface BankAccountOut {
  id: string;
  account_name: string | null;
  account_number: string | null;
  bank_name: string | null;
  ifsc_code: string | null;
  upi_id: string | null;
  qr_code_url: string | null;
  tier: number;
  min_amount: number;
  max_amount: number;
  is_active: boolean;
  rotation_order: number;
  last_used_at: string | null;
  created_at: string | null;
}

// ─── Employees ───────────────────────────────────────────────

export interface EmployeeOut {
  id: string;
  user_id: string;
  role: string;
  is_active: boolean;
  created_at: string | null;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
}

// ─── Bonuses / Banners ────────────────────────────────────────

export interface BonusOfferOut {
  id: string;
  name: string;
  bonus_type: string | null;
  percentage: number | null;
  fixed_amount: number | null;
  min_deposit: number;
  max_bonus: number | null;
  lots_required: number;
  target_audience: string;
  starts_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string | null;
}

export interface BannerOut {
  id: string;
  title: string | null;
  image_url: string;
  link_url: string | null;
  target_page: string;
  position: string;
  target_audience: string;
  priority: number;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  click_count: number;
  created_at: string | null;
}

// ─── Support ─────────────────────────────────────────────────

export interface TicketOut {
  id: string;
  user_id: string;
  subject: string;
  status: 'open' | 'in_progress' | 'closed';
  priority: 'low' | 'medium' | 'high';
  assigned_to: string | null;
  created_at: string | null;
  updated_at: string | null;
  user_email: string | null;
  user_name: string | null;
  message_count: number;
}

export interface TicketMessageOut {
  id: string;
  ticket_id: string;
  sender_id: string;
  message: string;
  attachments: unknown[] | null;
  is_admin: boolean;
  created_at: string | null;
  sender_name: string | null;
}

// ─── Dashboard / Analytics ────────────────────────────────────

export interface DashboardStats {
  total_users: number;
  active_traders: number;
  deposits_today: number;
  withdrawals_today: number;
  platform_pnl: number;
  commission_paid: number;
  pending_deposits_count: number;
  open_tickets_count: number;
}

export interface ExposureItem {
  instrument_symbol: string;
  net_lots: number;
  buy_lots: number;
  sell_lots: number;
  buy_positions: number;
  sell_positions: number;
}

// ─── Pagination ───────────────────────────────────────────────

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
}
