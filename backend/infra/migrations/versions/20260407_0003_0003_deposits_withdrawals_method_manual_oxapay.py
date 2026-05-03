"""Allow manual and oxapay deposit/withdrawal methods (matches wallet_service METHOD_MAP).

Revision ID: 0003
Revises: 0002
"""
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None

# Must match packages used in wallet_service.create_deposit / create_manual_* / create_withdrawal.
_METHODS = (
    "bank_transfer",
    "upi",
    "qr",
    "crypto_btc",
    "crypto_eth",
    "crypto_usdt",
    "metamask",
    "oxapay",
    "manual",
)


def upgrade() -> None:
    methods_sql = ", ".join(f"'{m}'" for m in _METHODS)
    op.execute(f"ALTER TABLE deposits DROP CONSTRAINT IF EXISTS deposits_method_check;")
    op.execute(
        f"ALTER TABLE deposits ADD CONSTRAINT deposits_method_check "
        f"CHECK (method IN ({methods_sql}));"
    )
    op.execute("ALTER TABLE withdrawals DROP CONSTRAINT IF EXISTS withdrawals_method_check;")
    op.execute(
        f"ALTER TABLE withdrawals ADD CONSTRAINT withdrawals_method_check "
        f"CHECK (method IN ({methods_sql}));"
    )


def downgrade() -> None:
    legacy = (
        "bank_transfer",
        "upi",
        "qr",
        "crypto_btc",
        "crypto_eth",
        "crypto_usdt",
        "metamask",
    )
    methods_sql = ", ".join(f"'{m}'" for m in legacy)
    op.execute("ALTER TABLE deposits DROP CONSTRAINT IF EXISTS deposits_method_check;")
    op.execute(
        f"ALTER TABLE deposits ADD CONSTRAINT deposits_method_check "
        f"CHECK (method IN ({methods_sql}));"
    )
    wd_legacy = (
        "bank_transfer",
        "upi",
        "crypto_btc",
        "crypto_eth",
        "crypto_usdt",
        "metamask",
    )
    wd_sql = ", ".join(f"'{m}'" for m in wd_legacy)
    op.execute("ALTER TABLE withdrawals DROP CONSTRAINT IF EXISTS withdrawals_method_check;")
    op.execute(
        f"ALTER TABLE withdrawals ADD CONSTRAINT withdrawals_method_check "
        f"CHECK (method IN ({wd_sql}));"
    )
