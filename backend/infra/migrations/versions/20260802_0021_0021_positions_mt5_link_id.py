"""Add positions.mt5_link_id — attribution to the mt5_account_links row that produced it.

Two things need it:
  * every engine skips MT5-mirrored rows with `mt5_link_id IS NULL` (the comment
    tag can't be used — the SL/TP engine overwrites `comment` when it closes a row,
    destroying exactly the marker we'd be relying on);
  * the admin Trades page filters "which trades are running under MT5 account A".

Backfilled from the existing "MT5|<platform_account_number>|<ticket>" comment tag.
ON DELETE RESTRICT, not SET NULL: deleting a link must never erase the attribution
of its historical trades (the admin API pre-checks and returns 400 instead).
Idempotent.

Revision ID: 0021
Revises: 0020
"""
from alembic import op


revision = "0021"
down_revision = "0020"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE positions ADD COLUMN IF NOT EXISTS mt5_link_id UUID;")

    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'fk_positions_mt5_link'
            ) THEN
                ALTER TABLE positions
                    ADD CONSTRAINT fk_positions_mt5_link
                    FOREIGN KEY (mt5_link_id) REFERENCES mt5_account_links(id)
                    ON DELETE RESTRICT;
            END IF;
        END $$;
        """
    )

    # Backfill from the comment tag. DISTINCT ON keeps one link per platform
    # account — platform_account_number is not unique, so two links can currently
    # point at the same account; the oldest wins rather than multiplying rows.
    op.execute(
        """
        UPDATE positions p
        SET mt5_link_id = m.link_id
        FROM (
            SELECT DISTINCT ON (a.id)
                   a.id AS account_id, a.account_number, l.id AS link_id
            FROM trading_accounts a
            JOIN mt5_account_links l ON l.platform_account_number = a.account_number
            ORDER BY a.id, l.created_at ASC
        ) m
        WHERE p.account_id = m.account_id
          AND p.mt5_link_id IS NULL
          AND p.comment LIKE 'MT5|' || m.account_number || '|%';
        """
    )

    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_positions_mt5_link "
        "ON positions(mt5_link_id) WHERE mt5_link_id IS NOT NULL;"
    )
    # The worker looks a position up by (account_id, comment) once per open ticket
    # every 2s; without this it is a seq scan over the whole positions table.
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_positions_acct_comment "
        "ON positions(account_id, comment);"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_positions_acct_comment;")
    op.execute("DROP INDEX IF EXISTS idx_positions_mt5_link;")
    op.execute("ALTER TABLE positions DROP CONSTRAINT IF EXISTS fk_positions_mt5_link;")
    op.execute("ALTER TABLE positions DROP COLUMN IF EXISTS mt5_link_id;")
