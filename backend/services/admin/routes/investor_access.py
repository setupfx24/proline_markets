"""Admin routes — create/list/update/delete read-only Investor Access logins."""
import uuid

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import get_db
from dependencies import get_current_admin
from packages.common.src.models import User
from packages.common.src.admin_schemas import InvestorIn, InvestorUpdate
from services import investor_access_service

router = APIRouter(prefix="/investor-access", tags=["Investor Access"])


def _ip(request: Request) -> str | None:
    return request.client.host if request.client else None


@router.get("")
async def list_investors(
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    return await investor_access_service.list_investors(db=db)


@router.post("")
async def create_investor(
    body: InvestorIn,
    request: Request,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    return await investor_access_service.create_investor(
        body=body, admin=admin, ip_address=_ip(request), db=db,
    )


@router.patch("/{investor_id}")
async def update_investor(
    investor_id: uuid.UUID,
    body: InvestorUpdate,
    request: Request,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    return await investor_access_service.update_investor(
        investor_id=investor_id, body=body, admin=admin, ip_address=_ip(request), db=db,
    )


@router.delete("/{investor_id}")
async def delete_investor(
    investor_id: uuid.UUID,
    request: Request,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    return await investor_access_service.delete_investor(
        investor_id=investor_id, admin=admin, ip_address=_ip(request), db=db,
    )
