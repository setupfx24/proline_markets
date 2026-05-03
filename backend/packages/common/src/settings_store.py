"""System Settings Store — reads admin settings from DB with Redis caching."""
import json
import logging
from typing import Any

from .redis_client import redis_client

logger = logging.getLogger("settings-store")

CACHE_KEY = "system_settings_cache"
CACHE_TTL = 5


async def get_system_setting(key: str, default: Any = None) -> Any:
    try:
        cached = await redis_client.hget(CACHE_KEY, key)
        if cached is not None:
            try:
                return json.loads(cached)
            except (json.JSONDecodeError, TypeError):
                return cached
    except Exception:
        pass

    try:
        from .database import AsyncSessionLocal
        from .models import SystemSetting
        from sqlalchemy import select

        async with AsyncSessionLocal() as db:
            result = await db.execute(select(SystemSetting).where(SystemSetting.key == key))
            setting = result.scalar_one_or_none()
            if setting:
                val = setting.value
                try:
                    await redis_client.hset(CACHE_KEY, key, json.dumps(val))
                    await redis_client.expire(CACHE_KEY, CACHE_TTL)
                except Exception:
                    pass
                return val
    except Exception as e:
        logger.error(f"Failed to read setting {key}: {e}")

    return default


async def get_bool_setting(key: str, default: bool = False) -> bool:
    val = await get_system_setting(key, default)
    if isinstance(val, bool):
        return val
    if isinstance(val, str):
        return val.lower() in ("true", "1", "yes")
    return bool(val)


async def get_float_setting(key: str, default: float = 0.0) -> float:
    val = await get_system_setting(key, default)
    try:
        return float(val)
    except (TypeError, ValueError):
        return default


async def get_int_setting(key: str, default: int = 0) -> int:
    val = await get_system_setting(key, default)
    try:
        return int(float(val))
    except (TypeError, ValueError):
        return default


async def invalidate_cache():
    try:
        await redis_client.delete(CACHE_KEY)
    except Exception:
        pass
