"""Admin-specific Pydantic schemas — request/response models for the admin API."""
import uuid
from datetime import datetime, date
from decimal import Decimal
from typing import Optional, Any
from pydantic import BaseModel, EmailStr, Field


class AdminLoginRequest(BaseModel):
    email: str
    password: str


class AdminLoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    admin_id: str
    role: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None


class AdminRefreshRequest(BaseModel):
    access_token: str


class DashboardStats(BaseModel):
    total_users: int = 0
    active_traders: int = 0
    deposits_today: float = 0
    withdrawals_today: float = 0
    platform_pnl: float = 0
    commission_paid: float = 0
    pending_deposits_count: int = 0
    open_tickets_count: int = 0


class DashboardRevenuePoint(BaseModel):
    date: str
    deposits: float = 0
    withdrawals: float = 0
    net: float = 0


class DashboardRevenueSeries(BaseModel):
    points: list[DashboardRevenuePoint] = []


class UserOut(BaseModel):
    id: str
    email: str
    phone: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    date_of_birth: Optional[date] = None
    country: Optional[str] = None
    address: Optional[str] = None
    role: str
    status: str
    kyc_status: str
    is_demo: bool
    language: Optional[str] = None
    theme: Optional[str] = None
    trading_blocked_until: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AccountTypeIn(BaseModel):
    name: str
    description: Optional[str] = None
    leverage_default: int = 100
    spread_markup_default: Decimal = Decimal("0")
    commission_default: Decimal = Decimal("0")
    minimum_deposit: Decimal = Decimal("0")
    swap_free: bool = False
    is_demo: bool = False
    is_active: bool = True


class AccountTypeOut(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    leverage_default: int
    spread_markup_default: Decimal
    commission_default: Decimal
    minimum_deposit: Decimal
    swap_free: bool
    is_demo: bool
    is_active: bool
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class TradingAccountOut(BaseModel):
    id: str
    user_id: str
    account_group_id: Optional[str] = None
    account_number: str
    balance: float
    credit: float
    equity: float
    margin_used: float
    free_margin: float
    margin_level: float
    leverage: int
    currency: str
    is_demo: bool
    is_active: bool
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class UserDetailOut(BaseModel):
    user: UserOut
    accounts: list[TradingAccountOut] = []
    total_deposit: float = 0
    total_withdrawal: float = 0
    total_trades: int = 0
    open_positions: int = 0


class PaginatedResponse(BaseModel):
    items: list[Any] = []
    total: int = 0
    page: int = 1
    per_page: int = 20


class FundRequest(BaseModel):
    account_id: Optional[str] = None  # Optional: add_fund goes to main wallet; deduct_fund uses this as fallback
    amount: float = Field(gt=0)
    description: Optional[str] = None
    # For deduct_fund only: "main_wallet" → deduct only from main wallet;
    # "trading_account" → deduct only from the given account_id; omit/None → try
    # main wallet first, fall back to the trading_account.
    source: Optional[str] = None


class CreditRequest(BaseModel):
    account_id: str
    amount: float = Field(gt=0)
    description: Optional[str] = None


class PositionOut(BaseModel):
    id: str
    account_id: str
    instrument_symbol: Optional[str] = None
    side: str
    status: str
    lots: float
    open_price: float
    close_price: Optional[float] = None
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    swap: float = 0
    commission: float = 0
    profit: float = 0
    comment: Optional[str] = None
    is_admin_modified: bool = False
    created_at: Optional[datetime] = None
    user_email: Optional[str] = None
    user_name: Optional[str] = None
    account_number: Optional[str] = None
    book_type: Optional[str] = None       # 'A' (forwarded to LP) or 'B'
    is_demo: bool = False
    is_lp_forwarded: bool = False         # True when non-demo + book_type == 'A'

    class Config:
        from_attributes = True


class OrderOut(BaseModel):
    id: str
    account_id: str
    instrument_symbol: Optional[str] = None
    order_type: str
    side: str
    status: str
    lots: float
    price: Optional[float] = None
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    filled_price: Optional[float] = None
    commission: float = 0
    swap: float = 0
    comment: Optional[str] = None
    is_admin_created: bool = False
    created_at: Optional[datetime] = None
    user_email: Optional[str] = None
    user_name: Optional[str] = None
    account_number: Optional[str] = None

    class Config:
        from_attributes = True


class TradeHistoryOut(BaseModel):
    id: str
    account_id: str
    instrument_symbol: Optional[str] = None
    side: str
    lots: float
    open_price: float
    close_price: float
    swap: float = 0
    commission: float = 0
    profit: float
    close_reason: Optional[str] = "manual"
    opened_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    user_email: Optional[str] = None
    user_name: Optional[str] = None
    account_number: Optional[str] = None

    class Config:
        from_attributes = True


class ModifyPositionRequest(BaseModel):
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    open_price: Optional[float] = None
    commission: Optional[float] = None
    swap: Optional[float] = None
    lots: Optional[float] = None
    open_time: Optional[datetime] = None
    reason: Optional[str] = None


class ClosePositionRequest(BaseModel):
    close_price: Optional[float] = None
    reason: Optional[str] = None


class CreateTradeRequest(BaseModel):
    account_id: str
    instrument_id: Optional[str] = None
    symbol: Optional[str] = None
    side: str
    lots: float
    price: Optional[float] = None
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    comment: Optional[str] = None


class DepositOut(BaseModel):
    id: str
    user_id: str
    account_id: Optional[str] = None
    amount: float
    currency: str
    method: Optional[str] = None
    status: str
    transaction_id: Optional[str] = None
    screenshot_url: Optional[str] = None
    rejection_reason: Optional[str] = None
    created_at: Optional[datetime] = None
    user_email: Optional[str] = None
    user_name: Optional[str] = None

    class Config:
        from_attributes = True


class WithdrawalOut(BaseModel):
    id: str
    user_id: str
    account_id: Optional[str] = None
    amount: float
    currency: str
    method: Optional[str] = None
    status: str
    bank_details: Optional[dict] = None
    crypto_address: Optional[str] = None
    rejection_reason: Optional[str] = None
    created_at: Optional[datetime] = None
    user_email: Optional[str] = None
    user_name: Optional[str] = None

    class Config:
        from_attributes = True


class RejectRequest(BaseModel):
    reason: str


class BankAccountIn(BaseModel):
    account_name: Optional[str] = None
    account_number: Optional[str] = None
    bank_name: Optional[str] = None
    ifsc_code: Optional[str] = None
    upi_id: Optional[str] = None
    qr_code_url: Optional[str] = None
    # Crypto pay-to (manual USDT-style). method_type = 'bank' | 'crypto'.
    method_type: str = "bank"
    asset: Optional[str] = None
    network: Optional[str] = None
    wallet_address: Optional[str] = None
    tier: int = 1
    min_amount: float = 0
    max_amount: float = 999999999
    is_active: bool = True
    rotation_order: int = 0


class BankAccountOut(BaseModel):
    id: str
    account_name: Optional[str] = None
    account_number: Optional[str] = None
    bank_name: Optional[str] = None
    ifsc_code: Optional[str] = None
    upi_id: Optional[str] = None
    qr_code_url: Optional[str] = None
    method_type: Optional[str] = "bank"
    asset: Optional[str] = None
    network: Optional[str] = None
    wallet_address: Optional[str] = None
    tier: int
    min_amount: float
    max_amount: float
    is_active: bool
    rotation_order: int
    last_used_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ChargeConfigIn(BaseModel):
    scope: str
    segment_id: Optional[str] = None
    instrument_id: Optional[str] = None
    user_id: Optional[str] = None
    charge_type: str
    value: float
    is_enabled: bool = True


class ChargeConfigOut(BaseModel):
    id: str
    scope: str
    segment_id: Optional[str] = None
    instrument_id: Optional[str] = None
    user_id: Optional[str] = None
    charge_type: str
    value: float
    is_enabled: bool
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SpreadConfigIn(BaseModel):
    scope: str
    segment_id: Optional[str] = None
    instrument_id: Optional[str] = None
    user_id: Optional[str] = None
    spread_type: str
    value: float
    is_enabled: bool = True


class SpreadConfigOut(BaseModel):
    id: str
    scope: str
    segment_id: Optional[str] = None
    instrument_id: Optional[str] = None
    user_id: Optional[str] = None
    spread_type: str
    value: float
    is_enabled: bool
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SwapConfigIn(BaseModel):
    scope: str
    segment_id: Optional[str] = None
    instrument_id: Optional[str] = None
    user_id: Optional[str] = None
    swap_long: float = 0
    swap_short: float = 0
    triple_swap_day: int = 3
    swap_free: bool = False
    is_enabled: bool = True


class SwapConfigOut(BaseModel):
    id: str
    scope: str
    segment_id: Optional[str] = None
    instrument_id: Optional[str] = None
    user_id: Optional[str] = None
    swap_long: float
    swap_short: float
    triple_swap_day: int
    swap_free: bool
    is_enabled: bool
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class BulkChargeUpdate(BaseModel):
    configs: list[ChargeConfigIn]


class BulkSpreadUpdate(BaseModel):
    configs: list[SpreadConfigIn]


class BulkSwapUpdate(BaseModel):
    configs: list[SwapConfigIn]


class IBApplicationOut(BaseModel):
    id: str
    user_id: str
    status: str
    application_data: Optional[dict] = None
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    user_email: Optional[str] = None
    user_name: Optional[str] = None

    class Config:
        from_attributes = True


class IBProfileOut(BaseModel):
    id: str
    user_id: str
    referral_code: str
    parent_ib_id: Optional[str] = None
    level: int
    commission_plan_id: Optional[str] = None
    custom_commission_per_lot: Optional[float] = None
    custom_commission_per_trade: Optional[float] = None
    total_earned: float
    pending_payout: float
    is_active: bool
    created_at: Optional[datetime] = None
    user_email: Optional[str] = None
    user_name: Optional[str] = None
    referral_count: int = 0

    class Config:
        from_attributes = True


class UpdateIBCommissionIn(BaseModel):
    commission_plan_id: Optional[str] = None
    custom_commission_per_lot: Optional[float] = None
    custom_commission_per_trade: Optional[float] = None


class RejectIBIn(BaseModel):
    reason: str


class IBCommissionPlanOut(BaseModel):
    id: str
    name: str
    is_default: bool
    commission_per_lot: float
    commission_per_trade: float
    spread_share_pct: float
    cpa_per_deposit: float
    mlm_levels: int
    mlm_distribution: list
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class IBCommissionPlanIn(BaseModel):
    name: str
    is_default: bool = False
    commission_per_lot: float = 0
    commission_per_trade: float = 0
    spread_share_pct: float = 0
    cpa_per_deposit: float = 0
    mlm_levels: int = 5
    mlm_distribution: list = [40, 25, 15, 10, 10]


class MLMConfigOut(BaseModel):
    mlm_levels: int = 5
    mlm_distribution: list = []


class MLMConfigIn(BaseModel):
    mlm_levels: int
    mlm_distribution: list


class MasterAccountOut(BaseModel):
    id: str
    user_id: str
    account_id: str
    status: str
    master_type: Optional[str] = None
    performance_fee_pct: float
    management_fee_pct: float
    admin_commission_pct: float
    max_investors: int
    description: Optional[str] = None
    min_investment: float
    total_return_pct: float
    max_drawdown_pct: float
    sharpe_ratio: float
    followers_count: int
    created_at: Optional[datetime] = None
    user_email: Optional[str] = None
    user_name: Optional[str] = None

    class Config:
        from_attributes = True


class AnalyticsDashboard(BaseModel):
    total_revenue: float = 0
    total_commission: float = 0
    total_swap: float = 0
    total_deposits: float = 0
    total_withdrawals: float = 0
    net_deposits: float = 0
    profitable_users_count: int = 0
    losing_users_count: int = 0
    total_open_positions: int = 0
    total_exposure: float = 0


class ExposureItem(BaseModel):
    instrument_symbol: str
    net_lots: float
    buy_lots: float
    sell_lots: float
    buy_positions: int
    sell_positions: int


class BonusOfferIn(BaseModel):
    name: str
    bonus_type: Optional[str] = None
    percentage: Optional[float] = None
    fixed_amount: Optional[float] = None
    min_deposit: float = 0
    max_bonus: Optional[float] = None
    lots_required: float = 0
    target_audience: str = "all"
    starts_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    is_active: bool = True


class BonusOfferOut(BaseModel):
    id: str
    name: str
    bonus_type: Optional[str] = None
    percentage: Optional[float] = None
    fixed_amount: Optional[float] = None
    min_deposit: float
    max_bonus: Optional[float] = None
    lots_required: float
    target_audience: str
    starts_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    is_active: bool
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class UserBonusOut(BaseModel):
    id: str
    user_id: str
    account_id: Optional[str] = None
    offer_id: Optional[str] = None
    amount: float
    lots_traded: float
    lots_required: float
    status: str
    released_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    user_email: Optional[str] = None
    offer_name: Optional[str] = None

    class Config:
        from_attributes = True


class BannerIn(BaseModel):
    title: Optional[str] = None
    image_url: str
    link_url: Optional[str] = None
    target_page: str = "dashboard"
    position: str = "top"
    target_audience: str = "all"
    priority: int = 0
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    is_active: bool = True


class BannerOut(BaseModel):
    id: str
    title: Optional[str] = None
    image_url: str
    link_url: Optional[str] = None
    target_page: str
    position: str
    target_audience: str
    priority: int
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    is_active: bool
    click_count: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class TicketOut(BaseModel):
    id: str
    user_id: str
    subject: str
    status: str
    priority: str
    assigned_to: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    user_email: Optional[str] = None
    user_name: Optional[str] = None
    message_count: int = 0

    class Config:
        from_attributes = True


class TicketMessageOut(BaseModel):
    id: str
    ticket_id: str
    sender_id: str
    message: str
    attachments: Optional[list] = None
    is_admin: bool
    created_at: Optional[datetime] = None
    sender_name: Optional[str] = None

    class Config:
        from_attributes = True


class TicketDetailOut(BaseModel):
    ticket: TicketOut
    messages: list[TicketMessageOut] = []


class TicketReplyRequest(BaseModel):
    message: str
    attachments: Optional[list] = None


class TicketStatusUpdate(BaseModel):
    status: str


class TicketAssignRequest(BaseModel):
    admin_id: str


class EmployeeIn(BaseModel):
    email: str
    password: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    full_name: Optional[str] = None
    role: str
    phone: Optional[str] = None


class EmployeeUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None


class InvestorIn(BaseModel):
    """Create / regenerate a read-only investor login for one platform user.
    Email defaults to the user's email; a random password is generated."""
    user_id: str
    label: Optional[str] = None


class InvestorUpdate(BaseModel):
    is_active: Optional[bool] = None
    password: Optional[str] = None  # set to reset the login password
    label: Optional[str] = None


class EmployeeOut(BaseModel):
    id: str
    user_id: str
    role: str
    is_active: bool
    created_at: Optional[datetime] = None
    email: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None

    class Config:
        from_attributes = True


class AuditLogOut(BaseModel):
    id: str
    admin_id: str
    action: str
    entity_type: Optional[str] = None
    entity_id: Optional[str] = None
    old_values: Optional[dict] = None
    new_values: Optional[dict] = None
    ip_address: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class UserAuditLogOut(BaseModel):
    id: str
    user_id: str
    user_email: Optional[str] = None
    user_name: Optional[str] = None
    action_type: str
    ip_address: Optional[str] = None
    device_info: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SystemSettingOut(BaseModel):
    key: str
    value: Any
    description: Optional[str] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SystemSettingUpdate(BaseModel):
    settings: dict[str, Any]


class TransactionOut(BaseModel):
    id: str
    user_id: str
    account_id: Optional[str] = None
    type: str
    amount: float
    balance_after: Optional[float] = None
    description: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AdminTransactionOut(BaseModel):
    id: str
    user_id: Optional[str] = None
    account_id: Optional[str] = None
    type: str
    amount: float
    balance_after: Optional[float] = None
    reference_id: Optional[str] = None
    description: Optional[str] = None
    created_by: Optional[str] = None
    created_at: Optional[datetime] = None
    user_email: Optional[str] = None
    user_name: Optional[str] = None
    account_number: Optional[str] = None
    admin_email: Optional[str] = None
    admin_name: Optional[str] = None

    class Config:
        from_attributes = True


# ============================================
# MANAGED (SYNTHETIC) ACCOUNTS
# ============================================

class ManagedDeposit(BaseModel):
    date: date                       # deposit date (YYYY-MM-DD)
    amount: float = Field(gt=0)      # USD amount


class ManagedMonthlyReturn(BaseModel):
    year: int = Field(ge=2000, le=2100)
    month: int = Field(ge=1, le=12)
    pct: float                       # net return % on base capital for the month


class ManagedAllocation(BaseModel):
    symbol: str                      # instrument symbol e.g. XAUUSD
    weight_pct: float = Field(ge=0, le=100)


class ManagedAccountConfig(BaseModel):
    """Full form input to (re)generate a synthetic managed client account."""
    # Identity
    first_name: str
    last_name: str = ""
    email: EmailStr
    country: Optional[str] = None
    password: str                    # real login password (client can log in web + mobile)
    open_date: date                  # account opened / created date
    # Account
    account_group_id: Optional[str] = None   # None → first live/"Standard" group
    leverage: int = 100
    currency: str = "USD"
    # Funding / payout
    deposits: list[ManagedDeposit] = Field(min_length=1)
    pay_method: str = "crypto_usdt"
    pay_currency: str = "USDT"
    wallet_address: Optional[str] = None
    base_capital: Optional[float] = None     # None → sum(deposits)
    # Returns & withdrawals
    monthly_returns: list[ManagedMonthlyReturn] = Field(min_length=1)
    withdraw_day: int = Field(default=5, ge=1, le=28)   # day of following month
    retain_last_month: bool = True           # keep newest month's profit in balance
    withdraw_months: Optional[list[str]] = None  # "YYYY-MM" list; None → all but retained
    # Instrument mix & trade shape
    instrument_allocation: list[ManagedAllocation] = Field(
        default_factory=lambda: [
            ManagedAllocation(symbol="XAUUSD", weight_pct=80),
            ManagedAllocation(symbol="GBPUSD", weight_pct=10),
            ManagedAllocation(symbol="US100", weight_pct=10),
        ]
    )
    loss_fraction: float = Field(default=0.14, ge=0, le=0.9)  # of primary instrument gross
    seed: int = 20260626             # deterministic RNG seed


class ManagedMonthPreview(BaseModel):
    year: int
    month: int
    pct: float
    profit: float
    withdrawn: bool
    withdraw_date: Optional[str] = None


class ManagedAccountPreview(BaseModel):
    base_capital: float
    total_deposits: float
    total_withdrawn: float
    final_balance: float
    trades_count: int
    months: list[ManagedMonthPreview]
    warnings: list[str] = Field(default_factory=list)


class ManagedAccountOut(BaseModel):
    id: str
    user_id: str
    account_id: Optional[str] = None
    email: str
    label: Optional[str] = None
    account_number: Optional[str] = None
    final_balance: float = 0
    trades_count: int = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
