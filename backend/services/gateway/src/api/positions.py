"""Positions API — View, modify SL/TP, close & partial close (MT5-like)."""
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import get_db
from packages.common.src.schemas import ClosePositionRequest, ModifyPositionRequest
from packages.common.src.auth import get_current_user
from ..services import trading_service

router = APIRouter()


@router.get("/")
async def list_positions(
    account_id: UUID,
    status: str = "open",
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await trading_service.list_positions(
        account_id=account_id, user_id=current_user["user_id"],
        status=status, db=db,
    )


@router.put("/{position_id}")
async def modify_position(
    position_id: UUID,
    req: ModifyPositionRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await trading_service.modify_position(
        position_id=position_id, req=req,
        user_id=current_user["user_id"], db=db,
    )


@router.post("/{position_id}/close")
async def close_position(
    position_id: UUID,
    req: ClosePositionRequest = ClosePositionRequest(),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await trading_service.close_position(
        position_id=position_id, req=req,
        user_id=current_user["user_id"], db=db,
    )
