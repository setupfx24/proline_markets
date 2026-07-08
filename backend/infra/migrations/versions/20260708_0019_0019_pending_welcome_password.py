"""Add users.pending_welcome_password (transient, cleared after welcome email).

Holds the plaintext login password only between registration and email
verification so the post-verification welcome email can include it; the
column is nulled the moment that email is sent. Idempotent.

Revision ID: 0019
Revises: 0018
"""
from alembic import op


revision = "0019"
down_revision = "0018"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS pending_welcome_password VARCHAR(255);")


def downgrade() -> None:
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS pending_welcome_password;")
