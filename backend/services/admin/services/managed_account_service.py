"""Managed (synthetic) account service.

Admin-driven port of ``backend/scripts/gen_seed_muhammad_saud.py``. Given a
``ManagedAccountConfig`` it fabricates a full client history — deposits,
month-wise closed trades whose net profit matches a target return %, and monthly
profit withdrawals — and writes it into the normal platform tables
(``users``, ``trading_accounts``, ``deposits``, ``withdrawals``, ``transactions``,
``positions``, ``trade_history``). Those are exactly the tables the gateway serves
to BOTH the trader web app and the mobile APK, so the account renders on both with
no client-side changes once the client logs in with the generated credentials.

All money math is done in integer cents so monthly sums are exact; the generator
is deterministic for a given config (fixed RNG seed) so regeneration is stable.
Open/close prices are cosmetic — the stored per-trade ``profit`` is authoritative.
"""
import random
import uuid
from calendar import monthrange
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP

from fastapi import HTTPException
from sqlalchemy import select, delete, func, text
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.models import (
    User, TradingAccount, AccountGroup, Instrument,
    Deposit, Withdrawal, Transaction, Position, Order, TradeHistory,
    ManagedAccount,
)
from packages.common.src.admin_schemas import (
    ManagedAccountConfig, ManagedAccountPreview, ManagedMonthPreview,
)
from packages.common.src.auth import hash_password
from dependencies import write_audit_log


# Cosmetic price hints per symbol: (base_price, price_variation, lot_choices).
# Open/close prices are display-only; a generic fallback is used for unknowns.
_PRICE_HINTS = {
    "XAUUSD": (2650.0, 90.0, [1, 1.5, 2, 2.5, 3]),
    "XAGUSD": (31.0, 1.5, [1, 2, 3, 5]),
    "GBPUSD": (1.2650, 0.025, [1, 1.5, 2, 2.5]),
    "EURUSD": (1.0850, 0.02, [1, 1.5, 2, 2.5]),
    "USDJPY": (150.0, 2.5, [1, 1.5, 2, 2.5]),
    "US100": (21000.0, 1300.0, [1, 2, 3]),
    "NAS100": (21000.0, 1300.0, [1, 2, 3]),
    "USTEC": (21000.0, 1300.0, [1, 2, 3]),
    "US30": (43000.0, 1500.0, [1, 2, 3]),
    "US500": (5900.0, 250.0, [1, 2, 3]),
    "BTCUSD": (65000.0, 5000.0, [0.1, 0.2, 0.5]),
    "ETHUSD": (3400.0, 300.0, [0.5, 1, 2]),
}
_DEFAULT_HINT = (1000.0, 20.0, [1, 2, 3])

# Symbol aliases tried when the configured symbol isn't in `instruments`.
_SYMBOL_ALIASES = {
    "US100": ["US100", "NAS100", "USTEC", "NASDAQ100"],
    "USTEC": ["USTEC", "US100", "NAS100"],
    "NAS100": ["NAS100", "US100", "USTEC"],
    "US30": ["US30", "DJ30", "DOW", "US30USD"],
    "US500": ["US500", "SPX500", "SP500"],
}


# ─── Small numeric helpers (mirror the seed generator) ──────────────────────

def _q(value: float, digits: int) -> Decimal:
    return Decimal(str(value)).quantize(Decimal(1).scaleb(-digits), rounding=ROUND_HALF_UP)


def _split_pool(rng: random.Random, pool_cents: int, k: int) -> list[int]:
    """Split a positive amount (cents) into k positive parts summing exactly."""
    if k <= 0:
        return []
    if pool_cents <= 0:
        # Degenerate: spread a tiny pool without forcing positivity.
        parts = [0] * k
        parts[-1] = pool_cents
        return parts
    weights = [rng.uniform(0.75, 1.25) for _ in range(k)]
    tot = sum(weights)
    parts = [int(round(pool_cents * w / tot)) for w in weights]
    parts[-1] = pool_cents - sum(parts[:-1])
    while parts[-1] <= 0 and len(parts) > 1:
        donor = max(range(len(parts) - 1), key=lambda i: parts[i])
        parts[donor] -= 1
        parts[-1] += 1
    return parts


def _txhash(rng: random.Random) -> str:
    return "".join(rng.choice("0123456789abcdef") for _ in range(64))


def _dt(year: int, month: int, day: int, hour: int = 12, minute: int = 0) -> datetime:
    return datetime(year, month, day, hour, minute, 0, tzinfo=timezone.utc)


def _hint(symbol: str):
    return _PRICE_HINTS.get(symbol.upper(), _DEFAULT_HINT)


# ─── Core generator (pure — no DB) ──────────────────────────────────────────

def _instrument_trades(
    rng: random.Random, symbol: str, share_cents: int,
    is_primary: bool, loss_fraction: float, n_win: int,
) -> list[int]:
    """Return a list of per-trade profit cents summing exactly to share_cents."""
    if share_cents <= 0:
        # All-loss (or zero) instrument-month: distribute as negatives.
        return [-p for p in _split_pool(rng, -share_cents, max(1, n_win))] if share_cents < 0 else []
    if is_primary and loss_fraction > 0:
        loss = round(share_cents * loss_fraction)
        l1 = round(loss * 0.55)
        l2 = loss - l1
        winners = _split_pool(rng, share_cents + loss, max(1, n_win))
        parts = winners + [-l1, -l2]
    else:
        parts = _split_pool(rng, share_cents, max(1, n_win))
    rng.shuffle(parts)
    return parts


def _build_events(cfg: ManagedAccountConfig):
    """Compute the full chronological event list + summary. Pure function.

    Returns (events, months_preview, base_capital, total_deposits,
             total_withdrawn, final_balance, warnings).
    Each event is (sort_dt, kind, payload).
    """
    warnings: list[str] = []
    rng = random.Random(cfg.seed)

    total_deposits = sum(d.amount for d in cfg.deposits)
    base_capital = cfg.base_capital if cfg.base_capital is not None else total_deposits
    if base_capital <= 0:
        raise HTTPException(status_code=400, detail="Base capital must be positive")

    # Normalise instrument allocation to weights that sum to 1.
    allocs = [(a.symbol.upper(), float(a.weight_pct)) for a in cfg.instrument_allocation if a.weight_pct > 0]
    if not allocs:
        raise HTTPException(status_code=400, detail="At least one instrument allocation with weight > 0 is required")
    wsum = sum(w for _, w in allocs)
    if abs(wsum - 100.0) > 0.5:
        warnings.append(f"Instrument weights sum to {wsum:.1f}% (normalised to 100%)")
    allocs = [(s, w / wsum) for s, w in allocs]
    primary_symbol = max(allocs, key=lambda x: x[1])[0]

    # Chronological order of the return months; the latest is optionally retained.
    months = sorted(cfg.monthly_returns, key=lambda m: (m.year, m.month))
    if not months:
        raise HTTPException(status_code=400, detail="At least one monthly return is required")
    last_key = (months[-1].year, months[-1].month)

    # Which months get withdrawn.
    if cfg.withdraw_months is not None:
        withdraw_set = set(cfg.withdraw_months)
    else:
        withdraw_set = {
            f"{m.year:04d}-{m.month:02d}" for m in months
            if not (cfg.retain_last_month and (m.year, m.month) == last_key)
        }

    events = []
    for d in cfg.deposits:
        events.append((
            _dt(d.date.year, d.date.month, d.date.day, 11),
            "deposit", {"amount_cents": int(round(d.amount * 100))},
        ))

    now = datetime.now(timezone.utc)
    monthly_profit_cents: dict[tuple[int, int], int] = {}
    months_preview: list[ManagedMonthPreview] = []

    for m in months:
        mc = int(round(m.pct / 100.0 * base_capital * 100))
        monthly_profit_cents[(m.year, m.month)] = mc
        if mc <= 0:
            warnings.append(f"{m.year}-{m.month:02d} return is {m.pct}% (non-positive profit)")

        # Per-instrument share (last absorbs remainder → exact monthly total).
        shares = []
        acc = 0
        for i, (sym, w) in enumerate(allocs):
            if i == len(allocs) - 1:
                shares.append((sym, mc - acc))
            else:
                s = round(mc * w)
                acc += s
                shares.append((sym, s))

        month_trades: list[tuple[str, int]] = []
        for sym, share in shares:
            _, weight = next(a for a in allocs if a[0] == sym)
            n_win = max(3, round(weight * 10))  # ~ weight% / 10, min 3
            parts = _instrument_trades(
                rng, sym, share, sym == primary_symbol, cfg.loss_fraction, n_win,
            )
            month_trades += [(sym, p) for p in parts]

        # Pick distinct trading days within the month.
        days_in_month = monthrange(m.year, m.month)[1]
        min_day = cfg.withdraw_day + 1
        for d in cfg.deposits:
            if d.date.year == m.year and d.date.month == m.month:
                min_day = max(min_day, d.date.day + 1)
        max_day = min(days_in_month - 1, 27)
        # Don't future-date the current month.
        if (m.year, m.month) == (now.year, now.month):
            max_day = min(max_day, max(min_day, now.day))
        if max_day < min_day:
            max_day = min_day
        window = list(range(min_day, max_day + 1))
        n = len(month_trades)
        if n <= len(window):
            days = sorted(rng.sample(window, n))
        else:
            days = sorted(rng.choices(window, k=n))

        for (sym, pcents), day in zip(month_trades, days):
            hint_base, hint_var, lot_choices = _hint(sym)
            lots = rng.choice(lot_choices)
            side = rng.choice(["buy", "sell"])
            o_hour = rng.randint(8, 18)
            c_hour = min(23, o_hour + rng.randint(1, 5))
            opened = _dt(m.year, m.month, day, o_hour, rng.randint(0, 59))
            closed = _dt(m.year, m.month, day, c_hour, rng.randint(0, 59))
            events.append((closed, "trade", {
                "symbol": sym, "side": side, "lots": lots,
                "profit_cents": pcents, "opened": opened, "closed": closed,
                "base": hint_base, "var": hint_var,
            }))

        key = f"{m.year:04d}-{m.month:02d}"
        withdrawn = key in withdraw_set
        wd_date = None
        if withdrawn:
            wy, wm = (m.year + 1, 1) if m.month == 12 else (m.year, m.month + 1)
            wd = min(cfg.withdraw_day, monthrange(wy, wm)[1])
            wdt = _dt(wy, wm, wd, 12)
            wd_date = wdt.date().isoformat()
            events.append((wdt, "withdraw", {"amount_cents": mc, "label": f"{key} profit withdrawal"}))
        months_preview.append(ManagedMonthPreview(
            year=m.year, month=m.month, pct=m.pct,
            profit=mc / 100.0, withdrawn=withdrawn, withdraw_date=wd_date,
        ))

    # Running balance (cents), chronological.
    events.sort(key=lambda e: e[0])
    running = 0
    total_withdrawn_cents = 0
    for _, kind, p in events:
        if kind == "deposit":
            running += p["amount_cents"]
            p["balance_after_cents"] = running
        elif kind == "trade":
            running += p["profit_cents"]
        elif kind == "withdraw":
            running -= p["amount_cents"]
            total_withdrawn_cents += p["amount_cents"]
            p["balance_after_cents"] = running

    final_balance = running / 100.0
    return (events, months_preview, base_capital, total_deposits,
            total_withdrawn_cents / 100.0, final_balance, warnings)


# ─── Public API ─────────────────────────────────────────────────────────────

def preview(cfg: ManagedAccountConfig) -> ManagedAccountPreview:
    (events, months_preview, base_capital, total_deposits,
     total_withdrawn, final_balance, warnings) = _build_events(cfg)
    trades_count = sum(1 for e in events if e[1] == "trade")
    return ManagedAccountPreview(
        base_capital=base_capital,
        total_deposits=total_deposits,
        total_withdrawn=total_withdrawn,
        final_balance=final_balance,
        trades_count=trades_count,
        months=months_preview,
        warnings=warnings,
    )


async def _resolve_instruments(cfg: ManagedAccountConfig, db: AsyncSession) -> dict[str, Instrument]:
    """Map each configured symbol → Instrument row (trying aliases). Errors if missing."""
    resolved: dict[str, Instrument] = {}
    for a in cfg.instrument_allocation:
        if a.weight_pct <= 0:
            continue
        sym = a.symbol.replace("/", "").upper()
        candidates = _SYMBOL_ALIASES.get(sym, [sym])
        inst = None
        for cand in candidates:
            r = await db.execute(select(Instrument).where(Instrument.symbol == cand))
            inst = r.scalar_one_or_none()
            if inst:
                break
        if not inst:
            raise HTTPException(
                status_code=400,
                detail=f"Instrument '{a.symbol}' not found in the platform (tried: {', '.join(candidates)})",
            )
        resolved[sym] = inst
    return resolved


async def _wipe_user_data(user_id: uuid.UUID, db: AsyncSession) -> None:
    """Delete a managed user's generated rows in FK-safe order. Several child
    tables (trade_history/transactions/deposits/withdrawals) have no ON DELETE
    CASCADE, so we cannot rely on a user/account cascade — delete explicitly."""
    acc_rows = await db.execute(select(TradingAccount.id).where(TradingAccount.user_id == user_id))
    acc_ids = [row[0] for row in acc_rows.all()]
    if acc_ids:
        await db.execute(delete(TradeHistory).where(TradeHistory.account_id.in_(acc_ids)))
        await db.execute(delete(Position).where(Position.account_id.in_(acc_ids)))
        await db.execute(delete(Order).where(Order.account_id.in_(acc_ids)))
    await db.execute(delete(Transaction).where(Transaction.user_id == user_id))
    await db.execute(delete(Deposit).where(Deposit.user_id == user_id))
    await db.execute(delete(Withdrawal).where(Withdrawal.user_id == user_id))
    if acc_ids:
        await db.execute(delete(TradingAccount).where(TradingAccount.id.in_(acc_ids)))
    await db.flush()


async def _next_account_number(db: AsyncSession) -> str:
    r = await db.execute(text(
        "SELECT COALESCE(MAX(CASE WHEN account_number ~ '^[0-9]+$' "
        "THEN account_number::bigint END), 700000) + 1 FROM trading_accounts"
    ))
    return str(r.scalar())


async def generate(
    cfg: ManagedAccountConfig, admin_id: uuid.UUID, ip_address: str | None,
    db: AsyncSession, managed_id: uuid.UUID | None = None,
) -> ManagedAccount:
    """Create or regenerate a managed account (idempotent, keyed by email)."""
    # Resolve prerequisites first so we fail before any writes.
    instruments = await _resolve_instruments(cfg, db)

    grp = None
    if cfg.account_group_id:
        gr = await db.execute(select(AccountGroup).where(AccountGroup.id == uuid.UUID(cfg.account_group_id)))
        grp = gr.scalar_one_or_none()
    if grp is None:
        gr = await db.execute(
            select(AccountGroup).where(AccountGroup.is_demo == False)  # noqa: E712
            .order_by(AccountGroup.created_at).limit(1)
        )
        grp = gr.scalar_one_or_none()
    if grp is None:
        gr = await db.execute(select(AccountGroup).order_by(AccountGroup.created_at).limit(1))
        grp = gr.scalar_one_or_none()

    email = str(cfg.email).lower().strip()

    # Existing managed row (by id when editing, else by email).
    ma = None
    if managed_id:
        r = await db.execute(select(ManagedAccount).where(ManagedAccount.id == managed_id))
        ma = r.scalar_one_or_none()
        if ma is None:
            raise HTTPException(status_code=404, detail="Managed account not found")
    if ma is None:
        r = await db.execute(select(ManagedAccount).where(func.lower(ManagedAccount.email) == email))
        ma = r.scalar_one_or_none()

    # Locate / create the underlying user.
    ur = await db.execute(select(User).where(func.lower(User.email) == email))
    user = ur.scalar_one_or_none()

    if user is not None and ma is None:
        # Email belongs to a real, non-managed user — refuse to overwrite it.
        raise HTTPException(
            status_code=409,
            detail=f"A non-managed user already exists with email {email}. Refusing to overwrite real client data.",
        )

    if user is None:
        user = User(email=email)
        db.add(user)

    user.password_hash = hash_password(cfg.password)
    user.first_name = (cfg.first_name or email.split("@")[0])[:100]
    user.last_name = (cfg.last_name or "")[:100]
    user.country = cfg.country
    user.role = "user"
    user.status = "active"
    user.kyc_status = "approved"
    user.email_verified = True
    user.book_type = "B"
    user.is_demo = False
    open_dt = _dt(cfg.open_date.year, cfg.open_date.month, cfg.open_date.day, 10)
    user.created_at = open_dt
    await db.flush()

    # Wipe this user's prior generated data (idempotent rebuild).
    await _wipe_user_data(user.id, db)

    # Build the event stream + summary.
    (events, months_preview, base_capital, total_deposits,
     total_withdrawn, final_balance, _warnings) = _build_events(cfg)

    # New trading account (balance = equity = free_margin = final balance).
    accnum = await _next_account_number(db)
    fb = Decimal(str(round(final_balance, 2)))
    account = TradingAccount(
        user_id=user.id,
        account_group_id=grp.id if grp else None,
        account_number=accnum,
        balance=fb, credit=Decimal("0"), equity=fb, margin_used=Decimal("0"),
        free_margin=fb, margin_level=Decimal("0"),
        leverage=cfg.leverage, currency=cfg.currency,
        is_demo=False, is_active=True,
        created_at=open_dt,
    )
    db.add(account)
    await db.flush()

    rng = random.Random(cfg.seed ^ 0x5EED)  # separate stream for cosmetic tx hashes
    trades_count = 0
    for sort_dt, kind, p in events:
        if kind == "deposit":
            amt = Decimal(str(p["amount_cents"] / 100.0))
            ba = Decimal(str(p["balance_after_cents"] / 100.0))
            db.add(Deposit(
                user_id=user.id, account_id=account.id, amount=amt,
                currency=cfg.pay_currency, method=cfg.pay_method, status="approved",
                crypto_address=cfg.wallet_address, crypto_tx_hash=_txhash(rng),
                transaction_id=_txhash(rng)[:16], approved_at=sort_dt, created_at=sort_dt,
            ))
            db.add(Transaction(
                user_id=user.id, account_id=account.id, type="deposit",
                amount=amt, balance_after=ba,
                description=f"{cfg.pay_currency} deposit {amt:,.0f}", created_at=sort_dt,
            ))
        elif kind == "trade":
            inst = instruments.get(p["symbol"].upper())
            if inst is None:
                continue
            digits = inst.digits or 2
            cs = float(inst.contract_size or Decimal("100000"))
            profit = p["profit_cents"] / 100.0
            lots = p["lots"]
            sign = 1 if p["side"] == "buy" else -1
            open_price = round(p["base"] + rng.uniform(-p["var"], p["var"]), digits)
            denom = sign * lots * cs
            close_price = round(open_price + (profit / denom if denom else 0), digits)
            pos = Position(
                account_id=account.id, instrument_id=inst.id, side=p["side"],
                status="closed", lots=Decimal(str(lots)),
                open_price=_q(open_price, digits), close_price=_q(close_price, digits),
                swap=Decimal("0"), commission=Decimal("0"), profit=Decimal(str(round(profit, 2))),
                closed_at=p["closed"], comment=f"{p['symbol']} historical",
                created_at=p["opened"], updated_at=p["closed"],
            )
            db.add(pos)
            await db.flush()
            db.add(TradeHistory(
                position_id=pos.id, account_id=account.id, instrument_id=inst.id,
                side=p["side"], lots=Decimal(str(lots)),
                open_price=_q(open_price, digits), close_price=_q(close_price, digits),
                swap=Decimal("0"), commission=Decimal("0"), profit=Decimal(str(round(profit, 2))),
                opened_at=p["opened"], closed_at=p["closed"], close_reason="manual",
            ))
            trades_count += 1
        elif kind == "withdraw":
            amt = Decimal(str(p["amount_cents"] / 100.0))
            ba = Decimal(str(p["balance_after_cents"] / 100.0))
            db.add(Withdrawal(
                user_id=user.id, account_id=account.id, amount=amt,
                currency=cfg.pay_currency, method=cfg.pay_method, status="completed",
                crypto_address=cfg.wallet_address, crypto_tx_hash=_txhash(rng),
                approved_at=sort_dt, completed_at=sort_dt, created_at=sort_dt,
            ))
            db.add(Transaction(
                user_id=user.id, account_id=account.id, type="withdrawal",
                amount=amt, balance_after=ba,
                description=f"{p['label']} ({cfg.pay_currency})", created_at=sort_dt,
            ))

    # Upsert the managed_accounts record (config is the edit source of truth).
    label = f"{cfg.first_name} {cfg.last_name}".strip()
    config_json = cfg.model_dump(mode="json")
    if ma is None:
        ma = ManagedAccount(
            user_id=user.id, account_id=account.id, email=email, label=label,
            config=config_json, final_balance=fb, trades_count=trades_count,
            created_by=admin_id,
        )
        db.add(ma)
    else:
        ma.user_id = user.id
        ma.account_id = account.id
        ma.email = email
        ma.label = label
        ma.config = config_json
        ma.final_balance = fb
        ma.trades_count = trades_count
    await db.flush()

    await write_audit_log(
        db, admin_id, "generate_managed_account", "managed_account", ma.id,
        new_values={
            "email": email, "account_number": accnum,
            "final_balance": float(fb), "trades": trades_count,
        },
        ip_address=ip_address,
    )
    await db.commit()
    await db.refresh(ma)
    return ma


async def _to_out(ma: ManagedAccount, db: AsyncSession) -> dict:
    accnum = None
    if ma.account_id:
        r = await db.execute(select(TradingAccount.account_number).where(TradingAccount.id == ma.account_id))
        accnum = r.scalar_one_or_none()
    return {
        "id": str(ma.id),
        "user_id": str(ma.user_id),
        "account_id": str(ma.account_id) if ma.account_id else None,
        "email": ma.email,
        "label": ma.label,
        "account_number": accnum,
        "final_balance": float(ma.final_balance or 0),
        "trades_count": ma.trades_count or 0,
        "created_at": ma.created_at,
        "updated_at": ma.updated_at,
    }


async def list_all(db: AsyncSession) -> dict:
    r = await db.execute(select(ManagedAccount).order_by(ManagedAccount.created_at.desc()))
    rows = r.scalars().all()
    return {"items": [await _to_out(ma, db) for ma in rows]}


async def get_one(managed_id: uuid.UUID, db: AsyncSession) -> dict:
    r = await db.execute(select(ManagedAccount).where(ManagedAccount.id == managed_id))
    ma = r.scalar_one_or_none()
    if ma is None:
        raise HTTPException(status_code=404, detail="Managed account not found")
    out = await _to_out(ma, db)
    out["config"] = ma.config
    return out


async def delete_one(
    managed_id: uuid.UUID, admin_id: uuid.UUID, ip_address: str | None,
    db: AsyncSession, purge_user: bool = True,
) -> dict:
    r = await db.execute(select(ManagedAccount).where(ManagedAccount.id == managed_id))
    ma = r.scalar_one_or_none()
    if ma is None:
        raise HTTPException(status_code=404, detail="Managed account not found")
    user_id = ma.user_id
    email = ma.email
    await db.execute(delete(ManagedAccount).where(ManagedAccount.id == managed_id))
    if purge_user:
        # Remove all generated rows (explicit, FK-safe) then the synthetic user.
        await _wipe_user_data(user_id, db)
        await db.execute(delete(User).where(User.id == user_id))
    await write_audit_log(
        db, admin_id, "delete_managed_account", "managed_account", managed_id,
        old_values={"email": email, "purged_user": purge_user}, ip_address=ip_address,
    )
    await db.commit()
    return {"message": "Managed account deleted"}
