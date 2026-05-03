"""Admin platform fee collection — credits admin fees to the first super_admin's wallet."""
from decimal import Decimal
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import User, Transaction


async def credit_admin_fee(
    db: AsyncSession,
    amount: Decimal,
    description: str,
    reference_id=None,
) -> None:
    """Credit platform admin fee to the super_admin's main wallet.

    If no super_admin exists, fee is recorded as a Transaction with
    user_id=None (platform orphan) so it's never lost.
    """
    if amount <= 0:
        return

    # Find the first super_admin
    admin_q = await db.execute(
        select(User).where(User.role == "super_admin").limit(1)
    )
    admin_user = admin_q.scalar_one_or_none()

    if not admin_user:
        # Fallback: find any admin
        admin_q2 = await db.execute(
            select(User).where(User.role == "admin").limit(1)
        )
        admin_user = admin_q2.scalar_one_or_none()

    if admin_user:
        admin_user.main_wallet_balance = (
            admin_user.main_wallet_balance or Decimal("0")
        ) + amount

    db.add(Transaction(
        user_id=admin_user.id if admin_user else None,
        account_id=None,
        type="admin_commission",
        amount=amount,
        balance_after=admin_user.main_wallet_balance if admin_user else None,
        reference_id=reference_id,
        description=description,
    ))
