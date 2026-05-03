"""Notification Service — List, mark read, unread count."""
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select, update, func
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.models import Notification


async def list_notifications(
    user_id: UUID, unread_only: bool, page: int, per_page: int, db: AsyncSession,
) -> dict:
    base = select(Notification).where(Notification.user_id == user_id)
    if unread_only:
        base = base.where(Notification.is_read == False)

    count_q = select(func.count()).select_from(Notification).where(Notification.user_id == user_id)
    if unread_only:
        count_q = count_q.where(Notification.is_read == False)
    total = (await db.execute(count_q)).scalar()

    result = await db.execute(
        base.order_by(Notification.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    notifications = result.scalars().all()

    return {
        "items": [
            {
                "id": str(n.id),
                "title": n.title,
                "message": n.message,
                "type": n.type,
                "is_read": n.is_read,
                "action_url": n.action_url,
                "created_at": n.created_at.isoformat() if n.created_at else None,
            }
            for n in notifications
        ],
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": (total + per_page - 1) // per_page if total else 0,
    }


async def mark_as_read(user_id: UUID, notification_id: UUID, db: AsyncSession) -> dict:
    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == user_id,
        )
    )
    notification = result.scalar_one_or_none()
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    notification.is_read = True
    await db.commit()
    return {"message": "Notification marked as read"}


async def mark_all_read(user_id: UUID, db: AsyncSession) -> dict:
    await db.execute(
        update(Notification)
        .where(Notification.user_id == user_id, Notification.is_read == False)
        .values(is_read=True)
    )
    await db.commit()
    return {"message": "All notifications marked as read"}


async def unread_count(user_id: UUID, db: AsyncSession) -> dict:
    result = await db.execute(
        select(func.count()).select_from(Notification).where(
            Notification.user_id == user_id,
            Notification.is_read == False,
        )
    )
    return {"unread_count": result.scalar()}
