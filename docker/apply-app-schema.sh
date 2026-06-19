#!/usr/bin/env bash
# Apply this repo's migrations + seed to the self-hosted stack's Postgres.
# Run AFTER `docker compose up -d` reports the db healthy.
# Streams each SQL file into the supabase-db container (no local psql needed).
#
# Note: this applies SQL directly and does NOT write supabase_migrations history.
# It's meant for a fresh local self-hosted DB. For CLI parity use:
#   supabase db push --db-url "postgresql://postgres:<POSTGRES_PASSWORD>@127.0.0.1:54322/postgres"
set -euo pipefail

# repo root = parent of this script's dir
cd "$(dirname "$0")/.."

PSQL=(docker exec -i supabase-db psql -v ON_ERROR_STOP=1 -U postgres -d postgres)

echo "==> Applying migrations"
for f in supabase/migrations/*.sql; do
  echo "    $f"
  "${PSQL[@]}" < "$f"
done

echo "==> Seeding (admin, matches, quiz, dev-results)"
# dev-results MUST follow matches (it UPDATEs the freshly-seeded fixtures).
for name in admin matches quiz dev-results; do
  f="supabase/seed/${name}.sql"
  echo "    $f"
  "${PSQL[@]}" < "$f"
done

echo "==> Done."
