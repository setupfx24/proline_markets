"""Trading Catalog Service — Public instrument catalog with effective charges."""
import json
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from packages.common.src.models import Instrument, InstrumentConfig, InstrumentSegment
from packages.common.src.instrument_pricing import (
    resolve_spread_config,
    resolve_commission,
)
from packages.common.src.redis_client import redis_client, PriceChannel


async def _mid_price(symbol: str) -> Decimal:
    raw = await redis_client.get(PriceChannel.tick_key(symbol))
    if not raw:
        return Decimal("1")
    t = json.loads(raw)
    return (Decimal(str(t["bid"])) + Decimal(str(t["ask"]))) / Decimal("2")


async def list_trading_instruments(segment: str | None, db: AsyncSession) -> list[dict]:
    q = (
        select(Instrument)
        .where(Instrument.is_active == True)
        .options(selectinload(Instrument.segment))
        .order_by(Instrument.symbol)
    )
    if segment:
        q = q.join(InstrumentSegment, Instrument.segment_id == InstrumentSegment.id).where(
            InstrumentSegment.name == segment.lower()
        )
    r = await db.execute(q)
    rows = r.scalars().unique().all()

    out = []
    for inst in rows:
        ic_r = await db.execute(
            select(InstrumentConfig).where(InstrumentConfig.instrument_id == inst.id)
        )
        ic = ic_r.scalar_one_or_none()
        if ic and ic.is_enabled is False:
            continue

        sv, st, pimp = await resolve_spread_config(db, inst)
        mid = await _mid_price(inst.symbol)
        comm = await resolve_commission(db, inst, Decimal("1"), mid)

        out.append(
            {
                "id": str(inst.id),
                "symbol": inst.symbol,
                "display_name": inst.display_name,
                "segment": inst.segment.name if inst.segment else None,
                "digits": inst.digits,
                "pip_size": float(inst.pip_size or 0),
                "min_lot": float(ic.min_lot_size) if ic and ic.min_lot_size is not None else float(inst.min_lot or 0),
                "max_lot": float(ic.max_lot_size) if ic and ic.max_lot_size is not None else float(inst.max_lot or 0),
                "contract_size": float(inst.contract_size or 0),
                "spread": {"type": st, "value": float(sv), "price_impact": float(pimp)},
                "commission_preview_per_lot": float(comm),
                "swap_free": bool(ic.swap_free) if ic else False,
            }
        )
    return out


async def get_trading_instrument(symbol: str, db: AsyncSession) -> dict:
    r = await db.execute(
        select(Instrument)
        .where(Instrument.symbol == symbol.upper(), Instrument.is_active == True)
        .options(selectinload(Instrument.segment))
    )
    inst = r.scalar_one_or_none()
    if not inst:
        raise HTTPException(status_code=404, detail="Instrument not found")

    ic_r = await db.execute(select(InstrumentConfig).where(InstrumentConfig.instrument_id == inst.id))
    ic = ic_r.scalar_one_or_none()
    if ic and ic.is_enabled is False:
        raise HTTPException(status_code=404, detail="Instrument not available")

    sv, st, pimp = await resolve_spread_config(db, inst)
    mid = await _mid_price(inst.symbol)
    comm = await resolve_commission(db, inst, Decimal("1"), mid)
    return {
        "id": str(inst.id),
        "symbol": inst.symbol,
        "display_name": inst.display_name,
        "segment": inst.segment.name if inst.segment else None,
        "digits": inst.digits,
        "pip_size": float(inst.pip_size or 0),
        "min_lot": float(ic.min_lot_size) if ic and ic.min_lot_size is not None else float(inst.min_lot or 0),
        "max_lot": float(ic.max_lot_size) if ic and ic.max_lot_size is not None else float(inst.max_lot or 0),
        "contract_size": float(inst.contract_size or 0),
        "spread": {"type": st, "value": float(sv), "price_impact": float(pimp)},
        "commission_preview_per_lot": float(comm),
        "swap_long": float(ic.swap_long) if ic else None,
        "swap_short": float(ic.swap_short) if ic else None,
        "swap_free": bool(ic.swap_free) if ic else False,
    }
