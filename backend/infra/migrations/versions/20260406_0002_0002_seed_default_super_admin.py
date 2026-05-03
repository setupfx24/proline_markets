"""Ensure default super_admin exists (fixes admin panel login when DB had no init-db seed).

Revision ID: 0002
Revises: 0001
"""
import os

import bcrypt
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None

_ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@Proline Markets.com")
_ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "Proline MarketsAdmin2025!")
_DEFAULT_HASH = bcrypt.hashpw(_ADMIN_PASSWORD.encode(), bcrypt.gensalt(12)).decode()


def upgrade() -> None:
    op.execute(
        f"""
        INSERT INTO users (email, password_hash, first_name, last_name, role, status, kyc_status)
        VALUES (
            '{_ADMIN_EMAIL}',
            '{_DEFAULT_HASH}',
            'Super',
            'Admin',
            'super_admin',
            'active',
            'approved'
        )
        ON CONFLICT (email) DO UPDATE SET
            password_hash = EXCLUDED.password_hash,
            role = EXCLUDED.role,
            status = EXCLUDED.status,
            kyc_status = EXCLUDED.kyc_status,
            first_name = EXCLUDED.first_name,
            last_name = EXCLUDED.last_name;
        """
    )


def downgrade() -> None:
    op.execute(
        f"""
        DELETE FROM users
        WHERE email = '{_ADMIN_EMAIL}'
          AND password_hash = '{_DEFAULT_HASH}';
        """
    )
