"""Banners API — Active banners, click tracking, public banner images."""
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import get_db
from packages.common.src.auth import get_current_user
from ..services import banner_service

router = APIRouter()

media_router = APIRouter()


@media_router.get("/media/{filename}")
async def serve_banner_media(filename: str):
    """Public: trader dashboard <img> loads via same-origin /api/v1/banners/media/…"""
    return await banner_service.serve_banner_media(filename)


@router.get("")
async def list_banners(
    page: str = Query("dashboard"),
    position: str = Query(None),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await banner_service.list_banners(
        page=page, position=position, role=current_user["role"], db=db,
    )


@router.post("/{banner_id}/click")
async def track_click(
    banner_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await banner_service.track_click(banner_id=banner_id, db=db)
