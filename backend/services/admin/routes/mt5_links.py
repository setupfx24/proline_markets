"""Admin routes for MT5 account links (MetaApi → platform account mappings)."""
import uuid

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import get_db
from packages.common.src.models import User
from dependencies import require_permission
from services import mt5_link_service
from services.mt5_link_service import MT5LinkIn, MT5ConfigIn

router = APIRouter(prefix="/mt5-links", tags=["MT5 Links"])


@router.get("/config")
async def get_mt5_config(
    admin: User = Depends(require_permission("config.view")),
    db: AsyncSession = Depends(get_db),
):
    return await mt5_link_service.get_config(db=db)


@router.put("/config")
async def update_mt5_config(
    body: MT5ConfigIn,
    request: Request,
    admin: User = Depends(require_permission("config.update")),
    db: AsyncSession = Depends(get_db),
):
    return await mt5_link_service.update_config(
        body=body, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.get("")
async def list_mt5_links(
    admin: User = Depends(require_permission("config.view")),
    db: AsyncSession = Depends(get_db),
):
    return await mt5_link_service.list_links(db=db)


@router.post("")
async def create_mt5_link(
    body: MT5LinkIn,
    request: Request,
    admin: User = Depends(require_permission("config.update")),
    db: AsyncSession = Depends(get_db),
):
    return await mt5_link_service.create_link(
        body=body, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.put("/{link_id}")
async def update_mt5_link(
    link_id: uuid.UUID,
    body: MT5LinkIn,
    request: Request,
    admin: User = Depends(require_permission("config.update")),
    db: AsyncSession = Depends(get_db),
):
    return await mt5_link_service.update_link(
        link_id=link_id, body=body, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.delete("/{link_id}")
async def delete_mt5_link(
    link_id: uuid.UUID,
    request: Request,
    admin: User = Depends(require_permission("config.update")),
    db: AsyncSession = Depends(get_db),
):
    return await mt5_link_service.delete_link(
        link_id=link_id, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )
