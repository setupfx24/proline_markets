"""Admin Bonus Service — bonus offers and user bonus allocations."""
import uuid
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.models import BonusOffer, UserBonus, User
from packages.common.src.admin_schemas import BonusOfferIn, BonusOfferOut, UserBonusOut, PaginatedResponse
from dependencies import write_audit_log


async def list_bonus_offers(db: AsyncSession) -> list:
    result = await db.execute(select(BonusOffer).order_by(BonusOffer.created_at.desc()))
    offers = result.scalars().all()
    return [
        BonusOfferOut(
            id=str(o.id),
            name=o.name,
            bonus_type=o.bonus_type,
            percentage=float(o.percentage) if o.percentage else None,
            fixed_amount=float(o.fixed_amount) if o.fixed_amount else None,
            min_deposit=float(o.min_deposit or 0),
            max_bonus=float(o.max_bonus) if o.max_bonus else None,
            lots_required=float(o.lots_required or 0),
            target_audience=o.target_audience or "all",
            starts_at=o.starts_at,
            expires_at=o.expires_at,
            is_active=o.is_active,
            created_at=o.created_at,
        )
        for o in offers
    ]


async def create_bonus_offer(
    body: BonusOfferIn,
    admin_id: uuid.UUID,
    ip_address: str | None,
    db: AsyncSession,
) -> dict:
    offer = BonusOffer(
        name=body.name,
        bonus_type=body.bonus_type,
        percentage=Decimal(str(body.percentage)) if body.percentage else None,
        fixed_amount=Decimal(str(body.fixed_amount)) if body.fixed_amount else None,
        min_deposit=Decimal(str(body.min_deposit)),
        max_bonus=Decimal(str(body.max_bonus)) if body.max_bonus else None,
        lots_required=Decimal(str(body.lots_required)),
        target_audience=body.target_audience,
        starts_at=body.starts_at,
        expires_at=body.expires_at,
        is_active=body.is_active,
    )
    db.add(offer)
    await db.flush()

    await write_audit_log(
        db, admin_id, "create_bonus_offer", "bonus_offer", offer.id,
        new_values={"name": body.name, "bonus_type": body.bonus_type},
        ip_address=ip_address,
    )
    await db.commit()
    return {"message": "Bonus offer created", "id": str(offer.id)}


async def update_bonus_offer(
    offer_id: uuid.UUID,
    body: BonusOfferIn,
    admin_id: uuid.UUID,
    ip_address: str | None,
    db: AsyncSession,
) -> dict:
    result = await db.execute(select(BonusOffer).where(BonusOffer.id == offer_id))
    offer = result.scalar_one_or_none()
    if not offer:
        raise HTTPException(status_code=404, detail="Bonus offer not found")

    old_values = {"name": offer.name, "is_active": offer.is_active}

    offer.name = body.name
    offer.bonus_type = body.bonus_type
    offer.percentage = Decimal(str(body.percentage)) if body.percentage else None
    offer.fixed_amount = Decimal(str(body.fixed_amount)) if body.fixed_amount else None
    offer.min_deposit = Decimal(str(body.min_deposit))
    offer.max_bonus = Decimal(str(body.max_bonus)) if body.max_bonus else None
    offer.lots_required = Decimal(str(body.lots_required))
    offer.target_audience = body.target_audience
    offer.starts_at = body.starts_at
    offer.expires_at = body.expires_at
    offer.is_active = body.is_active

    await write_audit_log(
        db, admin_id, "update_bonus_offer", "bonus_offer", offer_id,
        old_values=old_values,
        new_values={"name": body.name, "is_active": body.is_active},
        ip_address=ip_address,
    )
    await db.commit()
    return {"message": "Bonus offer updated"}


async def list_user_bonuses(
    page: int,
    per_page: int,
    db: AsyncSession,
) -> PaginatedResponse:
    query = select(UserBonus)
    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    query = query.order_by(UserBonus.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    bonuses = result.scalars().all()

    items = []
    for b in bonuses:
        user_q = await db.execute(select(User).where(User.id == b.user_id))
        user = user_q.scalar_one_or_none()

        offer_name = None
        if b.offer_id:
            offer_q = await db.execute(select(BonusOffer).where(BonusOffer.id == b.offer_id))
            offer = offer_q.scalar_one_or_none()
            if offer:
                offer_name = offer.name

        items.append(UserBonusOut(
            id=str(b.id),
            user_id=str(b.user_id),
            account_id=str(b.account_id) if b.account_id else None,
            offer_id=str(b.offer_id) if b.offer_id else None,
            amount=float(b.amount or 0),
            lots_traded=float(b.lots_traded or 0),
            lots_required=float(b.lots_required or 0),
            status=b.status or "active",
            released_at=b.released_at,
            expires_at=b.expires_at,
            created_at=b.created_at,
            user_email=user.email if user else None,
            offer_name=offer_name,
        ))

    return PaginatedResponse(items=items, total=total, page=page, per_page=per_page)
