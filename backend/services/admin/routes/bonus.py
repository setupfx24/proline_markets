import uuid

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import get_db
from dependencies import require_permission
from packages.common.src.models import User
from packages.common.src.admin_schemas import BonusOfferIn
from services import bonus_service

router = APIRouter(prefix="/bonus", tags=["Bonus"])


@router.get("/offers")
async def list_bonus_offers(
    admin: User = Depends(require_permission("bonus.view")),
    db: AsyncSession = Depends(get_db),
):
    return await bonus_service.list_bonus_offers(db=db)


@router.post("/offers")
async def create_bonus_offer(
    body: BonusOfferIn,
    request: Request,
    admin: User = Depends(require_permission("bonus.create")),
    db: AsyncSession = Depends(get_db),
):
    return await bonus_service.create_bonus_offer(
        body=body, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.put("/offers/{offer_id}")
async def update_bonus_offer(
    offer_id: uuid.UUID,
    body: BonusOfferIn,
    request: Request,
    admin: User = Depends(require_permission("bonus.update")),
    db: AsyncSession = Depends(get_db),
):
    return await bonus_service.update_bonus_offer(
        offer_id=offer_id, body=body, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.get("/allocations")
async def list_bonus_allocations(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    admin: User = Depends(require_permission("bonus.view")),
    db: AsyncSession = Depends(get_db),
):
    return await bonus_service.list_user_bonuses(page=page, per_page=per_page, db=db)
