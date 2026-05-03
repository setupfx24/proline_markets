import uuid

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import get_db
from dependencies import require_permission
from packages.common.src.models import User
from packages.common.src.admin_schemas import TicketReplyRequest, TicketStatusUpdate, TicketAssignRequest
from services import support_service

router = APIRouter(prefix="/support", tags=["Support"])


@router.get("/tickets")
async def list_tickets(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    status_filter: str = Query(None, alias="status"),
    priority_filter: str = Query(None, alias="priority"),
    admin: User = Depends(require_permission("tickets.view")),
    db: AsyncSession = Depends(get_db),
):
    return await support_service.list_tickets(
        page=page, per_page=per_page,
        status_filter=status_filter, priority_filter=priority_filter, db=db,
    )


@router.get("/tickets/{ticket_id}")
async def get_ticket_detail(
    ticket_id: uuid.UUID,
    admin: User = Depends(require_permission("tickets.view")),
    db: AsyncSession = Depends(get_db),
):
    return await support_service.get_ticket_detail(ticket_id=ticket_id, db=db)


@router.post("/tickets/{ticket_id}/reply")
async def reply_to_ticket(
    ticket_id: uuid.UUID,
    body: TicketReplyRequest,
    request: Request,
    admin: User = Depends(require_permission("tickets.reply")),
    db: AsyncSession = Depends(get_db),
):
    return await support_service.reply_to_ticket(
        ticket_id=ticket_id, body=body, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.put("/tickets/{ticket_id}/assign")
async def assign_ticket(
    ticket_id: uuid.UUID,
    body: TicketAssignRequest,
    request: Request,
    admin: User = Depends(require_permission("tickets.assign")),
    db: AsyncSession = Depends(get_db),
):
    return await support_service.assign_ticket(
        ticket_id=ticket_id, body=body, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.put("/tickets/{ticket_id}/status")
async def update_ticket_status(
    ticket_id: uuid.UUID,
    body: TicketStatusUpdate,
    request: Request,
    admin: User = Depends(require_permission("tickets.assign")),
    db: AsyncSession = Depends(get_db),
):
    return await support_service.update_ticket_status(
        ticket_id=ticket_id, body=body, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )
