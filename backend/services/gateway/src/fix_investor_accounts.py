"""One-time fix: Create dedicated investor trading accounts for existing
allocations that are linked to personal (PT*) accounts.

Run inside gateway container:
    python -m services.gateway.src.fix_investor_accounts
"""
import asyncio
import secrets
import logging
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import AsyncSessionLocal
from packages.common.src.models import InvestorAllocation, TradingAccount

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)-5s %(message)s")
logger = logging.getLogger("fix-investor-accounts")


def _gen(copy_type: str) -> str:
    prefix = "CF" if copy_type == "signal" else "IF"
    return f"{prefix}{secrets.randbelow(90000000) + 10000000}"


async def fix():
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(InvestorAllocation).where(InvestorAllocation.status == "active")
        )
        allocs = result.scalars().all()

        if not allocs:
            logger.info("No active allocations found.")
            return

        for alloc in allocs:
            old_acct = await db.get(TradingAccount, alloc.investor_account_id)
            old_num = old_acct.account_number if old_acct else "MISSING"

            # Skip if already has a dedicated account (CF/IF prefix)
            if old_num.startswith("CF") or old_num.startswith("IF"):
                logger.info("alloc=%s already has dedicated account %s, skip", alloc.id, old_num)
                continue

            ct = str(alloc.copy_type or "signal").lower()
            amount = alloc.allocation_amount or Decimal("0")

            # Create dedicated investor account
            new_acct = TradingAccount(
                user_id=alloc.investor_user_id,
                account_number=_gen(ct),
                balance=amount,
                equity=amount,
                free_margin=amount,
                margin_used=Decimal("0"),
                leverage=500,
                currency="USD",
                is_demo=False,
                is_active=True,
            )
            db.add(new_acct)
            await db.flush()

            # Update allocation to point to new account
            alloc.investor_account_id = new_acct.id

            logger.info(
                "alloc=%s type=%s: %s ($%.2f) → new account %s ($%.2f)",
                alloc.id, ct, old_num, float(amount),
                new_acct.account_number, float(new_acct.balance),
            )

        await db.commit()
        logger.info("Done. All active allocations migrated to dedicated accounts.")


if __name__ == "__main__":
    asyncio.run(fix())
