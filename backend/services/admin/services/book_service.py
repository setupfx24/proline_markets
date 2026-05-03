"""Admin Book Management Service — A-Book / B-Book user assignment, LP settings, stats."""
import json
import os
from datetime import datetime

import redis.asyncio as aioredis
from fastapi import HTTPException
from sqlalchemy import select, func, update
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.config import get_settings
from packages.common.src.models import (
    User, TradingAccount, Position, TradeHistory, SystemSetting,
)
from dependencies import write_audit_log

_redis_url = os.getenv("REDIS_URL", "redis://redis:6379/0")
_redis = aioredis.from_url(_redis_url, decode_responses=True)
_redis_prices = aioredis.from_url(_redis_url.rsplit("/", 1)[0] + "/0", decode_responses=True)

# Keys populated by the gateway LP receiver (see api/lp_receiver.py).
# When Corecen is pushing prices these get updated on every batch.
LP_HEARTBEAT_KEY = "lp:last_batch_at"      # unix ms of the last accepted batch
LP_QUEUE_KEY = "lp:incoming_ticks"         # queue drained by market-data service
LP_FRESH_WINDOW_MS = 10_000                # consider LP "connected" for 10s after last push


async def get_book_stats(db: AsyncSession) -> dict:
    """Return A/B book user and trade counts."""
    _admin_roles = ("admin", "super_admin")
    # User counts — include all non-admin roles, exclude demo
    a_users = (await db.execute(
        select(func.count(User.id)).where(User.book_type == "A", User.role.notin_(_admin_roles), User.is_demo == False)
    )).scalar() or 0
    b_users = (await db.execute(
        select(func.count(User.id)).where(User.book_type == "B", User.role.notin_(_admin_roles), User.is_demo == False)
    )).scalar() or 0

    # Trade counts (open positions)
    a_trades = (await db.execute(
        select(func.count(Position.id))
        .join(TradingAccount, Position.account_id == TradingAccount.id)
        .join(User, TradingAccount.user_id == User.id)
        .where(Position.status == "open", User.book_type == "A", TradingAccount.is_demo == False)
    )).scalar() or 0
    b_trades = (await db.execute(
        select(func.count(Position.id))
        .join(TradingAccount, Position.account_id == TradingAccount.id)
        .join(User, TradingAccount.user_id == User.id)
        .where(Position.status == "open", User.book_type == "B", TradingAccount.is_demo == False)
    )).scalar() or 0

    return {
        "a_book_users": a_users,
        "b_book_users": b_users,
        "a_book_trades": a_trades,
        "b_book_trades": b_trades,
    }


async def list_book_users(
    page: int, per_page: int, search: str | None, book_filter: str | None, db: AsyncSession,
) -> dict:
    """Paginated user list with book type, account count, trade count."""
    _admin_roles = ("admin", "super_admin")
    base = select(User).where(User.role.notin_(_admin_roles), User.is_demo == False)
    count_base = select(func.count(User.id)).where(User.role.notin_(_admin_roles), User.is_demo == False)

    if book_filter and book_filter in ("A", "B"):
        base = base.where(User.book_type == book_filter)
        count_base = count_base.where(User.book_type == book_filter)

    if search:
        q = f"%{search}%"
        base = base.where(
            User.email.ilike(q) | User.first_name.ilike(q) | User.last_name.ilike(q)
        )
        count_base = count_base.where(
            User.email.ilike(q) | User.first_name.ilike(q) | User.last_name.ilike(q)
        )

    total = (await db.execute(count_base)).scalar() or 0
    pages = max(1, (total + per_page - 1) // per_page)

    result = await db.execute(
        base.order_by(User.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    users = result.scalars().all()

    out = []
    for u in users:
        # Count accounts and open trades
        acct_count = (await db.execute(
            select(func.count(TradingAccount.id)).where(TradingAccount.user_id == u.id)
        )).scalar() or 0
        trade_count = (await db.execute(
            select(func.count(Position.id))
            .join(TradingAccount, Position.account_id == TradingAccount.id)
            .where(TradingAccount.user_id == u.id, Position.status == "open")
        )).scalar() or 0

        out.append({
            "id": str(u.id),
            "email": u.email,
            "first_name": u.first_name,
            "last_name": u.last_name,
            "book_type": u.book_type or "B",
            "accounts_count": acct_count,
            "trades_count": trade_count,
            "status": u.status or "active",
        })

    return {"users": out, "total": total, "page": page, "pages": pages}


async def change_user_book_type(
    user_id: str, book_type: str, admin_id, ip: str | None, db: AsyncSession,
) -> dict:
    """Change a single user's book type."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    old = user.book_type or "B"
    user.book_type = book_type
    await db.commit()

    try:
        await write_audit_log(
            db, admin_id, "BOOK_TYPE_CHANGED", "user", user.id,
            old_values={"book_type": old},
            new_values={"book_type": book_type, "email": user.email},
            ip_address=ip,
        )
        await db.commit()
    except Exception:
        await db.rollback()

    return {"id": str(user.id), "email": user.email, "book_type": book_type, "previous": old}


async def bulk_change_book_type(
    user_ids: list[str], book_type: str, admin_id, ip: str | None, db: AsyncSession,
) -> dict:
    """Bulk change book type for multiple users."""
    await db.execute(
        update(User).where(User.id.in_(user_ids)).values(book_type=book_type)
    )
    await db.commit()

    try:
        await write_audit_log(
            db, admin_id, "BULK_BOOK_TYPE_CHANGED", "user", None,
            new_values={"user_count": len(user_ids), "book_type": book_type},
            ip_address=ip,
        )
        await db.commit()
    except Exception:
        await db.rollback()

    return {"modified_count": len(user_ids), "book_type": book_type}


async def get_lp_status(db: AsyncSession) -> dict:
    """Report live LP connection state based on the gateway's LP receiver heartbeat.

    Corecen pushes price batches to `/api/lp/prices/batch`; every accepted batch
    sets a Redis key with `int(time.time() * 1000)`. If the most recent batch is
    within LP_FRESH_WINDOW_MS, report CONNECTED so the Book Management badge
    reflects reality instead of the previous stub.
    """
    settings = get_settings()
    lp_enabled = bool(getattr(settings, "CORECEN_LP_ENABLED", False))
    now_ms = int(datetime.utcnow().timestamp() * 1000)

    last_batch_at: int | None = None
    queue_size: int = 0
    try:
        # Gateway writes LP heartbeat to Redis DB 0; admin service may use DB 1,
        # so always query _redis_prices which is pinned to DB 0.
        raw = await _redis_prices.get(LP_HEARTBEAT_KEY)
        if raw is not None:
            try:
                last_batch_at = int(raw)
            except (TypeError, ValueError):
                last_batch_at = None
        queue_size = int(await _redis_prices.llen(LP_QUEUE_KEY) or 0)
    except Exception:
        # Redis unreachable — treat as disconnected but don't 500.
        pass

    age_ms = (now_ms - last_batch_at) if last_batch_at else None
    connected = bool(lp_enabled and age_ms is not None and age_ms <= LP_FRESH_WINDOW_MS)

    if not lp_enabled:
        message = "CORECEN_LP_ENABLED is false — Proline Markets is not configured to receive LP prices"
    elif last_batch_at is None:
        message = "Waiting for Corecen to push the first price batch (check Proline Markets_API_URL + HMAC keys on the Corecen side)"
    elif connected:
        message = f"Receiving prices from Corecen ({age_ms} ms since last batch)"
    else:
        message = f"Stale — last batch {age_ms} ms ago (threshold {LP_FRESH_WINDOW_MS} ms)"

    return {
        "connected": connected,
        "lp_enabled": lp_enabled,
        "last_batch_at_ms": last_batch_at,
        "last_batch_age_ms": age_ms,
        "queue_size": queue_size,
        "message": message,
        "last_checked": datetime.utcnow().isoformat(),
    }


async def get_lp_settings(db: AsyncSession) -> dict:
    """Read LP settings from system_settings table."""
    keys = ["lp_api_url", "lp_ws_url", "lp_api_key", "lp_api_secret"]
    settings: dict = {}
    for key in keys:
        try:
            result = await db.execute(select(SystemSetting).where(SystemSetting.key == key))
            row = result.scalar_one_or_none()
        except Exception:
            # Table missing or read error — return empty values rather than 500.
            settings[key] = ""
            continue
        if not row:
            settings[key] = ""
            continue
        raw = row.value
        val = raw if isinstance(raw, str) else (json.dumps(raw) if raw is not None else "")
        # Mask secrets
        if key in ("lp_api_key", "lp_api_secret") and val and len(val) > 4:
            val = "●" * (len(val) - 4) + val[-4:]
        settings[key] = val
    return settings


async def save_lp_settings(
    api_url: str, ws_url: str, api_key: str, api_secret: str,
    admin_id, ip: str | None, db: AsyncSession,
) -> dict:
    """Save LP connection settings to system_settings."""
    pairs = {
        "lp_api_url": api_url,
        "lp_ws_url": ws_url,
        "lp_api_key": api_key,
        "lp_api_secret": api_secret,
    }
    for key, value in pairs.items():
        result = await db.execute(select(SystemSetting).where(SystemSetting.key == key))
        row = result.scalar_one_or_none()
        # JSONB column: store as a JSON string value so reads round-trip to Python str.
        json_value = value if isinstance(value, str) else json.dumps(value)
        if row:
            row.value = json_value
            row.updated_by = admin_id
            row.updated_at = datetime.utcnow()
        else:
            db.add(SystemSetting(key=key, value=json_value, updated_by=admin_id))
    await db.commit()

    try:
        await write_audit_log(
            db, admin_id, "LP_SETTINGS_UPDATED", "system_setting", None,
            new_values={"lp_api_url": api_url, "lp_ws_url": ws_url},
            ip_address=ip,
        )
        await db.commit()
    except Exception:
        # Audit log is best-effort — don't 500 the save if it fails.
        await db.rollback()

    return {"success": True, "message": "LP settings saved"}


async def test_lp_connection(db: AsyncSession) -> dict:
    """Report whether Corecen LP is actively pushing price batches."""
    status = await get_lp_status(db)
    return {
        "success": bool(status.get("connected")),
        "message": status.get("message") or "Unknown LP state",
        **status,
    }


async def get_abook_positions(page: int, per_page: int, db: AsyncSession) -> dict:
    """Open positions for A-book users."""
    base = (
        select(Position)
        .join(TradingAccount, Position.account_id == TradingAccount.id)
        .join(User, TradingAccount.user_id == User.id)
        .where(Position.status == "open", User.book_type == "A", TradingAccount.is_demo == False)
    )
    total = (await db.execute(
        select(func.count(Position.id))
        .join(TradingAccount, Position.account_id == TradingAccount.id)
        .join(User, TradingAccount.user_id == User.id)
        .where(Position.status == "open", User.book_type == "A", TradingAccount.is_demo == False)
    )).scalar() or 0

    result = await db.execute(
        base.order_by(Position.created_at.desc())
        .offset((page - 1) * per_page).limit(per_page)
    )
    positions = result.scalars().all()

    out = []
    for p in positions:
        symbol = p.instrument.symbol if p.instrument else "?"
        price = await _get_live_price(symbol)
        side = p.side.value if hasattr(p.side, 'value') else str(p.side)

        out.append({
            "id": str(p.id),
            "symbol": symbol,
            "side": side,
            "lots": float(p.lots),
            "open_price": float(p.open_price),
            "current_price": price.get("bid") if price and side == "buy" else (price.get("ask") if price else None),
            "stop_loss": float(p.stop_loss) if p.stop_loss else None,
            "take_profit": float(p.take_profit) if p.take_profit else None,
            "created_at": p.created_at.isoformat() if p.created_at else None,
            "account_id": str(p.account_id),
        })

    return {"positions": out, "total": total, "page": page, "pages": max(1, (total + per_page - 1) // per_page)}


async def get_abook_history(page: int, per_page: int, db: AsyncSession) -> dict:
    """Closed trades for A-book users."""
    base = (
        select(TradeHistory)
        .join(TradingAccount, TradeHistory.account_id == TradingAccount.id)
        .join(User, TradingAccount.user_id == User.id)
        .where(User.book_type == "A", TradingAccount.is_demo == False)
    )
    total = (await db.execute(
        select(func.count(TradeHistory.id))
        .join(TradingAccount, TradeHistory.account_id == TradingAccount.id)
        .join(User, TradingAccount.user_id == User.id)
        .where(User.book_type == "A", TradingAccount.is_demo == False)
    )).scalar() or 0

    result = await db.execute(
        base.order_by(TradeHistory.closed_at.desc())
        .offset((page - 1) * per_page).limit(per_page)
    )
    trades = result.scalars().all()

    out = []
    for t in trades:
        side = t.side.value if hasattr(t.side, 'value') else str(t.side)
        out.append({
            "id": str(t.id),
            "symbol": t.instrument.symbol if t.instrument else "?",
            "side": side,
            "lots": float(t.lots),
            "open_price": float(t.open_price),
            "close_price": float(t.close_price) if t.close_price else None,
            "profit": float(t.profit) if t.profit else 0,
            "close_reason": t.close_reason,
            "opened_at": t.opened_at.isoformat() if t.opened_at else None,
            "closed_at": t.closed_at.isoformat() if t.closed_at else None,
        })

    return {"trades": out, "total": total, "page": page, "pages": max(1, (total + per_page - 1) // per_page)}


async def _get_live_price(symbol: str) -> dict | None:
    try:
        data = await _redis_prices.get(f"tick:{symbol}")
        if data:
            return json.loads(data)
    except Exception:
        pass
    return None
