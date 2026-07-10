# Bulk Trade Upload — Excel template

Admin → **Trades → Upload Trade**. **Only `.xlsx` (Excel) files are accepted** —
anything else is rejected with a warning. Download the template from the
**Template** button on the Trades page (always valid, generated fresh by the
server), or use `trade_upload_template.xlsx` here. One trade (open position) is
created per row.

## Columns (same as the Trades table)

The template columns mirror the Trades table exactly:

`USER | SYMBOL | SIDE | LOTS | OPEN | CURRENT | SPREAD | P&L | COMM. | SL | TP | OPENED`

Only these are used to create a trade:

| Column   | Required | Notes |
|----------|----------|-------|
| `USER`   | ✅       | Email of the user the trade belongs to. Uses the user's first live (non-demo) account. |
| `SYMBOL` | ✅       | Instrument symbol, e.g. `XAUUSD`, `EURUSD`, `BTCUSD`. |
| `SIDE`   | ✅       | `buy` or `sell`. |
| `LOTS`   | ✅       | Lot size, e.g. `0.10`. Must be > 0. |
| `OPEN`   | optional | Entry price. If blank, the current live market price is used. |
| `SL`     | optional | Stop-loss price. |
| `TP`     | optional | Take-profit price. |

`CURRENT`, `SPREAD`, `P&L`, `COMM.`, `OPENED` are display-only columns in the
table and are **ignored** on upload (leave them blank).

- Header names are case-insensitive.
- Rows are independent: a bad row is reported and skipped; valid rows still get created.
- After upload, a summary shows created / failed counts and the reason for each skipped row.
