from uuid import UUID

from fastapi import APIRouter, Depends, Request, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import get_db
from dependencies import require_permission
from packages.common.src.models import User
from packages.common.src.admin_schemas import BannerIn
from services import banner_service

router = APIRouter(prefix="/banners", tags=["Banners"])


@router.get("/media/{filename}")
async def serve_banner_media(filename: str):
    """Public image URL for admin UI and consistency; trader uses gateway copy."""
    return banner_service.serve_banner_media(filename=filename)


@router.post("/upload")
async def upload_banner_image(
    file: UploadFile = File(...),
    admin: User = Depends(require_permission("banners.create")),
):
    return await banner_service.upload_banner_image(file=file)


@router.get("")
async def list_banners(
    admin: User = Depends(require_permission("banners.view")),
    db: AsyncSession = Depends(get_db),
):
    return await banner_service.list_banners(db=db)


@router.post("")
async def create_banner(
    body: BannerIn,
    request: Request,
    admin: User = Depends(require_permission("banners.create")),
    db: AsyncSession = Depends(get_db),
):
    return await banner_service.create_banner(
        body=body, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.put("/{banner_id}")
async def update_banner(
    banner_id: UUID,
    body: BannerIn,
    request: Request,
    admin: User = Depends(require_permission("banners.update")),
    db: AsyncSession = Depends(get_db),
):
    return await banner_service.update_banner(
        banner_id=banner_id, body=body, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.delete("/{banner_id}")
async def delete_banner(
    banner_id: UUID,
    request: Request,
    admin: User = Depends(require_permission("banners.delete")),
    db: AsyncSession = Depends(get_db),
):
    return await banner_service.delete_banner(
        banner_id=banner_id, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )
