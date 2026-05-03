"""Fix missing DB columns and constraints.

Changes:
1. ib_profiles: add custom_commission_per_lot, custom_commission_per_trade,
   rejection_reason, rejected_at, rejected_by — these exist in the ORM model
   but were never migrated, causing 500 on /business/status and /business/apply.
2. investor_allocations: add 'withdrawn' to status check constraint — the
   withdraw_managed_account function sets status='withdrawn' which violates
   the existing constraint.

Revision ID: 0007
Revises: 0006
"""
from alembic import op
import sqlalchemy as sa

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── ib_profiles missing columns ─────────────────────────────────────────
    op.execute("ALTER TABLE ib_profiles ADD COLUMN IF NOT EXISTS custom_commission_per_lot NUMERIC(18, 8);")
    op.execute("ALTER TABLE ib_profiles ADD COLUMN IF NOT EXISTS custom_commission_per_trade NUMERIC(18, 8);")
    op.execute("ALTER TABLE ib_profiles ADD COLUMN IF NOT EXISTS rejection_reason TEXT;")
    op.execute("ALTER TABLE ib_profiles ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;")
    op.execute("ALTER TABLE ib_profiles ADD COLUMN IF NOT EXISTS rejected_by UUID REFERENCES users(id) ON DELETE SET NULL;")

    # ── investor_allocations: add 'withdrawn' to status constraint ───────────
    op.execute("ALTER TABLE investor_allocations DROP CONSTRAINT IF EXISTS investor_allocations_status_check;")
    op.execute("""
        ALTER TABLE investor_allocations ADD CONSTRAINT investor_allocations_status_check
        CHECK (status IN ('pending', 'active', 'paused', 'closed', 'withdrawn'));
    """)


def downgrade() -> None:
    op.drop_constraint("investor_allocations_status_check", "investor_allocations")
    op.create_check_constraint(
        "investor_allocations_status_check",
        "investor_allocations",
        "status IN ('pending', 'active', 'paused', 'closed')",
    )

    op.drop_constraint("ib_profiles_rejected_by_fkey", "ib_profiles", type_="foreignkey")
    op.drop_column("ib_profiles", "rejected_by")
    op.drop_column("ib_profiles", "rejected_at")
    op.drop_column("ib_profiles", "rejection_reason")
    op.drop_column("ib_profiles", "custom_commission_per_trade")
    op.drop_column("ib_profiles", "custom_commission_per_lot")
