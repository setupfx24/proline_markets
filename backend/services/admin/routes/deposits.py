import uuid

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import get_db
from dependencies import require_permission
from packages.common.src.models import User
from packages.common.src.admin_schemas import RejectRequest
from services import deposit_service

router = APIRouter(prefix="/finance", tags=["Finance"])


@router.get("/deposits/pending")
async def list_pending_deposits(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    admin: User = Depends(require_permission("deposits.view")),
    db: AsyncSession = Depends(get_db),
):
    return await deposit_service.list_pending_deposits(page=page, per_page=per_page, db=db)


@router.get("/withdrawals/pending")
async def list_pending_withdrawals(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    admin: User = Depends(require_permission("withdrawals.view")),
    db: AsyncSession = Depends(get_db),
):
    return await deposit_service.list_pending_withdrawals(page=page, per_page=per_page, db=db)


@router.get("/deposits")
async def list_all_deposits(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    status: str = Query(None),
    admin: User = Depends(require_permission("deposits.view")),
    db: AsyncSession = Depends(get_db),
):
    return await deposit_service.list_all_deposits(page=page, per_page=per_page, status=status, db=db)


@router.get("/withdrawals")
async def list_all_withdrawals(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    status: str = Query(None),
    admin: User = Depends(require_permission("withdrawals.view")),
    db: AsyncSession = Depends(get_db),
):
    return await deposit_service.list_all_withdrawals(page=page, per_page=per_page, status=status, db=db)


@router.post("/deposits/{deposit_id}/approve")
async def approve_deposit(
    deposit_id: uuid.UUID,
    request: Request,
    admin: User = Depends(require_permission("deposits.approve")),
    db: AsyncSession = Depends(get_db),
):
    return await deposit_service.approve_deposit(
        deposit_id=deposit_id, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.post("/deposits/{deposit_id}/reject")
async def reject_deposit(
    deposit_id: uuid.UUID,
    body: RejectRequest,
    request: Request,
    admin: User = Depends(require_permission("deposits.reject")),
    db: AsyncSession = Depends(get_db),
):
    return await deposit_service.reject_deposit(
        deposit_id=deposit_id, reason=body.reason, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.post("/withdrawals/{withdrawal_id}/approve")
async def approve_withdrawal(
    withdrawal_id: uuid.UUID,
    request: Request,
    admin: User = Depends(require_permission("withdrawals.approve")),
    db: AsyncSession = Depends(get_db),
):
    return await deposit_service.approve_withdrawal(
        withdrawal_id=withdrawal_id, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.post("/withdrawals/{withdrawal_id}/reject")
async def reject_withdrawal(
    withdrawal_id: uuid.UUID,
    body: RejectRequest,
    request: Request,
    admin: User = Depends(require_permission("withdrawals.reject")),
    db: AsyncSession = Depends(get_db),
):
    return await deposit_service.reject_withdrawal(
        withdrawal_id=withdrawal_id, reason=body.reason, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.get("/deposits/{deposit_id}/screenshot")
async def download_deposit_screenshot(
    deposit_id: uuid.UUID,
    admin: User = Depends(require_permission("deposits.view")),
    db: AsyncSession = Depends(get_db),
):
    return await deposit_service.download_deposit_screenshot(deposit_id=deposit_id, db=db)


@router.get("/withdrawals/{withdrawal_id}/payout-qr")
async def download_withdrawal_payout_qr(
    withdrawal_id: uuid.UUID,
    admin: User = Depends(require_permission("withdrawals.view")),
    db: AsyncSession = Depends(get_db),
):
    return await deposit_service.download_withdrawal_payout_qr(withdrawal_id=withdrawal_id, db=db)
