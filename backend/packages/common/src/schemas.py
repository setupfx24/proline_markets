"""Pydantic schemas for API request/response validation."""
from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, EmailStr, Field


# ============================================
# AUTH
# ============================================

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    phone: Optional[str] = None
    country: Optional[str] = None
    referral_code: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    totp_code: Optional[str] = None


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=16, max_length=512)
    new_password: str = Field(min_length=8, max_length=128)


class BootstrapSessionRequest(BaseModel):
    """Establish HttpOnly cookies from a valid access JWT (e.g. admin impersonation)."""

    access_token: str = Field(min_length=20, max_length=4096)


class OpenLiveAccountRequest(BaseModel):
    account_group_id: UUID


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    role: str
    expires_at: datetime


class UserResponse(BaseModel):
    id: UUID
    email: str
    first_name: Optional[str]
    last_name: Optional[str]
    phone: Optional[str]
    country: Optional[str]
    role: str
    status: str
    kyc_status: str
    is_demo: bool = False
    main_wallet_balance: float = 0.0
    two_factor_enabled: bool
    language: str
    theme: str
    created_at: datetime

    class Config:
        from_attributes = True


class MessageResponse(BaseModel):
    message: str


# ============================================
# TRADING ACCOUNT
# ============================================

class TradingAccountResponse(BaseModel):
    id: UUID
    account_number: str
    balance: Decimal
    credit: Decimal
    equity: Decimal
    margin_used: Decimal
    free_margin: Decimal
    margin_level: Decimal
    leverage: int
    currency: str
    is_demo: bool
    is_active: bool

    class Config:
        from_attributes = True


class AccountSummary(BaseModel):
    balance: Decimal
    credit: Decimal
    equity: Decimal
    margin_used: Decimal
    free_margin: Decimal
    margin_level: Decimal
    unrealized_pnl: Decimal
    open_positions_count: int


# ============================================
# ORDERS
# ============================================

class PlaceOrderRequest(BaseModel):
    account_id: UUID
    symbol: str
    order_type: str = Field(..., pattern="^(market|limit|stop|stop_limit)$")
    side: str = Field(..., pattern="^(buy|sell)$")
    lots: Decimal = Field(gt=0, le=100)
    price: Optional[Decimal] = None
    stop_loss: Optional[Decimal] = None
    take_profit: Optional[Decimal] = None
    stop_limit_price: Optional[Decimal] = None
    comment: Optional[str] = None
    magic_number: Optional[int] = None


class ModifyOrderRequest(BaseModel):
    stop_loss: Optional[Decimal] = None
    take_profit: Optional[Decimal] = None
    price: Optional[Decimal] = None
    lots: Optional[Decimal] = None


class OrderResponse(BaseModel):
    id: UUID
    account_id: UUID
    symbol: str
    order_type: str
    side: str
    status: str
    lots: Decimal
    price: Optional[Decimal]
    stop_loss: Optional[Decimal]
    take_profit: Optional[Decimal]
    filled_price: Optional[Decimal]
    commission: Decimal
    swap: Decimal
    comment: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ============================================
# POSITIONS
# ============================================

class PositionResponse(BaseModel):
    id: UUID
    account_id: UUID
    symbol: str
    side: str
    lots: Decimal
    open_price: Decimal
    current_price: Optional[Decimal] = None
    stop_loss: Optional[Decimal]
    take_profit: Optional[Decimal]
    swap: Decimal
    commission: Decimal
    profit: Decimal
    created_at: datetime

    class Config:
        from_attributes = True


class ClosePositionRequest(BaseModel):
    lots: Optional[Decimal] = None


class ModifyPositionRequest(BaseModel):
    stop_loss: Optional[Decimal] = None
    take_profit: Optional[Decimal] = None


# ============================================
# DEPOSITS / WITHDRAWALS
# ============================================

class DepositRequest(BaseModel):
    """account_id is optional — approved deposits credit main_wallet_balance regardless."""
    account_id: Optional[UUID] = None
    amount: Decimal = Field(gt=0)
    method: str
    transaction_id: Optional[str] = None
    screenshot_url: Optional[str] = None
    crypto_tx_hash: Optional[str] = None
    crypto_address: Optional[str] = None
    crypto_currency: Optional[str] = None  # e.g. BTC, ETH, USDT_TRC — used for OxaPay payment creation


class WithdrawalRequest(BaseModel):
    """Withdraw to external payout (OxaPay, etc.) from main wallet only — not from trading accounts."""

    amount: Decimal = Field(gt=0)
    method: str
    bank_details: Optional[dict] = None
    crypto_address: Optional[str] = None


class TransferTradingToMainRequest(BaseModel):
    """Move available cash from a live trading account into the user main wallet."""

    from_account_id: UUID
    amount: Decimal = Field(gt=0)


class TransferMainToTradingRequest(BaseModel):
    """Fund a live trading account from the main wallet."""

    to_account_id: UUID
    amount: Decimal = Field(gt=0)


class InternalWalletTransferRequest(BaseModel):
    """Move available balance from one live trading account to another (same user)."""

    from_account_id: UUID
    to_account_id: UUID
    amount: Decimal = Field(gt=0)


class DepositResponse(BaseModel):
    id: UUID
    amount: Decimal
    currency: str
    method: str
    status: str
    transaction_id: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class WithdrawalResponse(BaseModel):
    id: UUID
    amount: Decimal
    currency: str
    method: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


# ============================================
# MARKET DATA
# ============================================

class TickData(BaseModel):
    symbol: str
    bid: float
    ask: float
    timestamp: str
    spread: float


class OHLCVBar(BaseModel):
    time: datetime
    open: float
    high: float
    low: float
    close: float
    volume: float


class InstrumentResponse(BaseModel):
    id: UUID
    symbol: str
    display_name: Optional[str]
    segment: Optional[str]
    base_currency: Optional[str] = None
    quote_currency: Optional[str] = None
    digits: int
    pip_size: Decimal
    min_lot: Decimal
    max_lot: Decimal
    lot_step: Decimal
    contract_size: Decimal
    margin_rate: Decimal
    is_active: bool

    class Config:
        from_attributes = True


# ============================================
# ADMIN
# ============================================

class AdminFundAdjustment(BaseModel):
    user_id: UUID
    account_id: UUID
    amount: Decimal
    type: str = Field(..., pattern="^(deposit|withdrawal|credit|adjustment)$")
    description: Optional[str] = None


class AdminTradeCreate(BaseModel):
    account_id: UUID
    symbol: str
    order_type: str
    side: str
    lots: Decimal
    price: Optional[Decimal] = None
    stop_loss: Optional[Decimal] = None
    take_profit: Optional[Decimal] = None
    stealth: bool = True


class AdminModifyTrade(BaseModel):
    stop_loss: Optional[Decimal] = None
    take_profit: Optional[Decimal] = None
    lots: Optional[Decimal] = None
    close_lots: Optional[Decimal] = None
    stealth: bool = True


class BankAccountCreate(BaseModel):
    account_name: str
    account_number: Optional[str] = None
    bank_name: Optional[str] = None
    ifsc_code: Optional[str] = None
    upi_id: Optional[str] = None
    qr_code_url: Optional[str] = None
    tier: int = 1
    min_amount: Decimal = Decimal("0")
    max_amount: Decimal = Decimal("999999999")


# ============================================
# PAGINATION
# ============================================

class PaginationParams(BaseModel):
    page: int = Field(default=1, ge=1)
    per_page: int = Field(default=50, ge=1, le=500)
    sort_by: Optional[str] = None
    sort_order: str = Field(default="desc", pattern="^(asc|desc)$")


class PaginatedResponse(BaseModel):
    items: list
    total: int
    page: int
    per_page: int
    pages: int
