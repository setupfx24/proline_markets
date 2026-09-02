"""Add user_refresh_tokens.role_override — the role a session was issued with.

Read-only investor sessions carry sub=<account owner> and role="investor". The
refresh path re-read user.role, so an investor who stayed signed in past the
~45-minute access token was handed a FULL trading token for the owner's
account. Persisting the override lets the refresh re-issue the same kind of
session. Idempotent.

Revision ID: 0025
Revises: 0024
"""
from alembic import op


revision = "0025"
down_revision = "0024"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE user_refresh_tokens ADD COLUMN IF NOT EXISTS role_override VARCHAR(20);")


def downgrade() -> None:
    op.execute("ALTER TABLE user_refresh_tokens DROP COLUMN IF EXISTS role_override;")
