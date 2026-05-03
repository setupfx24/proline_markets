"""Add shared_trades table for TradeLocker-style share links.

Revision ID: 0008
Revises: 0007
"""
from alembic import op
import sqlalchemy as sa

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS shared_trades (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            short_code VARCHAR(16) NOT NULL UNIQUE,
            position_id UUID NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            description TEXT,
            link_description TEXT,
            display_mode VARCHAR(16) DEFAULT 'pnl',
            view_count INTEGER DEFAULT 0,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            expires_at TIMESTAMPTZ NOT NULL
        );
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_shared_trades_short_code ON shared_trades(short_code);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_shared_trades_position_id ON shared_trades(position_id);")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS shared_trades;")
