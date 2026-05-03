"""Instrument Service — Listing, market status, price retrieval."""
import json

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.models import Instrument, InstrumentSegment
from packages.common.src.schemas import InstrumentResponse, TickData
from packages.common.src.redis_client import redis_client, PriceChannel
from packages.common.src.market_hours import market_status_dict


async def list_instruments(
    segment: str | None, active_only: bool, db: AsyncSession,
) -> list[InstrumentResponse]:
    query = select(Instrument)

    if active_only:
        query = query.where(Instrument.is_active == True)

    if segment:
        query = query.join(InstrumentSegment).where(InstrumentSegment.name == segment)

    result = await db.execute(query)
    instruments = result.scalars().all()

    return [
        InstrumentResponse(
            id=inst.id,
            symbol=inst.symbol,
            display_name=inst.display_name,
            segment=inst.segment.name if inst.segment else None,
            base_currency=inst.base_currency or (inst.symbol[:3] if inst.symbol and len(inst.symbol) >= 6 else None),
            quote_currency=inst.quote_currency or (inst.symbol[3:6] if inst.symbol and len(inst.symbol) >= 6 else None),
            digits=inst.digits,
            pip_size=inst.pip_size,
            min_lot=inst.min_lot,
            max_lot=inst.max_lot,
            lot_step=inst.lot_step,
            contract_size=inst.contract_size,
            margin_rate=inst.margin_rate,
            is_active=inst.is_active,
        )
        for inst in instruments
    ]


async def get_market_status(db: AsyncSession) -> list[dict]:
    result = await db.execute(
        select(Instrument).where(Instrument.is_active == True)
    )
    instruments = result.scalars().all()
    return [
        market_status_dict(
            inst.symbol,
            inst.segment.name if inst.segment else None,
            inst.trading_hours,
        )
        for inst in instruments
    ]


async def get_symbol_market_status(symbol: str, db: AsyncSession) -> dict:
    result = await db.execute(
        select(Instrument).where(
            Instrument.symbol == symbol.upper(),
            Instrument.is_active == True,
        )
    )
    inst = result.scalar_one_or_none()
    if not inst:
        raise HTTPException(status_code=404, detail=f"Instrument {symbol} not found")
    return market_status_dict(
        inst.symbol,
        inst.segment.name if inst.segment else None,
        inst.trading_hours,
    )


async def get_all_prices() -> list[dict]:
    keys = []
    async for key in redis_client.scan_iter(f"{PriceChannel.TICK_PREFIX}*"):
        keys.append(key)

    if not keys:
        return []

    values = await redis_client.mget(keys)
    prices = []
    for v in values:
        if v:
            prices.append(json.loads(v))

    return prices


async def get_price(symbol: str) -> TickData:
    tick_data = await redis_client.get(PriceChannel.tick_key(symbol.upper()))
    if not tick_data:
        raise HTTPException(status_code=404, detail=f"No price data for {symbol}")

    data = json.loads(tick_data)
    return TickData(**data)
