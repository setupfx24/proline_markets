"""Initial baseline — stamps existing init-db.sql schema.

All tables already exist in the database via init-db.sql.
This migration creates them declaratively so future autogenerate
diffs work correctly.  Run with --sql to review, or just
`alembic stamp head` on an existing database.

Revision ID: 0001
Revises:
Create Date: 2026-04-06 00:00:00.000000+00:00
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- ENUMS (create_type=False in models, so they must exist in DB) ---
    order_type = postgresql.ENUM("market", "limit", "stop", "stop_limit", name="order_type", create_type=False)
    order_side = postgresql.ENUM("buy", "sell", name="order_side", create_type=False)
    order_status = postgresql.ENUM("pending", "filled", "partially_filled", "cancelled", "rejected", "expired", name="order_status", create_type=False)
    position_status = postgresql.ENUM("open", "closed", "partially_closed", name="position_status", create_type=False)

    # Create enums first
    op.execute("DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_type') THEN CREATE TYPE order_type AS ENUM ('market','limit','stop','stop_limit'); END IF; END $$;")
    op.execute("DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_side') THEN CREATE TYPE order_side AS ENUM ('buy','sell'); END IF; END $$;")
    op.execute("DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN CREATE TYPE order_status AS ENUM ('pending','filled','partially_filled','cancelled','rejected','expired'); END IF; END $$;")
    op.execute("DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'position_status') THEN CREATE TYPE position_status AS ENUM ('open','closed','partially_closed'); END IF; END $$;")

    # --- TABLES (idempotent: skipped if they already exist) ---
    # Using raw SQL with IF NOT EXISTS so this migration is safe on both
    # fresh databases AND existing databases bootstrapped by init-db.sql.

    op.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        phone VARCHAR(20),
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        date_of_birth TIMESTAMP,
        country VARCHAR(100),
        address TEXT,
        role VARCHAR(20) DEFAULT 'user',
        status VARCHAR(20) DEFAULT 'active',
        kyc_status VARCHAR(20) DEFAULT 'pending',
        is_demo BOOLEAN DEFAULT FALSE,
        two_factor_enabled BOOLEAN DEFAULT FALSE,
        two_factor_secret VARCHAR(255),
        language VARCHAR(10) DEFAULT 'en',
        theme VARCHAR(10) DEFAULT 'dark',
        trading_blocked_until TIMESTAMPTZ,
        main_wallet_balance NUMERIC(18,8) NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
    );
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS user_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        token_hash VARCHAR(255) NOT NULL,
        ip_address INET,
        user_agent TEXT,
        device_info JSONB,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT now(),
        expires_at TIMESTAMPTZ NOT NULL
    );
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash VARCHAR(255) NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        used BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT now()
    );
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS user_refresh_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash VARCHAR(255) NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        revoked BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT now()
    );
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS kyc_documents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        document_type VARCHAR(30) NOT NULL,
        file_url TEXT NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        rejection_reason TEXT,
        reviewed_by UUID REFERENCES users(id),
        reviewed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT now()
    );
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS account_groups (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(50) NOT NULL,
        description TEXT,
        leverage_default INTEGER DEFAULT 100,
        spread_markup_default NUMERIC(10,5) DEFAULT 0,
        commission_default NUMERIC(10,5) DEFAULT 0,
        minimum_deposit NUMERIC(18,8) DEFAULT 0,
        swap_free BOOLEAN DEFAULT FALSE,
        is_demo BOOLEAN DEFAULT FALSE,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT now()
    );
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS trading_accounts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        account_group_id UUID REFERENCES account_groups(id),
        account_number VARCHAR(20) UNIQUE NOT NULL,
        balance NUMERIC(18,8) DEFAULT 0,
        credit NUMERIC(18,8) DEFAULT 0,
        equity NUMERIC(18,8) DEFAULT 0,
        margin_used NUMERIC(18,8) DEFAULT 0,
        free_margin NUMERIC(18,8) DEFAULT 0,
        margin_level NUMERIC(10,4) DEFAULT 0,
        leverage INTEGER DEFAULT 100,
        currency VARCHAR(5) DEFAULT 'USD',
        is_demo BOOLEAN DEFAULT FALSE,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
    );
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS instrument_segments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(50) UNIQUE NOT NULL,
        display_name VARCHAR(100),
        is_active BOOLEAN DEFAULT TRUE
    );
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS instruments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        symbol VARCHAR(20) UNIQUE NOT NULL,
        display_name VARCHAR(100),
        segment_id UUID REFERENCES instrument_segments(id),
        base_currency VARCHAR(10),
        quote_currency VARCHAR(10),
        digits INTEGER DEFAULT 5,
        pip_size NUMERIC(10,8) DEFAULT 0.0001,
        lot_size INTEGER DEFAULT 100000,
        min_lot NUMERIC(10,4) DEFAULT 0.01,
        max_lot NUMERIC(10,4) DEFAULT 100,
        lot_step NUMERIC(10,4) DEFAULT 0.01,
        contract_size NUMERIC(18,4) DEFAULT 100000,
        margin_rate NUMERIC(10,6) DEFAULT 0.01,
        trading_hours JSONB,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
    );
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS instrument_configs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        instrument_id UUID UNIQUE NOT NULL REFERENCES instruments(id) ON DELETE CASCADE,
        commission_value NUMERIC(18,8),
        commission_type VARCHAR(30) NOT NULL DEFAULT 'per_lot',
        spread_value NUMERIC(18,8),
        spread_type VARCHAR(20) NOT NULL DEFAULT 'pips',
        price_impact NUMERIC(18,8) NOT NULL DEFAULT 0,
        swap_long NUMERIC(18,8) DEFAULT 0,
        swap_short NUMERIC(18,8) DEFAULT 0,
        swap_free BOOLEAN NOT NULL DEFAULT FALSE,
        min_lot_size NUMERIC(10,4) DEFAULT 0.01,
        max_lot_size NUMERIC(10,4) DEFAULT 100,
        leverage_max INTEGER DEFAULT 2000,
        is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
        updated_at TIMESTAMPTZ DEFAULT now(),
        updated_by UUID REFERENCES users(id)
    );
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS instrument_config_audit (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        instrument_id UUID NOT NULL REFERENCES instruments(id) ON DELETE CASCADE,
        field_changed VARCHAR(64) NOT NULL,
        old_value TEXT,
        new_value TEXT,
        changed_by UUID REFERENCES users(id),
        changed_at TIMESTAMPTZ DEFAULT now(),
        ip_address VARCHAR(64)
    );
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS orders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id UUID REFERENCES trading_accounts(id) ON DELETE CASCADE,
        instrument_id UUID REFERENCES instruments(id),
        order_type order_type NOT NULL,
        side order_side NOT NULL,
        status order_status DEFAULT 'pending',
        lots NUMERIC(10,4) NOT NULL,
        price NUMERIC(18,8),
        stop_loss NUMERIC(18,8),
        take_profit NUMERIC(18,8),
        stop_limit_price NUMERIC(18,8),
        filled_price NUMERIC(18,8),
        filled_at TIMESTAMPTZ,
        commission NUMERIC(18,8) DEFAULT 0,
        swap NUMERIC(18,8) DEFAULT 0,
        comment TEXT,
        is_admin_created BOOLEAN DEFAULT FALSE,
        admin_created_by UUID REFERENCES users(id),
        magic_number INTEGER,
        expires_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
    );
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS positions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id UUID REFERENCES trading_accounts(id) ON DELETE CASCADE,
        instrument_id UUID REFERENCES instruments(id),
        order_id UUID REFERENCES orders(id),
        side order_side NOT NULL,
        status position_status DEFAULT 'open',
        lots NUMERIC(10,4) NOT NULL,
        open_price NUMERIC(18,8) NOT NULL,
        close_price NUMERIC(18,8),
        stop_loss NUMERIC(18,8),
        take_profit NUMERIC(18,8),
        swap NUMERIC(18,8) DEFAULT 0,
        commission NUMERIC(18,8) DEFAULT 0,
        profit NUMERIC(18,8) DEFAULT 0,
        closed_at TIMESTAMPTZ,
        comment TEXT,
        is_admin_modified BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
    );
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS bank_accounts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_name VARCHAR(100),
        account_number VARCHAR(50),
        bank_name VARCHAR(100),
        ifsc_code VARCHAR(20),
        upi_id VARCHAR(100),
        qr_code_url TEXT,
        tier INTEGER DEFAULT 1,
        min_amount NUMERIC(18,2) DEFAULT 0,
        max_amount NUMERIC(18,2) DEFAULT 999999999,
        is_active BOOLEAN DEFAULT TRUE,
        rotation_order INTEGER DEFAULT 0,
        last_used_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT now()
    );
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS deposits (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        account_id UUID REFERENCES trading_accounts(id),
        amount NUMERIC(18,8) NOT NULL,
        currency VARCHAR(10) DEFAULT 'USD',
        method VARCHAR(30),
        status VARCHAR(20) DEFAULT 'pending',
        transaction_id VARCHAR(100),
        screenshot_url TEXT,
        bank_account_id UUID REFERENCES bank_accounts(id),
        crypto_tx_hash VARCHAR(200),
        crypto_address VARCHAR(200),
        rejection_reason TEXT,
        approved_by UUID REFERENCES users(id),
        approved_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT now()
    );
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS withdrawals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        account_id UUID REFERENCES trading_accounts(id),
        amount NUMERIC(18,8) NOT NULL,
        currency VARCHAR(10) DEFAULT 'USD',
        method VARCHAR(30),
        status VARCHAR(20) DEFAULT 'pending',
        bank_details JSONB,
        crypto_address VARCHAR(200),
        crypto_tx_hash VARCHAR(200),
        rejection_reason TEXT,
        approved_by UUID REFERENCES users(id),
        approved_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT now()
    );
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        account_id UUID REFERENCES trading_accounts(id),
        type VARCHAR(30) NOT NULL,
        amount NUMERIC(18,8) NOT NULL,
        balance_after NUMERIC(18,8),
        reference_id UUID,
        description TEXT,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT now()
    );
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS charge_configs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        scope VARCHAR(20) NOT NULL,
        segment_id UUID REFERENCES instrument_segments(id),
        instrument_id UUID REFERENCES instruments(id),
        user_id UUID REFERENCES users(id),
        charge_type VARCHAR(30) NOT NULL,
        value NUMERIC(18,8) NOT NULL,
        is_enabled BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
    );
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS spread_configs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        scope VARCHAR(20) NOT NULL,
        segment_id UUID REFERENCES instrument_segments(id),
        instrument_id UUID REFERENCES instruments(id),
        user_id UUID REFERENCES users(id),
        spread_type VARCHAR(20) NOT NULL,
        value NUMERIC(18,8) NOT NULL,
        is_enabled BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
    );
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS swap_configs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        scope VARCHAR(20) NOT NULL,
        segment_id UUID REFERENCES instrument_segments(id),
        instrument_id UUID REFERENCES instruments(id),
        user_id UUID REFERENCES users(id),
        swap_long NUMERIC(18,8) DEFAULT 0,
        swap_short NUMERIC(18,8) DEFAULT 0,
        triple_swap_day INTEGER DEFAULT 3,
        swap_free BOOLEAN DEFAULT FALSE,
        is_enabled BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
    );
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS ib_profiles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID UNIQUE REFERENCES users(id),
        referral_code VARCHAR(20) UNIQUE NOT NULL,
        parent_ib_id UUID REFERENCES ib_profiles(id),
        level INTEGER DEFAULT 1,
        commission_plan_id UUID,
        custom_commission_per_lot NUMERIC(18,8),
        custom_commission_per_trade NUMERIC(18,8),
        total_earned NUMERIC(18,8) DEFAULT 0,
        pending_payout NUMERIC(18,8) DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        rejection_reason TEXT,
        rejected_at TIMESTAMPTZ,
        rejected_by UUID REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT now()
    );
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS master_accounts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        account_id UUID REFERENCES trading_accounts(id),
        status VARCHAR(20) DEFAULT 'pending',
        master_type VARCHAR(20),
        performance_fee_pct NUMERIC(5,2) DEFAULT 20,
        management_fee_pct NUMERIC(5,2) DEFAULT 0,
        admin_commission_pct NUMERIC(5,2) DEFAULT 0,
        max_investors INTEGER DEFAULT 100,
        description TEXT,
        min_investment NUMERIC(18,8) DEFAULT 100,
        total_return_pct NUMERIC(10,4) DEFAULT 0,
        max_drawdown_pct NUMERIC(10,4) DEFAULT 0,
        sharpe_ratio NUMERIC(10,4) DEFAULT 0,
        followers_count INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT now()
    );
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS support_tickets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        subject VARCHAR(255) NOT NULL,
        status VARCHAR(20) DEFAULT 'open',
        priority VARCHAR(10) DEFAULT 'medium',
        assigned_to UUID REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
    );
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        title VARCHAR(200),
        message TEXT,
        type VARCHAR(30) DEFAULT 'info',
        is_read BOOLEAN DEFAULT FALSE,
        action_url TEXT,
        created_at TIMESTAMPTZ DEFAULT now()
    );
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        admin_id UUID REFERENCES users(id),
        action VARCHAR(100) NOT NULL,
        entity_type VARCHAR(50),
        entity_id UUID,
        old_values JSONB,
        new_values JSONB,
        ip_address INET,
        created_at TIMESTAMPTZ DEFAULT now()
    );
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS user_audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id),
        action_type VARCHAR(80) NOT NULL,
        ip_address VARCHAR(64),
        device_info TEXT,
        created_at TIMESTAMPTZ DEFAULT now()
    );
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS banners (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(200),
        image_url TEXT NOT NULL,
        link_url TEXT,
        target_page VARCHAR(30) DEFAULT 'dashboard',
        position VARCHAR(20) DEFAULT 'top',
        target_audience VARCHAR(30) DEFAULT 'all',
        priority INTEGER DEFAULT 0,
        starts_at TIMESTAMPTZ,
        ends_at TIMESTAMPTZ,
        is_active BOOLEAN DEFAULT TRUE,
        click_count INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT now()
    );
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS ip_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        ip_address INET NOT NULL,
        action VARCHAR(50),
        user_agent TEXT,
        created_at TIMESTAMPTZ DEFAULT now()
    );
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS trade_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        position_id UUID REFERENCES positions(id),
        account_id UUID REFERENCES trading_accounts(id),
        instrument_id UUID REFERENCES instruments(id),
        side order_side NOT NULL,
        lots NUMERIC(10,4) NOT NULL,
        open_price NUMERIC(18,8) NOT NULL,
        close_price NUMERIC(18,8) NOT NULL,
        swap NUMERIC(18,8) DEFAULT 0,
        commission NUMERIC(18,8) DEFAULT 0,
        profit NUMERIC(18,8) NOT NULL,
        opened_at TIMESTAMPTZ NOT NULL,
        closed_at TIMESTAMPTZ NOT NULL,
        close_reason VARCHAR(20) DEFAULT 'manual'
    );
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS ib_applications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        status VARCHAR(20) DEFAULT 'pending',
        application_data JSONB,
        approved_by UUID REFERENCES users(id),
        approved_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT now()
    );
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS ib_commission_plans (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100),
        is_default BOOLEAN DEFAULT FALSE,
        commission_per_lot NUMERIC(18,8) DEFAULT 0,
        commission_per_trade NUMERIC(18,8) DEFAULT 0,
        spread_share_pct NUMERIC(5,2) DEFAULT 0,
        cpa_per_deposit NUMERIC(18,8) DEFAULT 0,
        mlm_levels INTEGER DEFAULT 5,
        mlm_distribution JSONB DEFAULT '[40,25,15,10,10]',
        created_at TIMESTAMPTZ DEFAULT now()
    );
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS ib_commissions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ib_id UUID REFERENCES ib_profiles(id),
        source_user_id UUID REFERENCES users(id),
        source_trade_id UUID REFERENCES orders(id),
        commission_type VARCHAR(30),
        amount NUMERIC(18,8) NOT NULL,
        mlm_level INTEGER DEFAULT 1,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMPTZ DEFAULT now()
    );
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS referrals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        referrer_id UUID REFERENCES users(id),
        referred_id UUID REFERENCES users(id),
        ib_profile_id UUID REFERENCES ib_profiles(id),
        utm_source VARCHAR(100),
        utm_medium VARCHAR(100),
        utm_campaign VARCHAR(100),
        created_at TIMESTAMPTZ DEFAULT now()
    );
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS investor_allocations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        master_id UUID REFERENCES master_accounts(id),
        investor_user_id UUID REFERENCES users(id),
        investor_account_id UUID REFERENCES trading_accounts(id),
        copy_type VARCHAR(20) DEFAULT 'signal',
        allocation_amount NUMERIC(18,8) NOT NULL,
        allocation_pct NUMERIC(5,2),
        max_drawdown_pct NUMERIC(5,2),
        max_lot_override NUMERIC(10,4),
        status VARCHAR(20) DEFAULT 'active',
        total_profit NUMERIC(18,8) DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT now()
    );
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS copy_trades (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        master_position_id UUID REFERENCES positions(id),
        investor_allocation_id UUID REFERENCES investor_allocations(id),
        investor_position_id UUID REFERENCES positions(id),
        ratio NUMERIC(10,4) DEFAULT 1,
        status VARCHAR(20) DEFAULT 'open',
        created_at TIMESTAMPTZ DEFAULT now()
    );
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS bonus_offers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        bonus_type VARCHAR(30),
        percentage NUMERIC(5,2),
        fixed_amount NUMERIC(18,8),
        min_deposit NUMERIC(18,8) DEFAULT 0,
        max_bonus NUMERIC(18,8),
        lots_required NUMERIC(10,4) DEFAULT 0,
        target_audience VARCHAR(30) DEFAULT 'all',
        starts_at TIMESTAMPTZ,
        expires_at TIMESTAMPTZ,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT now()
    );
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS user_bonuses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        account_id UUID REFERENCES trading_accounts(id),
        offer_id UUID REFERENCES bonus_offers(id),
        amount NUMERIC(18,8) NOT NULL,
        lots_traded NUMERIC(10,4) DEFAULT 0,
        lots_required NUMERIC(10,4) DEFAULT 0,
        status VARCHAR(20) DEFAULT 'active',
        released_at TIMESTAMPTZ,
        expires_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT now()
    );
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS ticket_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ticket_id UUID REFERENCES support_tickets(id) ON DELETE CASCADE,
        sender_id UUID REFERENCES users(id),
        message TEXT NOT NULL,
        attachments JSONB,
        is_admin BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT now()
    );
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS employees (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID UNIQUE REFERENCES users(id),
        role VARCHAR(30) NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT now()
    );
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS system_settings (
        key VARCHAR(100) PRIMARY KEY,
        value JSONB NOT NULL,
        description TEXT,
        updated_by UUID REFERENCES users(id),
        updated_at TIMESTAMPTZ DEFAULT now()
    );
    """)

    # --- INDEXES ---
    op.execute("CREATE INDEX IF NOT EXISTS ix_users_email ON users(email);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_instruments_symbol ON instruments(symbol);")


def downgrade() -> None:
    tables = [
        "system_settings", "employees", "ticket_messages", "user_bonuses",
        "bonus_offers", "copy_trades", "investor_allocations", "referrals",
        "ib_commissions", "ib_commission_plans", "ib_applications",
        "trade_history", "ip_logs", "banners", "user_audit_logs",
        "audit_logs", "notifications", "support_tickets", "master_accounts",
        "ib_profiles", "swap_configs", "spread_configs", "charge_configs",
        "transactions", "withdrawals", "deposits", "bank_accounts",
        "positions", "orders", "instrument_config_audit", "instrument_configs",
        "instruments", "instrument_segments", "trading_accounts",
        "account_groups", "kyc_documents", "user_refresh_tokens",
        "password_reset_tokens", "user_sessions", "users",
    ]
    for t in tables:
        op.execute(f"DROP TABLE IF EXISTS {t} CASCADE;")
    for e in ("position_status", "order_status", "order_side", "order_type"):
        op.execute(f"DROP TYPE IF EXISTS {e};")
