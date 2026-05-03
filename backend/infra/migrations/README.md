# Proline Markets — Alembic Migrations

Schema evolution is managed via Alembic. All migration files live in `versions/`.

## Baseline

`infra/docker/init-db.sql` is the **baseline schema** — it represents the initial
database state. The first `--autogenerate` run will detect any drift between the
current DB and the ORM models in `packages/common/src/models.py`.

## Prerequisites

```bash
# From the backend/ root (where packages/ is visible)
export DATABASE_URL=postgresql+asyncpg://Proline Markets:Proline Markets_dev@localhost:5432/Proline Markets
```

Alembic must be installed (it is included in `packages/common` dependencies):
```bash
pip install -e backend/packages/common
```

## Common Commands

All commands must be run from **`backend/`** so that `packages/common` is on the path:

### Generate a new migration (auto-detect model changes)
```bash
cd backend
alembic -c infra/migrations/alembic.ini revision --autogenerate -m "describe your change"
```

### Apply all pending migrations
```bash
cd backend
alembic -c infra/migrations/alembic.ini upgrade head
```

### Rollback one migration
```bash
cd backend
alembic -c infra/migrations/alembic.ini downgrade -1
```

### Check current revision
```bash
cd backend
alembic -c infra/migrations/alembic.ini current
```

### Show migration history
```bash
cd backend
alembic -c infra/migrations/alembic.ini history --verbose
```

## Via Docker Compose

Run the one-off `migrate` service (does NOT start automatically):

```bash
docker compose --profile migrate up migrate
```

This uses `DATABASE_URL` from the compose environment and runs `alembic upgrade head`.

## Notes

- Never edit a migration file that has already been applied to production.
- Always review auto-generated migrations before applying — Alembic may miss
  table renames or data migrations.
- `versions/.gitkeep` keeps the directory tracked by git when empty.
