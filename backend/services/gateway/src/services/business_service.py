"""Business Service — IB/Sub-Broker, referrals, commissions, MLM tree."""
from decimal import Decimal
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select, func, text
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.models import (
    IBProfile, IBApplication, IBCommission, IBCommissionPlan,
    Referral, User, TradingAccount,
)


def _get_frontend_url() -> str:
    from packages.common.src.config import get_settings
    s = get_settings()
    origins = [o.strip() for o in s.CORS_ORIGINS.split(",") if o.strip()]
    for o in origins:
        if "Proline Markets.today" in o:
            return o
    for o in origins:
        if ":3000" in o:
            return o
    return origins[0] if origins else "http://localhost:3000"


async def ib_status(user_id: UUID, db: AsyncSession) -> dict:
    profile_result = await db.execute(
        select(IBProfile).where(IBProfile.user_id == user_id)
    )
    profile = profile_result.scalar_one_or_none()

    app_result = await db.execute(
        select(IBApplication).where(IBApplication.user_id == user_id)
        .order_by(IBApplication.created_at.desc())
    )
    application = app_result.scalars().first()

    if profile:
        return {
            "is_ib": True,
            "referral_code": profile.referral_code,
            "level": profile.level,
            "total_earned": float(profile.total_earned),
            "pending_payout": float(profile.pending_payout),
            "is_active": profile.is_active,
            "created_at": profile.created_at.isoformat() if profile.created_at else None,
        }

    if application:
        return {
            "is_ib": False,
            "application_status": application.status,
            "applied_at": application.created_at.isoformat() if application.created_at else None,
        }

    return {"is_ib": False, "application_status": None}


async def apply_ib(user_id: UUID, application_data: dict | None, db: AsyncSession) -> dict:
    existing_profile = await db.execute(
        select(IBProfile).where(IBProfile.user_id == user_id)
    )
    if existing_profile.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="You are already an IB")

    existing_app = await db.execute(
        select(IBApplication).where(
            IBApplication.user_id == user_id,
            IBApplication.status == "pending",
        )
    )
    if existing_app.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="You already have a pending application")

    application = IBApplication(
        user_id=user_id,
        status="pending",
        application_data=application_data or {},
    )
    db.add(application)
    await db.commit()
    await db.refresh(application)

    return {
        "id": str(application.id),
        "status": application.status,
        "message": "IB application submitted for review",
    }


async def apply_sub_broker(user_id: UUID, application_data: dict | None, db: AsyncSession) -> dict:
    existing_app = await db.execute(
        select(IBApplication).where(
            IBApplication.user_id == user_id,
            IBApplication.status == "pending",
        )
    )
    if existing_app.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="You already have a pending application")

    existing_profile = await db.execute(
        select(IBProfile).where(IBProfile.user_id == user_id)
    )
    if existing_profile.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="You already have a business profile")

    data = application_data or {}
    data["type"] = "sub_broker"

    application = IBApplication(
        user_id=user_id,
        status="pending",
        application_data=data,
    )
    db.add(application)
    await db.commit()
    await db.refresh(application)

    return {
        "id": str(application.id),
        "status": application.status,
        "message": "Sub-broker application submitted for review",
    }


async def ib_dashboard(user_id: UUID, db: AsyncSession) -> dict:
    result = await db.execute(
        select(IBProfile).where(IBProfile.user_id == user_id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="IB profile not found")

    referral_count = await db.execute(
        select(func.count()).select_from(Referral).where(Referral.ib_profile_id == profile.id)
    )
    total_referrals = referral_count.scalar()

    total_commission = await db.execute(
        select(func.coalesce(func.sum(IBCommission.amount), 0)).where(IBCommission.ib_id == profile.id)
    )
    total_comm = total_commission.scalar()

    pending_comm = await db.execute(
        select(func.coalesce(func.sum(IBCommission.amount), 0)).where(
            IBCommission.ib_id == profile.id, IBCommission.status == "pending",
        )
    )
    pending = pending_comm.scalar()

    base_url = _get_frontend_url()

    return {
        "referral_code": profile.referral_code,
        "referral_link": f"{base_url}/auth/register?ref={profile.referral_code}",
        "level": profile.level,
        "total_referrals": total_referrals,
        "total_commission": float(total_comm),
        "pending_payout": float(profile.pending_payout),
        "total_earned": float(profile.total_earned),
        "is_active": profile.is_active,
    }


async def ib_referrals(user_id: UUID, page: int, per_page: int, db: AsyncSession) -> dict:
    profile_result = await db.execute(
        select(IBProfile).where(IBProfile.user_id == user_id)
    )
    profile = profile_result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="IB profile not found")

    count_result = await db.execute(
        select(func.count()).select_from(Referral).where(Referral.ib_profile_id == profile.id)
    )
    total = count_result.scalar()

    result = await db.execute(
        select(Referral, User.email, User.first_name, User.last_name, User.created_at)
        .join(User, Referral.referred_id == User.id)
        .where(Referral.ib_profile_id == profile.id)
        .order_by(Referral.created_at.desc())
        .offset((page - 1) * per_page).limit(per_page)
    )
    rows = result.all()

    items = []
    for ref, email, first_name, last_name, user_created in rows:
        deposit_result = await db.execute(
            select(func.count(), func.coalesce(func.sum(TradingAccount.balance), 0))
            .select_from(TradingAccount)
            .where(TradingAccount.user_id == ref.referred_id)
        )
        acct_count, total_deposit = deposit_result.one()
        items.append({
            "id": str(ref.id),
            "referred_user": {
                "email": email,
                "name": f"{first_name or ''} {last_name or ''}".strip(),
                "joined_at": user_created.isoformat() if user_created else None,
            },
            "accounts_count": acct_count,
            "total_deposit": float(total_deposit),
            "utm_source": ref.utm_source,
            "utm_medium": ref.utm_medium,
            "utm_campaign": ref.utm_campaign,
            "created_at": ref.created_at.isoformat() if ref.created_at else None,
        })

    return {
        "items": items, "total": total, "page": page, "per_page": per_page,
        "pages": (total + per_page - 1) // per_page if total else 0,
    }


async def ib_commissions(
    user_id: UUID, status: str | None, page: int, per_page: int, db: AsyncSession,
) -> dict:
    profile_result = await db.execute(
        select(IBProfile).where(IBProfile.user_id == user_id)
    )
    profile = profile_result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="IB profile not found")

    base_query = select(func.count()).select_from(IBCommission).where(IBCommission.ib_id == profile.id)
    if status:
        base_query = base_query.where(IBCommission.status == status)
    count_result = await db.execute(base_query)
    total = count_result.scalar()

    query = (
        select(IBCommission, User.email, User.first_name, User.last_name)
        .join(User, IBCommission.source_user_id == User.id)
        .where(IBCommission.ib_id == profile.id)
    )
    if status:
        query = query.where(IBCommission.status == status)
    query = query.order_by(IBCommission.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    rows = result.all()

    items = []
    for comm, email, first_name, last_name in rows:
        items.append({
            "id": str(comm.id),
            "source_user": {
                "email": email,
                "name": f"{first_name or ''} {last_name or ''}".strip(),
            },
            "commission_type": comm.commission_type,
            "amount": float(comm.amount),
            "mlm_level": comm.mlm_level,
            "status": comm.status,
            "created_at": comm.created_at.isoformat() if comm.created_at else None,
        })

    return {
        "items": items, "total": total, "page": page, "per_page": per_page,
        "pages": (total + per_page - 1) // per_page if total else 0,
    }


async def ib_tree(user_id: UUID, max_depth: int, db: AsyncSession) -> dict:
    profile_result = await db.execute(
        select(IBProfile).where(IBProfile.user_id == user_id)
    )
    profile = profile_result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="IB profile not found")

    cte_query = text("""
        WITH RECURSIVE ib_tree AS (
            SELECT
                ip.id, ip.user_id, ip.parent_ib_id, ip.referral_code,
                ip.level, ip.total_earned, ip.is_active,
                u.email, u.first_name, u.last_name,
                1 AS depth
            FROM ib_profiles ip
            JOIN users u ON ip.user_id = u.id
            WHERE ip.parent_ib_id = :root_id

            UNION ALL

            SELECT
                ip.id, ip.user_id, ip.parent_ib_id, ip.referral_code,
                ip.level, ip.total_earned, ip.is_active,
                u.email, u.first_name, u.last_name,
                t.depth + 1
            FROM ib_profiles ip
            JOIN users u ON ip.user_id = u.id
            JOIN ib_tree t ON ip.parent_ib_id = t.id
            WHERE t.depth < :max_depth
        )
        SELECT * FROM ib_tree ORDER BY depth, email
    """)

    result = await db.execute(cte_query, {"root_id": str(profile.id), "max_depth": max_depth})
    rows = result.fetchall()

    nodes_by_parent = {}
    for row in rows:
        parent_id = str(row.parent_ib_id) if row.parent_ib_id else None
        node = {
            "id": str(row.id), "user_id": str(row.user_id),
            "email": row.email,
            "name": f"{row.first_name or ''} {row.last_name or ''}".strip(),
            "referral_code": row.referral_code, "level": row.level,
            "depth": row.depth, "total_earned": float(row.total_earned),
            "is_active": row.is_active, "children": [],
        }
        nodes_by_parent.setdefault(parent_id, []).append(node)

    def build_tree(parent_id: str) -> list:
        children = nodes_by_parent.get(parent_id, [])
        for child in children:
            child["children"] = build_tree(child["id"])
        return children

    tree = build_tree(str(profile.id))

    return {
        "root": {
            "id": str(profile.id), "referral_code": profile.referral_code,
            "level": profile.level, "total_earned": float(profile.total_earned),
        },
        "tree": tree, "total_nodes": len(rows),
    }


async def generate_referral_link(
    user_id: UUID, utm_source: str | None, utm_medium: str | None,
    utm_campaign: str | None, db: AsyncSession,
) -> dict:
    profile_result = await db.execute(
        select(IBProfile).where(IBProfile.user_id == user_id)
    )
    profile = profile_result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="IB profile not found")

    base_url = _get_frontend_url()
    link = f"{base_url}/auth/register?ref={profile.referral_code}"
    params = []
    if utm_source:
        params.append(f"utm_source={utm_source}")
    if utm_medium:
        params.append(f"utm_medium={utm_medium}")
    if utm_campaign:
        params.append(f"utm_campaign={utm_campaign}")
    if params:
        link += "&" + "&".join(params)

    return {"referral_link": link, "referral_code": profile.referral_code}


async def sub_broker_dashboard(user_id: UUID, db: AsyncSession) -> dict:
    profile_result = await db.execute(
        select(IBProfile).where(IBProfile.user_id == user_id)
    )
    profile = profile_result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Sub-broker profile not found")

    direct_referrals = await db.execute(
        select(func.count()).select_from(Referral).where(Referral.ib_profile_id == profile.id)
    )
    direct_count = direct_referrals.scalar()

    client_result = await db.execute(
        select(
            Referral.referred_id, User.email, User.first_name, User.last_name,
            User.status, User.kyc_status, User.created_at,
        )
        .join(User, Referral.referred_id == User.id)
        .where(Referral.ib_profile_id == profile.id)
        .order_by(Referral.created_at.desc()).limit(50)
    )
    clients = client_result.all()

    client_list = []
    for referred_id, email, fname, lname, status, kyc, joined in clients:
        acct_result = await db.execute(
            select(func.count(), func.coalesce(func.sum(TradingAccount.balance), 0))
            .where(TradingAccount.user_id == referred_id)
        )
        acct_stats = acct_result.one()
        client_list.append({
            "user_id": str(referred_id), "email": email,
            "name": f"{fname or ''} {lname or ''}".strip(),
            "status": status, "kyc_status": kyc,
            "accounts_count": acct_stats[0],
            "total_balance": float(acct_stats[1]),
            "joined_at": joined.isoformat() if joined else None,
        })

    total_comm = await db.execute(
        select(func.coalesce(func.sum(IBCommission.amount), 0)).where(IBCommission.ib_id == profile.id)
    )

    return {
        "referral_code": profile.referral_code,
        "direct_clients": direct_count,
        "total_commission": float(total_comm.scalar()),
        "pending_payout": float(profile.pending_payout),
        "total_earned": float(profile.total_earned),
        "clients": client_list,
    }
