"""Trading Accounts API."""
from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import get_db
from packages.common.src.schemas import (
    AccountSummary,
    MessageResponse,
    OpenLiveAccountRequest,
    TradingAccountResponse,
)
from packages.common.src.auth import get_current_user
from ..services import account_service

router = APIRouter()


@router.get("/available-groups")
async def list_openable_account_groups(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Account types the broker exposes (admin-managed AccountGroup rows). Filtered by user's demo/live status."""
    return await account_service.list_openable_account_groups(
        db=db, user_id=current_user["user_id"],
    )


@router.post("/open", status_code=status.HTTP_201_CREATED)
async def open_live_account(
    req: OpenLiveAccountRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a live trading account from an admin-defined type. Optional internal funding from existing live balances."""
    return await account_service.open_live_account(
        user_id=current_user["user_id"], req=req, db=db,
    )


@router.get("")
async def list_accounts(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await account_service.list_accounts(
        user_id=current_user["user_id"], db=db,
    )


@router.get("/{account_id}", response_model=TradingAccountResponse)
async def get_account(
    account_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await account_service.get_account(
        account_id=account_id, user_id=current_user["user_id"], db=db,
    )


@router.get("/{account_id}/summary", response_model=AccountSummary)
async def get_account_summary(
    account_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await account_service.get_account_summary(
        account_id=account_id, user_id=current_user["user_id"], db=db,
    )


@router.delete("/{account_id}", response_model=MessageResponse)
async def delete_trading_account(
    account_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Permanently remove a live trading account owned by the user (demo accounts are not removable)."""
    return await account_service.delete_trading_account(
        account_id=account_id, user_id=current_user["user_id"], db=db,
    )


@router.patch("/{account_id}/leverage")
async def update_account_leverage(
    account_id: UUID,
    body: dict,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Let the user lower their account leverage (up to the admin-defined group max)."""
    try:
        leverage = int(body.get("leverage"))
    except (TypeError, ValueError):
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="leverage must be a positive integer")
    return await account_service.update_account_leverage(
        account_id=account_id, user_id=current_user["user_id"],
        leverage=leverage, db=db,
    )
