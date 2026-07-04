"""Admin service — manage read-only "Investor Access" logins.

Each investor login is an email+password (created by an admin) tied to exactly
ONE trading account. The gateway's /auth/investor/login issues a read-only
session for that account; all write actions are blocked platform-wide."""
import secrets
import uuid

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.auth import hash_password
from packages.common.src.models import User, TradingAccount, InvestorAccess
from packages.common.src.admin_schemas import InvestorIn, InvestorUpdate
from dependencies import write_audit_log


async def list_investors(db: AsyncSession) -> dict:
    result = await db.execute(select(InvestorAccess).order_by(InvestorAccess.created_at.desc()))
    rows = result.scalars().all()

    items = []
    for inv in rows:
        acc_q = await db.execute(select(TradingAccount).where(TradingAccount.id == inv.account_id))
        acc = acc_q.scalar_one_or_none()
        owner = None
        if acc:
            o_q = await db.execute(select(User).where(User.id == acc.user_id))
            owner = o_q.scalar_one_or_none()
        items.append({
            "id": str(inv.id),
            "email": inv.email,
            "label": inv.label,
            "is_active": inv.is_active,
            "account_id": str(inv.account_id),
            "account_number": acc.account_number if acc else None,
            "owner_email": owner.email if owner else None,
            "owner_name": (f"{owner.first_name or ''} {owner.last_name or ''}".strip() if owner else None),
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
    acc_q = await db.execute(
        select(TradingAccount).where(TradingAccount.account_number == body.account_number.strip())
    )
    account = acc_q.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="No trading account found for that account number")

    email = body.email.strip().lower()
    exists_q = await db.execute(select(InvestorAccess).where(InvestorAccess.email == email))
    if exists_q.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="An investor login with this email already exists")

    raw_password = body.password or secrets.token_urlsafe(10)
    inv = InvestorAccess(
        email=email,
        password_hash=hash_password(raw_password),
        account_id=account.id,
        label=(body.label or None),
        is_active=True,
        created_by=admin.id,
    )
    db.add(inv)
    await db.flush()

    await write_audit_log(
        db, admin.id, "create_investor_access", "investor_access", inv.id,
        new_values={"email": email, "account_number": account.account_number},
        ip_address=ip_address,
    )
    await db.commit()
    return {
        "message": "Investor access created",
        "id": str(inv.id),
        "email": email,
        "account_number": account.account_number,
        "password": raw_password,  # shown once to the admin
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
