"""Admin notifications — live feed of items needing attention.

Aggregated from current state (no separate table): pending KYC submissions
and open support tickets. The badge count reflects what is still outstanding,
so it clears automatically once an admin approves the KYC / resolves the ticket.
"""
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.models import User, SupportTicket


async def get_admin_notifications(db: AsyncSession, limit: int = 20) -> dict:
    # --- pending KYC submissions ---
    kyc_count = (await db.execute(
        select(func.count(User.id)).where(User.kyc_status == "submitted")
    )).scalar() or 0

    kyc_rows = (await db.execute(
        select(User).where(User.kyc_status == "submitted")
        .order_by(User.updated_at.desc()).limit(limit)
    )).scalars().all()

    # --- open / in-progress support tickets ---
    ticket_count = (await db.execute(
        select(func.count(SupportTicket.id))
        .where(SupportTicket.status.in_(["open", "in_progress"]))
    )).scalar() or 0

    ticket_rows = (await db.execute(
        select(SupportTicket).where(SupportTicket.status.in_(["open", "in_progress"]))
        .order_by(SupportTicket.created_at.desc()).limit(limit)
    )).scalars().all()

    items = []
    for u in kyc_rows:
        name = f"{u.first_name or ''} {u.last_name or ''}".strip() or u.email
        ts = u.updated_at or u.created_at
        items.append({
            "type": "kyc",
            "title": "New KYC submission",
            "subtitle": name,
            "email": u.email,
            "time": ts.isoformat() if ts else None,
            "link": "/kyc",
        })
    for t in ticket_rows:
        items.append({
            "type": "ticket",
            "title": "New support ticket",
            "subtitle": t.subject,
            "time": t.created_at.isoformat() if t.created_at else None,
            "link": "/support",
        })

    items.sort(key=lambda x: x["time"] or "", reverse=True)

    return {
        "unread_count": int(kyc_count) + int(ticket_count),
        "kyc_count": int(kyc_count),
        "ticket_count": int(ticket_count),
        "items": items[:limit],
    }
