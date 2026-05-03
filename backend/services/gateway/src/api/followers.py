"""Followers API — Get detailed follower information for masters."""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from packages.common.src.database import get_db
from packages.common.src.auth import get_current_user
from ..services import social_service

router = APIRouter()


@router.get("/my-followers")
async def get_my_followers(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await social_service.get_my_followers(
        user_id=current_user["user_id"], db=db,
    )


@router.get("/provider/{provider_id}")
async def get_provider_followers(
    provider_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Public view of a provider's followers (limited info for privacy)."""
    return await social_service.get_provider_followers(
        provider_id=provider_id, db=db,
    )
