#!/usr/bin/env bash
# End-to-end demo: start Postgres in Docker, scan, generate, insert, verify.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT=${PORT:-5455}
ROWS=${ROWS:-25}

./scripts/start-postgres.sh

GRADLE_CMD=${GRADLE_CMD:-./gradlew}
$GRADLE_CMD -q shadowJar
JAR=$(ls build/libs/syndata-*.jar | head -1)
SYN="java -jar $JAR"
CONN="--url jdbc:postgresql://localhost:$PORT/syndata --user syndata --password syndata"

echo; echo "=== scan ==="
$SYN scan $CONN -o build/demo-schema.json

echo; echo "=== generate ($ROWS rows/table, orders x2) ==="
$SYN generate -s build/demo-schema.json -o build/demo-data.json -n "$ROWS" -t "orders=$((ROWS * 2))" --seed 42

echo; echo "=== insert ==="
$SYN insert $CONN -s build/demo-schema.json -d build/demo-data.json

echo; echo "=== row counts in the database ==="
docker exec -i syndata-pg psql -U syndata -d syndata -c "
  select relname as table, n_live_tup as rows
  from pg_stat_user_tables order by relname;"

echo "Demo done. Stop the database with: docker rm -f syndata-pg"
