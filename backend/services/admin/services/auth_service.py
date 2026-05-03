"""Admin Auth Service — login, refresh, me."""
import logging
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.exc import DBAPIError, OperationalError
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.auth import verify_password
from packages.common.src.config import get_settings
from packages.common.src.models import User, Employee
from packages.common.src.admin_schemas import AdminLoginRequest, AdminLoginResponse, AdminRefreshRequest
from dependencies import EMPLOYEE_ROLE_PERMISSIONS

logger = logging.getLogger("uvicorn.error")
settings = get_settings()


def create_admin_token(admin_id: str, role: str) -> str:
    now = datetime.now(timezone.utc)
    expire = now + timedelta(hours=settings.ADMIN_JWT_EXPIRY_HOURS)
    payload = {
        "admin_id": admin_id,
        "role": str(role),
        "type": "admin",
        "exp": expire,
        "iat": now,
    }
    try:
        return jwt.encode(payload, settings.ADMIN_JWT_SECRET, algorithm=settings.ADMIN_JWT_ALGORITHM)
    except jwt.PyJWTError as e:
        logger.error("Admin JWT encode failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Server configuration error (JWT)",
        ) from e


async def admin_login(body: AdminLoginRequest, db: AsyncSession) -> AdminLoginResponse:
    email_norm = (body.email or "").strip().lower()
    if not email_norm:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    try:
        result = await db.execute(
            select(User).where(
                func.lower(User.email) == email_norm,
                User.role.in_(["admin", "super_admin"]),
            )
        )
    except (OperationalError, DBAPIError) as e:
        logger.exception("Database error on admin login")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database unavailable",
        ) from e

    admin = result.scalar_one_or_none()

    if admin is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    password_ok = verify_password(body.password, admin.password_hash)
    if not password_ok:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if admin.status != "active":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is not active")

    token = create_admin_token(str(admin.id), admin.role)

    return AdminLoginResponse(
        access_token=token,
        admin_id=str(admin.id),
        role=admin.role,
        first_name=admin.first_name,
        last_name=admin.last_name,
    )


async def admin_refresh(body: AdminRefreshRequest, db: AsyncSession) -> AdminLoginResponse:
    try:
        payload = jwt.decode(
            body.access_token,
            settings.ADMIN_JWT_SECRET,
            algorithms=[settings.ADMIN_JWT_ALGORITHM],
            options={"verify_exp": False},
        )
        if payload.get("type") != "admin":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")

        admin_id = payload.get("admin_id")
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    result = await db.execute(
        select(User).where(
            User.id == admin_id,
            User.role.in_(["admin", "super_admin"]),
            User.status == "active",
        )
    )
    admin = result.scalar_one_or_none()
    if admin is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Admin not found")

    token = create_admin_token(str(admin.id), admin.role)
    return AdminLoginResponse(
        access_token=token,
        admin_id=str(admin.id),
        role=admin.role,
        first_name=admin.first_name,
        last_name=admin.last_name,
    )


async def change_admin_password(admin: User, current_password: str, new_password: str, db: AsyncSession) -> dict:
    if not verify_password(current_password, admin.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")
    if len(new_password) < 8:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="New password must be at least 8 characters")
    from packages.common.src.auth import hash_password
    admin.password_hash = hash_password(new_password)
    await db.commit()
    return {"message": "Password changed successfully"}


async def get_admin_me(admin: User, db: AsyncSession) -> dict:
    employee_role = None
    permissions = set()

    if admin.role == "super_admin":
        employee_role = "super_admin"
        permissions = {"*"}
    else:
        emp_q = await db.execute(
            select(Employee).where(Employee.user_id == admin.id, Employee.is_active == True)
        )
        emp = emp_q.scalar_one_or_none()
        if emp:
            employee_role = emp.role
            permissions = EMPLOYEE_ROLE_PERMISSIONS.get(emp.role, set())

    return {
        "id": str(admin.id),
        "email": admin.email,
        "first_name": admin.first_name,
        "last_name": admin.last_name,
        "role": admin.role,
        "employee_role": employee_role,
        "permissions": list(permissions),
    }
