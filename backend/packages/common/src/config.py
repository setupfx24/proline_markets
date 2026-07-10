from functools import lru_cache

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    ENVIRONMENT: str = "development"
    DATABASE_URL: str = "postgresql+asyncpg://Proline Markets:Proline Markets_dev@localhost:5432/Proline Markets"
    TIMESCALE_URL: str = "postgresql+asyncpg://Proline Markets:Proline Markets_dev@localhost:5433/marketdata"
    REDIS_URL: str = "redis://localhost:6379/0"
    KAFKA_BOOTSTRAP_SERVERS: str = "localhost:9092"

    JWT_SECRET: str = "dev-secret-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    # Short-lived access JWT (browser cookie + optional JSON for legacy clients).
    JWT_ACCESS_EXPIRY_MINUTES: int = Field(
        default=45,
        validation_alias=AliasChoices("JWT_ACCESS_EXPIRY_MINUTES", "JWT_EXPIRY_MINUTES"),
    )
    # Refresh token row expiry in DB (rotation); still enforced when validating refresh.
    JWT_REFRESH_EXPIRY_DAYS: int = 7
    # If True, both access + refresh HttpOnly cookies omit Max-Age (browser session cookies).
    # Closing the browser session clears them — user must log in again. If False, cookies use
    # Max-Age (access ~JWT_ACCESS_EXPIRY_MINUTES, refresh JWT_REFRESH_EXPIRY_DAYS) so login
    # survives browser restarts.
    JWT_REFRESH_SESSION_COOKIE: bool = True
    # Still return access_token in login/register JSON (phase out when all clients use cookies only).
    JWT_INCLUDE_LEGACY_JSON_TOKEN: bool = True

    # HttpOnly auth cookies (trader web). Secure derived from request HTTPS unless overridden.
    ACCESS_TOKEN_COOKIE_NAME: str = "pt_access"
    REFRESH_TOKEN_COOKIE_NAME: str = "pt_refresh"
    COOKIE_SAMESITE: str = "strict"  # lax | strict | none
    # If None, Secure flag follows the incoming request (HTTPS / X-Forwarded-Proto).
    COOKIE_SECURE: bool | None = None

    ADMIN_JWT_SECRET: str = "admin-secret-change-in-production"
    ADMIN_JWT_ALGORITHM: str = "HS256"
    ADMIN_JWT_EXPIRY_HOURS: int = 8

    ADMIN_EMAIL: str = "admin@Proline Markets.com"
    ADMIN_PASSWORD: str = "Proline MarketsAdmin2025!"
    USER_JWT_SECRET: str = "dev-secret-change-in-production"
    USER_JWT_ALGORITHM: str = "HS256"

    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:3001"
    CORS_ALLOW_METHODS: str = "GET,POST,PUT,PATCH,DELETE,OPTIONS"
    CORS_ALLOW_HEADERS: str = "Authorization,Content-Type,X-Requested-With,Accept,X-Api-Key,X-Api-Secret"

    # Public trader app URL (password reset links). No trailing slash.
    TRADER_APP_URL: str = "http://localhost:3000"

    # Optional SMTP — required for password-reset emails in non-dev. If SMTP_HOST is empty, reset links are only logged in development.
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = ""
    SMTP_USE_TLS: bool = True

    # Market data provider (Infoway.io) — fallback when Corecen LP not configured
    INFOWAY_API_KEY: str = ""
    INFOWAY_API_URL: str = "https://api.infoway.io"

    # Corecen LP (primary market data source). When CORECEN_LP_ENABLED=true the
    # market-data service stops running its own Infoway / simulator feed and
    # consumes ticks pushed from Corecen via POST /api/lp/prices/batch (HMAC).
    CORECEN_LP_ENABLED: bool = False
    # HMAC credentials — must match Proline Markets_API_KEY / Proline Markets_API_SECRET in the Corecen .env.
    CORECEN_LP_API_KEY: str = ""
    CORECEN_LP_API_SECRET: str = ""
    # Reject pushes older than this many ms (same tolerance as Corecen's HMAC middleware).
    CORECEN_LP_TIMESTAMP_TOLERANCE_MS: int = 60_000

    # Corecen Broker API (A-Book trade forwarding). When an A-Book user opens/closes
    # a position, Proline Markets pushes the trade to Corecen's broker API for LP routing.
    # These credentials are the API key/secret registered in Corecen's admin panel
    # for the Proline Markets broker account.
    CORECEN_BROKER_API_URL: str = ""       # e.g. https://api.corecen.com
    CORECEN_BROKER_API_KEY: str = ""       # ck_... from Corecen broker API keys
    CORECEN_BROKER_API_SECRET: str = ""    # cs_... from Corecen broker API keys

    MARGIN_CALL_LEVEL: float = 80.0
    STOP_OUT_LEVEL: float = 50.0
    MAX_OPEN_TRADES: int = 200
    DEFAULT_LEVERAGE: int = 100

    # Sentry error tracking (leave empty to disable)
    SENTRY_DSN: str = ""
    SENTRY_TRACES_SAMPLE_RATE: float = 0.1

    # Rate limiting DISABLED — add_middleware_stack skips the SlowAPI limiter
    # by default and rate_limit_http() in auth_service is now a no-op. These
    # values are kept only so env parsing doesn't break if they're set.
    RATE_LIMIT_DEFAULT: str = "1000000/minute"
    RATE_LIMIT_AUTH: str = "1000000/minute"
    RATE_LIMIT_TRADING: str = "1000000/minute"

    # Request body size limit (bytes) — 10 MB default
    MAX_REQUEST_SIZE: int = 10 * 1024 * 1024

    # OxaPay crypto payment gateway
    OXAPAY_MERCHANT_KEY: str = ""
    OXAPAY_SANDBOX: bool = False
    OXAPAY_CALLBACK_BASE_URL: str = ""  # public gateway URL for webhooks, e.g. "https://api.yourdomain.com"

    # Absolute path recommended in production (writable volume). Relative paths are resolved from gateway CWD.
    KYC_UPLOAD_ROOT: str = "uploads/kyc"
    # Deposit proof screenshots + user payout QR for manual withdrawals (gateway). Mount same path in admin for review.
    WALLET_UPLOAD_ROOT: str = "uploads/wallet"

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
