"""Add positions.external_price (broker's own price for mirrored positions).

Used by the MT5/MetaApi mirror so the platform can show MT5's own current price
instead of recomputing from Redis ticks. Idempotent.

Revision ID: 0017
Revises: 0016
"""
from alembic import op


revision = "0017"
down_revision = "0016"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE positions ADD COLUMN IF NOT EXISTS external_price NUMERIC(18, 8);")


def downgrade() -> None:
    op.execute("ALTER TABLE positions DROP COLUMN IF EXISTS external_price;")
