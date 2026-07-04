"""Create investor_access table (read-only investor logins).

Stores admin-created "investor password" credentials, each tied to one platform
user. On login the gateway issues a JWT with sub=<target user_id>, role="investor";
reads resolve to that user's accounts and all write actions are blocked by role.
Idempotent — safe to re-run.

Revision ID: 0015
Revises: 0014
"""
from alembic import op


revision = "0015"
down_revision = "0014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS investor_access (
            id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            email          VARCHAR(255) NOT NULL UNIQUE,
            password_hash  VARCHAR(255) NOT NULL,
            user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            label          VARCHAR(120),
            is_active      BOOLEAN NOT NULL DEFAULT TRUE,
            created_by     UUID REFERENCES users(id) ON DELETE SET NULL,
            last_login_at  TIMESTAMPTZ,
            created_at     TIMESTAMPTZ DEFAULT now(),
            updated_at     TIMESTAMPTZ DEFAULT now()
        );
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_investor_access_email ON investor_access (email);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_investor_access_user_id ON investor_access (user_id);")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS investor_access;")
