"""Add PAMM/MAM columns: total_fee_earned on master_accounts, last_distribution_at on investor_allocations.

Revision ID: 0006
Revises: 0005
"""
from alembic import op
import sqlalchemy as sa

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE master_accounts
        ADD COLUMN IF NOT EXISTS total_fee_earned NUMERIC(18, 8) DEFAULT 0;
    """)
    op.execute("""
        ALTER TABLE investor_allocations
        ADD COLUMN IF NOT EXISTS last_distribution_at TIMESTAMPTZ;
    """)


def downgrade() -> None:
    op.drop_column("investor_allocations", "last_distribution_at")
    op.drop_column("master_accounts", "total_fee_earned")
