"""Add crypto pay-to fields to bank_accounts (manual USDT-style deposits).

Lets an admin configure a static crypto deposit address (e.g. USDT TRC20) in the
existing Banks config. method_type distinguishes 'bank' vs 'crypto'. Idempotent.

Revision ID: 0016
Revises: 0015
"""
from alembic import op


revision = "0016"
down_revision = "0015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS method_type VARCHAR(10) DEFAULT 'bank';")
    op.execute("ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS asset VARCHAR(20);")
    op.execute("ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS network VARCHAR(30);")
    op.execute("ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS wallet_address TEXT;")
    op.execute("UPDATE bank_accounts SET method_type = 'bank' WHERE method_type IS NULL;")


def downgrade() -> None:
    op.execute("ALTER TABLE bank_accounts DROP COLUMN IF EXISTS wallet_address;")
    op.execute("ALTER TABLE bank_accounts DROP COLUMN IF EXISTS network;")
    op.execute("ALTER TABLE bank_accounts DROP COLUMN IF EXISTS asset;")
    op.execute("ALTER TABLE bank_accounts DROP COLUMN IF EXISTS method_type;")
