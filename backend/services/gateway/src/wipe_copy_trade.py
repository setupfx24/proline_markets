"""One-time wipe: Completely reset the copy-trade subsystem.

This is a DESTRUCTIVE operation. Run dry-run first:
    python -m services.gateway.src.wipe_copy_trade
Then execute:
    python -m services.gateway.src.wipe_copy_trade --execute

What it does (in order, inside a single transaction per session):
 1. For each active InvestorAllocation:
    - Close any still-open copied Position rows using the current bid/ask from
      Redis (falls back to open_price if no tick available — zero PnL).
    - Refund (allocation_amount + total_profit + realized close PnL) to the
      follower's main_wallet_balance, minus any performance fee charged.
    - Write a Transaction row for the audit trail.
 2. For each MasterAccount (any status):
    - If the pool TradingAccount (CT/PM/MM) has balance, refund it to the
      master user's main_wallet_balance and log a Transaction.
    - Soft-delete the pool account (is_active=False).
 3. Soft-delete all CF/IF follower sub-accounts (is_active=False). Not hard
    deleted because Position / TradeHistory / Transaction rows reference them.
 4. Hard DELETE all rows from copy_trades, investor_allocations, master_accounts.

After: zero masters, zero allocations. All user wallets are whole. The copy
trade section is effectively fresh — a user can apply as a master and start
from scratch.
"""
import argparse
import asyncio
import json
import logging
from decimal import Decimal
from datetime import datetime, timezone

from sqlalchemy import select, delete, func

from packages.common.src.database import AsyncSessionLocal
from packages.common.src.models import (
    MasterAccount, InvestorAllocation, CopyTrade, Position, PositionStatus,
    TradingAccount, TradeHistory, Transaction, User,
)
from packages.common.src.redis_client import redis_client, PriceChannel

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)-5s %(message)s")
logger = logging.getLogger("wipe-copy-trade")


async def _close_open_copy_positions(allocation, db, execute: bool) -> Decimal:
    """Close every still-open Position linked to this allocation via CopyTrade.
    Returns realized PnL for these closures (after performance fee)."""
    total_pnl = Decimal("0")

    copies_q = await db.execute(
        select(CopyTrade).where(
            CopyTrade.investor_allocation_id == allocation.id,
            CopyTrade.status == "open",
        )
    )
    open_copies = copies_q.scalars().all()
    if not open_copies:
        return total_pnl

    master_q = await db.execute(
        select(MasterAccount).where(MasterAccount.id == allocation.master_id)
    )
    master = master_q.scalar_one_or_none()
    perf_fee_pct = (master.performance_fee_pct or Decimal("0")) if master else Decimal("0")

    for copy in open_copies:
        pos = await db.get(Position, copy.investor_position_id)
        if not pos or pos.status != PositionStatus.OPEN:
            copy.status = "closed"
            continue

        inst = pos.instrument
        side_val = pos.side.value if hasattr(pos.side, "value") else str(pos.side)

        close_price = pos.open_price  # fallback — zero PnL
        tick_data = await redis_client.get(PriceChannel.tick_key(inst.symbol)) if inst else None
        if tick_data:
            tick = json.loads(tick_data)
            close_price = Decimal(str(tick["bid"])) if side_val == "buy" else Decimal(str(tick["ask"]))

        contract_size = (inst.contract_size if inst else None) or Decimal("100000")
        if side_val == "buy":
            gross = (close_price - pos.open_price) * pos.lots * contract_size
        else:
            gross = (pos.open_price - close_price) * pos.lots * contract_size
        from packages.common.src.trading_service import quote_to_account_pnl
        gross = quote_to_account_pnl(
            gross,
            getattr(inst, "base_currency", None) if inst else None,
            getattr(inst, "quote_currency", None) if inst else None,
            close_price,
            symbol=getattr(inst, "symbol", None) if inst else None,
        )

        perf_fee = gross * perf_fee_pct / Decimal("100") if gross > 0 else Decimal("0")
        net = gross - perf_fee
        total_pnl += net

        logger.info(
            "   · closing copy position %s %s %.2f lots @ %s → gross=$%.2f fee=$%.2f net=$%.2f",
            inst.symbol if inst else "?", side_val, float(pos.lots),
            close_price, float(gross), float(perf_fee), float(net),
        )

        if execute:
            pos.status = PositionStatus.CLOSED.value
            pos.close_price = close_price
            pos.profit = net
            pos.closed_at = datetime.now(timezone.utc)
            db.add(TradeHistory(
                position_id=pos.id, account_id=pos.account_id,
                instrument_id=pos.instrument_id, side=pos.side,
                lots=pos.lots, open_price=pos.open_price,
                close_price=close_price, swap=pos.swap or Decimal("0"),
                commission=pos.commission or Decimal("0"), profit=net,
                close_reason="copy_trade_wipe",
                opened_at=pos.created_at,
                closed_at=datetime.now(timezone.utc),
            ))
            copy.status = "closed"

    return total_pnl


async def wipe(execute: bool):
    mode = "EXECUTE" if execute else "DRY-RUN"
    logger.info("──────── COPY-TRADE WIPE [%s] ────────", mode)

    async with AsyncSessionLocal() as db:
        allocs_q = await db.execute(
            select(InvestorAllocation).where(InvestorAllocation.status == "active")
        )
        active_allocs = allocs_q.scalars().all()
        logger.info("Active allocations to refund: %d", len(active_allocs))

        total_follower_refund = Decimal("0")
        for alloc in active_allocs:
            user = await db.get(User, alloc.investor_user_id)
            if not user:
                logger.warning(" alloc=%s: user missing, skipping refund", alloc.id)
                continue

            close_pnl = await _close_open_copy_positions(alloc, db, execute)
            principal = alloc.allocation_amount or Decimal("0")
            accumulated = alloc.total_profit or Decimal("0")
            refund = principal + accumulated + close_pnl
            if refund < 0:
                refund = Decimal("0")

            logger.info(
                " follower=%s alloc=%s: principal=$%.2f accum_pnl=$%.2f close_pnl=$%.2f → REFUND $%.2f",
                user.email, alloc.id,
                float(principal), float(accumulated), float(close_pnl), float(refund),
            )
            total_follower_refund += refund

            if execute and refund > 0:
                user.main_wallet_balance = (user.main_wallet_balance or Decimal("0")) + refund
                db.add(Transaction(
                    user_id=user.id, account_id=None, type="deposit",
                    amount=refund,
                    description="Copy trade wipe refund (capital + P&L)",
                ))

        masters_q = await db.execute(select(MasterAccount))
        masters = masters_q.scalars().all()
        logger.info("Masters to close: %d", len(masters))

        total_master_refund = Decimal("0")
        for m in masters:
            mu = await db.get(User, m.user_id)
            if not mu:
                logger.warning(" master=%s: owner user missing", m.id)
                continue
            pool = await db.get(TradingAccount, m.account_id) if m.account_id else None
            pool_bal = pool.balance if pool else Decimal("0")

            logger.info(
                " master=%s owner=%s pool=%s balance=$%.2f → REFUND to owner",
                m.id, mu.email,
                pool.account_number if pool else "none",
                float(pool_bal or 0),
            )
            if pool_bal and pool_bal > 0:
                total_master_refund += pool_bal
                if execute:
                    mu.main_wallet_balance = (mu.main_wallet_balance or Decimal("0")) + pool_bal
                    db.add(Transaction(
                        user_id=mu.id, account_id=pool.id, type="deposit",
                        amount=pool_bal,
                        description="Copy trade wipe — master pool refund",
                    ))
                    pool.balance = Decimal("0")
                    pool.equity = Decimal("0")
                    pool.free_margin = Decimal("0")
                    pool.margin_used = Decimal("0")

            if execute and pool:
                pool.is_active = False

        cf_q = await db.execute(
            select(TradingAccount).where(
                func.substr(TradingAccount.account_number, 1, 2).in_(["CF", "IF"]),
                TradingAccount.is_active == True,
            )
        )
        cf_accounts = cf_q.scalars().all()
        logger.info("Follower sub-accounts (CF/IF) to soft-delete: %d", len(cf_accounts))
        for a in cf_accounts:
            logger.info(" · %s (balance=$%.2f)", a.account_number, float(a.balance or 0))
            if execute:
                a.is_active = False

        if execute:
            ct_q = await db.execute(delete(CopyTrade))
            ia_q = await db.execute(delete(InvestorAllocation))
            ma_q = await db.execute(delete(MasterAccount))
            logger.info(
                "DELETED rows: copy_trades=%d investor_allocations=%d master_accounts=%d",
                ct_q.rowcount, ia_q.rowcount, ma_q.rowcount,
            )
            await db.commit()
        else:
            ct_count = (await db.execute(select(func.count()).select_from(CopyTrade))).scalar()
            ia_count = (await db.execute(select(func.count()).select_from(InvestorAllocation))).scalar()
            ma_count = (await db.execute(select(func.count()).select_from(MasterAccount))).scalar()
            logger.info(
                "WOULD DELETE rows: copy_trades=%d investor_allocations=%d master_accounts=%d",
                ct_count, ia_count, ma_count,
            )

    logger.info("──────── SUMMARY [%s] ────────", mode)
    logger.info("Follower refunds total: $%.2f", float(total_follower_refund))
    logger.info("Master pool refunds total: $%.2f", float(total_master_refund))
    if not execute:
        logger.info("Dry-run only. Pass --execute to perform the wipe.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--execute", action="store_true", help="Actually perform the wipe")
    args = parser.parse_args()
    asyncio.run(wipe(execute=args.execute))
