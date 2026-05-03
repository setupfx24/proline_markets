"""Optional transactional email via SMTP (Gmail, SES, Mailgun SMTP, etc.)."""
from __future__ import annotations

import asyncio
import logging
import smtplib
from email.message import EmailMessage

from .config import get_settings

logger = logging.getLogger(__name__)


def smtp_configured() -> bool:
    s = get_settings()
    return bool(s.SMTP_HOST and str(s.SMTP_HOST).strip())


def _send_plain_sync(to_email: str, subject: str, body_text: str) -> None:
    s = get_settings()
    msg = EmailMessage()
    msg["Subject"] = subject
    from_addr = (s.SMTP_FROM or s.SMTP_USER or "").strip()
    if not from_addr:
        raise ValueError("SMTP_FROM or SMTP_USER must be set when SMTP_HOST is set")
    msg["From"] = from_addr
    msg["To"] = to_email
    msg.set_content(body_text)

    host = str(s.SMTP_HOST).strip()
    port = int(s.SMTP_PORT)
    with smtplib.SMTP(host, port, timeout=30) as server:
        if s.SMTP_USE_TLS:
            server.starttls()
        user = (s.SMTP_USER or "").strip()
        pwd = (s.SMTP_PASSWORD or "").strip()
        if user:
            server.login(user, pwd)
        server.send_message(msg)


async def send_password_reset_email(to_email: str, reset_link: str, *, app_name: str = "Proline Markets") -> bool:
    """Send reset email. Returns True if sent, False if SMTP not configured or send failed."""
    if not smtp_configured():
        return False
    subject = f"Reset your {app_name} password"
    body = (
        f"You requested a password reset for your {app_name} account.\n\n"
        f"Open this link to choose a new password (it expires in 15 minutes):\n\n"
        f"{reset_link}\n\n"
        f"If you did not request this, you can ignore this email.\n"
    )
    try:
        await asyncio.to_thread(_send_plain_sync, to_email, subject, body)
        return True
    except Exception:
        logger.exception("Failed to send password reset email to %s", to_email)
        return False
