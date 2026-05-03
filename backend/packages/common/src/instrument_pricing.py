"""Resolve spread / commission / price impact for order execution (gateway, engines)."""

from decimal import Decimal
from typing import Optional, Tuple
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.models import ChargeConfig, SpreadConfig, Instrument, InstrumentConfig

async def _get_instrument_config_row(
    db: AsyncSession, instrument_id: UUID
) -> Optional[InstrumentConfig]:
    r = await db.execute(
        select(InstrumentConfig).where(InstrumentConfig.instrument_id == instrument_id)
    )
    return r.scalar_one_or_none()


async def _instrument_config_price_impact(
    db: AsyncSession, instrument_id: UUID
) -> Decimal:
    ic = await _get_instrument_config_row(db, instrument_id)
    if ic and ic.is_enabled and ic.price_impact:
        return Decimal(str(ic.price_impact))
    return Decimal("0")


async def resolve_spread_config(
    db: AsyncSession,
    instrument: Instrument,
    user_id: Optional[UUID] = None,
) -> Tuple[Decimal, str, Decimal]:
    """Returns (spread_value, spread_type, price_impact).

    Priority chain (highest → lowest), mirrors ``resolve_commission`` so admin's
    "All" + specific overrides behave the same across charges and spreads:
      1. User override for this specific instrument
      2. User override global (user, null instrument)
      3. Per-instrument rule (instrument scope, this instrument)
      4. Per-segment rule (segment scope, this instrument's segment)
      5. Default (all instruments)
      6. Zero

    A specific instrument rule wins for that symbol; "All" fills in for the rest.

    ``price_impact`` on ``instrument_configs`` is returned for APIs but is **not**
    applied to Redis stream quotes — widths come only from ``spread_configs``
    so the admin default matches the terminal ``Spr`` display.
    """
    pimp = await _instrument_config_price_impact(db, instrument.id)

    def _to_tuple(row: SpreadConfig) -> Tuple[Decimal, str, Decimal]:
        return (
            Decimal(str(row.value or 0)),
            (row.spread_type or "pips").lower(),
            pimp,
        )

    if user_id:
        ur = await db.execute(
            select(SpreadConfig)
            .where(
                func.lower(SpreadConfig.scope) == "user",
                SpreadConfig.is_enabled == True,
                SpreadConfig.user_id == user_id,
                SpreadConfig.instrument_id == instrument.id,
            )
            .limit(1)
        )
        urow = ur.scalar_one_or_none()
        if urow:
            return _to_tuple(urow)

        ur2 = await db.execute(
            select(SpreadConfig)
            .where(
                func.lower(SpreadConfig.scope) == "user",
                SpreadConfig.is_enabled == True,
                SpreadConfig.user_id == user_id,
                SpreadConfig.instrument_id.is_(None),
            )
            .limit(1)
        )
        urow2 = ur2.scalar_one_or_none()
        if urow2:
            return _to_tuple(urow2)

    ir = await db.execute(
        select(SpreadConfig)
        .where(
            func.lower(SpreadConfig.scope) == "instrument",
            SpreadConfig.is_enabled == True,
            SpreadConfig.user_id.is_(None),
            SpreadConfig.instrument_id == instrument.id,
        )
        .limit(1)
    )
    irow = ir.scalar_one_or_none()
    if irow:
        return _to_tuple(irow)

    if instrument.segment_id:
        sr = await db.execute(
            select(SpreadConfig)
            .where(
                func.lower(SpreadConfig.scope) == "segment",
                SpreadConfig.is_enabled == True,
                SpreadConfig.user_id.is_(None),
                SpreadConfig.segment_id == instrument.segment_id,
            )
            .limit(1)
        )
        srow = sr.scalar_one_or_none()
        if srow:
            return _to_tuple(srow)

    dr = await db.execute(
        select(SpreadConfig)
        .where(
            func.lower(SpreadConfig.scope) == "default",
            SpreadConfig.is_enabled == True,
            SpreadConfig.instrument_id.is_(None),
            SpreadConfig.segment_id.is_(None),
            SpreadConfig.user_id.is_(None),
        )
        .order_by(SpreadConfig.created_at.desc())
        .limit(1)
    )
    default_cfg = dr.scalar_one_or_none()
    if default_cfg:
        return _to_tuple(default_cfg)

    return Decimal("0"), "pips", pimp


def symmetric_quote_from_mid(
    mid: Decimal,
    spread_value: Decimal,
    spread_type: str,
    pip_size: Decimal,
    decimals: int,
    price_impact: Decimal = Decimal("0"),
) -> Tuple[Decimal, Decimal]:
    """Build executable bid/ask symmetrically around mid (streamed quotes).

    Infoway and other feeds contribute a mid reference; platform spread from
    admin spread_configs (default / segment / instrument / user) is applied
    here so the terminal and order fill prices match.
    """
    st = (spread_type or "pips").lower()
    if st == "percentage":
        adj = mid * (spread_value / Decimal("100"))
    else:
        adj = spread_value * pip_size
    imp = price_impact or Decimal("0")
    half = (adj + imp) / Decimal("2")
    bid = mid - half
    ask = mid + half
    q = Decimal("1") / (Decimal(10) ** max(decimals, 0))
    bid = bid.quantize(q)
    ask = ask.quantize(q)
    if ask < bid:
        ask = bid + q
    elif ask == bid and half > 0:
        ask = bid + q
    return bid, ask


def apply_spread_and_impact_to_prices(
    bid: Decimal,
    ask: Decimal,
    side: str,
    spread_value: Decimal,
    spread_type: str,
    pip_size: Decimal,
    price_impact: Decimal,
) -> Tuple[Decimal, Decimal]:
    """Widen the active side by spread markup + adverse price impact."""
    bid_o, ask_o = bid, ask
    st = (spread_type or "pips").lower()
    mid = (bid + ask) / Decimal("2")

    if st == "percentage":
        adj = mid * (spread_value / Decimal("100"))
    else:
        # pips, fixed, variable → extra distance in price units
        adj = spread_value * pip_size

    imp = price_impact or Decimal("0")
    if side == "buy":
        ask_o = ask + adj + imp
    else:
        bid_o = bid - adj - imp
    return bid_o, ask_o


async def resolve_commission(
    db: AsyncSession,
    instrument: Instrument,
    lots: Decimal,
    fill_price: Decimal,
    user_id: Optional[UUID] = None,
) -> Decimal:
    """Total commission for opening/closing a position.

    Priority: User override > Instrument > Segment > Default. If no enabled
    row matches, commission is **0** — an empty Charges screen in admin means
    no commission. A Per-User Override row (admin → Charges → Per User) beats
    every other rule for that user.
    """
    notional = lots * (instrument.contract_size or Decimal("100000")) * fill_price

    if user_id is not None:
        ur = await db.execute(
            select(ChargeConfig)
            .where(
                func.lower(ChargeConfig.scope) == "user",
                ChargeConfig.is_enabled == True,
                ChargeConfig.user_id == user_id,
                ChargeConfig.instrument_id == instrument.id,
            )
            .limit(1)
        )
        urow = ur.scalar_one_or_none()
        if urow:
            return _commission_from_config(urow, lots, notional)

        ur2 = await db.execute(
            select(ChargeConfig)
            .where(
                func.lower(ChargeConfig.scope) == "user",
                ChargeConfig.is_enabled == True,
                ChargeConfig.user_id == user_id,
                ChargeConfig.instrument_id.is_(None),
            )
            .limit(1)
        )
        urow2 = ur2.scalar_one_or_none()
        if urow2:
            return _commission_from_config(urow2, lots, notional)

    for scope, seg_id, inst_id in [
        ("instrument", None, instrument.id),
        ("segment", instrument.segment_id, None),
        ("default", None, None),
    ]:
        q = select(ChargeConfig).where(
            ChargeConfig.scope == scope,
            ChargeConfig.is_enabled == True,
            ChargeConfig.user_id.is_(None),
        )
        if scope == "instrument":
            q = q.where(ChargeConfig.instrument_id == inst_id)
        elif scope == "segment":
            q = q.where(ChargeConfig.segment_id == seg_id)
        else:
            q = q.where(
                ChargeConfig.instrument_id.is_(None),
                ChargeConfig.segment_id.is_(None),
            )
        r = await db.execute(q.limit(1))
        cfg = r.scalar_one_or_none()
        if cfg:
            return _commission_from_config(cfg, lots, notional)

    return Decimal("0")


def _commission_from_config(cfg: ChargeConfig, lots: Decimal, notional: Decimal) -> Decimal:
    v = Decimal(str(cfg.value or 0))
    ct = (cfg.charge_type or "").lower()
    if ct in ("commission_per_lot", "per_lot"):
        return v * lots
    if ct in ("commission_per_trade", "per_trade"):
        return v
    if ct in ("commission_percentage", "percentage", "spread_percentage"):
        return notional * (v / Decimal("100"))
    return v * lots
