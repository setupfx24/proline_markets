"""Orders API — Place, modify, cancel orders. MT5-like execution."""
from uuid import UUID

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import get_db
from packages.common.src.schemas import PlaceOrderRequest, ModifyOrderRequest
from packages.common.src.auth import get_current_user, forbid_investor, assert_investor_can_view
from ..services.auth_service import client_ip_for_inet
from ..services import trading_service

router = APIRouter()


@router.post("/", status_code=201)
async def place_order(
    req: PlaceOrderRequest,
    request: Request,
    current_user: dict = Depends(forbid_investor),
    db: AsyncSession = Depends(get_db),
):
    return await trading_service.place_order(
        req=req, request=request,
        user_id=current_user["user_id"],
        ip_address=client_ip_for_inet(request),
        db=db,
    )


@router.get("/")
async def list_orders(
    account_id: UUID,
    status: str | None = None,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    assert_investor_can_view(current_user, account_id)
    return await trading_service.list_orders(
        account_id=account_id, user_id=current_user["user_id"],
        status=status, db=db,
    )


@router.put("/{order_id}")
async def modify_order(
    order_id: UUID,
    req: ModifyOrderRequest,
    current_user: dict = Depends(forbid_investor),
    db: AsyncSession = Depends(get_db),
):
    return await trading_service.modify_order(
        order_id=order_id, req=req, user_id=current_user["user_id"], db=db,
    )


@router.delete("/{order_id}")
async def cancel_order(
    order_id: UUID,
    current_user: dict = Depends(forbid_investor),
    db: AsyncSession = Depends(get_db),
):
    return await trading_service.cancel_order(
        order_id=order_id, user_id=current_user["user_id"], db=db,
    )
