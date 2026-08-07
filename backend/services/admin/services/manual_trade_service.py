"""Manual trades on an existing client account.

The managed-account generator fabricates a whole history from scratch and wipes
the user first. This module does the opposite: it *appends* individual closed
trades — the admin's exact symbol, side, lots, prices and P&L — onto a real
account that is already live, found by the client's login email. Nothing else
about the account is rewritten; only the booked rows and (optionally) the
balance move.

Each booked trade writes the same pair of rows a real close writes — a closed
``positions`` row and its ``trade_history`` row — so it renders in the web app,
the mobile APK and the desktop terminal with no client-side change. The stored
per-trade ``profit`` is authoritative and is used verbatim.

Booked trades carry a tag in ``positions.comment`` (never shown to the client,
which only reads ``trade_history``) so they can be listed and reversed later.
"""
import random
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP

from fastapi import HTTPException
from sqlalchemy import select, delete, func
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.models import (
    User, TradingAccount, AccountGroup, Instrument, Position, TradeHistory,
)
from packages.common.src.admin_schemas import AdminManualTrade, ManualTradeBatch
from dependencies import write_audit_log
from services.managed_account_service import _SYMBOL_ALIASES, live_instruments  # noqa: F401


# Marks a position this module booked. Kept out of the "MT5"/"Algo [" prefixes
# the gateway keys mirrored-trade behaviour off, so a booked trade is treated as
# an ordinary native one everywhere else.
_TAG = "AdminManual"
_NO_BAL = ":nobal"   # appended when the batch was booked without moving balance


def _q(value, digits: int) -> Decimal:
    return Decimal(str(value)).quantize(Decimal(1).scaleb(-digits), rounding=ROUND_HALF_UP)


def _parse_hhmm(value) -> tuple[int, int] | None:
    """'HH:MM' (or 'HH:MM:SS') → (hour, minute); None when unset/unparseable."""
    if not value:
        return None
    parts = str(value).strip().split(":")
    try:
        h, m = int(parts[0]), int(parts[1])
    except (IndexError, ValueError):
        return None
    if not (0 <= h <= 23 and 0 <= m <= 59):
        return None
    return h, m


def _dt(year: int, month: int, day: int, hour: int, minute: int, tz_offset: int) -> datetime:
    """A local wall-clock time on that date, as the UTC instant it stands for.

    ``tz_offset`` is minutes EAST of UTC — what the admin's browser reports, so
    IST is +330. Everything downstream stores UTC; this is only about which
    instant "6 August, 4:18 PM" means to the person who typed it.
    """
    local = datetime(year, month, day, hour, minute, 0, tzinfo=timezone.utc)
    return local - timedelta(minutes=tz_offset)


def _times(mt: AdminManualTrade, rng: random.Random, tz_offset: int = 0) -> tuple[datetime, datetime]:
    """(opened_at, closed_at) for one trade — both on the trade's own date, in
    the admin's timezone. The admin may pin the close clock time; the open is
    then a few hours earlier.

    The clock times here are LOCAL to whoever booked the trade, which is the
    whole point: these rows are rendered back with toLocaleString(), so a UTC
    evening used to cross midnight and a trade booked for the 7th showed up as
    the 8th. Keeping the generated hours inside a local 08:00–21:00 window means
    the date the admin picked is the date everyone in that region reads back.
    """
    y, mo, day = mt.date.year, mt.date.month, mt.date.day
    hhmm = _parse_hhmm(mt.close_time)
    if hhmm:
        c_hour, c_min = hhmm
        closed = _dt(y, mo, day, c_hour, c_min, tz_offset)
        o_hour = max(0, c_hour - rng.randint(1, 4))
        o_min = rng.randint(0, 59) if o_hour != c_hour else max(0, c_min - 5)
        opened = _dt(y, mo, day, o_hour, o_min, tz_offset)
    else:
        o_hour = rng.randint(8, 16)
        c_hour = min(21, o_hour + rng.randint(1, 5))
        opened = _dt(y, mo, day, o_hour, rng.randint(0, 59), tz_offset)
        closed = _dt(y, mo, day, c_hour, rng.randint(0, 59), tz_offset)
    return opened, closed


async def _resolve_instruments(trades: list[AdminManualTrade], db: AsyncSession) -> dict[str, Instrument]:
    """Map each traded symbol → Instrument row (trying the platform's aliases).
    Resolved up-front so a typo fails before anything is written."""
    resolved: dict[str, Instrument] = {}
    for mt in trades:
        sym = mt.symbol.replace("/", "").upper()
        if sym in resolved:
            continue
        for cand in _SYMBOL_ALIASES.get(sym, [sym]):
            r = await db.execute(select(Instrument).where(Instrument.symbol == cand))
            inst = r.scalar_one_or_none()
            if inst:
                resolved[sym] = inst
                break
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Instrument '{mt.symbol}' not found on the platform",
            )
    return resolved


async def _account_summary(acc: TradingAccount, db: AsyncSession) -> dict:
    group = None
    if acc.account_group_id:
        gr = await db.execute(select(AccountGroup.name).where(AccountGroup.id == acc.account_group_id))
        group = gr.scalar_one_or_none()
    booked = await db.execute(
        select(func.count(Position.id)).where(
            Position.account_id == acc.id,
            Position.comment.like(f"{_TAG}%"),
        )
    )
    return {
        "id": str(acc.id),
        "account_number": acc.account_number,
        "group": group,
        "currency": acc.currency,
        "leverage": acc.leverage,
        "is_demo": bool(acc.is_demo),
        "is_active": bool(acc.is_active),
        "balance": float(acc.balance or 0),
        "equity": float(acc.equity or 0),
        "credit": float(acc.credit or 0),
        "booked_trades": booked.scalar() or 0,
    }


# ─── Public API ─────────────────────────────────────────────────────────────

async def list_clients(db: AsyncSession) -> dict:
    """Every bookable client, for the admin's client picker.

    The join to trading_accounts is the filter, not a decoration: booking needs
    an account and :func:`lookup` refuses a user without one, so anybody missing
    from that table could only ever be a dead entry in the dropdown. It also
    keeps staff logins out of the list for free — they hold no trading account.
    """
    r = await db.execute(
        select(
            User.id,
            User.email,
            User.first_name,
            User.last_name,
            User.status,
            func.count(TradingAccount.id).label("accounts"),
        )
        .join(TradingAccount, TradingAccount.user_id == User.id)
        .group_by(User.id)
        .order_by(func.lower(func.coalesce(User.first_name, User.email)))
    )
    items = [
        {
            "id": str(row.id),
            "email": row.email,
            "name": f"{row.first_name or ''} {row.last_name or ''}".strip() or row.email,
            "status": row.status,
            "accounts": row.accounts,
        }
        for row in r.all()
    ]
    return {"items": items, "total": len(items)}


async def lookup(email: str, db: AsyncSession) -> dict:
    """Find a client by login email and list the accounts trades can go onto."""
    email = (email or "").strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")

    r = await db.execute(select(User).where(func.lower(User.email) == email))
    user = r.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail=f"No user found with email {email}")

    ar = await db.execute(
        select(TradingAccount)
        .where(TradingAccount.user_id == user.id)
        .order_by(TradingAccount.is_demo, TradingAccount.created_at)
    )
    accounts = [await _account_summary(a, db) for a in ar.scalars().all()]
    if not accounts:
        raise HTTPException(status_code=400, detail=f"{email} has no trading account yet")

    return {
        "user": {
            "id": str(user.id),
            "email": user.email,
            "name": f"{user.first_name or ''} {user.last_name or ''}".strip() or user.email,
            "status": user.status,
            "book_type": (user.book_type or "B"),
            "kyc_status": user.kyc_status,
            "country": user.country,
        },
        "accounts": accounts,
    }


async def _target_account(body: ManualTradeBatch, db: AsyncSession) -> tuple[User, TradingAccount]:
    email = (body.email or "").strip().lower()
    r = await db.execute(select(User).where(func.lower(User.email) == email))
    user = r.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail=f"No user found with email {email}")

    if body.account_id:
        try:
            acc_uuid = uuid.UUID(body.account_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid account id")
        ar = await db.execute(select(TradingAccount).where(TradingAccount.id == acc_uuid))
        acc = ar.scalar_one_or_none()
        if acc is None or acc.user_id != user.id:
            raise HTTPException(status_code=400, detail="That account does not belong to this user")
    else:
        ar = await db.execute(
            select(TradingAccount)
            .where(TradingAccount.user_id == user.id, TradingAccount.is_demo == False)  # noqa: E712
            .order_by(TradingAccount.created_at).limit(1)
        )
        acc = ar.scalar_one_or_none()
        if acc is None:
            raise HTTPException(status_code=400, detail=f"{email} has no live trading account")
    return user, acc


def _validate_dates(trades: list[AdminManualTrade], tz_offset: int = 0) -> None:
    """A trade cannot close in the future — the client's history would show a
    close that hasn't happened, and the balance would already include its P&L.

    "Today" is the admin's today, not UTC's: booking a trade for the current
    date is the common case, and east of UTC that date arrives hours before it
    does in UTC. Judging it by the UTC calendar rejected the admin's own today.
    """
    today = (datetime.now(timezone.utc) + timedelta(minutes=tz_offset)).date()
    future = [mt.date.isoformat() for mt in trades if mt.date > today]
    if future:
        raise HTTPException(
            status_code=400,
            detail=f"Close date is in the future: {', '.join(sorted(set(future)))}",
        )


async def preview(body: ManualTradeBatch, db: AsyncSession) -> dict:
    """Resolve everything and show what applying would do — writes nothing."""
    user, acc = await _target_account(body, db)
    _validate_dates(body.trades, body.tz_offset_minutes)
    instruments = await _resolve_instruments(body.trades, db)

    rows = []
    total = 0.0
    for mt in body.trades:
        inst = instruments[mt.symbol.replace("/", "").upper()]
        total += mt.pnl
        rows.append({
            "date": mt.date.isoformat(),
            "symbol": inst.symbol,
            "side": mt.side,
            "lots": mt.lots,
            "open_price": mt.open_price,
            "close_price": mt.close_price,
            "pnl": mt.pnl,
            "close_reason": mt.close_reason,
        })

    balance = float(acc.balance or 0)
    return {
        "user": {"email": user.email, "name": f"{user.first_name or ''} {user.last_name or ''}".strip()},
        "account": await _account_summary(acc, db),
        "trades": rows,
        "total_pnl": round(total, 2),
        "balance_before": balance,
        "balance_after": round(balance + (total if body.adjust_balance else 0.0), 2),
        "adjust_balance": body.adjust_balance,
    }


async def apply(
    body: ManualTradeBatch, admin_id: uuid.UUID, ip_address: str | None, db: AsyncSession,
) -> dict:
    """Book the batch onto the account: closed positions + history (+ balance)."""
    user, acc = await _target_account(body, db)
    _validate_dates(body.trades, body.tz_offset_minutes)
    instruments = await _resolve_instruments(body.trades, db)

    rng = random.Random()
    tag = _TAG + ("" if body.adjust_balance else _NO_BAL)
    total = Decimal("0")
    booked: list[str] = []

    for mt in body.trades:
        inst = instruments[mt.symbol.replace("/", "").upper()]
        digits = inst.digits or 2
        opened, closed = _times(mt, rng, body.tz_offset_minutes)
        profit = Decimal(str(round(mt.pnl, 2)))
        total += profit
        note = f"{tag} · {inst.symbol}"
        if mt.comment:
            note = f"{note} · {mt.comment.strip()[:120]}"

        pos = Position(
            account_id=acc.id, instrument_id=inst.id, side=mt.side.lower(),
            status="closed", lots=Decimal(str(mt.lots)),
            open_price=_q(mt.open_price, digits), close_price=_q(mt.close_price, digits),
            swap=Decimal("0"), commission=Decimal("0"), profit=profit,
            closed_at=closed, comment=note, is_admin_modified=True,
            created_at=opened, updated_at=closed,
        )
        db.add(pos)
        await db.flush()
        db.add(TradeHistory(
            position_id=pos.id, account_id=acc.id, instrument_id=inst.id,
            side=mt.side.lower(), lots=Decimal(str(mt.lots)),
            open_price=_q(mt.open_price, digits), close_price=_q(mt.close_price, digits),
            swap=Decimal("0"), commission=Decimal("0"), profit=profit,
            opened_at=opened, closed_at=closed,
            close_reason=(mt.close_reason or "manual").lower(),
        ))
        booked.append(str(pos.id))

    if body.adjust_balance and total != 0:
        acc.balance = (acc.balance or Decimal("0")) + total
        acc.equity = acc.balance + (acc.credit or Decimal("0"))
        acc.free_margin = acc.equity - (acc.margin_used or Decimal("0"))

    await write_audit_log(
        db, admin_id, "book_manual_trades", "trading_account", acc.id,
        new_values={
            "email": user.email, "account_number": acc.account_number,
            "trades": len(booked), "total_pnl": float(total),
            "balance_adjusted": body.adjust_balance,
            "balance_after": float(acc.balance or 0),
        },
        ip_address=ip_address,
    )
    await db.commit()

    await db.refresh(acc)
    return {
        "message": f"{len(booked)} trade(s) booked on account {acc.account_number}",
        "position_ids": booked,
        "total_pnl": float(total),
        "balance": float(acc.balance or 0),
    }


async def list_booked(account_id: uuid.UUID, db: AsyncSession) -> dict:
    """Trades this tool booked on the account, newest close first."""
    r = await db.execute(
        select(Position, Instrument.symbol)
        .outerjoin(Instrument, Position.instrument_id == Instrument.id)
        .where(Position.account_id == account_id, Position.comment.like(f"{_TAG}%"))
        .order_by(Position.closed_at.desc())
        .limit(200)
    )
    items = []
    for pos, symbol in r.all():
        note = pos.comment or ""
        items.append({
            "id": str(pos.id),
            "symbol": symbol,
            "side": pos.side.value if hasattr(pos.side, "value") else str(pos.side),
            "lots": float(pos.lots or 0),
            "open_price": float(pos.open_price or 0),
            "close_price": float(pos.close_price or 0),
            "profit": float(pos.profit or 0),
            "opened_at": pos.created_at,
            "closed_at": pos.closed_at,
            "balance_adjusted": _NO_BAL not in note,
        })
    return {"items": items}


async def delete_booked(
    position_id: uuid.UUID, admin_id: uuid.UUID, ip_address: str | None, db: AsyncSession,
) -> dict:
    """Reverse one booked trade — drop both rows and undo its balance effect."""
    r = await db.execute(select(Position).where(Position.id == position_id))
    pos = r.scalar_one_or_none()
    if pos is None:
        raise HTTPException(status_code=404, detail="Trade not found")
    note = pos.comment or ""
    if not note.startswith(_TAG):
        raise HTTPException(
            status_code=400,
            detail="This is a real trade, not one booked here — refusing to delete it.",
        )

    profit = pos.profit or Decimal("0")
    account_id = pos.account_id
    if _NO_BAL not in note:
        ar = await db.execute(select(TradingAccount).where(TradingAccount.id == account_id))
        acc = ar.scalar_one_or_none()
        if acc:
            acc.balance = (acc.balance or Decimal("0")) - profit
            acc.equity = acc.balance + (acc.credit or Decimal("0"))
            acc.free_margin = acc.equity - (acc.margin_used or Decimal("0"))

    await db.execute(delete(TradeHistory).where(TradeHistory.position_id == position_id))
    await db.execute(delete(Position).where(Position.id == position_id))

    await write_audit_log(
        db, admin_id, "delete_manual_trade", "position", position_id,
        old_values={"account_id": str(account_id), "profit": float(profit), "comment": note},
        ip_address=ip_address,
    )
    await db.commit()
    return {"message": "Booked trade removed", "reversed_pnl": float(profit)}
