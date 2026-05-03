"""Admin Instruments Service — master list, config CRUD, create, deactivate, bulk update."""
import uuid
from decimal import Decimal
from typing import Any

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.models import Instrument, InstrumentSegment
from packages.common.src.redis_client import publish_instrument_config_reload
from instrument_service import build_admin_instrument_items, upsert_instrument_config
from dependencies import write_audit_log


async def list_instruments(
    db: AsyncSession,
    search: str | None,
    segment: str | None,
    include_inactive: bool,
) -> dict:
    return await build_admin_instrument_items(
        db, include_inactive=include_inactive, search=search, segment_filter=segment
    )


async def get_instrument(instrument_id: uuid.UUID, db: AsyncSession) -> dict:
    inst = await db.get(Instrument, instrument_id)
    if not inst:
        raise HTTPException(status_code=404, detail="Instrument not found")
    data = await build_admin_instrument_items(db, include_inactive=True, search=inst.symbol)
    for item in data["items"]:
        if item["id"] == str(instrument_id):
            return item
    raise HTTPException(status_code=404, detail="Instrument not found")


async def put_instrument_config(
    instrument_id: uuid.UUID,
    body: dict[str, Any],
    admin_id: uuid.UUID,
    ip_address: str | None,
    db: AsyncSession,
) -> dict:
    try:
        inst = await upsert_instrument_config(
            db, instrument_id, body, admin_id, ip_address,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    await write_audit_log(
        db, admin_id, "update_instrument_config", "instrument", instrument_id,
        new_values=body, ip_address=ip_address,
    )
    await db.commit()
    await publish_instrument_config_reload()
    return {"message": f"{inst.symbol} config updated successfully"}


async def create_instrument(
    body: dict[str, Any],
    admin_id: uuid.UUID,
    ip_address: str | None,
    db: AsyncSession,
) -> dict:
    symbol = (body.get("symbol") or "").strip().upper()
    if not symbol:
        raise HTTPException(status_code=400, detail="symbol is required")
    seg_name = (body.get("segment") or "forex").lower()
    exists = await db.execute(select(Instrument).where(Instrument.symbol == symbol))
    if exists.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Symbol already exists")
    seg_r = await db.execute(
        select(InstrumentSegment).where(InstrumentSegment.name == seg_name)
    )
    seg = seg_r.scalar_one_or_none()
    if not seg:
        raise HTTPException(status_code=400, detail="Invalid segment")

    inst = Instrument(
        symbol=symbol,
        display_name=body.get("display_name") or symbol,
        segment_id=seg.id,
        base_currency=body.get("base_currency") or symbol[:3],
        quote_currency=body.get("quote_currency") or (symbol[3:] if len(symbol) > 3 else "USD"),
        digits=int(body.get("digits", 5)),
        pip_size=Decimal(str(body.get("pip_size", "0.0001"))),
        contract_size=Decimal(str(body.get("contract_size", "100000"))),
        min_lot=Decimal(str(body.get("min_lot", "0.01"))),
        max_lot=Decimal(str(body.get("max_lot", "100"))),
        is_active=True,
    )
    db.add(inst)
    await write_audit_log(
        db, admin_id, "create_instrument", "instrument", None,
        new_values={"symbol": symbol}, ip_address=ip_address,
    )
    await db.commit()
    await db.refresh(inst)
    await publish_instrument_config_reload()
    return {"id": str(inst.id), "symbol": inst.symbol}


async def deactivate_instrument(
    instrument_id: uuid.UUID,
    admin_id: uuid.UUID,
    ip_address: str | None,
    db: AsyncSession,
) -> dict:
    inst = await db.get(Instrument, instrument_id)
    if not inst:
        raise HTTPException(status_code=404, detail="Instrument not found")
    inst.is_active = False
    await write_audit_log(
        db, admin_id, "deactivate_instrument", "instrument", instrument_id,
        new_values={"is_active": False}, ip_address=ip_address,
    )
    await db.commit()
    await publish_instrument_config_reload()
    return {"message": f"{inst.symbol} deactivated"}


async def bulk_update_configs(
    body: dict[str, Any],
    admin_id: uuid.UUID,
    ip_address: str | None,
    db: AsyncSession,
) -> dict:
    items = body.get("items") or []
    if not isinstance(items, list) or not items:
        raise HTTPException(status_code=400, detail="items array required")
    for raw in items:
        iid = raw.get("id")
        if not iid:
            continue
        try:
            uid = uuid.UUID(str(iid))
        except ValueError:
            continue
        payload = {k: v for k, v in raw.items() if k != "id"}
        try:
            await upsert_instrument_config(db, uid, payload, admin_id, ip_address)
        except ValueError:
            continue
    await write_audit_log(
        db, admin_id, "bulk_update_instrument_config", "instrument", None,
        new_values={"count": len(items)}, ip_address=ip_address,
    )
    await db.commit()
    await publish_instrument_config_reload()
    return {"message": f"Processed {len(items)} instrument config(s)"}
