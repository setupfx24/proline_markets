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

    return n


# ============================================
# Email Notifications (SMTP via aiosmtplib)
# ============================================

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


async def send_daily_summary_email(
    to: str, balance: float, equity: float, day_pnl: float,
    open_positions: int, date_str: str,
) -> bool:
    """End-of-day account statement sent to each client."""
    pnl_color = "#16a34a" if day_pnl >= 0 else "#e53935"
    pnl_sign = "+" if day_pnl >= 0 else ""
    subject = f"Proline Markets — Daily Statement ({date_str})"
    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:#1a73e8;">Daily Account Statement</h2>
        <p style="color:#666;">{date_str}</p>
        <table style="width:100%;border-collapse:collapse;margin-top:12px;">
            <tr><td style="padding:8px 0;color:#666;">Balance</td>
                <td style="padding:8px 0;text-align:right;"><strong>${balance:,.2f}</strong></td></tr>
            <tr><td style="padding:8px 0;color:#666;">Equity</td>
                <td style="padding:8px 0;text-align:right;"><strong>${equity:,.2f}</strong></td></tr>
            <tr><td style="padding:8px 0;color:#666;">Today's P&amp;L</td>
                <td style="padding:8px 0;text-align:right;color:{pnl_color};">
                    <strong>{pnl_sign}${day_pnl:,.2f}</strong></td></tr>
            <tr><td style="padding:8px 0;color:#666;">Open Positions</td>
                <td style="padding:8px 0;text-align:right;"><strong>{open_positions}</strong></td></tr>
        </table>
        <p style="color:#666;font-size:13px;margin-top:16px;">
            Log in to your dashboard for full details. Thank you for trading with Proline Markets.</p>
    </div>
    """
    text = (
        f"Daily Statement {date_str}\n"
        f"Balance: ${balance:,.2f}\nEquity: ${equity:,.2f}\n"
        f"Today's P&L: {pnl_sign}${day_pnl:,.2f}\nOpen Positions: {open_positions}"
    )
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
