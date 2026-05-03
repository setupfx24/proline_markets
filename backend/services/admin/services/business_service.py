"""Admin Business Service — IB applications, agents, commission plans, MLM config, sub-brokers."""
import uuid
import secrets
import string
from decimal import Decimal
from datetime import datetime

from fastapi import HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.models import (
    User, IBApplication, IBProfile, IBCommission, Referral,
    IBCommissionPlan, SystemSetting,
    MasterAccount, InvestorAllocation, CopyTrade,
    TradingAccount, Position, PositionStatus, TradeHistory, Transaction,
)
from packages.common.src.admin_schemas import (
    IBApplicationOut, IBProfileOut, PaginatedResponse,
    MLMConfigOut, MLMConfigIn, UpdateIBCommissionIn, RejectIBIn,
    IBCommissionPlanOut, IBCommissionPlanIn,
)
from dependencies import write_audit_log


async def list_ib_applications(
    page: int, per_page: int, status_filter: str | None, db: AsyncSession,
):
    query = select(IBApplication)
    if status_filter:
        query = query.where(IBApplication.status == status_filter)

    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    query = query.order_by(IBApplication.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    apps = result.scalars().all()

    items = []
    for app in apps:
        user_q = await db.execute(select(User).where(User.id == app.user_id))
        user = user_q.scalar_one_or_none()
        items.append(IBApplicationOut(
            id=str(app.id),
            user_id=str(app.user_id),
            status=app.status,
            application_data=app.application_data,
            approved_by=str(app.approved_by) if app.approved_by else None,
            approved_at=app.approved_at,
            created_at=app.created_at,
            user_email=user.email if user else None,
            user_name=f"{user.first_name or ''} {user.last_name or ''}".strip() if user else None,
        ))

    return PaginatedResponse(items=items, total=total, page=page, per_page=per_page)


async def approve_ib_application(
    app_id: uuid.UUID, admin_id: uuid.UUID, ip_address: str | None, db: AsyncSession,
) -> dict:
    result = await db.execute(select(IBApplication).where(IBApplication.id == app_id))
    app = result.scalar_one_or_none()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    if app.status != "pending":
        raise HTTPException(status_code=400, detail="Application is not pending")

    app.status = "approved"
    app.approved_by = admin_id
    app.approved_at = datetime.utcnow()

    user_q = await db.execute(select(User).where(User.id == app.user_id))
    user = user_q.scalar_one_or_none()
    if user:
        user.role = "ib"

    referral_code = "IB" + "".join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(8))

    default_plan_q = await db.execute(
        select(IBCommissionPlan).where(IBCommissionPlan.is_default == True)
    )
    default_plan = default_plan_q.scalar_one_or_none()

    # Auto-detect parent IB: if this user was referred by an IB, link as child
    parent_ib_id = None
    parent_level = 0
    referral_q = await db.execute(
        select(Referral).where(Referral.referred_id == app.user_id)
    )
    referral = referral_q.scalar_one_or_none()
    if referral and referral.ib_profile_id:
        parent_q = await db.execute(
            select(IBProfile).where(IBProfile.id == referral.ib_profile_id, IBProfile.is_active == True)
        )
        parent_ib = parent_q.scalar_one_or_none()
        if parent_ib:
            parent_ib_id = parent_ib.id
            parent_level = parent_ib.level or 1

    profile = IBProfile(
        user_id=app.user_id,
        referral_code=referral_code,
        level=parent_level + 1,
        parent_ib_id=parent_ib_id,
        commission_plan_id=default_plan.id if default_plan else None,
    )
    db.add(profile)

    await write_audit_log(
        db, admin_id, "approve_ib_application", "ib_application", app_id,
        new_values={"status": "approved", "referral_code": referral_code},
        ip_address=ip_address,
    )
    await db.commit()
    return {"message": "IB application approved", "referral_code": referral_code}


async def reject_ib_application(
    app_id: uuid.UUID, admin_id: uuid.UUID, ip_address: str | None, db: AsyncSession,
) -> dict:
    result = await db.execute(select(IBApplication).where(IBApplication.id == app_id))
    app = result.scalar_one_or_none()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    if app.status != "pending":
        raise HTTPException(status_code=400, detail="Application is not pending")

    app.status = "rejected"
    app.approved_by = admin_id
    app.approved_at = datetime.utcnow()

    await write_audit_log(
        db, admin_id, "reject_ib_application", "ib_application", app_id,
        new_values={"status": "rejected"},
        ip_address=ip_address,
    )
    await db.commit()
    return {"message": "IB application rejected"}


async def list_ib_agents(page: int, per_page: int, db: AsyncSession):
    query = select(IBProfile).where(IBProfile.is_active == True)
    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    query = query.order_by(IBProfile.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    profiles = result.scalars().all()

    items = []
    for p in profiles:
        user_q = await db.execute(select(User).where(User.id == p.user_id))
        user = user_q.scalar_one_or_none()

        ref_count_q = await db.execute(
            select(func.count(Referral.id)).where(Referral.ib_profile_id == p.id)
        )
        ref_count = ref_count_q.scalar() or 0

        items.append(IBProfileOut(
            id=str(p.id),
            user_id=str(p.user_id),
            referral_code=p.referral_code,
            parent_ib_id=str(p.parent_ib_id) if p.parent_ib_id else None,
            level=p.level or 1,
            commission_plan_id=str(p.commission_plan_id) if p.commission_plan_id else None,
            custom_commission_per_lot=float(p.custom_commission_per_lot) if p.custom_commission_per_lot else None,
            custom_commission_per_trade=float(p.custom_commission_per_trade) if p.custom_commission_per_trade else None,
            total_earned=float(p.total_earned or 0),
            pending_payout=float(p.pending_payout or 0),
            is_active=p.is_active,
            created_at=p.created_at,
            user_email=user.email if user else None,
            user_name=f"{user.first_name or ''} {user.last_name or ''}".strip() if user else None,
            referral_count=ref_count,
        ))

    return PaginatedResponse(items=items, total=total, page=page, per_page=per_page)


async def update_ib_commission(
    agent_id: uuid.UUID, body: UpdateIBCommissionIn,
    admin_id: uuid.UUID, ip_address: str | None, db: AsyncSession,
) -> dict:
    result = await db.execute(select(IBProfile).where(IBProfile.id == agent_id))
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="IB profile not found")

    old_values = {
        "commission_plan_id": str(profile.commission_plan_id) if profile.commission_plan_id else None,
        "custom_commission_per_lot": float(profile.custom_commission_per_lot) if profile.custom_commission_per_lot else None,
        "custom_commission_per_trade": float(profile.custom_commission_per_trade) if profile.custom_commission_per_trade else None,
    }

    if body.commission_plan_id and body.commission_plan_id not in ('default', 'custom', 'null', ''):
        try:
            profile.commission_plan_id = uuid.UUID(body.commission_plan_id)
        except (ValueError, AttributeError):
            raise HTTPException(status_code=400, detail=f"Invalid commission plan ID: {body.commission_plan_id}")
        profile.custom_commission_per_lot = None
        profile.custom_commission_per_trade = None
    else:
        profile.commission_plan_id = None
        if body.custom_commission_per_lot is not None:
            profile.custom_commission_per_lot = body.custom_commission_per_lot
        if body.custom_commission_per_trade is not None:
            profile.custom_commission_per_trade = body.custom_commission_per_trade

    new_values = {
        "commission_plan_id": str(profile.commission_plan_id) if profile.commission_plan_id else None,
        "custom_commission_per_lot": float(profile.custom_commission_per_lot) if profile.custom_commission_per_lot else None,
        "custom_commission_per_trade": float(profile.custom_commission_per_trade) if profile.custom_commission_per_trade else None,
    }

    await write_audit_log(
        db, admin_id, "update_ib_commission", "ib_profile", agent_id,
        old_values=old_values, new_values=new_values,
        ip_address=ip_address,
    )
    await db.commit()
    return {"message": "IB commission updated successfully"}


async def reject_active_ib(
    agent_id: uuid.UUID, body: RejectIBIn,
    admin_id: uuid.UUID, ip_address: str | None, db: AsyncSession,
) -> dict:
    result = await db.execute(select(IBProfile).where(IBProfile.id == agent_id))
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="IB profile not found")

    profile.is_active = False
    profile.rejection_reason = body.reason
    profile.rejected_at = datetime.utcnow()
    profile.rejected_by = admin_id

    user_q = await db.execute(select(User).where(User.id == profile.user_id))
    user = user_q.scalar_one_or_none()
    if user and user.role == "ib":
        user.role = "user"

    await write_audit_log(
        db, admin_id, "reject_active_ib", "ib_profile", agent_id,
        new_values={"is_active": False, "reason": body.reason},
        ip_address=ip_address,
    )
    await db.commit()
    return {"message": "IB rejected successfully"}


async def list_commission_plans(db: AsyncSession) -> dict:
    result = await db.execute(select(IBCommissionPlan).order_by(IBCommissionPlan.is_default.desc(), IBCommissionPlan.created_at.desc()))
    plans = result.scalars().all()
    items = [IBCommissionPlanOut(
        id=str(p.id),
        name=p.name,
        is_default=p.is_default,
        commission_per_lot=float(p.commission_per_lot or 0),
        commission_per_trade=float(p.commission_per_trade or 0),
        spread_share_pct=float(p.spread_share_pct or 0),
        cpa_per_deposit=float(p.cpa_per_deposit or 0),
        mlm_levels=p.mlm_levels or 5,
        mlm_distribution=p.mlm_distribution or [40, 25, 15, 10, 10],
        created_at=p.created_at,
    ) for p in plans]
    return {"items": items}


async def create_commission_plan(
    body: IBCommissionPlanIn, admin_id: uuid.UUID, ip_address: str | None, db: AsyncSession,
) -> dict:
    if body.is_default:
        result = await db.execute(select(IBCommissionPlan).where(IBCommissionPlan.is_default == True))
        existing_default = result.scalar_one_or_none()
        if existing_default:
            existing_default.is_default = False

    plan = IBCommissionPlan(
        name=body.name,
        is_default=body.is_default,
        commission_per_lot=body.commission_per_lot,
        commission_per_trade=body.commission_per_trade,
        spread_share_pct=body.spread_share_pct,
        cpa_per_deposit=body.cpa_per_deposit,
        mlm_levels=body.mlm_levels,
        mlm_distribution=body.mlm_distribution,
    )
    db.add(plan)

    await write_audit_log(
        db, admin_id, "create_commission_plan", "ib_commission_plan", plan.id,
        new_values={"name": body.name, "is_default": body.is_default},
        ip_address=ip_address,
    )
    await db.commit()
    return {"message": "Commission plan created successfully", "id": str(plan.id)}


async def update_commission_plan(
    plan_id: uuid.UUID, body: IBCommissionPlanIn,
    admin_id: uuid.UUID, ip_address: str | None, db: AsyncSession,
) -> dict:
    result = await db.execute(select(IBCommissionPlan).where(IBCommissionPlan.id == plan_id))
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Commission plan not found")

    if body.is_default and not plan.is_default:
        existing_q = await db.execute(select(IBCommissionPlan).where(IBCommissionPlan.is_default == True))
        existing_default = existing_q.scalar_one_or_none()
        if existing_default:
            existing_default.is_default = False

    plan.name = body.name
    plan.is_default = body.is_default
    plan.commission_per_lot = body.commission_per_lot
    plan.commission_per_trade = body.commission_per_trade
    plan.spread_share_pct = body.spread_share_pct
    plan.cpa_per_deposit = body.cpa_per_deposit
    plan.mlm_levels = body.mlm_levels
    plan.mlm_distribution = body.mlm_distribution

    await write_audit_log(
        db, admin_id, "update_commission_plan", "ib_commission_plan", plan_id,
        new_values={"name": body.name, "is_default": body.is_default},
        ip_address=ip_address,
    )
    await db.commit()
    return {"message": "Commission plan updated successfully"}


async def delete_commission_plan(
    plan_id: uuid.UUID, admin_id: uuid.UUID, ip_address: str | None, db: AsyncSession,
) -> dict:
    result = await db.execute(select(IBCommissionPlan).where(IBCommissionPlan.id == plan_id))
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Commission plan not found")

    if plan.is_default:
        raise HTTPException(status_code=400, detail="Cannot delete default commission plan")

    await db.delete(plan)
    await write_audit_log(
        db, admin_id, "delete_commission_plan", "ib_commission_plan", plan_id,
        old_values={"name": plan.name},
        ip_address=ip_address,
    )
    await db.commit()
    return {"message": "Commission plan deleted successfully"}


async def get_mlm_config(db: AsyncSession):
    levels_q = await db.execute(
        select(SystemSetting).where(SystemSetting.key == "mlm_levels")
    )
    levels_setting = levels_q.scalar_one_or_none()

    dist_q = await db.execute(
        select(SystemSetting).where(SystemSetting.key == "mlm_distribution")
    )
    dist_setting = dist_q.scalar_one_or_none()

    return MLMConfigOut(
        mlm_levels=int(levels_setting.value) if levels_setting else 5,
        mlm_distribution=dist_setting.value if dist_setting else [40, 25, 15, 10, 10],
    )


async def update_mlm_config(
    body: MLMConfigIn, admin_id: uuid.UUID, ip_address: str | None, db: AsyncSession,
) -> dict:
    levels_q = await db.execute(
        select(SystemSetting).where(SystemSetting.key == "mlm_levels")
    )
    levels_setting = levels_q.scalar_one_or_none()
    if levels_setting:
        levels_setting.value = body.mlm_levels
        levels_setting.updated_by = admin_id
        levels_setting.updated_at = datetime.utcnow()
    else:
        db.add(SystemSetting(
            key="mlm_levels", value=body.mlm_levels,
            description="Number of MLM levels for IB",
            updated_by=admin_id,
        ))

    dist_q = await db.execute(
        select(SystemSetting).where(SystemSetting.key == "mlm_distribution")
    )
    dist_setting = dist_q.scalar_one_or_none()
    if dist_setting:
        dist_setting.value = body.mlm_distribution
        dist_setting.updated_by = admin_id
        dist_setting.updated_at = datetime.utcnow()
    else:
        db.add(SystemSetting(
            key="mlm_distribution", value=body.mlm_distribution,
            description="MLM distribution per level (%)",
            updated_by=admin_id,
        ))

    await write_audit_log(
        db, admin_id, "update_mlm_config", "system_setting", None,
        new_values={"mlm_levels": body.mlm_levels, "mlm_distribution": body.mlm_distribution},
        ip_address=ip_address,
    )
    await db.commit()
    return {"message": "MLM config updated"}


async def list_sub_broker_applications(
    page: int, per_page: int, status_filter: str | None, db: AsyncSession,
):
    query = select(IBApplication).where(
        IBApplication.application_data["type"].as_string() == "sub_broker"
    )
    if status_filter:
        query = query.where(IBApplication.status == status_filter)

    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    query = query.order_by(IBApplication.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    apps = result.scalars().all()

    items = []
    for app in apps:
        user_q = await db.execute(select(User).where(User.id == app.user_id))
        user = user_q.scalar_one_or_none()
        items.append({
            "id": str(app.id),
            "user_id": str(app.user_id),
            "user_name": f"{user.first_name or ''} {user.last_name or ''}".strip() if user else None,
            "user_email": user.email if user else None,
            "status": app.status,
            "company_name": (app.application_data or {}).get("company_name"),
            "created_at": app.created_at.isoformat() if app.created_at else None,
        })

    return PaginatedResponse(items=items, total=total, page=page, per_page=per_page)


async def approve_sub_broker(
    app_id: uuid.UUID, admin_id: uuid.UUID, ip_address: str | None, db: AsyncSession,
) -> dict:
    result = await db.execute(select(IBApplication).where(IBApplication.id == app_id))
    app = result.scalar_one_or_none()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    if app.status != "pending":
        raise HTTPException(status_code=400, detail="Application is not pending")

    app.status = "approved"
    app.approved_by = admin_id
    app.approved_at = datetime.utcnow()

    user_q = await db.execute(select(User).where(User.id == app.user_id))
    user = user_q.scalar_one_or_none()
    if user:
        user.role = "sub_broker"

    referral_code = "SB" + "".join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(8))
    profile = IBProfile(
        user_id=app.user_id,
        referral_code=referral_code,
        level=1,
    )
    db.add(profile)

    await write_audit_log(
        db, admin_id, "approve_sub_broker", "ib_application", app_id,
        new_values={"status": "approved", "referral_code": referral_code},
        ip_address=ip_address,
    )
    await db.commit()
    return {"message": "Sub-broker approved", "referral_code": referral_code}


async def reject_sub_broker(
    app_id: uuid.UUID, admin_id: uuid.UUID, ip_address: str | None, db: AsyncSession,
) -> dict:
    result = await db.execute(select(IBApplication).where(IBApplication.id == app_id))
    app = result.scalar_one_or_none()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    if app.status != "pending":
        raise HTTPException(status_code=400, detail="Not pending")

    app.status = "rejected"
    app.approved_by = admin_id
    app.approved_at = datetime.utcnow()

    await write_audit_log(
        db, admin_id, "reject_sub_broker", "ib_application", app_id,
        new_values={"status": "rejected"},
        ip_address=ip_address,
    )
    await db.commit()
    return {"message": "Sub-broker rejected"}


async def list_sub_brokers(page: int, per_page: int, db: AsyncSession):
    query = select(User).where(User.role == "sub_broker", User.status == "active")
    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    query = query.order_by(User.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    users = result.scalars().all()

    items = []
    for u in users:
        profile_q = await db.execute(select(IBProfile).where(IBProfile.user_id == u.id))
        profile = profile_q.scalar_one_or_none()

        ref_count = 0
        total_earned = 0.0
        if profile:
            rc = await db.execute(select(func.count(Referral.id)).where(Referral.ib_profile_id == profile.id))
            ref_count = rc.scalar() or 0
            total_earned = float(profile.total_earned or 0)

        items.append({
            "id": str(u.id),
            "user_id": str(u.id),
            "user_name": f"{u.first_name or ''} {u.last_name or ''}".strip(),
            "user_email": u.email,
            "referral_code": profile.referral_code if profile else "—",
            "clients_count": ref_count,
            "total_earned": total_earned,
            "created_at": u.created_at.isoformat() if u.created_at else None,
        })

    return PaginatedResponse(items=items, total=total, page=page, per_page=per_page)


# ─── IB Hierarchy Management ──────────────────────────────────────────────

async def set_parent_ib(
    ib_id: uuid.UUID, parent_ib_id: uuid.UUID | None,
    admin_id: uuid.UUID, ip_address: str | None, db: AsyncSession,
) -> dict:
    """Admin assigns/changes the parent IB of an IB profile."""
    result = await db.execute(select(IBProfile).where(IBProfile.id == ib_id))
    ib = result.scalar_one_or_none()
    if not ib:
        raise HTTPException(status_code=404, detail="IB not found")

    old_parent = str(ib.parent_ib_id) if ib.parent_ib_id else None

    if parent_ib_id:
        if parent_ib_id == ib_id:
            raise HTTPException(status_code=400, detail="IB cannot be its own parent")
        parent_q = await db.execute(select(IBProfile).where(IBProfile.id == parent_ib_id))
        parent = parent_q.scalar_one_or_none()
        if not parent:
            raise HTTPException(status_code=404, detail="Parent IB not found")
        # Circular check
        check = parent
        for _ in range(20):
            if check.parent_ib_id is None:
                break
            if check.parent_ib_id == ib_id:
                raise HTTPException(status_code=400, detail="Circular hierarchy detected")
            chk_q = await db.execute(select(IBProfile).where(IBProfile.id == check.parent_ib_id))
            check = chk_q.scalar_one_or_none()
            if not check:
                break
        ib.parent_ib_id = parent_ib_id
        ib.level = (parent.level or 1) + 1
    else:
        ib.parent_ib_id = None
        ib.level = 1

    await write_audit_log(db, admin_id, "set_parent_ib", "ib_profile", ib_id,
        old_values={"parent_ib_id": old_parent},
        new_values={"parent_ib_id": str(parent_ib_id) if parent_ib_id else None},
        ip_address=ip_address)
    await db.commit()
    return {"message": "Parent IB updated", "ib_id": str(ib_id), "level": ib.level}


async def move_user_to_ib(
    user_id: uuid.UUID, new_ib_id: uuid.UUID,
    admin_id: uuid.UUID, ip_address: str | None, db: AsyncSession,
) -> dict:
    """Admin moves a trader from one IB to another."""
    ib_q = await db.execute(select(IBProfile).where(IBProfile.id == new_ib_id, IBProfile.is_active == True))
    new_ib = ib_q.scalar_one_or_none()
    if not new_ib:
        raise HTTPException(status_code=404, detail="Target IB not found")

    ref_q = await db.execute(select(Referral).where(Referral.referred_id == user_id))
    referral = ref_q.scalar_one_or_none()
    old_ib = str(referral.ib_profile_id) if referral and referral.ib_profile_id else None

    if referral:
        referral.ib_profile_id = new_ib.id
        referral.referrer_id = new_ib.user_id
    else:
        db.add(Referral(referrer_id=new_ib.user_id, referred_id=user_id, ib_profile_id=new_ib.id))

    await write_audit_log(db, admin_id, "move_user_to_ib", "referral", user_id,
        old_values={"ib_profile_id": old_ib},
        new_values={"ib_profile_id": str(new_ib.id)},
        ip_address=ip_address)
    await db.commit()
    return {"message": "User moved", "user_id": str(user_id), "new_ib_referral_code": new_ib.referral_code}


async def get_ib_tree(ib_id: uuid.UUID | None, db: AsyncSession) -> list[dict]:
    """Full IB hierarchy tree. ib_id=None returns all root IBs."""
    if ib_id:
        root_q = await db.execute(select(IBProfile).where(IBProfile.id == ib_id))
        root = root_q.scalar_one_or_none()
        return [await _build_ib_node(root, db)] if root else []
    roots_q = await db.execute(
        select(IBProfile).where(IBProfile.parent_ib_id.is_(None), IBProfile.is_active == True)
        .order_by(IBProfile.created_at))
    return [await _build_ib_node(r, db) for r in roots_q.scalars().all()]


async def _build_ib_node(ib, db: AsyncSession, depth: int = 0) -> dict:
    if depth > 10:
        return {}
    user_q = await db.execute(select(User).where(User.id == ib.user_id))
    user = user_q.scalar_one_or_none()
    ref_count = (await db.execute(
        select(func.count(Referral.id)).where(Referral.ib_profile_id == ib.id)
    )).scalar() or 0
    children_q = await db.execute(
        select(IBProfile).where(IBProfile.parent_ib_id == ib.id, IBProfile.is_active == True))
    children = children_q.scalars().all()
    return {
        "id": str(ib.id), "user_id": str(ib.user_id),
        "email": user.email if user else "?",
        "name": f"{user.first_name or ''} {user.last_name or ''}".strip() if user else "?",
        "referral_code": ib.referral_code, "level": ib.level or 1,
        "total_earned": float(ib.total_earned or 0), "referral_count": ref_count,
        "children": [await _build_ib_node(c, db, depth + 1) for c in children],
    }


async def get_unassigned_users(page: int, per_page: int, db: AsyncSession) -> dict:
    """Users who are not referred under any active IB."""
    from sqlalchemy import not_, exists
    subq = select(Referral.referred_id).where(Referral.ib_profile_id.isnot(None)).scalar_subquery()
    query = select(User).where(
        User.role.notin_(["ib", "sub_broker", "admin", "super_admin", "employee"]),
        not_(User.id.in_(subq)),
    )
    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar() or 0
    result = await db.execute(
        query.order_by(User.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    )
    items = []
    for u in result.scalars().all():
        items.append({
            "user_id": str(u.id),
            "email": u.email,
            "name": f"{u.first_name or ''} {u.last_name or ''}".strip(),
            "created_at": u.created_at.isoformat() if u.created_at else None,
        })
    return {"items": items, "total": total, "page": page, "per_page": per_page}


async def get_ib_referrals(ib_id: uuid.UUID, page: int, per_page: int, db: AsyncSession) -> dict:
    """Traders referred by a specific IB with commission data."""
    total = (await db.execute(
        select(func.count(Referral.id)).where(Referral.ib_profile_id == ib_id)
    )).scalar() or 0
    refs = await db.execute(
        select(Referral).where(Referral.ib_profile_id == ib_id)
        .order_by(Referral.created_at.desc()).offset((page - 1) * per_page).limit(per_page))
    items = []
    for r in refs.scalars().all():
        user_q = await db.execute(select(User).where(User.id == r.referred_id))
        user = user_q.scalar_one_or_none()
        if not user:
            continue
        from packages.common.src.models import Position, TradingAccount
        trade_count = (await db.execute(
            select(func.count(Position.id)).join(TradingAccount, Position.account_id == TradingAccount.id)
            .where(TradingAccount.user_id == user.id)
        )).scalar() or 0
        comm = (await db.execute(
            select(func.coalesce(func.sum(IBCommission.amount), 0))
            .where(IBCommission.ib_id == ib_id, IBCommission.source_user_id == user.id)
        )).scalar() or 0
        items.append({
            "user_id": str(user.id), "email": user.email,
            "name": f"{user.first_name or ''} {user.last_name or ''}".strip(),
            "trades": trade_count, "commission_generated": float(comm),
            "joined_at": user.created_at.isoformat() if user.created_at else None,
        })
    return {"referrals": items, "total": total, "page": page}


# ─── Copy-Trade Master Management ──────────────────────────────

async def list_masters(page: int, per_page: int, db: AsyncSession) -> dict:
    """List all copy-trade masters (signal_provider, pamm, mamm) with stats."""
    count_q = await db.execute(select(func.count(MasterAccount.id)))
    total = count_q.scalar() or 0

    result = await db.execute(
        select(MasterAccount, User.first_name, User.last_name, User.email)
        .join(User, MasterAccount.user_id == User.id)
        .order_by(MasterAccount.created_at.desc())
        .offset((page - 1) * per_page).limit(per_page)
    )
    rows = result.all()

    items = []
    for master, first_name, last_name, email in rows:
        active_q = await db.execute(
            select(func.count()).select_from(InvestorAllocation).where(
                InvestorAllocation.master_id == master.id,
                InvestorAllocation.status == "active",
            )
        )
        active_allocations = active_q.scalar() or 0

        pool_q = await db.execute(
            select(func.coalesce(func.sum(InvestorAllocation.allocation_amount), 0)).where(
                InvestorAllocation.master_id == master.id,
                InvestorAllocation.status == "active",
            )
        )
        total_aum = float(pool_q.scalar() or 0)

        items.append({
            "id": str(master.id),
            "user_id": str(master.user_id),
            "account_id": str(master.account_id) if master.account_id else None,
            "provider_name": f"{first_name or ''} {last_name or ''}".strip() or email,
            "email": email,
            "master_type": master.master_type or "signal_provider",
            "status": master.status,
            "active_followers": active_allocations,
            "total_aum": total_aum,
            "total_return_pct": float(master.total_return_pct or 0),
            "performance_fee_pct": float(master.performance_fee_pct or 0),
            "created_at": master.created_at.isoformat() if master.created_at else None,
        })

    return {
        "items": items, "total": total, "page": page, "per_page": per_page,
        "pages": (total + per_page - 1) // per_page if total else 0,
    }


async def delete_master(
    master_id: uuid.UUID, admin_id: uuid.UUID, ip_address: str | None, db: AsyncSession,
) -> dict:
    """Safely delete a copy-trade master. Flow:
      1. Close all open positions on master trading account (at open price, 0 pnl).
      2. Sweep master's trading account balance → master user's main wallet.
      3. For each active follower allocation:
         - Close open positions on investor copy account.
         - Refund investor copy account balance → follower's main wallet.
         - Mark allocation status = 'closed'.
      4. Close all open CopyTrade rows for this master.
      5. Delete the MasterAccount row.
    """
    master_q = await db.execute(select(MasterAccount).where(MasterAccount.id == master_id))
    master = master_q.scalar_one_or_none()
    if not master:
        raise HTTPException(status_code=404, detail="Master not found")

    master_acct = await db.get(TradingAccount, master.account_id) if master.account_id else None
    master_user = await db.get(User, master.user_id)
    master_sweep = Decimal("0")

    if master_acct:
        # Close open positions on master account
        master_open_q = await db.execute(
            select(Position).where(
                Position.account_id == master_acct.id,
                Position.status == PositionStatus.OPEN.value,
            )
        )
        for pos in master_open_q.scalars().all():
            pos.status = PositionStatus.CLOSED.value
            pos.close_price = pos.open_price
            pos.profit = Decimal("0")
            pos.closed_at = datetime.utcnow()

        master_sweep = (master_acct.balance or Decimal("0")) + (master_acct.credit or Decimal("0"))
        if master_user and master_sweep > 0:
            master_user.main_wallet_balance = (
                master_user.main_wallet_balance or Decimal("0")
            ) + master_sweep
            db.add(Transaction(
                user_id=master_user.id,
                account_id=master_acct.id,
                type="transfer",
                amount=master_sweep,
                balance_after=master_user.main_wallet_balance,
                description="Master account closed by admin — funds returned to main wallet",
            ))
        master_acct.balance = Decimal("0")
        master_acct.credit = Decimal("0")
        master_acct.equity = Decimal("0")
        master_acct.free_margin = Decimal("0")
        master_acct.margin_used = Decimal("0")
        # Deactivate the deleted master's trading account so it disappears from
        # the user's accounts list. Re-applying as master creates a fresh
        # CT/PM/MM trading account automatically.
        master_acct.is_active = False

    # Refund each follower
    allocs_q = await db.execute(
        select(InvestorAllocation).where(
            InvestorAllocation.master_id == master_id,
            InvestorAllocation.status == "active",
        )
    )
    follower_count = 0
    total_refunded = Decimal("0")
    for alloc in allocs_q.scalars().all():
        follower_count += 1
        investor = await db.get(User, alloc.investor_user_id)
        investor_acct = await db.get(TradingAccount, alloc.investor_account_id) if alloc.investor_account_id else None

        if investor_acct:
            inv_open_q = await db.execute(
                select(Position).where(
                    Position.account_id == investor_acct.id,
                    Position.status == PositionStatus.OPEN.value,
                )
            )
            for pos in inv_open_q.scalars().all():
                pos.status = PositionStatus.CLOSED.value
                pos.close_price = pos.open_price
                pos.profit = Decimal("0")
                pos.closed_at = datetime.utcnow()

        refund_amount = Decimal("0")
        if investor_acct:
            refund_amount = (investor_acct.balance or Decimal("0")) + (investor_acct.credit or Decimal("0"))
            investor_acct.balance = Decimal("0")
            investor_acct.credit = Decimal("0")
            investor_acct.equity = Decimal("0")
            investor_acct.free_margin = Decimal("0")
            investor_acct.margin_used = Decimal("0")
            investor_acct.is_active = False

        if investor and refund_amount > 0:
            investor.main_wallet_balance = (
                investor.main_wallet_balance or Decimal("0")
            ) + refund_amount
            total_refunded += refund_amount
            # Use "transfer" type (already in DB CHECK constraint) to avoid
            # migration headaches on existing deployments.
            db.add(Transaction(
                user_id=investor.id,
                account_id=investor_acct.id if investor_acct else None,
                type="transfer",
                amount=refund_amount,
                balance_after=investor.main_wallet_balance,
                description="Master deleted by admin — copy trade refund to main wallet",
            ))

        alloc.status = "closed"

    # Close open CopyTrade rows for this master
    copy_trades_q = await db.execute(
        select(CopyTrade)
        .join(InvestorAllocation, CopyTrade.investor_allocation_id == InvestorAllocation.id)
        .where(
            InvestorAllocation.master_id == master_id,
            CopyTrade.status == "open",
        )
    )
    for ct in copy_trades_q.scalars().all():
        ct.status = "closed"

    # Don't hard-delete the MasterAccount row — FK constraints from
    # investor_allocations & copy_trades prevent it. Mark as 'rejected' instead.
    # This preserves history (closed allocations still viewable) and allows the
    # user to re-apply as a master from scratch (become_provider filters out
    # non-approved rows).
    master_email = master_user.email if master_user else "unknown"
    master.status = "rejected"
    master.followers_count = 0

    await write_audit_log(
        db, admin_id, "delete_master", "master_account", master_id,
        new_values={
            "master_email": master_email,
            "master_sweep": float(master_sweep),
            "followers_refunded": follower_count,
            "total_refunded_to_followers": float(total_refunded),
        },
        ip_address=ip_address,
    )
    await db.commit()

    return {
        "message": f"Master deleted — {follower_count} follower(s) refunded",
        "master_sweep": float(master_sweep),
        "followers_refunded": follower_count,
        "total_refunded_to_followers": float(total_refunded),
    }
