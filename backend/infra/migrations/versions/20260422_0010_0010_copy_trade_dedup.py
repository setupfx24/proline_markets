"""De-duplicate active copy_trades + add partial unique index.

Gateway runs with --workers 2 in production; each worker was independently
running copy_engine, so every master trade was being mirrored twice per
follower. This migration:

  1. Finds duplicate open CopyTrade rows with the same
     (master_position_id, investor_allocation_id) — keeps the oldest,
     closes the rest at their open price (zero P&L) so follower books
     reconcile cleanly.
  2. Adds a partial unique index so the DB rejects any future attempt
     to insert a second active mirror for the same (master_pos, alloc).

Revision ID: 0010
Revises: 0009
"""
from alembic import op
import sqlalchemy as sa

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # 1) Close duplicate open positions created by duplicate copies.
    #    Keep the oldest CopyTrade per (master_position_id, investor_allocation_id).
    conn.execute(sa.text("""
        WITH ranked AS (
            SELECT
                id,
                investor_position_id,
                ROW_NUMBER() OVER (
                    PARTITION BY master_position_id, investor_allocation_id
                    ORDER BY created_at ASC
                ) AS rn
            FROM copy_trades
            WHERE status = 'open'
        ),
        dup_copies AS (
            SELECT id, investor_position_id FROM ranked WHERE rn > 1
        )
        UPDATE positions p
        SET status = 'closed',
            close_price = p.open_price,
            profit = 0,
            closed_at = NOW()
        FROM dup_copies d
        WHERE p.id = d.investor_position_id
          AND p.status = 'open';
    """))

    # 2) Log closed duplicate positions in trade_history.
    conn.execute(sa.text("""
        WITH ranked AS (
            SELECT
                id AS copy_id,
                investor_position_id,
                ROW_NUMBER() OVER (
                    PARTITION BY master_position_id, investor_allocation_id
                    ORDER BY created_at ASC
                ) AS rn
            FROM copy_trades
        ),
        dup_copies AS (
            SELECT investor_position_id FROM ranked WHERE rn > 1
        )
        INSERT INTO trade_history (
            id, position_id, account_id, instrument_id, side, lots,
            open_price, close_price, swap, commission, profit,
            close_reason, opened_at, closed_at
        )
        SELECT
            gen_random_uuid(), p.id, p.account_id, p.instrument_id, p.side, p.lots,
            p.open_price, p.open_price,
            COALESCE(p.swap, 0), COALESCE(p.commission, 0), 0,
            'dup_copy_cleanup', p.created_at, NOW()
        FROM positions p
        JOIN dup_copies d ON d.investor_position_id = p.id
        WHERE NOT EXISTS (SELECT 1 FROM trade_history th WHERE th.position_id = p.id);
    """))

    # 3) Mark duplicate CopyTrade rows themselves as closed.
    conn.execute(sa.text("""
        WITH ranked AS (
            SELECT
                id,
                ROW_NUMBER() OVER (
                    PARTITION BY master_position_id, investor_allocation_id
                    ORDER BY created_at ASC
                ) AS rn
            FROM copy_trades
            WHERE status = 'open'
        )
        UPDATE copy_trades
        SET status = 'closed'
        FROM ranked
        WHERE copy_trades.id = ranked.id
          AND ranked.rn > 1;
    """))

    # 4) Partial unique index — prevents future duplicate active mirrors.
    conn.execute(sa.text("""
        CREATE UNIQUE INDEX IF NOT EXISTS ux_copy_trades_active_master_alloc
        ON copy_trades (master_position_id, investor_allocation_id)
        WHERE status = 'open';
    """))


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ux_copy_trades_active_master_alloc;")
    # The duplicate closures are not reversible.
