"""Paginated trader activity audit (register, login, logout, orders) for admins."""
import uuid
from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from dependencies import require_permission
from packages.common.src.database import get_db
from packages.common.src.models import User
from services import user_audit_log_service

router = APIRouter(prefix="/audit-logs", tags=["Audit logs"])


@router.get("")
async def list_user_audit_logs(
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    user_id: uuid.UUID | None = Query(None),
    action_type: str | None = Query(None),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    admin: User = Depends(require_permission("audit_logs.view")),
    db: AsyncSession = Depends(get_db),
):
    return await user_audit_log_service.list_user_audit_logs(
        page=page, per_page=per_page, user_id=user_id, action_type=action_type,
        date_from=date_from, date_to=date_to, db=db,
    )
