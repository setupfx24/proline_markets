"""Admin Analytics Service — dashboard stats, exposure, profitable users."""
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, func, case
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.models import (
    User, Position, Transaction, Deposit, Withdrawal,
    Instrument, PositionStatus, OrderSide, TradingAccount,
    TradeHistory, MasterAccount, IBProfile, IBCommission,
    InvestorAllocation, CopyTrade, UserBonus,
)


def _start_of_today():
    now = datetime.now(timezone.utc)
    return now.replace(hour=0, minute=0, second=0, microsecond=0)


def _start_of_week():
    today = _start_of_today()
    return today - timedelta(days=today.weekday())


def _start_of_month():
    today = _start_of_today()
    return today.replace(day=1)


async def _revenue_stats(db: AsyncSession, since=None):
    commission_filter = [Position.commission != 0]
    swap_filter = [Position.swap != 0]
    pnl_filter = []

    if since:
        commission_filter.append(Position.created_at >= since)
        swap_filter.append(Position.created_at >= since)
        pnl_filter.append(TradeHistory.closed_at >= since)

    comm_q = await db.execute(
        select(func.coalesce(func.sum(Position.commission), 0)).where(*commission_filter)
    )
    total_commission = abs(float(comm_q.scalar() or 0))

    swap_q = await db.execute(
        select(func.coalesce(func.sum(Position.swap), 0)).where(*swap_filter)
    )
    total_swap = abs(float(swap_q.scalar() or 0))

    pnl_q_filters = []
    if since:
        pnl_q_filters.append(TradeHistory.closed_at >= since)
    pnl_q = await db.execute(
        select(func.coalesce(func.sum(TradeHistory.profit), 0)).where(*pnl_q_filters) if pnl_q_filters
        else select(func.coalesce(func.sum(TradeHistory.profit), 0))
    )
    user_pnl = float(pnl_q.scalar() or 0)

    return {
        "total_revenue": total_commission + total_swap,
        "commission_revenue": total_commission,
        "swap_revenue": total_swap,
        "spread_revenue": 0,
        "net_pnl": -user_pnl,
    }


async def analytics_dashboard(db: AsyncSession) -> dict:
    today = await _revenue_stats(db, _start_of_today())
    week = await _revenue_stats(db, _start_of_week())
    month = await _revenue_stats(db, _start_of_month())
    all_time = await _revenue_stats(db)

    dep_q = await db.execute(
        select(func.coalesce(func.sum(Deposit.amount), 0)).where(
            Deposit.status.in_(["approved", "auto_approved"])
        )
    )
    total_deposits = float(dep_q.scalar() or 0)

    wd_q = await db.execute(
        select(func.coalesce(func.sum(Withdrawal.amount), 0)).where(
            Withdrawal.status.in_(["approved", "completed"])
        )
    )
    total_withdrawals = float(wd_q.scalar() or 0)

    open_pos_q = await db.execute(
        select(func.count(Position.id)).where(Position.status == PositionStatus.OPEN.value)
    )

    closed_trades_q = await db.execute(select(func.count(TradeHistory.id)))

    # Admin commission earned from all sources (PAMM performance fee, copy-trade, etc.)
    admin_comm_all_q = await db.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            Transaction.type == "admin_commission",
        )
    )
    total_admin_commission = float(admin_comm_all_q.scalar() or 0)

    # PAMM/MAM specific admin commission (performance + management fees)
    pamm_admin_q = await db.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            Transaction.type == "admin_commission",
            Transaction.description.ilike("%pamm%") | Transaction.description.ilike("%performance%") | Transaction.description.ilike("%management%"),
        )
    )
    pamm_admin_commission = float(pamm_admin_q.scalar() or 0)

    # Copy trade admin commission
    copy_rev_q = await db.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            Transaction.type == "admin_commission",
            Transaction.description.ilike("%copy%"),
        )
    )
    copy_trade_admin_revenue = float(copy_rev_q.scalar() or 0)

    master_count_q = await db.execute(
        select(func.count(MasterAccount.id)).where(MasterAccount.status.in_(["approved", "active"]))
    )

    ib_count_q = await db.execute(
        select(func.count(IBProfile.id)).where(IBProfile.is_active == True)
    )
    total_ibs = ib_count_q.scalar() or 0

    sub_broker_q = await db.execute(
        select(func.count(User.id)).where(User.role == "sub_broker", User.status == "active")
    )
    total_sub_brokers = sub_broker_q.scalar() or 0

    ib_commission_q = await db.execute(
        select(func.coalesce(func.sum(IBCommission.amount), 0))
    )
    total_ib_commission = float(ib_commission_q.scalar() or 0)

    ib_pending_q = await db.execute(
        select(func.coalesce(func.sum(IBCommission.amount), 0)).where(IBCommission.status == "pending")
    )
    ib_pending_commission = float(ib_pending_q.scalar() or 0)

    total_copy_trades_q = await db.execute(select(func.count(CopyTrade.id)))
    total_copy_trades = total_copy_trades_q.scalar() or 0

    active_copies_q = await db.execute(
        select(func.count(CopyTrade.id)).where(CopyTrade.status == "open")
    )
    active_copies = active_copies_q.scalar() or 0

    # Master earnings — performance fees credited to masters (not admin's share)
    copy_perf_fee_q = await db.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            Transaction.type.in_(["ib_commission", "performance_fee", "master_commission"]),
        )
    )
    master_earnings_total = float(copy_perf_fee_q.scalar() or 0)

    total_aum_q = await db.execute(
        select(func.coalesce(func.sum(InvestorAllocation.allocation_amount), 0)).where(
            InvestorAllocation.status == "active"
        )
    )
    total_aum = float(total_aum_q.scalar() or 0)

    total_followers_q = await db.execute(
        select(func.count(InvestorAllocation.id)).where(InvestorAllocation.status == "active")
    )
    total_followers = total_followers_q.scalar() or 0

    bonus_given_q = await db.execute(
        select(func.coalesce(func.sum(UserBonus.amount), 0))
    )
    total_bonus_given = float(bonus_given_q.scalar() or 0)

    active_bonus_q = await db.execute(
        select(func.count(UserBonus.id)).where(UserBonus.status == "active")
    )
    active_bonuses = active_bonus_q.scalar() or 0

    return {
        "today": today,
        "this_week": week,
        "this_month": month,
        "all_time": all_time,
        "total_deposits": total_deposits,
        "total_withdrawals": total_withdrawals,
        "net_deposits": total_deposits - total_withdrawals,
        "open_positions": open_pos_q.scalar() or 0,
        "closed_trades": closed_trades_q.scalar() or 0,
        "total_admin_commission": total_admin_commission,
        "pamm_admin_commission": pamm_admin_commission,
        "copy_trade_revenue": copy_trade_admin_revenue,
        "active_masters": master_count_q.scalar() or 0,
        "total_ibs": total_ibs,
        "total_sub_brokers": total_sub_brokers,
        "total_ib_commission": total_ib_commission,
        "ib_pending_commission": ib_pending_commission,
        "total_copy_trades": total_copy_trades,
        "active_copies": active_copies,
        "master_earnings_total": master_earnings_total,
        "total_aum": total_aum,
        "total_followers": total_followers,
        "total_bonus_given": total_bonus_given,
        "active_bonuses": active_bonuses,
    }


async def get_exposure(db: AsyncSession) -> dict:
    result = await db.execute(
        select(
            Position.instrument_id,
            func.sum(
                case((Position.side == OrderSide.BUY.value, Position.lots), else_=0)
            ).label("buy_lots"),
            func.sum(
                case((Position.side == OrderSide.SELL.value, Position.lots), else_=0)
            ).label("sell_lots"),
            func.sum(
                case((Position.side == OrderSide.BUY.value, 1), else_=0)
            ).label("buy_count"),
            func.sum(
                case((Position.side == OrderSide.SELL.value, 1), else_=0)
            ).label("sell_count"),
        )
        .where(Position.status == PositionStatus.OPEN.value)
        .group_by(Position.instrument_id)
    )
    rows = result.all()

    exposure_items = []
    for row in rows:
        inst_q = await db.execute(select(Instrument).where(Instrument.id == row.instrument_id))
        inst = inst_q.scalar_one_or_none()
        buy = float(row.buy_lots or 0)
        sell = float(row.sell_lots or 0)
        net = buy - sell
        risk = 'low' if abs(net) < 1 else 'medium' if abs(net) < 5 else 'high'
        exposure_items.append({
            "symbol": inst.symbol if inst else "Unknown",
            "total_long": buy,
            "total_short": sell,
            "net_exposure": net,
            "risk_level": risk,
        })

    top_users_q = await db.execute(
        select(
            TradeHistory.account_id,
            func.sum(TradeHistory.profit).label("total_pnl"),
            func.count(TradeHistory.id).label("trades_count"),
            func.sum(case((TradeHistory.profit > 0, 1), else_=0)).label("wins"),
        )
        .group_by(TradeHistory.account_id)
        .order_by(func.sum(TradeHistory.profit).desc())
        .limit(10)
    )
    user_rows = top_users_q.all()

    profitable_users = []
    for ur in user_rows:
        pnl = float(ur.total_pnl or 0)
        if pnl <= 0:
            continue
        acc_q = await db.execute(select(TradingAccount).where(TradingAccount.id == ur.account_id))
        acc = acc_q.scalar_one_or_none()
        user_name = "Unknown"
        user_id = str(ur.account_id)
        if acc:
            u_q = await db.execute(select(User).where(User.id == acc.user_id))
            u = u_q.scalar_one_or_none()
            if u:
                user_name = f"{u.first_name or ''} {u.last_name or ''}".strip() or u.email
                user_id = str(u.id)
        tc = int(ur.trades_count or 0)
        wins = int(ur.wins or 0)
        profitable_users.append({
            "user_id": user_id,
            "user_name": user_name,
            "pnl": pnl,
            "trades_count": tc,
            "win_rate": (wins / tc * 100) if tc > 0 else 0,
        })

    return {
        "exposure": exposure_items,
        "profitable_users": profitable_users,
    }
