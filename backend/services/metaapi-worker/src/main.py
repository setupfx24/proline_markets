"""MetaApi (MT5) multi-account mirror worker.

Reads the admin-managed `mt5_account_links` table and, for EVERY enabled row,
streams that MetaApi account's live open positions + account balance and mirrors
them into the platform trading account whose account_number ==
link.platform_account_number.

Mirrored positions are tagged "MT5|<platform_account_number>|<ticket>" in the
`comment` column so the gateway renders an MT5 badge, hides Close (mirror mode),
and shows MT5's own price/P&L. The list is DYNAMIC: rows added/removed/toggled in
the admin panel are picked up on a periodic refresh — no redeploy needed.

Phase 1 = read-only mirror (this file). `mode='two_way'` (outbound order bridge)
is Phase 2 and not yet wired here.
"""
import asyncio
import logging
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import select

from packages.common.src.config import get_settings
from packages.common.src.database import AsyncSessionLocal
from packages.common.src.models import (
    Position, TradingAccount, Instrument, OrderSide, PositionStatus,
    MT5AccountLink, SystemSetting,
)

# Global MetaApi config is managed from the admin panel (MT5-Connect) and stored
# in system_settings under this key; env vars are the fallback.
CONFIG_KEY = "metaapi_config"

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)-5s [metaapi-worker] %(message)s")
logger = logging.getLogger("metaapi-worker")

settings = get_settings()
POLL_SECONDS = 2.0       # how often each account's terminal state is mirrored
REFRESH_SECONDS = 30.0   # how often the enabled-links list is re-read from DB


def _norm_symbol(raw: str) -> str:
    """Normalize a broker symbol to the platform symbol (strip suffix like .m)."""
    s = (raw or "").upper().strip()
    return s.split(".")[0] if "." in s else s


def _dec(v, default="0") -> Decimal:
    try:
        return Decimal(str(v if v is not None else default))
    except Exception:
        return Decimal(default)


async def _get_or_create_instrument(db, symbol: str) -> Instrument:
    q = await db.execute(select(Instrument).where(Instrument.symbol == symbol))
    inst = q.scalar_one_or_none()
    if inst:
        return inst
    inst = Instrument(
        symbol=symbol, display_name=symbol,
        contract_size=Decimal("100000"), digits=5, is_active=True,
    )
    db.add(inst)
    await db.flush()
    logger.info("auto-created instrument for MT5 symbol %s", symbol)
    return inst


async def _load_config() -> dict:
    """Read the global MetaApi config from system_settings (admin panel),
    falling back to env vars. Read fresh from the DB each refresh cycle so the
    admin can enable/disable or change the token without a redeploy."""
    token = settings.METAAPI_TOKEN
    enabled = settings.METAAPI_ENABLED
    region = settings.METAAPI_REGION
    try:
        async with AsyncSessionLocal() as db:
            row = (await db.execute(
                select(SystemSetting).where(SystemSetting.key == CONFIG_KEY)
            )).scalar_one_or_none()
            if row and isinstance(row.value, dict):
                v = row.value
                if v.get("token"):
                    token = v["token"]
                enabled = bool(v.get("enabled", enabled))
                if v.get("region"):
                    region = v["region"]
    except Exception:
        logger.exception("failed to load metaapi_config")
    return {"token": token or "", "enabled": bool(enabled), "region": region or ""}


async def _load_enabled_links() -> list[dict]:
    async with AsyncSessionLocal() as db:
        rows = (await db.execute(
            select(MT5AccountLink).where(MT5AccountLink.enabled == True)  # noqa: E712
        )).scalars().all()
        return [
            dict(
                metaapi_account_id=r.metaapi_account_id,
                platform_account_number=r.platform_account_number,
                region=r.region,
                mode=r.mode,
            )
            for r in rows
        ]


async def _set_link_status(metaapi_account_id: str, status: str, error: str | None = None) -> None:
    try:
        async with AsyncSessionLocal() as db:
            link = (await db.execute(
                select(MT5AccountLink).where(MT5AccountLink.metaapi_account_id == metaapi_account_id)
            )).scalar_one_or_none()
            if not link:
                return
            link.status = status
            link.last_error = (error or "")[:1000] if error else None
            if status == "connected":
                link.last_sync_at = datetime.now(timezone.utc)
            await db.commit()
    except Exception:
        logger.exception("[%s] failed to write link status", metaapi_account_id)


async def reconcile(platform_account_number: str, positions: list, account_info: dict) -> None:
    """Mirror one MT5 account's open positions + balance into its platform account.

    Only touches rows tagged for THIS platform account (MT5|<acct>|...), so native
    positions and other MT5 accounts are never affected. Idempotent.
    """
    async with AsyncSessionLocal() as db:
        acct = (await db.execute(
            select(TradingAccount).where(TradingAccount.account_number == platform_account_number)
        )).scalar_one_or_none()
        if not acct:
            logger.warning("platform account_number %s not found — skipping", platform_account_number)
            return

        prefix = f"MT5|{platform_account_number}|"
        seen_tickets: set[str] = set()
        for p in positions:
            ticket = str(p.get("id") or "")
            if not ticket:
                continue
            seen_tickets.add(ticket)
            tag = f"{prefix}{ticket}"
            symbol = _norm_symbol(p.get("symbol", ""))
            if not symbol:
                continue
            inst = await _get_or_create_instrument(db, symbol)
            side = OrderSide.BUY if "BUY" in str(p.get("type", "")).upper() else OrderSide.SELL

            fields = dict(
                instrument_id=inst.id,
                side=side,
                lots=_dec(p.get("volume")),
                open_price=_dec(p.get("openPrice")),
                external_price=_dec(p.get("currentPrice", p.get("openPrice"))),
                profit=_dec(p.get("profit", p.get("unrealizedProfit"))),
                stop_loss=_dec(p["stopLoss"]) if p.get("stopLoss") else None,
                take_profit=_dec(p["takeProfit"]) if p.get("takeProfit") else None,
                swap=_dec(p.get("swap")),
                commission=_dec(p.get("commission")),
            )

            pos = (await db.execute(
                select(Position).where(
                    Position.account_id == acct.id,
                    Position.comment == tag,
                    Position.status == "open",
                )
            )).scalar_one_or_none()
            if pos:
                for k, v in fields.items():
                    setattr(pos, k, v)
            else:
                db.add(Position(
                    account_id=acct.id, status=PositionStatus.OPEN, comment=tag, **fields,
                ))

        # Close mirrored rows (for THIS account) whose MT5 ticket is no longer open.
        open_rows = (await db.execute(
            select(Position).where(
                Position.account_id == acct.id,
                Position.status == "open",
            )
        )).scalars().all()
        for pos in open_rows:
            c = str(pos.comment or "")
            if c.startswith(prefix):
                tk = c[len(prefix):]
                if tk not in seen_tickets:
                    pos.status = PositionStatus.CLOSED
                    pos.closed_at = datetime.now(timezone.utc)

        # Mirror MT5 account balances onto the platform account.
        if account_info:
            acct.balance = _dec(account_info.get("balance", acct.balance))
            acct.equity = _dec(account_info.get("equity", acct.equity))
            acct.margin_used = _dec(account_info.get("margin", acct.margin_used))
            acct.free_margin = _dec(account_info.get("freeMargin", acct.free_margin))

        await db.commit()


async def run_account(api, metaapi_account_id: str, platform_account_number: str,
                      stop_event: asyncio.Event) -> None:
    """Connect one MetaApi account and mirror it until stop_event is set."""
    try:
        account = await api.metatrader_account_api.get_account(metaapi_account_id)

        if getattr(account, "state", None) not in ("DEPLOYED",):
            logger.info("[%s] deploying MetaApi account ...", metaapi_account_id)
            try:
                await account.deploy()
            except Exception:
                logger.exception("[%s] account.deploy() failed (continuing)", metaapi_account_id)

        logger.info("[%s] waiting for connection ...", metaapi_account_id)
        await account.wait_connected()

        connection = account.get_streaming_connection()
        await connection.connect()
        logger.info("[%s] waiting for synchronization ...", metaapi_account_id)
        await connection.wait_synchronized({"timeoutInSeconds": 600})
        logger.info("[%s] synchronized — mirroring into platform account %s every %ss",
                    metaapi_account_id, platform_account_number, POLL_SECONDS)
        await _set_link_status(metaapi_account_id, "connected")

        while not stop_event.is_set():
            try:
                ts = connection.terminal_state
                positions = list(getattr(ts, "positions", None) or [])
                account_info = getattr(ts, "account_information", None) or {}
                await reconcile(platform_account_number, positions, account_info)
                await _set_link_status(metaapi_account_id, "connected")
            except Exception as e:
                logger.exception("[%s] reconcile cycle failed", metaapi_account_id)
                await _set_link_status(metaapi_account_id, "error", str(e))
            await asyncio.sleep(POLL_SECONDS)
    except asyncio.CancelledError:
        logger.info("[%s] worker stopped", metaapi_account_id)
        raise
    except Exception as e:
        logger.exception("[%s] account worker crashed", metaapi_account_id)
        await _set_link_status(metaapi_account_id, "error", str(e))


def _sig(link: dict) -> tuple:
    """Identity of a link's connection config — changing any of these restarts it."""
    return (link["platform_account_number"], link.get("region") or "", link.get("mode") or "mirror")


def _stop_all(workers: dict) -> None:
    for aid in list(workers):
        workers[aid]["stop"].set()
        workers[aid]["task"].cancel()
        del workers[aid]


async def manager() -> None:
    """Config-driven supervisor. Every REFRESH_SECONDS it re-reads the global
    MetaApi config + the enabled links and reconciles the running task set:
      - disabled / no token  → stop everything (idle)
      - token changed        → restart all connections with the new token
      - links added/removed/changed → start/stop just those
    All of this is admin-panel driven; no redeploy needed."""
    from metaapi_cloud_sdk import MetaApi

    workers: dict[str, dict] = {}  # metaapi_account_id -> {task, stop, sig}
    current_token: str | None = None
    idle_logged = False

    while True:
        cfg = await _load_config()

        if not cfg["enabled"] or not cfg["token"]:
            if workers:
                logger.info("MT5 disabled or no token — stopping %d worker(s)", len(workers))
                _stop_all(workers)
            current_token = None
            if not idle_logged:
                logger.info("metaapi-worker idle (enable + token via admin MT5-Connect)")
                idle_logged = True
            await asyncio.sleep(REFRESH_SECONDS)
            continue
        idle_logged = False

        # Token changed → every connection must be rebuilt with the new token.
        if current_token is not None and cfg["token"] != current_token:
            logger.info("MetaApi token changed — restarting all connections")
            _stop_all(workers)
        current_token = cfg["token"]
        default_region = cfg["region"]

        try:
            links = await _load_enabled_links()
        except Exception:
            logger.exception("failed to load mt5_account_links")
            links = []
        wanted = {l["metaapi_account_id"]: l for l in links}

        # Stop workers that were removed, disabled, or reconfigured.
        for aid in list(workers):
            if aid not in wanted or workers[aid]["sig"] != _sig(wanted[aid]):
                logger.info("[%s] stopping worker (removed/changed)", aid)
                workers[aid]["stop"].set()
                workers[aid]["task"].cancel()
                del workers[aid]

        # Start workers for new/changed links.
        for aid, link in wanted.items():
            if aid in workers:
                continue
            stop_event = asyncio.Event()
            region = link.get("region") or default_region
            opts = {"region": region} if region else {}
            api = MetaApi(current_token, opts)
            task = asyncio.create_task(
                run_account(api, aid, link["platform_account_number"], stop_event)
            )
            workers[aid] = {"task": task, "stop": stop_event, "sig": _sig(link)}
            logger.info("[%s] starting worker → platform account %s",
                        aid, link["platform_account_number"])

        await asyncio.sleep(REFRESH_SECONDS)


async def run() -> None:
    logger.info("metaapi-worker starting (multi-account, admin-panel driven)")
    await manager()


def main() -> None:
    try:
        from packages.common.src.instrumentation import init_sentry
        init_sentry("metaapi-worker")
    except Exception:
        pass
    asyncio.run(run())


if __name__ == "__main__":
    main()
