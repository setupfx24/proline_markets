"""MetaApi (MT5) multi-account mirror worker.

Reads the admin-managed `mt5_account_links` table and, for EVERY enabled row,
streams that MetaApi account's live open positions + account balance into the
platform trading account whose account_number == link.platform_account_number.

Two modes, per link:
  * mode='mirror'  — same side, same P&L. A read-only reflection of MT5.
  * mode='reverse' — the OPPOSITE side with the P&L negated: MT5 BUY XAUUSD
                     becomes a platform SELL XAUUSD showing −(MT5's profit), so
                     the platform holds the exact inverse of the MT5 book.

Mirrored positions carry `mt5_link_id` (which link produced them — the basis for
every "skip MT5 rows" guard and the admin's per-account filter) and are tagged
"MT5|<platform_account_number>|<ticket>" in `comment` so the gateway renders an
MT5 badge, hides Close, and shows MT5's own price/P&L. The list is DYNAMIC: rows
added/removed/toggled in the admin panel are picked up on a periodic refresh —
no redeploy needed.

MT5 owns the exit: SL/TP are deliberately never copied onto mirrored rows, and
the platform's own SL/TP, b-book and stop-out engines skip them.

`mode='two_way'` (outbound order bridge) is still not wired here.
"""
import asyncio
import logging
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import and_, or_, select

from packages.common.src.config import get_settings
from packages.common.src.database import AsyncSessionLocal
from packages.common.src.models import (
    Position, TradingAccount, Instrument, OrderSide, PositionStatus,
    MT5AccountLink, SystemSetting, TradeHistory,
)

# Global MetaApi config is managed from the admin panel (MT5-Connect) and stored
# in system_settings under this key; env vars are the fallback.
CONFIG_KEY = "metaapi_config"

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)-5s [metaapi-worker] %(message)s")
logger = logging.getLogger("metaapi-worker")

settings = get_settings()
POLL_SECONDS = 2.0       # how often each account's terminal state is mirrored
REFRESH_SECONDS = 30.0   # how often the enabled-links list is re-read from DB

# Every call that goes out over the MetaApi websocket is bounded. The SDK's own
# resubscribe task can die on its own internal bug (a KeyError while handling a
# TooManyRequestsException) and leave the connection a zombie: still "open", but
# no RPC ever resolves. Without a ceiling, one order call then blocks the bridge
# cycle forever and the link goes silently dead in BOTH directions. (2026-08-05)
ORDER_TIMEOUT = 30.0

# If a link's task hasn't finished a bridge cycle in this long it is presumed
# wedged and gets rebuilt. Generous next to POLL_SECONDS so a slow sync or a
# momentary DB stall never triggers it.
STALL_SECONDS = 120.0

# Ceiling on the restart backoff for a link that keeps failing.
RETRY_MAX_SECONDS = 300.0


def _norm_symbol(raw: str) -> str:
    """Normalize a broker symbol to the platform symbol (strip suffix like .m)."""
    s = (raw or "").upper().strip()
    return s.split(".")[0] if "." in s else s


def _dec(v, default="0") -> Decimal:
    try:
        return Decimal(str(v if v is not None else default))
    except Exception:
        return Decimal(default)


# link.mode values that invert the book.
REVERSE_MODES = {"reverse"}

# Stamped on every order this worker sends to MT5. The inbound side skips any
# MT5 position carrying it — without that, an outbound trade comes straight back
# through reconcile() and gets punched into the platform a second time.
OUTBOUND_MAGIC = 770001
# Orders carry ONLY the magic number. clientId went through two rounds of
# "Validation failed — Value must match required pattern" from MetaApi (first
# with a hyphen, then plain alphanumeric), and it buys nothing: the ticket comes
# back in the trade response and is stored on the position, and MT5 carries the
# magic on the position itself, which is what _is_ours() reads.
OUTBOUND_CLIENT_PREFIX = "PLX"

# Broker symbol aliases for OUTBOUND orders. Inbound normalises the broker's own
# name (XAUUSD.m → XAUUSD); going the other way we have to find whatever this
# broker actually calls the instrument, and plenty of them use GOLD/SILVER.
_OUTBOUND_ALIASES = {
    "XAUUSD": ("XAUUSD", "GOLD", "GOLDUSD", "XAUUSDM"),
    "XAGUSD": ("XAGUSD", "SILVER", "SILVERUSD"),
    "XPTUSD": ("XPTUSD", "PLATINUM"),
    "USOIL":  ("USOIL", "WTI", "XTIUSD", "CRUDE", "CRUDEOIL", "OIL"),
    "UKOIL":  ("UKOIL", "BRENT", "XBRUSD"),
    "NATGAS": ("NATGAS", "XNGUSD", "NGAS"),
    "US30":   ("US30", "DJ30", "DOW", "US30USD"),
    "US500":  ("US500", "SPX500", "SP500"),
    "NAS100": ("NAS100", "US100", "USTEC", "NASDAQ100"),
    "US100":  ("US100", "NAS100", "USTEC"),
    "UK100":  ("UK100", "FTSE100", "FTSE"),
    "GER40":  ("GER40", "DE40", "DAX40", "GER30", "DAX"),
    "JPN225": ("JPN225", "JP225", "NIKKEI"),
    "AUS200": ("AUS200", "AU200", "ASX200"),
}


def _resolve_broker_symbol(symbol: str, broker_symbols: dict[str, str]) -> str:
    """Platform symbol → the name this broker will accept on an order."""
    for candidate in _OUTBOUND_ALIASES.get(symbol, (symbol,)):
        hit = broker_symbols.get(candidate)
        if hit:
            return hit
    return broker_symbols.get(symbol, symbol)


def _err_text(e: Exception) -> str:
    """MetaApi raises ValidationError with the useful part hidden in .details —
    the message alone is just 'Validation failed, check error.details'."""
    parts = [str(e)]
    for attr in ("details", "detail"):
        d = getattr(e, attr, None)
        if d:
            parts.append(f"{attr}={d}")
    return " | ".join(parts)

# Signed MT5 fields that flip with the position's direction. `commission` is a
# per-execution fee the counterparty book still pays, so it is NOT flipped.
INVERTED_MONEY_FIELDS = ("profit", "swap")

# contract_size / digits for symbols where the FX default is plainly wrong.
# Consulted ONLY when auto-creating an instrument that doesn't exist yet.
_INSTRUMENT_DEFAULTS = {
    "XAUUSD": (Decimal("100"), 2),
    "XAGUSD": (Decimal("5000"), 3),
    "XPTUSD": (Decimal("100"), 2),
    "USOIL":  (Decimal("1000"), 3),
    "UKOIL":  (Decimal("1000"), 3),
    "NATGAS": (Decimal("10000"), 3),
    "BTCUSD": (Decimal("1"), 2),
    "ETHUSD": (Decimal("1"), 2),
    "US30":   (Decimal("1"), 1),
    "US500":  (Decimal("1"), 1),
    "NAS100": (Decimal("1"), 1),
    "US100":  (Decimal("1"), 1),
    "UK100":  (Decimal("1"), 1),
    "GER40":  (Decimal("1"), 1),
    "JPN225": (Decimal("1"), 1),
    "AUS200": (Decimal("1"), 1),
}


def _opposite(side: OrderSide) -> OrderSide:
    return OrderSide.SELL if side == OrderSide.BUY else OrderSide.BUY


def _is_ours(p: dict) -> bool:
    """True when this MT5 position is one WE opened via the outbound bridge."""
    try:
        if int(p.get("magic") or 0) == OUTBOUND_MAGIC:
            return True
    except (TypeError, ValueError):
        pass
    return str(p.get("clientId") or "").startswith(OUTBOUND_CLIENT_PREFIX)


def _broker_symbols(terminal_state) -> dict[str, str]:
    """{normalised symbol → the broker's own name}, e.g. XAUUSD → XAUUSD.m.

    Inbound strips the suffix; outbound has to put it back or the order is
    rejected with "symbol not found". Built from the terminal's own spec list."""
    out: dict[str, str] = {}
    try:
        specs = list(getattr(terminal_state, "specifications", None) or [])
    except Exception:
        return out
    for spec in specs:
        raw = (spec.get("symbol") if isinstance(spec, dict) else getattr(spec, "symbol", "")) or ""
        norm = _norm_symbol(raw)
        # Prefer the exact match if the broker offers both XAUUSD and XAUUSD.m.
        if norm and (norm not in out or raw == norm):
            out[norm] = raw
    return out


async def _get_or_create_instrument(db, symbol: str) -> Instrument:
    q = await db.execute(select(Instrument).where(Instrument.symbol == symbol))
    inst = q.scalar_one_or_none()
    if inst:
        return inst
    contract_size, digits = _INSTRUMENT_DEFAULTS.get(symbol, (Decimal("100000"), 5))
    inst = Instrument(
        symbol=symbol, display_name=symbol,
        contract_size=contract_size, digits=digits, is_active=True,
    )
    db.add(inst)
    await db.flush()
    logger.info("auto-created instrument for MT5 symbol %s (contract_size=%s, digits=%s)",
                symbol, contract_size, digits)
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
                id=r.id,
                metaapi_account_id=r.metaapi_account_id,
                platform_account_number=r.platform_account_number,
                region=r.region,
                mode=r.mode,
                outbound_mode=r.outbound_mode,
                max_lots=r.max_lots,
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


def _close_mirrored(db, pos, now, reason: str = "mt5") -> None:
    """Finalise a mirrored row whose MT5 ticket is gone, and record it in history.

    Balance/margin are deliberately NOT adjusted and NO Transaction row is written:
    this worker overwrites balance/equity/margin_used/free_margin from MT5's own
    account_information every cycle, so a ledger entry here would describe a
    balance move the worker never made and is about to overwrite anyway.
    `pos.profit` already holds the (possibly inverted) number, so history inherits it.
    """
    close_price = pos.external_price if pos.external_price is not None else pos.open_price
    pos.status = PositionStatus.CLOSED
    pos.close_price = close_price
    pos.closed_at = now
    db.add(TradeHistory(
        position_id=pos.id,
        account_id=pos.account_id,
        instrument_id=pos.instrument_id,
        side=pos.side,
        lots=pos.lots,
        open_price=pos.open_price,
        close_price=close_price,
        swap=pos.swap or Decimal("0"),
        commission=pos.commission or Decimal("0"),
        profit=pos.profit or Decimal("0"),
        opened_at=pos.created_at or now,
        closed_at=now,
        close_reason=reason,
    ))


async def reconcile(link_id, platform_account_number: str, mode: str,
                    positions: list, account_info: dict) -> None:
    """Mirror one MT5 account's open positions + balance into its platform account.

    mode='mirror'  → same side, same P&L (a read-only reflection).
    mode='reverse' → OPPOSITE side, P&L negated: the platform holds the exact
                     inverse of the MT5 book.

    Scoped by mt5_link_id, so native positions and other MT5 links are never
    touched. Idempotent — safe to run every POLL_SECONDS.
    """
    reverse = (mode or "mirror").strip().lower() in REVERSE_MODES
    sign = Decimal("-1") if reverse else Decimal("1")

    async with AsyncSessionLocal() as db:
        acct = (await db.execute(
            select(TradingAccount).where(TradingAccount.account_number == platform_account_number)
        )).scalar_one_or_none()
        if not acct:
            logger.warning("platform account_number %s not found — skipping", platform_account_number)
            return

        prefix = f"MT5|{platform_account_number}|"
        now = datetime.now(timezone.utc)
        seen_tickets: set[str] = set()

        for p in positions:
            ticket = str(p.get("id") or "")
            if not ticket:
                continue
            # Our own outbound order, already represented by the platform
            # position that produced it — mirroring it back would duplicate it.
            if _is_ours(p):
                continue
            symbol = _norm_symbol(p.get("symbol", ""))
            if not symbol:
                continue
            seen_tickets.add(ticket)
            tag = f"{prefix}{ticket}"
            inst = await _get_or_create_instrument(db, symbol)

            mt5_side = OrderSide.BUY if "BUY" in str(p.get("type", "")).upper() else OrderSide.SELL
            side = _opposite(mt5_side) if reverse else mt5_side

            money = dict(
                profit=_dec(p.get("profit", p.get("unrealizedProfit"))),
                swap=_dec(p.get("swap")),
                commission=_dec(p.get("commission")),
            )
            for k in INVERTED_MONEY_FIELDS:
                money[k] = sign * money[k]

            fields = dict(
                mt5_link_id=link_id,
                instrument_id=inst.id,
                side=side,
                lots=_dec(p.get("volume")),
                # A price is not a signed quantity — the inverse book entered at
                # the same market level, so open_price is never negated.
                open_price=_dec(p.get("openPrice")),
                # MT5's own current price for the symbol, correct either way.
                external_price=_dec(p.get("currentPrice", p.get("openPrice"))),
                # NEVER copy MT5's protective levels. The platform's SL/TP engines
                # evaluate them against OUR tick feed; on a reversed row an MT5 stop
                # sits on the profit side, so b-book would close the position within
                # 100ms of it being created — and the worker would then re-insert it.
                # MT5 owns the exit; the close sweep below is the only exit path.
                # Kept in the dict (as None) so legacy rows get their levels cleared.
                stop_loss=None,
                take_profit=None,
                **money,
            )

            # Match on the tag WITHOUT a status filter: requiring status=='open'
            # means anything that closes a mirrored row while the MT5 ticket is
            # still live gets a fresh duplicate inserted every 2s. .first() also
            # keeps a pre-existing duplicate from crashing the whole cycle.
            pos = (await db.execute(
                select(Position)
                .where(Position.account_id == acct.id, Position.comment == tag)
                .order_by(Position.created_at.desc())
                .limit(1)
            )).scalars().first()

            if pos is None:
                db.add(Position(
                    account_id=acct.id, status=PositionStatus.OPEN, comment=tag, **fields,
                ))
            elif str(getattr(pos.status, "value", pos.status)) == "open":
                for k, v in fields.items():
                    setattr(pos, k, v)
            else:
                logger.warning(
                    "[%s] ticket %s is closed on the platform but still open on MT5 "
                    "— refusing to re-insert", platform_account_number, ticket,
                )

        # Close rows whose MT5 ticket is gone. Scoped by mt5_link_id so two links
        # on one platform account can never close each other's rows, and a
        # re-pointed link cleans up its old account. The second branch adopts
        # legacy rows written before this column existed (or by an older worker
        # mid-deploy) — otherwise they'd stay open forever with stale prices.
        open_rows = (await db.execute(
            select(Position).where(
                Position.status == "open",
                or_(
                    Position.mt5_link_id == link_id,
                    and_(
                        Position.account_id == acct.id,
                        Position.mt5_link_id.is_(None),
                        Position.comment.startswith(prefix),
                    ),
                ),
            )
        )).scalars().all()
        for pos in open_rows:
            if pos.mt5_link_id is None:
                pos.mt5_link_id = link_id
            c = str(pos.comment or "")
            tk = c[len(prefix):] if c.startswith(prefix) else ""
            if pos.account_id == acct.id and tk and tk in seen_tickets:
                continue
            _close_mirrored(db, pos, now, reason="mt5")

        # Mirror MT5 account balances onto the platform account. Note this keeps
        # equity following the MT5 book even when the trades shown are inverted.
        if account_info:
            acct.balance = _dec(account_info.get("balance", acct.balance))
            acct.equity = _dec(account_info.get("equity", acct.equity))
            acct.margin_used = _dec(account_info.get("margin", acct.margin_used))
            acct.free_margin = _dec(account_info.get("freeMargin", acct.free_margin))

        await db.commit()


async def push_outbound(link_id, platform_account_number: str, outbound_mode: str,
                        max_lots, connection, baseline: bool = False) -> None:
    """Send platform positions on the linked account to MT5 as real orders.

    outbound_mode='same'    → platform BUY  becomes an MT5 BUY
    outbound_mode='reverse' → platform BUY  becomes an MT5 SELL (hedge)

    Only native rows are eligible: anything carrying mt5_link_id came FROM MT5,
    so pushing it back would be a round trip. Every order is stamped with
    OUTBOUND_MAGIC so the inbound side skips it.

    `baseline=True` (first cycle after the task starts) marks the positions that
    are already open as 'skipped' instead of sending them. Turning outbound on
    must not fire off every position the account is already holding — the task
    restarts whenever the mode changes, so each enable gets a fresh baseline.
    """
    mode = (outbound_mode or "off").strip().lower()
    if mode not in ("same", "reverse"):
        return
    reverse = mode == "reverse"

    async with AsyncSessionLocal() as db:
        acct = (await db.execute(
            select(TradingAccount).where(TradingAccount.account_number == platform_account_number)
        )).scalar_one_or_none()
        if not acct:
            return

        # ── Positions to send: native, open, never pushed. 'failed' is sticky
        # (an order the broker rejected must not be retried every 2s) and
        # 'skipped' marks the pre-existing baseline.
        pending = (await db.execute(
            select(Position).where(
                Position.account_id == acct.id,
                Position.status == "open",
                Position.mt5_link_id.is_(None),
                Position.mt5_out_ticket.is_(None),
                Position.mt5_out_state.is_(None),
            )
        )).scalars().all()

        if baseline:
            for pos in pending:
                pos.mt5_out_state = "skipped"
            if pending:
                logger.info("[%s] outbound baseline — %d already-open position(s) left alone",
                            platform_account_number, len(pending))
            await db.commit()
            return

        symbols = _broker_symbols(getattr(connection, "terminal_state", None))

        for pos in pending:
            sym = _norm_symbol(getattr(pos.instrument, "symbol", "") or "")
            if not sym:
                pos.mt5_out_state = "failed"
                pos.mt5_out_error = "position has no instrument symbol"
                continue

            volume = float(pos.lots or 0)
            if volume <= 0:
                pos.mt5_out_state = "failed"
                pos.mt5_out_error = "lots must be > 0"
                continue
            if max_lots is not None and volume > float(max_lots):
                pos.mt5_out_state = "failed"
                pos.mt5_out_error = f"lots {volume} exceeds this link's cap of {max_lots}"
                logger.warning("[%s] outbound blocked: %s", platform_account_number, pos.mt5_out_error)
                continue

            plat_side = str(getattr(pos.side, "value", pos.side)).lower()
            send_buy = (plat_side == "sell") if reverse else (plat_side == "buy")
            broker_sym = _resolve_broker_symbol(sym, symbols)
            opts = {"magic": OUTBOUND_MAGIC}

            try:
                fn = connection.create_market_buy_order if send_buy else connection.create_market_sell_order
                res = await asyncio.wait_for(
                    fn(broker_sym, volume, None, None, opts), timeout=ORDER_TIMEOUT)
                ticket = (res or {}).get("positionId") or (res or {}).get("orderId")
                if not ticket:
                    raise RuntimeError(f"broker returned no ticket: {res}")
                pos.mt5_out_ticket = str(ticket)
                pos.mt5_out_state = "sent"
                pos.mt5_out_error = None
                logger.info("[%s] outbound %s %s %s lots → MT5 ticket %s",
                            platform_account_number, "BUY" if send_buy else "SELL",
                            broker_sym, volume, ticket)
            except asyncio.TimeoutError:
                # The send may or may not have reached the broker. 'failed' is
                # sticky, so this is never retried — a duplicate live order is a
                # worse outcome than a missed hedge the operator can see.
                pos.mt5_out_state = "failed"
                pos.mt5_out_error = (
                    f"no response from MT5 within {ORDER_TIMEOUT:.0f}s — "
                    f"check the terminal for an unmatched {broker_sym} order"
                )
                logger.error("[%s] outbound order timed out for %s (sent as %s)",
                             platform_account_number, sym, broker_sym)
            except Exception as e:
                pos.mt5_out_state = "failed"
                pos.mt5_out_error = _err_text(e)[:500]
                logger.error("[%s] outbound order failed for %s (sent as %s): %s",
                             platform_account_number, sym, broker_sym, _err_text(e))

        # ── Close on MT5 what has closed here. Scoped to THIS account: without
        # it, one link's connection would try to close another link's tickets,
        # get "position not found", and mark them closed while they run on.
        closing = (await db.execute(
            select(Position).where(
                Position.account_id == acct.id,
                Position.mt5_out_ticket.isnot(None),
                Position.mt5_out_state == "sent",
                Position.status == "closed",
            )
        )).scalars().all()

        for pos in closing:
            try:
                await asyncio.wait_for(
                    connection.close_position(pos.mt5_out_ticket, {"magic": OUTBOUND_MAGIC}),
                    timeout=ORDER_TIMEOUT)
                pos.mt5_out_state = "closed"
                pos.mt5_out_error = None
                logger.info("[%s] outbound closed MT5 ticket %s",
                            platform_account_number, pos.mt5_out_ticket)
            except Exception as e:
                msg = _err_text(e)[:500]
                # Already gone on MT5 (closed by hand, SL/TP, stop-out) — done.
                if "not found" in msg.lower() or "POSITION_NOT_FOUND" in msg:
                    pos.mt5_out_state = "closed"
                    pos.mt5_out_error = None
                else:
                    # Keep state 'sent' so it retries; log only when the reason
                    # changes, or a stuck close would fill the log every 2s.
                    if pos.mt5_out_error != msg:
                        logger.warning("[%s] could not close MT5 ticket %s: %s",
                                       platform_account_number, pos.mt5_out_ticket, msg)
                    pos.mt5_out_error = msg

        await db.commit()


async def finalize_link(link_id, reason: str = "mt5_unlinked") -> None:
    """Close every still-open row belonging to a link that has been removed or
    disabled. Without this they'd hang forever: no engine will touch them, and
    the worker that used to own them is gone."""
    try:
        async with AsyncSessionLocal() as db:
            now = datetime.now(timezone.utc)
            rows = (await db.execute(
                select(Position).where(
                    Position.mt5_link_id == link_id,
                    Position.status == "open",
                )
            )).scalars().all()
            for pos in rows:
                _close_mirrored(db, pos, now, reason=reason)
            if rows:
                await db.commit()
                logger.info("finalised %d mirrored position(s) for unlinked account", len(rows))
    except Exception:
        logger.exception("failed to finalise positions for unlinked account")


async def run_account(api, metaapi_account_id: str, link_id, platform_account_number: str,
                      mode: str, outbound_mode: str, max_lots,
                      stop_event: asyncio.Event, heartbeat: dict | None = None) -> None:
    """Connect one MetaApi account and bridge it until stop_event is set.

    `heartbeat['t']` is stamped after every completed cycle. The supervisor reads
    it to tell a live bridge apart from one that is wedged mid-await — the SDK
    can leave a connection that never resolves another RPC, and a task blocked
    there looks identical to a healthy one from the outside.
    """
    def beat() -> None:
        if heartbeat is not None:
            heartbeat["t"] = asyncio.get_running_loop().time()

    beat()
    try:
        # Each stage is written to the link row so the admin panel can show what
        # the connection is actually doing — syncing alone can take minutes, and
        # a bare "pending" for that long looks like it has hung.
        await _set_link_status(metaapi_account_id, "deploying")
        account = await api.metatrader_account_api.get_account(metaapi_account_id)

        if getattr(account, "state", None) not in ("DEPLOYED",):
            logger.info("[%s] deploying MetaApi account ...", metaapi_account_id)
            try:
                await account.deploy()
            except Exception:
                logger.exception("[%s] account.deploy() failed (continuing)", metaapi_account_id)

        logger.info("[%s] waiting for connection ...", metaapi_account_id)
        await _set_link_status(metaapi_account_id, "connecting")
        await account.wait_connected()

        connection = account.get_streaming_connection()
        await connection.connect()
        logger.info("[%s] waiting for synchronization ...", metaapi_account_id)
        await _set_link_status(metaapi_account_id, "syncing")
        await connection.wait_synchronized({"timeoutInSeconds": 600})
        inbound = (mode or "mirror").strip().lower()
        outbound = (outbound_mode or "off").strip().lower()
        logger.info("[%s] synchronized — inbound=%s outbound=%s on platform account %s every %ss",
                    metaapi_account_id, inbound, outbound, platform_account_number, POLL_SECONDS)
        await _set_link_status(metaapi_account_id, "connected")
        beat()

        first_cycle = True
        while not stop_event.is_set():
            try:
                ts = connection.terminal_state
                positions = list(getattr(ts, "positions", None) or [])
                account_info = getattr(ts, "account_information", None) or {}
                if inbound != "off":
                    await reconcile(link_id, platform_account_number, mode, positions, account_info)
                # Outbound runs after inbound so a position that just arrived
                # from MT5 already carries mt5_link_id and can't be sent back.
                await push_outbound(link_id, platform_account_number, outbound, max_lots,
                                    connection, baseline=first_cycle)
                first_cycle = False
                await _set_link_status(metaapi_account_id, "connected")
            except Exception as e:
                logger.exception("[%s] bridge cycle failed", metaapi_account_id)
                await _set_link_status(metaapi_account_id, "error", str(e))
            # Stamped whether the cycle succeeded or raised: a cycle that keeps
            # erroring is a problem for the log, not for the stall watchdog.
            beat()
            await asyncio.sleep(POLL_SECONDS)
    except asyncio.CancelledError:
        logger.info("[%s] worker stopped", metaapi_account_id)
        raise
    except Exception as e:
        logger.exception("[%s] account worker crashed", metaapi_account_id)
        await _set_link_status(metaapi_account_id, "error", str(e))


def _sig(link: dict) -> tuple:
    """Identity of a link's connection config — changing any of these restarts it.

    `id` is included so a delete+recreate of the same MetaApi account restarts the
    task instead of running on with a stale link id that would fail the FK.
    `mode` is included so flipping mirror↔reverse is what triggers the cutover."""
    return (
        str(link["id"]),
        link["platform_account_number"],
        link.get("region") or "",
        link.get("mode") or "mirror",
        link.get("outbound_mode") or "off",
        str(link.get("max_lots") or ""),
    )


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
      - a task that died or stopped completing cycles → rebuilt
    All of this is admin-panel driven; no redeploy needed."""
    from metaapi_cloud_sdk import MetaApi

    workers: dict[str, dict] = {}  # metaapi_account_id -> {task, stop, sig, hb, link_id, started}
    retry: dict[str, dict] = {}    # metaapi_account_id -> {fails, next_at}
    managed: dict[str, object] = {}  # metaapi_account_id -> link_id, for unlink cleanup
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
            links_ok = True
        except Exception:
            logger.exception("failed to load mt5_account_links")
            links, links_ok = [], False
        wanted = {l["metaapi_account_id"]: l for l in links}

        # ── Health check: drop tasks that died or wedged so the block below
        # rebuilds them. Previously a worker entry lived forever once created —
        # `if aid in workers: continue` never asked whether it was still doing
        # anything — so a single failure killed that link's bridge in BOTH
        # directions until someone happened to edit its config. That is exactly
        # what happened on 2026-08-03: the SDK's resubscribe task raised
        # KeyError('type') handling a TooManyRequestsException, the connection
        # became a zombie, the next outbound order call never returned, and the
        # link stayed dead for ~40h. (2026-08-05)
        now = asyncio.get_running_loop().time()
        for aid in list(workers):
            w = workers[aid]
            # A dead task whose link is also gone belongs to the removal block
            # below — that one still owes it a finalize_link.
            if aid not in wanted:
                continue
            healthy = (not w["task"].done()
                       and now - w["hb"].get("t", now) <= STALL_SECONDS)
            if healthy:
                # Only a sustained healthy run clears the backoff. Clearing it
                # the instant a task starts would defeat it — a link that wedges
                # right after connecting would retry flat out forever.
                if now - w["started"] > STALL_SECONDS and retry.pop(aid, None):
                    logger.info("[%s] bridge healthy again", aid)
                continue
            if w["task"].done():
                exc = None
                try:
                    exc = w["task"].exception()
                except (asyncio.CancelledError, asyncio.InvalidStateError):
                    pass
                logger.warning("[%s] worker task ended (%s) — restarting",
                               aid, exc or "no exception")
            elif now - w["hb"].get("t", now) > STALL_SECONDS:
                logger.warning("[%s] no bridge cycle in %.0fs — connection wedged, restarting",
                               aid, now - w["hb"].get("t", now))
                w["stop"].set()
                w["task"].cancel()
            else:
                continue
            # Back off on repeated failures. A genuinely broken account (deleted
            # on MetaApi, wrong region, bad token) would otherwise be rebuilt
            # every REFRESH_SECONDS forever — and hammering MetaApi is what
            # earns the TooManyRequestsException that started all this.
            r = retry.setdefault(aid, {"fails": 0, "next_at": 0.0})
            r["fails"] += 1
            delay = min(REFRESH_SECONDS * (2 ** (r["fails"] - 1)), RETRY_MAX_SECONDS)
            r["next_at"] = now + delay
            # 'pending' — the status the admin panel already renders as
            # "Queued 1/4" with a spinner, and it is literally true: the start
            # block re-creates this worker once the backoff elapses.
            await _set_link_status(aid, "pending")
            del workers[aid]
            if delay > REFRESH_SECONDS:
                logger.warning("[%s] failure #%d — next attempt in %.0fs",
                               aid, r["fails"], delay)

        # Remember every link we manage, so an unlink is finalised even when no
        # worker entry survives — a link sitting in restart backoff has none,
        # and its mirrored rows would otherwise stay open forever.
        for aid, link in wanted.items():
            managed[aid] = link["id"]

        # Links that disappeared (deleted or disabled). Never act on a failed
        # links load, or one DB blip would close every mirrored row on the box.
        if links_ok:
            for aid in [a for a in managed if a not in wanted]:
                logger.info("[%s] stopping worker (removed/disabled)", aid)
                w = workers.pop(aid, None)
                if w is not None:
                    w["stop"].set()
                    w["task"].cancel()
                link_id = managed.pop(aid)
                retry.pop(aid, None)
                if link_id is not None:
                    await finalize_link(link_id, reason="mt5_unlinked")

        # Stop workers whose config changed — they restart below with the new
        # settings. A mode flip is `changed`, not gone, so it never finalises.
        for aid in list(workers):
            if aid not in wanted or workers[aid]["sig"] == _sig(wanted[aid]):
                continue
            logger.info("[%s] stopping worker (changed)", aid)
            workers[aid]["stop"].set()
            workers[aid]["task"].cancel()
            del workers[aid]
            # A deliberate reconfigure is a fresh start, not a failure.
            retry.pop(aid, None)

        # Start workers for new/changed links.
        for aid, link in wanted.items():
            if aid in workers:
                continue
            r = retry.get(aid)
            if r and asyncio.get_running_loop().time() < r["next_at"]:
                continue
            stop_event = asyncio.Event()
            region = link.get("region") or default_region
            opts = {"region": region} if region else {}
            api = MetaApi(current_token, opts)
            mode = link.get("mode") or "mirror"
            outbound = link.get("outbound_mode") or "off"
            hb = {"t": asyncio.get_running_loop().time()}
            task = asyncio.create_task(
                run_account(api, aid, link["id"], link["platform_account_number"],
                            mode, outbound, link.get("max_lots"), stop_event, hb)
            )
            workers[aid] = {
                "task": task, "stop": stop_event, "sig": _sig(link),
                "link_id": link["id"], "hb": hb, "started": hb["t"],
            }
            logger.info("[%s] starting worker (inbound=%s, outbound=%s) → platform account %s",
                        aid, mode, outbound, link["platform_account_number"])

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
