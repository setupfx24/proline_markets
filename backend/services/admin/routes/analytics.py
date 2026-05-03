from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import get_db
from dependencies import require_permission
from packages.common.src.models import User
from services import analytics_service

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/dashboard")
async def analytics_dashboard(
    admin: User = Depends(require_permission("analytics.view")),
    db: AsyncSession = Depends(get_db),
):
    return await analytics_service.analytics_dashboard(db=db)


@router.get("/exposure")
async def get_exposure(
    admin: User = Depends(require_permission("analytics.view")),
    db: AsyncSession = Depends(get_db),
):
    return await analytics_service.get_exposure(db=db)
