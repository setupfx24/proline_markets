"""Support Service — Ticket creation, listing, replies."""
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.models import SupportTicket, TicketMessage


async def list_tickets(
    user_id: UUID, status: str | None, page: int, per_page: int, db: AsyncSession,
) -> dict:
    base_filter = [SupportTicket.user_id == user_id]
    if status:
        base_filter.append(SupportTicket.status == status)

    count_result = await db.execute(
        select(func.count()).select_from(SupportTicket).where(*base_filter)
    )
    total = count_result.scalar() or 0

    result = await db.execute(
        select(SupportTicket)
        .where(*base_filter)
        .order_by(SupportTicket.updated_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    tickets = result.scalars().all()

    ticket_ids = [t.id for t in tickets]
    counts = {}
    if ticket_ids:
        cnt_rows = await db.execute(
            select(TicketMessage.ticket_id, func.count(TicketMessage.id))
            .where(TicketMessage.ticket_id.in_(ticket_ids))
            .group_by(TicketMessage.ticket_id)
        )
        counts = {row[0]: int(row[1]) for row in cnt_rows.all()}

    items = []
    for t in tickets:
        items.append({
            "id": str(t.id),
            "subject": t.subject,
            "status": t.status,
            "priority": t.priority,
            "message_count": counts.get(t.id, 0),
            "created_at": t.created_at.isoformat() if t.created_at else None,
            "updated_at": t.updated_at.isoformat() if t.updated_at else None,
        })

    return {
        "items": items,
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": (total + per_page - 1) // per_page if total else 0,
    }


async def create_ticket(
    user_id: UUID, subject: str, message: str, priority: str, db: AsyncSession,
) -> dict:
    ticket = SupportTicket(
        user_id=user_id,
        subject=subject,
        status="open",
        priority=priority,
    )
    db.add(ticket)
    await db.flush()

    first_message = TicketMessage(
        ticket_id=ticket.id,
        sender_id=user_id,
        message=message,
        is_admin=False,
    )
    db.add(first_message)
    await db.commit()
    await db.refresh(ticket)
    await db.refresh(first_message)

    return {
        "id": str(ticket.id),
        "subject": ticket.subject,
        "status": ticket.status,
        "priority": ticket.priority,
        "message": {
            "id": str(first_message.id),
            "message": first_message.message,
            "created_at": first_message.created_at.isoformat() if first_message.created_at else None,
        },
        "created_at": ticket.created_at.isoformat() if ticket.created_at else None,
    }


async def get_ticket(user_id: UUID, ticket_id: UUID, db: AsyncSession) -> dict:
    result = await db.execute(
        select(SupportTicket).where(
            SupportTicket.id == ticket_id,
            SupportTicket.user_id == user_id,
        )
    )
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    all_messages_result = await db.execute(
        select(TicketMessage)
        .where(TicketMessage.ticket_id == ticket_id)
        .order_by(TicketMessage.created_at.asc())
    )
    all_msgs = all_messages_result.scalars().all()

    messages = []
    for m in all_msgs:
        messages.append({
            "id": str(m.id),
            "message": m.message,
            "is_admin": m.is_admin,
            "attachments": m.attachments,
            "created_at": m.created_at.isoformat() if m.created_at else None,
        })

    return {
        "id": str(ticket.id),
        "subject": ticket.subject,
        "status": ticket.status,
        "priority": ticket.priority,
        "messages": messages,
        "created_at": ticket.created_at.isoformat() if ticket.created_at else None,
        "updated_at": ticket.updated_at.isoformat() if ticket.updated_at else None,
    }


async def reply_ticket(
    user_id: UUID, ticket_id: UUID, message_text: str,
    attachments: list | None, db: AsyncSession,
) -> dict:
    result = await db.execute(
        select(SupportTicket).where(
            SupportTicket.id == ticket_id,
            SupportTicket.user_id == user_id,
        )
    )
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if ticket.status == "closed":
        raise HTTPException(status_code=400, detail="Cannot reply to a closed ticket")

    message = TicketMessage(
        ticket_id=ticket_id,
        sender_id=user_id,
        message=message_text,
        attachments=attachments,
        is_admin=False,
    )
    db.add(message)

    if ticket.status == "resolved":
        ticket.status = "open"

    await db.commit()
    await db.refresh(message)

    return {
        "id": str(message.id),
        "ticket_id": str(ticket_id),
        "message": message.message,
        "attachments": message.attachments,
        "created_at": message.created_at.isoformat() if message.created_at else None,
    }
