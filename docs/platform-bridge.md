# Platform Bridge (Opula Markets ⇄ Proline Markets)

The bridge copies trades from an account on one platform to an account on the
other, by account number. The same code runs on both platforms.

| Mode | Source trade | Copy on the other platform |
|---|---|---|
| **Straight** | BUY 0.10, SL 1.0900, TP 1.1200 | BUY 0.10, SL 1.0900, TP 1.1200 |
| **Reverse** | BUY 0.10, SL 1.0900, TP 1.1200 | SELL 0.10, SL 1.1200, TP 1.0900 |

In reverse mode the copy is the opposite position, so the source's TP level is
where the copy loses (its SL) and the source's SL is where the copy wins (its TP).

## What gets copied

| Source event | Effect on the copy |
|---|---|
| Position opened (market fill, or a pending order that fills) | Market order on the peer account (lots × multiplier) |
| SL/TP changed | Copy's SL/TP updated (swapped in reverse mode) |
| Partial close | Copy closes the same fraction |
| Full close (manual, SL/TP, stop-out) | Copy closed |
| Copy fully closed on the other platform first | Source closed |

Each copy is a real trade on the receiving platform. It goes through the normal
order path, so it fills at that platform's own price and spread, passes its
margin check, pays its commission, and is covered by its SL/TP and stop-out
engines. Fill prices differ slightly between the platforms for that reason.

- **Only new trades are copied.** A link copies positions opened after it was
  created, re-enabled or re-pointed. Positions already open are left alone.
- **Closing either trade closes the other.** If the source closes, the copy is
  closed. If the copy closes first (manual close, its own SL/TP, or a
  stop-out), the source is closed too, within about a second. Each side closes
  at its own platform's market price. A partial close is mirrored only from the
  source to the copy.
- **A refusal is final.** If the receiving platform refuses the copy (for
  example insufficient margin, market closed or unknown symbol), the reason is
  shown on the admin page and the copy is not retried. Network errors and 5xx
  responses are retried with backoff.

## Two-way copying

A link only sends. For two-way copying between Opula 10 and Proline 15, add two
links:

- on the **Opula** admin: `10 → 15`
- on the **Proline** admin: `15 → 10`

Copies are never sent back out, so this cannot loop. Each account can have one
outbound link.

## Setup

1. **Generate one secret** and put the same value on both platforms:
   `openssl rand -hex 32`.
2. **Set `.env` on each platform.** On Opula:

   ```env
   BRIDGE_ENABLED=true
   BRIDGE_PLATFORM_ID=opula
   BRIDGE_PEER_ID=proline
   BRIDGE_PEER_URL=https://api.prolinemarket.com
   BRIDGE_SHARED_SECRET=<the secret>
   ```

   On Proline, swap them: `BRIDGE_PLATFORM_ID=proline`, `BRIDGE_PEER_ID=opula`,
   `BRIDGE_PEER_URL=https://api.opulamarkets.com`.
3. **Migrate:** `docker compose --profile migrate up migrate`. This runs Alembic
   revision 0030 on Opula and 0026 on Proline. The admin API also creates the
   tables at startup if the migration hasn't run.
4. **Deploy** `gateway`, `admin-api`, `admin-frontend` and the new `trade-bridge`
   service:

   ```sh
   docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build \
     gateway admin-api admin-frontend trade-bridge
   ```

   Run exactly one `trade-bridge` replica.
5. **Create links.** Go to admin → **Platform Bridge**, click **Test
   connection**, then **Add link**. Saving a link checks that the peer account
   exists on the other platform.

## Security

The shared secret lets the sister platform open and close trades on any account
here. Treat it like a database password.

- Every request is HMAC-SHA256 signed over `timestamp + method + path + body`.
- The timestamp is checked within ±30 s.
- The sender must identify as `BRIDGE_PEER_ID`.
- With `BRIDGE_ENABLED=false` the endpoints return 404.

## Internals

| Piece | File |
|---|---|
| Shared mapping, signing, peer client | `backend/packages/common/src/platform_bridge.py` |
| Outbound worker | `backend/services/trade-bridge/src/main.py` |
| Inbound API (`/api/bridge/v1/*`) | `backend/services/gateway/src/api/bridge.py`, `services/bridge_service.py` |
| Admin API / page | `backend/services/admin/routes/bridge_links.py`, `frontend/admin/src/app/(admin)/platform-bridge/` |
| Tables | `bridge_links` (outbound links), `bridge_trades` (every bridged position, `out` or `in`) |

**Idempotency.** The receiver commits an `in` row keyed by
(peer, source position id) before it places the order. The order is tagged
`Bridge|<peer>|<source position id>`. A retried open finds that row or tag and
returns the existing copy, so one source position never produces two orders.

**Loop guard.** The outbound worker skips any position that has a
`bridge_trades` row or a `Bridge|`-tagged order. The tag is committed in the same
transaction as the position, so there is no window in which a fresh copy looks
like a native trade.

**Tests.** `backend/tests/test_platform_bridge.py` covers the mapping and
signing logic. Run it from `backend/` with
`python -m pytest tests/test_platform_bridge.py`.
