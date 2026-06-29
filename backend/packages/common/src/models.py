"""SQLAlchemy ORM models for the entire platform."""
import uuid
from datetime import datetime
from decimal import Decimal
from sqlalchemy import (
    Column, String, Boolean, Integer, DateTime, ForeignKey, Text, Numeric,
    Enum as SAEnum, Index, JSON, CheckConstraint
)
from sqlalchemy.dialects.postgresql import UUID, INET, JSONB
from sqlalchemy.orm import relationship
from .database import Base
import enum


# ============================================
# ENUMS
# ============================================

class OrderType(str, enum.Enum):
    MARKET = "market"
    LIMIT = "limit"
    STOP = "stop"
    STOP_LIMIT = "stop_limit"


class OrderSide(str, enum.Enum):
    BUY = "buy"
    SELL = "sell"


class OrderStatus(str, enum.Enum):
    PENDING = "pending"
    FILLED = "filled"
    PARTIALLY_FILLED = "partially_filled"
    CANCELLED = "cancelled"
    REJECTED = "rejected"
    EXPIRED = "expired"


class PositionStatus(str, enum.Enum):
    OPEN = "open"
    CLOSED = "closed"
    PARTIALLY_CLOSED = "partially_closed"


class AllocationCopyType(str, enum.Enum):
    """How investor lot size is derived for mirrored trades (per InvestorAllocation)."""

    SIGNAL = "signal"
    PAMM = "pamm"
    MAM = "mam"


order_type_enum = SAEnum(OrderType, name="order_type", create_type=False, values_callable=lambda e: [x.value for x in e])
order_side_enum = SAEnum(OrderSide, name="order_side", create_type=False, values_callable=lambda e: [x.value for x in e])
order_status_enum = SAEnum(OrderStatus, name="order_status", create_type=False, values_callable=lambda e: [x.value for x in e])
position_status_enum = SAEnum(PositionStatus, name="position_status", create_type=False, values_callable=lambda e: [x.value for x in e])


# ============================================
# USER & AUTH
# ============================================

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    phone = Column(String(20))
    password_hash = Column(String(255), nullable=False)
    first_name = Column(String(100))
    last_name = Column(String(100))
    date_of_birth = Column(DateTime)
    country = Column(String(100))
    address = Column(Text)
    role = Column(String(20), default="user")
    status = Column(String(20), default="active")
    kyc_status = Column(String(20), default="pending")
    is_demo = Column(Boolean, default=False)
    email_verified = Column(Boolean, default=False, server_default="false")
    two_factor_enabled = Column(Boolean, default=False)
    two_factor_secret = Column(String(255))
    language = Column(String(10), default="en")
    theme = Column(String(10), default="dark")
    book_type = Column(String(1), default="B", server_default="B")  # 'A' (LP routed) or 'B' (internal)
    trading_blocked_until = Column(DateTime(timezone=True))
    main_wallet_balance = Column(Numeric(18, 8), nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    accounts = relationship("TradingAccount", back_populates="user", lazy="selectin")
    sessions = relationship("UserSession", back_populates="user")
    password_reset_tokens = relationship("PasswordResetToken", back_populates="user", lazy="selectin")
    refresh_tokens = relationship("UserRefreshToken", back_populates="user", lazy="selectin")


class UserSession(Base):
    __tablename__ = "user_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    token_hash = Column(String(255), nullable=False)
    ip_address = Column(INET)
    user_agent = Column(Text)
    device_info = Column(JSONB)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    expires_at = Column(DateTime(timezone=True), nullable=False)

    user = relationship("User", back_populates="sessions")


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token_hash = Column(String(255), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    user = relationship("User", back_populates="password_reset_tokens")


class UserRefreshToken(Base):
    __tablename__ = "user_refresh_tokens"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token_hash = Column(String(255), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    revoked = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    user = relationship("User", back_populates="refresh_tokens")


class KYCDocument(Base):
    __tablename__ = "kyc_documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    document_type = Column(String(30), nullable=False)
    file_url = Column(Text, nullable=False)
    status = Column(String(20), default="pending")
    rejection_reason = Column(Text)
    reviewed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    reviewed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)


# ============================================
# TRADING ACCOUNTS
# ============================================

class AccountGroup(Base):
    __tablename__ = "account_groups"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(50), nullable=False)
    description = Column(Text)
    leverage_default = Column(Integer, default=100)
    spread_markup_default = Column(Numeric(10, 5), default=0)
    commission_default = Column(Numeric(10, 5), default=0)
    minimum_deposit = Column(Numeric(18, 8), default=0)
    swap_free = Column(Boolean, default=False)
    is_demo = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)


class TradingAccount(Base):
    __tablename__ = "trading_accounts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    account_group_id = Column(UUID(as_uuid=True), ForeignKey("account_groups.id"))
    account_number = Column(String(20), unique=True, nullable=False)
    balance = Column(Numeric(18, 8), default=0)
    credit = Column(Numeric(18, 8), default=0)
    equity = Column(Numeric(18, 8), default=0)
    margin_used = Column(Numeric(18, 8), default=0)
    free_margin = Column(Numeric(18, 8), default=0)
    margin_level = Column(Numeric(10, 4), default=0)
    leverage = Column(Integer, default=100)
    currency = Column(String(5), default="USD")
    is_demo = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="accounts")
    positions = relationship("Position", back_populates="account", lazy="selectin")
    account_group = relationship("AccountGroup", lazy="selectin")


# ============================================
# INSTRUMENTS
# ============================================

class InstrumentSegment(Base):
    __tablename__ = "instrument_segments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(50), unique=True, nullable=False)
    display_name = Column(String(100))
    is_active = Column(Boolean, default=True)


class Instrument(Base):
    __tablename__ = "instruments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    symbol = Column(String(20), unique=True, nullable=False, index=True)
    display_name = Column(String(100))
    segment_id = Column(UUID(as_uuid=True), ForeignKey("instrument_segments.id"))
    base_currency = Column(String(10))
    quote_currency = Column(String(10))
    digits = Column(Integer, default=5)
    pip_size = Column(Numeric(10, 8), default=Decimal("0.0001"))
    lot_size = Column(Integer, default=100000)
    min_lot = Column(Numeric(10, 4), default=Decimal("0.01"))
    max_lot = Column(Numeric(10, 4), default=100)
    lot_step = Column(Numeric(10, 4), default=Decimal("0.01"))
    contract_size = Column(Numeric(18, 4), default=100000)
    margin_rate = Column(Numeric(10, 6), default=Decimal("0.01"))
    trading_hours = Column(JSONB)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    segment = relationship("InstrumentSegment", lazy="selectin")


class InstrumentConfig(Base):
    """Single admin-editable row per instrument; synced to charge/spread/swap config tables."""

    __tablename__ = "instrument_configs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    instrument_id = Column(UUID(as_uuid=True), ForeignKey("instruments.id", ondelete="CASCADE"), unique=True, nullable=False)
    commission_value = Column(Numeric(18, 8))
    commission_type = Column(String(30), nullable=False, default="per_lot")
    spread_value = Column(Numeric(18, 8))
    spread_type = Column(String(20), nullable=False, default="pips")
    price_impact = Column(Numeric(18, 8), nullable=False, default=Decimal("0"))
    swap_long = Column(Numeric(18, 8), default=Decimal("0"))
    swap_short = Column(Numeric(18, 8), default=Decimal("0"))
    swap_free = Column(Boolean, nullable=False, default=False)
    min_lot_size = Column(Numeric(10, 4), default=Decimal("0.01"))
    max_lot_size = Column(Numeric(10, 4), default=Decimal("100"))
    leverage_max = Column(Integer, default=2000)
    is_enabled = Column(Boolean, nullable=False, default=True)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
    updated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))

    instrument = relationship("Instrument", lazy="selectin")


class InstrumentConfigAudit(Base):
    __tablename__ = "instrument_config_audit"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    instrument_id = Column(UUID(as_uuid=True), ForeignKey("instruments.id", ondelete="CASCADE"), nullable=False)
    field_changed = Column(String(64), nullable=False)
    old_value = Column(Text)
    new_value = Column(Text)
    changed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    changed_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    ip_address = Column(String(64))


# ============================================
# ORDERS & POSITIONS
# ============================================

class Order(Base):
    __tablename__ = "orders"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    account_id = Column(UUID(as_uuid=True), ForeignKey("trading_accounts.id", ondelete="CASCADE"))
    instrument_id = Column(UUID(as_uuid=True), ForeignKey("instruments.id"))
    order_type = Column(order_type_enum, nullable=False)
    side = Column(order_side_enum, nullable=False)
    status = Column(order_status_enum, default=OrderStatus.PENDING)
    lots = Column(Numeric(10, 4), nullable=False)
    price = Column(Numeric(18, 8))
    stop_loss = Column(Numeric(18, 8))
    take_profit = Column(Numeric(18, 8))
    stop_limit_price = Column(Numeric(18, 8))
    filled_price = Column(Numeric(18, 8))
    filled_at = Column(DateTime(timezone=True))
    commission = Column(Numeric(18, 8), default=0)
    swap = Column(Numeric(18, 8), default=0)
    comment = Column(Text)
    is_admin_created = Column(Boolean, default=False)
    admin_created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    magic_number = Column(Integer)
    expires_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    instrument = relationship("Instrument", lazy="selectin")


class Position(Base):
    __tablename__ = "positions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    account_id = Column(UUID(as_uuid=True), ForeignKey("trading_accounts.id", ondelete="CASCADE"))
    instrument_id = Column(UUID(as_uuid=True), ForeignKey("instruments.id"))
    order_id = Column(UUID(as_uuid=True), ForeignKey("orders.id"))
    side = Column(order_side_enum, nullable=False)
    status = Column(position_status_enum, default=PositionStatus.OPEN)
    lots = Column(Numeric(10, 4), nullable=False)
    open_price = Column(Numeric(18, 8), nullable=False)
    close_price = Column(Numeric(18, 8))
    stop_loss = Column(Numeric(18, 8))
    take_profit = Column(Numeric(18, 8))
    swap = Column(Numeric(18, 8), default=0)
    commission = Column(Numeric(18, 8), default=0)
    profit = Column(Numeric(18, 8), default=0)
    closed_at = Column(DateTime(timezone=True))
    comment = Column(Text)
    is_admin_modified = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    account = relationship("TradingAccount", back_populates="positions")
    instrument = relationship("Instrument", lazy="selectin")


# ============================================
# WALLET
# ============================================

class BankAccount(Base):
    __tablename__ = "bank_accounts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    account_name = Column(String(100))
    account_number = Column(String(50))
    bank_name = Column(String(100))
    ifsc_code = Column(String(20))
    upi_id = Column(String(100))
    qr_code_url = Column(Text)
    tier = Column(Integer, default=1)
    min_amount = Column(Numeric(18, 2), default=0)
    max_amount = Column(Numeric(18, 2), default=999999999)
    is_active = Column(Boolean, default=True)
    rotation_order = Column(Integer, default=0)
    last_used_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)


class Deposit(Base):
    __tablename__ = "deposits"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    account_id = Column(UUID(as_uuid=True), ForeignKey("trading_accounts.id"), nullable=True)
    amount = Column(Numeric(18, 8), nullable=False)
    currency = Column(String(10), default="USD")
    method = Column(String(30))
    status = Column(String(20), default="pending")
    transaction_id = Column(String(100))
    screenshot_url = Column(Text)
    bank_account_id = Column(UUID(as_uuid=True), ForeignKey("bank_accounts.id"), nullable=True)
    crypto_tx_hash = Column(String(200))
    crypto_address = Column(String(200))
    rejection_reason = Column(Text)
    approved_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    approved_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    user = relationship("User", foreign_keys=[user_id], lazy="selectin")


class Withdrawal(Base):
    __tablename__ = "withdrawals"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    account_id = Column(UUID(as_uuid=True), ForeignKey("trading_accounts.id"), nullable=True)
    amount = Column(Numeric(18, 8), nullable=False)
    currency = Column(String(10), default="USD")
    method = Column(String(30))
    status = Column(String(20), default="pending")
    bank_details = Column(JSONB)
    crypto_address = Column(String(200))
    crypto_tx_hash = Column(String(200))
    rejection_reason = Column(Text)
    approved_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    approved_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    user = relationship("User", foreign_keys=[user_id], lazy="selectin")


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    account_id = Column(UUID(as_uuid=True), ForeignKey("trading_accounts.id"), nullable=True)
    type = Column(String(30), nullable=False)
    amount = Column(Numeric(18, 8), nullable=False)
    balance_after = Column(Numeric(18, 8))
    reference_id = Column(UUID(as_uuid=True))
    description = Column(Text)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)


# ============================================
# CHARGES / SPREAD / SWAP CONFIG
# ============================================

class ChargeConfig(Base):
    __tablename__ = "charge_configs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    scope = Column(String(20), nullable=False)
    segment_id = Column(UUID(as_uuid=True), ForeignKey("instrument_segments.id"))
    instrument_id = Column(UUID(as_uuid=True), ForeignKey("instruments.id"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    charge_type = Column(String(30), nullable=False)
    value = Column(Numeric(18, 8), nullable=False)
    is_enabled = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)


class SpreadConfig(Base):
    __tablename__ = "spread_configs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    scope = Column(String(20), nullable=False)
    segment_id = Column(UUID(as_uuid=True), ForeignKey("instrument_segments.id"))
    instrument_id = Column(UUID(as_uuid=True), ForeignKey("instruments.id"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    spread_type = Column(String(20), nullable=False)
    value = Column(Numeric(18, 8), nullable=False)
    is_enabled = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)


class SwapConfig(Base):
    __tablename__ = "swap_configs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    scope = Column(String(20), nullable=False)
    segment_id = Column(UUID(as_uuid=True), ForeignKey("instrument_segments.id"))
    instrument_id = Column(UUID(as_uuid=True), ForeignKey("instruments.id"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    swap_long = Column(Numeric(18, 8), default=0)
    swap_short = Column(Numeric(18, 8), default=0)
    triple_swap_day = Column(Integer, default=3)
    swap_free = Column(Boolean, default=False)
    is_enabled = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)


# ============================================
# IB / SOCIAL / BONUS / SUPPORT / NOTIFICATIONS
# ============================================

class IBProfile(Base):
    __tablename__ = "ib_profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), unique=True)
    referral_code = Column(String(20), unique=True, nullable=False)
    parent_ib_id = Column(UUID(as_uuid=True), ForeignKey("ib_profiles.id"))
    level = Column(Integer, default=1)
    commission_plan_id = Column(UUID(as_uuid=True))
    custom_commission_per_lot = Column(Numeric(18, 8))
    custom_commission_per_trade = Column(Numeric(18, 8))
    total_earned = Column(Numeric(18, 8), default=0)
    pending_payout = Column(Numeric(18, 8), default=0)
    is_active = Column(Boolean, default=True)
    rejection_reason = Column(Text)
    rejected_at = Column(DateTime(timezone=True))
    rejected_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    user = relationship("User", foreign_keys=[user_id], lazy="selectin")


class MasterAccount(Base):
    __tablename__ = "master_accounts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    account_id = Column(UUID(as_uuid=True), ForeignKey("trading_accounts.id"))
    status = Column(String(20), default="pending")
    master_type = Column(String(20))
    performance_fee_pct = Column(Numeric(5, 2), default=20)
    management_fee_pct = Column(Numeric(5, 2), default=0)
    admin_commission_pct = Column(Numeric(5, 2), default=0)
    max_investors = Column(Integer, default=100)
    description = Column(Text)
    strategy_info = Column(JSONB, default=None)
    min_investment = Column(Numeric(18, 8), default=100)
    total_return_pct = Column(Numeric(10, 4), default=0)
    max_drawdown_pct = Column(Numeric(10, 4), default=0)
    sharpe_ratio = Column(Numeric(10, 4), default=0)
    followers_count = Column(Integer, default=0)
    total_fee_earned = Column(Numeric(18, 8), default=0)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    user = relationship("User", lazy="selectin")
    account = relationship("TradingAccount", lazy="selectin")


class SupportTicket(Base):
    __tablename__ = "support_tickets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    subject = Column(String(255), nullable=False)
    status = Column(String(20), default="open")
    priority = Column(String(10), default="medium")
    assigned_to = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", foreign_keys=[user_id], lazy="selectin")
    messages = relationship("TicketMessage", back_populates="ticket", lazy="selectin")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    title = Column(String(200))
    message = Column(Text)
    type = Column(String(30), default="info")
    is_read = Column(Boolean, default=False)
    action_url = Column(Text)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    admin_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    action = Column(String(100), nullable=False)
    entity_type = Column(String(50))
    entity_id = Column(UUID(as_uuid=True))
    old_values = Column(JSONB)
    new_values = Column(JSONB)
    ip_address = Column(INET)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)


class UserAuditLog(Base):
    """Trader-facing activity (login, logout, orders) for admin review — separate from admin AuditLog."""

    __tablename__ = "user_audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    action_type = Column(String(80), nullable=False)
    ip_address = Column(String(64))
    device_info = Column(Text)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    user = relationship("User", foreign_keys=[user_id], lazy="noload")


class Banner(Base):
    __tablename__ = "banners"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(200))
    image_url = Column(Text, nullable=False)
    link_url = Column(Text)
    target_page = Column(String(30), default="dashboard")
    position = Column(String(20), default="top")
    target_audience = Column(String(30), default="all")
    priority = Column(Integer, default=0)
    starts_at = Column(DateTime(timezone=True))
    ends_at = Column(DateTime(timezone=True))
    is_active = Column(Boolean, default=True)
    click_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)


# ============================================
# MISSING MODELS — IPLog, TradeHistory, IB tables, etc.
# ============================================

class IPLog(Base):
    __tablename__ = "ip_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    ip_address = Column(INET, nullable=False)
    action = Column(String(50))
    user_agent = Column(Text)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)


class TradeHistory(Base):
    __tablename__ = "trade_history"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    position_id = Column(UUID(as_uuid=True), ForeignKey("positions.id"))
    account_id = Column(UUID(as_uuid=True), ForeignKey("trading_accounts.id"))
    instrument_id = Column(UUID(as_uuid=True), ForeignKey("instruments.id"))
    side = Column(order_side_enum, nullable=False)
    lots = Column(Numeric(10, 4), nullable=False)
    open_price = Column(Numeric(18, 8), nullable=False)
    close_price = Column(Numeric(18, 8), nullable=False)
    swap = Column(Numeric(18, 8), default=0)
    commission = Column(Numeric(18, 8), default=0)
    profit = Column(Numeric(18, 8), nullable=False)
    opened_at = Column(DateTime(timezone=True), nullable=False)
    closed_at = Column(DateTime(timezone=True), nullable=False)
    close_reason = Column(String(20), default="manual")

    instrument = relationship("Instrument", lazy="selectin")


class IBApplication(Base):
    __tablename__ = "ib_applications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    status = Column(String(20), default="pending")
    application_data = Column(JSONB)
    approved_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    approved_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    user = relationship("User", foreign_keys=[user_id], lazy="selectin")


class IBCommissionPlan(Base):
    __tablename__ = "ib_commission_plans"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100))
    is_default = Column(Boolean, default=False)
    commission_per_lot = Column(Numeric(18, 8), default=0)
    commission_per_trade = Column(Numeric(18, 8), default=0)
    spread_share_pct = Column(Numeric(5, 2), default=0)
    cpa_per_deposit = Column(Numeric(18, 8), default=0)
    mlm_levels = Column(Integer, default=5)
    mlm_distribution = Column(JSONB, default=[40, 25, 15, 10, 10])
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)


class IBCommission(Base):
    __tablename__ = "ib_commissions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ib_id = Column(UUID(as_uuid=True), ForeignKey("ib_profiles.id"))
    source_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    source_trade_id = Column(UUID(as_uuid=True), ForeignKey("orders.id"))
    commission_type = Column(String(30))
    amount = Column(Numeric(18, 8), nullable=False)
    mlm_level = Column(Integer, default=1)
    status = Column(String(20), default="pending")
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)


class Referral(Base):
    __tablename__ = "referrals"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    referrer_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    referred_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    ib_profile_id = Column(UUID(as_uuid=True), ForeignKey("ib_profiles.id"))
    utm_source = Column(String(100))
    utm_medium = Column(String(100))
    utm_campaign = Column(String(100))
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)


class InvestorAllocation(Base):
    __tablename__ = "investor_allocations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    master_id = Column(UUID(as_uuid=True), ForeignKey("master_accounts.id"))
    investor_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    investor_account_id = Column(UUID(as_uuid=True), ForeignKey("trading_accounts.id"))
    copy_type = Column(String(20), default="signal")
    allocation_amount = Column(Numeric(18, 8), nullable=False)
    allocation_pct = Column(Numeric(5, 2))
    max_drawdown_pct = Column(Numeric(5, 2))
    max_lot_override = Column(Numeric(10, 4))
    status = Column(String(20), default="active")
    total_profit = Column(Numeric(18, 8), default=0)
    last_distribution_at = Column(DateTime(timezone=True), nullable=True)
    drawdown_tripped = Column(Boolean, default=False, nullable=False)
    drawdown_tripped_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)


class CopyTrade(Base):
    __tablename__ = "copy_trades"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    master_position_id = Column(UUID(as_uuid=True), ForeignKey("positions.id"))
    investor_allocation_id = Column(UUID(as_uuid=True), ForeignKey("investor_allocations.id"))
    investor_position_id = Column(UUID(as_uuid=True), ForeignKey("positions.id"))
    ratio = Column(Numeric(10, 4), default=1)
    status = Column(String(20), default="open")
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)


class BonusOffer(Base):
    __tablename__ = "bonus_offers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False)
    bonus_type = Column(String(30))
    percentage = Column(Numeric(5, 2))
    fixed_amount = Column(Numeric(18, 8))
    min_deposit = Column(Numeric(18, 8), default=0)
    max_bonus = Column(Numeric(18, 8))
    lots_required = Column(Numeric(10, 4), default=0)
    target_audience = Column(String(30), default="all")
    starts_at = Column(DateTime(timezone=True))
    expires_at = Column(DateTime(timezone=True))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)


class UserBonus(Base):
    __tablename__ = "user_bonuses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    account_id = Column(UUID(as_uuid=True), ForeignKey("trading_accounts.id"))
    offer_id = Column(UUID(as_uuid=True), ForeignKey("bonus_offers.id"))
    amount = Column(Numeric(18, 8), nullable=False)
    lots_traded = Column(Numeric(10, 4), default=0)
    lots_required = Column(Numeric(10, 4), default=0)
    status = Column(String(20), default="active")
    released_at = Column(DateTime(timezone=True))
    expires_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)


class TicketMessage(Base):
    __tablename__ = "ticket_messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ticket_id = Column(UUID(as_uuid=True), ForeignKey("support_tickets.id", ondelete="CASCADE"))
    sender_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    message = Column(Text, nullable=False)
    attachments = Column(JSONB)
    is_admin = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    ticket = relationship("SupportTicket", back_populates="messages")
    sender = relationship("User", foreign_keys=[sender_id], lazy="selectin")


class Employee(Base):
    __tablename__ = "employees"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), unique=True)
    role = Column(String(30), nullable=False)
    is_active = Column(Boolean, default=True)
    # Admin-granted extra permissions beyond the role defaults (JSON list of strings).
    extra_permissions = Column(JSONB, default=list, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    user = relationship("User", lazy="selectin")


class AlgoApiKey(Base):
    __tablename__ = "algo_api_keys"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    account_id = Column(UUID(as_uuid=True), ForeignKey("trading_accounts.id", ondelete="CASCADE"))
    api_key = Column(String(64), unique=True, nullable=False, index=True)
    secret_hash = Column(String(128), nullable=False)
    api_secret = Column(String(128), nullable=True)
    label = Column(String(100), default="")
    is_active = Column(Boolean, default=True)
    last_used_at = Column(DateTime(timezone=True), nullable=True)
    trades_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    user = relationship("User", lazy="selectin")
    account = relationship("TradingAccount", lazy="selectin")


class SystemSetting(Base):
    __tablename__ = "system_settings"

    key = Column(String(100), primary_key=True)
    value = Column(JSONB, nullable=False)
    description = Column(Text)
    updated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow)


class SharedTrade(Base):
    """Public share link for a trader's position — TradeLocker-style share card."""
    __tablename__ = "shared_trades"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    short_code = Column(String(16), unique=True, nullable=False, index=True)
    position_id = Column(UUID(as_uuid=True), ForeignKey("positions.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    description = Column(Text)
    link_description = Column(Text)
    display_mode = Column(String(16), default="pnl")  # pnl | roi | ticks
    view_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    expires_at = Column(DateTime(timezone=True), nullable=False)
