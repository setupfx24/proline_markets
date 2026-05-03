"""Add 'kyc' (and other missing) types to notifications_type_check constraint.

Without this, KYC submission fails with CheckViolationError when creating
the "KYC submitted" notification.

Revision ID: 0005
Revises: 0004
"""
from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None

_TYPES = (
    "info",
    "warning",
    "error",
    "success",
    "trade",
    "deposit",
    "withdrawal",
    "margin_call",
    "kyc",
    "system",
    "alert",
)


def upgrade() -> None:
    types_sql = ", ".join(f"'{t}'" for t in _TYPES)
    op.execute("ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;")
    op.execute(
        f"ALTER TABLE notifications ADD CONSTRAINT notifications_type_check "
        f"CHECK (type IN ({types_sql}));"
    )


def downgrade() -> None:
    legacy = ("info", "warning", "error", "success", "trade", "deposit", "withdrawal", "margin_call")
    types_sql = ", ".join(f"'{t}'" for t in legacy)
    op.execute("ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;")
    op.execute(
        f"ALTER TABLE notifications ADD CONSTRAINT notifications_type_check "
        f"CHECK (type IN ({types_sql}));"
    )
