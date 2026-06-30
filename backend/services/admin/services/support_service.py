"""Admin Support Service — tickets listing, detail, reply, assign, status."""
import uuid
from datetime import datetime

from fastapi import HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.models import User, SupportTicket, TicketMessage
from packages.common.src.notify import create_notification
from packages.common.src.admin_schemas import (
    TicketOut, TicketDetailOut, TicketMessageOut, PaginatedResponse,
    TicketReplyRequest, TicketStatusUpdate, TicketAssignRequest,
)
from dependencies import write_audit_log


def _ticket_to_out(t: SupportTicket, user: User = None, msg_count: int = 0) -> TicketOut:
    return TicketOut(
        id=str(t.id),
        user_id=str(t.user_id),
        subject=t.subject,
        status=t.status,
        priority=t.priority,
        assigned_to=str(t.assigned_to) if t.assigned_to else None,
        created_at=t.created_at,
        updated_at=t.updated_at,
        user_email=user.email if user else None,
        user_name=f"{user.first_name or ''} {user.last_name or ''}".strip() if user else None,
        message_count=msg_count,
    )


async def list_tickets(
    page: int,
    per_page: int,
    status_filter: str | None,
    priority_filter: str | None,
    db: AsyncSession,
) -> PaginatedResponse:
    query = select(SupportTicket)
    if status_filter:
        query = query.where(SupportTicket.status == status_filter)
    if priority_filter:
        query = query.where(SupportTicket.priority == priority_filter)

    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    query = query.order_by(SupportTicket.updated_at.desc()).offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    tickets = result.scalars().all()

    items = []
    for t in tickets:
        user_q = await db.execute(select(User).where(User.id == t.user_id))
        user = user_q.scalar_one_or_none()

        msg_count_q = await db.execute(
            select(func.count(TicketMessage.id)).where(TicketMessage.ticket_id == t.id)
        )
        msg_count = msg_count_q.scalar() or 0

        items.append(_ticket_to_out(t, user, msg_count))

    return PaginatedResponse(items=items, total=total, page=page, per_page=per_page)


async def get_ticket_detail(ticket_id: uuid.UUID, db: AsyncSession) -> TicketDetailOut:
    result = await db.execute(select(SupportTicket).where(SupportTicket.id == ticket_id))
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    user_q = await db.execute(select(User).where(User.id == ticket.user_id))
    user = user_q.scalar_one_or_none()

    msg_q = await db.execute(
        select(TicketMessage).where(TicketMessage.ticket_id == ticket_id).order_by(TicketMessage.created_at.asc())
    )
    messages = msg_q.scalars().all()

    msg_count_q = await db.execute(
        select(func.count(TicketMessage.id)).where(TicketMessage.ticket_id == ticket_id)
    )
    msg_count = msg_count_q.scalar() or 0

    msg_items = []
    for m in messages:
        sender_q = await db.execute(select(User).where(User.id == m.sender_id))
        sender = sender_q.scalar_one_or_none()
        msg_items.append(TicketMessageOut(
            id=str(m.id),
            ticket_id=str(m.ticket_id),
            sender_id=str(m.sender_id),
            message=m.message,
            attachments=m.attachments,
            is_admin=m.is_admin or False,
            created_at=m.created_at,
            sender_name=f"{sender.first_name or ''} {sender.last_name or ''}".strip() if sender else None,
        ))

    return TicketDetailOut(
        ticket=_ticket_to_out(ticket, user, msg_count),
        messages=msg_items,
    )


async def reply_to_ticket(
    ticket_id: uuid.UUID,
    body: TicketReplyRequest,
    admin_id: uuid.UUID,
    ip_address: str | None,
    db: AsyncSession,
) -> dict:
    result = await db.execute(select(SupportTicket).where(SupportTicket.id == ticket_id))
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    message = TicketMessage(
        ticket_id=ticket_id,
        sender_id=admin_id,
        message=body.message,
        attachments=body.attachments,
        is_admin=True,
    )
    db.add(message)

    if ticket.status == "open":
        ticket.status = "in_progress"
    ticket.updated_at = datetime.utcnow()

    await write_audit_log(
        db, admin_id, "reply_ticket", "support_ticket", ticket_id,
        new_values={"message_length": len(body.message)},
        ip_address=ip_address,
    )
    await create_notification(
        db, ticket.user_id,
        title="Support replied to your ticket",
        message=f"Our team replied to your ticket “{ticket.subject}”.",
        notif_type="support",
        action_url="/support",
        commit=False,
    )
    await db.commit()
    return {"message": "Reply sent successfully"}


async def assign_ticket(
    ticket_id: uuid.UUID,
    body: TicketAssignRequest,
    admin_id: uuid.UUID,
    ip_address: str | None,
    db: AsyncSession,
) -> dict:
    result = await db.execute(select(SupportTicket).where(SupportTicket.id == ticket_id))
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    old_assigned = str(ticket.assigned_to) if ticket.assigned_to else None
    ticket.assigned_to = uuid.UUID(body.admin_id)
    ticket.updated_at = datetime.utcnow()

    await write_audit_log(
        db, admin_id, "assign_ticket", "support_ticket", ticket_id,
        old_values={"assigned_to": old_assigned},
        new_values={"assigned_to": body.admin_id},
        ip_address=ip_address,
    )
    await db.commit()
    return {"message": "Ticket assigned"}


async def update_ticket_status(
    ticket_id: uuid.UUID,
    body: TicketStatusUpdate,
    admin_id: uuid.UUID,
    ip_address: str | None,
    db: AsyncSession,
) -> dict:
    result = await db.execute(select(SupportTicket).where(SupportTicket.id == ticket_id))
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    valid_statuses = ["open", "in_progress", "resolved", "escalated", "closed"]
    if body.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")

    old_status = ticket.status
    ticket.status = body.status
    ticket.updated_at = datetime.utcnow()

    await write_audit_log(
        db, admin_id, "update_ticket_status", "support_ticket", ticket_id,
        old_values={"status": old_status},
        new_values={"status": body.status},
        ip_address=ip_address,
    )
    if body.status != old_status:
        await create_notification(
            db, ticket.user_id,
            title="Support ticket updated",
            message=f"Your ticket “{ticket.subject}” is now {body.status.replace('_', ' ')}.",
            notif_type="support",
            action_url="/support",
            commit=False,
        )
    await db.commit()
    return {"message": "Ticket status updated"}
