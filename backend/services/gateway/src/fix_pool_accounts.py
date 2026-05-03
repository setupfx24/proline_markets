"""One-time fix: Create pool trading accounts for existing approved masters
and credit investor funds into those pool accounts.

Run inside gateway container:
    python -m src.fix_pool_accounts
"""
import asyncio
import secrets
import logging
from decimal import Decimal

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import AsyncSessionLocal
from packages.common.src.models import (
    MasterAccount, TradingAccount, InvestorAllocation, User,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)-5s %(message)s")
logger = logging.getLogger("fix-pool-accounts")


def _gen_pool_number(prefix: str) -> str:
    return f"{prefix}{secrets.randbelow(90000000) + 10000000}"


async def fix():
    async with AsyncSessionLocal() as db:
        # Find all approved/active masters
        result = await db.execute(
            select(MasterAccount).where(
                MasterAccount.status.in_(["approved", "active"]),
            )
        )
        masters = result.scalars().all()

        if not masters:
            logger.info("No approved masters found.")
            return

        for master in masters:
            mt = (master.master_type or "signal_provider").lower()
            prefix = "PM" if mt == "pamm" else ("MM" if mt == "mamm" else "CT")
            master_label = f"{master.master_type} master={master.id}"

            # Check if master already has a pool account (prefixed PM/MM/CT)
            existing_pool = None
            if master.account_id:
                existing_pool = await db.get(TradingAccount, master.account_id)

            needs_new_pool = False
            if not existing_pool:
                needs_new_pool = True
                logger.info("%s — no account linked, creating pool", master_label)
            elif existing_pool.account_number and not existing_pool.account_number.startswith(("PM", "MM", "CT")):
                # Has a personal account linked, not a pool account
                needs_new_pool = True
                logger.info("%s — linked to personal account %s, creating dedicated pool",
                            master_label, existing_pool.account_number)

            if needs_new_pool:
                pool = TradingAccount(
                    user_id=master.user_id,
                    account_number=_gen_pool_number(prefix),
                    balance=Decimal("0"),
                    equity=Decimal("0"),
                    free_margin=Decimal("0"),
                    margin_used=Decimal("0"),
                    leverage=500,
                    currency="USD",
                    is_demo=False,
                    is_active=True,
                )
                db.add(pool)
                await db.flush()
                master.account_id = pool.id
                logger.info("%s — created pool account %s (id=%s)",
                            master_label, pool.account_number, pool.id)
            else:
                pool = existing_pool
                logger.info("%s — already has pool account %s",
                            master_label, pool.account_number)

            # Sum all active investor allocations for this master
            alloc_result = await db.execute(
                select(
                    func.coalesce(func.sum(InvestorAllocation.allocation_amount), 0)
                ).where(
                    InvestorAllocation.master_id == master.id,
                    InvestorAllocation.status == "active",
                )
            )
            total_invested = Decimal(str(alloc_result.scalar() or 0))

            if total_invested > 0:
                current_balance = pool.balance or Decimal("0")
                if current_balance < total_invested:
                    add_amount = total_invested - current_balance
                    pool.balance = total_invested
                    pool.equity = pool.balance + (pool.credit or Decimal("0"))
                    pool.free_margin = pool.equity - (pool.margin_used or Decimal("0"))
                    logger.info("%s — added $%.2f investor funds to pool (total: $%.2f)",
                                master_label, float(add_amount), float(pool.balance))
                else:
                    logger.info("%s — pool already has $%.2f >= invested $%.2f, no top-up needed",
                                master_label, float(current_balance), float(total_invested))
            else:
                logger.info("%s — no active investor funds to add", master_label)

        await db.commit()
        logger.info("Done. All masters processed.")


if __name__ == "__main__":
    asyncio.run(fix())
