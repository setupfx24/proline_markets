"""Admin Banner Service — CRUD for banners, image upload/serve."""
import os
import re
import uuid
from pathlib import Path
from uuid import UUID

from fastapi import HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.models import Banner
from packages.common.src.admin_schemas import BannerIn, BannerOut
from packages.common.src.path_safety import PathTraversalError, safe_join_under_base
from dependencies import write_audit_log


def _upload_dir() -> Path:
    env = os.environ.get("BANNERS_UPLOAD_DIR", "").strip()
    if env:
        p = Path(env)
    else:
        p = Path(__file__).resolve().parents[3] / "uploads" / "banners"
    p.mkdir(parents=True, exist_ok=True)
    return p


UPLOAD_DIR = _upload_dir()
MEDIA_PATH_PREFIX = "/api/v1/banners/media"


def _safe_media_filename(filename: str) -> str:
    name = Path(filename or "").name
    if not name or name != filename or ".." in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
    return name


def _unlink_uploaded_file(image_url: str | None) -> None:
    if not image_url or MEDIA_PATH_PREFIX not in image_url:
        return
    m = re.search(rf"{re.escape(MEDIA_PATH_PREFIX)}/([^/?#]+)$", image_url)
    if not m:
        return
    raw = m.group(1)
    fn = Path(raw).name
    if not fn or fn != raw or ".." in raw:
        return
    try:
        path = safe_join_under_base(UPLOAD_DIR, fn)
    except PathTraversalError:
        return
    if path.is_file():
        try:
            path.unlink()
        except OSError:
            pass


def serve_banner_media(filename: str) -> FileResponse:
    fn = _safe_media_filename(filename)
    try:
        path = safe_join_under_base(UPLOAD_DIR, fn)
    except PathTraversalError:
        raise HTTPException(status_code=400, detail="Invalid filename")
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Not found")
    return FileResponse(path)


async def upload_banner_image(file: UploadFile) -> dict:
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files are allowed")

    max_size = 8 * 1024 * 1024
    contents = await file.read()
    if len(contents) > max_size:
        raise HTTPException(status_code=400, detail="File too large (max 8MB)")

    ext = file.filename.rsplit(".", 1)[-1].lower() if file.filename and "." in file.filename else "png"
    if ext not in ("png", "jpg", "jpeg", "webp", "gif"):
        ext = "png"

    out_name = f"{uuid.uuid4().hex}.{ext}"
    out_path = UPLOAD_DIR / out_name
    out_path.write_bytes(contents)

    return {"url": f"{MEDIA_PATH_PREFIX}/{out_name}", "filename": out_name}


async def list_banners(db: AsyncSession) -> dict:
    result = await db.execute(
        select(Banner).order_by(Banner.priority.desc(), Banner.created_at.desc())
    )
    banners = result.scalars().all()
    return {
        "banners": [
            BannerOut(
                id=str(b.id),
                title=b.title,
                image_url=b.image_url,
                link_url=b.link_url,
                target_page=b.target_page or "dashboard",
                position=b.position or "top",
                target_audience=b.target_audience or "all",
                priority=b.priority or 0,
                starts_at=b.starts_at,
                ends_at=b.ends_at,
                is_active=b.is_active,
                click_count=b.click_count or 0,
                created_at=b.created_at,
            )
            for b in banners
        ]
    }


async def create_banner(
    body: BannerIn,
    admin_id: uuid.UUID,
    ip_address: str | None,
    db: AsyncSession,
) -> dict:
    banner = Banner(
        title=body.title,
        image_url=body.image_url,
        link_url=body.link_url,
        target_page=body.target_page,
        position=body.position,
        target_audience=body.target_audience,
        priority=body.priority,
        starts_at=body.starts_at,
        ends_at=body.ends_at,
        is_active=body.is_active,
    )
    db.add(banner)
    await db.flush()

    await write_audit_log(
        db, admin_id, "create_banner", "banner", banner.id,
        new_values={"title": body.title, "position": body.position},
        ip_address=ip_address,
    )
    await db.commit()
    return {"message": "Banner created", "id": str(banner.id)}


async def update_banner(
    banner_id: UUID,
    body: BannerIn,
    admin_id: uuid.UUID,
    ip_address: str | None,
    db: AsyncSession,
) -> dict:
    result = await db.execute(select(Banner).where(Banner.id == banner_id))
    banner = result.scalar_one_or_none()
    if not banner:
        raise HTTPException(status_code=404, detail="Banner not found")

    old_values = {"title": banner.title, "is_active": banner.is_active}
    old_image = banner.image_url

    if body.image_url != old_image:
        _unlink_uploaded_file(old_image)

    banner.title = body.title
    banner.image_url = body.image_url
    banner.link_url = body.link_url
    banner.target_page = body.target_page
    banner.position = body.position
    banner.target_audience = body.target_audience
    banner.priority = body.priority
    banner.starts_at = body.starts_at
    banner.ends_at = body.ends_at
    banner.is_active = body.is_active

    await write_audit_log(
        db, admin_id, "update_banner", "banner", banner_id,
        old_values=old_values,
        new_values={"title": body.title, "is_active": body.is_active},
        ip_address=ip_address,
    )
    await db.commit()
    return {"message": "Banner updated"}


async def delete_banner(
    banner_id: UUID,
    admin_id: uuid.UUID,
    ip_address: str | None,
    db: AsyncSession,
) -> dict:
    result = await db.execute(select(Banner).where(Banner.id == banner_id))
    banner = result.scalar_one_or_none()
    if not banner:
        raise HTTPException(status_code=404, detail="Banner not found")

    _unlink_uploaded_file(banner.image_url)
    await db.delete(banner)

    await write_audit_log(
        db, admin_id, "delete_banner", "banner", banner_id,
        new_values={"deleted": True},
        ip_address=ip_address,
    )
    await db.commit()
    return {"message": "Banner deleted"}
