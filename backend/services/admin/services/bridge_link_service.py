"""Admin CRUD for platform-bridge links (local account → sister-platform account)
and the bridged-trade log. The connection itself (peer URL, shared secret) is
deployment config in .env — see BRIDGE_* in packages/common/src/config.py."""
import uuid
from datetime import datetime
from decimal import Decimal, InvalidOperation

from fastapi import HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.config import get_settings
from packages.common.src.models import BridgeLink, BridgeTrade, Position, TradingAccount
from packages.common.src import platform_bridge as pb
from dependencies import write_audit_log


class BridgeLinkIn(BaseModel):
    local_account_number: str = Field(min_length=1, max_length=20)
    peer_account_number: str = Field(min_length=1, max_length=20)
    mode: str = "straight"                 # straight | reverse
    lot_multiplier: float = 1.0
    max_lots: float | None = None          # per-trade cap on the copy; None = uncapped
    copy_sl_tp: bool = True
    enabled: bool = True
    label: str | None = ""


def _peer():
    return pb.peer_client_from_settings(get_settings())


def connection_info() -> dict:
    s = get_settings()
    return {
        "enabled": bool(s.BRIDGE_ENABLED),
        "platform_id": s.BRIDGE_PLATFORM_ID,
        "peer_id": s.BRIDGE_PEER_ID,
        "peer_url": s.BRIDGE_PEER_URL,
        "secret_set": bool(s.BRIDGE_SHARED_SECRET),
    }


async def test_connection() -> dict:
    info = connection_info()
    if not info["enabled"]:
        return {**info, "ok": False, "detail": "BRIDGE_ENABLED is false on this platform"}
    try:
        res = await _peer().ping()
        return {**info, "ok": True, "detail": f"connected to '{res.get('platform')}'"}
    except pb.PeerError as e:
        return {**info, "ok": False, "detail": str(e)}


def _serialize(r: BridgeLink, counts: dict | None = None) -> dict:
    c = counts or {}
    return {
        "id": str(r.id),
        "local_account_number": r.local_account_number,
        "peer_account_number": r.peer_account_number,
        "mode": r.mode,
        "lot_multiplier": float(r.lot_multiplier or 1),
        "max_lots": float(r.max_lots) if r.max_lots is not None else None,
        "copy_sl_tp": bool(r.copy_sl_tp),
        "enabled": bool(r.enabled),
        "status": r.status or "pending",
        "last_error": r.last_error or "",
        "last_sync_at": r.last_sync_at.isoformat() if r.last_sync_at else None,
        "baseline_at": r.baseline_at.isoformat() if r.baseline_at else None,
        "label": r.label or "",
        "open_copies": c.get("open", 0),
        "failed_copies": c.get("failed", 0),
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }


async def list_links(db: AsyncSession) -> dict:
    rows = (await db.execute(select(BridgeLink).order_by(BridgeLink.created_at.desc()))).scalars().all()
    count_rows = (await db.execute(
        select(BridgeTrade.link_id, BridgeTrade.state, func.count())
        .where(BridgeTrade.direction == "out", BridgeTrade.link_id.isnot(None))
        .group_by(BridgeTrade.link_id, BridgeTrade.state)
    )).all()
    counts: dict = {}
    for link_id, state, n in count_rows:
        counts.setdefault(link_id, {})[state] = n
    return {
        "connection": connection_info(),
        "links": [_serialize(r, counts.get(r.id)) for r in rows],
    }


def _validate(body: BridgeLinkIn) -> dict:
    try:
        mode = pb.norm_mode(body.mode)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    try:
        mult = Decimal(str(body.lot_multiplier))
        max_lots = Decimal(str(body.max_lots)) if body.max_lots not in (None, "") else None
    except (InvalidOperation, ValueError):
        raise HTTPException(status_code=400, detail="lot_multiplier / max_lots must be numbers")
    if mult <= 0 or mult > 100:
        raise HTTPException(status_code=400, detail="lot_multiplier must be between 0 and 100")
    if max_lots is not None and max_lots <= 0:
        raise HTTPException(status_code=400, detail="max_lots must be greater than 0")
    return {
        "local_account_number": body.local_account_number.strip(),
        "peer_account_number": body.peer_account_number.strip(),
        "mode": mode,
        "lot_multiplier": mult,
        "max_lots": max_lots,
        "copy_sl_tp": bool(body.copy_sl_tp),
        "enabled": bool(body.enabled),
        "label": (body.label or "").strip()[:100],
    }


async def _check_accounts(db: AsyncSession, local: str, peer: str) -> str | None:
    """Local account must exist here; the peer account must exist there.

    Returns a warning when the peer can't be asked (bridge off / unreachable) —
    the link is still saved, and the worker reports the problem on first use.
    """
    acct = (await db.execute(
        select(TradingAccount).where(TradingAccount.account_number == local)
    )).scalar_one_or_none()
    if not acct:
        raise HTTPException(status_code=400, detail=f"Account '{local}' not found on this platform")
    if not get_settings().BRIDGE_ENABLED:
        return "Bridge is disabled on this platform (BRIDGE_ENABLED=false) — the peer account was not checked."
    try:
        info = await _peer().account(peer)
    except pb.PeerError as e:
        return f"Could not verify peer account {peer}: {e}"
    if not info.get("exists"):
        raise HTTPException(
            status_code=400,
            detail=f"Account '{peer}' not found on {get_settings().BRIDGE_PEER_ID}",
        )
    if not info.get("is_active", True):
        raise HTTPException(status_code=400, detail=f"Peer account '{peer}' is not active")
    if bool(info.get("is_demo")) != bool(acct.is_demo):
        return (f"Note: account {local} is {'demo' if acct.is_demo else 'live'} but peer account "
                f"{peer} is {'demo' if info.get('is_demo') else 'live'}.")
    return None


async def _ensure_unique_local(db: AsyncSession, local: str, exclude_id=None) -> None:
    q = select(BridgeLink).where(BridgeLink.local_account_number == local)
    if exclude_id is not None:
        q = q.where(BridgeLink.id != exclude_id)
    if (await db.execute(q)).scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail=f"Account {local} already has a bridge link — edit that one instead",
        )


async def create_link(body: BridgeLinkIn, admin_id: uuid.UUID, ip_address: str | None,
                      db: AsyncSession) -> dict:
    data = _validate(body)
    await _ensure_unique_local(db, data["local_account_number"])
    warning = await _check_accounts(db, data["local_account_number"], data["peer_account_number"])
    # baseline_at is naive UTC on purpose: it is compared with positions.created_at.
    link = BridgeLink(**data, baseline_at=datetime.utcnow(), status="pending", created_by=admin_id)
    db.add(link)
    await db.flush()
    await write_audit_log(
        db, admin_id, "create_bridge_link", "bridge_link", link.id,
        new_values={k: str(v) for k, v in data.items()}, ip_address=ip_address,
    )
    await db.commit()
    return {"link": _serialize(link), "warning": warning}


async def update_link(link_id: uuid.UUID, body: BridgeLinkIn, admin_id: uuid.UUID,
                      ip_address: str | None, db: AsyncSession) -> dict:
    link = await db.get(BridgeLink, link_id)
    if not link:
        raise HTTPException(status_code=404, detail="Bridge link not found")
    data = _validate(body)
    await _ensure_unique_local(db, data["local_account_number"], exclude_id=link.id)
    warning = None
    if (data["local_account_number"], data["peer_account_number"]) != (
            link.local_account_number, link.peer_account_number):
        warning = await _check_accounts(db, data["local_account_number"], data["peer_account_number"])

    old = {"enabled": link.enabled, "mode": link.mode,
           "local": link.local_account_number, "peer": link.peer_account_number}
    re_enabled = data["enabled"] and not link.enabled
    repointed = data["local_account_number"] != link.local_account_number
    for k, v in data.items():
        setattr(link, k, v)
    # Switching a link (back) on, or onto another account, starts from now:
    # positions already open there are never fired across.
    if re_enabled or repointed:
        link.baseline_at = datetime.utcnow()
        link.status, link.last_error = "pending", None
    await write_audit_log(
        db, admin_id, "update_bridge_link", "bridge_link", link.id,
        old_values={k: str(v) for k, v in old.items()},
        new_values={k: str(v) for k, v in data.items()}, ip_address=ip_address,
    )
    await db.commit()
    return {"link": _serialize(link), "warning": warning}


async def delete_link(link_id: uuid.UUID, admin_id: uuid.UUID, ip_address: str | None,
                      db: AsyncSession) -> dict:
    link = await db.get(BridgeLink, link_id)
    if not link:
        raise HTTPException(status_code=404, detail="Bridge link not found")
    await write_audit_log(
        db, admin_id, "delete_bridge_link", "bridge_link", link.id,
        old_values={"local": link.local_account_number, "peer": link.peer_account_number,
                    "mode": link.mode},
        ip_address=ip_address,
    )
    await db.delete(link)
    await db.commit()
    # Copies already open on the peer keep following their source: the worker
    # still sends their closes (bridge_trades.link_id is set NULL, not deleted).
    return {"message": "Bridge link removed. Trades already copied stay paired: closing either side still closes the other."}


async def list_trades(db: AsyncSession, link_id: uuid.UUID | None = None,
                      direction: str | None = None, limit: int = 200) -> list[dict]:
    q = select(BridgeTrade, Position).outerjoin(Position, Position.id == BridgeTrade.local_position_id)
    if link_id is not None:
        q = q.where(BridgeTrade.link_id == link_id)
    if direction in ("in", "out"):
        q = q.where(BridgeTrade.direction == direction)
    rows = (await db.execute(q.order_by(BridgeTrade.created_at.desc()).limit(max(1, min(limit, 1000))))).all()
    out = []
    for t, pos in rows:
        out.append({
            "id": str(t.id),
            "direction": t.direction,
            "link_id": str(t.link_id) if t.link_id else None,
            "local_account_number": t.local_account_number,
            "peer_platform": t.peer_platform,
            "peer_account_number": t.peer_account_number,
            "local_position_id": str(t.local_position_id) if t.local_position_id else None,
            "peer_position_id": t.peer_position_id,
            "mode": t.mode,
            "state": t.state,
            "symbol": pos.instrument.symbol if pos is not None and pos.instrument else None,
            "side": str(getattr(pos.side, "value", pos.side)) if pos is not None else None,
            "lots": float(pos.lots) if pos is not None else None,
            "open_price": float(pos.open_price) if pos is not None else None,
            "position_status": str(getattr(pos.status, "value", pos.status)) if pos is not None else None,
            "attempts": t.attempts or 0,
            "error": t.error or "",
            "created_at": t.created_at.isoformat() if t.created_at else None,
            "updated_at": t.updated_at.isoformat() if t.updated_at else None,
        })
    return out
