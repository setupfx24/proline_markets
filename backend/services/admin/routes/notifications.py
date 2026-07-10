"""Admin Notifications — pending-request counts for the header bell.

Aggregates everything that needs admin attention (a user "request"):
pending deposits, withdrawals, KYC submissions, partner (IB) applications,
copy-master applications, and open support tickets. Any authenticated admin
can read it — it drives the notification bell, not a permissioned page.
"""
from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import get_db
from dependencies import get_current_admin
from packages.common.src.models import (
    User, Deposit, Withdrawal, IBApplication, MasterAccount, SupportTicket,
)

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("")
async def get_pending_notifications(
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    async def _count(stmt) -> int:
        result = await db.execute(stmt)
        return int(result.scalar() or 0)

    deposits = await _count(
        select(func.count(Deposit.id)).where(Deposit.status == "pending")
    )
    withdrawals = await _count(
        select(func.count(Withdrawal.id)).where(Withdrawal.status == "pending")
    )
    kyc = await _count(
        select(func.count(User.id)).where(User.kyc_status == "submitted")
    )
    ib = await _count(
        select(func.count(IBApplication.id)).where(IBApplication.status == "pending")
    )
    masters = await _count(
        select(func.count(MasterAccount.id)).where(MasterAccount.status == "pending")
    )
    support = await _count(
        select(func.count(SupportTicket.id)).where(
            SupportTicket.status.in_(["open", "in_progress"])
        )
    )

    categories = [
        {"key": "deposits", "label": "Deposit requests", "count": deposits, "href": "/deposits"},
        {"key": "withdrawals", "label": "Withdrawal requests", "count": withdrawals, "href": "/deposits"},
        {"key": "kyc", "label": "KYC submissions", "count": kyc, "href": "/kyc"},
        {"key": "ib", "label": "Partner applications", "count": ib, "href": "/business/ib"},
        {"key": "masters", "label": "Copy-master requests", "count": masters, "href": "/business/masters"},
        {"key": "support", "label": "Support tickets", "count": support, "href": "/support"},
    ]
    total = sum(c["count"] for c in categories)
    return {"total": total, "categories": categories}
