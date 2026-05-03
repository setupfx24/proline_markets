import uuid

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import get_db
from dependencies import require_permission
from packages.common.src.models import User
from packages.common.src.admin_schemas import FundRequest, CreditRequest
from services import user_service

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("")
async def list_users(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: str = Query(None),
    status_filter: str = Query(None, alias="status"),
    kyc_filter: str = Query(None, alias="kyc_status"),
    group_id: str = Query(None),
    admin: User = Depends(require_permission("users.view")),
    db: AsyncSession = Depends(get_db),
):
    return await user_service.list_users(
        page=page, per_page=per_page, search=search,
        status_filter=status_filter, kyc_filter=kyc_filter, group_id=group_id, db=db,
    )


@router.get("/{user_id}")
async def get_user_detail(
    user_id: uuid.UUID,
    admin: User = Depends(require_permission("users.view")),
    db: AsyncSession = Depends(get_db),
):
    return await user_service.get_user_detail(user_id=user_id, db=db)


@router.post("/{user_id}/add-fund")
async def add_fund(
    user_id: uuid.UUID,
    body: FundRequest,
    request: Request,
    admin: User = Depends(require_permission("users.add_fund")),
    db: AsyncSession = Depends(get_db),
):
    return await user_service.add_fund(
        user_id=user_id, body=body, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.post("/{user_id}/deduct-fund")
async def deduct_fund(
    user_id: uuid.UUID,
    body: FundRequest,
    request: Request,
    admin: User = Depends(require_permission("users.deduct_fund")),
    db: AsyncSession = Depends(get_db),
):
    return await user_service.deduct_fund(
        user_id=user_id, body=body, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.post("/{user_id}/give-credit")
async def give_credit(
    user_id: uuid.UUID,
    body: CreditRequest,
    request: Request,
    admin: User = Depends(require_permission("users.add_fund")),
    db: AsyncSession = Depends(get_db),
):
    return await user_service.give_credit(
        user_id=user_id, body=body, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.post("/{user_id}/take-credit")
async def take_credit(
    user_id: uuid.UUID,
    body: CreditRequest,
    request: Request,
    admin: User = Depends(require_permission("users.add_fund")),
    db: AsyncSession = Depends(get_db),
):
    return await user_service.take_credit(
        user_id=user_id, body=body, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.post("/{user_id}/ban")
async def ban_user(
    user_id: uuid.UUID,
    request: Request,
    admin: User = Depends(require_permission("users.ban")),
    db: AsyncSession = Depends(get_db),
):
    return await user_service.ban_user(
        user_id=user_id, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.post("/{user_id}/unban")
async def unban_user(
    user_id: uuid.UUID,
    request: Request,
    admin: User = Depends(require_permission("users.ban")),
    db: AsyncSession = Depends(get_db),
):
    return await user_service.unban_user(
        user_id=user_id, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.post("/{user_id}/block-trading")
async def block_trading(
    user_id: uuid.UUID,
    request: Request,
    admin: User = Depends(require_permission("users.block_trading")),
    db: AsyncSession = Depends(get_db),
):
    return await user_service.block_trading(
        user_id=user_id, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.post("/{user_id}/kill-switch")
async def kill_switch(
    user_id: uuid.UUID,
    request: Request,
    admin: User = Depends(require_permission("users.kill_switch")),
    db: AsyncSession = Depends(get_db),
):
    return await user_service.kill_switch(
        user_id=user_id, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.post("/{user_id}/login-as")
async def login_as_user(
    user_id: uuid.UUID,
    request: Request,
    admin: User = Depends(require_permission("users.view")),
    db: AsyncSession = Depends(get_db),
):
    return await user_service.login_as_user(
        user_id=user_id, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.delete("/{user_id}")
async def delete_user(
    user_id: uuid.UUID,
    request: Request,
    admin: User = Depends(require_permission("users.add_fund")),
    db: AsyncSession = Depends(get_db),
):
    """Permanently delete a user. Closes all open positions/orders, deletes
    trading accounts, copy-trade allocations, copy trades, deposits, withdrawals,
    transactions, referrals, IB profile, and finally the user row. Cannot be
    undone."""
    return await user_service.delete_user(
        user_id=user_id, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )
