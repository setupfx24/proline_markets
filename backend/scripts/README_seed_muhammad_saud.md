# Seed: client Muhammad Saud

Adds the client **Muhammad Saud** (`saudkhanuae31@gmail.com`) with full history:
account open date, deposits, month-wise trades, month-wise P&L, and the monthly
profit withdrawals — so it all shows in the existing Trade History and
Transaction History screens (filterable by date).

## Files
- `gen_seed_muhammad_saud.py` — generator (pure stdlib). Edit the constants at
  the top and re-run to regenerate the SQL. Self-verifies the monthly sums.
- `seed_client_muhammad_saud.sql` — the SQL to apply. One transaction, one
  PL/pgSQL block. **Idempotent**: re-running rebuilds only this user's data.

## What it creates
| Item | Value |
|---|---|
| Account opened | 25 Nov 2025 |
| Deposits | 100,000 (02 Jan 2026) + 50,000 (04 Jan 2026) = 150,000 USD |
| Monthly net profit | Jan 4.2% / Feb 3.4% / Mar 4.9% / Apr 5.3% / May 4.6% / Jun 4.1% of 150,000 |
| Instruments | XAUUSD 80% / GBPUSD 10% / US100 (USTEC·NQ) 10% |
| Withdrawals | each month's profit withdrawn on the 5th & 6th of the next month |
| Closed trades | 54 (9 per month) |
| Final balance | 156,150 USD (June profit retained; all earlier months withdrawn) |
| Login password | `Proline@2026` (change after handover) |

## Apply to production
Run from the host where the stack lives. Pick whichever matches your setup:

**A. Docker compose (postgres service):**
```bash
docker compose exec -T postgres psql -U proline -d proline < backend/scripts/seed_client_muhammad_saud.sql
```

**B. Direct psql (set your real connection string):**
```bash
psql "postgresql://USER:PASSWORD@HOST:5432/proline" -f backend/scripts/seed_client_muhammad_saud.sql
```

On success it prints `NOTICE: Seeded Muhammad Saud (account NNNNNN): balance 156150.00`.
On any error the whole transaction rolls back — nothing is partially written.

## Notes
- The `users` table on a fresh prod deploy may be missing the `book_type` column
  (known drift). This script does **not** touch `book_type`, so it is unaffected.
- "USTEC (NQ)" maps to the seeded symbol `US100` (falls back to `NAS100`).
- Trade `open_price`/`close_price` are cosmetic; the authoritative P&L is the
  stored `profit` per trade, which is exact.
- Validated against a throwaway copy of `init-db.sql`: month-wise P&L, 80/10/10
  split, withdrawals, balance, and bcrypt password all confirmed correct.
