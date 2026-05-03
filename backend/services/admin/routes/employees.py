import uuid

from fastapi import APIRouter, Body, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import get_db
from dependencies import get_current_admin, EMPLOYEE_ROLE_PERMISSIONS
from packages.common.src.models import User
from packages.common.src.admin_schemas import EmployeeIn, EmployeeUpdate
from services import employee_service

router = APIRouter(prefix="/employees", tags=["Employees"])


# Static catalog of permissions the admin UI renders as checkboxes. Keep in sync
# with require_permission() call sites across the admin backend.
PERMISSION_CATALOG = {
    "Users":       ["users.view", "users.add_fund", "users.deduct_fund", "users.ban", "users.block_trading", "users.kill_switch"],
    "KYC":         ["kyc.view", "kyc.manage"],
    "Deposits":    ["deposits.view", "deposits.approve", "deposits.reject"],
    "Withdrawals": ["withdrawals.view", "withdrawals.approve", "withdrawals.reject"],
    "Trading":     ["trades.view", "trades.modify", "trades.close", "trades.create", "positions.view", "orders.view"],
    "Social":      ["social.view", "social.manage"],
    "Banks":       ["banks.view", "banks.create", "banks.update"],
    "IB":          ["ib.view", "ib.manage"],
    "Marketing":   ["banners.view", "banners.create", "banners.update", "banners.delete", "bonus.view", "bonus.create", "bonus.update"],
    "Support":     ["tickets.view", "tickets.reply", "tickets.assign"],
    "Analytics":   ["analytics.view", "exposure.view"],
    "Audit":       ["audit_logs.view"],
}


@router.get("")
async def list_employees(
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    return await employee_service.list_employees(db=db)


@router.post("")
async def create_employee(
    body: EmployeeIn,
    request: Request,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    return await employee_service.create_employee(
        body=body, admin=admin,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.put("/{employee_id}")
async def update_employee(
    employee_id: uuid.UUID,
    body: EmployeeUpdate,
    request: Request,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    return await employee_service.update_employee(
        employee_id=employee_id, body=body, admin=admin,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.delete("/{employee_id}")
async def delete_employee(
    employee_id: uuid.UUID,
    request: Request,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    return await employee_service.delete_employee(
        employee_id=employee_id, admin=admin,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.get("/{employee_id}/activity")
async def get_employee_activity(
    employee_id: uuid.UUID,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    return await employee_service.get_employee_activity(
        employee_id=employee_id, page=page, per_page=per_page, db=db,
    )


@router.get("/permissions/catalog")
async def list_permission_catalog(admin: User = Depends(get_current_admin)):
    """Return the full permission catalog + role defaults for the admin UI."""
    return {
        "catalog": PERMISSION_CATALOG,
        "role_defaults": {role: sorted(perms) for role, perms in EMPLOYEE_ROLE_PERMISSIONS.items()},
    }


@router.get("/{employee_id}/permissions")
async def get_employee_permissions(
    employee_id: uuid.UUID,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    return await employee_service.get_employee_permissions(employee_id=employee_id, db=db)


@router.put("/{employee_id}/permissions")
async def update_employee_permissions(
    employee_id: uuid.UUID,
    request: Request,
    body: dict = Body(...),
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    perms = body.get("extra_permissions") or []
    if not isinstance(perms, list):
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="extra_permissions must be a list of strings")
    return await employee_service.update_employee_permissions(
        employee_id=employee_id, extra_permissions=perms, admin=admin,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.post("/{employee_id}/login-as")
async def login_as_employee(
    employee_id: uuid.UUID,
    request: Request,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    return await employee_service.login_as_employee(
        employee_id=employee_id, admin=admin,
        ip_address=request.client.host if request.client else None, db=db,
    )
