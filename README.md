# FHIR Playground — Riverside Medical Center

A small but realistic healthcare integration scenario for learning **FHIR R4**,
built with **Java 21, Gradle, Jakarta EE (servlets) and Tomcat 10.1**, using
[HAPI FHIR](https://hapifhir.io/) — the de-facto standard FHIR library for Java.

The scenario: a fictional hospital ("Riverside Medical Center") runs an EMR that
publishes clinical events. A ward dashboard consumes them — the same shape of
problem you know from HL7 v2 interfaces, redone the FHIR way.

```
┌───────────────────────────────┐        ┌──────────────────────────────┐
│  emr-server  (webapp /emr)    │        │ ward-dashboard  (webapp      │
│                               │        │ /dashboard)                  │
│  PostgreSQL ──> JPA entities  │  FHIR  │                              │
│      │            │           │  REST  │  ApiServlet ──> browser UI   │
│      │            ▼           │◄───────┤   (HAPI IGenericClient)      │
│      │       FHIR R4 API      │        │                              │
│      │       /emr/fhir/*      │  poll  │  message feed panel          │
│      └──> event outbox ───────┼───────►│   (FHIR message Bundles)     │
│           /emr/messages/next  │        │                              │
│  simulator /emr/simulate/*    │        │                              │
└───────────────────────────────┘        └──────────────────────────────┘
```

## The two FHIR exchange styles this project demonstrates

FHIR supports several exchange paradigms; this playground shows the two most
important ones side by side:

1. **REST (query style)** — the dashboard asks the EMR questions:
   `GET /Patient?family=diaz`, `GET /Encounter?status=in-progress`,
   `GET /Observation?patient=1&category=vital-signs`. There is no v2 equivalent
   for this — it's the biggest conceptual upgrade over HL7 v2.
2. **Messaging (event style)** — the EMR pushes events as FHIR *message
   Bundles*: a `MessageHeader` (think MSH segment) followed by the resources
   the event is about (think PID/PV1/OBX segments). The mapping to what you
   already know:

   | Event in this project | HL7 v2 analog | Bundle contents                          |
   |-----------------------|---------------|------------------------------------------|
   | `admit`               | ADT^A01       | MessageHeader + Patient + Encounter       |
   | `discharge`           | ADT^A03       | MessageHeader + Patient + Encounter       |
   | `lab-result`          | ORU^R01       | MessageHeader + Patient + Observation (+ Encounter) |

The test data is realistic on purpose: patients have MRNs, practitioners have
NPIs, observations carry **LOINC** codes with **UCUM** units and reference
ranges (out-of-range values get an H/L interpretation flag), and encounters
have wards, admission reasons and attending physicians.

## Running it

### With Docker (recommended)

```bash
docker compose up --build
```

Then open:

- **Ward dashboard (the UI):** <http://localhost:8080/dashboard/>
- EMR landing page: <http://localhost:8080/emr/>
- EMR FHIR endpoint: <http://localhost:8080/emr/fhir/metadata>

Data lives in PostgreSQL 16 (`docker compose down -v` resets it). The database
is seeded on first startup: six patients, three clinicians, two current
inpatients with vitals/labs, and a few queued messages.

### Without Docker

You need a Tomcat 10.1 (Jakarta EE 10; Tomcat 9 will *not* work) and JDK 21:

```bash
./gradlew war
cp emr-server/build/libs/emr.war ward-dashboard/build/libs/dashboard.war $CATALINA_HOME/webapps/
$CATALINA_HOME/bin/startup.sh
```

Without configuration the EMR falls back to an **in-memory H2 database**
(data resets on restart) — handy for quick experiments. To use PostgreSQL,
set environment variables before starting Tomcat:

| Variable       | Purpose                            | Default                              |
|----------------|------------------------------------|--------------------------------------|
| `DB_URL`       | JDBC URL of the EMR database       | in-memory H2                          |
| `DB_USER`      | database user                      | `sa`                                  |
| `DB_PASSWORD`  | database password                  | (empty)                               |
| `EMR_BASE_URL` | where the dashboard finds the EMR  | `http://localhost:8080/emr`           |

### Tests

```bash
./gradlew test
```

The tests seed the same data into H2 and exercise the FHIR mapping, the
clinical simulator and the message builder end to end.

## Things to try

Open the dashboard, hit **Start polling**, then press the simulate buttons and
watch admissions, discharges and lab results arrive as FHIR message Bundles
(expand *raw FHIR message Bundle* on any entry to read the actual payload).

Then explore the FHIR API directly — HAPI renders syntax-highlighted responses
in the browser:

- `GET /emr/fhir/metadata` — the **CapabilityStatement**, FHIR's machine-readable
  "what can this server do" document
- `GET /emr/fhir/Patient?family=diaz` — search by name
- `GET /emr/fhir/Patient?identifier=MRN-100234` — search by MRN
- `GET /emr/fhir/Encounter?status=in-progress` — the current inpatient census
- `GET /emr/fhir/Observation?patient=1&category=vital-signs` — one patient's vitals
- `GET /emr/messages/pending` / `GET /emr/messages/next` — the raw message feed
- `curl -X POST http://localhost:8080/emr/simulate/lab` — generate activity from the CLI

Ideas for extending the playground:

- Add `@Create`/`@Update` support to the providers (FHIR write operations)
- Add a `Condition` or `MedicationRequest` resource type
- Replace polling with a FHIR `Subscription` (the modern push mechanism)
- Validate resources against profiles (HAPI has a validator module)
- Point the dashboard's `EMR_BASE_URL` at a public test server like
  <https://hapi.fhir.org/baseR4> and see how much still works

## Where the interesting code is

| Concern | File |
|---|---|
| Entity → FHIR resource mapping (identifiers, LOINC/UCUM, references) | `emr-server/.../fhir/FhirMapper.java` |
| FHIR REST endpoint (HAPI RestfulServer + providers) | `emr-server/.../fhir/EmrFhirServlet.java`, `*Provider.java` |
| Building FHIR message Bundles from events | `emr-server/.../messaging/MessageBuilder.java` |
| The outbox / message queue | `emr-server/.../messaging/MessageFeedServlet.java`, `entity/EventEntity.java` |
| Consuming FHIR with the HAPI client | `ward-dashboard/.../ApiServlet.java` |
| Test data & clinical simulation | `emr-server/.../bootstrap/StartupListener.java`, `sim/ClinicalSimulator.java` |

## FAQ

### Does it make sense to use Mirth Connect?

**Not for learning FHIR itself — but yes later, for integration work.**
Mirth Connect (now "NextGen Connect") is an *interface engine*: its sweet spot
is receiving HL7 v2 over MLLP, transforming messages, and routing them between
systems that don't speak the same dialect. In real hospitals it (or Rhapsody,
Cloverleaf, …) often sits exactly where the arrow between our two webapps is,
and a very common real-world job is **v2→FHIR translation** (e.g. consume
ORU^R01, produce FHIR Observations).

For this playground it would add a heavy moving part while hiding the thing
you're trying to learn — the FHIR resources and APIs themselves. A good
learning path: understand FHIR natively first (this project), then, as a
second step, put Mirth between a v2 sender and this EMR and let a channel do
ADT→FHIR mapping. That mirrors how the industry actually migrates.

### Does it make sense to use Docker?

**Yes.** This is the standard way to run multi-part setups like
Tomcat + PostgreSQL reproducibly, and healthcare integration work is *always*
multi-part (add Mirth, a v2 sender, an OpenID provider… each is just another
service in `docker-compose.yml`). The compose file in this repo gives you a
one-command start and a one-command reset (`docker compose down -v`), which is
exactly what you want in a playground. The H2 fallback exists so you can also
run without Docker, but Postgres-in-compose is the realistic configuration.

## Learning resources

**The specification (surprisingly readable):**

- [FHIR R4 spec](https://hl7.org/fhir/R4/) — start with the
  [resource list](https://hl7.org/fhir/R4/resourcelist.html),
  [Patient](https://hl7.org/fhir/R4/patient.html) and
  [Observation](https://hl7.org/fhir/R4/observation.html)
- [FHIR exchange paradigms](https://hl7.org/fhir/R4/exchange-module.html) —
  REST vs messaging vs documents
- [FHIR for HL7 v2 practitioners](https://hl7.org/fhir/R4/comparison-v2.html) —
  written exactly for your background
- [v2-to-FHIR mapping IG](https://build.fhir.org/ig/HL7/v2-to-fhir/) — official
  mappings from ADT/ORU segments to FHIR resources

**Tools & servers to play with:**

- [HAPI FHIR documentation](https://hapifhir.io/hapi-fhir/docs/) — the library
  used here; also ships a full-blown JPA server you can run as a container
  (`docker run -p 8090:8080 hapiproject/hapi:latest`)
- [hapi.fhir.org](https://hapi.fhir.org/) — public test server with a UI;
  anyone can read/write (never put real data there)
- [Synthea](https://github.com/synthetichealth/synthea) — generates realistic
  synthetic patient records as FHIR Bundles; great bulk test data
- [clinfhir.com](https://clinfhir.com/) — visual FHIR resource builder/explorer
- [Postman/Insomnia + any FHIR base URL] — FHIR is just HTTP+JSON

**Ecosystem, once the basics sit:**

- [SMART on FHIR](https://docs.smarthealthit.org/) — OAuth2-based app launch,
  how third-party apps plug into EHRs
- [US Core](https://hl7.org/fhir/us/core/) /
  [IPS](https://hl7.org/fhir/uv/ips/) — profiles: how countries/projects
  constrain base FHIR
- [FHIR Bulk Data ($export)](https://hl7.org/fhir/uv/bulkdata/) — analytics-scale access
- [chat.fhir.org](https://chat.fhir.org/) — the official Zulip; the community
  answers beginner questions daily
- Book: *FHIR for Developers* material at
  [fhir.org](https://fhir.org/) and the free
  [HL7 FHIR fundamentals course](https://www.hl7.org/training/fhir-fundamentals.cfm)

## Repository layout

```
├── build.gradle.kts / settings.gradle.kts / gradle.properties
├── docker-compose.yml            # postgres + tomcat
├── Dockerfile                    # multi-stage: gradle build → tomcat
├── emr-server/                   # "the hospital" (WAR: /emr)
│   └── src/main/java/org/riverside/emr/
│       ├── entity/               # JPA entities (patients, encounters, …, event outbox)
│       ├── persistence/          # Hibernate bootstrap + repository
│       ├── bootstrap/            # schema + seed data on startup
│       ├── fhir/                 # HAPI RestfulServer, providers, entity→FHIR mapper
│       ├── messaging/            # FHIR message Bundle builder + polling feed
│       └── sim/                  # LOINC catalog + clinical activity simulator
└── ward-dashboard/               # "the consumer" (WAR: /dashboard)
    ├── src/main/java/org/riverside/dashboard/   # HAPI client + JSON API for the UI
    └── src/main/webapp/          # the browser UI (vanilla HTML/JS/CSS)
```
