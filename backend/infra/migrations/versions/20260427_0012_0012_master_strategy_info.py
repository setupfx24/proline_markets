"""Add strategy_info JSONB column to master_accounts.

Revision ID: 0012
Revises: 0011
"""
from alembic import op

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE master_accounts
        ADD COLUMN IF NOT EXISTS strategy_info JSONB DEFAULT NULL;
    """)


def downgrade() -> None:
    op.execute("ALTER TABLE master_accounts DROP COLUMN IF EXISTS strategy_info;")
