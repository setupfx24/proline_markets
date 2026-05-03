"""IB / Sub-Broker Business API — Referrals, commissions, MLM tree."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import get_db
from packages.common.src.auth import get_current_user
from ..services import business_service

router = APIRouter()


@router.get("/status")
async def ib_status(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await business_service.ib_status(user_id=current_user["user_id"], db=db)


@router.post("/apply", status_code=201)
async def apply_ib(
    application_data: dict = None,
    referral_code: str = Query(None),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await business_service.apply_ib(
        user_id=current_user["user_id"], application_data=application_data, db=db,
    )


@router.post("/apply-sub-broker", status_code=201)
async def apply_sub_broker(
    application_data: dict = None,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await business_service.apply_sub_broker(
        user_id=current_user["user_id"], application_data=application_data, db=db,
    )


@router.get("/ib/dashboard")
async def ib_dashboard(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await business_service.ib_dashboard(user_id=current_user["user_id"], db=db)


@router.get("/ib/referrals")
async def ib_referrals(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await business_service.ib_referrals(
        user_id=current_user["user_id"], page=page, per_page=per_page, db=db,
    )


@router.get("/ib/commissions")
async def ib_commissions(
    status: str = Query(None, pattern="^(pending|paid|cancelled)$"),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await business_service.ib_commissions(
        user_id=current_user["user_id"], status=status,
        page=page, per_page=per_page, db=db,
    )


@router.get("/ib/tree")
async def ib_tree(
    max_depth: int = Query(5, ge=1, le=10),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await business_service.ib_tree(
        user_id=current_user["user_id"], max_depth=max_depth, db=db,
    )


@router.post("/ib/generate-link")
async def generate_referral_link(
    utm_source: str = Query(None),
    utm_medium: str = Query(None),
    utm_campaign: str = Query(None),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await business_service.generate_referral_link(
        user_id=current_user["user_id"],
        utm_source=utm_source, utm_medium=utm_medium, utm_campaign=utm_campaign,
        db=db,
    )


@router.get("/sub-broker/dashboard")
async def sub_broker_dashboard(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await business_service.sub_broker_dashboard(
        user_id=current_user["user_id"], db=db,
    )
