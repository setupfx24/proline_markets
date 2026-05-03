from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import get_db
from dependencies import require_permission
from packages.common.src.models import User
from packages.common.src.admin_schemas import DashboardStats, DashboardRevenueSeries
from services import dashboard_service

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats(
    admin: User = Depends(require_permission("analytics.view")),
    db: AsyncSession = Depends(get_db),
):
    return await dashboard_service.get_dashboard_stats(db=db)


@router.get("/revenue", response_model=DashboardRevenueSeries)
async def dashboard_revenue_series(
    days: int = Query(30, ge=7, le=90),
    admin: User = Depends(require_permission("analytics.view")),
    db: AsyncSession = Depends(get_db),
):
    """Daily approved deposit totals and completed withdrawals for the chart."""
    return await dashboard_service.dashboard_revenue_series(days=days, db=db)
