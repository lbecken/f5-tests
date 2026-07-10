#!/usr/bin/env bash
# Starts a throwaway Postgres in Docker and loads the demo schema.
set -euo pipefail
cd "$(dirname "$0")/.."

NAME=${NAME:-syndata-pg}
PORT=${PORT:-5455}

docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run -d --name "$NAME" \
  -e POSTGRES_USER=syndata -e POSTGRES_PASSWORD=syndata -e POSTGRES_DB=syndata \
  -p "$PORT":5432 postgres:16 >/dev/null

echo "Waiting for Postgres on port $PORT ..."
for _ in $(seq 1 60); do
  if docker exec "$NAME" psql -U syndata -d syndata -c 'select 1' >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

docker exec -i "$NAME" psql -q -U syndata -d syndata < testdata/schema.sql
echo "Postgres ready: jdbc:postgresql://localhost:$PORT/syndata (user/password: syndata/syndata)"
