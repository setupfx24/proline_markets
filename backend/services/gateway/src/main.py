"""Proline Markets Gateway — REST + WebSocket API Server."""
import asyncio
import json
import logging
from contextlib import asynccontextmanager
from uuid import UUID

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException, status, Request, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.config import get_settings
from packages.common.src.database import get_db, AsyncSessionLocal
from packages.common.src.redis_client import redis_client, PriceChannel
from packages.common.src.kafka_client import close_producer
from packages.common.src.auth import decode_token
from packages.common.src.models import TradingAccount
from packages.common.src.instrumentation import init_sentry, add_middleware_stack

from .api import (
    auth, orders, positions, accounts, instruments, deposits, webhooks,
    websocket_manager, social, business, portfolio, profile, support,
    notifications, banners, trading_catalog, followers, lp_receiver,
    algo_connector, algo_keys, algo_market_data, share,
)
from .engines.sltp_engine import sltp_engine
from .engines.copy_engine import copy_engine
from .engines.stats_engine import stats_engine

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)-5s [%(name)s] %(message)s")
logger = logging.getLogger("gateway")

settings = get_settings()
init_sentry("gateway")

_cors_origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]
if not _cors_origins:
    _cors_origins = ["http://localhost:3000", "http://localhost:3001"]
_cors_methods = [m.strip() for m in settings.CORS_ALLOW_METHODS.split(",") if m.strip()]
_cors_headers = [h.strip() for h in settings.CORS_ALLOW_HEADERS.split(",") if h.strip()]


async def _backfill_close_reasons():
    """Relabel historical trade_history rows where close_price matches the
    position's SL/TP level — those were previously written as 'manual' but
    should now show as 'sl'/'tp' in the UI. Idempotent."""
    from sqlalchemy import text
    sql = text(
        """
        UPDATE trade_history th
        SET close_reason = CASE
            WHEN p.stop_loss IS NOT NULL AND (
                (p.side = 'buy'  AND th.close_price <= p.stop_loss)
             OR (p.side = 'sell' AND th.close_price >= p.stop_loss)
            ) THEN 'sl'
            WHEN p.take_profit IS NOT NULL AND (
                (p.side = 'buy'  AND th.close_price >= p.take_profit)
             OR (p.side = 'sell' AND th.close_price <= p.take_profit)
            ) THEN 'tp'
            ELSE th.close_reason
        END
        FROM positions p
        WHERE th.position_id = p.id
          AND COALESCE(th.close_reason, 'manual') IN ('manual', 'copy_close', 'copy')
          AND (p.stop_loss IS NOT NULL OR p.take_profit IS NOT NULL)
        """
    )
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(sql)
            await session.commit()
    except Exception as e:
        logger.warning("close_reason backfill skipped: %s", e)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await _backfill_close_reasons()
    await sltp_engine.start()
    await copy_engine.start()
    await stats_engine.start()
    yield
    await stats_engine.stop()
    await copy_engine.stop()
    await sltp_engine.stop()
    await close_producer()
    await redis_client.close()


app = FastAPI(
    title="Proline Markets Gateway",
    version="1.0.0",
    description="Forex CFD B-Book Trading Platform API",
    lifespan=lifespan,
    docs_url="/docs" if settings.ENVIRONMENT == "development" else None,
    redoc_url="/redoc" if settings.ENVIRONMENT == "development" else None,
    openapi_url="/openapi.json" if settings.ENVIRONMENT == "development" else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=_cors_methods,
    allow_headers=_cors_headers,
    max_age=86400,  # Cache preflight for 24h — avoids OPTIONS request before every POST
)

add_middleware_stack(app)


# ── Investor read-only guard ────────────────────────────────────────────────
# An investor session's JWT has sub=<real account owner>, so without a global
# gate a missed route would let an investor act as the owner (place trades,
# withdraw, even change the owner's password). This blocks EVERY mutating
# request for role=="investor" except the auth/session endpoints they need.
from fastapi.responses import JSONResponse as _JSONResponse

_INVESTOR_WRITE_ALLOWLIST = {
    "/api/v1/auth/investor/login",
    "/api/v1/auth/logout",
    "/api/v1/auth/refresh",
    "/api/v1/auth/bootstrap-session",
}


@app.middleware("http")
async def investor_readonly_guard(request: Request, call_next):
    if request.method in ("POST", "PUT", "PATCH", "DELETE"):
        path = request.url.path
        if path not in _INVESTOR_WRITE_ALLOWLIST:
            token = None
            auth = request.headers.get("authorization") or ""
            if auth.lower().startswith("bearer "):
                token = auth[7:].strip()
            if not token:
                token = request.cookies.get(settings.ACCESS_TOKEN_COOKIE_NAME)
            if token:
                try:
                    if decode_token(token).get("role") == "investor":
                        return _JSONResponse(
                            {"detail": "Investor access is read-only"},
                            status_code=403,
                        )
                except Exception:
                    pass  # invalid/expired token → let the route's own auth handle it
    return await call_next(request)


# REST API Routes
app.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(accounts.router, prefix="/api/v1/accounts", tags=["Accounts"])
app.include_router(instruments.router, prefix="/api/v1/instruments", tags=["Instruments"])
app.include_router(trading_catalog.router, prefix="/api/v1")
app.include_router(orders.router, prefix="/api/v1/orders", tags=["Orders"])
app.include_router(positions.router, prefix="/api/v1/positions", tags=["Positions"])
app.include_router(deposits.router, prefix="/api/v1/wallet", tags=["Wallet"])
app.include_router(social.router, prefix="/api/v1/social", tags=["Social Trading"])
app.include_router(business.router, prefix="/api/v1/business", tags=["Business/IB"])
app.include_router(portfolio.router, prefix="/api/v1/portfolio", tags=["Portfolio"])
app.include_router(profile.router, prefix="/api/v1/profile", tags=["Profile"])
app.include_router(support.router, prefix="/api/v1/support", tags=["Support"])
app.include_router(notifications.router, prefix="/api/v1/notifications", tags=["Notifications"])
app.include_router(banners.media_router, prefix="/api/v1/banners", tags=["Banners"])
app.include_router(banners.router, prefix="/api/v1/banners", tags=["Banners"])
app.include_router(followers.router, prefix="/api/v1/followers", tags=["Followers"])
app.include_router(webhooks.router, prefix="/api/v1/webhooks", tags=["Webhooks"])
# Corecen LP price push receiver — HMAC-secured, public (no JWT). Path mirrors
# Corecen's sender (axios POST baseURL + '/api/lp/prices/batch').
app.include_router(lp_receiver.router, prefix="/api/lp", tags=["LP Receiver"])
app.include_router(algo_connector.router, prefix="/api/algo", tags=["Algo Connector"])
app.include_router(algo_market_data.router, prefix="/api/algo", tags=["Algo Market Data"])
app.include_router(algo_keys.router, prefix="/api/v1/algo", tags=["Algo Keys"])
app.include_router(share.router, prefix="/api/v1", tags=["Share Trade"])
app.include_router(share.public_router, prefix="/api/v1/public", tags=["Public Share"])


@app.get("/health")
async def health():
    return {"status": "ok", "service": "gateway"}


# ============================================
# WEBSOCKET — Price Streaming & Trade Updates
# ============================================

def _verify_ws_token(token: str | None) -> dict | None:
    """Decode a JWT for WebSocket auth. Returns payload or None."""
    if not token:
        return None
    try:
        payload = decode_token(token)
        return {"user_id": UUID(payload["sub"]), "role": payload["role"]}
    except Exception:
        return None


@app.websocket("/ws/algo/prices")
async def algo_prices_stream(websocket: WebSocket):
    """Live tick stream for external algo bots — first-message auth via X-Api-Key + X-Api-Secret.
    Broadcasts every tick from the LP pipeline (same source the frontend consumes)."""
    await algo_market_data.algo_prices_ws(websocket)


@app.websocket("/ws/prices")
async def price_stream(websocket: WebSocket, token: str | None = Query(default=None)):
    if token:
        user = _verify_ws_token(token)
        if not user:
            await websocket.close(code=4001, reason="Invalid token")
            return

    await websocket.accept()
    pubsub = redis_client.pubsub()
    await pubsub.subscribe(PriceChannel.PRICE_CHANNEL)

    try:
        ping_interval = 30
        last_ping = asyncio.get_event_loop().time()
        while True:
            message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=0.1)
            if message and message["type"] == "message":
                await websocket.send_text(message["data"])

            now = asyncio.get_event_loop().time()
            if now - last_ping >= ping_interval:
                await websocket.send_json({"type": "ping"})
                last_ping = now

            await asyncio.sleep(0.01)
    except WebSocketDisconnect:
        pass
    finally:
        await pubsub.unsubscribe(PriceChannel.PRICE_CHANNEL)
        await pubsub.close()


@app.websocket("/ws/trades/{account_id}")
async def trade_stream(websocket: WebSocket, account_id: str, token: str = Query()):
    user = _verify_ws_token(token)
    if not user:
        await websocket.close(code=4001, reason="Invalid token")
        return

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(TradingAccount).where(
                TradingAccount.id == UUID(account_id),
                TradingAccount.user_id == user["user_id"],
            )
        )
        if not result.scalar_one_or_none():
            await websocket.close(code=4003, reason="Account not found or access denied")
            return

    await websocket.accept()
    manager = websocket_manager.ConnectionManager()
    await manager.connect(account_id, websocket)

    pubsub = redis_client.pubsub()
    channel = f"account:{account_id}"
    await pubsub.subscribe(channel)

    try:
        ping_interval = 30
        last_ping = asyncio.get_event_loop().time()
        while True:
            ws_message = None
            try:
                ws_message = await asyncio.wait_for(websocket.receive_text(), timeout=0.1)
            except asyncio.TimeoutError:
                pass

            if ws_message:
                data = json.loads(ws_message)
                if data.get("type") == "pong":
                    pass
                else:
                    await manager.handle_message(account_id, data)

            message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=0.1)
            if message and message["type"] == "message":
                await websocket.send_text(message["data"])

            now = asyncio.get_event_loop().time()
            if now - last_ping >= ping_interval:
                await websocket.send_json({"type": "ping"})
                last_ping = now

            await asyncio.sleep(0.01)
    except WebSocketDisconnect:
        manager.disconnect(account_id)
    finally:
        await pubsub.unsubscribe(channel)
        await pubsub.close()


@app.websocket("/ws/admin")
async def admin_stream(websocket: WebSocket, token: str = Query()):
    user = _verify_ws_token(token)
    if not user or user["role"] not in ("admin", "super_admin"):
        await websocket.close(code=4003, reason="Admin access required")
        return

    await websocket.accept()
    pubsub = redis_client.pubsub()
    await pubsub.subscribe("admin:trades", "admin:deposits", "admin:alerts")

    try:
        ping_interval = 30
        last_ping = asyncio.get_event_loop().time()
        while True:
            message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=0.1)
            if message and message["type"] == "message":
                await websocket.send_text(json.dumps({
                    "channel": message["channel"],
                    "data": message["data"],
                }))

            now = asyncio.get_event_loop().time()
            if now - last_ping >= ping_interval:
                await websocket.send_json({"type": "ping"})
                last_ping = now

            await asyncio.sleep(0.01)
    except WebSocketDisconnect:
        pass
    finally:
        await pubsub.unsubscribe("admin:trades", "admin:deposits", "admin:alerts")
        await pubsub.close()
