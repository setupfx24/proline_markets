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
# Pre-built email templates (shared branded layout)
# ============================================

BRAND_NAME = "Proline Markets"
BRAND_DARK = "#0b1220"
BRAND_ACCENT = "#16a34a"
SUPPORT_EMAIL = "info@prolinemarket.com"
TRADER_URL = "https://prolinemarket.com"
BRAND_LOGO_URL = "https://prolinemarket.com/prolinemarket%20logo%20landscap%20png.png"


def _email_layout(heading: str, inner_html: str, accent: str = BRAND_ACCENT) -> str:
    """Wrap content in a responsive, email-client-safe branded shell."""
    return f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#eef1f4;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f4;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0"
             style="max-width:600px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;
                    border:1px solid #e3e7ec;box-shadow:0 1px 3px rgba(16,24,40,.06);">
        <tr><td align="center" style="background:#ffffff;padding:24px 32px 18px;text-align:center;">
          <img src="{BRAND_LOGO_URL}" alt="Proline Markets" height="44"
               style="height:44px;width:auto;max-width:240px;display:inline-block;border:0;outline:none;text-decoration:none;" />
        </td></tr>
        <tr><td style="height:4px;background:{accent};font-size:0;line-height:0;">&nbsp;</td></tr>
        <tr><td style="padding:32px;font-family:Arial,Helvetica,sans-serif;color:#2b2f36;font-size:15px;line-height:1.6;">
          <h1 style="margin:0 0 18px;font-size:22px;font-weight:700;color:{BRAND_DARK};">{heading}</h1>
          {inner_html}
        </td></tr>
        <tr><td align="center" style="padding:20px 32px;background:#f7f9fb;border-top:1px solid #eceff3;text-align:center;
                       font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#8a94a6;">
          <p style="margin:0 0 4px;font-weight:600;color:#6b7585;">Proline Markets — Forex · Metals · Indices · Crypto</p>
          <p style="margin:0;">Need help? Email <a href="mailto:{SUPPORT_EMAIL}" style="color:{accent};text-decoration:none;">{SUPPORT_EMAIL}</a></p>
          <p style="margin:8px 0 0;color:#aab2c0;">This is an automated message — please do not reply to this email.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""


def _btn(url: str, label: str, accent: str = BRAND_ACCENT) -> str:
    return (
        f'<table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px 0;"><tr><td '
        f'style="border-radius:8px;background:{accent};">'
        f'<a href="{url}" style="display:inline-block;padding:12px 28px;font-family:Arial,Helvetica,sans-serif;'
        f'font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">{label}</a>'
        f'</td></tr></table>'
    )


def _stat_row(label: str, value: str, color: str = "#2b2f36") -> str:
    return (
        f'<tr><td style="padding:10px 0;border-bottom:1px solid #eef1f4;color:#7a8494;font-size:14px;">{label}</td>'
        f'<td style="padding:10px 0;border-bottom:1px solid #eef1f4;text-align:right;color:{color};'
        f'font-size:15px;font-weight:700;">{value}</td></tr>'
    )


async def send_password_reset_email(to: str, reset_url: str) -> bool:
    subject = "Proline Markets — Reset your password"
    inner = f"""
        <p>We received a request to reset the password for your Proline Markets account.</p>
        <p>Click the button below to choose a new password:</p>
        {_btn(reset_url, "Reset Password")}
        <p style="color:#8a94a6;font-size:13px;">This link expires in 1 hour. If you didn't request a
           password reset, you can safely ignore this email — your password won't change.</p>
    """
    html = _email_layout("Password Reset Request", inner)
    text = f"Reset your password: {reset_url}\nThis link expires in 1 hour."
    return await send_email(to, subject, html, text)


async def send_deposit_confirmation_email(to: str, amount: str, currency: str, status: str) -> bool:
    subject = f"Proline Markets — Deposit {status.title()}"
    ok = "reject" not in status.lower() and "not" not in status.lower()
    accent = BRAND_ACCENT if ok else "#e53935"
    inner = f"""
        <p>Your deposit of <strong style="color:{accent};">{amount} {currency}</strong> has been
           <strong>{status}</strong>.</p>
        <p>{'The funds are now reflected in your wallet.' if ok else 'Please review the details or contact support if you have questions.'}</p>
        {_btn(TRADER_URL, "Open Dashboard", accent)}
    """
    html = _email_layout(f"Deposit {status.title()}", inner, accent)
    text = f"Your deposit of {amount} {currency} has been {status}."
    return await send_email(to, subject, html, text)


async def send_withdrawal_status_email(to: str, amount: str, currency: str, status: str) -> bool:
    subject = f"Proline Markets — Withdrawal {status.title()}"
    ok = "reject" not in status.lower() and "not" not in status.lower()
    accent = BRAND_ACCENT if ok else "#e53935"
    inner = f"""
        <p>Your withdrawal of <strong style="color:{accent};">{amount} {currency}</strong> has been
           <strong>{status}</strong>.</p>
        {_btn(TRADER_URL, "View Wallet", accent)}
    """
    html = _email_layout(f"Withdrawal {status.title()}", inner, accent)
    text = f"Your withdrawal of {amount} {currency} has been {status}."
    return await send_email(to, subject, html, text)


async def send_margin_call_email(to: str, margin_level: str, account_number: str) -> bool:
    subject = "Proline Markets — Margin Call Warning"
    inner = f"""
        <p>Your margin level on account <strong>{account_number}</strong> has dropped to
           <strong style="color:#e53935;">{margin_level}%</strong>.</p>
        <p>Please add funds or close positions to avoid an automatic stop-out.</p>
        {_btn(TRADER_URL, "Manage Positions", "#e53935")}
    """
    html = _email_layout("Margin Call Warning", inner, "#e53935")
    text = f"Margin call: account {account_number} at {margin_level}%. Add funds or close positions."
    return await send_email(to, subject, html, text)


async def send_welcome_email(
    to: str,
    first_name: str | None = None,
    login_email: str | None = None,
    password: str | None = None,
    verify_url: str | None = None,
) -> bool:
    """Welcome email sent when a new user PROFILE is created (registration).

    Includes the login details and an email-verification button.
    """
    name = (first_name or "").strip() or "Trader"
    subject = "Welcome to Proline Markets 🎉"

    creds_html = ""
    if login_email:
        creds_html = f"""
        <p style="margin:18px 0 8px;font-weight:700;color:#0b1220;">Your Profile Login Details</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
               style="background:#f7f9fb;border:1px solid #e6ebf1;border-radius:10px;">
            <tr><td style="padding:12px 16px;color:#7a8494;font-size:14px;width:120px;">User (email)</td>
                <td style="padding:12px 16px;color:#0b1220;font-size:15px;font-weight:600;">{login_email}</td></tr>
            <tr><td style="padding:12px 16px;color:#7a8494;font-size:14px;border-top:1px solid #eef1f4;">Password</td>
                <td style="padding:12px 16px;color:#0b1220;font-size:15px;font-weight:600;border-top:1px solid #eef1f4;">{password or '(the password you chose)'}</td></tr>
        </table>
        <p style="margin:8px 0 0;color:#8a94a6;font-size:12px;">For your security, please change your password after your first login.</p>
        """

    verify_html = ""
    if verify_url:
        verify_html = f"""
        <p style="margin:18px 0 4px;">Please verify your email address to activate all features:</p>
        {_btn(verify_url, "Verify Email")}
        """

    inner = f"""
        <p>Hi {name}, your Proline Markets <strong>profile</strong> has been created successfully — welcome aboard!</p>
        {verify_html}
        {creds_html}
        <p style="margin:18px 0 6px;">Next steps:</p>
        <ul style="margin:0 0 8px;padding-left:20px;color:#3a3f47;">
            <li style="margin:6px 0;">Complete your <strong>KYC verification</strong></li>
            <li style="margin:6px 0;">Open a trading account &amp; fund your <strong>wallet</strong></li>
            <li style="margin:6px 0;">Start <strong>trading</strong> Forex, Metals, Indices &amp; Crypto</li>
        </ul>
        {_btn(TRADER_URL, "Log In to Your Profile")}
        <p style="color:#8a94a6;font-size:13px;">If you didn't create this profile, please contact our support team.</p>
    """
    html = _email_layout(f"Welcome, {name}!", inner)
    cred_text = f"\nUser (email): {login_email}\nPassword: {password or '(the password you chose)'}\n" if login_email else ""
    verify_text = f"\nVerify your email: {verify_url}\n" if verify_url else ""
    text = (
        f"Welcome, {name}!\nYour Proline Markets profile has been created successfully."
        f"{verify_text}{cred_text}"
        "\nLog in to complete KYC, open a trading account, fund your wallet, and start trading."
    )
    return await send_email(to, subject, html, text)


async def send_daily_summary_email(
    to: str, balance: float, equity: float, day_pnl: float,
    open_positions: int, date_str: str,
) -> bool:
    """End-of-day account statement sent to each client."""
    pnl_color = BRAND_ACCENT if day_pnl >= 0 else "#e53935"
    pnl_sign = "+" if day_pnl >= 0 else ""
    subject = f"Proline Markets — Daily Statement ({date_str})"
    inner = f"""
        <p style="color:#7a8494;margin:0 0 16px;">Account summary for <strong>{date_str}</strong></p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            {_stat_row("Balance", f"${balance:,.2f}")}
            {_stat_row("Equity", f"${equity:,.2f}")}
            {_stat_row("Today's P&amp;L", f"{pnl_sign}${day_pnl:,.2f}", pnl_color)}
            {_stat_row("Open Positions", str(open_positions))}
        </table>
        {_btn(TRADER_URL, "View Full Statement")}
        <p style="color:#8a94a6;font-size:13px;">Thank you for trading with Proline Markets.</p>
    """
    html = _email_layout("Daily Account Statement", inner)
    text = (
        f"Daily Statement {date_str}\n"
        f"Balance: ${balance:,.2f}\nEquity: ${equity:,.2f}\n"
        f"Today's P&L: {pnl_sign}${day_pnl:,.2f}\nOpen Positions: {open_positions}"
    )
    return await send_email(to, subject, html, text)


async def send_kyc_status_email(to: str, status: str, reason: str | None = None) -> bool:
    subject = f"Proline Markets — KYC Verification {status.title()}"
    s = status.lower()
    accent = "#e53935" if "reject" in s else (BRAND_ACCENT if "approv" in s else "#1a73e8")
    reason_line = (
        f'<p style="margin-top:8px;color:#7a8494;"><strong>Reason:</strong> {reason}</p>' if reason else ""
    )
    if "approv" in s:
        extra = "<p>Your account is now fully verified. You have full access to deposits, withdrawals and trading.</p>"
    elif "reject" in s:
        extra = "<p>You can upload new documents from your profile to try again.</p>"
    else:
        extra = "<p>We have received your documents and our team will review them shortly.</p>"
    inner = f"""
        <p>Your KYC documents have been <strong style="color:{accent};">{status}</strong>.</p>
        {extra}{reason_line}
        {_btn(TRADER_URL, "Go to Profile", accent)}
    """
    html = _email_layout(f"KYC Verification {status.title()}", inner, accent)
    text = f"Your KYC has been {status}." + (f" Reason: {reason}" if reason else "")
    return await send_email(to, subject, html, text)
