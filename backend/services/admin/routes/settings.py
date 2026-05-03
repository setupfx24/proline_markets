from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import get_db
from dependencies import get_current_admin
from packages.common.src.models import User
from packages.common.src.admin_schemas import SystemSettingUpdate
from services import settings_service

router = APIRouter(prefix="/settings", tags=["Settings"])


@router.get("")
async def list_settings(
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    return await settings_service.list_settings(db=db)


@router.put("")
async def update_settings(
    body: SystemSettingUpdate,
    request: Request,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    return await settings_service.update_settings(
        body=body,
        admin_id=admin.id,
        ip_address=request.client.host if request.client else None,
        db=db,
    )
