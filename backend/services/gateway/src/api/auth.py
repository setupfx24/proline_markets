"""Authentication API — Register, Login, 2FA, Password Change, Demo login, Password reset."""
import logging

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import get_db
from packages.common.src.schemas import (
    RegisterRequest, LoginRequest, UserResponse,
    ForgotPasswordRequest, ResetPasswordRequest, MessageResponse, BootstrapSessionRequest,
    VerifyEmailRequest, ResendVerificationRequest,
)
from packages.common.src.auth import get_current_user
from ..services.auth_service import (
    AuthServiceError,
    register_user, login_user, demo_login as _demo_login,
    verify_email as _verify_email, resend_verification as _resend_verification,
    investor_login as _investor_login,
    refresh_token as _refresh_token, bootstrap_session as _bootstrap_session,
    forgot_password as _forgot_password, reset_password as _reset_password,
    setup_2fa as _setup_2fa, verify_2fa as _verify_2fa,
    change_password as _change_password, get_me as _get_me, logout_user,
    client_ip_for_inet,
)

logger = logging.getLogger("auth_api")

router = APIRouter()

# Keep this alias so orders.py (and any other module) that does
#   from .auth import _client_ip_for_inet
# continues to work without changes until orders.py is also refactored.
_client_ip_for_inet = client_ip_for_inet


def _handle(coro):
    """Wrapper is not needed — service raises AuthServiceError which routes catch below."""
    return coro


@router.get("/platform-status")
async def platform_status():
    """Public: returns current platform flags so the frontend can gate UI
    (maintenance banner, register button, etc.). No auth required."""
    from packages.common.src.settings_store import get_bool_setting
    return {
        "maintenance_mode": await get_bool_setting("maintenance_mode", False),
        "allow_new_registrations": await get_bool_setting("allow_new_registrations", True),
        "allow_deposits": await get_bool_setting("allow_deposits", True),
        "allow_withdrawals": await get_bool_setting("allow_withdrawals", True),
    }


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(req: RegisterRequest, request: Request, db: AsyncSession = Depends(get_db)):
    try:
        return await register_user(
            email=req.email, password=req.password,
            first_name=req.first_name, last_name=req.last_name,
            phone=req.phone, country=req.country,
            referral_code=req.referral_code,
            request=request, db=db,
        )
    except AuthServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)


@router.post("/login")
async def login(req: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    try:
        return await login_user(
            email=req.email, password=req.password,
            totp_code=req.totp_code, request=request, db=db,
        )
    except AuthServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)


@router.post("/verify-email")
async def verify_email(req: VerifyEmailRequest, request: Request, db: AsyncSession = Depends(get_db)):
    """Confirm a new account's email with the 6-digit code, then log the user in."""
    try:
        return await _verify_email(email=req.email, code=req.code, request=request, db=db)
    except AuthServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)


@router.post("/resend-verification", response_model=MessageResponse)
async def resend_verification(req: ResendVerificationRequest, db: AsyncSession = Depends(get_db)):
    """Re-send the email-verification code."""
    try:
        return await _resend_verification(email=req.email, db=db)
    except AuthServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)


@router.post("/investor/login")
async def investor_login(req: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    """Read-only investor login (email + password created by an admin)."""
    try:
        return await _investor_login(
            email=req.email, password=req.password, request=request, db=db,
        )
    except AuthServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)


@router.post("/demo-login")
async def demo_login(request: Request, db: AsyncSession = Depends(get_db)):
    try:
        return await _demo_login(request=request, db=db)
    except AuthServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    except Exception as e:
        logger.exception("demo-login failed unexpectedly")
        try:
            await db.rollback()
        except Exception:
            pass
        raise HTTPException(
            status_code=500,
            detail=f"Demo sign-in failed — {type(e).__name__}: {e}",
        )


@router.post("/refresh")
async def auth_refresh(request: Request, db: AsyncSession = Depends(get_db)):
    try:
        return await _refresh_token(request=request, db=db)
    except AuthServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)


@router.post("/bootstrap-session")
async def bootstrap_session(
    req: BootstrapSessionRequest, request: Request, db: AsyncSession = Depends(get_db),
):
    try:
        return await _bootstrap_session(
            access_token=req.access_token, request=request, db=db,
        )
    except AuthServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)


@router.post("/forgot-password", response_model=MessageResponse)
async def forgot_password(req: ForgotPasswordRequest, request: Request, db: AsyncSession = Depends(get_db)):
    try:
        result = await _forgot_password(email=req.email, request=request, db=db)
        return MessageResponse(**result)
    except AuthServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)


@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(req: ResetPasswordRequest, request: Request, db: AsyncSession = Depends(get_db)):
    try:
        result = await _reset_password(token=req.token, new_password=req.new_password, request=request, db=db)
        return MessageResponse(**result)
    except AuthServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    try:
        # Pass the token role so investor (read-only) sessions report role="investor".
        return await _get_me(
            user_id=current_user["user_id"], db=db,
            effective_role=current_user.get("role"),
        )
    except AuthServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)


@router.post("/2fa/setup")
async def setup_2fa(current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    try:
        return await _setup_2fa(user_id=current_user["user_id"], db=db)
    except AuthServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)


@router.post("/2fa/verify")
async def verify_2fa(code: str, current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    try:
        return await _verify_2fa(user_id=current_user["user_id"], code=code, db=db)
    except AuthServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)


@router.post("/password/change")
async def change_password(
    old_password: str, new_password: str,
    current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    try:
        return await _change_password(
            user_id=current_user["user_id"],
            old_password=old_password, new_password=new_password, db=db,
        )
    except AuthServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)


@router.post("/logout")
async def logout(
    request: Request, current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    try:
        return await logout_user(user_id=current_user["user_id"], request=request, db=db)
    except AuthServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
