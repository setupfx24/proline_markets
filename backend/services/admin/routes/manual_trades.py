import uuid

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import get_db
from dependencies import require_permission
from packages.common.src.models import User
from packages.common.src.admin_schemas import ManualTradeBatch
from services import manual_trade_service

router = APIRouter(prefix="/manual-trades", tags=["Manual Trades"])


def _ip(request: Request) -> str | None:
    return request.client.host if request.client else None


@router.get("/clients")
async def list_clients(
    admin: User = Depends(require_permission("manual_trades.view")),
    db: AsyncSession = Depends(get_db),
):
    """Every client that has a trading account — fills the admin's client picker."""
    return await manual_trade_service.list_clients(db=db)


@router.get("/lookup")
async def lookup_client(
    email: str = Query(..., description="Client login email"),
    admin: User = Depends(require_permission("manual_trades.view")),
    db: AsyncSession = Depends(get_db),
):
    """Find the client by email and list the accounts trades can be booked on."""
    return await manual_trade_service.lookup(email=email, db=db)


@router.get("/instruments/live")
async def list_live_instruments(
    admin: User = Depends(require_permission("manual_trades.view")),
    db: AsyncSession = Depends(get_db),
):
    """Tradable instruments grouped by segment, each with its live feed price."""
    return await manual_trade_service.live_instruments(db=db)


@router.get("/account/{account_id}")
async def list_booked_trades(
    account_id: uuid.UUID,
    admin: User = Depends(require_permission("manual_trades.view")),
    db: AsyncSession = Depends(get_db),
):
    """Trades previously booked on this account by this tool."""
    return await manual_trade_service.list_booked(account_id=account_id, db=db)


@router.post("/preview")
async def preview_manual_trades(
    body: ManualTradeBatch,
    admin: User = Depends(require_permission("manual_trades.create")),
    db: AsyncSession = Depends(get_db),
):
    """Resolve the batch and show total P&L and the resulting balance — no write."""
    return await manual_trade_service.preview(body=body, db=db)


@router.post("/apply")
async def apply_manual_trades(
    body: ManualTradeBatch,
    request: Request,
    admin: User = Depends(require_permission("manual_trades.create")),
    db: AsyncSession = Depends(get_db),
):
    """Book the batch onto the client's account as closed trades."""
    return await manual_trade_service.apply(
        body=body, admin_id=admin.id, ip_address=_ip(request), db=db,
    )


@router.delete("/{position_id}")
async def delete_manual_trade(
    position_id: uuid.UUID,
    request: Request,
    admin: User = Depends(require_permission("manual_trades.create")),
    db: AsyncSession = Depends(get_db),
):
    """Reverse a booked trade (removes its rows and undoes its balance effect)."""
    return await manual_trade_service.delete_booked(
        position_id=position_id, admin_id=admin.id, ip_address=_ip(request), db=db,
    )
