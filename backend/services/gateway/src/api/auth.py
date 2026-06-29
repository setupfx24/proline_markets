"""Authentication API — Register, Login, 2FA, Password Change, Demo login, Password reset."""
import logging

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import get_db
from packages.common.src.schemas import (
    RegisterRequest, LoginRequest, UserResponse,
    ForgotPasswordRequest, ResetPasswordRequest, MessageResponse, BootstrapSessionRequest,
)
from packages.common.src.auth import get_current_user
from ..services.auth_service import (
    AuthServiceError,
    register_user, login_user, demo_login as _demo_login,
    refresh_token as _refresh_token, bootstrap_session as _bootstrap_session,
    forgot_password as _forgot_password, reset_password as _reset_password,
    setup_2fa as _setup_2fa, verify_2fa as _verify_2fa,
    change_password as _change_password, get_me as _get_me, logout_user,
    verify_email as _verify_email,
    verify_email_code as _verify_email_code,
    client_ip_for_inet,
)
from fastapi.responses import HTMLResponse
from pydantic import BaseModel


class VerifyCodeRequest(BaseModel):
    email: str
    code: str
    password: str | None = None


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


@router.get("/verify-email", response_class=HTMLResponse)
async def verify_email_page(token: str, db: AsyncSession = Depends(get_db)):
    ok = False
    try:
        ok = await _verify_email(token=token, db=db)
    except Exception:
        ok = False
    if ok:
        title, color, msg = (
            "Email Verified ✅", "#16a34a",
            "Your email has been verified successfully. You can now log in and use all features.",
        )
    else:
        title, color, msg = (
            "Verification Failed", "#e53935",
            "This verification link is invalid or has expired. Please log in and request a new link.",
        )
    html = f"""<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>{title}</title></head>
<body style="margin:0;background:#eef1f4;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:520px;margin:60px auto;background:#fff;border-radius:14px;border:1px solid #e3e7ec;overflow:hidden;">
    <div style="background:#0b1220;padding:22px;text-align:center;">
      <span style="font-size:21px;font-weight:800;color:#fff;">Proline</span><span style="font-size:21px;font-weight:800;color:#16a34a;">Markets</span>
    </div>
    <div style="height:4px;background:{color};"></div>
    <div style="padding:36px 32px;text-align:center;">
      <h1 style="color:{color};font-size:24px;margin:0 0 12px;">{title}</h1>
      <p style="color:#3a3f47;font-size:15px;line-height:1.6;">{msg}</p>
      <a href="https://prolinemarket.com" style="display:inline-block;margin-top:18px;padding:12px 28px;background:#16a34a;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">Go to Login</a>
    </div>
  </div>
</body></html>"""
    return HTMLResponse(content=html, status_code=200 if ok else 400)


@router.post("/verify-code", response_model=MessageResponse)
async def verify_code(req: VerifyCodeRequest, db: AsyncSession = Depends(get_db)):
    """Validate the 6-digit signup verification code; then email the login details."""
    result = await _verify_email_code(email=req.email, code=req.code, db=db)
    if not result:
        raise HTTPException(status_code=400, detail="Invalid or expired verification code")
    verified_email, first_name = result
    try:
        from packages.common.src.notify import send_welcome_email
        await send_welcome_email(
            verified_email, first_name,
            login_email=verified_email, password=req.password,
        )
    except Exception:
        logger.exception("welcome (details) email failed for %s", verified_email)
    return MessageResponse(message="Email verified successfully")


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    try:
        return await _get_me(user_id=current_user["user_id"], db=db)
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
