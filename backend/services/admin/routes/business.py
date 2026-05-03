import uuid

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import get_db
from dependencies import require_permission
from packages.common.src.models import User
from packages.common.src.admin_schemas import (
    MLMConfigIn, UpdateIBCommissionIn, RejectIBIn, IBCommissionPlanIn,
)
from services import business_service

router = APIRouter(prefix="/business", tags=["Business"])


@router.get("/ib/applications")
async def list_ib_applications(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    status_filter: str = Query(None, alias="status"),
    admin: User = Depends(require_permission("ib.view")),
    db: AsyncSession = Depends(get_db),
):
    return await business_service.list_ib_applications(
        page=page, per_page=per_page, status_filter=status_filter, db=db,
    )


@router.post("/ib/applications/{app_id}/approve")
async def approve_ib_application(
    app_id: uuid.UUID,
    request: Request,
    admin: User = Depends(require_permission("ib.manage")),
    db: AsyncSession = Depends(get_db),
):
    return await business_service.approve_ib_application(
        app_id=app_id, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.post("/ib/applications/{app_id}/reject")
async def reject_ib_application(
    app_id: uuid.UUID,
    request: Request,
    admin: User = Depends(require_permission("ib.manage")),
    db: AsyncSession = Depends(get_db),
):
    return await business_service.reject_ib_application(
        app_id=app_id, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.get("/ib/agents")
async def list_ib_agents(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    admin: User = Depends(require_permission("ib.view")),
    db: AsyncSession = Depends(get_db),
):
    return await business_service.list_ib_agents(page=page, per_page=per_page, db=db)


@router.put("/ib/agents/{agent_id}/commission")
async def update_ib_commission(
    agent_id: uuid.UUID,
    body: UpdateIBCommissionIn,
    request: Request,
    admin: User = Depends(require_permission("ib.manage")),
    db: AsyncSession = Depends(get_db),
):
    return await business_service.update_ib_commission(
        agent_id=agent_id, body=body, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.post("/ib/agents/{agent_id}/reject")
async def reject_active_ib(
    agent_id: uuid.UUID,
    body: RejectIBIn,
    request: Request,
    admin: User = Depends(require_permission("ib.manage")),
    db: AsyncSession = Depends(get_db),
):
    return await business_service.reject_active_ib(
        agent_id=agent_id, body=body, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.get("/ib/commission-plans")
async def list_commission_plans(
    admin: User = Depends(require_permission("ib.view")),
    db: AsyncSession = Depends(get_db),
):
    return await business_service.list_commission_plans(db=db)


@router.post("/ib/commission-plans")
async def create_commission_plan(
    body: IBCommissionPlanIn,
    request: Request,
    admin: User = Depends(require_permission("ib.manage")),
    db: AsyncSession = Depends(get_db),
):
    return await business_service.create_commission_plan(
        body=body, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.put("/ib/commission-plans/{plan_id}")
async def update_commission_plan(
    plan_id: uuid.UUID,
    body: IBCommissionPlanIn,
    request: Request,
    admin: User = Depends(require_permission("ib.manage")),
    db: AsyncSession = Depends(get_db),
):
    return await business_service.update_commission_plan(
        plan_id=plan_id, body=body, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.delete("/ib/commission-plans/{plan_id}")
async def delete_commission_plan(
    plan_id: uuid.UUID,
    request: Request,
    admin: User = Depends(require_permission("ib.manage")),
    db: AsyncSession = Depends(get_db),
):
    return await business_service.delete_commission_plan(
        plan_id=plan_id, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.get("/mlm/config")
async def get_mlm_config(
    admin: User = Depends(require_permission("ib.view")),
    db: AsyncSession = Depends(get_db),
):
    return await business_service.get_mlm_config(db=db)


@router.put("/mlm/config")
async def update_mlm_config(
    body: MLMConfigIn,
    request: Request,
    admin: User = Depends(require_permission("ib.manage")),
    db: AsyncSession = Depends(get_db),
):
    return await business_service.update_mlm_config(
        body=body, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


# ─── IB Hierarchy Management ──────────────────────────────────────────────

from pydantic import BaseModel as _BM

class _SetParentBody(_BM):
    parent_ib_id: str | None = None

class _MoveUserBody(_BM):
    new_ib_id: str


@router.get("/ib/tree")
async def get_ib_tree(
    ib_id: str | None = Query(None),
    admin: User = Depends(require_permission("ib.view")),
    db: AsyncSession = Depends(get_db),
):
    _id = uuid.UUID(ib_id) if ib_id else None
    return await business_service.get_ib_tree(ib_id=_id, db=db)


@router.get("/ib/users/unassigned")
async def get_unassigned_users(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    admin: User = Depends(require_permission("ib.view")),
    db: AsyncSession = Depends(get_db),
):
    return await business_service.get_unassigned_users(page=page, per_page=per_page, db=db)


@router.get("/ib/agents/{agent_id}/referrals")
async def get_ib_referrals(
    agent_id: uuid.UUID,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    admin: User = Depends(require_permission("ib.view")),
    db: AsyncSession = Depends(get_db),
):
    return await business_service.get_ib_referrals(ib_id=agent_id, page=page, per_page=per_page, db=db)


@router.put("/ib/agents/{agent_id}/parent")
async def set_parent_ib(
    agent_id: uuid.UUID,
    body: _SetParentBody,
    request: Request,
    admin: User = Depends(require_permission("ib.manage")),
    db: AsyncSession = Depends(get_db),
):
    parent_id = uuid.UUID(body.parent_ib_id) if body.parent_ib_id else None
    return await business_service.set_parent_ib(
        ib_id=agent_id, parent_ib_id=parent_id, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.put("/ib/users/{user_id}/move")
async def move_user_to_ib(
    user_id: uuid.UUID,
    body: _MoveUserBody,
    request: Request,
    admin: User = Depends(require_permission("ib.manage")),
    db: AsyncSession = Depends(get_db),
):
    return await business_service.move_user_to_ib(
        user_id=user_id, new_ib_id=uuid.UUID(body.new_ib_id), admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


# ─── Sub-Broker ───────────────────────────────────────────────────────────

@router.get("/sub-broker/applications")
async def list_sub_broker_applications(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    status_filter: str = Query(None, alias="status"),
    admin: User = Depends(require_permission("ib.view")),
    db: AsyncSession = Depends(get_db),
):
    return await business_service.list_sub_broker_applications(
        page=page, per_page=per_page, status_filter=status_filter, db=db,
    )


@router.post("/sub-broker/applications/{app_id}/approve")
async def approve_sub_broker(
    app_id: uuid.UUID,
    request: Request,
    admin: User = Depends(require_permission("ib.manage")),
    db: AsyncSession = Depends(get_db),
):
    return await business_service.approve_sub_broker(
        app_id=app_id, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.post("/sub-broker/applications/{app_id}/reject")
async def reject_sub_broker(
    app_id: uuid.UUID,
    request: Request,
    admin: User = Depends(require_permission("ib.manage")),
    db: AsyncSession = Depends(get_db),
):
    return await business_service.reject_sub_broker(
        app_id=app_id, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.get("/sub-broker/agents")
async def list_sub_brokers(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    admin: User = Depends(require_permission("ib.view")),
    db: AsyncSession = Depends(get_db),
):
    return await business_service.list_sub_brokers(page=page, per_page=per_page, db=db)


# ─── Copy-Trade Master Management ──────────────────────────────

@router.get("/masters")
async def list_masters(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    admin: User = Depends(require_permission("ib.view")),
    db: AsyncSession = Depends(get_db),
):
    """List all copy-trade masters (signal_provider, pamm, mamm)."""
    return await business_service.list_masters(page=page, per_page=per_page, db=db)


@router.delete("/masters/{master_id}")
async def delete_master(
    master_id: uuid.UUID,
    request: Request,
    admin: User = Depends(require_permission("ib.manage")),
    db: AsyncSession = Depends(get_db),
):
    """Delete a copy-trade master. Closes all open copy positions, refunds
    allocation amounts to each follower's main wallet, and sweeps the master's
    trading account balance back to the master user's main wallet."""
    return await business_service.delete_master(
        master_id=master_id, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )
