import uuid

from fastapi import APIRouter, Depends, Request, Query
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import get_db
from dependencies import require_permission
from packages.common.src.models import User
from packages.common.src.admin_schemas import BulkChargeUpdate, BulkSpreadUpdate, BulkSwapUpdate
from services import config_service

router = APIRouter(prefix="/config", tags=["Configuration"])


@router.get("/instruments")
async def list_config_instruments(
    admin: User = Depends(require_permission("config.view")),
    db: AsyncSession = Depends(get_db),
    search: str | None = Query(None),
    segment: str | None = Query(None),
    include_inactive: bool = Query(True),
):
    return await config_service.list_config_instruments(
        db=db, search=search, segment=segment, include_inactive=include_inactive,
    )


@router.put("/instrument/{instrument_id}")
async def update_instrument_config(
    instrument_id: uuid.UUID,
    body: dict,
    request: Request,
    admin: User = Depends(require_permission("config.update")),
    db: AsyncSession = Depends(get_db),
):
    """Save charge, spread, swap, price impact (instrument_configs + engine sync)."""
    return await config_service.update_instrument_config(
        instrument_id=instrument_id, body=body, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.get("/charges")
async def list_charges(
    admin: User = Depends(require_permission("config.view")),
    db: AsyncSession = Depends(get_db),
):
    return await config_service.list_charges(db=db)


@router.put("/charges")
async def update_charges(
    body: BulkChargeUpdate,
    request: Request,
    admin: User = Depends(require_permission("config.update")),
    db: AsyncSession = Depends(get_db),
):
    return await config_service.update_charges(
        body=body, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.get("/spreads")
async def list_spreads(
    admin: User = Depends(require_permission("config.view")),
    db: AsyncSession = Depends(get_db),
):
    return await config_service.list_spreads(db=db)


@router.put("/spreads")
async def update_spreads(
    body: BulkSpreadUpdate,
    request: Request,
    admin: User = Depends(require_permission("config.update")),
    db: AsyncSession = Depends(get_db),
):
    return await config_service.update_spreads(
        body=body, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.get("/swaps")
async def list_swaps(
    admin: User = Depends(require_permission("config.view")),
    db: AsyncSession = Depends(get_db),
):
    return await config_service.list_swaps(db=db)


@router.put("/swaps")
async def update_swaps(
    body: BulkSwapUpdate,
    request: Request,
    admin: User = Depends(require_permission("config.update")),
    db: AsyncSession = Depends(get_db),
):
    return await config_service.update_swaps(
        body=body, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )
