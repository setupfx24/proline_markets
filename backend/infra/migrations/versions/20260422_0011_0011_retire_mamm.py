"""Retire the legacy 'mamm' master_type.

MAM Trading now lives under /social as the signal_provider master type;
the old pooled/individual MAM that shared /pamm with PAMM has been dropped.
This migration removes any remaining MAMM master_accounts and their
dependents so the /pamm Browse list stops showing them.

Revision ID: 0011
Revises: 0010
"""
from alembic import op
import sqlalchemy as sa

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # Collect the doomed master IDs and pool trading account IDs up front.
    conn.execute(sa.text("""
        CREATE TEMP TABLE _mamm_masters AS
        SELECT id, account_id FROM master_accounts WHERE master_type = 'mamm';
    """))

    # 1. Investor sub-accounts for MAMM allocations.
    conn.execute(sa.text("""
        CREATE TEMP TABLE _mamm_investor_accounts AS
        SELECT DISTINCT investor_account_id AS id
        FROM investor_allocations
        WHERE master_id IN (SELECT id FROM _mamm_masters)
          AND investor_account_id IS NOT NULL;
    """))

    # 2. Close copy_trades tied to MAMM allocations.
    conn.execute(sa.text("""
        DELETE FROM copy_trades
        WHERE investor_allocation_id IN (
            SELECT id FROM investor_allocations
            WHERE master_id IN (SELECT id FROM _mamm_masters)
        );
    """))

    # 3. Delete MAMM allocations.
    conn.execute(sa.text("""
        DELETE FROM investor_allocations
        WHERE master_id IN (SELECT id FROM _mamm_masters);
    """))

    # 4. Close positions + history on MAMM pool and sub-accounts.
    conn.execute(sa.text("""
        DELETE FROM trade_history
        WHERE account_id IN (SELECT account_id FROM _mamm_masters WHERE account_id IS NOT NULL)
           OR account_id IN (SELECT id FROM _mamm_investor_accounts);
    """))
    conn.execute(sa.text("""
        DELETE FROM positions
        WHERE account_id IN (SELECT account_id FROM _mamm_masters WHERE account_id IS NOT NULL)
           OR account_id IN (SELECT id FROM _mamm_investor_accounts);
    """))

    # 5. Unlink ib_commissions from any orders we're about to delete.
    conn.execute(sa.text("""
        UPDATE ib_commissions
        SET source_trade_id = NULL
        WHERE source_trade_id IN (
            SELECT id FROM orders
            WHERE account_id IN (SELECT account_id FROM _mamm_masters WHERE account_id IS NOT NULL)
               OR account_id IN (SELECT id FROM _mamm_investor_accounts)
        );
    """))

    conn.execute(sa.text("""
        DELETE FROM orders
        WHERE account_id IN (SELECT account_id FROM _mamm_masters WHERE account_id IS NOT NULL)
           OR account_id IN (SELECT id FROM _mamm_investor_accounts);
    """))

    conn.execute(sa.text("""
        DELETE FROM transactions
        WHERE account_id IN (SELECT account_id FROM _mamm_masters WHERE account_id IS NOT NULL)
           OR account_id IN (SELECT id FROM _mamm_investor_accounts);
    """))

    # 6. Delete master_accounts first (FK from master_accounts.account_id →
    #    trading_accounts), then the pool + sub-account rows themselves.
    conn.execute(sa.text("DELETE FROM master_accounts WHERE master_type = 'mamm';"))

    conn.execute(sa.text("""
        DELETE FROM trading_accounts
        WHERE id IN (SELECT account_id FROM _mamm_masters WHERE account_id IS NOT NULL)
           OR id IN (SELECT id FROM _mamm_investor_accounts);
    """))

    conn.execute(sa.text("DROP TABLE _mamm_investor_accounts;"))
    conn.execute(sa.text("DROP TABLE _mamm_masters;"))


def downgrade() -> None:
    # Not reversible — MAMM data is wiped.
    pass
