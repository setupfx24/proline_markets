import uuid

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import get_db
from dependencies import require_permission
from packages.common.src.models import User
from packages.common.src.admin_schemas import ManagedAccountConfig
from services import managed_account_service

router = APIRouter(prefix="/managed-accounts", tags=["Managed Accounts"])


def _ip(request: Request) -> str | None:
    return request.client.host if request.client else None


@router.get("")
async def list_managed_accounts(
    admin: User = Depends(require_permission("managed_accounts.view")),
    db: AsyncSession = Depends(get_db),
):
    return await managed_account_service.list_all(db=db)


@router.get("/{managed_id}")
async def get_managed_account(
    managed_id: uuid.UUID,
    admin: User = Depends(require_permission("managed_accounts.view")),
    db: AsyncSession = Depends(get_db),
):
    return await managed_account_service.get_one(managed_id=managed_id, db=db)


@router.post("/preview")
async def preview_managed_account(
    body: ManagedAccountConfig,
    admin: User = Depends(require_permission("managed_accounts.create")),
    db: AsyncSession = Depends(get_db),
):
    """Compute monthly profit / withdrawals / final balance without writing."""
    return managed_account_service.preview(body)


@router.post("/generate")
async def generate_managed_account(
    body: ManagedAccountConfig,
    request: Request,
    admin: User = Depends(require_permission("managed_accounts.create")),
    db: AsyncSession = Depends(get_db),
):
    """Create (or regenerate) a managed account keyed by email."""
    ma = await managed_account_service.generate(
        cfg=body, admin_id=admin.id, ip_address=_ip(request), db=db,
    )
    return await managed_account_service._to_out(ma, db)


@router.put("/{managed_id}")
async def update_managed_account(
    managed_id: uuid.UUID,
    body: ManagedAccountConfig,
    request: Request,
    admin: User = Depends(require_permission("managed_accounts.create")),
    db: AsyncSession = Depends(get_db),
):
    """Edit + regenerate an existing managed account."""
    ma = await managed_account_service.generate(
        cfg=body, admin_id=admin.id, ip_address=_ip(request), db=db, managed_id=managed_id,
    )
    return await managed_account_service._to_out(ma, db)


@router.delete("/{managed_id}")
async def delete_managed_account(
    managed_id: uuid.UUID,
    request: Request,
    admin: User = Depends(require_permission("managed_accounts.create")),
    db: AsyncSession = Depends(get_db),
):
    return await managed_account_service.delete_one(
        managed_id=managed_id, admin_id=admin.id, ip_address=_ip(request), db=db,
    )
