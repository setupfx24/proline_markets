"""Admin CRUD for MT5 account links (MetaApi → platform account mappings)
plus the global MetaApi connection config (token + enable), stored in
system_settings so the whole feature is managed from the admin panel."""
import uuid
from datetime import datetime
from decimal import Decimal, InvalidOperation

from fastapi import HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.models import MT5AccountLink, Position, TradingAccount, SystemSetting
from dependencies import write_audit_log

# Global MetaApi connection config lives under this system_settings key. The
# metaapi-worker reads it directly from the DB on each refresh cycle.
CONFIG_KEY = "metaapi_config"


class MT5LinkIn(BaseModel):
    metaapi_account_id: str = Field(min_length=1, max_length=64)
    platform_account_number: str = Field(min_length=1, max_length=20)
    region: str | None = None
    mode: str = "mirror"              # inbound  MT5 → platform: mirror | reverse | off
    outbound_mode: str = "off"        # outbound platform → MT5: off | same | reverse
    max_lots: float | None = None     # per-order outbound cap; None = uncapped
    enabled: bool = True
    label: str | None = ""


class MT5ConfigIn(BaseModel):
    enabled: bool = False
    region: str | None = None
    token: str | None = None       # new token; omit/empty to keep the saved one
    clear_token: bool = False      # set true to wipe the saved token


async def get_config(db: AsyncSession) -> dict:
    row = (await db.execute(
        select(SystemSetting).where(SystemSetting.key == CONFIG_KEY)
    )).scalar_one_or_none()
    val = (row.value if row and isinstance(row.value, dict) else {}) or {}
    return {
        "enabled": bool(val.get("enabled", False)),
        "region": val.get("region", "") or "",
        "token_set": bool(val.get("token")),
    }


async def update_config(body: MT5ConfigIn, admin_id: uuid.UUID, ip_address: str | None,
                        db: AsyncSession) -> dict:
    row = (await db.execute(
        select(SystemSetting).where(SystemSetting.key == CONFIG_KEY)
    )).scalar_one_or_none()
    current = (row.value if row and isinstance(row.value, dict) else {}) or {}

    new_val = {
        "enabled": bool(body.enabled),
        "region": (body.region or "").strip(),
        "token": current.get("token", ""),
    }
    if body.clear_token:
        new_val["token"] = ""
    elif body.token and body.token.strip():
        new_val["token"] = body.token.strip()

    if row:
        row.value = new_val
        row.updated_by = admin_id
        row.updated_at = datetime.utcnow()
    else:
        db.add(SystemSetting(key=CONFIG_KEY, value=new_val, updated_by=admin_id))

    await write_audit_log(
        db, admin_id, "update_metaapi_config", "system_setting", None,
        new_values={"enabled": new_val["enabled"], "region": new_val["region"],
                    "token_set": bool(new_val["token"])},
        ip_address=ip_address,
    )
    await db.commit()
    return {"message": "MetaApi connection settings saved"}


def _serialize(r: MT5AccountLink) -> dict:
    return {
        "id": str(r.id),
        "metaapi_account_id": r.metaapi_account_id,
        "platform_account_number": r.platform_account_number,
        "region": r.region or "",
        "mode": r.mode or "mirror",
        "outbound_mode": r.outbound_mode or "off",
        "max_lots": float(r.max_lots) if r.max_lots is not None else None,
        "enabled": bool(r.enabled),
        "status": r.status or "pending",
        "last_error": r.last_error or "",
        "last_sync_at": r.last_sync_at.isoformat() if r.last_sync_at else None,
        "label": r.label or "",
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }


async def _require_platform_account(db: AsyncSession, account_number: str) -> None:
    acct = (await db.execute(
        select(TradingAccount).where(TradingAccount.account_number == account_number)
    )).scalar_one_or_none()
    if not acct:
        raise HTTPException(
            status_code=400,
            detail=f"Platform account '{account_number}' not found",
        )


def _norm_mode(mode: str) -> str:
    """Inbound direction: what MT5's positions become on the platform."""
    m = (mode or "mirror").strip().lower()
    # 'two_way' used to live here and did nothing except silently disable
    # reverse. Map it rather than 400 on links still carrying it.
    if m == "two_way":
        m = "mirror"
    if m not in ("mirror", "reverse", "off"):
        raise HTTPException(
            status_code=400, detail="mode must be 'mirror', 'reverse' or 'off'",
        )
    return m


def _norm_outbound(mode: str) -> str:
    """Outbound direction: what a platform trade becomes on MT5."""
    m = (mode or "off").strip().lower()
    if m not in ("off", "same", "reverse"):
        raise HTTPException(
            status_code=400, detail="outbound_mode must be 'off', 'same' or 'reverse'",
        )
    return m


def _norm_max_lots(v) -> Decimal | None:
    if v is None or str(v).strip() == "":
        return None
    try:
        d = Decimal(str(v))
    except (InvalidOperation, ValueError):
        raise HTTPException(status_code=400, detail="max_lots must be a number")
    if d <= 0:
        raise HTTPException(status_code=400, detail="max_lots must be greater than 0")
    return d


async def _require_account_free(db: AsyncSession, account_number: str,
                                exclude_id: uuid.UUID | None = None) -> None:
    """One platform account per link. Two links sharing an account fight over it:
    each one's close sweep finalises the other's rows every couple of seconds."""
    q = select(MT5AccountLink).where(
        MT5AccountLink.platform_account_number == account_number
    )
    if exclude_id is not None:
        q = q.where(MT5AccountLink.id != exclude_id)
    other = (await db.execute(q)).scalars().first()
    if other:
        raise HTTPException(
            status_code=400,
            detail=(f"Platform account {account_number} is already linked to MetaApi "
                    f"account {other.metaapi_account_id}"),
        )


async def list_links(db: AsyncSession) -> dict:
    rows = (await db.execute(
        select(MT5AccountLink).order_by(MT5AccountLink.created_at.desc())
    )).scalars().all()
    return {"items": [_serialize(r) for r in rows]}


async def create_link(body: MT5LinkIn, admin_id: uuid.UUID, ip_address: str | None,
                      db: AsyncSession) -> dict:
    mode = _norm_mode(body.mode)
    outbound = _norm_outbound(body.outbound_mode)
    max_lots = _norm_max_lots(body.max_lots)
    await _require_platform_account(db, body.platform_account_number.strip())
    await _require_account_free(db, body.platform_account_number.strip())

    dup = (await db.execute(
        select(MT5AccountLink).where(
            MT5AccountLink.metaapi_account_id == body.metaapi_account_id.strip()
        )
    )).scalar_one_or_none()
    if dup:
        raise HTTPException(status_code=400, detail="This MetaApi account is already linked")

    link = MT5AccountLink(
        metaapi_account_id=body.metaapi_account_id.strip(),
        platform_account_number=body.platform_account_number.strip(),
        region=(body.region or "").strip() or None,
        mode=mode,
        outbound_mode=outbound,
        max_lots=max_lots,
        enabled=body.enabled,
        label=(body.label or "").strip(),
        status="pending",
    )
    db.add(link)
    await db.flush()
    await write_audit_log(
        db, admin_id, "create_mt5_link", "mt5_account_link", link.id,
        new_values={"metaapi_account_id": link.metaapi_account_id,
                    "platform_account_number": link.platform_account_number},
        ip_address=ip_address,
    )
    await db.commit()
    return {"message": "MT5 account linked", "id": str(link.id)}


async def update_link(link_id: uuid.UUID, body: MT5LinkIn, admin_id: uuid.UUID,
                      ip_address: str | None, db: AsyncSession) -> dict:
    link = (await db.execute(
        select(MT5AccountLink).where(MT5AccountLink.id == link_id)
    )).scalar_one_or_none()
    if not link:
        raise HTTPException(status_code=404, detail="MT5 link not found")

    mode = _norm_mode(body.mode)
    outbound = _norm_outbound(body.outbound_mode)
    max_lots = _norm_max_lots(body.max_lots)
    await _require_platform_account(db, body.platform_account_number.strip())
    await _require_account_free(db, body.platform_account_number.strip(), exclude_id=link_id)

    new_metaapi_id = body.metaapi_account_id.strip()
    if new_metaapi_id != link.metaapi_account_id:
        dup = (await db.execute(
            select(MT5AccountLink).where(
                MT5AccountLink.metaapi_account_id == new_metaapi_id,
                MT5AccountLink.id != link_id,
            )
        )).scalar_one_or_none()
        if dup:
            raise HTTPException(status_code=400, detail="This MetaApi account is already linked")

    link.metaapi_account_id = new_metaapi_id
    link.platform_account_number = body.platform_account_number.strip()
    link.region = (body.region or "").strip() or None
    link.mode = mode
    link.outbound_mode = outbound
    link.max_lots = max_lots
    link.enabled = body.enabled
    link.label = (body.label or "").strip()
    # Config changed → worker will re-connect; reset transient status.
    link.status = "pending"
    link.last_error = None

    await write_audit_log(
        db, admin_id, "update_mt5_link", "mt5_account_link", link_id,
        new_values={"metaapi_account_id": link.metaapi_account_id,
                    "platform_account_number": link.platform_account_number,
                    "enabled": link.enabled, "mode": link.mode,
                    "outbound_mode": link.outbound_mode,
                    "max_lots": float(link.max_lots) if link.max_lots is not None else None},
        ip_address=ip_address,
    )
    await db.commit()
    return {"message": "MT5 link updated"}


async def delete_link(link_id: uuid.UUID, admin_id: uuid.UUID, ip_address: str | None,
                      db: AsyncSession) -> dict:
    link = (await db.execute(
        select(MT5AccountLink).where(MT5AccountLink.id == link_id)
    )).scalar_one_or_none()
    if not link:
        raise HTTPException(status_code=404, detail="MT5 link not found")

    # positions.mt5_link_id is ON DELETE RESTRICT so historical attribution can
    # never be silently erased — refuse with a 400 instead of letting the FK 500.
    n = (await db.execute(
        select(func.count()).select_from(Position).where(Position.mt5_link_id == link.id)
    )).scalar() or 0
    if n:
        raise HTTPException(
            status_code=400,
            detail=(f"This link has {n} mirrored position(s). Disable it instead — "
                    f"deleting would erase their trade attribution."),
        )

    await db.delete(link)
    await write_audit_log(
        db, admin_id, "delete_mt5_link", "mt5_account_link", link_id,
        new_values={"deleted": True},
        ip_address=ip_address,
    )
    await db.commit()
    return {"message": "MT5 link deleted"}
