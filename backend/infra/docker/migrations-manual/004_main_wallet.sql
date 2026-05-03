-- Main wallet: funds for external deposit/withdraw; trading accounts hold trading balance.
-- Apply on existing DBs: psql $DATABASE_URL -f 004_main_wallet.sql

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS main_wallet_balance NUMERIC(18, 8) NOT NULL DEFAULT 0;

ALTER TABLE withdrawals
    ALTER COLUMN account_id DROP NOT NULL;

ALTER TABLE transactions
    ALTER COLUMN account_id DROP NOT NULL;

COMMENT ON COLUMN users.main_wallet_balance IS 'Withdrawable / prefunding balance (not on trading accounts until transferred)';
