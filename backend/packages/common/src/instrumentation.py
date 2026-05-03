"""Shared instrumentation — Sentry, rate limiting, Prometheus metrics, request size limit.

Usage in any FastAPI service:

    from packages.common.src.instrumentation import init_sentry, add_middleware_stack

    init_sentry("gateway")
    app = FastAPI(...)
    add_middleware_stack(app)
"""
import logging
import time
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response, JSONResponse

from .config import get_settings

logger = logging.getLogger("instrumentation")
settings = get_settings()


# ---------------------------------------------------------------------------
# 1. Sentry
# ---------------------------------------------------------------------------
def init_sentry(service_name: str) -> None:
    """Initialise Sentry SDK if SENTRY_DSN is configured."""
    dsn = settings.SENTRY_DSN
    if not dsn:
        logger.info("SENTRY_DSN not set — Sentry disabled for %s", service_name)
        return
    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration

        sentry_sdk.init(
            dsn=dsn,
            traces_sample_rate=settings.SENTRY_TRACES_SAMPLE_RATE,
            environment=settings.ENVIRONMENT,
            release=f"Proline Markets-{service_name}@1.0.0",
            integrations=[
                FastApiIntegration(transaction_style="endpoint"),
                SqlalchemyIntegration(),
            ],
            send_default_pii=False,
        )
        logger.info("Sentry initialised for %s (env=%s)", service_name, settings.ENVIRONMENT)
    except Exception as exc:
        logger.warning("Failed to initialise Sentry: %s", exc)


# ---------------------------------------------------------------------------
# 2. Rate Limiting (slowapi)
# ---------------------------------------------------------------------------
_limiter_instance = None


def get_rate_limiter():
    """Return a singleton SlowAPI Limiter instance."""
    global _limiter_instance
    if _limiter_instance is None:
        from slowapi import Limiter
        from slowapi.util import get_remote_address
        _limiter_instance = Limiter(
            key_func=get_remote_address,
            default_limits=[settings.RATE_LIMIT_DEFAULT],
            storage_uri=settings.REDIS_URL,
        )
    return _limiter_instance


def add_rate_limit_handler(app):
    """Attach SlowAPI exception handler to the app."""
    from slowapi.errors import RateLimitExceeded
    from slowapi.middleware import SlowAPIMiddleware

    limiter = get_rate_limiter()
    app.state.limiter = limiter
    app.add_middleware(SlowAPIMiddleware)

    @app.exception_handler(RateLimitExceeded)
    async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
        return JSONResponse(
            status_code=429,
            content={"detail": "Rate limit exceeded. Please slow down."},
        )


# ---------------------------------------------------------------------------
# 3. Request Body Size Limit Middleware
# ---------------------------------------------------------------------------
class RequestSizeLimitMiddleware(BaseHTTPMiddleware):
    """Reject requests whose Content-Length exceeds MAX_REQUEST_SIZE."""

    async def dispatch(self, request: Request, call_next):
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > settings.MAX_REQUEST_SIZE:
            return JSONResponse(
                status_code=413,
                content={"detail": f"Request body too large. Max {settings.MAX_REQUEST_SIZE // (1024*1024)} MB."},
            )
        return await call_next(request)


# ---------------------------------------------------------------------------
# 4. Prometheus Metrics Middleware
# ---------------------------------------------------------------------------
try:
    from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST

    REQUEST_COUNT = Counter(
        "http_requests_total",
        "Total HTTP requests",
        ["method", "endpoint", "status"],
    )
    REQUEST_LATENCY = Histogram(
        "http_request_duration_seconds",
        "HTTP request latency",
        ["method", "endpoint"],
    )
    _PROM_AVAILABLE = True
except ImportError:
    _PROM_AVAILABLE = False


class PrometheusMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if not _PROM_AVAILABLE:
            return await call_next(request)

        method = request.method
        path = request.url.path
        start = time.perf_counter()
        response = await call_next(request)
        duration = time.perf_counter() - start

        # Normalize path to avoid high-cardinality labels
        endpoint = path.split("?")[0]
        if len(endpoint) > 80:
            endpoint = endpoint[:80]

        REQUEST_COUNT.labels(method=method, endpoint=endpoint, status=response.status_code).inc()
        REQUEST_LATENCY.labels(method=method, endpoint=endpoint).observe(duration)
        return response


def add_metrics_endpoint(app):
    """Add /metrics endpoint for Prometheus scraping."""
    if not _PROM_AVAILABLE:
        return

    @app.get("/metrics", include_in_schema=False)
    async def metrics():
        return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)


# ---------------------------------------------------------------------------
# 5. Structured Request Logging Middleware
# ---------------------------------------------------------------------------
class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start = time.perf_counter()
        response = await call_next(request)
        duration_ms = (time.perf_counter() - start) * 1000

        if not request.url.path.startswith(("/health", "/metrics")):
            logger.info(
                "%s %s %d %.1fms",
                request.method,
                request.url.path,
                response.status_code,
                duration_ms,
            )
        return response


# ---------------------------------------------------------------------------
# Convenience: add the full middleware stack at once
# ---------------------------------------------------------------------------
def add_middleware_stack(app, *, include_rate_limit: bool = False):
    """Add all production middleware to a FastAPI app.

    Call AFTER app creation, BEFORE including routers.
    Middleware is applied in reverse order (last added runs first).

    NOTE: rate limiting is DISABLED by default — the global SlowAPI limiter
    caused 429s on legitimate authenticated traffic (shared NAT IPs, CDN
    fan-out). Pass include_rate_limit=True to re-enable; individual endpoints
    still have per-bucket rate_limit_http() guards where needed.
    """
    app.add_middleware(RequestLoggingMiddleware)
    app.add_middleware(PrometheusMiddleware)
    app.add_middleware(RequestSizeLimitMiddleware)
    add_metrics_endpoint(app)
    if include_rate_limit:
        add_rate_limit_handler(app)
