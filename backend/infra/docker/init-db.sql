-- Proline Markets Main Database Schema

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- ACCOUNT & AUTH
-- ============================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    date_of_birth DATE,
    country VARCHAR(100),
    address TEXT,
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin', 'super_admin', 'ib', 'sub_broker', 'master_trader')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'banned', 'blocked', 'pending_kyc', 'suspended')),
    kyc_status VARCHAR(20) DEFAULT 'pending' CHECK (kyc_status IN ('pending', 'submitted', 'approved', 'rejected')),
    is_demo BOOLEAN DEFAULT FALSE,
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    two_factor_secret VARCHAR(255),
    language VARCHAR(10) DEFAULT 'en',
    theme VARCHAR(10) DEFAULT 'dark',
    trading_blocked_until TIMESTAMPTZ,
    main_wallet_balance DECIMAL(18, 8) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    device_info JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_password_reset_tokens_hash ON password_reset_tokens(token_hash);
CREATE INDEX idx_password_reset_tokens_user ON password_reset_tokens(user_id);

CREATE TABLE user_refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_refresh_tokens_hash ON user_refresh_tokens(token_hash);
CREATE INDEX idx_user_refresh_tokens_user ON user_refresh_tokens(user_id);

CREATE TABLE ip_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    ip_address INET NOT NULL,
    action VARCHAR(50),
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE kyc_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    document_type VARCHAR(30) NOT NULL CHECK (document_type IN (
        'passport', 'national_id', 'driving_license', 'proof_of_address', 'address_proof',
        'selfie', 'bank_statement', 'id_front', 'id_back', 'other'
    )),
    file_url TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    rejection_reason TEXT,
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TRADING ACCOUNTS
-- ============================================

CREATE TABLE account_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL,
    description TEXT,
    leverage_default INT DEFAULT 100,
    spread_markup_default DECIMAL(10,5) DEFAULT 0,
    commission_default DECIMAL(10,5) DEFAULT 0,
    minimum_deposit DECIMAL(18,8) DEFAULT 0,
    swap_free BOOLEAN DEFAULT FALSE,
    is_demo BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE trading_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    account_group_id UUID REFERENCES account_groups(id),
    account_number VARCHAR(20) UNIQUE NOT NULL,
    balance DECIMAL(18,8) DEFAULT 0,
    credit DECIMAL(18,8) DEFAULT 0,
    equity DECIMAL(18,8) DEFAULT 0,
    margin_used DECIMAL(18,8) DEFAULT 0,
    free_margin DECIMAL(18,8) DEFAULT 0,
    margin_level DECIMAL(10,4) DEFAULT 0,
    leverage INT DEFAULT 100,
    currency VARCHAR(5) DEFAULT 'USD',
    is_demo BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INSTRUMENTS
-- ============================================

CREATE TABLE instrument_segments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE
);

INSERT INTO instrument_segments (name, display_name) VALUES
    ('forex', 'Forex'),
    ('indices', 'Indices'),
    ('commodities', 'Commodities'),
    ('crypto', 'Cryptocurrency'),
    ('stocks', 'Stocks'),
    ('energies', 'Energies');

CREATE TABLE instruments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol VARCHAR(20) UNIQUE NOT NULL,
    display_name VARCHAR(100),
    segment_id UUID REFERENCES instrument_segments(id),
    base_currency VARCHAR(10),
    quote_currency VARCHAR(10),
    digits INT DEFAULT 5,
    pip_size DECIMAL(10,8) DEFAULT 0.0001,
    lot_size INT DEFAULT 100000,
    min_lot DECIMAL(10,4) DEFAULT 0.01,
    max_lot DECIMAL(10,4) DEFAULT 100,
    lot_step DECIMAL(10,4) DEFAULT 0.01,
    contract_size DECIMAL(18,4) DEFAULT 100000,
    margin_rate DECIMAL(10,6) DEFAULT 0.01,
    trading_hours JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed common instruments
INSERT INTO instruments (symbol, display_name, segment_id, base_currency, quote_currency, digits, pip_size) VALUES
    ('EURUSD', 'Euro / US Dollar', (SELECT id FROM instrument_segments WHERE name='forex'), 'EUR', 'USD', 5, 0.0001),
    ('GBPUSD', 'British Pound / US Dollar', (SELECT id FROM instrument_segments WHERE name='forex'), 'GBP', 'USD', 5, 0.0001),
    ('USDJPY', 'US Dollar / Japanese Yen', (SELECT id FROM instrument_segments WHERE name='forex'), 'USD', 'JPY', 3, 0.01),
    ('AUDUSD', 'Australian Dollar / US Dollar', (SELECT id FROM instrument_segments WHERE name='forex'), 'AUD', 'USD', 5, 0.0001),
    ('USDCAD', 'US Dollar / Canadian Dollar', (SELECT id FROM instrument_segments WHERE name='forex'), 'USD', 'CAD', 5, 0.0001),
    ('USDCHF', 'US Dollar / Swiss Franc', (SELECT id FROM instrument_segments WHERE name='forex'), 'USD', 'CHF', 5, 0.0001),
    ('NZDUSD', 'New Zealand Dollar / US Dollar', (SELECT id FROM instrument_segments WHERE name='forex'), 'NZD', 'USD', 5, 0.0001),
    ('EURGBP', 'Euro / British Pound', (SELECT id FROM instrument_segments WHERE name='forex'), 'EUR', 'GBP', 5, 0.0001),
    ('EURJPY', 'Euro / Japanese Yen', (SELECT id FROM instrument_segments WHERE name='forex'), 'EUR', 'JPY', 3, 0.01),
    ('GBPJPY', 'British Pound / Japanese Yen', (SELECT id FROM instrument_segments WHERE name='forex'), 'GBP', 'JPY', 3, 0.01),
    ('XAUUSD', 'Gold / US Dollar', (SELECT id FROM instrument_segments WHERE name='commodities'), 'XAU', 'USD', 2, 0.01),
    ('XAGUSD', 'Silver / US Dollar', (SELECT id FROM instrument_segments WHERE name='commodities'), 'XAG', 'USD', 3, 0.001),
    ('USOIL', 'US Crude Oil (WTI)', (SELECT id FROM instrument_segments WHERE name='energies'), 'OIL', 'USD', 2, 0.01),
    ('US30', 'Dow Jones 30', (SELECT id FROM instrument_segments WHERE name='indices'), 'US30', 'USD', 1, 0.1),
    ('US500', 'S&P 500', (SELECT id FROM instrument_segments WHERE name='indices'), 'US500', 'USD', 1, 0.1),
    ('NAS100', 'NASDAQ 100', (SELECT id FROM instrument_segments WHERE name='indices'), 'NAS100', 'USD', 1, 0.1),
    ('BTCUSD', 'Bitcoin / US Dollar', (SELECT id FROM instrument_segments WHERE name='crypto'), 'BTC', 'USD', 2, 0.01),
    ('ETHUSD', 'Ethereum / US Dollar', (SELECT id FROM instrument_segments WHERE name='crypto'), 'ETH', 'USD', 2, 0.01),
    ('LTCUSD', 'Litecoin / US Dollar', (SELECT id FROM instrument_segments WHERE name='crypto'), 'LTC', 'USD', 2, 0.01),
    ('XRPUSD', 'Ripple / US Dollar', (SELECT id FROM instrument_segments WHERE name='crypto'), 'XRP', 'USD', 4, 0.0001),
    ('SOLUSD', 'Solana / US Dollar', (SELECT id FROM instrument_segments WHERE name='crypto'), 'SOL', 'USD', 2, 0.01),
    ('EURCHF', 'Euro / Swiss Franc', (SELECT id FROM instrument_segments WHERE name='forex'), 'EUR', 'CHF', 5, 0.0001),
    ('GBPCHF', 'British Pound / Swiss Franc', (SELECT id FROM instrument_segments WHERE name='forex'), 'GBP', 'CHF', 5, 0.0001),
    ('AUDJPY', 'Australian Dollar / Japanese Yen', (SELECT id FROM instrument_segments WHERE name='forex'), 'AUD', 'JPY', 3, 0.01),
    ('CADJPY', 'Canadian Dollar / Japanese Yen', (SELECT id FROM instrument_segments WHERE name='forex'), 'CAD', 'JPY', 3, 0.01),
    ('NZDJPY', 'New Zealand Dollar / Japanese Yen', (SELECT id FROM instrument_segments WHERE name='forex'), 'NZD', 'JPY', 3, 0.01),
    ('USDHKD', 'US Dollar / Hong Kong Dollar', (SELECT id FROM instrument_segments WHERE name='forex'), 'USD', 'HKD', 5, 0.0001),
    ('UK100', 'FTSE 100', (SELECT id FROM instrument_segments WHERE name='indices'), 'UK100', 'GBP', 1, 0.1),
    ('GER40', 'DAX 40', (SELECT id FROM instrument_segments WHERE name='indices'), 'GER40', 'EUR', 1, 0.1),
    ('XPTUSD', 'Platinum / US Dollar', (SELECT id FROM instrument_segments WHERE name='commodities'), 'XPT', 'USD', 2, 0.01),
    ('NATGAS', 'Natural Gas', (SELECT id FROM instrument_segments WHERE name='energies'), 'NG', 'USD', 3, 0.001),
    ('UKOIL', 'Brent Crude Oil', (SELECT id FROM instrument_segments WHERE name='energies'), 'OIL', 'USD', 2, 0.01),
    ('BNBUSD', 'Binance Coin / US Dollar', (SELECT id FROM instrument_segments WHERE name='crypto'), 'BNB', 'USD', 2, 0.01),
    ('DOGEUSD', 'Dogecoin / US Dollar', (SELECT id FROM instrument_segments WHERE name='crypto'), 'DOGE', 'USD', 5, 0.00001),
    ('ADAUSD', 'Cardano / US Dollar', (SELECT id FROM instrument_segments WHERE name='crypto'), 'ADA', 'USD', 4, 0.0001),
    ('AUDCAD', 'Australian Dollar / Canadian Dollar', (SELECT id FROM instrument_segments WHERE name='forex'), 'AUD', 'CAD', 5, 0.0001),
    ('AUDCHF', 'Australian Dollar / Swiss Franc', (SELECT id FROM instrument_segments WHERE name='forex'), 'AUD', 'CHF', 5, 0.0001),
    ('AUDNZD', 'Australian Dollar / NZ Dollar', (SELECT id FROM instrument_segments WHERE name='forex'), 'AUD', 'NZD', 5, 0.0001),
    ('CADCHF', 'Canadian Dollar / Swiss Franc', (SELECT id FROM instrument_segments WHERE name='forex'), 'CAD', 'CHF', 5, 0.0001),
    ('CHFJPY', 'Swiss Franc / Japanese Yen', (SELECT id FROM instrument_segments WHERE name='forex'), 'CHF', 'JPY', 3, 0.01),
    ('EURAUD', 'Euro / Australian Dollar', (SELECT id FROM instrument_segments WHERE name='forex'), 'EUR', 'AUD', 5, 0.0001),
    ('EURCAD', 'Euro / Canadian Dollar', (SELECT id FROM instrument_segments WHERE name='forex'), 'EUR', 'CAD', 5, 0.0001),
    ('EURNZD', 'Euro / NZ Dollar', (SELECT id FROM instrument_segments WHERE name='forex'), 'EUR', 'NZD', 5, 0.0001),
    ('GBPAUD', 'British Pound / Australian Dollar', (SELECT id FROM instrument_segments WHERE name='forex'), 'GBP', 'AUD', 5, 0.0001),
    ('GBPCAD', 'British Pound / Canadian Dollar', (SELECT id FROM instrument_segments WHERE name='forex'), 'GBP', 'CAD', 5, 0.0001),
    ('GBPNZD', 'British Pound / NZ Dollar', (SELECT id FROM instrument_segments WHERE name='forex'), 'GBP', 'NZD', 5, 0.0001),
    ('NZDCAD', 'NZ Dollar / Canadian Dollar', (SELECT id FROM instrument_segments WHERE name='forex'), 'NZD', 'CAD', 5, 0.0001),
    ('NZDCHF', 'NZ Dollar / Swiss Franc', (SELECT id FROM instrument_segments WHERE name='forex'), 'NZD', 'CHF', 5, 0.0001),
    ('US100', 'US Tech 100', (SELECT id FROM instrument_segments WHERE name='indices'), 'US100', 'USD', 1, 0.1),
    ('JPN225', 'Japan 225', (SELECT id FROM instrument_segments WHERE name='indices'), 'JPN225', 'JPY', 1, 1),
    ('AUS200', 'Australia 200', (SELECT id FROM instrument_segments WHERE name='indices'), 'AUS200', 'AUD', 1, 0.1),
    ('AAPL', 'Apple Inc.', (SELECT id FROM instrument_segments WHERE name='stocks'), 'AAPL', 'USD', 2, 0.01),
    ('TSLA', 'Tesla Inc.', (SELECT id FROM instrument_segments WHERE name='stocks'), 'TSLA', 'USD', 2, 0.01),
    ('AMZN', 'Amazon.com Inc.', (SELECT id FROM instrument_segments WHERE name='stocks'), 'AMZN', 'USD', 2, 0.01),
    ('GOOGL', 'Alphabet Inc.', (SELECT id FROM instrument_segments WHERE name='stocks'), 'GOOGL', 'USD', 2, 0.01),
    ('MSFT', 'Microsoft Corp.', (SELECT id FROM instrument_segments WHERE name='stocks'), 'MSFT', 'USD', 2, 0.01),
    ('META', 'Meta Platforms Inc.', (SELECT id FROM instrument_segments WHERE name='stocks'), 'META', 'USD', 2, 0.01),
    ('NVDA', 'Nvidia Corp.', (SELECT id FROM instrument_segments WHERE name='stocks'), 'NVDA', 'USD', 2, 0.01),
    ('NFLX', 'Netflix Inc.', (SELECT id FROM instrument_segments WHERE name='stocks'), 'NFLX', 'USD', 2, 0.01);

-- ─── Fix contract sizes (default 100000 is correct only for forex) ────────────
-- Precious metals: 100 oz per standard lot
UPDATE instruments SET contract_size = 100    WHERE symbol IN ('XAUUSD', 'XPTUSD');
-- Silver: 5000 oz per standard lot
UPDATE instruments SET contract_size = 5000   WHERE symbol = 'XAGUSD';
-- Energy: barrels / MMBtu per standard lot
UPDATE instruments SET contract_size = 1000   WHERE symbol IN ('USOIL', 'UKOIL');
UPDATE instruments SET contract_size = 10000  WHERE symbol = 'NATGAS';
-- Indices: 1 unit per lot  (P&L = lots × 1 × point_change)
UPDATE instruments SET contract_size = 1      WHERE symbol IN ('US30','US500','NAS100','UK100','GER40','US100','JPN225','AUS200');
-- Crypto major: 1 coin per lot
UPDATE instruments SET contract_size = 1      WHERE symbol IN ('BTCUSD','ETHUSD','LTCUSD','SOLUSD','BNBUSD');
-- Crypto small-price: 10000 units per lot  (keeps notional ~$3k-5k per lot)
UPDATE instruments SET contract_size = 10000  WHERE symbol IN ('XRPUSD','ADAUSD');
-- Micro-price crypto: keep 100000 default (DOGEUSD stays at 100000)
-- Stocks: 100 shares per lot
UPDATE instruments SET contract_size = 100    WHERE symbol IN ('AAPL','TSLA','AMZN','GOOGL','MSFT','META','NVDA','NFLX');

CREATE TABLE instrument_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    instrument_id UUID NOT NULL UNIQUE REFERENCES instruments(id) ON DELETE CASCADE,
    commission_value DECIMAL(18, 8),
    commission_type VARCHAR(30) NOT NULL DEFAULT 'per_lot',
    spread_value DECIMAL(18, 8),
    spread_type VARCHAR(20) NOT NULL DEFAULT 'pips',
    price_impact DECIMAL(18, 8) NOT NULL DEFAULT 0,
    swap_long DECIMAL(18, 8) DEFAULT 0,
    swap_short DECIMAL(18, 8) DEFAULT 0,
    swap_free BOOLEAN NOT NULL DEFAULT FALSE,
    min_lot_size DECIMAL(10, 4) DEFAULT 0.01,
    max_lot_size DECIMAL(10, 4) DEFAULT 100,
    leverage_max INT DEFAULT 2000,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID REFERENCES users(id)
);

CREATE INDEX idx_instrument_configs_instrument ON instrument_configs(instrument_id);

CREATE TABLE instrument_config_audit (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    instrument_id UUID NOT NULL REFERENCES instruments(id) ON DELETE CASCADE,
    field_changed VARCHAR(64) NOT NULL,
    old_value TEXT,
    new_value TEXT,
    changed_by UUID REFERENCES users(id),
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip_address VARCHAR(64)
);

CREATE INDEX idx_instrument_config_audit_inst ON instrument_config_audit(instrument_id);

-- ============================================
-- ORDERS & TRADES
-- ============================================

CREATE TYPE order_type AS ENUM ('market', 'limit', 'stop', 'stop_limit');
CREATE TYPE order_side AS ENUM ('buy', 'sell');
CREATE TYPE order_status AS ENUM ('pending', 'filled', 'partially_filled', 'cancelled', 'rejected', 'expired');
CREATE TYPE position_status AS ENUM ('open', 'closed', 'partially_closed');

CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID REFERENCES trading_accounts(id) ON DELETE CASCADE,
    instrument_id UUID REFERENCES instruments(id),
    order_type order_type NOT NULL,
    side order_side NOT NULL,
    status order_status DEFAULT 'pending',
    lots DECIMAL(10,4) NOT NULL,
    price DECIMAL(18,8),
    stop_loss DECIMAL(18,8),
    take_profit DECIMAL(18,8),
    stop_limit_price DECIMAL(18,8),
    filled_price DECIMAL(18,8),
    filled_at TIMESTAMPTZ,
    commission DECIMAL(18,8) DEFAULT 0,
    swap DECIMAL(18,8) DEFAULT 0,
    comment TEXT,
    is_admin_created BOOLEAN DEFAULT FALSE,
    admin_created_by UUID REFERENCES users(id),
    magic_number INT,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE positions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID REFERENCES trading_accounts(id) ON DELETE CASCADE,
    instrument_id UUID REFERENCES instruments(id),
    order_id UUID REFERENCES orders(id),
    side order_side NOT NULL,
    status position_status DEFAULT 'open',
    lots DECIMAL(10,4) NOT NULL,
    open_price DECIMAL(18,8) NOT NULL,
    close_price DECIMAL(18,8),
    stop_loss DECIMAL(18,8),
    take_profit DECIMAL(18,8),
    swap DECIMAL(18,8) DEFAULT 0,
    commission DECIMAL(18,8) DEFAULT 0,
    profit DECIMAL(18,8) DEFAULT 0,
    closed_at TIMESTAMPTZ,
    comment TEXT,
    is_admin_modified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE trade_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    position_id UUID REFERENCES positions(id),
    account_id UUID REFERENCES trading_accounts(id),
    instrument_id UUID REFERENCES instruments(id),
    side order_side NOT NULL,
    lots DECIMAL(10,4) NOT NULL,
    open_price DECIMAL(18,8) NOT NULL,
    close_price DECIMAL(18,8) NOT NULL,
    swap DECIMAL(18,8) DEFAULT 0,
    commission DECIMAL(18,8) DEFAULT 0,
    profit DECIMAL(18,8) NOT NULL,
    opened_at TIMESTAMPTZ NOT NULL,
    closed_at TIMESTAMPTZ NOT NULL,
    close_reason VARCHAR(20) DEFAULT 'manual'
);

-- ============================================
-- CHARGES / SPREAD / SWAP CONFIGURATION
-- ============================================

CREATE TABLE charge_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scope VARCHAR(20) NOT NULL CHECK (scope IN ('default', 'segment', 'instrument', 'user')),
    segment_id UUID REFERENCES instrument_segments(id),
    instrument_id UUID REFERENCES instruments(id),
    user_id UUID REFERENCES users(id),
    charge_type VARCHAR(30) NOT NULL CHECK (charge_type IN ('commission_per_lot', 'commission_per_trade', 'spread_percentage', 'commission_percentage')),
    value DECIMAL(18,8) NOT NULL,
    is_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE spread_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scope VARCHAR(20) NOT NULL CHECK (scope IN ('default', 'segment', 'instrument', 'user')),
    segment_id UUID REFERENCES instrument_segments(id),
    instrument_id UUID REFERENCES instruments(id),
    user_id UUID REFERENCES users(id),
    spread_type VARCHAR(20) NOT NULL CHECK (spread_type IN ('fixed', 'variable', 'pips', 'percentage')),
    value DECIMAL(18,8) NOT NULL,
    is_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE swap_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scope VARCHAR(20) NOT NULL CHECK (scope IN ('default', 'segment', 'instrument', 'user')),
    segment_id UUID REFERENCES instrument_segments(id),
    instrument_id UUID REFERENCES instruments(id),
    user_id UUID REFERENCES users(id),
    swap_long DECIMAL(18,8) DEFAULT 0,
    swap_short DECIMAL(18,8) DEFAULT 0,
    triple_swap_day INT DEFAULT 3,
    swap_free BOOLEAN DEFAULT FALSE,
    is_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- WALLET / DEPOSITS / WITHDRAWALS
-- ============================================

CREATE TABLE bank_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_name VARCHAR(100),
    account_number VARCHAR(50),
    bank_name VARCHAR(100),
    ifsc_code VARCHAR(20),
    upi_id VARCHAR(100),
    qr_code_url TEXT,
    tier INT DEFAULT 1,
    min_amount DECIMAL(18,2) DEFAULT 0,
    max_amount DECIMAL(18,2) DEFAULT 999999999,
    is_active BOOLEAN DEFAULT TRUE,
    rotation_order INT DEFAULT 0,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE deposits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    account_id UUID REFERENCES trading_accounts(id),
    amount DECIMAL(18,8) NOT NULL,
    currency VARCHAR(10) DEFAULT 'INR',
    method VARCHAR(30) CHECK (method IN ('bank_transfer', 'upi', 'qr', 'crypto_btc', 'crypto_eth', 'crypto_usdt', 'metamask', 'oxapay', 'manual')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'auto_approved', 'initiated')),
    transaction_id VARCHAR(100),
    screenshot_url TEXT,
    bank_account_id UUID REFERENCES bank_accounts(id),
    crypto_tx_hash VARCHAR(200),
    crypto_address VARCHAR(200),
    rejection_reason TEXT,
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE withdrawals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    account_id UUID REFERENCES trading_accounts(id),
    amount DECIMAL(18,8) NOT NULL,
    currency VARCHAR(10) DEFAULT 'INR',
    method VARCHAR(30) CHECK (method IN ('bank_transfer', 'upi', 'qr', 'crypto_btc', 'crypto_eth', 'crypto_usdt', 'metamask', 'oxapay', 'manual')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'processing', 'completed')),
    bank_details JSONB,
    crypto_address VARCHAR(200),
    crypto_tx_hash VARCHAR(200),
    rejection_reason TEXT,
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    account_id UUID REFERENCES trading_accounts(id),
    type VARCHAR(30) NOT NULL CHECK (type IN ('deposit', 'withdrawal', 'commission', 'swap', 'bonus', 'credit', 'adjustment', 'ib_commission', 'profit', 'loss', 'transfer', 'admin_commission', 'performance_fee', 'master_commission', 'refund')),
    amount DECIMAL(18,8) NOT NULL,
    balance_after DECIMAL(18,8),
    reference_id UUID,
    description TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- IB / SUB-BROKER / MLM
-- ============================================

CREATE TABLE ib_applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    application_data JSONB,
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ib_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) UNIQUE,
    referral_code VARCHAR(20) UNIQUE NOT NULL,
    parent_ib_id UUID REFERENCES ib_profiles(id),
    level INT DEFAULT 1,
    commission_plan_id UUID,
    total_earned DECIMAL(18,8) DEFAULT 0,
    pending_payout DECIMAL(18,8) DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    custom_commission_per_lot DECIMAL(18,8),
    custom_commission_per_trade DECIMAL(18,8),
    rejection_reason TEXT,
    rejected_at TIMESTAMPTZ,
    rejected_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ib_commission_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100),
    is_default BOOLEAN DEFAULT FALSE,
    commission_per_lot DECIMAL(18,8) DEFAULT 0,
    commission_per_trade DECIMAL(18,8) DEFAULT 0,
    spread_share_pct DECIMAL(5,2) DEFAULT 0,
    cpa_per_deposit DECIMAL(18,8) DEFAULT 0,
    mlm_levels INT DEFAULT 5,
    mlm_distribution JSONB DEFAULT '[40, 25, 15, 10, 10]',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ib_commissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ib_id UUID REFERENCES ib_profiles(id),
    source_user_id UUID REFERENCES users(id),
    source_trade_id UUID REFERENCES orders(id),
    commission_type VARCHAR(30),
    amount DECIMAL(18,8) NOT NULL,
    mlm_level INT DEFAULT 1,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE referrals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    referrer_id UUID REFERENCES users(id),
    referred_id UUID REFERENCES users(id),
    ib_profile_id UUID REFERENCES ib_profiles(id),
    utm_source VARCHAR(100),
    utm_medium VARCHAR(100),
    utm_campaign VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SOCIAL TRADING / MAMM / PAMM
-- ============================================

CREATE TABLE master_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    account_id UUID REFERENCES trading_accounts(id),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'active', 'suspended')),
    master_type VARCHAR(20) CHECK (master_type IN ('pamm', 'mamm', 'signal_provider')),
    performance_fee_pct DECIMAL(5,2) DEFAULT 20,
    management_fee_pct DECIMAL(5,2) DEFAULT 0,
    admin_commission_pct DECIMAL(5,2) DEFAULT 0,
    max_investors INT DEFAULT 100,
    description TEXT,
    min_investment DECIMAL(18,8) DEFAULT 100,
    total_return_pct DECIMAL(10,4) DEFAULT 0,
    max_drawdown_pct DECIMAL(10,4) DEFAULT 0,
    sharpe_ratio DECIMAL(10,4) DEFAULT 0,
    followers_count INT DEFAULT 0,
    total_fee_earned DECIMAL(18,8) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE investor_allocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    master_id UUID REFERENCES master_accounts(id),
    investor_user_id UUID REFERENCES users(id),
    investor_account_id UUID REFERENCES trading_accounts(id),
    copy_type VARCHAR(20) DEFAULT 'signal' CHECK (copy_type IN ('signal', 'pamm', 'mam')),
    allocation_amount DECIMAL(18,8) NOT NULL,
    allocation_pct DECIMAL(5,2),
    max_drawdown_pct DECIMAL(5,2),
    max_lot_override DECIMAL(10,4),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('pending', 'active', 'paused', 'closed', 'withdrawn', 'rejected', 'stopped')),
    total_profit DECIMAL(18,8) DEFAULT 0,
    last_distribution_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE copy_trades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    master_position_id UUID REFERENCES positions(id),
    investor_allocation_id UUID REFERENCES investor_allocations(id),
    investor_position_id UUID REFERENCES positions(id),
    ratio DECIMAL(10,4) DEFAULT 1,
    status VARCHAR(20) DEFAULT 'open',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- BONUS
-- ============================================

CREATE TABLE bonus_offers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    bonus_type VARCHAR(30) CHECK (bonus_type IN ('deposit', 'welcome', 'volume', 'custom')),
    percentage DECIMAL(5,2),
    fixed_amount DECIMAL(18,8),
    min_deposit DECIMAL(18,8) DEFAULT 0,
    max_bonus DECIMAL(18,8),
    lots_required DECIMAL(10,4) DEFAULT 0,
    target_audience VARCHAR(30) DEFAULT 'all',
    starts_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_bonuses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    account_id UUID REFERENCES trading_accounts(id),
    offer_id UUID REFERENCES bonus_offers(id),
    amount DECIMAL(18,8) NOT NULL,
    lots_traded DECIMAL(10,4) DEFAULT 0,
    lots_required DECIMAL(10,4) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'released', 'expired', 'cancelled')),
    released_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- BANNERS
-- ============================================

CREATE TABLE banners (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(200),
    image_url TEXT NOT NULL,
    link_url TEXT,
    target_page VARCHAR(30) DEFAULT 'dashboard',
    position VARCHAR(20) DEFAULT 'top' CHECK (position IN ('top', 'sidebar', 'popup')),
    target_audience VARCHAR(30) DEFAULT 'all',
    priority INT DEFAULT 0,
    starts_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    click_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SUPPORT
-- ============================================

CREATE TABLE support_tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    subject VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'escalated', 'closed')),
    priority VARCHAR(10) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    assigned_to UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ticket_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id UUID REFERENCES support_tickets(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES users(id),
    message TEXT NOT NULL,
    attachments JSONB,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- NOTIFICATIONS
-- ============================================

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    title VARCHAR(200),
    message TEXT,
    type VARCHAR(30) DEFAULT 'info' CHECK (type IN ('info', 'warning', 'error', 'success', 'trade', 'deposit', 'withdrawal', 'margin_call')),
    is_read BOOLEAN DEFAULT FALSE,
    action_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ADMIN / EMPLOYEES / AUDIT
-- ============================================

CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) UNIQUE,
    role VARCHAR(30) NOT NULL CHECK (role IN ('super_admin', 'trade_manager', 'support', 'finance', 'risk_manager', 'marketing')),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action_type VARCHAR(80) NOT NULL,
    ip_address VARCHAR(64),
    device_info TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_audit_logs_user ON user_audit_logs(user_id);
CREATE INDEX idx_user_audit_logs_action ON user_audit_logs(action_type);
CREATE INDEX idx_user_audit_logs_created ON user_audit_logs(created_at DESC);

-- ============================================
-- SYSTEM SETTINGS
-- ============================================

CREATE TABLE system_settings (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_by UUID REFERENCES users(id),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO system_settings (key, value, description) VALUES
    ('default_leverage', '100', 'Default leverage for new accounts'),
    ('margin_call_level', '80', 'Margin call warning level (%)'),
    ('stop_out_level', '50', 'Stop-out level (%)'),
    ('max_open_trades', '200', 'Max open trades per account'),
    ('maintenance_mode', 'false', 'Platform maintenance mode'),
    ('auto_approve_deposit_threshold', '0', 'Auto-approve deposits below this amount (0=disabled)'),
    ('mlm_levels', '5', 'Number of MLM levels for IB'),
    ('mlm_distribution', '[40, 25, 15, 10, 10]', 'MLM distribution per level (%)');

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_trading_accounts_user ON trading_accounts(user_id);
CREATE INDEX idx_orders_account ON orders(account_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_instrument ON orders(instrument_id);
CREATE INDEX idx_positions_account ON positions(account_id);
CREATE INDEX idx_positions_status ON positions(status);
CREATE INDEX idx_positions_instrument ON positions(instrument_id);
CREATE INDEX idx_deposits_user ON deposits(user_id);
CREATE INDEX idx_deposits_status ON deposits(status);
CREATE INDEX idx_withdrawals_user ON withdrawals(user_id);
CREATE INDEX idx_withdrawals_status ON withdrawals(status);
CREATE INDEX idx_transactions_user ON transactions(user_id);
CREATE INDEX idx_transactions_account ON transactions(account_id);
CREATE INDEX idx_ib_profiles_user ON ib_profiles(user_id);
CREATE INDEX idx_ib_profiles_parent ON ib_profiles(parent_ib_id);
CREATE INDEX idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX idx_referrals_referred ON referrals(referred_id);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(user_id, is_read);
CREATE INDEX idx_audit_logs_admin ON audit_logs(admin_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_trade_history_account ON trade_history(account_id);

-- Existing DBs created before copy_type: run once if column is missing:
-- ALTER TABLE investor_allocations ADD COLUMN IF NOT EXISTS copy_type VARCHAR(20) DEFAULT 'signal';

-- Seed default account groups
INSERT INTO account_groups (name, description, leverage_default, is_demo) VALUES
    ('Standard', 'Standard trading account', 100, FALSE),
    ('ECN', 'ECN account with raw spreads', 200, FALSE),
    ('VIP', 'VIP account with premium conditions', 500, FALSE),
    ('Cent', 'Cent account for beginners', 500, FALSE),
    ('Islamic', 'Swap-free Islamic account', 100, FALSE),
    ('Demo', 'Demo practice account', 100, TRUE);

-- Seed super admin (password: Proline MarketsAdmin2025! — change in production)
INSERT INTO users (email, password_hash, first_name, last_name, role, status, kyc_status)
VALUES ('admin@Proline Markets.com', '$2b$12$OV1PUf7jA8E22RQ184o0n.KkEjbSriZbLaDqO4SJGj/bjleK37Zh2', 'Super', 'Admin', 'super_admin', 'active', 'approved');
