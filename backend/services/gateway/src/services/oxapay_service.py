"""OxaPay crypto payment gateway integration."""
import hashlib
import hmac
import logging
from decimal import Decimal

import httpx

from packages.common.src.config import get_settings

logger = logging.getLogger("oxapay_service")

OXAPAY_API_URL = "https://api.oxapay.com/merchants/request"
# OxaPay sandbox uses the same URL but with merchant='sandbox' value (see docs.oxapay.com)

# Map frontend crypto asset IDs → OxaPay currency codes.
CURRENCY_MAP: dict[str, str] = {
    "BTC": "BTC",
    "ETH": "ETH",
    "USDT_ERC": "USDT",
    "USDC_ERC": "USDC",
    "TRX": "TRX",
    "USDT_TRC": "USDT",
    "USDC_TRC": "USDC",
    "USDT_SOL": "USDT",
    "USDC_SOL": "USDC",
    "SOL": "SOL",
    "XRP": "XRP",
}

# Map frontend crypto asset IDs → OxaPay network hints (where needed).
NETWORK_MAP: dict[str, str] = {
    "USDT_ERC": "ERC20",
    "USDC_ERC": "ERC20",
    "USDT_TRC": "TRC20",
    "USDC_TRC": "TRC20",
    "USDT_SOL": "SOL",
    "USDC_SOL": "SOL",
}


def resolve_currency(frontend_id: str) -> tuple[str, str | None]:
    """Return (oxapay_currency, network_or_None) for a frontend crypto asset ID."""
    currency = CURRENCY_MAP.get(frontend_id, frontend_id)
    network = NETWORK_MAP.get(frontend_id)
    return currency, network


async def create_payment(
    amount: Decimal,
    crypto_currency: str | None,
    order_id: str,
    description: str = "",
) -> dict:
    """Create an OxaPay payment invoice.

    If crypto_currency is None, OxaPay shows all supported currencies on its checkout page.
    Returns dict with keys: track_id, payment_url.
    Raises ValueError on configuration or API errors.
    """
    settings = get_settings()
    if not settings.OXAPAY_MERCHANT_KEY:
        raise ValueError("OxaPay merchant key not configured")

    callback_url = f"{settings.OXAPAY_CALLBACK_BASE_URL.rstrip('/')}/api/v1/webhooks/oxapay"

    # In sandbox mode, OxaPay expects merchant='sandbox' (same API URL)
    merchant_key = "sandbox" if settings.OXAPAY_SANDBOX else settings.OXAPAY_MERCHANT_KEY

    payload: dict = {
        "merchant": merchant_key,
        "amount": float(amount),
        "currency": "USD",
        "orderId": order_id,
        "callbackUrl": callback_url,
        "description": description or f"Deposit {order_id[:8]}",
        "lifeTime": 30,  # minutes
        "feePaidByPayer": 0,
    }

    # If user pre-selected a currency, pin it; otherwise let OxaPay show all
    if crypto_currency:
        currency, network = resolve_currency(crypto_currency)
        payload["payCurrency"] = currency
        if network:
            payload["network"] = network

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(OXAPAY_API_URL, json=payload)
        resp.raise_for_status()
        data = resp.json()
        logger.info("OxaPay response: %s", data)

    if data.get("result") != 100:
        logger.error("OxaPay create_payment failed: %s", data)
        raise ValueError(f"OxaPay error: {data.get('message', 'Unknown error')}")

    logger.info("OxaPay payment created: order=%s track=%s", order_id, data.get("trackId"))
    return {
        "track_id": data.get("trackId"),
        "payment_url": data.get("payLink"),
    }


def verify_webhook_signature(raw_body: bytes, received_hmac: str) -> bool:
    """Verify HMAC-SHA512 signature on an OxaPay webhook request."""
    settings = get_settings()
    key = settings.OXAPAY_MERCHANT_KEY.encode()
    computed = hmac.new(key, raw_body, hashlib.sha512).hexdigest()
    return hmac.compare_digest(computed, received_hmac)
