"""Share Trade Service — create + resolve public share links for positions."""
import json
import secrets
import string
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.models import (
    SharedTrade, Position, TradingAccount, User, Instrument, PositionStatus,
)
from packages.common.src.redis_client import redis_client, PriceChannel

SHARE_TTL_DAYS = 7
CODE_ALPHABET = string.ascii_letters + string.digits


def _generate_code(length: int = 7) -> str:
    return "".join(secrets.choice(CODE_ALPHABET) for _ in range(length))


async def _get_current_price(symbol: str) -> tuple[float, float] | tuple[None, None]:
    tick = await redis_client.get(PriceChannel.tick_key(symbol))
    if not tick:
        return None, None
    try:
        data = json.loads(tick)
        return float(data["bid"]), float(data["ask"])
    except (json.JSONDecodeError, KeyError, ValueError):
        return None, None


async def create_share_link(
    position_id: UUID,
    user_id: UUID,
    description: str | None,
    link_description: str | None,
    display_mode: str,
    db: AsyncSession,
) -> dict:
    if display_mode not in ("pnl", "roi", "ticks"):
        display_mode = "pnl"

    # Verify the position belongs to the user
    pos_q = await db.execute(
        select(Position, TradingAccount)
        .join(TradingAccount, Position.account_id == TradingAccount.id)
        .where(Position.id == position_id, TradingAccount.user_id == user_id)
    )
    row = pos_q.first()
    if not row:
        raise HTTPException(status_code=404, detail="Position not found")

    # Reuse an existing non-expired link for the same position
    now = datetime.now(timezone.utc)
    existing_q = await db.execute(
        select(SharedTrade).where(
            SharedTrade.position_id == position_id,
            SharedTrade.expires_at > now,
        )
    )
    existing = existing_q.scalar_one_or_none()
    if existing:
        # Update description / display mode if caller changed them
        existing.description = description
        existing.link_description = link_description
        existing.display_mode = display_mode
        await db.commit()
        return {"short_code": existing.short_code, "expires_at": existing.expires_at.isoformat()}

    # Generate a unique code
    for _ in range(10):
        code = _generate_code()
        dupe = await db.execute(select(SharedTrade).where(SharedTrade.short_code == code))
        if not dupe.scalar_one_or_none():
            break
    else:
        raise HTTPException(status_code=500, detail="Failed to generate unique share code")

    share = SharedTrade(
        short_code=code,
        position_id=position_id,
        user_id=user_id,
        description=description,
        link_description=link_description,
        display_mode=display_mode,
        expires_at=now + timedelta(days=SHARE_TTL_DAYS),
    )
    db.add(share)
    await db.commit()
    return {"short_code": code, "expires_at": share.expires_at.isoformat()}


async def get_public_share(code: str, db: AsyncSession) -> dict:
    now = datetime.now(timezone.utc)
    share_q = await db.execute(
        select(SharedTrade).where(SharedTrade.short_code == code)
    )
    share = share_q.scalar_one_or_none()
    if not share:
        raise HTTPException(status_code=404, detail="Share link not found")
    if share.expires_at < now:
        raise HTTPException(status_code=410, detail="Share link expired")

    pos_q = await db.execute(
        select(Position, TradingAccount, Instrument)
        .join(TradingAccount, Position.account_id == TradingAccount.id)
        .join(Instrument, Position.instrument_id == Instrument.id)
        .where(Position.id == share.position_id)
    )
    row = pos_q.first()
    if not row:
        raise HTTPException(status_code=404, detail="Position not found")

    position, account, instrument = row
    pos_status = position.status.value if hasattr(position.status, "value") else str(position.status)
    side = position.side.value if hasattr(position.side, "value") else str(position.side)

    bid, ask = await _get_current_price(instrument.symbol)
    contract_size = float(instrument.contract_size or 100000)
    open_price = float(position.open_price)
    lots = float(position.lots)
    pip_size = float(instrument.pip_size or 0.0001)

    if pos_status == "closed" and position.close_price:
        current_price = float(position.close_price)
        is_live = False
    else:
        current_price = (bid if side == "buy" else ask) if bid and ask else open_price
        is_live = True

    if side == "buy":
        gross_pnl = (current_price - open_price) * lots * contract_size
        pip_diff = (current_price - open_price) / pip_size if pip_size > 0 else 0
    else:
        gross_pnl = (open_price - current_price) * lots * contract_size
        pip_diff = (open_price - current_price) / pip_size if pip_size > 0 else 0
    # Convert quote-currency P&L to account currency (USD)
    base_ccy = (getattr(instrument, "base_currency", None) or "").upper()
    quote_ccy = (getattr(instrument, "quote_currency", None) or "").upper()
    if quote_ccy and quote_ccy != "USD":
        if base_ccy == "USD" and current_price:
            gross_pnl = gross_pnl / current_price

    # Margin snapshot: lots * contract_size * open_price / leverage
    leverage = int(account.leverage or 100)
    margin = (lots * contract_size * open_price) / leverage if leverage > 0 else 0
    roi_pct = (gross_pnl / margin * 100) if margin > 0 else 0

    share.view_count = (share.view_count or 0) + 1
    await db.commit()

    return {
        "short_code": share.short_code,
        "status": "closed" if pos_status == "closed" else "active",
        "is_live": is_live,
        "symbol": instrument.symbol,
        "side": side,
        "lots": lots,
        "leverage": leverage,
        "open_price": open_price,
        "current_price": current_price,
        "pnl": gross_pnl,
        "roi_pct": roi_pct,
        "ticks": pip_diff,
        "pip_size": pip_size,
        "description": share.description,
        "link_description": share.link_description,
        "display_mode": share.display_mode,
        "opened_at": position.created_at.isoformat() if position.created_at else None,
        "closed_at": position.closed_at.isoformat() if position.closed_at else None,
        "expires_at": share.expires_at.isoformat(),
    }
