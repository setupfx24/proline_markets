-- Run once on existing DBs (Docker volume already initialized without this column).
-- docker compose exec -T postgres psql -U Proline Markets -d Proline Markets -f - < infra/docker/patch-trade-history-close-reason.sql
ALTER TABLE trade_history ADD COLUMN IF NOT EXISTS close_reason VARCHAR(20) DEFAULT 'manual';
