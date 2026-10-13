"""Admin routes for the platform bridge (trade copying to the sister platform)."""
import uuid

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import get_db
from packages.common.src.models import User
from dependencies import require_permission
from services import bridge_link_service
from services.bridge_link_service import BridgeLinkIn

router = APIRouter(prefix="/bridge-links", tags=["Platform Bridge"])


def _ip(request: Request) -> str | None:
    return request.client.host if request.client else None


@router.get("")
async def list_bridge_links(
    admin: User = Depends(require_permission("config.view")),
    db: AsyncSession = Depends(get_db),
):
    return await bridge_link_service.list_links(db=db)


@router.post("/test")
async def test_bridge_connection(
    admin: User = Depends(require_permission("config.view")),
):
    return await bridge_link_service.test_connection()


@router.get("/trades")
async def list_bridge_trades(
    link_id: uuid.UUID | None = Query(default=None),
    direction: str | None = Query(default=None),
    limit: int = Query(default=200),
    admin: User = Depends(require_permission("config.view")),
    db: AsyncSession = Depends(get_db),
):
    return await bridge_link_service.list_trades(db=db, link_id=link_id, direction=direction, limit=limit)


@router.post("")
async def create_bridge_link(
    body: BridgeLinkIn,
    request: Request,
    admin: User = Depends(require_permission("config.update")),
    db: AsyncSession = Depends(get_db),
):
    return await bridge_link_service.create_link(body=body, admin_id=admin.id, ip_address=_ip(request), db=db)


@router.put("/{link_id}")
async def update_bridge_link(
    link_id: uuid.UUID,
    body: BridgeLinkIn,
    request: Request,
    admin: User = Depends(require_permission("config.update")),
    db: AsyncSession = Depends(get_db),
):
    return await bridge_link_service.update_link(
        link_id=link_id, body=body, admin_id=admin.id, ip_address=_ip(request), db=db,
    )


@router.delete("/{link_id}")
async def delete_bridge_link(
    link_id: uuid.UUID,
    request: Request,
    admin: User = Depends(require_permission("config.update")),
    db: AsyncSession = Depends(get_db),
):
    return await bridge_link_service.delete_link(link_id=link_id, admin_id=admin.id, ip_address=_ip(request), db=db)
