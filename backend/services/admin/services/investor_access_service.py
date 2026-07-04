"""Admin service — manage read-only "Investor Access" logins.

Each investor login is tied to ONE platform user. The admin picks a user and a
credential is generated (email = the user's email, random password). The gateway's
/auth/investor/login issues a read-only session for that user; every write action
is blocked platform-wide."""
import secrets
import uuid

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.auth import hash_password
from packages.common.src.models import User, InvestorAccess
from packages.common.src.admin_schemas import InvestorIn, InvestorUpdate
from dependencies import write_audit_log


def _user_name(u: User | None) -> str | None:
    if not u:
        return None
    name = f"{u.first_name or ''} {u.last_name or ''}".strip()
    return name or (u.email.split("@")[0] if u.email else None)


async def list_investors(db: AsyncSession) -> dict:
    result = await db.execute(select(InvestorAccess).order_by(InvestorAccess.created_at.desc()))
    rows = result.scalars().all()

    items = []
    for inv in rows:
        u_q = await db.execute(select(User).where(User.id == inv.user_id))
        u = u_q.scalar_one_or_none()
        items.append({
            "id": str(inv.id),
            "email": inv.email,
            "label": inv.label,
            "is_active": inv.is_active,
            "user_id": str(inv.user_id),
            "user_email": u.email if u else None,
            "user_name": _user_name(u),
            "last_login_at": inv.last_login_at.isoformat() if inv.last_login_at else None,
            "created_at": inv.created_at.isoformat() if inv.created_at else None,
        })
    return {"investors": items}


async def create_investor(
    body: InvestorIn,
    admin: User,
    ip_address: str | None,
    db: AsyncSession,
) -> dict:
    """Create — or regenerate the password for — the investor login of one user.
    One investor login per user; clicking again just rotates the password."""
    try:
        target_id = uuid.UUID(str(body.user_id))
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid user id")

    u_q = await db.execute(select(User).where(User.id == target_id))
    user = u_q.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    raw_password = secrets.token_urlsafe(9)

    existing_q = await db.execute(select(InvestorAccess).where(InvestorAccess.user_id == user.id))
    inv = existing_q.scalar_one_or_none()
    if inv:
        inv.password_hash = hash_password(raw_password)
        inv.is_active = True
        if body.label is not None:
            inv.label = body.label or None
        action = "regenerate_investor_access"
    else:
        inv = InvestorAccess(
            email=user.email,
            password_hash=hash_password(raw_password),
            user_id=user.id,
            label=(body.label or None),
            is_active=True,
            created_by=admin.id,
        )
        db.add(inv)
        action = "create_investor_access"

    await db.flush()
    await write_audit_log(
        db, admin.id, action, "investor_access", inv.id,
        new_values={"user_id": str(user.id), "email": user.email},
        ip_address=ip_address,
    )
    await db.commit()
    return {
        "message": "Investor access ready",
        "id": str(inv.id),
        "email": user.email,       # the investor logs in with the user's email
        "password": raw_password,  # shown once to the admin
        "user_name": _user_name(user),
        "regenerated": action == "regenerate_investor_access",
    }


async def update_investor(
    investor_id: uuid.UUID,
    body: InvestorUpdate,
    admin: User,
    ip_address: str | None,
    db: AsyncSession,
) -> dict:
    inv_q = await db.execute(select(InvestorAccess).where(InvestorAccess.id == investor_id))
    inv = inv_q.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Investor access not found")

    result = {"message": "Investor access updated", "id": str(inv.id)}
    if body.is_active is not None:
        inv.is_active = body.is_active
    if body.label is not None:
        inv.label = body.label or None
    if body.password:
        inv.password_hash = hash_password(body.password)
        result["password"] = body.password

    await write_audit_log(
        db, admin.id, "update_investor_access", "investor_access", inv.id,
        new_values={"is_active": inv.is_active, "password_reset": bool(body.password)},
        ip_address=ip_address,
    )
    await db.commit()
    return result


async def delete_investor(
    investor_id: uuid.UUID,
    admin: User,
    ip_address: str | None,
    db: AsyncSession,
) -> dict:
    inv_q = await db.execute(select(InvestorAccess).where(InvestorAccess.id == investor_id))
    inv = inv_q.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Investor access not found")

    email = inv.email
    await db.delete(inv)
    await write_audit_log(
        db, admin.id, "delete_investor_access", "investor_access", investor_id,
        new_values={"email": email}, ip_address=ip_address,
    )
    await db.commit()
    return {"message": "Investor access deleted"}
