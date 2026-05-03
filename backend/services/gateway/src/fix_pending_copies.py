"""One-time fix: Auto-approve old PENDING copy-trade allocations that were
stuck because the old flow required master approval (which never had a UI).

For every InvestorAllocation with status="pending" and no investor_account_id:
 - If the follower's main wallet has enough balance, create a dedicated CF
   account, debit the wallet, log a Transaction, activate the allocation, and
   bump master.followers_count.
 - If the wallet is short, skip and log (follower must top up; admin can rerun).

Run inside gateway container:
    python -m services.gateway.src.fix_pending_copies
"""
import asyncio
import secrets
import logging
from decimal import Decimal

from sqlalchemy import select

from packages.common.src.database import AsyncSessionLocal
from packages.common.src.models import (
    InvestorAllocation, TradingAccount, User, MasterAccount,
    Transaction, AllocationCopyType,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)-5s %(message)s")
logger = logging.getLogger("fix-pending-copies")


def _gen(copy_type: str) -> str:
    prefix = "CF" if copy_type == "signal" else "IF"
    return f"{prefix}{secrets.randbelow(90000000) + 10000000}"


async def fix():
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(InvestorAllocation).where(InvestorAllocation.status == "pending")
        )
        allocs = result.scalars().all()

        if not allocs:
            logger.info("No pending allocations found.")
            return

        logger.info("Found %d pending allocation(s) to process.", len(allocs))

        activated = 0
        skipped_balance = 0
        skipped_other = 0

        for alloc in allocs:
            amount = alloc.allocation_amount or Decimal("0")

            master = await db.get(MasterAccount, alloc.master_id)
            if not master or master.status not in ("approved", "active"):
                logger.warning("alloc=%s: master missing or not approved, skip", alloc.id)
                skipped_other += 1
                continue

            user = await db.get(User, alloc.investor_user_id)
            if not user:
                logger.warning("alloc=%s: investor user missing, skip", alloc.id)
                skipped_other += 1
                continue

            wallet_bal = user.main_wallet_balance or Decimal("0")
            if wallet_bal < amount:
                logger.warning(
                    "alloc=%s user=%s: wallet $%.2f < required $%.2f, SKIP (top up and rerun)",
                    alloc.id, user.email, float(wallet_bal), float(amount),
                )
                skipped_balance += 1
                continue

            ct = str(alloc.copy_type or AllocationCopyType.SIGNAL.value).lower()
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

            user.main_wallet_balance = wallet_bal - amount
            db.add(Transaction(
                user_id=alloc.investor_user_id,
                account_id=new_acct.id,
                type="withdrawal",
                amount=-amount,
                description=f"Copy trading investment (backfill) → account {new_acct.account_number}",
            ))

            alloc.investor_account_id = new_acct.id
            alloc.status = "active"
            master.followers_count = (master.followers_count or 0) + 1

            logger.info(
                "alloc=%s user=%s → account %s ($%.2f) ACTIVE",
                alloc.id, user.email, new_acct.account_number, float(amount),
            )
            activated += 1

        await db.commit()
        logger.info(
            "Done. activated=%d skipped_insufficient_balance=%d skipped_other=%d",
            activated, skipped_balance, skipped_other,
        )


if __name__ == "__main__":
    asyncio.run(fix())
