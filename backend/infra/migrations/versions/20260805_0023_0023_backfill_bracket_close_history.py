"""Backfill trade_history for positions the b-book engine closed on SL/TP.

Two engines used to monitor brackets. The b-book matching engine polled at 0.1s
and the gateway's sltp_engine at 1s, so the b-book one always won — and it wrote
no trade_history row, no transaction and no close_reason. It only flipped the
position to closed and moved the balance.

The result: every SL/TP close the platform has ever done is missing from Trade
History, from the closed-trade P&L totals and from the balance-trend chart, even
though the money did move. Clients saw the trade vanish and never land anywhere,
which reads as "my stop was hit but the trade never closed".

The duplicate monitor is gone (b-book matching_engine.py) — this repairs the rows
it already orphaned. Balance is deliberately NOT touched: the b-book engine did
apply the P&L at the time, so re-applying it here would double-count.

Revision ID: 0023
Revises: 0022
"""
from alembic import op

revision = "0023"
down_revision = "0022"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Only closed, bracketed positions that have NO history row at all. The
    # NOT EXISTS makes this safe to re-run and keeps it from touching partial
    # closes, which already write their own rows.
    #
    # close_reason is derived from which level the fill actually reached. The
    # b-book engine filled at market, so the price sits just past the level;
    # `<=`/`>=` against the side is what identifies it. Anything that matches
    # neither level is left alone rather than guessed at.
    op.execute(
        """
        INSERT INTO trade_history (
            position_id, account_id, instrument_id, side, lots,
            open_price, close_price, swap, commission, profit,
            close_reason, opened_at, closed_at
        )
        SELECT
            p.id, p.account_id, p.instrument_id, p.side, p.lots,
            p.open_price, p.close_price,
            COALESCE(p.swap, 0), COALESCE(p.commission, 0), COALESCE(p.profit, 0),
            CASE
                WHEN p.side::text = 'buy'  AND p.stop_loss   IS NOT NULL
                     AND p.close_price <= p.stop_loss   THEN 'sl'
                WHEN p.side::text = 'sell' AND p.stop_loss   IS NOT NULL
                     AND p.close_price >= p.stop_loss   THEN 'sl'
                WHEN p.side::text = 'buy'  AND p.take_profit IS NOT NULL
                     AND p.close_price >= p.take_profit THEN 'tp'
                WHEN p.side::text = 'sell' AND p.take_profit IS NOT NULL
                     AND p.close_price <= p.take_profit THEN 'tp'
            END,
            p.created_at,
            COALESCE(p.closed_at, p.updated_at, p.created_at)
        FROM positions p
        WHERE p.status::text = 'closed'
          AND p.close_price IS NOT NULL
          AND (p.stop_loss IS NOT NULL OR p.take_profit IS NOT NULL)
          AND NOT EXISTS (
              SELECT 1 FROM trade_history th WHERE th.position_id = p.id
          )
          AND (
                (p.side::text = 'buy'  AND p.stop_loss   IS NOT NULL AND p.close_price <= p.stop_loss)
             OR (p.side::text = 'sell' AND p.stop_loss   IS NOT NULL AND p.close_price >= p.stop_loss)
             OR (p.side::text = 'buy'  AND p.take_profit IS NOT NULL AND p.close_price >= p.take_profit)
             OR (p.side::text = 'sell' AND p.take_profit IS NOT NULL AND p.close_price <= p.take_profit)
          )
        """
    )


def downgrade() -> None:
    # Only the rows this migration could have created: bracket closes whose
    # position carries no matching transaction (the marker of an engine close
    # that never wrote a ledger entry).
    op.execute(
        """
        DELETE FROM trade_history th
        USING positions p
        WHERE th.position_id = p.id
          AND th.close_reason IN ('sl', 'tp')
          AND NOT EXISTS (
              SELECT 1 FROM transactions t WHERE t.reference_id = p.id
          )
        """
    )
