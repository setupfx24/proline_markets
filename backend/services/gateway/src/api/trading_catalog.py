"""Public trading instrument catalog with effective charges (active + enabled only)."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import get_db
from ..services import trading_catalog_service

router = APIRouter(prefix="/trading", tags=["Trading catalog"])


@router.get("/instruments")
async def list_trading_instruments(
    db: AsyncSession = Depends(get_db),
    segment: str | None = Query(None, description="Filter by segment name e.g. forex"),
):
    return await trading_catalog_service.list_trading_instruments(
        segment=segment, db=db,
    )


@router.get("/instruments/{symbol}")
async def get_trading_instrument(symbol: str, db: AsyncSession = Depends(get_db)):
    return await trading_catalog_service.get_trading_instrument(
        symbol=symbol, db=db,
    )
