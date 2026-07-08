"""Add email verification (OTP) fields to users.

email_verified defaults TRUE so existing/demo/admin users keep logging in;
new self-registrations are set False and must confirm a 6-digit code. Idempotent.

Revision ID: 0018
Revises: 0017
"""
from alembic import op


revision = "0018"
down_revision = "0017"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT true;")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_code VARCHAR(6);")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_expires TIMESTAMPTZ;")


def downgrade() -> None:
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS email_verification_expires;")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS email_verification_code;")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS email_verified;")
