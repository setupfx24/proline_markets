"""REST aliases: /api/v1/admin/instruments — master list + config CRUD."""

import uuid
from typing import Any

from fastapi import APIRouter, Depends, Request, Query
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import get_db
from dependencies import require_permission
from packages.common.src.models import User
from services import instruments_admin_service

router = APIRouter(prefix="/instruments", tags=["Instruments"])


@router.get("")
async def list_instruments(
    admin: User = Depends(require_permission("config.view")),
    db: AsyncSession = Depends(get_db),
    search: str | None = Query(None),
    segment: str | None = Query(None),
    include_inactive: bool = Query(True),
):
    return await instruments_admin_service.list_instruments(
        db=db, search=search, segment=segment, include_inactive=include_inactive,
    )


@router.get("/{instrument_id}")
async def get_instrument(
    instrument_id: uuid.UUID,
    admin: User = Depends(require_permission("config.view")),
    db: AsyncSession = Depends(get_db),
):
    return await instruments_admin_service.get_instrument(instrument_id=instrument_id, db=db)


@router.put("/{instrument_id}/config")
async def put_instrument_config(
    instrument_id: uuid.UUID,
    body: dict[str, Any],
    request: Request,
    admin: User = Depends(require_permission("config.update")),
    db: AsyncSession = Depends(get_db),
):
    return await instruments_admin_service.put_instrument_config(
        instrument_id=instrument_id, body=body, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.post("")
async def create_instrument(
    body: dict[str, Any],
    request: Request,
    admin: User = Depends(require_permission("config.update")),
    db: AsyncSession = Depends(get_db),
):
    return await instruments_admin_service.create_instrument(
        body=body, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.delete("/{instrument_id}")
async def deactivate_instrument(
    instrument_id: uuid.UUID,
    request: Request,
    admin: User = Depends(require_permission("config.update")),
    db: AsyncSession = Depends(get_db),
):
    return await instruments_admin_service.deactivate_instrument(
        instrument_id=instrument_id, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.post("/bulk-update")
async def bulk_update_configs(
    body: dict[str, Any],
    request: Request,
    admin: User = Depends(require_permission("config.update")),
    db: AsyncSession = Depends(get_db),
):
    return await instruments_admin_service.bulk_update_configs(
        body=body, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )
