"""Repair transactions.type CHECK constraint.

Older deployments were initialized when the allowed-type list did not include
'admin_commission' (and a few other modern types like performance_fee /
master_commission / refund). When the copy engine deducts platform commission
on a follower mirror it inserts a transactions row with type='admin_commission'
— on those servers the insert hits CheckViolationError, the whole copy-open
transaction rolls back, and follower mirrors silently stop opening.

This migration drops the old constraint (if any) and recreates it with the
full set of types the codebase actually emits today. Idempotent — safe to
re-run on already-fixed databases.

Revision ID: 0014
Revises: 0013
"""
from alembic import op


revision = "0014"
down_revision = "0013"
branch_labels = None
depends_on = None


ALLOWED_TYPES = (
    "deposit", "withdrawal", "commission", "swap", "bonus", "credit",
    "adjustment", "ib_commission", "profit", "loss", "transfer",
    "admin_commission", "performance_fee", "master_commission", "refund",
)


def upgrade() -> None:
    types_sql = ", ".join(f"'{t}'" for t in ALLOWED_TYPES)
    op.execute("ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_type_check;")
    op.execute(
        f"ALTER TABLE transactions ADD CONSTRAINT transactions_type_check "
        f"CHECK (type IN ({types_sql}));"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_type_check;")
