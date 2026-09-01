"""Add investor_access.password_plain — the generated read-only password in clear
text so the admin panel can display it in the Investor Access table after the
one-time popup is closed. Idempotent.

Revision ID: 0024
Revises: 0023
"""
from alembic import op


revision = "0024"
down_revision = "0023"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE investor_access ADD COLUMN IF NOT EXISTS password_plain VARCHAR(255);")


def downgrade() -> None:
    op.execute("ALTER TABLE investor_access DROP COLUMN IF EXISTS password_plain;")
