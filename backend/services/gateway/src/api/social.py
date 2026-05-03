"""Social Trading API — Leaderboard, copy trading, MAM/PAMM."""
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Body, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import get_db
from packages.common.src.auth import get_current_user
from ..services import social_service

router = APIRouter()


@router.get("/leaderboard")
async def list_leaderboard(
    sort_by: str = Query("total_return_pct", pattern="^(total_return_pct|followers_count|sharpe_ratio)$"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return await social_service.list_leaderboard(
        sort_by=sort_by, page=page, per_page=per_page, user_id=current_user["user_id"], db=db,
    )


@router.get("/providers/{provider_id}")
async def get_provider_detail(
    provider_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await social_service.get_provider_detail(
        provider_id=provider_id, user_id=current_user["user_id"], db=db,
    )


@router.post("/copy", status_code=201)
async def start_copy(
    master_id: UUID = Query(...),
    account_id: UUID = Query(...),
    amount: Decimal = Query(..., gt=0),
    max_drawdown_pct: Decimal = Query(None),
    max_lot_override: Decimal = Query(None),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await social_service.start_copy(
        master_id=master_id, account_id=account_id, amount=amount,
        max_drawdown_pct=max_drawdown_pct, max_lot_override=max_lot_override,
        user_id=current_user["user_id"], db=db,
    )


@router.get("/my-copies")
async def my_copies(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await social_service.my_copies(user_id=current_user["user_id"], db=db)


@router.get("/follow-requests")
async def follow_requests(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Master sees all pending follow requests for their provider account."""
    return await social_service.list_follow_requests(
        user_id=current_user["user_id"], db=db,
    )


@router.post("/follow-requests/{allocation_id}")
async def approve_follow_request(
    allocation_id: UUID,
    action: str = Query(..., pattern="^(approve|reject)$"),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Master approves or rejects a pending follow request."""
    return await social_service.approve_follow_request(
        allocation_id=allocation_id, action=action,
        user_id=current_user["user_id"], db=db,
    )


@router.delete("/copy/{allocation_id}")
async def stop_copy(
    allocation_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await social_service.stop_copy(
        allocation_id=allocation_id, user_id=current_user["user_id"], db=db,
    )


@router.post("/become-provider", status_code=201)
async def become_provider(
    master_type: str = Query("signal_provider"),
    description: str = Query(None),
    performance_fee_pct: Decimal = Query(Decimal("20"), ge=0, le=50),
    management_fee_pct: Decimal = Query(Decimal("0"), ge=0, le=10),
    min_investment: Decimal = Query(Decimal("100"), gt=0),
    max_investors: int = Query(100, ge=1, le=1000),
    strategy_info: dict | None = Body(None),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # account_id removed — server auto-creates a dedicated master trading
    # account so the user's personal live accounts stay separate.
    return await social_service.become_provider(
        account_id=None, master_type=master_type, description=description,
        performance_fee_pct=performance_fee_pct, management_fee_pct=management_fee_pct,
        min_investment=min_investment, max_investors=max_investors,
        strategy_info=strategy_info,
        user_id=current_user["user_id"], db=db,
    )


@router.get("/my-provider")
async def my_provider_stats(
    master_type: str = Query(None),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await social_service.my_provider_stats(
        user_id=current_user["user_id"], db=db, master_type=master_type,
    )


@router.get("/mamm-pamm")
async def list_managed_accounts(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await social_service.list_managed_accounts(
        page=page, per_page=per_page, db=db,
    )


@router.post("/mamm-pamm/{master_id}/invest", status_code=201)
async def invest_managed_account(
    master_id: UUID,
    account_id: UUID = Query(...),
    amount: Decimal = Query(..., gt=0),
    max_drawdown_pct: Decimal = Query(None),
    volume_scaling_pct: Decimal = Query(
        Decimal("100"),
        ge=Decimal("1"),
        le=Decimal("500"),
        description="MAM only: multiplier on proportional share (100 = same as PAMM share)",
    ),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await social_service.invest_managed_account(
        master_id=master_id, account_id=account_id, amount=amount,
        max_drawdown_pct=max_drawdown_pct, volume_scaling_pct=volume_scaling_pct,
        user_id=current_user["user_id"], db=db,
    )


@router.delete("/mamm-pamm/{allocation_id}/withdraw")
async def withdraw_managed_account(
    allocation_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await social_service.withdraw_managed_account(
        allocation_id=allocation_id, user_id=current_user["user_id"], db=db,
    )


@router.get("/my-allocations")
async def my_allocations(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await social_service.my_allocations(
        user_id=current_user["user_id"], db=db,
    )


@router.get("/account-risk/{investor_account_id}")
async def get_account_risk(
    investor_account_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await social_service.get_account_risk(
        investor_account_id=investor_account_id,
        user_id=current_user["user_id"], db=db,
    )


@router.put("/account-risk/{investor_account_id}")
async def update_account_risk(
    investor_account_id: UUID,
    max_drawdown_pct: Decimal | None = Body(None, embed=True),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await social_service.update_account_risk(
        investor_account_id=investor_account_id,
        max_drawdown_pct=max_drawdown_pct,
        user_id=current_user["user_id"], db=db,
    )


@router.post("/account-risk/{investor_account_id}/reset")
async def reset_account_risk(
    investor_account_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await social_service.reset_account_risk(
        investor_account_id=investor_account_id,
        user_id=current_user["user_id"], db=db,
    )


@router.get("/pamm/{allocation_id}/trades")
async def pamm_master_trades(
    allocation_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """PAMM investor's view: master's open + recent closed trades, with
    each trade's master P&L and the investor's proportional share."""
    return await social_service.pamm_master_trades(
        allocation_id=allocation_id, user_id=current_user["user_id"], db=db,
    )


@router.get("/master-investors")
async def master_investors(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await social_service.master_investors(
        user_id=current_user["user_id"], db=db,
    )


@router.get("/master-performance")
async def master_performance(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await social_service.master_performance(
        user_id=current_user["user_id"], db=db,
    )
