# syndata — smart synthetic data for Postgres

A CLI that connects to a PostgreSQL database, understands its structure
(tables, column types, PKs, FKs, NOT NULL, unique and CHECK constraints, enum
types, join tables, sequences), and generates realistic, FK-consistent
synthetic data — with file-based export/import at every step so schema and data
can travel between environments.

Built for Jakarta EE / JPA applications that use a **Hibernate global sequence**
for all primary keys: the tool detects sequence-backed PKs and allocates real
ids from that sequence at insert time, so its inserts never collide with ids
the application generates later.

```
scan ──► schema.json ──► generate ──► data.json ──┬─► insert ──► database
(needs DB)              (offline)                 └─► sql ─► load.sql ─► psql
                                                     (offline)
```

## Quick start

Requirements: Java 17+, Docker (only for the demo database).

```bash
./scripts/demo.sh          # start Postgres 16 in Docker, scan, generate, insert, verify
```

Or step by step against your own database:

```bash
./gradlew shadowJar
alias syndata='java -jar build/libs/syndata-0.1.0.jar'

# 1. Export the schema (all tables, or a subset) to a file
syndata scan --url jdbc:postgresql://localhost:5432/mydb -U me -P secret -o schema.json

# 2. Generate synthetic data from the schema file (no DB connection needed)
syndata generate -s schema.json -o data.json -n 40 -t orders=200 --seed 42

# 3. Load the data file into a database
syndata insert --url jdbc:postgresql://localhost:5432/mydb -U me -P secret \
    -s schema.json -d data.json
```

## Commands

### `syndata scan`

Introspects the database and writes a schema file containing, per table:
columns (name, Postgres type, length/precision/scale, nullability, defaults),
primary key, foreign keys, unique constraints, CHECK constraints (allowed
values parsed out of simple `IN (...)` checks, and min/max bounds out of simple
numeric ranges such as `price >= 0`, `quantity > 0`, or BETWEEN), Postgres enum
labels, identity/serial flags, and which sequence feeds each column. Pure
association (join) tables are flagged. The file doubles as a human-readable
inventory of your schema.

| Option | Meaning |
|---|---|
| `-o schema.json` | output file |
| `-i / --include`, `-x / --exclude` | table name patterns (`*`/`?` wildcards, repeatable) |
| `--with-dependencies` | pull in tables referenced by the included ones, transitively |
| `--capture-keys [N]` | sample up to N (default 1000) existing PK values per table into the schema file |
| `--db-schema public` | database schema |
| `--sequence hibernate_sequence` | name of the global id sequence |
| `--entities-path`, `--entities-package` | optional JPA entity enrichment (below) |

Scanning a subset (e.g. `-i 'order*' --with-dependencies`) is the intended way
to work with a 500–1000 table database: export just the corner you care about,
and the FK closure keeps it generatable.

**Inserting into a non-empty database:** with `--capture-keys`, FK targets
*outside* the selection become key-only stub tables carrying sampled existing
PK values. `generate` then points foreign keys at those **existing rows**
instead of creating new parents — e.g.
`scan -i 'order*' --capture-keys` followed by `generate` + `insert` adds new
orders for customers and products that already live in the target database.
The same fallback applies to any table forced to zero rows with `-t table=0`.

### `syndata generate`

Reads a schema file and writes a data file. No database connection.

- Tables are generated in **dependency order**; every FK value points at a
  generated parent row. Self-references (e.g. `manager_id`) point at earlier
  rows; FK cycles (e.g. `departments.head_employee_id` ⇄
  `employees.department_id`) are broken on a nullable FK, which is recorded in
  the data file and applied via UPDATE after loading.
- Sequence-backed PKs are written as **negative local ids**; real values are
  allocated only at insert time.
- Values honor Postgres **enum types**, `CHECK (col IN (...))` lists, numeric
  **range checks** (`>=`, `>`, `<=`, `<`, BETWEEN — hard bounds beat name
  heuristics), column **lengths**, **NOT NULL**, and **unique** constraints
  (including composite uniques and join-table pairs — generation stops early if
  combinations run out).
- **Column-name heuristics** (DataFaker) make text realistic: `first_name`,
  `email`, `phone`, `street`/`city`/`postal_code`/`country_code`, `company`,
  `description`, `price`/`amount`/`salary`, `quantity`, `date_of_birth`,
  `created_at`, `sku`, `uuid`, `latitude`, … with type-based fallbacks for
  everything else.

| Option | Meaning |
|---|---|
| `-n / --rows 10` | default rows per table |
| `-t / --table-rows orders=200` | per-table override (repeatable) |
| `--seed 42` | reproducible output |
| `--null-ratio 0.1` | how often nullable columns are NULL |
| `--locale en` | DataFaker locale |
| `--ai` | local-model enrichment (below) |

### `syndata insert`

Reads the schema + data files and loads the rows:

1. For each sequence-backed column, allocates real values with
   `nextval()` — the Hibernate global sequence, serial sequences, and identity
   columns all work — and remaps every local id, including all FK references.
2. Inserts in dependency order with JDBC batches, in a **single transaction**
   (any failure rolls everything back).
3. Applies the deferred cycle-breaking FK columns with batched UPDATEs.

`--dry-run` prints the plan without connecting; `--batch-size` tunes batching.
Because ids always come from the live sequences, you can insert several
generated files into the same database — just generate each with a different
seed, since *natural* unique values (emails, names) in a single file can only
be loaded once.

### `syndata sql`

Renders a data file to a **plain SQL script** (`-o load.sql`) that runs with
psql or any SQL client — useful for environments where only a script can be
shipped. No database connection needed: the script itself allocates real ids
(a temporary local→real id mapping table filled with `nextval()`, referenced
through scalar subqueries), inserts in dependency order, applies deferred FK
updates, and wraps everything in one transaction.

```bash
syndata sql -s schema.json -d data.json -o load.sql
psql -h dbhost -U me -d mydb -f load.sql
```

## Configuration

All connection settings can come from CLI options, environment variables
(`SYNDATA_DB_URL`, `SYNDATA_DB_USER`, `SYNDATA_DB_PASSWORD`), or a properties
file (`--config`), in that precedence order. See
[`config/example.properties`](config/example.properties).

## Reading JPA entities — helpful or redundant?

Mostly redundant, occasionally valuable — so it is **off by default** and
flag/config controlled (`--entities-path` or `entities.enabled=true`).

The database already knows structure better than the annotations do: types,
nullability, FKs, uniques live in Postgres regardless of what the Java code
claims. What the database *cannot* express is Java-side semantics:

- a `varchar` column persisted with `@Enumerated(EnumType.STRING)` but **no**
  CHECK constraint — the DB sees "any string", the entity knows the exact
  constants. Without this, generated values would fail app-level expectations.
- Bean Validation hints such as `@Email` on generic column names.

`scan --entities-path app/build/classes/java/main --entities-package com.acme`
loads compiled classes best-effort (classes that fail to load are skipped) and
merges those hints into the schema file as `semanticValues`. Everything else
still comes from the database.

## Local model ("smart" text values)

For columns like `description` where faker lorem text is bland, `generate --ai`
asks a **local Ollama model** (`ai.url`, `ai.model` in the config) for a pool of
sample values — **one request per column**, cached, then sampled per row, so
cost stays O(columns) not O(rows). Specific heuristics (emails, names, prices)
are never delegated; only free-text columns are. If the model is unreachable or
answers garbage, generation silently falls back to the built-in generators, so
the flag is always safe to pass.

## Demo schema

[`testdata/schema.sql`](testdata/schema.sql) (13 tables) exercises the hard
parts: global Hibernate sequence, serial and identity columns, a Postgres enum,
CHECK `IN` lists, a composite-PK join table, self-references, a nullable FK
cycle, and a one-to-one unique FK. `./scripts/start-postgres.sh` loads it into
a throwaway `postgres:16` container (port 5455), `./scripts/demo.sh` runs the
whole pipeline against it.

## Development

```bash
./gradlew test         # unit tests (no database needed)
./gradlew shadowJar    # build the single-jar CLI
```

Code layout: `db` (introspection), `analyze` (dependency graph, CHECK parsing),
`gen` (heuristics + generator), `insert` (id allocation, coercion, loading),
`entity` (JPA enrichment), `ai` (Ollama client), `cli`/`config`/`io`/`model`.

## Prior art that shaped the design

- [Tonic.ai on realistic Postgres test data](https://www.tonic.ai/blog/how-to-create-realistic-test-data-for-postgresql) — respect constraints first, realism second
- [Synth's Postgres data generation](https://getsynth.com/docs/blog/2021/03/09/postgres-data-gen) — schema-file-driven, declarative generation
- [SeedBase](https://seedbase.dev/) — FK-consistent seeding from schema definitions
- [SDV (Synthetic Data Vault)](https://blog.devart.com/synthetic-data-generation-tools.html) — multi-table referential consistency
- [DataFaker](https://www.datafaker.net/) — the value-realism engine used here
- Benerator, Jailer, Mockaroo — subsetting and volume-generation ideas
