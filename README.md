# Jakarta EE 9 development environment — Tomcat (Docker) + Gradle + Eclipse

A complete, working development setup for:

| Concern            | Choice                                                        |
|--------------------|---------------------------------------------------------------|
| Language / JDK     | Java 21 (Temurin)                                             |
| Server             | Apache Tomcat 10.1 in Docker (`jakarta.*` namespace)          |
| Specs / libs       | JSF 3.0 (Mojarra) · PrimeFaces 13 · CDI 3.0 (Weld) · JPA 3.0 (Hibernate 6.1) · Bean Validation 3.0 |
| Database           | PostgreSQL 16 in Docker                                       |
| Build              | Gradle (wrapper included)                                     |
| IDE                | Eclipse 2026-03 (Enterprise Java and Web Developers package)  |
| Debugging          | JDWP remote debug from Eclipse, breakpoints, hot code replace |
| Hotswap            | Standard JVM hotswap out of the box; optional JetBrains Runtime + HotswapAgent (DCEVM successor) for structural changes |

A small sample app (person CRUD: JSF page → PrimeFaces table → CDI bean →
JPA repository → PostgreSQL) is included so every layer can be verified
immediately.

---

## 1. Is this setup possible? (short honest answers)

**Yes**, with three things worth knowing up front:

1. **Tomcat is a servlet container, not a full Jakarta EE server.** It only
   provides Servlet / EL / WebSocket. JSF, CDI, JPA and Bean Validation work
   perfectly well on Tomcat — the standard approach, used here — by bundling
   Mojarra, Weld, Hibernate and Hibernate Validator inside the WAR
   (see `build.gradle`).
2. **JTA is the one spec that does not simply drop in.** Tomcat has no
   transaction manager, so `persistence.xml` uses `RESOURCE_LOCAL` and a small
   CDI interceptor (`@com.example.app.persistence.Transactional`) gives you
   declarative transactions. If you later need *real* JTA (XA, two-phase
   commit across resources), embed [Narayana](https://narayana.io/) or
   Atomikos — or switch to a full server (WildFly, Payara, TomEE), which this
   project's code would run on unchanged. For a single PostgreSQL database,
   `RESOURCE_LOCAL` is all you need.
3. **Tomcat versions vs EE versions:** Tomcat 10.**0** (the exact EE 9 match)
   is end-of-life; Tomcat 10.**1** implements the EE 10 web specs, which are
   backward compatible with EE 9 applications, runs great on Java 21, and is
   what the Docker image uses. Your dependencies stay pinned to the EE 9
   baseline (`jakarta.*` namespace, JSF 3.0 / CDI 3.0 / JPA 3.0). Do **not**
   use Tomcat 11 (it requires the EE 11 baseline).

Java 21 is fully compatible with everything in this stack.

---

## 2. Prerequisites

- Docker (with the compose plugin) — you already have this
- JDK 21 installed locally (Temurin recommended) — used by Gradle and Eclipse
- Eclipse IDE **for Enterprise Java and Web Developers** 2026-03
  (the "Enterprise" package matters: it includes Buildship, WTP, the Servers
  view, and web editors)

No local Tomcat or PostgreSQL installation is needed.

---

## 3. Quick start (command line, before any Eclipse setup)

```bash
./gradlew deploy                      # build + explode the app into docker/deploy/ROOT
cd docker && docker compose up -d --build
docker compose logs -f tomcat         # wait for "Server startup in ..."
```

Open <http://localhost:8080/> — you should see the PrimeFaces person CRUD
page, backed by PostgreSQL.

Ports on your host:

| Port | What                                          |
|------|-----------------------------------------------|
| 8080 | Tomcat HTTP                                   |
| 8000 | JDWP remote debugging (Eclipse attaches here) |
| 5432 | PostgreSQL (`appdb` / user `app` / pass `app`)|

Stop with `docker compose down` (add `-v` to also wipe the database volume).

---

## 4. Eclipse setup, step by step

### 4.1 Import the workspace preferences

Eclipse cannot version-control a whole workspace (it lives in `.metadata/`),
but it can import a preferences file that configures a fresh workspace:

1. Create/open the workspace you want to use.
2. **File → Import → General → Preferences**.
3. Select `eclipse/workspace-preferences.epf` from this repo.
4. Check **Import all**, then **Finish**.

This sets: Java 21 compiler compliance, UTF-8 encoding, Unix line endings,
*Build automatically*, *Refresh using native hooks or polling* (important —
hotswap needs Eclipse to rebuild the moment you save), and makes failed hot
code replace attempts visible instead of silent.

Also verify **Window → Preferences → Java → Installed JREs** points at a
JDK 21 (add your Temurin 21 if missing) and it is the default.

### 4.2 Import the project (Buildship / Gradle)

1. **File → Import → Gradle → Existing Gradle Project**.
2. Root directory: this repository. **Finish** (keep the Gradle wrapper
   default).
3. Buildship generates `.project`/`.classpath` (they are git-ignored;
   the versioned `.settings/` files pin Java 21 compliance).

The project appears as **jakartaee-app**.

### 4.3 First deployment and server start

1. In the **Gradle Tasks** view (Window → Show View → Other → Gradle),
   run `docker deployment → deploy` — or use the imported launch config
   below.
2. From a terminal: `cd docker && docker compose up -d --build`.

Launch configurations are provided in `eclipse/` and can be imported via
**File → Import → Run/Debug → Launch Configurations**, selecting the
`eclipse/` folder:

- **Gradle deploy** — full build + redeploy (Tomcat reloads the context)
- **Gradle syncStatic** — instant copy of `.xhtml`/CSS/JS without a reload
- **Attach to Tomcat in Docker** — the remote debugger (next section)

(Optional: install the **Eclipse Docker Tooling** feature from the release
update site to start/stop compose services and view container logs from
inside Eclipse.)

### 4.4 Remote debugging and breakpoints

Tomcat is started with JDWP listening on port 8000
(`catalina.sh jpda run`, `JPDA_ADDRESS=*:8000` in `docker-compose.yml`).

1. Run **Debug Configurations… → Remote Java Application →
   "Attach to Tomcat in Docker"** (imported above; it is preconfigured with
   host `localhost`, port `8000`, project `jakartaee-app`). Click **Debug**.
2. Set a breakpoint, e.g. in `PersonBean.add()`
   (`src/main/java/com/example/app/web/PersonBean.java`), then click **Save**
   in the browser — Eclipse stops on the breakpoint. Step, inspect variables,
   use the Display view, everything works as with a local JVM.

The debugger reconnects in one click whenever you restart the container.

---

## 5. Hotswap — editing code without redeploying

### 5.1 What you get out of the box (standard JVM)

While the **debug session is attached** (that's the delivery channel), every
file save in Eclipse triggers *Hot Code Replace*: the JVM inside Docker
receives the new bytecode instantly.

- ✅ Changing **method bodies** (logic, messages, expressions) — live
  immediately, no redeploy, session state preserved.
- ❌ Adding/removing **methods, fields, classes**, changing signatures or
  hierarchies — the standard JVM rejects these ("scheme change not
  implemented"); Eclipse will tell you thanks to the imported preferences.
  Run **Gradle deploy** instead: Tomcat notices the new `web.xml` timestamp
  (it is a `WatchedResource`) and reloads the context in a few seconds —
  still no container restart.
- **`.xhtml` / CSS / JS** changes: run **Gradle syncStatic** — files are
  copied without touching `web.xml`, so there is no reload at all, and
  `jakarta.faces.FACELETS_REFRESH_PERIOD=1` makes JSF pick them up on the
  next request. (Tip: bind it to a keyboard shortcut, or use "Run last
  launched external tool" — Ctrl+F11 area.)

### 5.2 Enhanced hotswap: JetBrains Runtime + HotswapAgent (DCEVM successor)

The original **DCEVM** patch stopped at JDK 11/17; its technology was
absorbed into the **JetBrains Runtime (JBR)** as *Enhanced Class
Redefinition*, which is the way to get DCEVM-style hotswap on Java 21.
Combined with **HotswapAgent** (whose plugins also refresh Hibernate, Weld
and Mojarra caches), most structural changes hot-swap too:

- ✅ add/remove methods and fields, add classes, change annotations
- HotswapAgent plugins re-scan CDI beans, Hibernate entities and JSF
  metadata after a swap
- Still off-limits: changing a class's superclass/interfaces, and JPA
  *schema* changes (those need a reload + DB migration anyway)

To enable it, edit `docker/docker-compose.yml` and switch the Tomcat build to
the alternate Dockerfile:

```yaml
    build:
      context: ./tomcat
      dockerfile: Dockerfile.jbr-hotswap
```

then `docker compose up -d --build`. Everything else (debugging, deploy
tasks) stays identical — Eclipse still just pushes classes over the debug
connection; the JVM simply accepts far more kinds of change.

> ⚠️ The JBR and HotswapAgent download URLs in
> `docker/tomcat/Dockerfile.jbr-hotswap` are pinned and go stale; if the
> build fails on the download step, grab current URLs from
> <https://github.com/JetBrains/JetBrainsRuntime/releases> and
> <https://github.com/HotswapProjects/HotswapAgent/releases> and pass them
> as `--build-arg JBR_URL=… --build-arg HOTSWAP_AGENT_URL=…`.

`src/main/resources/hotswap-agent.properties` configures the agent
(`autoHotswap=true` is already set).

### 5.3 Day-to-day workflow summary

| You changed…                          | Do…                                    | Reload? |
|---------------------------------------|----------------------------------------|---------|
| Method body (Java)                    | just save (debugger attached)          | none    |
| `.xhtml`, CSS, JS                     | run **Gradle syncStatic**              | none    |
| New method/field (standard JVM image) | run **Gradle deploy**                  | context reload (~seconds) |
| New method/field (JBR image)          | just save                              | none    |
| Dependencies, `web.xml`, class hierarchy | **Gradle deploy** (or `docker compose restart tomcat`) | context reload / restart |
| `persistence.xml`, DB schema          | **Gradle deploy**                      | context reload |

---

## 6. The Eclipse "Servers" view — two options

### Option A (recommended): Docker is the server

The Servers view has no adapter that manages a Tomcat *inside a container*,
so with Docker the lifecycle is compose's job — and it's arguably nicer:

- **start / stop**: `docker compose up -d` / `docker compose down`
  (terminal, or Docker Tooling view, or an External Tools launch)
- **debug**: the "Attach to Tomcat in Docker" launch
- **synchronize / publish**: the `deploy` / `syncStatic` Gradle tasks

### Option B: classic Servers view with a local Tomcat

If you want the full WTP experience (server lifecycle buttons, automatic
publish on save), the project is already a valid **Dynamic Web Module 5.0**
(via the `eclipse-wtp` plugin in `build.gradle`):

1. Unzip an [Apache Tomcat 10.1](https://tomcat.apache.org/download-10.cgi)
   locally.
2. **Servers view → No servers available… → Apache → Tomcat v10.1 Server**,
   point it at the unzipped directory, JRE = your JDK 21.
3. **Add and Remove… →** add `jakartaee-app`. Start the server with the
   **Debug** button — breakpoints and hotswap work the same way (the JVM is
   local instead of containerized).
4. Point the app at the dockerized PostgreSQL: change the JDBC host in
   `src/main/resources/META-INF/persistence.xml` from `postgres` to
   `localhost` (the `postgres` hostname only resolves inside the compose
   network).

You can keep both options; they don't conflict.

---

## 7. Database

- Connection (host side): `jdbc:postgresql://localhost:5432/appdb`,
  user `app`, password `app`.
- Inside the compose network (what `persistence.xml` uses):
  `jdbc:postgresql://postgres:5432/appdb`.
- Schema is auto-managed by Hibernate in dev
  (`schema-generation.database.action=update`); for real projects switch to
  `validate` and add Flyway or Liquibase.
- Init SQL (extensions, seed data) goes into `docker/postgres/init/`.
- Data survives restarts in the `pgdata` volume; `docker compose down -v`
  resets it.

---

## 8. Project layout

```
├── build.gradle                     Gradle build: EE 9 deps, deploy/syncStatic tasks, eclipse-wtp
├── settings.gradle                  project name: jakartaee-app
├── gradlew, gradle/                 Gradle wrapper (8.14.3)
├── src/main/java/com/example/app/
│   ├── entity/Person.java           JPA entity + Bean Validation
│   ├── persistence/                 EntityManager CDI producer, @Transactional interceptor
│   ├── repository/PersonRepository.java
│   └── web/PersonBean.java          @Named @ViewScoped JSF backing bean
├── src/main/resources/
│   ├── META-INF/persistence.xml     JPA 3.0, RESOURCE_LOCAL, HikariCP, PostgreSQL
│   └── hotswap-agent.properties     HotswapAgent config (JBR image only)
├── src/main/webapp/
│   ├── index.xhtml                  JSF + PrimeFaces sample page
│   └── WEB-INF/ (web.xml, beans.xml, faces-config.xml)
├── docker/
│   ├── docker-compose.yml           tomcat + postgres
│   ├── tomcat/Dockerfile            Tomcat 10.1 + Temurin 21 + JDWP
│   ├── tomcat/Dockerfile.jbr-hotswap  optional JBR + HotswapAgent image
│   ├── postgres/init/               first-boot SQL
│   └── deploy/                      ← Gradle deploys here; mounted as Tomcat webapps (git-ignored)
├── eclipse/
│   ├── workspace-preferences.epf    import into a fresh workspace
│   └── *.launch                     debug-attach + Gradle task launches
└── .settings/                       versioned Eclipse project prefs (Java 21, UTF-8)
```

---

## 9. Later: Vue.js / React / Angular alongside JSF

When you get there, the realistic integration options, roughly in order of
sanity:

1. **Separate SPA + REST** — serve the frontend from Vite/Angular CLI dev
   server (or as static resources in `src/main/webapp/`), talk to the backend
   over REST. Add JAX-RS via `org.glassfish.jersey.containers:jersey-container-servlet`
   (Jersey 3.0.x for EE 9) — works fine on Tomcat next to JSF. New views go
   in the SPA; existing JSF pages stay.
2. **Islands inside JSF pages** — load a built Vue/React bundle as a JSF
   resource (`<h:outputScript>`) and mount components into `<div>`s rendered
   by Facelets; exchange data via `<f:websocket>`, REST calls, or serialized
   JSON in data attributes. Works well with Vue especially.
3. **Web Components** — build Angular Elements / Vue custom elements and use
   them as plain HTML tags inside Facelets (JSF passes attributes through).

There is no deep two-way binding bridge between JSF's server-side state and a
client-side framework — plan for the REST boundary early (option 1 or 2).

---

## 10. Troubleshooting

| Symptom | Fix |
|---|---|
| `http://localhost:8080/` → 404 | Nothing deployed yet: run `./gradlew deploy`, check `docker/deploy/ROOT/` exists, then `docker compose logs tomcat` |
| Eclipse can't attach on 8000 | Container not up (`docker compose ps`), or another debugger is already attached (JDWP allows one client) |
| Breakpoints "hollow" / never hit | Attach launch must reference project `jakartaee-app`; make sure the deployed classes match your source (run **Gradle deploy** once) |
| "Hot code replace failed — scheme change not implemented" | You made a structural change on the standard JVM: run **Gradle deploy**, or switch to the JBR image (section 5.2) |
| `UnknownHostException: postgres` | You're running Tomcat *outside* compose (e.g. WTP local Tomcat): use `localhost` in `persistence.xml` (section 6, option B) |
| Port 5432/8080 already in use | Change the host-side port mappings in `docker-compose.yml` |
| Gradle uses wrong JDK | Check `JAVA_HOME`, or set `org.gradle.java.home` in `gradle.properties` |
| Weld/CDI bean not found | `beans.xml` uses `bean-discovery-mode="annotated"`: beans need a scope annotation (`@ApplicationScoped`, `@Named`+`@ViewScoped`, …) |

---

## 11. Upgrade path

The stack is pinned to the **EE 9** baseline as requested. When you're ready
for EE 10 (same `jakarta.*` namespace, no code changes for the basics):
Mojarra `4.0.x`, Weld `5.x`, Hibernate `6.2+`/JPA 3.1, PrimeFaces stays
(jakarta classifier), Tomcat 10.1 already supports it.
