"""Add follower-side drawdown protection state.

Investors can already set max_drawdown_pct on their allocation. This adds the
runtime tripped flag so the copy engine can: (1) force-close open mirrors and
(2) refuse new opens once the limit is breached, until the investor manually
resets it from the accounts page.

Revision ID: 0013
Revises: 0012
"""
from alembic import op


revision = "0013"
down_revision = "0012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE investor_allocations
        ADD COLUMN IF NOT EXISTS drawdown_tripped BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS drawdown_tripped_at TIMESTAMPTZ NULL;
    """)


def downgrade() -> None:
    op.execute("""
        ALTER TABLE investor_allocations
        DROP COLUMN IF EXISTS drawdown_tripped,
        DROP COLUMN IF EXISTS drawdown_tripped_at;
    """)
