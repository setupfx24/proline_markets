"""Social Trading Service — Leaderboard, copy trading, MAM/PAMM, followers."""
import json
import secrets
from decimal import Decimal
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select, func, or_, extract
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.models import (
    MasterAccount, InvestorAllocation, CopyTrade,
    TradingAccount, User, Position, PositionStatus,
    TradeHistory, AllocationCopyType, Transaction,
)
from packages.common.src.redis_client import redis_client


def _gen_investor_account_number(copy_type: str = "signal") -> str:
    """Generate a unique account number for an auto-created investor sub-account."""
    prefix = "CF"  # Copy Fund
    if copy_type in ("pamm", "mam"):
        prefix = "IF"  # Investment Fund
    return f"{prefix}{secrets.randbelow(90000000) + 10000000}"


async def _calculate_live_return(account_id: UUID) -> dict:
    equity_data = await redis_client.get(f"account_equity:{account_id}")
    if equity_data:
        return json.loads(equity_data)
    return {}


async def list_leaderboard(
    sort_by: str, page: int, per_page: int, user_id: UUID, db: AsyncSession,
) -> dict:
    count_result = await db.execute(
        select(func.count()).select_from(MasterAccount).where(
            MasterAccount.status == "approved",
            or_(
                MasterAccount.master_type == "signal_provider",
                MasterAccount.master_type.is_(None),
                MasterAccount.master_type == "",
            ),
        )
    )
    total = count_result.scalar()

    query = (
        select(MasterAccount, User.first_name, User.last_name)
        .join(User, MasterAccount.user_id == User.id)
        .where(
            MasterAccount.status == "approved",
            or_(
                MasterAccount.master_type == "signal_provider",
                MasterAccount.master_type.is_(None),
                MasterAccount.master_type == "",
            ),
        )
        .order_by(getattr(MasterAccount, sort_by).desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    result = await db.execute(query)
    rows = result.all()

    items = []
    for master, first_name, last_name in rows:
        is_copying = False
        alloc_result = await db.execute(
            select(InvestorAllocation).where(
                InvestorAllocation.master_id == master.id,
                InvestorAllocation.investor_user_id == user_id,
                InvestorAllocation.status == "active",
            )
        )
        if alloc_result.scalar_one_or_none():
            is_copying = True

        # Real follower count = count of ACTIVE allocations (excludes closed/paused/etc)
        real_followers_q = await db.execute(
            select(func.count()).select_from(InvestorAllocation).where(
                InvestorAllocation.master_id == master.id,
                InvestorAllocation.status == "active",
            )
        )
        real_followers = real_followers_q.scalar() or 0

        items.append({
            "id": str(master.id),
            "user_id": str(master.user_id),
            "provider_name": f"{first_name or ''} {last_name or ''}".strip(),
            "total_return_pct": float(master.total_return_pct),
            "max_drawdown_pct": float(master.max_drawdown_pct),
            "sharpe_ratio": float(master.sharpe_ratio),
            "followers_count": real_followers,
            "performance_fee_pct": float(master.performance_fee_pct),
            "min_investment": float(master.min_investment),
            "description": master.description,
            "strategy_info": getattr(master, "strategy_info", None),
            "created_at": master.created_at.isoformat() if master.created_at else None,
            "is_copying": is_copying,
        })

    return {
        "items": items, "total": total, "page": page, "per_page": per_page,
        "pages": (total + per_page - 1) // per_page if total else 0,
    }


async def get_provider_detail(
    provider_id: UUID, user_id: UUID, db: AsyncSession,
) -> dict:
    result = await db.execute(
        select(MasterAccount, User.first_name, User.last_name)
        .join(User, MasterAccount.user_id == User.id)
        .where(MasterAccount.id == provider_id, MasterAccount.status == "approved")
    )
    row = result.one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Provider not found")

    master, first_name, last_name = row

    investor_count = await db.execute(
        select(func.count()).select_from(InvestorAllocation).where(
            InvestorAllocation.master_id == master.id,
            InvestorAllocation.status == "active",
        )
    )
    active_investors = investor_count.scalar()

    trades_result = await db.execute(
        select(func.count(), func.sum(TradeHistory.profit)).where(
            TradeHistory.account_id == master.account_id,
        )
    )
    trades_row = trades_result.one()
    total_trades = trades_row[0] or 0
    total_profit = float(trades_row[1] or 0)

    win_count_result = await db.execute(
        select(func.count()).where(
            TradeHistory.account_id == master.account_id,
            TradeHistory.profit > 0,
        )
    )
    wins = win_count_result.scalar()
    win_rate = (wins / total_trades * 100) if total_trades > 0 else 0

    monthly_result = await db.execute(
        select(
            func.date_trunc("month", TradeHistory.closed_at).label("month"),
            func.sum(TradeHistory.profit).label("profit"),
        )
        .where(TradeHistory.account_id == master.account_id)
        .group_by("month")
        .order_by("month")
    )
    monthly_breakdown = [
        {"month": str(r.month), "profit": float(r.profit)}
        for r in monthly_result.all()
    ]

    is_copying = False
    alloc_result = await db.execute(
        select(InvestorAllocation).where(
            InvestorAllocation.master_id == master.id,
            InvestorAllocation.investor_user_id == user_id,
            InvestorAllocation.status == "active",
        )
    )
    if alloc_result.scalar_one_or_none():
        is_copying = True

    return {
        "id": str(master.id),
        "provider_name": f"{first_name or ''} {last_name or ''}".strip(),
        "total_return_pct": float(master.total_return_pct),
        "max_drawdown_pct": float(master.max_drawdown_pct),
        "sharpe_ratio": float(master.sharpe_ratio),
        "followers_count": active_investors,  # actual count from allocations, not stale counter
        "active_investors": active_investors,
        "performance_fee_pct": float(master.performance_fee_pct),
        "management_fee_pct": float(master.management_fee_pct),
        "min_investment": float(master.min_investment),
        "max_investors": master.max_investors,
        "description": master.description,
        "strategy_info": getattr(master, "strategy_info", None),
        "total_trades": total_trades,
        "total_profit": total_profit,
        "win_rate": round(win_rate, 2),
        "monthly_breakdown": monthly_breakdown,
        "is_copying": is_copying,
        "created_at": master.created_at.isoformat() if master.created_at else None,
    }


async def start_copy(
    master_id: UUID, account_id: UUID, amount: Decimal,
    max_drawdown_pct: Decimal | None, max_lot_override: Decimal | None,
    user_id: UUID, db: AsyncSession,
) -> dict:
    """Follower starts copying a master — auto-approved.

    Creates a dedicated CF trading account for the follower, debits their main
    wallet, and activates the allocation in one step so the copy engine starts
    mirroring the master's trades immediately. Funds stay in the follower's
    own CF account; the master never touches them.
    """
    master_result = await db.execute(
        select(MasterAccount).where(
            MasterAccount.id == master_id, MasterAccount.status == "approved"
        )
    )
    master = master_result.scalar_one_or_none()
    if not master:
        raise HTTPException(status_code=404, detail="Provider not found")

    if master.user_id == user_id:
        raise HTTPException(
            status_code=400,
            detail="You cannot copy your own master account",
        )

    if master.master_type in ("pamm", "mamm"):
        raise HTTPException(
            status_code=400,
            detail="This manager runs a pooled account. Invest from the MAM/PAMM tab instead.",
        )

    if amount < master.min_investment:
        raise HTTPException(status_code=400, detail=f"Minimum investment is {master.min_investment}")

    investor_count = await db.execute(
        select(func.count()).select_from(InvestorAllocation).where(
            InvestorAllocation.master_id == master.id,
            InvestorAllocation.status == "active",
        )
    )
    if investor_count.scalar() >= master.max_investors:
        raise HTTPException(status_code=400, detail="Provider has reached maximum investors")

    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    wallet_bal = user.main_wallet_balance or Decimal("0")
    if wallet_bal < amount:
        raise HTTPException(status_code=400, detail=f"Insufficient wallet balance (available: {wallet_bal})")

    existing = await db.execute(
        select(InvestorAllocation).where(
            InvestorAllocation.master_id == master_id,
            InvestorAllocation.investor_user_id == user_id,
            InvestorAllocation.status.in_(["active", "pending"]),
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Already copying this provider")

    investor_account = TradingAccount(
        user_id=user_id,
        account_number=_gen_investor_account_number("signal"),
        balance=amount,
        equity=amount,
        free_margin=amount,
        margin_used=Decimal("0"),
        leverage=500,
        currency="USD",
        is_demo=False,
        is_active=True,
    )
    db.add(investor_account)
    await db.flush()

    user.main_wallet_balance = wallet_bal - amount
    db.add(Transaction(
        user_id=user_id, account_id=investor_account.id,
        type="withdrawal", amount=-amount,
        description=f"Copy trading investment → account {investor_account.account_number}",
    ))

    allocation = InvestorAllocation(
        master_id=master_id,
        investor_user_id=user_id,
        investor_account_id=investor_account.id,
        copy_type=AllocationCopyType.SIGNAL.value,
        allocation_amount=amount,
        max_drawdown_pct=max_drawdown_pct,
        max_lot_override=max_lot_override,
        status="active",
    )
    db.add(allocation)
    master.followers_count = (master.followers_count or 0) + 1
    await db.commit()
    await db.refresh(allocation)

    return {
        "id": str(allocation.id), "master_id": str(master_id),
        "investor_account": investor_account.account_number,
        "amount": float(amount),
        "copy_type": allocation.copy_type, "status": allocation.status,
        "wallet_balance": float(user.main_wallet_balance),
        "message": f"Now copying — account {investor_account.account_number} funded with ${amount}",
        "created_at": allocation.created_at.isoformat() if allocation.created_at else None,
    }


async def approve_follow_request(
    allocation_id: UUID, action: str, user_id: UUID, db: AsyncSession,
) -> dict:
    """Master approves or rejects a pending follow request.

    On approve: creates investor account, deducts follower wallet, credits master pool.
    On reject: marks allocation as rejected.
    """
    if action not in ("approve", "reject"):
        raise HTTPException(status_code=400, detail="Action must be 'approve' or 'reject'")

    # Verify the caller is the master
    alloc_result = await db.execute(
        select(InvestorAllocation, MasterAccount)
        .join(MasterAccount, InvestorAllocation.master_id == MasterAccount.id)
        .where(InvestorAllocation.id == allocation_id)
    )
    row = alloc_result.one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Allocation not found")
    allocation, master = row

    if master.user_id != user_id:
        raise HTTPException(status_code=403, detail="Only the master can approve or reject followers")

    if allocation.status != "pending":
        raise HTTPException(status_code=400, detail=f"Allocation is already '{allocation.status}'")

    if action == "reject":
        allocation.status = "rejected"
        await db.commit()
        return {"id": str(allocation.id), "status": "rejected", "message": "Follow request rejected"}

    # ── Approve: create account, move funds ──────────────────────────
    investor_user_result = await db.execute(
        select(User).where(User.id == allocation.investor_user_id)
    )
    investor_user = investor_user_result.scalar_one_or_none()
    if not investor_user:
        raise HTTPException(status_code=404, detail="Investor user not found")

    amount = allocation.allocation_amount or Decimal("0")
    wallet_bal = investor_user.main_wallet_balance or Decimal("0")
    if wallet_bal < amount:
        raise HTTPException(
            status_code=400,
            detail=f"Investor has insufficient balance ({wallet_bal}). Request amount: {amount}",
        )

    # Create dedicated investor trading account
    investor_account = TradingAccount(
        user_id=allocation.investor_user_id,
        account_number=_gen_investor_account_number("signal"),
        balance=amount,
        equity=amount,
        free_margin=amount,
        margin_used=Decimal("0"),
        leverage=500,
        currency="USD",
        is_demo=False,
        is_active=True,
    )
    db.add(investor_account)
    await db.flush()

    # Deduct from follower wallet — funds land in follower's own CF account only.
    # Do NOT credit master's pool: signal/copy trade mirrors trades on the follower's
    # account using follower's own equity. Master funds their CT account separately.
    investor_user.main_wallet_balance = wallet_bal - amount
    db.add(Transaction(
        user_id=allocation.investor_user_id, account_id=investor_account.id,
        type="withdrawal", amount=-amount,
        description=f"Copy trading investment → account {investor_account.account_number}",
    ))

    # Activate allocation
    allocation.investor_account_id = investor_account.id
    allocation.status = "active"
    master.followers_count = (master.followers_count or 0) + 1
    await db.commit()

    return {
        "id": str(allocation.id),
        "status": "active",
        "investor_account": investor_account.account_number,
        "amount": float(amount),
        "message": "Follower approved — account created and funded",
    }


async def list_follow_requests(user_id: UUID, db: AsyncSession) -> dict:
    """Master lists all pending follow requests for their signal provider account."""
    master_result = await db.execute(
        select(MasterAccount).where(
            MasterAccount.user_id == user_id,
            MasterAccount.status.in_(["approved", "active"]),
        )
    )
    masters = master_result.scalars().all()
    if not masters:
        return {"items": [], "total": 0}

    master_ids = [m.id for m in masters]

    alloc_result = await db.execute(
        select(InvestorAllocation, User.first_name, User.last_name, User.email)
        .join(User, InvestorAllocation.investor_user_id == User.id)
        .where(
            InvestorAllocation.master_id.in_(master_ids),
            InvestorAllocation.status == "pending",
        )
        .order_by(InvestorAllocation.created_at.desc())
    )
    rows = alloc_result.all()

    items = []
    for alloc, first_name, last_name, email in rows:
        items.append({
            "id": str(alloc.id),
            "master_id": str(alloc.master_id),
            "investor_user_id": str(alloc.investor_user_id),
            "investor_name": f"{first_name or ''} {last_name or ''}".strip() or email,
            "investor_email": email,
            "amount": float(alloc.allocation_amount),
            "copy_type": alloc.copy_type or "signal",
            "created_at": alloc.created_at.isoformat() if alloc.created_at else None,
        })

    return {"items": items, "total": len(items)}


async def my_copies(user_id: UUID, db: AsyncSession) -> dict:
    result = await db.execute(
        select(InvestorAllocation, MasterAccount, User.first_name, User.last_name)
        .join(MasterAccount, InvestorAllocation.master_id == MasterAccount.id)
        .join(User, MasterAccount.user_id == User.id)
        .where(
            InvestorAllocation.investor_user_id == user_id,
            InvestorAllocation.status.in_(["active", "pending"]),
        )
        .order_by(InvestorAllocation.created_at.desc())
    )
    rows = result.all()

    items = []
    for alloc, master, first_name, last_name in rows:
        items.append({
            "id": str(alloc.id), "master_id": str(master.id),
            "provider_name": f"{first_name or ''} {last_name or ''}".strip(),
            "allocation_amount": float(alloc.allocation_amount),
            "total_profit": float(alloc.total_profit),
            "total_return_pct": float(master.total_return_pct),
            "copy_type": alloc.copy_type or "signal",
            "status": alloc.status,
            "created_at": alloc.created_at.isoformat() if alloc.created_at else None,
        })
    return {"items": items, "total": len(items)}


async def stop_copy(allocation_id: UUID, user_id: UUID, db: AsyncSession) -> dict:
    result = await db.execute(
        select(InvestorAllocation).where(
            InvestorAllocation.id == allocation_id,
            InvestorAllocation.investor_user_id == user_id,
        )
    )
    allocation = result.scalar_one_or_none()
    if not allocation:
        raise HTTPException(status_code=404, detail="Copy subscription not found")
    if allocation.status != "active":
        raise HTTPException(status_code=400, detail="Subscription already inactive")

    # Close open copied positions and calculate PnL
    from packages.common.src.redis_client import PriceChannel
    open_copies_q = await db.execute(
        select(CopyTrade).where(
            CopyTrade.investor_allocation_id == allocation.id,
            CopyTrade.status == "open",
        )
    )
    open_copies = open_copies_q.scalars().all()

    total_pnl = Decimal("0")
    master_result = await db.execute(
        select(MasterAccount).where(MasterAccount.id == allocation.master_id)
    )
    master = master_result.scalar_one_or_none()

    for copy in open_copies:
        investor_pos = await db.get(Position, copy.investor_position_id)
        if not investor_pos or investor_pos.status != PositionStatus.OPEN:
            copy.status = "closed"
            continue

        instrument = investor_pos.instrument
        if not instrument:
            copy.status = "closed"
            continue

        tick_data = await redis_client.get(PriceChannel.tick_key(instrument.symbol))
        if not tick_data:
            continue

        tick = json.loads(tick_data)
        side_val = investor_pos.side.value if hasattr(investor_pos.side, "value") else str(investor_pos.side)
        close_price = Decimal(str(tick["bid"])) if side_val == "buy" else Decimal(str(tick["ask"]))
        contract_size = instrument.contract_size or Decimal("100000")

        if side_val == "buy":
            gross = (close_price - investor_pos.open_price) * investor_pos.lots * contract_size
        else:
            gross = (investor_pos.open_price - close_price) * investor_pos.lots * contract_size
        from packages.common.src.trading_service import quote_to_account_pnl
        gross = quote_to_account_pnl(
            gross,
            getattr(instrument, "base_currency", None),
            getattr(instrument, "quote_currency", None),
            close_price,
            symbol=getattr(instrument, "symbol", None),
        )

        perf_fee = Decimal("0")
        if gross > 0 and master:
            perf_fee = gross * (master.performance_fee_pct or Decimal("0")) / Decimal("100")
        net = gross - perf_fee
        total_pnl += net

        investor_pos.status = PositionStatus.CLOSED.value
        investor_pos.close_price = close_price
        investor_pos.profit = net
        from datetime import datetime, timezone
        investor_pos.closed_at = datetime.now(timezone.utc)

        db.add(TradeHistory(
            position_id=investor_pos.id, account_id=investor_pos.account_id,
            instrument_id=investor_pos.instrument_id, side=investor_pos.side,
            lots=investor_pos.lots, open_price=investor_pos.open_price,
            close_price=close_price, swap=investor_pos.swap or Decimal("0"),
            commission=investor_pos.commission or Decimal("0"), profit=net,
            close_reason="copy_stopped", opened_at=investor_pos.created_at,
            closed_at=datetime.now(timezone.utc),
        ))
        copy.status = "closed"

    # No master-pool deduct: signal/copy trade keeps follower funds in the follower's
    # own CF account throughout. Master never held this money.

    # Return capital + PnL to main wallet
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()

    return_amount = (allocation.allocation_amount or Decimal("0")) + total_pnl
    if return_amount < 0:
        return_amount = Decimal("0")

    if user:
        user.main_wallet_balance = (user.main_wallet_balance or Decimal("0")) + return_amount
        db.add(Transaction(
            user_id=user_id, account_id=None, type="deposit",
            amount=return_amount,
            description="Copy trading withdrawal (capital + P&L)",
        ))

    allocation.status = "stopped"
    allocation.total_profit = (allocation.total_profit or Decimal("0")) + total_pnl

    if master and master.followers_count and master.followers_count > 0:
        master.followers_count -= 1

    await db.commit()
    return {
        "message": "Copy trading stopped — funds returned to wallet",
        "allocation_id": str(allocation_id),
        "positions_closed": len(open_copies),
        "returned_to_wallet": float(return_amount),
        "total_pnl": float(total_pnl),
        "wallet_balance": float(user.main_wallet_balance) if user else None,
    }


async def withdraw_managed_account(
    allocation_id: UUID, user_id: UUID, db: AsyncSession,
) -> dict:
    """Withdraw from a PAMM/MAM managed account.

    - Closes all open copied positions for this allocation
    - Returns allocation capital + accumulated profit to investor
    - Deactivates the allocation
    """
    result = await db.execute(
        select(InvestorAllocation).where(
            InvestorAllocation.id == allocation_id,
            InvestorAllocation.investor_user_id == user_id,
        )
    )
    allocation = result.scalar_one_or_none()
    if not allocation:
        raise HTTPException(status_code=404, detail="Investment not found")
    if allocation.status != "active":
        raise HTTPException(status_code=400, detail="Investment is already inactive")

    if allocation.copy_type not in ("pamm", "mam"):
        raise HTTPException(
            status_code=400,
            detail="Use 'Stop Copy' for signal subscriptions",
        )

    master_result = await db.execute(
        select(MasterAccount).where(MasterAccount.id == allocation.master_id)
    )
    master = master_result.scalar_one_or_none()

    # ─── PAMM withdrawal ────────────────────────────────────────────────
    # Pooled-fund model: investor has no sub-account. Their share of the
    # master's pool = (allocation_amount / sum(active allocations)) *
    # master.balance. Deduct that cash from master, credit investor wallet,
    # apply performance fee on any profit component.
    if allocation.copy_type == "pamm":
        user_result = await db.execute(select(User).where(User.id == user_id))
        user = user_result.scalar_one_or_none()

        pool_account = await db.get(TradingAccount, master.account_id) if (master and master.account_id) else None
        if not pool_account:
            raise HTTPException(status_code=500, detail="Master pool account missing")

        total_alloc_q = await db.execute(
            select(func.coalesce(func.sum(InvestorAllocation.allocation_amount), 0)).where(
                InvestorAllocation.master_id == allocation.master_id,
                InvestorAllocation.status == "active",
                InvestorAllocation.copy_type == "pamm",
            )
        )
        total_alloc = Decimal(str(total_alloc_q.scalar() or 0))
        alloc_amt = allocation.allocation_amount or Decimal("0")
        pool_balance = pool_account.balance or Decimal("0")

        if total_alloc <= 0 or alloc_amt <= 0:
            share_value = Decimal("0")
        else:
            share_value = (pool_balance * alloc_amt) / total_alloc

        gross_profit = share_value - alloc_amt  # paper P&L so far
        perf_fee = Decimal("0")
        if gross_profit > 0 and master and master.performance_fee_pct:
            perf_fee = gross_profit * (master.performance_fee_pct or Decimal("0")) / Decimal("100")

        return_amount = share_value - perf_fee
        if return_amount < 0:
            return_amount = Decimal("0")

        # Deduct investor's share from pool, performance fee stays with master.
        pool_account.balance = max(Decimal("0"), pool_balance - return_amount - perf_fee)
        pool_account.equity = pool_account.balance + (pool_account.credit or Decimal("0"))
        pool_account.free_margin = pool_account.equity - (pool_account.margin_used or Decimal("0"))
        # Performance fee returns to master's balance (already there as part of the pool);
        # the net deduction above only removes investor's net share, so fee naturally stays.
        if perf_fee > 0:
            pool_account.balance = pool_account.balance + perf_fee
            pool_account.equity = pool_account.balance + (pool_account.credit or Decimal("0"))
            pool_account.free_margin = pool_account.equity - (pool_account.margin_used or Decimal("0"))

        if user:
            user.main_wallet_balance = (user.main_wallet_balance or Decimal("0")) + return_amount
            db.add(Transaction(
                user_id=user_id, account_id=None, type="deposit",
                amount=return_amount,
                description=f"Withdrawal from PAMM pool (share: ${float(share_value):.2f}, fee: ${float(perf_fee):.2f})",
            ))

        allocation.status = "withdrawn"
        allocation.total_profit = gross_profit - perf_fee
        if master and master.followers_count and master.followers_count > 0:
            master.followers_count -= 1

        await db.commit()
        return {
            "message": "PAMM withdrawal complete — funds returned to wallet",
            "allocation_id": str(allocation_id),
            "positions_closed": 0,
            "share_value": float(share_value),
            "performance_fee": float(perf_fee),
            "returned_to_wallet": float(return_amount),
            "total_pnl": float(gross_profit),
            "total_profit": float(allocation.total_profit),
            "wallet_balance": float(user.main_wallet_balance) if user else None,
        }

    # ─── MAM withdrawal (legacy) ────────────────────────────────────────
    # Close any open copied positions for this allocation
    from packages.common.src.models import CopyTrade, Position, PositionStatus
    import json
    from packages.common.src.redis_client import redis_client, PriceChannel

    open_copies_q = await db.execute(
        select(CopyTrade).where(
            CopyTrade.investor_allocation_id == allocation.id,
            CopyTrade.status == "open",
        )
    )
    open_copies = open_copies_q.scalars().all()

    total_closed_pnl = Decimal("0")
    for copy in open_copies:
        investor_pos = await db.get(Position, copy.investor_position_id)
        if not investor_pos or investor_pos.status != PositionStatus.OPEN:
            copy.status = "closed"
            continue

        instrument = investor_pos.instrument
        if not instrument:
            copy.status = "closed"
            continue

        tick_data = await redis_client.get(PriceChannel.tick_key(instrument.symbol))
        if not tick_data:
            continue  # defer — can't close without price

        tick = json.loads(tick_data)
        side_val = investor_pos.side.value if hasattr(investor_pos.side, "value") else str(investor_pos.side)
        close_price = Decimal(str(tick["bid"])) if side_val == "buy" else Decimal(str(tick["ask"]))
        contract_size = instrument.contract_size or Decimal("100000")

        if side_val == "buy":
            gross = (close_price - investor_pos.open_price) * investor_pos.lots * contract_size
        else:
            gross = (investor_pos.open_price - close_price) * investor_pos.lots * contract_size
        from packages.common.src.trading_service import quote_to_account_pnl
        gross = quote_to_account_pnl(
            gross,
            getattr(instrument, "base_currency", None),
            getattr(instrument, "quote_currency", None),
            close_price,
            symbol=getattr(instrument, "symbol", None),
        )

        perf_fee = Decimal("0")
        if gross > 0 and master:
            perf_fee = gross * (master.performance_fee_pct or Decimal("0")) / Decimal("100")

        net = gross - perf_fee
        total_closed_pnl += net

        investor_pos.status = PositionStatus.CLOSED.value
        investor_pos.close_price = close_price
        investor_pos.profit = net
        from datetime import datetime, timezone
        investor_pos.closed_at = datetime.now(timezone.utc)

        from packages.common.src.models import TradeHistory
        db.add(TradeHistory(
            position_id=investor_pos.id,
            account_id=investor_pos.account_id,
            instrument_id=investor_pos.instrument_id,
            side=investor_pos.side,
            lots=investor_pos.lots,
            open_price=investor_pos.open_price,
            close_price=close_price,
            swap=investor_pos.swap or Decimal("0"),
            commission=investor_pos.commission or Decimal("0"),
            profit=net,
            close_reason="managed_withdrawal",
            opened_at=investor_pos.created_at,
            closed_at=datetime.now(timezone.utc),
        ))

        copy.status = "closed"

    # Return capital + PnL to main wallet
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()

    return_amount = (allocation.allocation_amount or Decimal("0")) + total_closed_pnl
    if return_amount < 0:
        return_amount = Decimal("0")

    # Deduct from master's pool account
    if master and master.account_id:
        pool_account = await db.get(TradingAccount, master.account_id)
        if pool_account:
            pool_account.balance = max(Decimal("0"), (pool_account.balance or Decimal("0")) - (allocation.allocation_amount or Decimal("0")))
            pool_account.equity = pool_account.balance + (pool_account.credit or Decimal("0"))
            pool_account.free_margin = pool_account.equity - (pool_account.margin_used or Decimal("0"))

    if user:
        user.main_wallet_balance = (user.main_wallet_balance or Decimal("0")) + return_amount
        db.add(Transaction(
            user_id=user_id, account_id=None, type="deposit",
            amount=return_amount,
            description=f"Withdrawal from {'PAMM' if allocation.copy_type == 'pamm' else 'MAM'} (capital + P&L)",
        ))

    # Deactivate allocation
    allocation.status = "withdrawn"
    allocation.total_profit = (allocation.total_profit or Decimal("0")) + total_closed_pnl

    if master and master.followers_count and master.followers_count > 0:
        master.followers_count -= 1

    await db.commit()

    return {
        "message": "Withdrawal complete — funds returned to wallet",
        "allocation_id": str(allocation_id),
        "positions_closed": len(open_copies),
        "returned_to_wallet": float(return_amount),
        "total_pnl": float(total_closed_pnl),
        "total_profit": float(allocation.total_profit),
        "wallet_balance": float(user.main_wallet_balance) if user else None,
    }


async def become_provider(
    account_id: UUID | None, master_type: str, description: str | None,
    performance_fee_pct: Decimal, management_fee_pct: Decimal,
    min_investment: Decimal, max_investors: int,
    user_id: UUID, db: AsyncSession,
    strategy_info: dict | None = None,
) -> dict:
    # Retired "mamm" master type — callers that still send it get remapped
    # to signal_provider so no new MAMM rows are created. Users may hold one
    # PAMM and one signal_provider application simultaneously.
    if master_type == "mamm":
        master_type = "signal_provider"
    normalized_type = master_type if master_type in ("signal_provider", "pamm") else "signal_provider"

    existing = await db.execute(
        select(MasterAccount).where(
            MasterAccount.user_id == user_id,
            MasterAccount.master_type == normalized_type,
            MasterAccount.status.in_(["pending", "approved", "active"]),
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="You already have a provider application of this type")

    # Pool trading account is created on admin approval, not here — otherwise
    # a pending row would leave an orphan CT/PM/MM account if the admin
    # rejects, and approve_master_request() would create a second one and
    # overwrite master.account_id, stranding the first. Keep account_id=None
    # until approved.
    master = MasterAccount(
        user_id=user_id, account_id=None, status="pending",
        master_type=normalized_type,
        performance_fee_pct=performance_fee_pct, management_fee_pct=management_fee_pct,
        min_investment=min_investment, max_investors=max_investors, description=description,
        strategy_info=strategy_info,
    )
    db.add(master)
    await db.commit()
    await db.refresh(master)

    return {
        "id": str(master.id),
        "status": master.status,
        "account_number": None,
        "message": "Application submitted — your pool trading account will be created after admin approval.",
    }


async def my_provider_stats(user_id: UUID, db: AsyncSession, master_type: str | None = None) -> dict:
    filters = [MasterAccount.user_id == user_id]
    # Exact-type match — a user can hold one PAMM master AND one MAM master
    # simultaneously, and each page must see only its own application.
    if master_type in ("signal_provider", "pamm", "mamm"):
        filters.append(MasterAccount.master_type == master_type)
    result = await db.execute(
        select(MasterAccount).where(*filters).order_by(MasterAccount.created_at.desc())
    )
    master = result.scalars().first()
    if not master:
        raise HTTPException(status_code=404, detail="You are not a signal provider")

    investor_result = await db.execute(
        select(
            func.count().label("count"),
            func.coalesce(func.sum(InvestorAllocation.allocation_amount), 0).label("total_aum"),
            func.coalesce(func.sum(InvestorAllocation.total_profit), 0).label("total_investor_profit"),
        ).where(
            InvestorAllocation.master_id == master.id,
            InvestorAllocation.status == "active",
        )
    )
    inv_stats = investor_result.one()

    trades_result = await db.execute(
        select(func.count(), func.sum(TradeHistory.profit)).where(
            TradeHistory.account_id == master.account_id,
        )
    )
    trades_row = trades_result.one()

    # Win rate
    wins_q = await db.execute(
        select(func.count()).where(
            TradeHistory.account_id == master.account_id,
            TradeHistory.profit > 0,
        )
    )
    wins = wins_q.scalar() or 0
    total_trades_count = trades_row[0] or 0
    win_rate = (wins / total_trades_count * 100) if total_trades_count > 0 else 0

    # Today's trades
    from datetime import datetime, timezone, timedelta
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_trades_q = await db.execute(
        select(func.count(), func.coalesce(func.sum(TradeHistory.profit), 0)).where(
            TradeHistory.account_id == master.account_id,
            TradeHistory.closed_at >= today_start,
        )
    )
    today_row = today_trades_q.one()

    # Open positions count
    open_pos_q = await db.execute(
        select(func.count()).where(
            Position.account_id == master.account_id,
            Position.status == "open",
        )
    )
    open_positions = open_pos_q.scalar() or 0

    # Commission / performance fee earned by this master
    from packages.common.src.models import Transaction
    fee_q = await db.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            Transaction.user_id == user_id,
            Transaction.type.in_(["performance_fee", "master_commission", "ib_commission"]),
        )
    )
    commission_earned = float(fee_q.scalar() or 0)

    return {
        "id": str(master.id), "status": master.status, "master_type": master.master_type,
        "total_return_pct": float(master.total_return_pct),
        "max_drawdown_pct": float(master.max_drawdown_pct),
        "sharpe_ratio": float(master.sharpe_ratio),
        "followers_count": inv_stats.count,  # actual active allocations, not stale counter
        "active_investors": inv_stats.count,
        "total_aum": float(inv_stats.total_aum),
        "total_investor_profit": float(inv_stats.total_investor_profit),
        "total_trades": total_trades_count,
        "total_profit": float(trades_row[1] or 0),
        "win_rate": round(win_rate, 1),
        "today_trades": today_row[0] or 0,
        "today_profit": float(today_row[1] or 0),
        "open_positions": open_positions,
        "commission_earned": commission_earned,
        "performance_fee_pct": float(master.performance_fee_pct),
        "management_fee_pct": float(master.management_fee_pct),
        "min_investment": float(master.min_investment),
        "max_investors": master.max_investors,
        "description": master.description,
        "strategy_info": getattr(master, "strategy_info", None),
        "created_at": master.created_at.isoformat() if master.created_at else None,
    }


async def list_managed_accounts(page: int, per_page: int, db: AsyncSession) -> dict:
    # /pamm Browse shows PAMM pools only. Legacy "MAMM" master type has
    # been retired — MAM Trading now lives under /social (signal_provider
    # master_type) with its own leaderboard.
    count_result = await db.execute(
        select(func.count()).select_from(MasterAccount).where(
            MasterAccount.status == "approved",
            MasterAccount.master_type == "pamm",
        )
    )
    total = count_result.scalar()

    result = await db.execute(
        select(MasterAccount, User.first_name, User.last_name)
        .join(User, MasterAccount.user_id == User.id)
        .where(
            MasterAccount.status == "approved",
            MasterAccount.master_type == "pamm",
        )
        .order_by(MasterAccount.total_return_pct.desc())
        .offset((page - 1) * per_page).limit(per_page)
    )
    rows = result.all()

    items = []
    for master, first_name, last_name in rows:
        investor_count = await db.execute(
            select(func.count()).select_from(InvestorAllocation).where(
                InvestorAllocation.master_id == master.id,
                InvestorAllocation.status == "active",
            )
        )
        active = investor_count.scalar()
        items.append({
            "id": str(master.id),
            "manager_name": f"{first_name or ''} {last_name or ''}".strip(),
            "master_type": master.master_type,
            "total_return_pct": float(master.total_return_pct),
            "max_drawdown_pct": float(master.max_drawdown_pct),
            "sharpe_ratio": float(master.sharpe_ratio),
            "performance_fee_pct": float(master.performance_fee_pct),
            "management_fee_pct": float(master.management_fee_pct),
            "min_investment": float(master.min_investment),
            "max_investors": master.max_investors,
            "active_investors": active,
            "slots_available": master.max_investors - active,
            "description": master.description,
        })

    return {
        "items": items, "total": total, "page": page, "per_page": per_page,
        "pages": (total + per_page - 1) // per_page if total else 0,
    }


async def invest_managed_account(
    master_id: UUID, account_id: UUID, amount: Decimal,
    max_drawdown_pct: Decimal | None, volume_scaling_pct: Decimal,
    user_id: UUID, db: AsyncSession,
) -> dict:
    master_result = await db.execute(
        select(MasterAccount).where(
            MasterAccount.id == master_id,
            MasterAccount.status == "approved",
            MasterAccount.master_type.in_(["mamm", "pamm"]),
        )
    )
    master = master_result.scalar_one_or_none()
    if not master:
        raise HTTPException(status_code=404, detail="Managed account not found")

    if amount < master.min_investment:
        raise HTTPException(status_code=400, detail=f"Minimum investment is {master.min_investment}")

    investor_count = await db.execute(
        select(func.count()).select_from(InvestorAllocation).where(
            InvestorAllocation.master_id == master.id,
            InvestorAllocation.status == "active",
        )
    )
    if investor_count.scalar() >= master.max_investors:
        raise HTTPException(status_code=400, detail="No slots available")

    # Deduct from main wallet
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    wallet_bal = user.main_wallet_balance or Decimal("0")
    if wallet_bal < amount:
        raise HTTPException(status_code=400, detail=f"Insufficient wallet balance (available: {wallet_bal})")

    existing_result = await db.execute(
        select(InvestorAllocation).where(
            InvestorAllocation.master_id == master_id,
            InvestorAllocation.investor_user_id == user_id,
            InvestorAllocation.status == "active",
        )
    )
    existing_alloc = existing_result.scalar_one_or_none()

    # Deduct from wallet
    user.main_wallet_balance = wallet_bal - amount

    # Add funds to master's pool trading account
    pool_account = await db.get(TradingAccount, master.account_id) if master.account_id else None
    if pool_account:
        pool_account.balance = (pool_account.balance or Decimal("0")) + amount
        pool_account.equity = pool_account.balance + (pool_account.credit or Decimal("0"))
        pool_account.free_margin = pool_account.equity - (pool_account.margin_used or Decimal("0"))

    label = 'PAMM' if master.master_type == 'pamm' else 'MAM'

    # PAMM is a pooled fund — investors do NOT get a sub-account. Funds live
    # on the master's pool account, allocation tracks each investor's share,
    # and P&L is settled to the investor's main wallet when the master closes
    # a trade (see trading_service.close_position → distribute_pamm_profit).
    is_pamm = master.master_type == "pamm"

    if existing_alloc:
        # ── Top-up: add funds to existing allocation ──
        existing_alloc.allocation_amount = (existing_alloc.allocation_amount or Decimal("0")) + amount
        if volume_scaling_pct and master.master_type == "mamm":
            existing_alloc.allocation_pct = volume_scaling_pct
        if max_drawdown_pct is not None:
            existing_alloc.max_drawdown_pct = max_drawdown_pct

        inv_acct = None
        if is_pamm:
            # No sub-account — transaction is logged against main wallet.
            db.add(Transaction(
                user_id=user_id, account_id=None, type="withdrawal",
                amount=-amount,
                description=f"Top-up {label} investment (total: {existing_alloc.allocation_amount})",
            ))
        else:
            inv_acct = await db.get(TradingAccount, existing_alloc.investor_account_id)
            if inv_acct:
                inv_acct.balance = (inv_acct.balance or Decimal("0")) + amount
                inv_acct.equity = inv_acct.balance + (inv_acct.credit or Decimal("0"))
                inv_acct.free_margin = inv_acct.equity - (inv_acct.margin_used or Decimal("0"))

            db.add(Transaction(
                user_id=user_id, account_id=existing_alloc.investor_account_id, type="withdrawal",
                amount=-amount,
                description=f"Top-up {label} investment (total: {existing_alloc.allocation_amount})",
            ))

        await db.commit()
        await db.refresh(existing_alloc)

        out = {
            "id": str(existing_alloc.id), "master_id": str(master_id),
            "master_type": master.master_type, "copy_type": existing_alloc.copy_type,
            "investor_account": inv_acct.account_number if inv_acct else None,
            "amount": float(existing_alloc.allocation_amount),
            "top_up": float(amount),
            "wallet_balance": float(user.main_wallet_balance),
            "status": existing_alloc.status,
            "created_at": existing_alloc.created_at.isoformat() if existing_alloc.created_at else None,
        }
    else:
        investor_account = None
        if not is_pamm:
            # MAM allocation: auto-create dedicated sub-account for position mirroring.
            investor_account = TradingAccount(
                user_id=user_id,
                account_number=_gen_investor_account_number("mam"),
                balance=amount,
                equity=amount,
                free_margin=amount,
                margin_used=Decimal("0"),
                leverage=500,
                currency="USD",
                is_demo=False,
                is_active=True,
            )
            db.add(investor_account)
            await db.flush()

            db.add(Transaction(
                user_id=user_id, account_id=investor_account.id, type="withdrawal",
                amount=-amount,
                description=f"Investment in {label} → account {investor_account.account_number}",
            ))
        else:
            # PAMM allocation: no sub-account, funds sit in master's pool.
            db.add(Transaction(
                user_id=user_id, account_id=None, type="withdrawal",
                amount=-amount,
                description=f"Investment in {label} pool (master: {master.id})",
            ))

        alloc_pct = volume_scaling_pct if master.master_type == "mamm" else None
        copy_type_val = (
            AllocationCopyType.PAMM.value if is_pamm
            else AllocationCopyType.MAM.value
        )

        allocation = InvestorAllocation(
            master_id=master_id, investor_user_id=user_id,
            investor_account_id=(investor_account.id if investor_account else None),
            copy_type=copy_type_val,
            allocation_amount=amount, allocation_pct=alloc_pct,
            max_drawdown_pct=max_drawdown_pct, status="active",
        )
        db.add(allocation)
        master.followers_count = (master.followers_count or 0) + 1
        await db.commit()
        await db.refresh(allocation)

        out = {
            "id": str(allocation.id), "master_id": str(master_id),
            "master_type": master.master_type, "copy_type": allocation.copy_type,
            "investor_account": investor_account.account_number if investor_account else None,
            "amount": float(amount),
            "wallet_balance": float(user.main_wallet_balance),
            "status": allocation.status,
            "created_at": allocation.created_at.isoformat() if allocation.created_at else None,
        }
    if master.master_type == "mamm":
        out["volume_scaling_pct"] = float(volume_scaling_pct)
    return out


async def get_my_followers(user_id: UUID, db: AsyncSession) -> dict:
    master_result = await db.execute(
        select(MasterAccount).where(
            MasterAccount.user_id == user_id,
            MasterAccount.status.in_(["approved", "active"]),
        ).order_by(MasterAccount.created_at.desc())
    )
    master = master_result.scalars().first()
    if not master:
        raise HTTPException(status_code=404, detail="You are not a signal provider")

    allocations_result = await db.execute(
        select(InvestorAllocation, User, TradingAccount)
        .join(User, InvestorAllocation.investor_user_id == User.id)
        .join(TradingAccount, InvestorAllocation.investor_account_id == TradingAccount.id)
        .where(
            InvestorAllocation.master_id == master.id,
            InvestorAllocation.status == "active",
        )
        .order_by(InvestorAllocation.created_at.desc())
    )
    allocations = allocations_result.all()

    followers = []
    for allocation, user, account in allocations:
        copy_trades_result = await db.execute(
            select(func.count()).where(CopyTrade.investor_allocation_id == allocation.id)
        )
        total_copied_trades = copy_trades_result.scalar() or 0

        profit_pct = 0
        if allocation.allocation_amount and allocation.allocation_amount > 0:
            profit_pct = (float(allocation.total_profit or 0) / float(allocation.allocation_amount)) * 100

        followers.append({
            "id": str(allocation.id),
            "user_id": str(user.id),
            "user_name": f"{user.first_name or ''} {user.last_name or ''}".strip() or user.email,
            "user_email": user.email,
            "account_number": account.account_number,
            "allocation_amount": float(allocation.allocation_amount or 0),
            "total_profit": float(allocation.total_profit or 0),
            "profit_pct": round(profit_pct, 2),
            "total_copied_trades": total_copied_trades,
            "status": allocation.status,
            "joined_at": allocation.created_at.isoformat() if allocation.created_at else None,
        })

    return {
        "master_id": str(master.id),
        "total_followers": len(followers),
        "total_aum": sum(f["allocation_amount"] for f in followers),
        "followers": followers,
    }


async def get_provider_followers(provider_id: UUID, db: AsyncSession) -> dict:
    """Public view of a provider's followers (limited info for privacy)."""
    master_result = await db.execute(
        select(MasterAccount).where(
            MasterAccount.id == provider_id,
            MasterAccount.status.in_(["approved", "active"]),
        )
    )
    master = master_result.scalar_one_or_none()
    if not master:
        raise HTTPException(status_code=404, detail="Provider not found")

    allocations_result = await db.execute(
        select(InvestorAllocation, User)
        .join(User, InvestorAllocation.investor_user_id == User.id)
        .where(
            InvestorAllocation.master_id == master.id,
            InvestorAllocation.status == "active",
        )
    )
    allocations = allocations_result.all()

    followers = []
    for allocation, user in allocations:
        copy_trades_result = await db.execute(
            select(func.count()).where(CopyTrade.investor_allocation_id == allocation.id)
        )
        total_copied_trades = copy_trades_result.scalar() or 0

        profit_pct = 0.0
        if allocation.allocation_amount and allocation.allocation_amount > 0:
            profit_pct = (float(allocation.total_profit or 0) / float(allocation.allocation_amount)) * 100

        # Public view: hide sensitive info like account numbers
        followers.append({
            "id": str(allocation.id),
            "user_name": f"{user.first_name or ''} {user.last_name or ''}".strip() or "Anonymous",
            "allocation_amount": float(allocation.allocation_amount or 0),
            "total_profit": float(allocation.total_profit or 0),
            "profit_pct": round(profit_pct, 2),
            "total_copied_trades": total_copied_trades,
            "joined_at": allocation.created_at.isoformat() if allocation.created_at else None,
        })

    return {
        "provider_id": str(master.id),
        "total_followers": len(followers),
        "total_aum": sum(f["allocation_amount"] for f in followers),
        "followers": followers,
    }


async def my_allocations(user_id: UUID, db: AsyncSession) -> dict:
    result = await db.execute(
        select(InvestorAllocation, MasterAccount, User)
        .join(MasterAccount, InvestorAllocation.master_id == MasterAccount.id)
        .join(User, MasterAccount.user_id == User.id)
        .where(
            InvestorAllocation.investor_user_id == user_id,
            InvestorAllocation.status == "active",
            MasterAccount.master_type.in_(["pamm", "mamm"]),
        )
        .order_by(InvestorAllocation.created_at.desc())
    )
    rows = result.all()

    items = []
    for alloc, master, manager in rows:
        invested = float(alloc.allocation_amount or 0)

        if alloc.copy_type == "pamm":
            # PAMM: no sub-account, live value = proportional share of master pool.
            pool_account = await db.get(TradingAccount, master.account_id) if master.account_id else None
            pool_balance = float(pool_account.balance or 0) if pool_account else 0.0
            total_alloc_q = await db.execute(
                select(func.coalesce(func.sum(InvestorAllocation.allocation_amount), 0)).where(
                    InvestorAllocation.master_id == master.id,
                    InvestorAllocation.status == "active",
                    InvestorAllocation.copy_type == "pamm",
                )
            )
            total_alloc = float(total_alloc_q.scalar() or 0)
            current_value = (pool_balance * invested / total_alloc) if total_alloc > 0 else invested
            total_pnl = current_value - invested
            realized_pnl = total_pnl  # PAMM has no separate realized/unrealized split
            unrealized_pnl = 0.0
        else:
            open_copies = await db.execute(
                select(CopyTrade, Position)
                .join(Position, CopyTrade.investor_position_id == Position.id)
                .where(
                    CopyTrade.investor_allocation_id == alloc.id,
                    CopyTrade.status == "open",
                )
            )
            unrealized_pnl = sum(float(pos.profit or 0) for _, pos in open_copies.all())
            realized_pnl = float(alloc.total_profit or 0)
            total_pnl = realized_pnl + unrealized_pnl
            current_value = invested + total_pnl

        pnl_pct = (total_pnl / invested * 100) if invested > 0 else 0.0

        items.append({
            "id": str(alloc.id),
            "master_id": str(master.id),
            "manager_name": f"{manager.first_name or ''} {manager.last_name or ''}".strip() or manager.email,
            "master_type": master.master_type,
            "copy_type": alloc.copy_type,
            "allocation_amount": round(invested, 2),
            "current_value": round(current_value, 2),
            "realized_pnl": round(realized_pnl, 2),
            "unrealized_pnl": round(unrealized_pnl, 2),
            "total_pnl": round(total_pnl, 2),
            "pnl_pct": round(pnl_pct, 2),
            "performance_fee_pct": float(master.performance_fee_pct),
            "joined_at": alloc.created_at.isoformat() if alloc.created_at else None,
            "status": alloc.status,
        })

    total_invested = sum(i["allocation_amount"] for i in items)
    total_current = sum(i["current_value"] for i in items)
    total_pnl_all = sum(i["total_pnl"] for i in items)
    overall_pct = (total_pnl_all / total_invested * 100) if total_invested > 0 else 0.0

    return {
        "items": items,
        "summary": {
            "total_invested": round(total_invested, 2),
            "total_current_value": round(total_current, 2),
            "total_pnl": round(total_pnl_all, 2),
            "overall_pnl_pct": round(overall_pct, 2),
        },
    }


async def _resolve_allocation_for_account(
    investor_account_id: UUID, user_id: UUID, db: AsyncSession,
) -> InvestorAllocation:
    """Find the active investor allocation tied to a CF/IF sub-account, owned
    by the calling user. Used by the risk-protection endpoints which are
    addressed by trading account id (matches the accounts page card)."""
    q = await db.execute(
        select(InvestorAllocation).where(
            InvestorAllocation.investor_account_id == investor_account_id,
            InvestorAllocation.investor_user_id == user_id,
            InvestorAllocation.status == "active",
        )
    )
    alloc = q.scalar_one_or_none()
    if not alloc:
        raise HTTPException(
            status_code=404,
            detail="No active follower allocation found for this account",
        )
    return alloc


def _serialize_risk(alloc: InvestorAllocation, current_dd_pct: float) -> dict:
    return {
        "allocation_id": str(alloc.id),
        "max_drawdown_pct": float(alloc.max_drawdown_pct) if alloc.max_drawdown_pct is not None else None,
        "enabled": alloc.max_drawdown_pct is not None and float(alloc.max_drawdown_pct) > 0,
        "tripped": bool(alloc.drawdown_tripped),
        "tripped_at": alloc.drawdown_tripped_at.isoformat() if alloc.drawdown_tripped_at else None,
        "current_drawdown_pct": round(current_dd_pct, 2),
    }


async def _compute_current_drawdown(
    alloc: InvestorAllocation, db: AsyncSession,
) -> float:
    """Live drawdown % vs the allocation's deposited amount. 0 (or negative
    drift) when in profit. Mirrors the copy-engine's protection check."""
    baseline = float(alloc.allocation_amount or 0)
    if baseline <= 0 or not alloc.investor_account_id:
        return 0.0
    acct = await db.get(TradingAccount, alloc.investor_account_id)
    if not acct:
        return 0.0
    current = float(acct.equity or acct.balance or 0)
    loss = baseline - current
    if loss <= 0:
        return 0.0
    return (loss / baseline) * 100.0


async def get_account_risk(
    investor_account_id: UUID, user_id: UUID, db: AsyncSession,
) -> dict:
    alloc = await _resolve_allocation_for_account(investor_account_id, user_id, db)
    dd = await _compute_current_drawdown(alloc, db)
    return _serialize_risk(alloc, dd)


async def update_account_risk(
    investor_account_id: UUID,
    max_drawdown_pct: Decimal | None,
    user_id: UUID,
    db: AsyncSession,
) -> dict:
    """Set or clear the investor's drawdown protection limit.

    Pass max_drawdown_pct=None to disable. Saving a new limit also clears the
    tripped flag so the user can re-enable copy trading after editing the value
    without going through the explicit reset step.
    """
    alloc = await _resolve_allocation_for_account(investor_account_id, user_id, db)

    if max_drawdown_pct is None:
        alloc.max_drawdown_pct = None
    else:
        if max_drawdown_pct <= 0 or max_drawdown_pct >= 100:
            raise HTTPException(
                status_code=400,
                detail="max_drawdown_pct must be between 0 and 100 (exclusive)",
            )
        alloc.max_drawdown_pct = max_drawdown_pct

    alloc.drawdown_tripped = False
    alloc.drawdown_tripped_at = None

    await db.commit()
    await db.refresh(alloc)
    dd = await _compute_current_drawdown(alloc, db)
    return _serialize_risk(alloc, dd)


async def reset_account_risk(
    investor_account_id: UUID, user_id: UUID, db: AsyncSession,
) -> dict:
    """Clear the tripped flag so copy trading resumes — limit value is preserved.
    Investor is expected to call this after deciding to keep trading despite the
    earlier drawdown breach (e.g. after topping up the account)."""
    alloc = await _resolve_allocation_for_account(investor_account_id, user_id, db)
    alloc.drawdown_tripped = False
    alloc.drawdown_tripped_at = None
    await db.commit()
    await db.refresh(alloc)
    dd = await _compute_current_drawdown(alloc, db)
    return _serialize_risk(alloc, dd)


async def pamm_master_trades(
    allocation_id: UUID, user_id: UUID, db: AsyncSession,
) -> dict:
    """Return the PAMM master's open + closed trades, visible to the investor
    who owns this allocation. Each trade shows gross P&L (master's view) and
    the investor's proportional share based on their allocation ratio."""
    from packages.common.src.models import Position, TradeHistory, Instrument

    alloc_q = await db.execute(
        select(InvestorAllocation).where(
            InvestorAllocation.id == allocation_id,
            InvestorAllocation.investor_user_id == user_id,
        )
    )
    allocation = alloc_q.scalar_one_or_none()
    if not allocation or allocation.copy_type != "pamm":
        raise HTTPException(status_code=404, detail="PAMM allocation not found")

    master = await db.get(MasterAccount, allocation.master_id)
    if not master or not master.account_id:
        raise HTTPException(status_code=404, detail="Master account not found")

    total_alloc_q = await db.execute(
        select(func.coalesce(func.sum(InvestorAllocation.allocation_amount), 0)).where(
            InvestorAllocation.master_id == master.id,
            InvestorAllocation.status == "active",
            InvestorAllocation.copy_type == "pamm",
        )
    )
    total_alloc = Decimal(str(total_alloc_q.scalar() or 0))
    alloc_amt = allocation.allocation_amount or Decimal("0")
    ratio = float(alloc_amt / total_alloc) if total_alloc > 0 else 0.0

    # Open positions on master's pool
    open_q = await db.execute(
        select(Position, Instrument)
        .join(Instrument, Position.instrument_id == Instrument.id)
        .where(
            Position.account_id == master.account_id,
            Position.status == "open",
        )
        .order_by(Position.created_at.desc())
    )
    open_trades = []
    for pos, inst in open_q.all():
        profit = float(pos.profit or 0)
        open_trades.append({
            "id": str(pos.id),
            "symbol": inst.symbol,
            "side": pos.side.value if hasattr(pos.side, "value") else str(pos.side),
            "lots": float(pos.lots),
            "open_price": float(pos.open_price),
            "opened_at": pos.created_at.isoformat() if pos.created_at else None,
            "master_pnl": profit,
            "your_share": round(profit * ratio, 2),
            "status": "open",
        })

    # Closed trades from master's history
    closed_q = await db.execute(
        select(TradeHistory, Instrument)
        .join(Instrument, TradeHistory.instrument_id == Instrument.id)
        .where(TradeHistory.account_id == master.account_id)
        .order_by(TradeHistory.closed_at.desc())
        .limit(200)
    )
    closed_trades = []
    for th, inst in closed_q.all():
        profit = float(th.profit or 0)
        closed_trades.append({
            "id": str(th.id),
            "symbol": inst.symbol,
            "side": th.side.value if hasattr(th.side, "value") else str(th.side),
            "lots": float(th.lots),
            "open_price": float(th.open_price),
            "close_price": float(th.close_price),
            "opened_at": th.opened_at.isoformat() if th.opened_at else None,
            "closed_at": th.closed_at.isoformat() if th.closed_at else None,
            "master_pnl": profit,
            "your_share": round(profit * ratio, 2),
            "close_reason": th.close_reason,
            "status": "closed",
        })

    return {
        "allocation_id": str(allocation_id),
        "your_ratio_pct": round(ratio * 100, 4),
        "open_trades": open_trades,
        "closed_trades": closed_trades,
    }


async def master_investors(user_id: UUID, db: AsyncSession) -> dict:
    master_result = await db.execute(
        select(MasterAccount).where(
            MasterAccount.user_id == user_id,
            MasterAccount.status.in_(["approved", "active"]),
            MasterAccount.master_type.in_(["pamm", "mamm"]),
        )
    )
    master = master_result.scalar_one_or_none()
    if not master:
        raise HTTPException(status_code=404, detail="You are not an approved PAMM/MAM manager")

    allocations_result = await db.execute(
        select(InvestorAllocation, User, TradingAccount)
        .join(User, InvestorAllocation.investor_user_id == User.id)
        .join(TradingAccount, InvestorAllocation.investor_account_id == TradingAccount.id)
        .where(
            InvestorAllocation.master_id == master.id,
            InvestorAllocation.status == "active",
        )
        .order_by(InvestorAllocation.created_at.desc())
    )
    allocations = allocations_result.all()

    total_aum = sum(float(alloc.allocation_amount or 0) for alloc, _, _ in allocations)

    investors = []
    for allocation, user, account in allocations:
        invested = float(allocation.allocation_amount or 0)
        pnl = float(allocation.total_profit or 0)
        pnl_pct = (pnl / invested * 100) if invested > 0 else 0.0
        share_pct = (invested / total_aum * 100) if total_aum > 0 else 0.0

        investors.append({
            "id": str(allocation.id),
            "user_id": str(user.id),
            "user_name": f"{user.first_name or ''} {user.last_name or ''}".strip() or user.email,
            "user_email": user.email,
            "account_number": account.account_number,
            "allocated": round(invested, 2),
            "pnl": round(pnl, 2),
            "pnl_pct": round(pnl_pct, 2),
            "share_pct": round(share_pct, 2),
            "copy_type": allocation.copy_type,
            "joined_at": allocation.created_at.isoformat() if allocation.created_at else None,
        })

    return {
        "master_id": str(master.id),
        "master_type": master.master_type,
        "total_aum": round(total_aum, 2),
        "total_investors": len(investors),
        "investors": investors,
    }


async def master_performance(user_id: UUID, db: AsyncSession) -> dict:
    master_result = await db.execute(
        select(MasterAccount).where(
            MasterAccount.user_id == user_id,
            MasterAccount.master_type.in_(["pamm", "mamm"]),
        )
    )
    master = master_result.scalar_one_or_none()
    if not master:
        raise HTTPException(status_code=404, detail="You are not a PAMM/MAM manager")

    investor_stats = await db.execute(
        select(
            func.count().label("count"),
            func.coalesce(func.sum(InvestorAllocation.allocation_amount), 0).label("total_aum"),
        ).where(
            InvestorAllocation.master_id == master.id,
            InvestorAllocation.status == "active",
        )
    )
    inv_row = investor_stats.one()

    fee_result = await db.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            Transaction.account_id == master.account_id,
            Transaction.type == "performance_fee",
        )
    )
    fee_earnings = float(fee_result.scalar() or 0)

    monthly_result = await db.execute(
        select(
            extract("year", TradeHistory.closed_at).label("year"),
            extract("month", TradeHistory.closed_at).label("month"),
            func.sum(TradeHistory.profit).label("profit"),
        )
        .where(TradeHistory.account_id == master.account_id)
        .group_by("year", "month")
        .order_by("year", "month")
    )

    cumulative = 0.0
    monthly_breakdown = []
    for row in monthly_result.all():
        profit = float(row.profit or 0)
        cumulative += profit
        monthly_breakdown.append({
            "month": f"{int(row.year)}-{int(row.month):02d}",
            "profit": round(profit, 2),
            "cumulative": round(cumulative, 2),
        })

    return {
        "id": str(master.id),
        "status": master.status,
        "master_type": master.master_type,
        "total_aum": float(inv_row.total_aum),
        "total_investors": inv_row.count,
        "fee_earnings": round(fee_earnings, 2),
        "total_return_pct": float(master.total_return_pct),
        "max_drawdown_pct": float(master.max_drawdown_pct),
        "sharpe_ratio": float(master.sharpe_ratio),
        "performance_fee_pct": float(master.performance_fee_pct),
        "management_fee_pct": float(master.management_fee_pct),
        "admin_commission_pct": float(master.admin_commission_pct),
        "min_investment": float(master.min_investment),
        "max_investors": master.max_investors,
        "description": master.description,
        "monthly_breakdown": monthly_breakdown,
    }
