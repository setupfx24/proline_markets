"""Portfolio Service — Summary, performance analytics, trade history, CSV export."""
import csv
import io
import json
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID

from fastapi import HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from packages.common.src.models import (
    TradingAccount, Position, PositionStatus, OrderSide,
    TradeHistory, Instrument, CopyTrade,
)
from packages.common.src.redis_client import redis_client, PriceChannel


async def _get_user_accounts(user_id: UUID, db: AsyncSession) -> list[TradingAccount]:
    result = await db.execute(
        select(TradingAccount).where(TradingAccount.user_id == user_id)
    )
    return result.scalars().all()


async def _get_current_price(symbol: str) -> tuple[Decimal, Decimal] | None:
    tick_data = await redis_client.get(PriceChannel.tick_key(symbol))
    if not tick_data:
        return None
    tick = json.loads(tick_data)
    return Decimal(str(tick["bid"])), Decimal(str(tick["ask"]))


def _compute_pnl(pos: Position, current_price: Decimal) -> Decimal:
    if pos.side == OrderSide.BUY or pos.side.value == "buy":
        raw = (current_price - pos.open_price) * pos.lots * pos.instrument.contract_size
    else:
        raw = (pos.open_price - current_price) * pos.lots * pos.instrument.contract_size
    from .trading_service import quote_to_account_pnl
    return quote_to_account_pnl(
        raw,
        getattr(pos.instrument, "base_currency", None),
        getattr(pos.instrument, "quote_currency", None),
        current_price,
        symbol=getattr(pos.instrument, "symbol", None),
    )


async def portfolio_summary(user_id: UUID, account_id: UUID | None, db: AsyncSession) -> dict:
    accounts = await _get_user_accounts(user_id, db)
    if not accounts:
        return {
            "total_balance": 0.0, "total_credit": 0.0, "total_equity": 0.0,
            "total_unrealized_pnl": 0.0,
            "pnl_breakdown": {"today": 0.0, "this_week": 0.0, "this_month": 0.0, "all_time": 0.0},
            "holdings": [], "open_positions": [], "open_positions_count": 0,
        }

    account_ids = [a.id for a in accounts]
    if account_id:
        if account_id not in account_ids:
            raise HTTPException(status_code=404, detail="Account not found")
        account_ids = [account_id]

    total_balance = sum(float(a.balance) for a in accounts if a.id in account_ids)
    total_credit = sum(float(a.credit) for a in accounts if a.id in account_ids)

    pos_result = await db.execute(
        select(Position)
        .where(Position.account_id.in_(account_ids), Position.status == PositionStatus.OPEN)
        .options(selectinload(Position.instrument))
    )
    open_positions = pos_result.scalars().all()

    total_unrealized = Decimal("0")
    holdings = {}
    open_positions_detail: list[dict] = []

    for pos in open_positions:
        symbol = pos.instrument.symbol if pos.instrument else "?"
        prices = await _get_current_price(symbol)
        if prices:
            bid, ask = prices
            cp = bid if (pos.side == OrderSide.BUY or pos.side.value == "buy") else ask
            pnl = _compute_pnl(pos, cp)
        else:
            pnl = pos.profit or Decimal("0")
            cp = pos.open_price

        total_unrealized += pnl
        side_val = pos.side.value if hasattr(pos.side, "value") else str(pos.side)
        open_positions_detail.append({
            "id": str(pos.id), "symbol": symbol, "side": side_val,
            "lots": float(pos.lots), "entry_price": float(pos.open_price),
            "current_price": float(cp), "pnl": float(pnl),
        })

        if symbol not in holdings:
            holdings[symbol] = {
                "symbol": symbol, "side": None, "lots": Decimal("0"),
                "entry_price": Decimal("0"), "current_price": float(cp),
                "pnl": Decimal("0"), "pnl_pct": 0.0, "positions_count": 0,
                "_signed_lots": Decimal("0"), "_price_sum": Decimal("0"),
            }
        h = holdings[symbol]
        h["lots"] += pos.lots
        h["_signed_lots"] += pos.lots if side_val.lower() == "buy" else -pos.lots
        h["_price_sum"] += pos.open_price * pos.lots
        h["pnl"] += pnl
        h["current_price"] = float(cp)
        h["positions_count"] += 1

    for h in holdings.values():
        if h["lots"] > 0:
            avg_entry = h["_price_sum"] / h["lots"]
            h["entry_price"] = float(avg_entry)
            notional = float(avg_entry) * float(h["lots"])
            h["pnl_pct"] = (float(h["pnl"]) / notional * 100.0) if notional > 0 else 0.0
        h["side"] = "buy" if h["_signed_lots"] > 0 else ("sell" if h["_signed_lots"] < 0 else "flat")
        h["lots"] = float(h["lots"])
        h["pnl"] = float(h["pnl"])
        del h["_signed_lots"]
        del h["_price_sum"]

    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = now - timedelta(days=now.weekday())
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    async def _closed_pnl(since: datetime | None) -> float:
        query = select(func.coalesce(func.sum(TradeHistory.profit), 0)).where(
            TradeHistory.account_id.in_(account_ids),
        )
        if since:
            query = query.where(TradeHistory.closed_at >= since)
        res = await db.execute(query)
        return float(res.scalar())

    pnl_today = await _closed_pnl(today_start)
    pnl_week = await _closed_pnl(week_start)
    pnl_month = await _closed_pnl(month_start)
    pnl_all_time = await _closed_pnl(None)

    return {
        "total_balance": total_balance, "total_credit": total_credit,
        "total_equity": total_balance + total_credit + float(total_unrealized),
        "total_unrealized_pnl": float(total_unrealized),
        "pnl_breakdown": {
            "today": pnl_today, "this_week": pnl_week,
            "this_month": pnl_month, "all_time": pnl_all_time,
        },
        "holdings": list(holdings.values()),
        "open_positions": open_positions_detail,
        "open_positions_count": len(open_positions),
    }


async def portfolio_performance(
    user_id: UUID, account_id: UUID | None, period: str, db: AsyncSession
) -> dict:
    accounts = await _get_user_accounts(user_id, db)
    if not accounts:
        return {
            "equity_curve": [],
            "stats": {
                "total_return": 0.0, "total_return_pct": 0.0, "max_drawdown": 0.0,
                "max_drawdown_pct": 0.0, "sharpe_ratio": 0.0, "win_rate": 0.0,
                "total_trades": 0, "total_wins": 0, "total_losses": 0,
            },
            "monthly_breakdown": [], "symbol_breakdown": [],
        }

    account_ids = [a.id for a in accounts]
    if account_id:
        if account_id not in account_ids:
            raise HTTPException(status_code=404, detail="Account not found")
        account_ids = [account_id]

    now = datetime.now(timezone.utc)
    period_map = {"1m": timedelta(days=30), "3m": timedelta(days=90), "6m": timedelta(days=180), "1y": timedelta(days=365), "all": None}
    since = (now - period_map[period]) if period_map[period] else None

    query = (
        select(TradeHistory)
        .options(selectinload(TradeHistory.instrument))
        .where(TradeHistory.account_id.in_(account_ids))
    )
    if since:
        query = query.where(TradeHistory.closed_at >= since)
    query = query.order_by(TradeHistory.closed_at.asc())

    result = await db.execute(query)
    trades = result.scalars().all()

    total_profit = Decimal("0")
    total_wins = total_losses = 0
    max_equity = max_drawdown = Decimal("0")
    equity_curve = []
    running_equity = Decimal("0")
    daily_returns = []
    monthly_profits = {}
    symbol_profits = {}

    for trade in trades:
        running_equity += trade.profit
        total_profit += trade.profit
        if running_equity > max_equity:
            max_equity = running_equity
        dd = max_equity - running_equity
        if dd > max_drawdown:
            max_drawdown = dd
        if trade.profit > 0:
            total_wins += 1
        elif trade.profit < 0:
            total_losses += 1
        equity_curve.append({
            "time": trade.closed_at.isoformat() if trade.closed_at else None,
            "equity": float(running_equity), "profit": float(trade.profit),
        })
        if trade.closed_at:
            daily_returns.append(float(trade.profit))
            month_key = trade.closed_at.strftime("%Y-%m")
            monthly_profits[month_key] = monthly_profits.get(month_key, 0) + float(trade.profit)
        symbol = trade.instrument.symbol if trade.instrument else "unknown"
        if symbol not in symbol_profits:
            symbol_profits[symbol] = {"symbol": symbol, "profit": 0.0, "trades": 0, "wins": 0}
        symbol_profits[symbol]["profit"] += float(trade.profit)
        symbol_profits[symbol]["trades"] += 1
        if trade.profit > 0:
            symbol_profits[symbol]["wins"] += 1

    total_trades = total_wins + total_losses
    win_rate = (total_wins / total_trades * 100) if total_trades > 0 else 0
    avg_return = sum(daily_returns) / len(daily_returns) if daily_returns else 0
    std_dev = (sum((r - avg_return) ** 2 for r in daily_returns) / len(daily_returns)) ** 0.5 if len(daily_returns) > 1 else 0
    sharpe = (avg_return / std_dev) if std_dev > 0 else 0
    initial_balance = float(sum(a.balance for a in accounts if a.id in account_ids))
    total_return_pct = (float(total_profit) / initial_balance * 100) if initial_balance > 0 else 0
    max_dd_pct = (float(max_drawdown) / float(max_equity) * 100) if max_equity > 0 else 0
    monthly_breakdown = [{"month": k, "profit": v} for k, v in sorted(monthly_profits.items())]
    symbol_breakdown = sorted(symbol_profits.values(), key=lambda x: x["profit"], reverse=True)
    for sb in symbol_breakdown:
        sb["win_rate"] = round(sb["wins"] / sb["trades"] * 100, 2) if sb["trades"] > 0 else 0

    return {
        "equity_curve": equity_curve,
        "stats": {
            "total_return": float(total_profit), "total_return_pct": round(total_return_pct, 2),
            "max_drawdown": float(max_drawdown), "max_drawdown_pct": round(max_dd_pct, 2),
            "sharpe_ratio": round(sharpe, 4), "win_rate": round(win_rate, 2),
            "total_trades": total_trades, "total_wins": total_wins, "total_losses": total_losses,
        },
        "monthly_breakdown": monthly_breakdown, "symbol_breakdown": symbol_breakdown,
    }


async def trade_history(
    user_id: UUID, account_id: UUID | None, symbol: str | None, side: str | None,
    date_from: datetime | None, date_to: datetime | None, page: int, per_page: int,
    db: AsyncSession,
) -> dict:
    accounts = await _get_user_accounts(user_id, db)
    account_ids = [a.id for a in accounts]
    if account_id:
        if account_id not in account_ids:
            raise HTTPException(status_code=404, detail="Account not found")
        account_ids = [account_id]

    # Lazy backfill: relabel every still-'manual' history row where the
    # close_price crossed the position's SL/TP. Idempotent + cheap because it
    # only touches rows that are still 'manual' AND have an SL/TP set — once
    # a row is flipped to 'sl'/'tp' it's no longer matched. Runs without
    # requiring a backend restart so the UI corrects instantly.
    from sqlalchemy import text
    try:
        await db.execute(
            text(
                """
                UPDATE trade_history th
                SET close_reason = CASE
                    WHEN p.stop_loss IS NOT NULL AND (
                        (LOWER(CAST(p.side AS TEXT)) = 'buy'  AND th.close_price <= p.stop_loss)
                     OR (LOWER(CAST(p.side AS TEXT)) = 'sell' AND th.close_price >= p.stop_loss)
                    ) THEN 'sl'
                    WHEN p.take_profit IS NOT NULL AND (
                        (LOWER(CAST(p.side AS TEXT)) = 'buy'  AND th.close_price >= p.take_profit)
                     OR (LOWER(CAST(p.side AS TEXT)) = 'sell' AND th.close_price <= p.take_profit)
                    ) THEN 'tp'
                    ELSE th.close_reason
                END
                FROM positions p
                WHERE th.position_id = p.id
                  AND COALESCE(th.close_reason, 'manual') IN ('manual', 'copy_close', 'copy')
                  AND (p.stop_loss IS NOT NULL OR p.take_profit IS NOT NULL)
                """
            )
        )
        await db.commit()
    except Exception:
        # Never break trade_history if the backfill fails — just serve what's there.
        await db.rollback()

    base_filter = [TradeHistory.account_id.in_(account_ids)]
    if symbol:
        inst_result = await db.execute(select(Instrument.id).where(Instrument.symbol == symbol.upper()))
        inst_id = inst_result.scalar_one_or_none()
        if inst_id:
            base_filter.append(TradeHistory.instrument_id == inst_id)
        else:
            return {"items": [], "total": 0, "page": page, "per_page": per_page, "pages": 0}
    if side:
        base_filter.append(TradeHistory.side == OrderSide(side))
    if date_from:
        base_filter.append(TradeHistory.closed_at >= date_from)
    if date_to:
        base_filter.append(TradeHistory.closed_at <= date_to)

    count_result = await db.execute(select(func.count()).select_from(TradeHistory).where(*base_filter))
    total = count_result.scalar()

    result = await db.execute(
        select(TradeHistory).where(*base_filter)
        .order_by(TradeHistory.closed_at.desc())
        .offset((page - 1) * per_page).limit(per_page)
    )
    trades = result.scalars().all()

    items = []
    for t in trades:
        side_val = t.side.value if hasattr(t.side, 'value') else str(t.side)
        copy_trade_q = await db.execute(
            select(CopyTrade).where(CopyTrade.investor_position_id == t.position_id)
        )
        copy_trade = copy_trade_q.scalar_one_or_none()
        if copy_trade:
            trade_type = "copy_trade"
        else:
            # Algo bot tags every position with "Algo [<key label>]" comment
            # (api/algo_connector.py). Closed trades pull the source by
            # following position_id back to positions.comment.
            pos_comment = None
            if t.position_id:
                pc_q = await db.execute(
                    select(Position.comment).where(Position.id == t.position_id)
                )
                pos_comment = pc_q.scalar_one_or_none()
            if pos_comment and str(pos_comment).startswith("Algo ["):
                trade_type = "algo_trade"
            else:
                trade_type = "self_trade"
        items.append({
            "id": str(t.id),
            "account_id": str(t.account_id) if t.account_id else None,
            "symbol": t.instrument.symbol if t.instrument else None,
            "side": side_val, "lots": float(t.lots),
            "open_price": float(t.open_price), "close_price": float(t.close_price),
            "swap": float(t.swap), "commission": float(t.commission),
            "pnl": float(t.profit), "close_reason": t.close_reason or "manual",
            "trade_type": trade_type,
            "opened_at": t.opened_at.isoformat() if t.opened_at else None,
            "close_time": t.closed_at.isoformat() if t.closed_at else None,
        })

    return {
        "items": items, "total": total, "page": page, "per_page": per_page,
        "pages": (total + per_page - 1) // per_page if total else 0,
    }


async def export_trades(
    user_id: UUID, account_id: UUID | None,
    date_from: datetime | None, date_to: datetime | None,
    db: AsyncSession,
) -> StreamingResponse:
    accounts = await _get_user_accounts(user_id, db)
    account_ids = [a.id for a in accounts]
    if account_id:
        if account_id not in account_ids:
            raise HTTPException(status_code=404, detail="Account not found")
        account_ids = [account_id]

    base_filter = [TradeHistory.account_id.in_(account_ids)]
    if date_from:
        base_filter.append(TradeHistory.closed_at >= date_from)
    if date_to:
        base_filter.append(TradeHistory.closed_at <= date_to)

    result = await db.execute(
        select(TradeHistory).where(*base_filter)
        .order_by(TradeHistory.closed_at.desc()).limit(10000)
    )
    trades = result.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "ID", "Symbol", "Side", "Lots", "Open Price", "Close Price",
        "Swap", "Commission", "Profit", "Opened At", "Closed At",
    ])
    for t in trades:
        writer.writerow([
            str(t.id), t.instrument.symbol if t.instrument else "",
            t.side.value, float(t.lots), float(t.open_price), float(t.close_price),
            float(t.swap), float(t.commission), float(t.profit),
            t.opened_at.isoformat() if t.opened_at else "",
            t.closed_at.isoformat() if t.closed_at else "",
        ])

    output.seek(0)
    filename = f"trade_history_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
