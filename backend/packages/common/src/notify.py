"""Notification helper — in-app + email notifications.

In-app: writes to DB + publishes via Redis pub/sub.
Email:  sends via SMTP (aiosmtplib) when SMTP_HOST is configured.
"""
import json
import logging
import uuid
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from .models import Notification
from .redis_client import redis_client

logger = logging.getLogger("notify")

TYPES = {
    "trade": "trade",
    "sl_hit": "trade",
    "tp_hit": "trade",
    "order": "trade",
    "deposit": "wallet",
    "withdrawal": "wallet",
    "admin_fund": "wallet",
    "login": "security",
    "system": "system",
}


# ============================================
# In-App Notification (DB + Redis)
# ============================================

async def create_notification(
    db: AsyncSession,
    user_id: UUID,
    title: str,
    message: str,
    notif_type: str = "info",
    action_url: str | None = None,
    commit: bool = True,
    email: bool = False,
):
    n = Notification(
        user_id=user_id,
        title=title,
        message=message,
        type=notif_type,
        action_url=action_url,
    )
    db.add(n)
    if commit:
        await db.flush()

    try:
        await redis_client.publish(f"notifications:{user_id}", json.dumps({
            "type": "notification",
            "id": str(n.id),
            "title": title,
            "message": message,
            "notif_type": notif_type,
        }))
    except Exception:
        pass

    # Optionally also email the user the same title/message. Used for important,
    # low-frequency events (KYC, deposits, account opened) — never trade fills.
    if email:
        try:
            from sqlalchemy import select
            from .models import User
            res = await db.execute(select(User.email).where(User.id == user_id))
            addr = res.scalar_one_or_none()
            if addr:
                html = brand_email(title, (
                    f'<p style="margin:0 0 14px;font-size:15px;color:#374151;line-height:1.65;">{message}</p>'
                    '<p style="margin:0;"><a href="https://prolinemarket.com/auth/login" '
                    'style="display:inline-block;padding:12px 26px;background:#16a34a;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:700;font-size:14px;">Log in to your profile</a></p>'
                ))
                await send_email(addr, f"Proline Markets — {title}", html, message)
        except Exception:
            logger.exception("notification email failed for user %s", user_id)

    return n


# ============================================
# Email Notifications (SMTP via aiosmtplib)
# ============================================

# Hosted logo URL — referenced (not attached) so it renders inline in the body
# without showing up as a downloadable attachment. ?v bumps bust proxy caches.
BRAND_LOGO_URL = "https://prolinemarket.com/images/logo1.png?v=3"


SUPPORT_EMAIL = "info@prolinemarket.com"
FONT_STACK = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"


def brand_email(heading: str, inner_html: str) -> str:
    """Wrap email body in the branded Proline Markets template (logo header + footer)."""
    # Unique invisible marker so Gmail doesn't collapse the identical footer
    # across messages into a "show trimmed content (…)" toggle.
    marker = uuid.uuid4().hex
    return (
        f'<div style="background:#eef1f4;margin:0;padding:32px 16px;font-family:{FONT_STACK};">'
        '<div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;'
        'border:1px solid #e3e8ee;box-shadow:0 6px 24px rgba(16,24,40,0.06);">'
        # ── Header (brand gradient + logo) ──
        '<div style="background:#15803d;background:linear-gradient(135deg,#16a34a 0%,#047857 55%,#065f46 100%);padding:28px 24px;text-align:center;">'
        f'<img src="{BRAND_LOGO_URL}" alt="Proline Markets" width="168" '
        'style="height:auto;max-width:168px;width:168px;display:inline-block;border:0;outline:none;text-decoration:none;" />'
        '</div>'
        # ── Accent divider ──
        '<div style="height:3px;background:linear-gradient(90deg,#16a34a,#f59e0b);"></div>'
        # ── Body ──
        '<div style="padding:34px 34px 26px;color:#1f2937;">'
        f'<h1 style="color:#111827;margin:0 0 16px;font-size:22px;font-weight:700;letter-spacing:-0.2px;">{heading}</h1>'
        f'{inner_html}'
        '</div>'
        # ── Footer ──
        '<div style="padding:20px 34px;background:#f8fafc;border-top:1px solid #edf1f5;">'
        f'<p style="margin:0 0 6px;color:#6b7280;font-size:13px;line-height:1.5;">Need help? Contact us at '
        f'<a href="mailto:{SUPPORT_EMAIL}" style="color:#16a34a;text-decoration:none;font-weight:600;">{SUPPORT_EMAIL}</a>.</p>'
        '<p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.5;">© Proline Markets. All rights reserved.<br/>'
        'This is an automated message — please do not reply.</p>'
        '</div>'
        '</div></div>'
        f'<span style="display:none;max-height:0;overflow:hidden;opacity:0;color:#eef1f4;font-size:1px;line-height:0;">ref:{marker}</span>'
    )


async def send_email(
    to: str,
    subject: str,
    body_html: str,
    body_text: str | None = None,
) -> bool:
    """Send an email via SMTP. Returns True on success, False on failure.

    Requires SMTP_HOST to be set in config. If not configured:
    - In development: logs the email content.
    - In production: logs a warning and returns False.
    """
    from .config import get_settings
    settings = get_settings()

    if not settings.SMTP_HOST:
        if settings.ENVIRONMENT == "development":
            logger.info(
                "[DEV EMAIL] To: %s | Subject: %s\n%s",
                to, subject, body_text or body_html[:500],
            )
            return True
        logger.warning("SMTP_HOST not configured — cannot send email to %s", to)
        return False

    try:
        import aiosmtplib

        msg = MIMEMultipart("alternative")
        msg["From"] = settings.SMTP_FROM or settings.SMTP_USER
        msg["To"] = to
        msg["Subject"] = subject

        if body_text:
            msg.attach(MIMEText(body_text, "plain"))
        msg.attach(MIMEText(body_html, "html"))

        await aiosmtplib.send(
            msg,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USER or None,
            password=settings.SMTP_PASSWORD or None,
            use_tls=settings.SMTP_USE_TLS,
            start_tls=not settings.SMTP_USE_TLS,
        )
        logger.info("Email sent to %s: %s", to, subject)
        return True

    except Exception as exc:
        logger.error("Failed to send email to %s: %s", to, exc)
        return False


# ============================================
# Pre-built email templates
# ============================================

async def send_welcome_email(to: str, login_email: str, password: str | None = None) -> bool:
    """Congratulations email sent AFTER email verification — shows login details
    (Login ID always; password only when the account was created for the user)."""
    def _row(label: str, value: str) -> str:
        return (
            '<tr>'
            f'<td style="padding:6px 0;color:#6b7280;font-size:13px;width:110px;">{label}</td>'
            f'<td style="padding:6px 0;color:#111827;font-size:14px;font-weight:600;">{value}</td>'
            '</tr>'
        )
    rows = _row("Login ID", login_email)
    if password:
        rows += _row("Password", password)
    creds = (
        '<div style="margin:20px 0;padding:18px 20px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;">'
        '<p style="margin:0 0 8px;font-size:12px;letter-spacing:0.4px;text-transform:uppercase;color:#166534;font-weight:700;">Your login details</p>'
        f'<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">{rows}</table>'
        '</div>'
    )
    if password:
        creds += '<p style="margin:0 0 6px;color:#9ca3af;font-size:12px;line-height:1.5;">For your security, please change your password after your first login.</p>'
    inner = (
        '<p style="margin:0 0 4px;font-size:15px;color:#374151;line-height:1.65;">Congratulations — your email has been verified and your '
        'Proline Markets profile is now active.</p>'
        '<p style="margin:8px 0 0;font-size:15px;color:#374151;line-height:1.65;">Use the details below to sign in. To start trading, '
        'open a trading account and complete your KYC verification.</p>'
        f'{creds}'
        '<p style="margin:22px 0 0;"><a href="https://prolinemarket.com/auth/login" '
        'style="display:inline-block;padding:13px 28px;background:#16a34a;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:700;font-size:15px;">Log in to your profile</a></p>'
    )
    text = f"Congratulations! Your Proline Markets profile is active. Login ID: {login_email}" + (f" | Password: {password}" if password else "")
    return await send_email(to, "Welcome to Proline Markets — Your profile is active", brand_email("Welcome to Proline Markets", inner), text)


async def send_verification_email(to: str, code: str) -> bool:
    """Email a 6-digit verification code for new-account email confirmation."""
    inner = (
        '<p style="font-size:15px;color:#374151;line-height:1.6;">Use the code below to verify your email and activate your Proline Markets account:</p>'
        '<div style="margin:18px 0;text-align:center;">'
        f'<span style="display:inline-block;font-size:30px;letter-spacing:8px;font-weight:bold;color:#111827;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:14px 22px;">{code}</span>'
        '</div>'
        '<p style="color:#9ca3af;font-size:13px;">This code expires in 15 minutes. If you did not sign up, ignore this email.</p>'
    )
    text = f"Your Proline Markets verification code is {code}. It expires in 15 minutes."
    return await send_email(to, "Proline Markets — Verify your email", brand_email("Verify your email", inner), text)


async def send_password_reset_email(to: str, reset_url: str) -> bool:
    inner = (
        '<p style="font-size:15px;color:#374151;line-height:1.6;">You requested a password reset for your Proline Markets account. '
        'Click the button below to choose a new password.</p>'
        f'<p style="margin:18px 0;"><a href="{reset_url}" '
        'style="display:inline-block;padding:11px 22px;background:#16a34a;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;">Reset Password</a></p>'
        '<p style="color:#9ca3af;font-size:13px;">This link expires in 15 minutes. If you didn\'t request this, ignore this email.</p>'
    )
    text = f"Reset your password: {reset_url}\nThis link expires in 15 minutes."
    return await send_email(to, "Proline Markets — Password Reset", brand_email("Password Reset", inner), text)


async def send_deposit_confirmation_email(to: str, amount: str, currency: str, status: str) -> bool:
    subject = f"Proline Markets — Deposit {status.title()}"
    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:#1a73e8;">Deposit {status.title()}</h2>
        <p>Your deposit of <strong>{amount} {currency}</strong> has been <strong>{status}</strong>.</p>
        <p>Log in to your dashboard to see your updated balance.</p>
    </div>
    """
    text = f"Your deposit of {amount} {currency} has been {status}."
    return await send_email(to, subject, html, text)


async def send_withdrawal_status_email(to: str, amount: str, currency: str, status: str) -> bool:
    subject = f"Proline Markets — Withdrawal {status.title()}"
    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:#1a73e8;">Withdrawal {status.title()}</h2>
        <p>Your withdrawal of <strong>{amount} {currency}</strong> has been <strong>{status}</strong>.</p>
    </div>
    """
    text = f"Your withdrawal of {amount} {currency} has been {status}."
    return await send_email(to, subject, html, text)


async def send_margin_call_email(to: str, margin_level: str, account_number: str) -> bool:
    subject = "Proline Markets — Margin Call Warning"
    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:#e53935;">Margin Call Warning</h2>
        <p>Your margin level on account <strong>{account_number}</strong> has dropped to
           <strong>{margin_level}%</strong>.</p>
        <p>Please add funds or close positions to avoid stop-out.</p>
    </div>
    """
    text = f"Margin call: account {account_number} at {margin_level}%. Add funds or close positions."
    return await send_email(to, subject, html, text)


async def send_kyc_status_email(to: str, status: str, reason: str | None = None) -> bool:
    subject = f"Proline Markets — KYC Verification {status.title()}"
    reason_line = f"<p>Reason: {reason}</p>" if reason else ""
    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:#1a73e8;">KYC Verification {status.title()}</h2>
        <p>Your KYC documents have been <strong>{status}</strong>.</p>
        {reason_line}
    </div>
    """
    text = f"Your KYC has been {status}." + (f" Reason: {reason}" if reason else "")
    return await send_email(to, subject, html, text)
