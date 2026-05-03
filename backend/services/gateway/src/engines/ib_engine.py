"""IB Commission Engine — Distributes trade commissions through MLM levels.

When a referred user places a trade, this engine:
1. Finds the referrer IB via the Referral table
2. Looks up the IB commission plan (commission_per_lot)
3. Distributes commission up the MLM chain using mlm_distribution percentages
4. Creates IBCommission records and credits IB trading accounts
"""
import json
import logging
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.models import (
    Referral, IBProfile, IBCommission, IBCommissionPlan,
    TradingAccount, Transaction, SystemSetting,
)

logger = logging.getLogger("ib-engine")

DEFAULT_MLM_DISTRIBUTION = [40, 25, 15, 10, 10]


async def get_mlm_distribution(db: AsyncSession) -> list[int]:
    result = await db.execute(
        select(SystemSetting).where(SystemSetting.key == "mlm_distribution")
    )
    setting = result.scalar_one_or_none()
    if setting and setting.value:
        val = setting.value
        if isinstance(val, str):
            try:
                val = json.loads(val)
            except Exception:
                return DEFAULT_MLM_DISTRIBUTION
        if isinstance(val, list):
            return [int(x) for x in val]
    return DEFAULT_MLM_DISTRIBUTION


async def distribute_ib_commission(
    db: AsyncSession,
    trader_user_id: UUID,
    order_id: UUID,
    lots: Decimal,
    instrument_symbol: str,
):
    """Called after a market order is filled. Distributes commission to IB chain."""
    referral_q = await db.execute(
        select(Referral).where(Referral.referred_id == trader_user_id)
    )
    referral = referral_q.scalar_one_or_none()
    if not referral or not referral.ib_profile_id:
        return

    ib_profile_q = await db.execute(
        select(IBProfile).where(IBProfile.id == referral.ib_profile_id, IBProfile.is_active == True)
    )
    direct_ib = ib_profile_q.scalar_one_or_none()
    if not direct_ib:
        return

    plan = None
    if direct_ib.commission_plan_id:
        plan_q = await db.execute(
            select(IBCommissionPlan).where(IBCommissionPlan.id == direct_ib.commission_plan_id)
        )
        plan = plan_q.scalar_one_or_none()

    if not plan:
        plan_q = await db.execute(
            select(IBCommissionPlan).where(IBCommissionPlan.is_default == True)
        )
        plan = plan_q.scalar_one_or_none()

    # Effective per-lot rate: direct IB's custom override beats plan; plan beats nothing.
    per_lot = None
    if direct_ib.custom_commission_per_lot is not None and direct_ib.custom_commission_per_lot > 0:
        per_lot = Decimal(str(direct_ib.custom_commission_per_lot))
    elif plan and plan.commission_per_lot is not None:
        per_lot = Decimal(str(plan.commission_per_lot))

    if per_lot is None or per_lot <= 0:
        return

    total_commission = per_lot * lots
    if total_commission <= 0:
        return

    # Prefer plan's MLM distribution; fall back to global SystemSetting; then default.
    mlm_dist: list[int] | None = None
    if plan and plan.mlm_distribution:
        raw = plan.mlm_distribution
        if isinstance(raw, str):
            try:
                raw = json.loads(raw)
            except Exception:
                raw = None
        if isinstance(raw, list) and raw:
            mlm_dist = [int(x) for x in raw]
    if mlm_dist is None:
        mlm_dist = await get_mlm_distribution(db)

    current_ib = direct_ib
    for level, pct in enumerate(mlm_dist, start=1):
        if current_ib is None:
            break

        share = total_commission * Decimal(str(pct)) / Decimal("100")
        if share <= 0:
            current_ib = await _get_parent_ib(current_ib, db)
            continue

        commission_record = IBCommission(
            ib_id=current_ib.id,
            source_user_id=trader_user_id,
            source_trade_id=order_id,
            commission_type="trade_lot",
            amount=share,
            mlm_level=level,
            status="paid",
        )
        db.add(commission_record)

        current_ib.total_earned = (current_ib.total_earned or Decimal("0")) + share

        ib_account_q = await db.execute(
            select(TradingAccount).where(
                TradingAccount.user_id == current_ib.user_id,
                TradingAccount.is_demo == False,
                TradingAccount.is_active == True,
            ).limit(1)
        )
        ib_account = ib_account_q.scalar_one_or_none()
        if ib_account:
            ib_account.balance = (ib_account.balance or Decimal("0")) + share
            ib_account.equity = ib_account.balance + (ib_account.credit or Decimal("0"))
            ib_account.free_margin = ib_account.equity - (ib_account.margin_used or Decimal("0"))

            db.add(Transaction(
                user_id=current_ib.user_id,
                account_id=ib_account.id,
                type="ib_commission",
                amount=share,
                balance_after=ib_account.balance,
                description=f"IB commission L{level}: {instrument_symbol} {lots} lots",
            ))

        logger.info(f"IB commission L{level}: ${share:.2f} to {current_ib.referral_code} ({instrument_symbol} {lots} lots)")

        current_ib = await _get_parent_ib(current_ib, db)


async def _get_parent_ib(ib: IBProfile, db: AsyncSession) -> IBProfile | None:
    if not ib.parent_ib_id:
        return None
    result = await db.execute(
        select(IBProfile).where(IBProfile.id == ib.parent_ib_id, IBProfile.is_active == True)
    )
    return result.scalar_one_or_none()
