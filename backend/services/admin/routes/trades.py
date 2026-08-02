import uuid

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import get_db
from dependencies import require_permission
from packages.common.src.models import User
from packages.common.src.admin_schemas import ModifyPositionRequest, ClosePositionRequest
from services import trade_service

router = APIRouter(prefix="/trades", tags=["Trades"])


_MT5_FILTER_DESC = "MT5 link UUID, or 'any' (mirrored only) / 'none' (native only)"


@router.get("/positions")
async def list_positions(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    status_filter: str = Query("open", alias="status"),
    mt5_link_id: str | None = Query(None, description=_MT5_FILTER_DESC),
    admin: User = Depends(require_permission("trades.view")),
    db: AsyncSession = Depends(get_db),
):
    return await trade_service.list_positions(
        page=page, per_page=per_page, status_filter=status_filter,
        mt5_link_id=mt5_link_id, db=db,
    )


@router.get("/orders")
async def list_orders(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    status_filter: str = Query("pending", alias="status"),
    admin: User = Depends(require_permission("trades.view")),
    db: AsyncSession = Depends(get_db),
):
    return await trade_service.list_orders(
        page=page, per_page=per_page, status_filter=status_filter, db=db,
    )


@router.get("/history")
async def list_trade_history(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    mt5_link_id: str | None = Query(None, description=_MT5_FILTER_DESC),
    admin: User = Depends(require_permission("trades.view")),
    db: AsyncSession = Depends(get_db),
):
    return await trade_service.list_trade_history(
        page=page, per_page=per_page, mt5_link_id=mt5_link_id, db=db,
    )


@router.get("/mt5-accounts")
async def list_mt5_accounts(
    admin: User = Depends(require_permission("trades.view")),
    db: AsyncSession = Depends(get_db),
):
    """Connected MT5 accounts, for the Trades-page filter dropdown."""
    return await trade_service.list_mt5_accounts(db=db)


@router.put("/position/{position_id}/modify")
async def modify_position(
    position_id: uuid.UUID,
    body: ModifyPositionRequest,
    request: Request,
    admin: User = Depends(require_permission("trades.modify")),
    db: AsyncSession = Depends(get_db),
):
    return await trade_service.modify_position(
        position_id=position_id, body=body, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.post("/position/{position_id}/close")
async def close_position(
    position_id: uuid.UUID,
    body: ClosePositionRequest,
    request: Request,
    admin: User = Depends(require_permission("trades.close")),
    db: AsyncSession = Depends(get_db),
):
    return await trade_service.close_position(
        position_id=position_id, body=body, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.get("/instruments")
async def list_instruments(
    search: str = Query(None),
    admin: User = Depends(require_permission("trades.view")),
    db: AsyncSession = Depends(get_db),
):
    return await trade_service.list_instruments(search=search, db=db)


