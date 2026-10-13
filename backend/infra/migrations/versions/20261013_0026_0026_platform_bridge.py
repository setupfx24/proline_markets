"""Platform bridge: bridge_links + bridge_trades

Copies trades between this platform and its sister platform by account number
(Opula Markets ⇄ Proline Markets), straight or reversed. `bridge_links` is the
admin-managed list of outbound links; `bridge_trades` records every bridged
position on this side, in either direction — it is both the worker's state and
the loop guard for two-way links.

Revision ID: 0026
Revises: 0025
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0026"
down_revision = "0025"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "bridge_links",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("local_account_number", sa.String(20), nullable=False),
        sa.Column("peer_account_number", sa.String(20), nullable=False),
        sa.Column("mode", sa.String(10), nullable=False, server_default="straight"),
        sa.Column("lot_multiplier", sa.Numeric(10, 4), nullable=False, server_default="1"),
        sa.Column("max_lots", sa.Numeric(10, 4)),
        sa.Column("copy_sl_tp", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("enabled", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("baseline_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("status", sa.String(20), server_default="pending"),
        sa.Column("last_error", sa.Text),
        sa.Column("last_sync_at", sa.DateTime(timezone=True)),
        sa.Column("label", sa.String(100), server_default=""),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint("mode IN ('straight','reverse')", name="ck_bridge_links_mode"),
        sa.UniqueConstraint("local_account_number", name="uq_bridge_links_local"),
    )

    op.create_table(
        "bridge_trades",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("direction", sa.String(3), nullable=False),
        sa.Column("link_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("bridge_links.id", ondelete="SET NULL")),
        sa.Column("local_position_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("positions.id", ondelete="CASCADE"), unique=True),
        sa.Column("local_account_number", sa.String(20)),
        sa.Column("peer_platform", sa.String(20), nullable=False),
        sa.Column("peer_account_number", sa.String(20), nullable=False),
        sa.Column("peer_position_id", sa.String(64)),
        sa.Column("mode", sa.String(10), nullable=False),
        sa.Column("state", sa.String(10), nullable=False, server_default="pending"),
        sa.Column("src_lots", sa.Numeric(10, 4)),
        sa.Column("synced_sl", sa.Numeric(18, 8)),
        sa.Column("synced_tp", sa.Numeric(18, 8)),
        sa.Column("attempts", sa.Integer, server_default="0"),
        sa.Column("next_attempt_at", sa.DateTime(timezone=True)),
        sa.Column("error", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint("direction IN ('out','in')", name="ck_bridge_trades_direction"),
    )
    op.create_index("idx_bridge_trades_link", "bridge_trades", ["link_id"])
    op.create_index("idx_bridge_trades_live", "bridge_trades", ["direction", "state"])
    # Inbound idempotency: one copy per (peer, peer position).
    op.create_index(
        "uq_bridge_trades_inbound", "bridge_trades", ["peer_platform", "peer_position_id"],
        unique=True, postgresql_where=sa.text("direction = 'in'"),
    )


def downgrade() -> None:
    op.drop_table("bridge_trades")
    op.drop_table("bridge_links")
