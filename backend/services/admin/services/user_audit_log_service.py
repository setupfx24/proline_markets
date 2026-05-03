"""Admin User Audit Log Service — paginated listing with filters."""
import logging
import uuid
from datetime import date, datetime, time, timezone

from fastapi import HTTPException
from sqlalchemy import select, func
from sqlalchemy.exc import ProgrammingError, DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.models import UserAuditLog, User
from packages.common.src.admin_schemas import PaginatedResponse, UserAuditLogOut

_log = logging.getLogger("uvicorn.error")

_MISSING_TABLE_USER_MSG = (
    "Audit logs are not set up yet: the database table is missing. "
    "Apply migration 006_user_audit_logs.sql on the main Postgres database, then retry."
)


def _is_missing_user_audit_table(exc: BaseException) -> bool:
    orig = getattr(exc, "orig", None)
    msg = f"{orig or exc}".lower()
    return "user_audit_logs" in msg and ("does not exist" in msg or "undefinedtable" in msg)


def _apply_filters(
    stmt,
    *,
    user_id: uuid.UUID | None,
    action_type: str | None,
    date_from: date | None,
    date_to: date | None,
):
    if user_id:
        stmt = stmt.where(UserAuditLog.user_id == user_id)
    if action_type:
        stmt = stmt.where(UserAuditLog.action_type == action_type)
    if date_from:
        stmt = stmt.where(UserAuditLog.created_at >= datetime.combine(date_from, time.min, tzinfo=timezone.utc))
    if date_to:
        stmt = stmt.where(UserAuditLog.created_at <= datetime.combine(date_to, time.max, tzinfo=timezone.utc))
    return stmt


async def list_user_audit_logs(
    page: int,
    per_page: int,
    user_id: uuid.UUID | None,
    action_type: str | None,
    date_from: date | None,
    date_to: date | None,
    db: AsyncSession,
) -> PaginatedResponse:
    try:
        base = select(UserAuditLog, User).join(User, UserAuditLog.user_id == User.id, isouter=True)
        base = _apply_filters(base, user_id=user_id, action_type=action_type, date_from=date_from, date_to=date_to)

        count_q = select(func.count()).select_from(
            _apply_filters(select(UserAuditLog), user_id=user_id, action_type=action_type, date_from=date_from, date_to=date_to).subquery()
        )
        total = (await db.execute(count_q)).scalar() or 0

        base = base.order_by(UserAuditLog.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
        result = await db.execute(base)
        rows = result.all()
    except (ProgrammingError, DBAPIError) as exc:
        _log.warning("user_audit_logs query failed: %s", exc)
        if _is_missing_user_audit_table(exc):
            raise HTTPException(status_code=503, detail=_MISSING_TABLE_USER_MSG)
        raise

    items = [
        UserAuditLogOut(
            id=str(log.id),
            user_id=str(log.user_id),
            user_email=u.email,
            user_name=(
                f"{(u.first_name or '').strip()} {(u.last_name or '').strip()}".strip() or None
            ),
            action_type=log.action_type,
            ip_address=log.ip_address,
            device_info=log.device_info,
            created_at=log.created_at,
        )
        for log, u in rows
    ]

    return PaginatedResponse(items=items, total=total, page=page, per_page=per_page)
