"""Auth Service — Registration, login, token management, demo user, 2FA, password reset."""
import ipaddress
import logging
import secrets
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from time import monotonic

import pyotp
from fastapi import Request
from fastapi.responses import JSONResponse
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from packages.common.src.config import get_settings
from packages.common.src.models import (
    User, UserSession, TradingAccount, AccountGroup,
    IBProfile, Referral, PasswordResetToken, UserRefreshToken, UserAuditLog,
    InvestorAccess,
)
from packages.common.src.schemas import TokenResponse
from packages.common.src.auth import (
    hash_password, verify_password, create_access_token,
    hash_token, decode_token,
)

logger = logging.getLogger("auth_service")

DEMO_SHARED_EMAIL = "demo@Proline Markets.com"
DEMO_STARTING_BALANCE = Decimal("10000")

_rate_buckets: dict[str, list[float]] = {}


# ─── Exceptions ───────────────────────────────────────────────────────────

class AuthServiceError(Exception):
    def __init__(self, detail: str, status_code: int = 400):
        self.detail = detail
        self.status_code = status_code
        super().__init__(detail)


# ─── Utility: IP parsing ─────────────────────────────────────────────────

def _parse_one_ip(raw: str) -> str | None:
    h = raw.strip()
    if not h:
        return None
    if "," in h:
        h = h.split(",")[0].strip()
    if h.startswith("[") and "]" in h:
        h = h[1 : h.index("]")]
    if "%" in h:
        h = h.split("%", 1)[0]
    try:
        ipaddress.ip_address(h)
        return h
    except ValueError:
        return None


def client_ip_for_inet(request: Request) -> str | None:
    """Return a value PostgreSQL INET accepts, or None."""
    ff = request.headers.get("x-forwarded-for") or request.headers.get("X-Forwarded-For")
    if ff:
        for part in ff.split(","):
            got = _parse_one_ip(part)
            if got:
                return got
    host = request.client.host if request.client else None
    return _parse_one_ip(str(host)) if host else None


# ─── Utility: rate limiting ──────────────────────────────────────────────

def rate_limit_http(request: Request, bucket: str, max_requests: int, window_sec: float) -> None:
    # Rate limiting fully disabled — users hit 429s under normal load even with
    # valid sessions. No-op retained so existing call sites keep compiling.
    _ = (request, bucket, max_requests, window_sec)
    return None


# ─── Utility: cookies ────────────────────────────────────────────────────

def _request_appears_secure(request: Request) -> bool:
    if request.headers.get("x-forwarded-proto", "").lower().startswith("https"):
        return True
    return request.url.scheme == "https"


def _cookie_secure_flag(request: Request) -> bool:
    st = get_settings()
    if st.COOKIE_SECURE is not None:
        return st.COOKIE_SECURE
    return _request_appears_secure(request)


def _cookie_samesite() -> str:
    v = get_settings().COOKIE_SAMESITE.lower().strip()
    if v not in ("lax", "strict", "none"):
        return "strict"
    return v


def attach_auth_cookies(
    response: JSONResponse,
    request: Request,
    *,
    access_token: str,
    access_expires_at: datetime,
    raw_refresh: str,
) -> None:
    st = get_settings()
    secure = _cookie_secure_flag(request)
    ss = _cookie_samesite()
    exp = access_expires_at
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    max_age_access = max(60, int((exp - datetime.now(timezone.utc)).total_seconds()))
    max_age_refresh = max(3600, st.JWT_REFRESH_EXPIRY_DAYS * 86400)
    access_kw: dict = {
        "key": st.ACCESS_TOKEN_COOKIE_NAME,
        "value": access_token,
        "httponly": True,
        "secure": secure,
        "samesite": ss,
        "path": "/",
    }
    if not st.JWT_REFRESH_SESSION_COOKIE:
        access_kw["max_age"] = max_age_access
    response.set_cookie(**access_kw)
    refresh_kw: dict = {
        "key": st.REFRESH_TOKEN_COOKIE_NAME,
        "value": raw_refresh,
        "httponly": True,
        "secure": secure,
        "samesite": ss,
        "path": "/",
    }
    if not st.JWT_REFRESH_SESSION_COOKIE:
        refresh_kw["max_age"] = max_age_refresh
    response.set_cookie(**refresh_kw)


def clear_auth_cookies(response: JSONResponse, request: Request) -> None:
    st = get_settings()
    secure = _cookie_secure_flag(request)
    ss = _cookie_samesite()
    response.delete_cookie(st.ACCESS_TOKEN_COOKIE_NAME, path="/", samesite=ss, secure=secure)
    response.delete_cookie(st.REFRESH_TOKEN_COOKIE_NAME, path="/", samesite=ss, secure=secure)


# ─── Utility: account number ─────────────────────────────────────────────

def generate_account_number() -> str:
    return f"PT{secrets.randbelow(90000000) + 10000000}"


# ─── Core: issue auth response ───────────────────────────────────────────

async def issue_auth_json_response(
    user: User,
    request: Request,
    db: AsyncSession,
    *,
    status_code: int = 200,
    user_audit_action: str | None = None,
    role_override: str | None = None,
    extra_claims: dict | None = None,
) -> JSONResponse:
    """Create user_session + refresh row, commit, return JSON (+ HttpOnly cookies).

    role_override / extra_claims support read-only investor sessions: the token's
    sub is still the account owner (so reads work), but role="investor" and
    acct=<account_id> are stamped so writes are blocked and views are scoped."""
    effective_role = role_override or user.role
    token, expires = create_access_token(str(user.id), effective_role, extra_claims=extra_claims)
    db.add(
        UserSession(
            user_id=user.id,
            token_hash=hash_token(token),
            ip_address=client_ip_for_inet(request),
            user_agent=request.headers.get("user-agent"),
            expires_at=expires,
        )
    )
    st = get_settings()
    raw_refresh = secrets.token_urlsafe(48)
    ref_exp = datetime.now(timezone.utc) + timedelta(days=st.JWT_REFRESH_EXPIRY_DAYS)
    db.add(
        UserRefreshToken(
            user_id=user.id,
            token_hash=hash_token(raw_refresh),
            expires_at=ref_exp,
            revoked=False,
        )
    )
    if user_audit_action:
        ua = (request.headers.get("user-agent") or "").strip()
        db.add(
            UserAuditLog(
                user_id=user.id,
                action_type=user_audit_action,
                ip_address=client_ip_for_inet(request),
                device_info=ua[:2048] if ua else None,
            )
        )
    await db.commit()
    display_token = token if st.JWT_INCLUDE_LEGACY_JSON_TOKEN else ""
    body = TokenResponse(
        access_token=display_token,
        user_id=str(user.id),
        role=effective_role,
        expires_at=expires,
    )
    resp = JSONResponse(content=body.model_dump(mode="json"), status_code=status_code)
    attach_auth_cookies(
        resp, request,
        access_token=token,
        access_expires_at=expires,
        raw_refresh=raw_refresh,
    )
    return resp


# ─── Registration ─────────────────────────────────────────────────────────

async def register_user(
    email: str,
    password: str,
    first_name: str,
    last_name: str,
    phone: str | None,
    country: str | None,
    referral_code: str | None,
    request: Request,
    db: AsyncSession,
) -> JSONResponse:
    from packages.common.src.settings_store import get_bool_setting

    rate_limit_http(request, "register", 15, 3600.0)
    if await get_bool_setting("maintenance_mode", False):
        raise AuthServiceError(
            "Platform is under maintenance. Registrations are temporarily disabled.", 503
        )
    if not await get_bool_setting("allow_new_registrations", True):
        raise AuthServiceError("New registrations are currently disabled", 403)

    existing = await db.execute(select(User).where(User.email == email))
    if existing.scalar_one_or_none():
        raise AuthServiceError("Email already registered")

    user = User(
        email=email,
        password_hash=hash_password(password),
        first_name=first_name,
        last_name=last_name,
        phone=phone,
        country=country,
        role="user",
        status="active",
        kyc_status="pending",
    )
    db.add(user)
    await db.flush()

    if referral_code:
        ib_q = await db.execute(
            select(IBProfile).where(IBProfile.referral_code == referral_code, IBProfile.is_active == True)
        )
        ib_profile = ib_q.scalar_one_or_none()
        if ib_profile:
            db.add(Referral(referrer_id=ib_profile.user_id, referred_id=user.id, ib_profile_id=ib_profile.id))

    return await issue_auth_json_response(user, request, db, status_code=201, user_audit_action="REGISTER")


# ─── Login ────────────────────────────────────────────────────────────────

async def login_user(
    email: str,
    password: str,
    totp_code: str | None,
    request: Request,
    db: AsyncSession,
) -> JSONResponse:
    rate_limit_http(request, "login", 40, 60.0)
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(password, user.password_hash):
        raise AuthServiceError("Invalid credentials", 401)

    if user.status == "banned":
        raise AuthServiceError("Account has been banned", 403)
    if user.status == "blocked":
        raise AuthServiceError("Account has been blocked", 403)

    # Maintenance mode: only admin / super_admin / employee roles may log in.
    if user.role not in ("admin", "super_admin", "employee"):
        from packages.common.src.settings_store import get_bool_setting
        if await get_bool_setting("maintenance_mode", False):
            raise AuthServiceError(
                "Platform is under maintenance. Please try again later.", 503
            )

    if user.two_factor_enabled:
        secret = (user.two_factor_secret or "").strip()
        if not secret:
            raise AuthServiceError(
                "Two-factor authentication is misconfigured for this account. Contact support.", 403
            )
        if not totp_code:
            raise AuthServiceError("2FA code required")
        totp = pyotp.TOTP(secret)
        if not totp.verify(totp_code):
            raise AuthServiceError("Invalid 2FA code", 401)

    return await issue_auth_json_response(user, request, db, user_audit_action="LOGIN")


# ─── Investor (read-only) login ───────────────────────────────────────────

async def investor_login(
    email: str,
    password: str,
    request: Request,
    db: AsyncSession,
) -> JSONResponse:
    """Log in a read-only investor credential (created by an admin, tied to one
    account). Issues a normal session but with sub=<account owner>, role=investor,
    acct=<account_id> so reads are scoped to that account and writes are blocked."""
    rate_limit_http(request, "investor_login", 40, 60.0)
    result = await db.execute(select(InvestorAccess).where(InvestorAccess.email == email))
    inv = result.scalar_one_or_none()
    if not inv or not inv.is_active or not verify_password(password, inv.password_hash):
        raise AuthServiceError("Invalid credentials", 401)

    acc_res = await db.execute(select(TradingAccount).where(TradingAccount.id == inv.account_id))
    account = acc_res.scalar_one_or_none()
    if not account or not account.is_active:
        raise AuthServiceError("This investor login's account is unavailable", 403)

    owner_res = await db.execute(select(User).where(User.id == account.user_id))
    owner = owner_res.scalar_one_or_none()
    if not owner:
        raise AuthServiceError("Account owner not found", 404)
    if owner.status in ("banned", "blocked"):
        raise AuthServiceError("Account is not available", 403)

    inv.last_login_at = datetime.now(timezone.utc)
    return await issue_auth_json_response(
        owner, request, db,
        user_audit_action="INVESTOR_LOGIN",
        role_override="investor",
        extra_claims={"acct": str(account.id)},
    )


# ─── Demo login ───────────────────────────────────────────────────────────

async def _ensure_shared_demo_user(db: AsyncSession) -> User:
    from packages.common.src.settings_store import get_int_setting

    result = await db.execute(select(User).where(User.email == DEMO_SHARED_EMAIL))
    existing = result.scalar_one_or_none()
    if existing:
        if not existing.is_demo:
            raise AuthServiceError("This email is reserved for the platform demo account", 403)
        return existing

    default_leverage = await get_int_setting("default_leverage", 100)
    demo_password = secrets.token_urlsafe(32)
    user = User(
        email=DEMO_SHARED_EMAIL,
        password_hash=hash_password(demo_password),
        first_name="Demo", last_name="Trader",
        role="user", status="active", kyc_status="pending",
        is_demo=True, two_factor_enabled=False, two_factor_secret=None,
    )
    db.add(user)
    await db.flush()

    default_group = await db.execute(
        select(AccountGroup).where(AccountGroup.name == "Standard", AccountGroup.is_demo == False).limit(1)
    )
    group = default_group.scalars().first()
    db.add(TradingAccount(
        user_id=user.id, account_group_id=group.id if group else None,
        account_number=generate_account_number(), leverage=default_leverage, currency="USD", is_demo=False,
    ))

    demo_group = await db.execute(select(AccountGroup).where(AccountGroup.name == "Demo").limit(1))
    dg = demo_group.scalars().first()
    db.add(TradingAccount(
        user_id=user.id, account_group_id=dg.id if dg else None,
        account_number=generate_account_number(),
        balance=DEMO_STARTING_BALANCE, equity=DEMO_STARTING_BALANCE, free_margin=DEMO_STARTING_BALANCE,
        leverage=100, currency="USD", is_demo=True,
    ))
    await db.flush()
    return user


async def _ensure_demo_trading_account(db: AsyncSession, user: User) -> None:
    # NOTE: admin can provision multiple demo accounts for a user, so this
    # existence check MUST tolerate multiple rows — use .first(), not
    # scalar_one_or_none() which raises MultipleResultsFound on 2+ matches.
    q = await db.execute(
        select(TradingAccount.id)
        .where(TradingAccount.user_id == user.id, TradingAccount.is_demo == True)
        .limit(1)
    )
    if q.scalars().first() is not None:
        return
    demo_group = await db.execute(select(AccountGroup).where(AccountGroup.name == "Demo").limit(1))
    dg = demo_group.scalars().first()
    db.add(TradingAccount(
        user_id=user.id, account_group_id=dg.id if dg else None,
        account_number=generate_account_number(),
        balance=DEMO_STARTING_BALANCE, equity=DEMO_STARTING_BALANCE, free_margin=DEMO_STARTING_BALANCE,
        leverage=100, currency="USD", is_demo=True,
    ))
    await db.flush()


async def demo_login(request: Request, db: AsyncSession) -> JSONResponse:
    rate_limit_http(request, "demo-login", 30, 60.0)
    user = await _ensure_shared_demo_user(db)
    await _ensure_demo_trading_account(db, user)
    if user.status == "banned":
        raise AuthServiceError("Account has been banned", 403)
    if user.status == "blocked":
        raise AuthServiceError("Account has been blocked", 403)
    return await issue_auth_json_response(user, request, db, user_audit_action="LOGIN")


# ─── Token refresh ────────────────────────────────────────────────────────

async def refresh_token(request: Request, db: AsyncSession) -> JSONResponse:
    rate_limit_http(request, "auth-refresh", 60, 60.0)
    st = get_settings()
    raw = request.cookies.get(st.REFRESH_TOKEN_COOKIE_NAME)
    if not raw or not raw.strip():
        raise AuthServiceError("Not authenticated", 401)
    th = hash_token(raw.strip())
    now = datetime.now(timezone.utc)
    q = await db.execute(
        select(UserRefreshToken).where(
            UserRefreshToken.token_hash == th,
            UserRefreshToken.revoked.is_(False),
            UserRefreshToken.expires_at > now,
        )
    )
    row = q.scalar_one_or_none()
    if not row:
        raise AuthServiceError("Invalid or expired session", 401)
    user = await db.get(User, row.user_id)
    if not user or user.status in ("banned", "blocked"):
        raise AuthServiceError("Not authenticated", 401)
    row.revoked = True
    await db.flush()
    return await issue_auth_json_response(user, request, db)


# ─── Bootstrap session ────────────────────────────────────────────────────

async def bootstrap_session(access_token: str, request: Request, db: AsyncSession) -> JSONResponse:
    rate_limit_http(request, "bootstrap-session", 30, 3600.0)
    try:
        payload = decode_token(access_token.strip())
    except Exception:
        raise AuthServiceError("Invalid token", 401)
    try:
        uid = UUID(str(payload["sub"]))
    except (KeyError, ValueError, TypeError):
        raise AuthServiceError("Invalid token", 401)
    user = await db.get(User, uid)
    if not user:
        raise AuthServiceError("Invalid token", 401)
    if user.status == "banned":
        raise AuthServiceError("Account has been banned", 403)
    if user.status == "blocked":
        raise AuthServiceError("Account has been blocked", 403)
    return await issue_auth_json_response(user, request, db)


# ─── Forgot / Reset password ─────────────────────────────────────────────

async def forgot_password(email: str, request: Request, db: AsyncSession) -> dict:
    rate_limit_http(request, "forgot-password", 5, 600.0)
    msg = {"message": "If an account exists for this email, you will receive password reset instructions shortly."}
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user or user.status in ("banned", "blocked"):
        return msg

    raw = secrets.token_urlsafe(32)
    token_hash = hash_token(raw)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)
    db.add(PasswordResetToken(user_id=user.id, token_hash=token_hash, expires_at=expires_at, used=False))
    await db.commit()

    settings = get_settings()
    base = settings.TRADER_APP_URL.rstrip("/")
    link = f"{base}/auth/reset-password?token={raw}"

    from packages.common.src.smtp_mail import send_password_reset_email, smtp_configured
    if smtp_configured():
        sent = await send_password_reset_email(user.email, link)
        if sent:
            logger.info("Password reset email sent to %s", user.email)
        else:
            logger.error("Password reset email failed for %s", user.email)
    elif settings.ENVIRONMENT == "development":
        logger.warning("Password reset link (dev, SMTP not configured): %s", link)
    else:
        logger.warning("SMTP not configured — no email sent for %s", user.email)

    return msg


async def reset_password(token: str, new_password: str, request: Request, db: AsyncSession) -> dict:
    rate_limit_http(request, "reset-password", 20, 600.0)
    token_hash = hash_token(token.strip())
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(PasswordResetToken).where(
            PasswordResetToken.token_hash == token_hash,
            PasswordResetToken.used.is_(False),
            PasswordResetToken.expires_at > now,
        )
    )
    row = result.scalar_one_or_none()
    if not row:
        raise AuthServiceError("Invalid or expired reset link")
    user = await db.get(User, row.user_id)
    if not user:
        raise AuthServiceError("Invalid or expired reset link")
    user.password_hash = hash_password(new_password)
    row.used = True
    await db.commit()
    return {"message": "Password has been reset. You can sign in now."}


# ─── 2FA ──────────────────────────────────────────────────────────────────

async def setup_2fa(user_id: UUID, db: AsyncSession) -> dict:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    secret = pyotp.random_base32()
    totp = pyotp.TOTP(secret)
    provisioning_uri = totp.provisioning_uri(name=user.email, issuer_name="Proline Markets")
    user.two_factor_secret = secret
    await db.commit()
    return {"secret": secret, "qr_uri": provisioning_uri}


async def verify_2fa(user_id: UUID, code: str, db: AsyncSession) -> dict:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user.two_factor_secret:
        raise AuthServiceError("2FA not set up")
    totp = pyotp.TOTP(user.two_factor_secret)
    if not totp.verify(code):
        raise AuthServiceError("Invalid code", 401)
    user.two_factor_enabled = True
    await db.commit()
    return {"message": "2FA enabled successfully"}


# ─── Password change ─────────────────────────────────────────────────────

async def change_password(user_id: UUID, old_password: str, new_password: str, db: AsyncSession) -> dict:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not verify_password(old_password, user.password_hash):
        raise AuthServiceError("Current password is incorrect")
    user.password_hash = hash_password(new_password)
    await db.commit()
    return {"message": "Password changed successfully"}


# ─── Get current user profile ─────────────────────────────────────────────

async def get_me(user_id: UUID, db: AsyncSession, effective_role: str | None = None) -> User:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise AuthServiceError("User not found", 404)
    # For investor (read-only) sessions the JWT role differs from the DB user's
    # role. Reflect the token role so the frontend can gate the UI. Detach first
    # so this in-memory change is never accidentally flushed to the DB.
    if effective_role and effective_role != user.role:
        db.expunge(user)
        user.role = effective_role
    return user


# ─── Logout ───────────────────────────────────────────────────────────────

async def logout_user(user_id: UUID, request: Request, db: AsyncSession) -> JSONResponse:
    ua = (request.headers.get("user-agent") or "").strip()
    db.add(UserAuditLog(
        user_id=user_id, action_type="LOGOUT",
        ip_address=client_ip_for_inet(request),
        device_info=ua[:2048] if ua else None,
    ))
    await db.execute(
        update(UserRefreshToken).where(
            UserRefreshToken.user_id == user_id,
            UserRefreshToken.revoked.is_(False),
        ).values(revoked=True)
    )
    result = await db.execute(
        select(UserSession).where(UserSession.user_id == user_id, UserSession.is_active == True)
    )
    for s in result.scalars().all():
        s.is_active = False
    await db.commit()

    resp = JSONResponse(content={"message": "Logged out"})
    clear_auth_cookies(resp, request)
    return resp
