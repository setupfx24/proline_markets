-- =============================================================================
-- REQUIRED once on existing production DBs after deploying account_types code.
-- Fixes: UndefinedColumnError: column account_groups.minimum_deposit does not exist
--
-- From host (repo root), service name must match compose (often "postgres"):
--   docker compose exec -T postgres psql -U Proline Markets -d Proline Markets < backend/infra/docker/migrations-manual/001_account_groups_minimum_deposit.sql
--
-- Or inline:
--   docker compose exec postgres psql -U Proline Markets -d Proline Markets -c "ALTER TABLE account_groups ADD COLUMN IF NOT EXISTS minimum_deposit DECIMAL(18,8) DEFAULT 0;"
-- =============================================================================

ALTER TABLE account_groups
  ADD COLUMN IF NOT EXISTS minimum_deposit DECIMAL(18,8) DEFAULT 0;

UPDATE account_groups SET minimum_deposit = 0 WHERE minimum_deposit IS NULL;
