"""Platform bridge — OUTBOUND worker: copy trades on linked accounts to the sister platform.

For every enabled row in `bridge_links` it watches the local account
(`local_account_number`) and mirrors its positions onto `peer_account_number`
on the sister platform, through the peer's signed /api/bridge/v1 API:

  * new open position   → peer opens a market order (side flipped in reverse mode)
  * partial close       → peer closes the same fraction of the copy
  * full close          → peer closes the copy
  * SL/TP change        → peer moves the copy's SL/TP (swapped in reverse mode)

Rules
  * Only positions opened at or after the link's `baseline_at` are copied, so
    enabling a link never fires off what the account already holds.
  * A position with a bridge_trades row, or whose order carries the Bridge|
    tag, is never sent out. Copies the peer opened HERE carry both, so two
    links over the same pair of accounts (A→B here, B→A there) cannot loop.
  * MT5-mirrored rows (mt5_link_id set) are not real trades and are skipped.
  * Closes run BOTH ways. Source closed here → the copy is closed on the
    peer. A copy the peer opened HERE that closes here first (client, SL/TP,
    stop-out) → the peer is asked to close its source (close-source).
  * Peer opens are idempotent (keyed by our position id), so every transient
    failure is simply retried with backoff. A refusal (no margin, market closed,
    unknown symbol…) is final and shown on the admin page.

Runs as ONE process (its own container). Never start it inside a multi-worker
server — two copies would race each other on the same rows.
"""
import asyncio
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import and_, exists, select

from packages.common.src.config import get_settings
from packages.common.src.database import AsyncSessionLocal
from packages.common.src.models import BridgeLink, BridgeTrade, Order, Position, TradingAccount
from packages.common.src import platform_bridge as pb

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)-5s [trade-bridge] %(message)s")
logger = logging.getLogger("trade-bridge")
# SQL echo in development would drown the bridge log at a 1s poll.
logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)

settings = get_settings()
MAX_BACKOFF_SECONDS = 60.0


def _status(p) -> str:
    return str(getattr(p.status, "value", p.status) or "")


def _same(a, b) -> bool:
    return pb._dec_or_none(a) == pb._dec_or_none(b)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _backoff(row: BridgeTrade, err: str) -> None:
    row.attempts = (row.attempts or 0) + 1
    delay = min(MAX_BACKOFF_SECONDS, 2 ** min(row.attempts, 6))
    row.next_attempt_at = _now() + timedelta(seconds=delay)
    row.error = err[:500]


def _due(row: BridgeTrade) -> bool:
    if row.next_attempt_at is None:
        return True
    t = row.next_attempt_at
    if t.tzinfo is None:
        t = t.replace(tzinfo=timezone.utc)
    return t <= _now()


def _clear_retry(row: BridgeTrade) -> None:
    row.attempts = 0
    row.next_attempt_at = None


class Bridge:
    def __init__(self, peer: pb.PeerClient):
        self.peer = peer

    # ── One cycle ────────────────────────────────────────────────────────
    async def cycle(self) -> None:
        async with AsyncSessionLocal() as db:
            links = (await db.execute(select(BridgeLink).where(BridgeLink.enabled.is_(True)))).scalars().all()
            for link in links:
                try:
                    await self._discover(db, link)
                except Exception as e:
                    await db.rollback()
                    logger.exception("[%s→%s] discover failed", link.local_account_number, link.peer_account_number)
                    await self._link_status(db, link.id, "error", f"{type(e).__name__}: {e}")

        await self._process_rows()
        try:
            await self._inbound_closes()
        except Exception:
            logger.exception("inbound close sync failed")

    async def _link_status(self, db, link_id, status: str, error: str | None) -> None:
        link = await db.get(BridgeLink, link_id)
        if link is None:
            return
        link.status = status
        link.last_error = error[:500] if error else None
        link.last_sync_at = _now()
        await db.commit()

    # ── New positions on a link's account → 'pending' rows ───────────────
    async def _discover(self, db, link: BridgeLink) -> None:
        acct = (await db.execute(
            select(TradingAccount).where(TradingAccount.account_number == link.local_account_number)
        )).scalar_one_or_none()
        if acct is None:
            await self._link_status(db, link.id, "error", f"local account {link.local_account_number} not found")
            return

        already = exists().where(BridgeTrade.local_position_id == Position.id)
        # A copy the peer opened here carries the Bridge| tag on its order from
        # the moment it exists (same commit as the position). Checking that —
        # not just bridge_trades, which the inbound side fills in a moment
        # later — is what stops a two-way link from echoing a copy back.
        bridged_order = exists().where(
            Order.id == Position.order_id, Order.comment.like("Bridge|%"),
        )
        conds = [
            Position.account_id == acct.id,
            Position.status == "open",
            Position.mt5_link_id.is_(None),
            ~already,
            ~bridged_order,
        ]
        if link.baseline_at is not None:
            conds.append(Position.created_at >= link.baseline_at)
        fresh = (await db.execute(select(Position).where(and_(*conds)))).scalars().all()
        for pos in fresh:
            db.add(BridgeTrade(
                direction="out", link_id=link.id, local_position_id=pos.id,
                local_account_number=link.local_account_number,
                peer_platform=settings.BRIDGE_PEER_ID, peer_account_number=link.peer_account_number,
                mode=pb.norm_mode(link.mode), state="pending", src_lots=pos.lots,
            ))
        if fresh:
            logger.info("[%s→%s] %d new position(s) to copy",
                        link.local_account_number, link.peer_account_number, len(fresh))
        if link.status in (None, "pending") or (link.last_error or "").startswith("local account"):
            link.status, link.last_error = "active", None
        link.last_sync_at = _now()
        await db.commit()

    # ── Drive every live 'out' row one step ──────────────────────────────
    async def _process_rows(self) -> None:
        async with AsyncSessionLocal() as db:
            ids = (await db.execute(
                select(BridgeTrade.id).where(
                    BridgeTrade.direction == "out",
                    BridgeTrade.state.in_(("pending", "open")),
                ).order_by(BridgeTrade.created_at)
            )).scalars().all()
        for row_id in ids:
            async with AsyncSessionLocal() as db:
                row = await db.get(BridgeTrade, row_id)
                if row is None or not _due(row):
                    continue
                try:
                    if row.state == "pending":
                        await self._step_pending(db, row)
                    else:
                        await self._step_open(db, row)
                except Exception as e:
                    logger.exception("bridge row %s failed", row_id)
                    await db.rollback()
                    row = await db.get(BridgeTrade, row_id)
                    if row is not None:
                        _backoff(row, f"{type(e).__name__}: {e}")
                await db.commit()
                if row is not None and row.link_id is not None:
                    await self._reflect_link(db, row)

    async def _reflect_link(self, db, row: BridgeTrade) -> None:
        """Surface the latest row outcome on its link for the admin page."""
        link = await db.get(BridgeLink, row.link_id)
        if link is None:
            return
        if row.state == "failed" or (row.attempts or 0) >= 3:
            link.status, link.last_error = "error", row.error
        elif row.state in ("open", "closed") and not row.attempts:
            link.status, link.last_error = "active", None
        link.last_sync_at = _now()
        await db.commit()

    async def _step_pending(self, db, row: BridgeTrade) -> None:
        pos = await db.get(Position, row.local_position_id) if row.local_position_id else None
        link = await db.get(BridgeLink, row.link_id) if row.link_id else None
        if pos is None or _status(pos) != "open" or link is None or not link.enabled:
            # Nothing to open any more. An earlier attempt may have got through
            # without us hearing back, so close whatever the peer might hold.
            await self._close_or_skip(row)
            return

        try:
            lots = pb.scale_lots(pos.lots, link.lot_multiplier, link.max_lots,
                                 pos.instrument.lot_step if pos.instrument else "0.01")
        except ValueError as e:
            row.state, row.error = "failed", str(e)
            return

        sl, tp = (pos.stop_loss, pos.take_profit) if link.copy_sl_tp else (None, None)
        csl, ctp = pb.mirror_sl_tp(sl, tp, row.mode)
        payload = {
            "source_position_id": str(pos.id),
            "source_account_number": row.local_account_number,
            "target_account_number": row.peer_account_number,
            "symbol": pos.instrument.symbol if pos.instrument else "",
            "side": pb.mirror_side(pos.side, row.mode),
            "lots": str(lots),
            "source_lots": str(pos.lots),
            "stop_loss": str(csl) if csl is not None else None,
            "take_profit": str(ctp) if ctp is not None else None,
            "mode": row.mode,
        }
        try:
            res = await self.peer.open_trade(payload)
        except pb.PeerError as e:
            if e.definitive:
                row.state, row.error = "failed", str(e)[:500]
                logger.warning("[%s→%s] copy of %s refused: %s",
                               row.local_account_number, row.peer_account_number, pos.id, e)
            else:
                _backoff(row, str(e))
            return

        row.state = "open"
        row.peer_position_id = res.get("position_id")
        row.src_lots = pos.lots
        row.synced_sl, row.synced_tp = sl, tp
        row.error = res.get("error")
        _clear_retry(row)
        logger.info("[%s→%s] copied %s %s → %s %s lots @ %s (peer position %s)",
                    row.local_account_number, row.peer_account_number,
                    pb.norm_side(pos.side), payload["symbol"], payload["side"], lots,
                    res.get("open_price"), row.peer_position_id)

    async def _step_open(self, db, row: BridgeTrade) -> None:
        pos = await db.get(Position, row.local_position_id) if row.local_position_id else None
        if pos is None or _status(pos) != "open":
            await self._close_or_skip(row)
            return

        # Partial close on the source.
        if row.src_lots is not None and pos.lots < row.src_lots:
            try:
                res = await self.peer.close_trade({
                    "source_position_id": str(pos.id), "source_lots": str(pos.lots),
                })
            except pb.PeerError as e:
                if e.definitive:
                    row.error = str(e)[:500]
                    row.src_lots = pos.lots       # don't retry a refused partial forever
                else:
                    _backoff(row, str(e))
                return
            row.src_lots = pos.lots
            self._absorb(row, res)
            _clear_retry(row)
            if row.state != "open":
                return

        # SL/TP moved on the source.
        link = await db.get(BridgeLink, row.link_id) if row.link_id else None
        copy_levels = link.copy_sl_tp if link is not None else True
        if copy_levels and not (_same(pos.stop_loss, row.synced_sl) and _same(pos.take_profit, row.synced_tp)):
            csl, ctp = pb.mirror_sl_tp(pos.stop_loss, pos.take_profit, row.mode)
            try:
                res = await self.peer.modify_trade({
                    "source_position_id": str(pos.id),
                    "stop_loss": str(csl) if csl is not None else None,
                    "take_profit": str(ctp) if ctp is not None else None,
                })
            except pb.PeerError as e:
                if e.definitive:
                    row.synced_sl, row.synced_tp = pos.stop_loss, pos.take_profit
                    row.error = str(e)[:500]
                else:
                    _backoff(row, str(e))
                return
            row.synced_sl, row.synced_tp = pos.stop_loss, pos.take_profit
            self._absorb(row, res)
            _clear_retry(row)

    async def _close_or_skip(self, row: BridgeTrade) -> None:
        try:
            res = await self.peer.close_trade({"source_position_id": str(row.local_position_id), "source_lots": "0"})
        except pb.PeerError as e:
            if e.status == 404:
                # The peer never opened a copy — nothing to close.
                row.state = "skipped" if row.state == "pending" else "closed"
                _clear_retry(row)
            elif e.definitive:
                row.state, row.error = "failed", str(e)[:500]
            else:
                _backoff(row, str(e))
            return
        row.state = "closed" if res.get("state") != "failed" else "skipped"
        if res.get("position_id"):
            row.peer_position_id = res["position_id"]
        _clear_retry(row)
        logger.info("[%s→%s] closed copy of %s", row.local_account_number, row.peer_account_number,
                    row.local_position_id)

    @staticmethod
    def _absorb(row: BridgeTrade, res: dict) -> None:
        """Keep the peer's note on the copy (e.g. an SL/TP it couldn't set).

        A copy that closed over there is NOT marked closed here: the peer's
        worker asks us to close the source (close-source), which closes the row
        together with the position."""
        row.error = res.get("error") or None

    # ── Copies WE hold that closed here first → close the peer's source ──
    async def _inbound_closes(self) -> None:
        async with AsyncSessionLocal() as db:
            rows = (await db.execute(
                select(BridgeTrade)
                .join(Position, Position.id == BridgeTrade.local_position_id)
                .where(
                    BridgeTrade.direction == "in",
                    BridgeTrade.state == "open",
                    Position.status != "open",
                )
            )).scalars().all()
            for row in rows:
                if not _due(row):
                    continue
                try:
                    await self.peer.close_source({
                        "position_id": row.peer_position_id,
                        "copy_position_id": str(row.local_position_id),
                    })
                except pb.PeerError as e:
                    if e.status == 404:
                        row.state, row.error = "closed", None   # nothing to close there
                    elif e.definitive:
                        row.state, row.error = "closed", f"source not closed: {e}"[:500]
                        logger.warning("[%s←%s] could not close source %s: %s",
                                       row.local_account_number, row.peer_account_number,
                                       row.peer_position_id, e)
                    else:
                        _backoff(row, str(e))
                    continue
                row.state = "closed"
                _clear_retry(row)
                logger.info("[%s←%s] copy closed here — closed source %s on the peer",
                            row.local_account_number, row.peer_account_number, row.peer_position_id)
            await db.commit()


async def run() -> None:
    if not settings.BRIDGE_ENABLED:
        logger.info("BRIDGE_ENABLED is false — trade-bridge idling")
        while True:
            await asyncio.sleep(3600)
    if not settings.BRIDGE_PEER_URL or not settings.BRIDGE_SHARED_SECRET:
        logger.error("BRIDGE_PEER_URL / BRIDGE_SHARED_SECRET not set — trade-bridge idling")
        while True:
            await asyncio.sleep(3600)

    bridge = Bridge(pb.peer_client_from_settings(settings))
    logger.info("trade-bridge started: %s → %s at %s (poll %.1fs)",
                settings.BRIDGE_PLATFORM_ID, settings.BRIDGE_PEER_ID, settings.BRIDGE_PEER_URL,
                settings.BRIDGE_POLL_SECONDS)
    while True:
        try:
            await bridge.cycle()
        except Exception:
            logger.exception("bridge cycle failed")
        await asyncio.sleep(max(0.2, float(settings.BRIDGE_POLL_SECONDS)))


def main() -> None:
    asyncio.run(run())


if __name__ == "__main__":
    main()
