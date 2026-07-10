# Bulk Trade Upload — Excel/CSV template

Admin → **Trades → Upload Trade**. Upload an `.xlsx` (or `.csv`) file and one
trade (open position) is created per row. Download the live template from the
**Template** button on the Trades page, or use `trade_upload_template.xlsx` here.

## Columns

| Column           | Required | Notes |
|------------------|----------|-------|
| `user_email`     | ✅       | Email of the user the trade belongs to. |
| `account_number` | optional | Specific trading account. If blank, the user's first live (non-demo) account is used. |
| `symbol`         | ✅       | Instrument symbol, e.g. `XAUUSD`, `EURUSD`, `BTCUSD`. |
| `side`           | ✅       | `buy` or `sell`. |
| `lots`           | ✅       | Lot size, e.g. `0.10`. Must be > 0. |
| `open_price`     | optional | Entry price. If blank, the current live market price is used. |
| `stop_loss`      | optional | SL price. |
| `take_profit`    | optional | TP price. |
| `comment`        | optional | Free text tag on the trade. |

- Header names are case-insensitive and accept common aliases (`email`, `sl`, `tp`, `price`, `volume`, …).
- Rows are independent: a bad row is reported and skipped; valid rows still get created.
- After upload, a summary shows created / failed counts and the reason for each skipped row.
