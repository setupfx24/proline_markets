"""Platform bridge — INBOUND side: execute trades the sister platform sends us.

The peer's trade-bridge worker calls /api/bridge/v1/trades/* (see
api/bridge.py, which checks the HMAC signature). Every copy goes through the
same place_order / close_position / modify_position a client's own click does,
so it is a real trade here: our price, our margin check, our commission, our
SL/TP and stop-out engines.

Idempotency: the peer identifies a trade by ITS position id. The
('in', peer_platform, peer_position_id) row is committed in state 'opening'
BEFORE the order is placed, so a retried or duplicated open can never place a
second order — it finds the row and returns what the first one did.
"""
import logging
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from fastapi import HTTPException, Request
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from packages.common.src.database import AsyncSessionLocal
from packages.common.src.models import BridgeTrade, Order, Position, TradingAccount
from packages.common.src import platform_bridge as pb
from packages.common.src.schemas import (
    ClosePositionRequest, ModifyPositionRequest, PlaceOrderRequest,
)

from .trading_service import close_position, modify_position, place_order

logger = logging.getLogger("bridge-inbound")

# An 'opening' row older than this with no position is taken as a crashed
# attempt: adopt the order it placed, or — only if it placed none — allow a
# fresh attempt. An order is NEVER placed twice for one source position.
STALE_OPENING = timedelta(seconds=60)


class BridgeReply(Exception):
    """Return this status/body to the peer (raised from deep inside a flow)."""

    def __init__(self, status: int, body: dict):
        self.status = status
        self.body = body


def order_tag(source: str, source_position_id: str) -> str:
    return f"Bridge|{source}|{source_position_id}"


def _status(p) -> str:
    return str(getattr(p.status, "value", p.status) or "")


def _reply(row: BridgeTrade, pos: Position | None = None, **extra) -> dict:
    out = {
        "state": row.state,
        "position_id": str(row.local_position_id) if row.local_position_id else None,
        "error": row.error,
    }
    if pos is not None:
        out.update({
            "side": str(getattr(pos.side, "value", pos.side)),
            "lots": float(pos.lots),
            "open_price": float(pos.open_price),
            "stop_loss": float(pos.stop_loss) if pos.stop_loss else None,
            "take_profit": float(pos.take_profit) if pos.take_profit else None,
            "position_status": _status(pos),
        })
    out.update(extra)
    return out


async def _account(db, number: str) -> TradingAccount | None:
    return (await db.execute(
        select(TradingAccount).where(TradingAccount.account_number == str(number))
    )).scalar_one_or_none()


async def _inbound_row(db, source: str, source_position_id: str, lock: bool = False) -> BridgeTrade | None:
    q = select(BridgeTrade).where(
        BridgeTrade.direction == "in",
        BridgeTrade.peer_platform == source,
        BridgeTrade.peer_position_id == str(source_position_id),
    )
    if lock:
        q = q.with_for_update()
    return (await db.execute(q)).scalars().first()


# ─── Account lookup (link validation from the peer's admin) ───────────────

async def account_info(account_number: str) -> dict:
    async with AsyncSessionLocal() as db:
        acct = await _account(db, account_number)
        if not acct:
            return {"exists": False, "account_number": account_number}
        return {
            "exists": True,
            "account_number": acct.account_number,
            "is_active": bool(acct.is_active),
            "is_demo": bool(acct.is_demo),
            "currency": acct.currency or "USD",
            "leverage": acct.leverage,
        }


# ─── Open ─────────────────────────────────────────────────────────────────

async def _set_sl_tp(pos_id, sl, tp, user_id) -> str | None:
    """Put SL/TP on the copy. Never fails the copy: prices on the two platforms
    differ slightly, so a level that was valid at the source can sit on the
    wrong side of our price. Try both, then each alone; report what didn't stick."""
    if sl is None and tp is None:
        return None
    errors = []
    attempts = [{"stop_loss": sl, "take_profit": tp}]
    if sl is not None and tp is not None:
        attempts += [{"stop_loss": sl}, {"take_profit": tp}]
    for fields in attempts:
        try:
            async with AsyncSessionLocal() as db:
                await modify_position(pos_id, ModifyPositionRequest(**fields), user_id, db)
            if len(fields) == 2:
                return None
        except HTTPException as e:
            errors.append(f"{'/'.join(k.split('_')[0].upper() for k in fields)}: {e.detail}")
    return ("SL/TP not set — " + "; ".join(errors)) if errors else None


async def open_trade(source: str, payload: dict, request: Request, ip: str | None) -> dict:
    try:
        src_id = str(payload["source_position_id"])
        target = str(payload["target_account_number"])
        symbol = str(payload["symbol"]).upper()
        side = pb.norm_side(payload["side"])
        lots = Decimal(str(payload["lots"]))
        mode = pb.norm_mode(payload.get("mode"))
        sl = pb._dec_or_none(payload.get("stop_loss"))
        tp = pb._dec_or_none(payload.get("take_profit"))
        src_lots = Decimal(str(payload.get("source_lots") or lots))
        src_account = str(payload.get("source_account_number") or "")
    except (KeyError, ValueError, ArithmeticError) as e:
        raise BridgeReply(400, {"detail": f"bad open payload: {e}"})

    # ── 1. Claim the trade (or find the earlier claim) ───────────────────
    async with AsyncSessionLocal() as db:
        acct = await _account(db, target)
        if not acct:
            raise BridgeReply(404, {"detail": f"account {target} not found"})
        if not acct.is_active:
            raise BridgeReply(403, {"detail": f"account {target} is not active"})
        user_id = acct.user_id
        try:
            req = PlaceOrderRequest(
                account_id=acct.id, symbol=symbol, order_type="market", side=side,
                lots=lots, comment=order_tag(source, src_id),
            )
        except ValidationError as e:
            raise BridgeReply(400, {"detail": f"invalid order: {e.errors()[0].get('msg')}"})

        row = await _inbound_row(db, source, src_id)
        if row is None:
            row = BridgeTrade(
                direction="in", peer_platform=source, peer_position_id=src_id,
                peer_account_number=src_account, local_account_number=target,
                mode=mode, state="opening", src_lots=src_lots,
            )
            db.add(row)
            try:
                await db.commit()
            except IntegrityError:
                await db.rollback()
                row = await _inbound_row(db, source, src_id)
                if row is None:
                    raise BridgeReply(409, {"detail": "open in progress, retry"})
                return await _existing_open(db, row, source, src_id)
        else:
            return await _existing_open(db, row, source, src_id)
        row_id = row.id

    # ── 2. Place the order through the normal path ───────────────────────
    try:
        async with AsyncSessionLocal() as db:
            res = await place_order(req, request, user_id, ip, db)
    except HTTPException as e:
        async with AsyncSessionLocal() as db:
            row = await db.get(BridgeTrade, row_id)
            if e.status_code >= 500:
                # Maintenance / transient: release the claim so a retry can try again.
                await db.delete(row)
                await db.commit()
                raise BridgeReply(503, {"detail": str(e.detail)})
            row.state = "failed"
            row.error = str(e.detail)[:500]
            await db.commit()
        logger.warning("[%s→%s] open refused for %s: %s", source, target, src_id, e.detail)
        raise BridgeReply(422, {"state": "failed", "detail": str(e.detail)})
    except Exception:
        # Unexpected failure: release the claim ONLY if no order went through.
        # Otherwise leave it 'opening' and let the stale-claim path adopt it.
        async with AsyncSessionLocal() as db:
            order, _ = await _tagged_order(db, source, src_id)
            row = await db.get(BridgeTrade, row_id)
            if order is None and row is not None and row.local_position_id is None:
                await db.delete(row)
                await db.commit()
        raise

    # ── 3. Record the copy, then its SL/TP ───────────────────────────────
    async with AsyncSessionLocal() as db:
        pos = (await db.execute(
            select(Position).where(Position.order_id == res["id"])
        )).scalars().first()
        if pos is None:
            _, pos = await _tagged_order(db, source, src_id)
        row = await db.get(BridgeTrade, row_id)
        if pos is None:
            row.state = "failed"
            row.error = f"order {res['id']} was placed but its position was not found — check account {target}"
            await db.commit()
            logger.error("[%s→%s] %s", source, target, row.error)
            raise BridgeReply(422, {"state": "failed", "detail": row.error})
        row.local_position_id = pos.id
        row.state = "open"
        await db.commit()
        pos_id = pos.id

    sltp_error = await _set_sl_tp(pos_id, sl, tp, user_id)
    async with AsyncSessionLocal() as db:
        row = await db.get(BridgeTrade, row_id)
        row.synced_sl, row.synced_tp, row.error = sl, tp, sltp_error
        await db.commit()
        pos = await db.get(Position, pos_id)
        logger.info("[%s→%s] opened copy %s %s %s lots for source %s",
                    source, target, side, symbol, lots, src_id)
        return _reply(row, pos)


async def _existing_open(db, row: BridgeTrade, source: str, src_id: str) -> dict:
    if row.state == "failed":
        raise BridgeReply(422, {"state": "failed", "detail": row.error or "copy failed"})
    if row.local_position_id is not None:
        return _reply(row, await db.get(Position, row.local_position_id))

    # 'opening' with no position yet.
    updated = row.updated_at or row.created_at
    if updated is not None and updated.tzinfo is None:
        updated = updated.replace(tzinfo=timezone.utc)
    if updated is not None and datetime.now(timezone.utc) - updated < STALE_OPENING:
        raise BridgeReply(409, {"detail": "open in progress, retry"})

    # A crashed attempt: did it get as far as placing the order?
    order, pos = await _tagged_order(db, source, src_id)
    if pos is not None:
        row.local_position_id = pos.id
        row.state = "open"
        await db.commit()
        return _reply(row, pos)
    if order is not None:
        # An order exists but no position: never place a second one.
        row.state = "failed"
        row.error = f"order {order.id} was placed but its position was not found — check manually"
        await db.commit()
        raise BridgeReply(422, {"state": "failed", "detail": row.error})
    await db.delete(row)
    await db.commit()
    raise BridgeReply(409, {"detail": "previous attempt abandoned, retry"})


async def _tagged_order(db, source: str, src_id: str):
    """The order (and its position) an earlier attempt placed for this source position."""
    order = (await db.execute(
        select(Order).where(Order.comment == order_tag(source, src_id))
    )).scalars().first()
    if order is None:
        return None, None
    pos = (await db.execute(
        select(Position).where(Position.order_id == order.id)
    )).scalars().first()
    return order, pos


# ─── Close / partial close ────────────────────────────────────────────────

async def close_trade(source: str, payload: dict) -> dict:
    """Close the copy of `source_position_id`.

    `source_lots` is the source position's REMAINING volume: 0 (or absent)
    closes the copy fully; less than the volume we last saw closes the same
    fraction of the copy. Re-sending the same request changes nothing.
    """
    try:
        src_id = str(payload["source_position_id"])
        remaining = Decimal(str(payload.get("source_lots") or 0))
    except (KeyError, ArithmeticError) as e:
        raise BridgeReply(400, {"detail": f"bad close payload: {e}"})

    async with AsyncSessionLocal() as db:
        row = await _inbound_row(db, source, src_id, lock=True)
        if row is None:
            raise BridgeReply(404, {"detail": "no copy for this position"})
        if row.state == "failed":
            return _reply(row)
        if row.state == "opening" or row.local_position_id is None:
            raise BridgeReply(409, {"detail": "open still in progress, retry"})

        pos = await db.get(Position, row.local_position_id)
        if pos is None or _status(pos) != "open":
            row.state = "closed"
            await db.commit()
            return _reply(row, pos)

        acct = await db.get(TradingAccount, pos.account_id)
        step = pos.instrument.lot_step if pos.instrument else Decimal("0.01")
        if remaining <= 0:
            close_lots = None
        else:
            close_lots = pb.partial_close_lots(row.src_lots or pos.lots, remaining, pos.lots, step)
            if close_lots <= 0:
                return _reply(row, pos)
            if close_lots >= pos.lots:
                close_lots = None
        # Stamp the new source volume in the same transaction close_position
        # commits, so the fraction is applied exactly once.
        row.src_lots = remaining if remaining > 0 else row.src_lots
        if close_lots is None:
            row.state = "closed"
        pos_id = pos.id
        try:
            await close_position(pos_id, ClosePositionRequest(lots=close_lots), acct.user_id, db)
        except HTTPException as e:
            await db.rollback()
            if e.status_code == 400 and "not open" in str(e.detail).lower():
                row = await _inbound_row(db, source, src_id)
                row.state = "closed"
                await db.commit()
                return _reply(row)
            raise BridgeReply(503 if e.status_code >= 500 or "price" in str(e.detail).lower() else 422,
                              {"detail": str(e.detail)})

    async with AsyncSessionLocal() as db:
        row = await _inbound_row(db, source, src_id)
        pos = await db.get(Position, pos_id)
        logger.info("[%s] closed %s of copy for source %s",
                    source, "all" if close_lots is None else f"{close_lots} lots", src_id)
        return _reply(row, pos)


# ─── SL/TP modify ─────────────────────────────────────────────────────────

async def modify_trade(source: str, payload: dict) -> dict:
    try:
        src_id = str(payload["source_position_id"])
        sl = pb._dec_or_none(payload.get("stop_loss"))
        tp = pb._dec_or_none(payload.get("take_profit"))
    except (KeyError, ArithmeticError) as e:
        raise BridgeReply(400, {"detail": f"bad modify payload: {e}"})

    async with AsyncSessionLocal() as db:
        row = await _inbound_row(db, source, src_id)
        if row is None:
            raise BridgeReply(404, {"detail": "no copy for this position"})
        if row.local_position_id is None:
            if row.state == "failed":
                return _reply(row)
            raise BridgeReply(409, {"detail": "open still in progress, retry"})
        pos = await db.get(Position, row.local_position_id)
        if pos is None or _status(pos) != "open":
            return _reply(row, pos)
        acct = await db.get(TradingAccount, pos.account_id)
        user_id, pos_id, row_id = acct.user_id, pos.id, row.id

    # Explicit None clears a level, matching the source.
    try:
        async with AsyncSessionLocal() as db:
            await modify_position(pos_id, ModifyPositionRequest(stop_loss=sl, take_profit=tp), user_id, db)
        err = None
    except HTTPException as e:
        err = f"SL/TP not updated — {e.detail}"

    async with AsyncSessionLocal() as db:
        row = await db.get(BridgeTrade, row_id)
        row.synced_sl, row.synced_tp, row.error = sl, tp, err
        await db.commit()
        return _reply(row, await db.get(Position, pos_id))


# ─── Status sweep ─────────────────────────────────────────────────────────

async def trade_status(source: str, payload: dict) -> dict:
    ids = [str(i) for i in (payload.get("source_position_ids") or [])][:500]
    out: dict[str, dict] = {}
    if not ids:
        return {"trades": out}
    async with AsyncSessionLocal() as db:
        rows = (await db.execute(
            select(BridgeTrade).where(
                BridgeTrade.direction == "in",
                BridgeTrade.peer_platform == source,
                BridgeTrade.peer_position_id.in_(ids),
            )
        )).scalars().all()
        for row in rows:
            pos = await db.get(Position, row.local_position_id) if row.local_position_id else None
            if pos is not None and _status(pos) != "open" and row.state == "open":
                row.state = "closed"
            out[row.peer_position_id] = _reply(row, pos)
        await db.commit()
    return {"trades": out}
