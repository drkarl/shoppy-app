#!/usr/bin/env bash
#
# Verify that the Supabase migrations apply cleanly to a throwaway PostgreSQL 16.
#
# Supabase supplies the auth schema, auth.uid() and pgcrypto; a vanilla
# postgres image does not, so a minimal shim is created before the migrations
# run. The container is removed on exit.
#
# Usage: scripts/verify-migrations.sh
# Requires: podman.

set -euo pipefail

CONTAINER="shoppy-migrations-verify-$$"
DATABASE=shoppy_verify

psql_exec() {
  podman exec -i "$CONTAINER" \
    psql -U postgres -d "$DATABASE" -v ON_ERROR_STOP=1 -q "$@"
}

cleanup() {
  podman rm -f "$CONTAINER" >/dev/null 2>&1 || true
}
trap cleanup EXIT

podman run -d --rm --name "$CONTAINER" \
  -e POSTGRES_PASSWORD=shoppy \
  -e POSTGRES_DB="$DATABASE" \
  docker.io/library/postgres:16-alpine >/dev/null

ready=""
for _ in $(seq 1 60); do
  if podman exec "$CONTAINER" pg_isready -h 127.0.0.1 -U postgres -d "$DATABASE" >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 1
done
if [ -z "$ready" ]; then
  echo "PostgreSQL did not become ready" >&2
  exit 1
fi

# Minimal Supabase shim: the pieces the migrations reference but a vanilla
# PostgreSQL image does not provide.
psql_exec -1 <<'SQL'
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS auth.users (id UUID PRIMARY KEY, email TEXT);
CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID
LANGUAGE sql STABLE
AS $$ SELECT NULL::UUID $$;
SQL

for migration in supabase/migrations/*.sql; do
  echo "applying $(basename "$migration")"
  psql_exec -1 <"$migration"
done

tables=$(psql_exec -tAc "SELECT count(*) FROM pg_tables WHERE schemaname = 'public'")
categories=$(psql_exec -tAc "SELECT count(*) FROM categories")

if [ "$tables" -ne 6 ]; then
  echo "expected 6 tables, found $tables" >&2
  exit 1
fi
if [ "$categories" -ne 11 ]; then
  echo "expected 11 seeded categories, found $categories" >&2
  exit 1
fi

echo "OK: $tables tables and $categories categories created"
