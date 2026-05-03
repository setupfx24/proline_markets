"""Admin CRUD for account types (account_groups) — spreads, commission, min deposit, leverage."""
import uuid

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import get_db
from dependencies import require_permission
from packages.common.src.models import User
from packages.common.src.admin_schemas import AccountTypeIn
from services import account_type_service

router = APIRouter(prefix="/account-types", tags=["Account Types"])


@router.get("")
async def list_account_types(
    admin: User = Depends(require_permission("config.view")),
    db: AsyncSession = Depends(get_db),
):
    return await account_type_service.list_account_types(db=db)


@router.post("")
async def create_account_type(
    body: AccountTypeIn,
    request: Request,
    admin: User = Depends(require_permission("config.update")),
    db: AsyncSession = Depends(get_db),
):
    return await account_type_service.create_account_type(
        body=body, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.put("/{group_id}")
async def update_account_type(
    group_id: uuid.UUID,
    body: AccountTypeIn,
    request: Request,
    admin: User = Depends(require_permission("config.update")),
    db: AsyncSession = Depends(get_db),
):
    return await account_type_service.update_account_type(
        group_id=group_id, body=body, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.delete("/{group_id}")
async def deactivate_account_type(
    group_id: uuid.UUID,
    request: Request,
    admin: User = Depends(require_permission("config.update")),
    db: AsyncSession = Depends(get_db),
):
    return await account_type_service.deactivate_account_type(
        group_id=group_id, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )
