import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import get_db
from dependencies import require_permission
from packages.common.src.models import User
from services import kyc_service

router = APIRouter(prefix="/kyc", tags=["KYC"])


class ApproveKYCRequest(BaseModel):
    reason: Optional[str] = None


class RejectKYCRequest(BaseModel):
    reason: str


@router.get("/pending")
async def list_pending_kyc(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    admin: User = Depends(require_permission("kyc.view")),
    db: AsyncSession = Depends(get_db),
):
    """List all users with pending KYC submissions"""
    return await kyc_service.list_kyc_pending(page=page, per_page=per_page, db=db)


@router.get("/approved")
async def list_approved_kyc(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    admin: User = Depends(require_permission("kyc.view")),
    db: AsyncSession = Depends(get_db),
):
    """List all users with approved KYC"""
    return await kyc_service.list_kyc_approved(page=page, per_page=per_page, db=db)


@router.get("/rejected")
async def list_rejected_kyc(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    admin: User = Depends(require_permission("kyc.view")),
    db: AsyncSession = Depends(get_db),
):
    """List all users with rejected KYC"""
    return await kyc_service.list_kyc_rejected(page=page, per_page=per_page, db=db)


@router.post("/{user_id}/approve")
async def approve_kyc(
    user_id: uuid.UUID,
    body: ApproveKYCRequest,
    request: Request,
    admin: User = Depends(require_permission("kyc.manage")),
    db: AsyncSession = Depends(get_db),
):
    """Approve user KYC"""
    return await kyc_service.approve_kyc(
        user_id=user_id, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.post("/{user_id}/reject")
async def reject_kyc(
    user_id: uuid.UUID,
    body: RejectKYCRequest,
    request: Request,
    admin: User = Depends(require_permission("kyc.manage")),
    db: AsyncSession = Depends(get_db),
):
    """Reject user KYC"""
    return await kyc_service.reject_kyc(
        user_id=user_id, reason=body.reason, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.get("/file/{doc_id}")
async def view_kyc_file(
    doc_id: uuid.UUID,
    admin: User = Depends(require_permission("kyc.view")),
    db: AsyncSession = Depends(get_db),
):
    """Serve a user's KYC document for admin review (inline image/PDF)."""
    return await kyc_service.get_kyc_file(document_id=doc_id, db=db)
