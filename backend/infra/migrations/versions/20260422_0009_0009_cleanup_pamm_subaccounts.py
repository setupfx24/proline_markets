"""Cleanup existing PAMM investor sub-accounts (pre-pool-model data).

PAMM is being reworked as a true pooled fund: investors no longer get a
dedicated trading account, they just hold a share of the master's pool.
This migration:
  1. For each active PAMM allocation that has an investor_account_id:
     - Closes any open positions on that investor sub-account (at open_price,
       no P&L — the investor's pool share is tracked via master's balance
       going forward)
     - Returns the sub-account's balance to the investor's main wallet
     - Nulls out allocation.investor_account_id
     - Marks the sub-account inactive
  2. MAM allocations are left untouched.

Revision ID: 0009
Revises: 0008
"""
from alembic import op
import sqlalchemy as sa

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # 1) Close any open positions on PAMM investor sub-accounts at their open price.
    #    We log these in trade_history so they still appear in user statements.
    conn.execute(sa.text("""
        INSERT INTO trade_history (
            id, position_id, account_id, instrument_id, side, lots,
            open_price, close_price, swap, commission, profit,
            close_reason, opened_at, closed_at
        )
        SELECT
            gen_random_uuid(), p.id, p.account_id, p.instrument_id, p.side, p.lots,
            p.open_price, p.open_price,
            COALESCE(p.swap, 0), COALESCE(p.commission, 0), 0,
            'pamm_model_migration', p.created_at, NOW()
        FROM positions p
        JOIN investor_allocations ia ON ia.investor_account_id = p.account_id
        WHERE p.status = 'open'
          AND ia.copy_type = 'pamm'
          AND ia.status = 'active'
          AND NOT EXISTS (SELECT 1 FROM trade_history th WHERE th.position_id = p.id);
    """))

    conn.execute(sa.text("""
        UPDATE positions p
        SET status = 'closed',
            close_price = p.open_price,
            profit = 0,
            closed_at = NOW()
        FROM investor_allocations ia
        WHERE ia.investor_account_id = p.account_id
          AND ia.copy_type = 'pamm'
          AND ia.status = 'active'
          AND p.status = 'open';
    """))

    # 2) Mark any open copy_trades for these PAMM allocations as closed.
    conn.execute(sa.text("""
        UPDATE copy_trades ct
        SET status = 'closed'
        FROM investor_allocations ia
        WHERE ct.investor_allocation_id = ia.id
          AND ia.copy_type = 'pamm'
          AND ct.status = 'open';
    """))

    # 3) Return each PAMM sub-account's balance to the investor's main wallet,
    #    log a Transaction row, and mark the sub-account inactive.
    #    Note: the pool account (master) already holds these funds separately —
    #    we are only returning the dead sub-account's cosmetic balance.
    conn.execute(sa.text("""
        INSERT INTO transactions (
            id, user_id, account_id, type, amount, balance_after,
            description, created_at
        )
        SELECT
            gen_random_uuid(), ta.user_id, NULL, 'deposit',
            COALESCE(ta.balance, 0),
            COALESCE(u.main_wallet_balance, 0) + COALESCE(ta.balance, 0),
            'PAMM model migration — sub-account ' || ta.account_number || ' balance returned',
            NOW()
        FROM trading_accounts ta
        JOIN investor_allocations ia ON ia.investor_account_id = ta.id
        JOIN users u ON u.id = ta.user_id
        WHERE ia.copy_type = 'pamm'
          AND ia.status = 'active'
          AND COALESCE(ta.balance, 0) > 0;
    """))

    conn.execute(sa.text("""
        UPDATE users u
        SET main_wallet_balance = COALESCE(u.main_wallet_balance, 0) + COALESCE(ta.balance, 0)
        FROM trading_accounts ta
        JOIN investor_allocations ia ON ia.investor_account_id = ta.id
        WHERE ta.user_id = u.id
          AND ia.copy_type = 'pamm'
          AND ia.status = 'active'
          AND COALESCE(ta.balance, 0) > 0;
    """))

    conn.execute(sa.text("""
        UPDATE trading_accounts ta
        SET balance = 0, equity = 0, free_margin = 0, margin_used = 0,
            is_active = false
        FROM investor_allocations ia
        WHERE ia.investor_account_id = ta.id
          AND ia.copy_type = 'pamm'
          AND ia.status = 'active';
    """))

    # 4) Null out allocation.investor_account_id so future code sees the pooled model.
    conn.execute(sa.text("""
        UPDATE investor_allocations
        SET investor_account_id = NULL
        WHERE copy_type = 'pamm'
          AND status = 'active';
    """))


def downgrade() -> None:
    # Not reversible — old sub-accounts are inactive and their balances have
    # been moved to the main wallet. Leave the data as-is.
    pass
