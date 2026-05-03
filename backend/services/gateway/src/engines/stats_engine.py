"""Master Stats Engine — Periodically recalculates provider performance metrics.

Computes total_return_pct, max_drawdown_pct, and sharpe_ratio for every
approved MasterAccount based on their TradeHistory rows.

Also handles periodic management fee collection for PAMM/MAM masters.

Runs every 60 seconds inside the gateway lifespan.
"""
import asyncio
import logging
import math
from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import AsyncSessionLocal
from packages.common.src.models import (
    MasterAccount, TradingAccount, TradeHistory, InvestorAllocation, Transaction,
)
from packages.common.src.admin_fees import credit_admin_fee

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("stats-engine")

STATS_INTERVAL = 60  # seconds
MGMT_FEE_INTERVAL = 86400  # collect management fee once per day (seconds)


class StatsEngine:
    def __init__(self):
        self._running = False
        self._mgmt_fee_last_run: float = 0

    async def start(self):
        self._running = True
        logger.info("Stats Engine started (interval=%ds)", STATS_INTERVAL)
        asyncio.create_task(self._run())

    async def stop(self):
        self._running = False

    async def _run(self):
        while self._running:
            try:
                async with AsyncSessionLocal() as db:
                    await self._recalculate_all(db)
                    await db.commit()
            except Exception as e:
                logger.error("Stats engine error: %s", e, exc_info=True)

            # Management fee collection (daily)
            now = asyncio.get_event_loop().time()
            if now - self._mgmt_fee_last_run >= MGMT_FEE_INTERVAL:
                try:
                    async with AsyncSessionLocal() as db:
                        await self._collect_management_fees(db)
                        await db.commit()
                    self._mgmt_fee_last_run = now
                except Exception as e:
                    logger.error("Management fee collection error: %s", e, exc_info=True)

            await asyncio.sleep(STATS_INTERVAL)

    async def _recalculate_all(self, db: AsyncSession):
        result = await db.execute(
            select(MasterAccount).where(
                MasterAccount.status.in_(["approved", "active"]),
            )
        )
        masters = result.scalars().all()

        for master in masters:
            try:
                await self._recalculate_master(master, db)
            except Exception as e:
                logger.error("Stats recalc error master=%s: %s", master.id, e)

    async def _recalculate_master(self, master: MasterAccount, db: AsyncSession):
        account = await db.get(TradingAccount, master.account_id)
        if not account:
            return

        # Fetch all closed trades ordered by close time
        trades_q = await db.execute(
            select(TradeHistory)
            .where(TradeHistory.account_id == master.account_id)
            .order_by(TradeHistory.closed_at.asc())
        )
        trades = trades_q.scalars().all()

        if not trades:
            return

        # --- total_return_pct ---
        initial_balance = float(account.balance or 0)
        total_profit = sum(float(t.profit or 0) for t in trades)
        # Estimate starting equity: current balance minus cumulative profit
        starting_equity = initial_balance - total_profit
        if starting_equity > 0:
            total_return_pct = (total_profit / starting_equity) * 100
        elif total_profit > 0:
            total_return_pct = 100.0
        else:
            total_return_pct = 0.0

        # --- max_drawdown_pct ---
        equity_curve = []
        running_equity = starting_equity if starting_equity > 0 else initial_balance
        for t in trades:
            running_equity += float(t.profit or 0)
            equity_curve.append(running_equity)

        peak = equity_curve[0] if equity_curve else running_equity
        max_dd_pct = 0.0
        for eq in equity_curve:
            if eq > peak:
                peak = eq
            if peak > 0:
                dd = (peak - eq) / peak * 100
                if dd > max_dd_pct:
                    max_dd_pct = dd

        # --- sharpe_ratio ---
        # Annualised Sharpe from per-trade returns
        returns = []
        for t in trades:
            pnl = float(t.profit or 0)
            cost_basis = float(t.lots or 1) * float(t.open_price or 1) * 100000  # approx notional
            if cost_basis > 0:
                returns.append(pnl / cost_basis)

        if len(returns) >= 2:
            avg_ret = sum(returns) / len(returns)
            std_ret = math.sqrt(sum((r - avg_ret) ** 2 for r in returns) / (len(returns) - 1))
            if std_ret > 0:
                # Annualise assuming ~252 trading days, ~5 trades per day as rough multiplier
                trades_per_year = min(len(trades), 252 * 5)
                sharpe = (avg_ret / std_ret) * math.sqrt(trades_per_year)
            else:
                sharpe = 0.0
        else:
            sharpe = 0.0

        # Update master
        master.total_return_pct = Decimal(str(round(total_return_pct, 4)))
        master.max_drawdown_pct = Decimal(str(round(max_dd_pct, 4)))
        master.sharpe_ratio = Decimal(str(round(sharpe, 4)))

    async def _collect_management_fees(self, db: AsyncSession):
        """Collect daily management fees from active PAMM/MAM allocations.

        management_fee_pct is annual. Daily charge = (annual_pct / 365) * allocation_amount.
        Deducted from investor account balance, credited to master account.
        """
        result = await db.execute(
            select(MasterAccount).where(
                MasterAccount.status.in_(["approved", "active"]),
                MasterAccount.master_type.in_(["pamm", "mamm"]),
                MasterAccount.management_fee_pct > 0,
            )
        )
        masters = result.scalars().all()

        for master in masters:
            daily_rate = float(master.management_fee_pct) / 365 / 100
            if daily_rate <= 0:
                continue

            master_account = await db.get(TradingAccount, master.account_id)
            if not master_account:
                continue

            allocs_q = await db.execute(
                select(InvestorAllocation).where(
                    InvestorAllocation.master_id == master.id,
                    InvestorAllocation.status == "active",
                )
            )
            allocations = allocs_q.scalars().all()

            for alloc in allocations:
                fee = Decimal(str(round(float(alloc.allocation_amount or 0) * daily_rate, 8)))
                if fee <= 0:
                    continue

                investor_account = await db.get(TradingAccount, alloc.investor_account_id)
                if not investor_account or (investor_account.balance or Decimal("0")) < fee:
                    logger.info(
                        "Skip mgmt fee: insufficient balance investor=%s fee=%s",
                        alloc.investor_account_id, fee,
                    )
                    continue

                # Deduct from investor
                investor_account.balance = (investor_account.balance or Decimal("0")) - fee
                investor_account.equity = investor_account.balance + (investor_account.credit or Decimal("0"))
                investor_account.free_margin = investor_account.equity - (investor_account.margin_used or Decimal("0"))

                db.add(Transaction(
                    user_id=alloc.investor_user_id,
                    account_id=investor_account.id,
                    type="commission",
                    amount=-fee,
                    balance_after=investor_account.balance,
                    description=f"Management fee ({master.management_fee_pct}% annual) for managed account",
                ))

                # Credit to master (minus admin cut)
                admin_pct = float(master.admin_commission_pct or 0) / 100
                admin_fee = Decimal(str(round(float(fee) * admin_pct, 8)))
                master_share = fee - admin_fee

                master_account.balance = (master_account.balance or Decimal("0")) + master_share
                master_account.equity = master_account.balance + (master_account.credit or Decimal("0"))
                master_account.free_margin = master_account.equity - (master_account.margin_used or Decimal("0"))

                db.add(Transaction(
                    user_id=master.user_id,
                    account_id=master_account.id,
                    type="ib_commission",
                    amount=master_share,
                    balance_after=master_account.balance,
                    description=f"Management fee earned from investor allocation {alloc.id}",
                ))

                # Credit admin fee to platform
                if admin_fee > 0:
                    await credit_admin_fee(
                        db, admin_fee,
                        description=f"Platform cut ({master.admin_commission_pct}%) of mgmt fee from master {master_account.account_number}",
                    )

                # Track master's total fee earned
                master.total_fee_earned = (master.total_fee_earned or Decimal("0")) + master_share

                logger.info(
                    "Mgmt fee collected: investor=%s amount=%s master_share=%s admin=%s",
                    alloc.investor_account_id, fee, master_share, admin_fee,
                )


stats_engine = StatsEngine()
