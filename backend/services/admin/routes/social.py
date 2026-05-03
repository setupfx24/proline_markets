import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import get_db
from dependencies import require_permission
from packages.common.src.models import User
from services import social_service

router = APIRouter(prefix="/social", tags=["Social Trading"])


class ApproveRequest(BaseModel):
    admin_commission_pct: Optional[float] = None
    max_investors: Optional[int] = None
    master_type: Optional[str] = None


class RejectRequest(BaseModel):
    reason: Optional[str] = None


@router.get("/master-requests")
async def list_master_requests(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    admin: User = Depends(require_permission("social.view")),
    db: AsyncSession = Depends(get_db),
):
    return await social_service.list_master_requests(page=page, per_page=per_page, db=db)


@router.post("/master-requests/{master_id}/approve")
async def approve_master_request(
    master_id: uuid.UUID,
    body: ApproveRequest,
    request: Request,
    admin: User = Depends(require_permission("social.manage")),
    db: AsyncSession = Depends(get_db),
):
    return await social_service.approve_master_request(
        master_id=master_id,
        admin_commission_pct=body.admin_commission_pct,
        max_investors=body.max_investors,
        master_type=body.master_type,
        admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.post("/master-requests/{master_id}/reject")
async def reject_master_request(
    master_id: uuid.UUID,
    body: RejectRequest,
    request: Request,
    admin: User = Depends(require_permission("social.manage")),
    db: AsyncSession = Depends(get_db),
):
    return await social_service.reject_master_request(
        master_id=master_id, reason=body.reason,
        admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.get("/masters")
async def list_masters(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    admin: User = Depends(require_permission("social.view")),
    db: AsyncSession = Depends(get_db),
):
    return await social_service.list_masters(page=page, per_page=per_page, db=db)


@router.put("/masters/{master_id}")
async def update_master_settings(
    master_id: uuid.UUID,
    body: ApproveRequest,
    request: Request,
    admin: User = Depends(require_permission("social.manage")),
    db: AsyncSession = Depends(get_db),
):
    return await social_service.update_master_settings(
        master_id=master_id,
        admin_commission_pct=body.admin_commission_pct,
        max_investors=body.max_investors,
        admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.delete("/masters/{master_id}")
async def delete_master(
    master_id: uuid.UUID,
    request: Request,
    admin: User = Depends(require_permission("social.manage")),
    db: AsyncSession = Depends(get_db),
):
    return await social_service.delete_master(
        master_id=master_id, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.get("/pamm-analytics")
async def pamm_analytics(
    admin: User = Depends(require_permission("social.view")),
    db: AsyncSession = Depends(get_db),
):
    return await social_service.pamm_analytics(db=db)


@router.post("/pamm/{master_id}/distribute-profit")
async def distribute_pamm_profit(
    master_id: uuid.UUID,
    request: Request,
    admin: User = Depends(require_permission("social.manage")),
    db: AsyncSession = Depends(get_db),
):
    return await social_service.distribute_pamm_profit(
        master_id=master_id, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )
