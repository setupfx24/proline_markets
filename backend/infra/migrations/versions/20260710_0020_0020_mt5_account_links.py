"""Add mt5_account_links (MetaApi/MT5 → platform account mappings).

Dynamic, admin-managed list the metaapi-worker reads to mirror multiple MT5
accounts into platform trading accounts (and, in two_way mode, bridge orders).
Idempotent.

Revision ID: 0020
Revises: 0019
"""
from alembic import op


revision = "0020"
down_revision = "0019"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS mt5_account_links (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            metaapi_account_id VARCHAR(64) UNIQUE NOT NULL,
            platform_account_number VARCHAR(20) NOT NULL,
            region VARCHAR(40),
            mode VARCHAR(10) DEFAULT 'mirror',
            enabled BOOLEAN DEFAULT true,
            status VARCHAR(20) DEFAULT 'pending',
            last_error TEXT,
            last_sync_at TIMESTAMPTZ,
            label VARCHAR(100) DEFAULT '',
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_mt5_links_enabled ON mt5_account_links(enabled)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS mt5_account_links")
