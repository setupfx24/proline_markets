"""Platform bridge — inbound API called by the sister platform's trade-bridge worker.

Mounted at /api/bridge/v1. Every request must carry a valid HMAC signature
(packages/common/src/platform_bridge.py) made with BRIDGE_SHARED_SECRET from
the platform named in X-Bridge-Source (= our BRIDGE_PEER_ID). There is no user
session here: the shared secret is the credential, so keep it as tightly held
as a database password.

The trades themselves are executed by services/bridge_service.py.
"""
import json
import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse

from packages.common.src.config import get_settings
from packages.common.src import platform_bridge as pb

from ..services import bridge_service
from ..services.bridge_service import BridgeReply

router = APIRouter()
logger = logging.getLogger("bridge-api")


async def verified_source(request: Request) -> str:
    settings = get_settings()
    if not settings.BRIDGE_ENABLED or not settings.BRIDGE_SHARED_SECRET:
        raise HTTPException(status_code=404, detail="Not Found")
    source = (request.headers.get(pb.HDR_SOURCE) or "").strip().lower()
    raw = await request.body()
    ok = source == settings.BRIDGE_PEER_ID.strip().lower() and pb.verify(
        settings.BRIDGE_SHARED_SECRET,
        request.headers.get(pb.HDR_TIMESTAMP, ""),
        request.method,
        request.url.path,
        raw.decode("utf-8") if raw else "",
        request.headers.get(pb.HDR_SIGNATURE, ""),
        settings.BRIDGE_TIMESTAMP_TOLERANCE_MS,
    )
    if not ok:
        logger.warning("bridge request rejected: bad signature (source=%r path=%s)", source, request.url.path)
        raise HTTPException(status_code=401, detail="Invalid bridge signature")
    return source


async def _json(request: Request) -> dict:
    try:
        data = json.loads((await request.body()) or b"{}")
    except ValueError:
        raise HTTPException(status_code=400, detail="Body must be JSON")
    if not isinstance(data, dict):
        raise HTTPException(status_code=400, detail="Body must be a JSON object")
    return data


def _client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


async def _run(coro):
    try:
        return await coro
    except BridgeReply as r:
        return JSONResponse(status_code=r.status, content=r.body)


@router.get("/ping")
async def ping(source: str = Depends(verified_source)):
    return {"ok": True, "platform": get_settings().BRIDGE_PLATFORM_ID, "peer": source}


@router.get("/accounts/{account_number}")
async def account(account_number: str, source: str = Depends(verified_source)):
    return await bridge_service.account_info(account_number)


@router.post("/trades/open")
async def open_trade(request: Request, source: str = Depends(verified_source)):
    payload = await _json(request)
    return await _run(bridge_service.open_trade(source, payload, request, _client_ip(request)))


@router.post("/trades/close")
async def close_trade(request: Request, source: str = Depends(verified_source)):
    return await _run(bridge_service.close_trade(source, await _json(request)))


@router.post("/trades/close-source")
async def close_source(request: Request, source: str = Depends(verified_source)):
    return await _run(bridge_service.close_source(source, await _json(request)))


@router.post("/trades/modify")
async def modify_trade(request: Request, source: str = Depends(verified_source)):
    return await _run(bridge_service.modify_trade(source, await _json(request)))


@router.post("/trades/status")
async def trade_status(request: Request, source: str = Depends(verified_source)):
    return await _run(bridge_service.trade_status(source, await _json(request)))
