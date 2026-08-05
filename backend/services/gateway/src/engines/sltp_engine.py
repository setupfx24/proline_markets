"""SL/TP Monitoring Engine — Auto-closes positions when Stop Loss or Take Profit is hit.

Reads the latest tick for every symbol that actually has a bracketed position and
checks each one. Closes at the SL/TP price (not market price) to match MT5
behaviour and to honour the exact level — and the exact P&L — the chart pill
showed the client when they set it.

This is the ONLY SL/TP closer in the platform. The b-book matching engine used to
run a second, faster monitor that closed at market and skipped the trade_history
row, the ledger entry and the notification; it always won the race, so brackets
appeared to "not close". That monitor is gone. (2026-08-05)
"""
import asyncio
import json
import logging
from datetime import datetime
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import AsyncSessionLocal
from packages.common.src.redis_client import redis_client, PriceChannel
from packages.common.src.models import (
    Position, TradingAccount, Transaction, TradeHistory, Instrument, User,
)
from packages.common.src.notify import create_notification
from packages.common.src import corecen_trade_client

logger = logging.getLogger("gateway.sltp")

# Now that this is the only closer, the old 1s poll would be a real slippage cost
# on a fast move. Ticks land far more often than this, so a bracket fires within
# roughly a fifth of a second of being breached.
CHECK_INTERVAL = 0.2


def _side_val(side) -> str:
    return side.value if hasattr(side, 'value') else str(side)


class SLTPEngine:
    def __init__(self):
        self._running = False
        self._task = None
        self._prices: dict[str, dict] = {}

    async def start(self):
        self._running = True
        self._task = asyncio.create_task(self._run())
        logger.info("SL/TP engine started")

    async def stop(self):
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("SL/TP engine stopped")

    async def _run(self):
        while self._running:
            try:
                await self._check_positions()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error("SL/TP engine error: %s", e)
                await asyncio.sleep(3)
                continue
            await asyncio.sleep(CHECK_INTERVAL)

    async def _load_prices(self, symbols: set[str]):
        """Refresh the tick cache for just the symbols we need to evaluate.

        Only bracketed positions matter, so this reads those keys by name rather
        than doing a `KEYS tick:*` sweep of the whole keyspace every cycle.
        """
        if not symbols:
            return
        try:
            ordered = sorted(symbols)
            values = await redis_client.mget([f"tick:{s}" for s in ordered])
            for sym, val in zip(ordered, values):
                if not val:
                    continue
                try:
                    self._prices[sym] = json.loads(val)
                except json.JSONDecodeError:
                    pass
        except Exception as e:
            logger.warning("Failed to load prices: %s", e)

    async def _check_positions(self):
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(Position)
                .where(Position.status == "open")
                # MT5-mirrored rows are exits owned by MT5 — never close them here.
                .where(Position.mt5_link_id.is_(None))
                .where(
                    (Position.stop_loss.isnot(None)) | (Position.take_profit.isnot(None))
                )
            )
            positions = result.scalars().all()
            if not positions:
                return

            await self._load_prices({
                pos.instrument.symbol for pos in positions if pos.instrument
            })

            closed = 0
            for pos in positions:
                # One unusable row (missing instrument, malformed tick) must never
                # abort the sweep and leave every other bracket unchecked.
                try:
                    if await self._maybe_close(db, pos):
                        closed += 1
                except Exception as e:
                    logger.error("SL/TP check failed for position %s: %s", pos.id, e)

            await db.commit()
            if closed:
                logger.info("Closed %d position(s) on SL/TP", closed)

    async def _maybe_close(self, db: AsyncSession, pos: Position) -> bool:
        """Evaluate one position's brackets; close it if either is breached."""
        symbol = pos.instrument.symbol if pos.instrument else None
        tick = self._prices.get(symbol) if symbol else None
        if not tick:
            return False

        bid = Decimal(str(tick["bid"]))
        ask = Decimal(str(tick["ask"]))
        side = _side_val(pos.side)

        # A BUY is closed on the bid, a SELL on the ask — the same side of the
        # book the client would actually get out on.
        exit_price = bid if side == "buy" else ask

        triggered = None

        # No "SL must be below entry" sanity gate here: a stop moved up to
        # break-even or into profit is a normal trailing stop and must still
        # fire. Level crossed is the only thing that matters.
        if pos.stop_loss:
            sl = Decimal(str(pos.stop_loss))
            if (side == "buy" and exit_price <= sl) or (side == "sell" and exit_price >= sl):
                triggered = "sl"

        if not triggered and pos.take_profit:
            tp = Decimal(str(pos.take_profit))
            if (side == "buy" and exit_price >= tp) or (side == "sell" and exit_price <= tp):
                triggered = "tp"

        if not triggered:
            return False

        # Fill at the level itself, not at market — that is what the client was
        # shown when they placed it, so the realised P&L matches the pill exactly.
        close_price = Decimal(str(pos.stop_loss if triggered == "sl" else pos.take_profit))
        await self._close_position(db, pos, close_price, triggered)
        return True

    async def _close_position(
        self, db: AsyncSession, pos: Position, close_price: Decimal, reason: str
    ):
        side = _side_val(pos.side)
        contract_size = pos.instrument.contract_size if pos.instrument else Decimal("100000")

        if side == "buy":
            profit = (close_price - pos.open_price) * pos.lots * contract_size
        else:
            profit = (pos.open_price - close_price) * pos.lots * contract_size
        from ..services.trading_service import quote_to_account_pnl
        profit = quote_to_account_pnl(
            profit,
            getattr(pos.instrument, "base_currency", None),
            getattr(pos.instrument, "quote_currency", None),
            close_price,
            symbol=getattr(pos.instrument, "symbol", None),
        )

        pos.status = "closed"
        pos.close_price = close_price
        pos.profit = profit
        pos.closed_at = datetime.utcnow()
        pos.comment = f"Auto-closed by {reason.upper()}"

        acct_result = await db.execute(
            select(TradingAccount).where(TradingAccount.id == pos.account_id)
        )
        account = acct_result.scalar_one_or_none()
        if account:
            margin_release = (pos.lots * contract_size * pos.open_price) / Decimal(str(account.leverage))
            account.balance += profit
            account.margin_used = max(Decimal("0"), (account.margin_used or Decimal("0")) - margin_release)
            account.equity = account.balance + (account.credit or Decimal("0"))
            account.free_margin = account.equity - account.margin_used

        history = TradeHistory(
            position_id=pos.id,
            account_id=pos.account_id,
            instrument_id=pos.instrument_id,
            side=pos.side,
            lots=pos.lots,
            open_price=pos.open_price,
            close_price=close_price,
            swap=pos.swap or Decimal("0"),
            commission=pos.commission or Decimal("0"),
            profit=profit,
            close_reason=reason,
            opened_at=pos.created_at,
            closed_at=datetime.utcnow(),
        )
        db.add(history)

        tx = Transaction(
            user_id=account.user_id if account else pos.account_id,
            account_id=pos.account_id,
            type="profit" if profit >= 0 else "loss",
            amount=profit,
            balance_after=account.balance if account else None,
            reference_id=pos.id,
            description=f"{reason.upper()} hit: {pos.instrument.symbol if pos.instrument else ''} {side} {pos.lots} lots @ {close_price}",
        )
        db.add(tx)

        try:
            await redis_client.publish(f"account:{pos.account_id}", json.dumps({
                "type": "position_closed",
                "position_id": str(pos.id),
                "reason": reason,
                "profit": str(profit),
                "close_price": str(close_price),
            }))
        except Exception:
            pass

        symbol = pos.instrument.symbol if pos.instrument else "?"
        pnl_str = f"+${float(profit):.2f}" if profit >= 0 else f"-${abs(float(profit)):.2f}"
        reason_label = "Stop Loss" if reason == "sl" else "Take Profit"

        if account:
            await create_notification(
                db, account.user_id,
                title=f"{reason_label} Hit — {symbol}",
                message=f"{side.upper()} {pos.lots} lots closed @ {close_price} | P&L: {pnl_str}",
                notif_type="trade",
                action_url="/trading",
                commit=False,
            )

        logger.info(
            "%s triggered: %s %s %s lots @ %s → P&L: %s",
            reason.upper(), symbol, side, pos.lots, close_price, profit
        )

        # ── A-Book: forward SL/TP close to Corecen LP ────────────────────
        _pos_id = str(pos.id)
        _cp = float(close_price)
        _pnl = float(profit)
        _reason_upper = reason.upper()
        _user_id = account.user_id if account else None
        _is_demo = bool(account.is_demo) if account else True

        async def _forward_sltp_close():
            try:
                if not _user_id or _is_demo:
                    return
                async with AsyncSessionLocal() as bg_db:
                    u = (await bg_db.execute(select(User).where(User.id == _user_id))).scalar_one_or_none()
                    if u and (u.book_type or "B") == "A":
                        await corecen_trade_client.forward_trade_close(
                            position_id=_pos_id,
                            close_price=_cp,
                            pnl=_pnl,
                            closed_by=_reason_upper,
                        )
            except Exception as exc:
                logger.error("[A-BOOK] SL/TP close forward failed: %s", exc)

        asyncio.create_task(_forward_sltp_close())


sltp_engine = SLTPEngine()
