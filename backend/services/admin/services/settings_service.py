"""Admin Settings Service — system settings CRUD."""
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.models import SystemSetting
from packages.common.src.admin_schemas import SystemSettingOut, SystemSettingUpdate
from dependencies import write_audit_log

import uuid


async def list_settings(db: AsyncSession) -> list:
    result = await db.execute(select(SystemSetting).order_by(SystemSetting.key))
    settings = result.scalars().all()
    return [
        SystemSettingOut(
            key=s.key,
            value=s.value,
            description=s.description,
            updated_at=s.updated_at,
        )
        for s in settings
    ]


async def update_settings(
    body: SystemSettingUpdate,
    admin_id: uuid.UUID,
    ip_address: str | None,
    db: AsyncSession,
) -> dict:
    old_values = {}
    for key, value in body.settings.items():
        result = await db.execute(
            select(SystemSetting).where(SystemSetting.key == key)
        )
        setting = result.scalar_one_or_none()
        if setting:
            old_values[key] = setting.value
            setting.value = value
            setting.updated_by = admin_id
            setting.updated_at = datetime.utcnow()
        else:
            new_setting = SystemSetting(
                key=key,
                value=value,
                updated_by=admin_id,
            )
            db.add(new_setting)

    await write_audit_log(
        db, admin_id, "update_settings", "system_setting", None,
        old_values=old_values,
        new_values=body.settings,
        ip_address=ip_address,
    )
    await db.commit()

    # Invalidate the gateway's settings cache so it picks up new values immediately.
    # Admin's REDIS_URL is pinned to /1 (rate limits); gateway caches settings in /0,
    # so we must rewrite the db path to hit the right Redis logical database.
    try:
        import os
        import redis.asyncio as aioredis
        url = os.getenv("REDIS_URL", "redis://redis:6379/0")
        base = url.rsplit("/", 1)[0]
        r = aioredis.from_url(f"{base}/0")
        await r.delete("system_settings_cache")
        await r.close()
    except Exception:
        pass

    return {"message": f"{len(body.settings)} settings updated"}
