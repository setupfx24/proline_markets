"""Public webhook endpoints — no JWT auth, secured by provider-specific HMAC."""
import json
import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import get_db
from ..services import oxapay_service, wallet_service

router = APIRouter()
logger = logging.getLogger("webhooks")


@router.post("/oxapay")
async def oxapay_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """OxaPay payment status callback. Public endpoint secured by HMAC-SHA512."""
    raw_body = await request.body()
    hmac_header = request.headers.get("HMAC", "") or request.headers.get("hmac", "")

    if not oxapay_service.verify_webhook_signature(raw_body, hmac_header):
        logger.warning("OxaPay webhook: invalid HMAC signature")
        raise HTTPException(status_code=403, detail="Invalid signature")

    try:
        payload = json.loads(raw_body)
    except (json.JSONDecodeError, ValueError):
        raise HTTPException(status_code=400, detail="Invalid JSON")

    order_id = payload.get("orderId")
    status = payload.get("status")
    track_id = payload.get("trackId")

    if not order_id or not status:
        logger.info("OxaPay webhook: missing orderId/status, ignoring")
        return {"status": "ignored"}

    logger.info("OxaPay webhook: order=%s status=%s track=%s", order_id, status, track_id)

    await wallet_service.handle_oxapay_webhook(
        order_id=order_id,
        oxapay_status=status,
        track_id=track_id,
        payload=payload,
        db=db,
    )

    return {"status": "ok"}
