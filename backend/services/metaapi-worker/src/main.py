"""MetaApi (MT5) mirror worker.

Streams ONE MetaApi account's live open positions + account balance and mirrors
them, read-only, into the platform `positions` table for the platform trading
account whose account_number == settings.METAAPI_PLATFORM_ACCOUNT_NUMBER.

The platform's existing positions display (GET /positions + terminal poll) then
shows the MT5 trades automatically, tagged "MT5|<ticket>" (comment) so the
gateway renders an MT5 badge, hides Close, and shows MT5's own price/P&L.
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
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)-5s [metaapi-worker] %(message)s")
logger = logging.getLogger("metaapi-worker")

settings = get_settings()
POLL_SECONDS = 2.0


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


async def reconcile(positions: list, account_info: dict) -> None:
    async with AsyncSessionLocal() as db:
        acct_q = await db.execute(
            select(TradingAccount).where(
                TradingAccount.account_number == settings.METAAPI_PLATFORM_ACCOUNT_NUMBER
            )
        )
        acct = acct_q.scalar_one_or_none()
        if not acct:
            logger.warning(
                "platform account_number %s not found — nothing to mirror",
                settings.METAAPI_PLATFORM_ACCOUNT_NUMBER,
            )
            return

        seen_tickets: set[str] = set()
        for p in positions:
            ticket = str(p.get("id"))
            if not ticket:
                continue
            seen_tickets.add(ticket)
            tag = f"MT5|{ticket}"
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

            existing_q = await db.execute(
                select(Position).where(
                    Position.account_id == acct.id,
                    Position.comment == tag,
                    Position.status == "open",
                )
            )
            pos = existing_q.scalar_one_or_none()
            if pos:
                for k, v in fields.items():
                    setattr(pos, k, v)
            else:
                db.add(Position(
                    account_id=acct.id, status=PositionStatus.OPEN, comment=tag, **fields,
                ))

        # Close mirrored rows whose MT5 ticket is no longer open.
        open_q = await db.execute(
            select(Position).where(
                Position.account_id == acct.id,
                Position.status == "open",
            )
        )
        for pos in open_q.scalars().all():
            c = str(pos.comment or "")
            if c.startswith("MT5|"):
                tk = c.split("|", 1)[1]
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


async def run() -> None:
    if not settings.METAAPI_ENABLED:
        logger.info("METAAPI_ENABLED is false — metaapi-worker idle")
        while True:
            await asyncio.sleep(3600)

    if not settings.METAAPI_TOKEN or not settings.METAAPI_ACCOUNT_ID:
        logger.error("METAAPI_TOKEN / METAAPI_ACCOUNT_ID not set — cannot start")
        while True:
            await asyncio.sleep(3600)

    from metaapi_cloud_sdk import MetaApi

    opts = {"region": settings.METAAPI_REGION} if settings.METAAPI_REGION else {}
    api = MetaApi(settings.METAAPI_TOKEN, opts)
    account = await api.metatrader_account_api.get_account(settings.METAAPI_ACCOUNT_ID)

    if getattr(account, "state", None) not in ("DEPLOYED",):
        logger.info("deploying MetaApi account ...")
        try:
            await account.deploy()
        except Exception:
            logger.exception("account.deploy() failed (continuing)")

    logger.info("waiting for MetaApi account connection ...")
    await account.wait_connected()

    connection = account.get_streaming_connection()
    await connection.connect()
    logger.info("waiting for synchronization ...")
    await connection.wait_synchronized({"timeoutInSeconds": 600})
    logger.info("synchronized — mirroring MT5 positions every %ss", POLL_SECONDS)

    while True:
        try:
            ts = connection.terminal_state
            positions = list(getattr(ts, "positions", None) or [])
            account_info = getattr(ts, "account_information", None) or {}
            await reconcile(positions, account_info)
        except Exception:
            logger.exception("reconcile cycle failed")
        await asyncio.sleep(POLL_SECONDS)


def main() -> None:
    try:
        from packages.common.src.instrumentation import init_sentry
        init_sentry("metaapi-worker")
    except Exception:
        pass
    asyncio.run(run())


if __name__ == "__main__":
    main()
