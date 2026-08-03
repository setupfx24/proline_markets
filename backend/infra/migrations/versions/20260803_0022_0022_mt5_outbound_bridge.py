"""Outbound MT5 bridge — push platform trades to the linked MT5 account.

Until now the bridge only ran inbound (MT5 → platform). This adds the other
direction: a position opened on the linked platform account is sent to MT5 as a
real order, same side or reversed, and closed there when it closes here.

  mt5_account_links.outbound_mode  off | same | reverse   (default off)
  mt5_account_links.max_lots       per-order safety cap, NULL = no cap
  positions.mt5_out_ticket         the MT5 ticket we opened for this position
  positions.mt5_out_state          sent | failed | closed
  positions.mt5_out_error          last broker rejection, for the admin to read

`mode` keeps meaning INBOUND only. The old 'two_way' value never did anything —
it silently behaved as 'mirror' while disabling reverse — so it is folded into
'mirror' here rather than left as a trap. Idempotent.

Revision ID: 0022
Revises: 0021
"""
from alembic import op


revision = "0022"
down_revision = "0021"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE mt5_account_links "
        "ADD COLUMN IF NOT EXISTS outbound_mode VARCHAR(10) DEFAULT 'off';"
    )
    op.execute("UPDATE mt5_account_links SET outbound_mode = 'off' WHERE outbound_mode IS NULL;")
    op.execute(
        "ALTER TABLE mt5_account_links ADD COLUMN IF NOT EXISTS max_lots NUMERIC(10, 4);"
    )
    # 'two_way' was inert and, worse, turned reverse punching back into mirroring.
    op.execute("UPDATE mt5_account_links SET mode = 'mirror' WHERE mode = 'two_way';")

    op.execute("ALTER TABLE positions ADD COLUMN IF NOT EXISTS mt5_out_ticket VARCHAR(40);")
    op.execute("ALTER TABLE positions ADD COLUMN IF NOT EXISTS mt5_out_state VARCHAR(16);")
    op.execute("ALTER TABLE positions ADD COLUMN IF NOT EXISTS mt5_out_error TEXT;")

    # Close-sync scans by ticket; the open scan is bounded by account_id already.
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_positions_mt5_out "
        "ON positions(mt5_out_ticket) WHERE mt5_out_ticket IS NOT NULL;"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_positions_mt5_out;")
    op.execute("ALTER TABLE positions DROP COLUMN IF EXISTS mt5_out_error;")
    op.execute("ALTER TABLE positions DROP COLUMN IF EXISTS mt5_out_state;")
    op.execute("ALTER TABLE positions DROP COLUMN IF EXISTS mt5_out_ticket;")
    op.execute("ALTER TABLE mt5_account_links DROP COLUMN IF EXISTS max_lots;")
    op.execute("ALTER TABLE mt5_account_links DROP COLUMN IF EXISTS outbound_mode;")
