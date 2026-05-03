"""Banner Service — Active banner listing, click tracking, media serving."""
import os
from datetime import datetime
from pathlib import Path
from uuid import UUID

from fastapi import HTTPException
from fastapi.responses import FileResponse
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.models import Banner
from packages.common.src.path_safety import PathTraversalError, safe_join_under_base


def _upload_dir() -> Path:
    env = os.environ.get("BANNERS_UPLOAD_DIR", "").strip()
    if env:
        p = Path(env)
    else:
        p = Path(__file__).resolve().parents[4] / "uploads" / "banners"
    p.mkdir(parents=True, exist_ok=True)
    return p


UPLOAD_DIR = _upload_dir()


async def list_banners(
    page: str, position: str | None, role: str, db: AsyncSession,
) -> dict:
    now = datetime.utcnow()

    page_filter = or_(Banner.target_page == page, Banner.target_page == "all")

    filters = [
        Banner.is_active == True,
        page_filter,
        or_(Banner.starts_at == None, Banner.starts_at <= now),
        or_(Banner.ends_at == None, Banner.ends_at >= now),
        or_(
            Banner.target_audience == "all",
            Banner.target_audience == role,
        ),
    ]
    if position:
        filters.append(Banner.position == position)

    result = await db.execute(
        select(Banner)
        .where(*filters)
        .order_by(Banner.priority.desc(), Banner.created_at.desc())
    )
    banners = result.scalars().all()

    return {
        "banners": [
            {
                "id": str(b.id),
                "title": b.title,
                "image_url": b.image_url,
                "link_url": b.link_url,
                "position": b.position,
                "priority": b.priority,
            }
            for b in banners
        ],
        "total": len(banners),
    }


async def track_click(banner_id: UUID, db: AsyncSession) -> dict:
    result = await db.execute(
        select(Banner).where(Banner.id == banner_id, Banner.is_active == True)
    )
    banner = result.scalar_one_or_none()
    if not banner:
        raise HTTPException(status_code=404, detail="Banner not found")

    banner.click_count = (banner.click_count or 0) + 1
    await db.commit()

    return {"message": "Click tracked", "link_url": banner.link_url}


async def serve_banner_media(filename: str) -> FileResponse:
    name = Path(filename or "").name
    if not name or name != filename or ".." in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
    try:
        path = safe_join_under_base(UPLOAD_DIR, name)
    except PathTraversalError:
        raise HTTPException(status_code=400, detail="Invalid filename")
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Not found")
    return FileResponse(path)
