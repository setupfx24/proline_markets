from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import get_db
from dependencies import get_current_admin
from packages.common.src.models import User
from services import notification_service

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("")
async def admin_notifications(
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Live admin notifications: pending KYC submissions + open support tickets."""
    return await notification_service.get_admin_notifications(db=db)
