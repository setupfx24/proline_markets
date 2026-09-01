import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from packages.common.src.config import get_settings
from packages.common.src.database import engine
from packages.common.src.instrumentation import init_sentry, add_middleware_stack

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)-5s [%(name)s] %(message)s")
logger = logging.getLogger("admin-api")

from routes import (
    auth, dashboard, users, trades, deposits, banks, book,
    config as routes_config, instruments_admin, business, social, analytics, bonus, banners,
    support, employees, settings, transactions, kyc, account_types, user_audit_logs,
    investor_access, notifications, mt5_links, managed_accounts, manual_trades,
)

app_settings = get_settings()
init_sentry("admin-api")

_cors_origins = [
    o.strip()
    for o in app_settings.CORS_ORIGINS.split(",")
    if o.strip()
]
if not _cors_origins:
    _cors_origins = ["http://localhost:3001"]
_cors_methods = [m.strip() for m in app_settings.CORS_ALLOW_METHODS.split(",") if m.strip()]
_cors_headers = [h.strip() for h in app_settings.CORS_ALLOW_HEADERS.split(",") if h.strip()]


async def _apply_startup_ddl():
    """Idempotent ALTERs that unblock admin endpoints when manual migrations
    haven't been run yet on a host (Render/Vercel/etc.). Safe to re-run."""
    from sqlalchemy import text
    try:
        async with engine.begin() as conn:
            await conn.execute(text(
                "ALTER TABLE employees ADD COLUMN IF NOT EXISTS extra_permissions JSONB DEFAULT '[]'::jsonb"
            ))
            # Book-management LP settings read/write this table. Create if the
            # baseline migration hasn't been applied so GET/PUT don't 500.
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS system_settings (
                    key VARCHAR(100) PRIMARY KEY,
                    value JSONB NOT NULL,
                    description TEXT,
                    updated_by UUID REFERENCES users(id),
                    updated_at TIMESTAMPTZ DEFAULT now()
                )
            """))
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS algo_api_keys (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                    account_id UUID REFERENCES trading_accounts(id) ON DELETE CASCADE,
                    api_key VARCHAR(64) UNIQUE NOT NULL,
                    secret_hash VARCHAR(128) NOT NULL,
                    label VARCHAR(100) DEFAULT '',
                    is_active BOOLEAN DEFAULT true,
                    last_used_at TIMESTAMPTZ,
                    trades_count INTEGER DEFAULT 0,
                    created_at TIMESTAMPTZ DEFAULT now()
                )
            """))
            await conn.execute(text(
                "CREATE INDEX IF NOT EXISTS idx_algo_api_keys_api_key ON algo_api_keys(api_key)"
            ))
            await conn.execute(text(
                "ALTER TABLE algo_api_keys ADD COLUMN IF NOT EXISTS api_secret VARCHAR(128)"
            ))
            # MT5 account links (MetaApi → platform account mappings). Create if
            # migration 0020 hasn't been applied so the admin CRUD doesn't 500.
            # Managed (synthetic) client accounts — stores the generation config
            # so the "Managed Accounts" admin page can list/edit/regenerate. Create
            # if the migration hasn't been applied so the CRUD doesn't 500.
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS managed_accounts (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    account_id UUID REFERENCES trading_accounts(id) ON DELETE SET NULL,
                    email VARCHAR(255) NOT NULL,
                    label VARCHAR(160),
                    config JSONB NOT NULL,
                    final_balance NUMERIC(18,8) DEFAULT 0,
                    trades_count INTEGER DEFAULT 0,
                    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
                    created_at TIMESTAMPTZ DEFAULT now(),
                    updated_at TIMESTAMPTZ DEFAULT now()
                )
            """))
            await conn.execute(text(
                "CREATE INDEX IF NOT EXISTS idx_managed_accounts_email ON managed_accounts(email)"
            ))
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS mt5_account_links (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    metaapi_account_id VARCHAR(64) UNIQUE NOT NULL,
                    platform_account_number VARCHAR(20) NOT NULL,
                    region VARCHAR(40),
                    mode VARCHAR(10) DEFAULT 'mirror',
                    enabled BOOLEAN DEFAULT true,
                    status VARCHAR(20) DEFAULT 'pending',
                    last_error TEXT,
                    last_sync_at TIMESTAMPTZ,
                    label VARCHAR(100) DEFAULT '',
                    created_at TIMESTAMPTZ DEFAULT now(),
                    updated_at TIMESTAMPTZ DEFAULT now()
                )
            """))
            # positions.mt5_link_id — every engine filters on it, so a missing
            # column 500s the whole platform. Migration 0021 owns the backfill;
            # this is only the shape, in case migrations haven't been run yet.
            await conn.execute(text(
                "ALTER TABLE positions ADD COLUMN IF NOT EXISTS mt5_link_id UUID"
            ))
            await conn.execute(text("""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint WHERE conname = 'fk_positions_mt5_link'
                    ) THEN
                        ALTER TABLE positions
                            ADD CONSTRAINT fk_positions_mt5_link
                            FOREIGN KEY (mt5_link_id) REFERENCES mt5_account_links(id)
                            ON DELETE RESTRICT;
                    END IF;
                END $$;
            """))
            await conn.execute(text(
                "CREATE INDEX IF NOT EXISTS idx_positions_mt5_link "
                "ON positions(mt5_link_id) WHERE mt5_link_id IS NOT NULL"
            ))
            await conn.execute(text(
                "CREATE INDEX IF NOT EXISTS idx_positions_acct_comment "
                "ON positions(account_id, comment)"
            ))
            # Outbound bridge columns (migration 0022 owns the data changes).
            for ddl in (
                "ALTER TABLE mt5_account_links ADD COLUMN IF NOT EXISTS outbound_mode VARCHAR(10) DEFAULT 'off'",
                "ALTER TABLE mt5_account_links ADD COLUMN IF NOT EXISTS max_lots NUMERIC(10,4)",
                "ALTER TABLE positions ADD COLUMN IF NOT EXISTS mt5_out_ticket VARCHAR(40)",
                "ALTER TABLE positions ADD COLUMN IF NOT EXISTS mt5_out_state VARCHAR(16)",
                "ALTER TABLE positions ADD COLUMN IF NOT EXISTS mt5_out_error TEXT",
                # Investor Access shows the generated password in its table
                # (migration 0024 owns it); without the column every list 500s.
                "ALTER TABLE investor_access ADD COLUMN IF NOT EXISTS password_plain VARCHAR(255)",
                "CREATE INDEX IF NOT EXISTS idx_positions_mt5_out "
                "ON positions(mt5_out_ticket) WHERE mt5_out_ticket IS NOT NULL",
                # 'two_way' silently behaved as mirror and disabled reverse.
                "UPDATE mt5_account_links SET mode='mirror' WHERE mode='two_way'",
                "UPDATE mt5_account_links SET outbound_mode='off' WHERE outbound_mode IS NULL",
            ):
                await conn.execute(text(ddl))
            # Backfill attribution from the legacy "MT5|<acct>|<ticket>" comment tag.
            # Migration 0021 does this too, but migrations are a manual profile —
            # without this, a deploy that skips them leaves every existing mirrored
            # row with a NULL link, which is exactly what the engines use to decide
            # a row is theirs to close. Idempotent and bounded by the NULL check.
            await conn.execute(text("""
                UPDATE positions p
                SET mt5_link_id = m.link_id
                FROM (
                    SELECT DISTINCT ON (a.id)
                           a.id AS account_id, a.account_number, l.id AS link_id
                    FROM trading_accounts a
                    JOIN mt5_account_links l ON l.platform_account_number = a.account_number
                    ORDER BY a.id, l.created_at ASC
                ) m
                WHERE p.account_id = m.account_id
                  AND p.mt5_link_id IS NULL
                  AND p.comment LIKE 'MT5|' || m.account_number || '|%'
            """))
    except Exception as e:
        logger.warning("startup DDL skipped: %s", e)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await _apply_startup_ddl()
    yield
    await engine.dispose()


app = FastAPI(
    title="ProTrader Admin API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if app_settings.ENVIRONMENT == "development" else None,
    redoc_url="/redoc" if app_settings.ENVIRONMENT == "development" else None,
    openapi_url="/openapi.json" if app_settings.ENVIRONMENT == "development" else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=_cors_methods,
    allow_headers=_cors_headers,
)

add_middleware_stack(app)


@app.exception_handler(Exception)
async def unhandled_exception(request: Request, exc: Exception):
    """Return JSON (not plain text) so proxies and the admin UI can parse errors."""
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


prefix = "/api/v1/admin"

app.include_router(auth.router, prefix=prefix)
app.include_router(dashboard.router, prefix=prefix)
app.include_router(users.router, prefix=prefix)
app.include_router(trades.router, prefix=prefix)
app.include_router(book.router, prefix=prefix)
app.include_router(deposits.router, prefix=prefix)
app.include_router(banks.router, prefix=prefix)
app.include_router(routes_config.router, prefix=prefix)
app.include_router(instruments_admin.router, prefix=prefix)
app.include_router(business.router, prefix=prefix)
app.include_router(social.router, prefix=prefix)
app.include_router(analytics.router, prefix=prefix)
app.include_router(bonus.router, prefix=prefix)
app.include_router(banners.router, prefix=prefix)
app.include_router(support.router, prefix=prefix)
app.include_router(employees.router, prefix=prefix)
app.include_router(settings.router, prefix=prefix)
app.include_router(transactions.router, prefix=prefix)
app.include_router(kyc.router, prefix=prefix)
app.include_router(account_types.router, prefix=prefix)
app.include_router(user_audit_logs.router, prefix=prefix)
app.include_router(investor_access.router, prefix=prefix)
app.include_router(notifications.router, prefix=prefix)
app.include_router(mt5_links.router, prefix=prefix)
app.include_router(managed_accounts.router, prefix=prefix)
app.include_router(manual_trades.router, prefix=prefix)


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "admin"}
