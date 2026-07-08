"""Notification helper — in-app + email notifications.

In-app: writes to DB + publishes via Redis pub/sub.
Email:  sends via SMTP (aiosmtplib) when SMTP_HOST is configured.
"""
import json
import logging
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
                    f'<p style="font-size:15px;color:#374151;line-height:1.6;">{message}</p>'
                    '<p style="color:#9ca3af;font-size:13px;">Log in to your Proline Markets account for details.</p>'
                ))
                await send_email(addr, f"Proline Markets — {title}", html, message)
        except Exception:
            logger.exception("notification email failed for user %s", user_id)

    return n


# ============================================
# Email Notifications (SMTP via aiosmtplib)
# ============================================

# Absolute URL — email clients can't load app-relative assets.
BRAND_LOGO_URL = "https://prolinemarket.com/images/logo1.png"


def brand_email(heading: str, inner_html: str) -> str:
    """Wrap email body in the branded Proline Markets template (logo header + footer)."""
    return (
        '<div style="background:#f4f6f8;padding:24px 0;font-family:Arial,Helvetica,sans-serif;">'
        '<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">'
        '<div style="background:#0a0a0a;padding:18px 24px;text-align:center;">'
        f'<img src="{BRAND_LOGO_URL}" alt="Proline Markets" style="height:32px;max-height:32px;object-fit:contain;" />'
        '</div>'
        '<div style="padding:28px 24px;color:#111827;">'
        f'<h2 style="color:#16a34a;margin:0 0 14px;font-size:20px;">{heading}</h2>'
        f'{inner_html}'
        '</div>'
        '<div style="padding:14px 24px;background:#f9fafb;border-top:1px solid #eee;color:#9ca3af;font-size:12px;text-align:center;">'
        '© Proline Markets · Automated message, please do not reply.'
        '</div></div></div>'
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
    """New-account welcome email — shows the login credentials (id + password)."""
    creds = ""
    if password:
        creds = (
            '<div style="margin:16px 0;padding:14px 16px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;">'
            '<p style="margin:0 0 8px;font-size:13px;color:#166534;font-weight:bold;">Your login credentials</p>'
            f'<p style="margin:2px 0;font-size:14px;color:#111;">Login ID: <strong>{login_email}</strong></p>'
            f'<p style="margin:2px 0;font-size:14px;color:#111;">Password: <strong>{password}</strong></p>'
            '</div>'
            '<p style="color:#9ca3af;font-size:12px;">For your security, change your password after your first login.</p>'
        )
    inner = (
        '<p style="font-size:15px;color:#374151;line-height:1.6;">Your Proline Markets account has been created successfully. '
        'Open a trading account and complete KYC to start trading.</p>'
        f'{creds}'
        '<p style="margin-top:18px;"><a href="https://prolinemarket.com/auth/login" '
        'style="display:inline-block;padding:11px 22px;background:#16a34a;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;">Log in to your account</a></p>'
    )
    text = f"Welcome to Proline Markets. Login ID: {login_email}" + (f" | Password: {password}" if password else "")
    return await send_email(to, "Welcome to Proline Markets", brand_email("Welcome to Proline Markets", inner), text)


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
    subject = "Proline Markets — Password Reset Request"
    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:#1a73e8;">Password Reset</h2>
        <p>You requested a password reset for your Proline Markets account.</p>
        <p><a href="{reset_url}"
              style="display:inline-block;padding:12px 24px;background:#1a73e8;
                     color:#fff;text-decoration:none;border-radius:4px;">
            Reset Password
        </a></p>
        <p style="color:#666;font-size:13px;">This link expires in 1 hour.
           If you didn't request this, ignore this email.</p>
    </div>
    """
    text = f"Reset your password: {reset_url}\nThis link expires in 1 hour."
    return await send_email(to, subject, html, text)


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
