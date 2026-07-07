# Workspaces, Working Sets, Gradle, and the Servers View

## Workspaces

An Eclipse workspace is heavier than it looks: it holds the JDT index of every open
project, all launch configurations, server definitions, and preferences. On a large
monorepo, workspace hygiene matters.

**Guidelines:**

- **One workspace per long-lived context**, not per task. Typical split:
  - `ws-main` — daily development against the main line of work
  - `ws-review` (optional) — a second clone of the repo for reviewing PRs or comparing
    branches without disturbing your running Tomcat and uncommitted work
  Switching branches inside one workspace forces a full Gradle re-sync and rebuild;
  a second workspace + second clone is often faster than stashing and switching.
- **Export your preferences once** (`File > Export > General > Preferences`) and import
  them into every new workspace, so shortcuts, formatter, save actions and content
  assist settings stay identical. Better: agree with the team on a shared formatter
  profile and check it into the repo.
- Launch Eclipse with `-data <workspace-path>` if you script your startup, and give
  each workspace a distinct window title: `Preferences > General > Appearance >
  "Workspace name (shown in window title)"`. Saves you from deploying to the wrong
  Tomcat because you were in the wrong window.
- If the workspace becomes slow or shows phantom errors, the classic cure is
  `eclipse -clean` (rebuilds plugin caches) and, for JDT weirdness,
  `Project > Clean…` on the affected projects.

## Working Sets — the monorepo survival tool

In a monorepo you rarely care about all modules at once. Working sets let you scope
both **what you see** and **what you search**.

- Create them via the Package Explorer view menu (the ⋮ / ▽ button) >
  `Select Working Set… > New…` (type: Java). Group modules by domain, e.g.
  `billing`, `core`, `web-ui`.
- Set the Package Explorer *Top Level Elements* to **Working Sets** — the tree becomes
  navigable again.
- Every search dialog (`Ctrl+H`) has a *Scope* section: choose *Working set* to search
  only the modules you care about. On a big repo this turns 4,000 hits into 40.
- `Ctrl+Shift+T` / `Ctrl+Shift+R` can also be filtered by working set (dropdown menu
  inside the dialog).

## Gradle (Buildship)

- Import the repo with `File > Import > Gradle > Existing Gradle Project` once; after
  that, Buildship keeps the classpath in sync.
- After anyone changes `build.gradle` / version catalogs / settings, do
  **right-click project > Gradle > Refresh Gradle Project** (or the refresh button in
  the *Gradle Tasks* view). 90% of "Eclipse shows compile errors but Gradle builds
  fine" cases are a stale sync.
- Keep the *Gradle Executions* and *Gradle Tasks* views around, but for real builds
  and test suites, prefer the terminal: `./gradlew :module:test --tests '*MyTest*'`.
  It's what CI (GitHub Actions) runs, so it's the ground truth.
- Run single JUnit tests from the editor with `Alt+Shift+X, T` (and debug them with
  `Alt+Shift+D, T`). This uses Eclipse's own runner — faster feedback than Gradle,
  but before pushing, run the Gradle build once to match CI.

## The Servers view (Tomcat 11)

- **Always start Tomcat in Debug mode** (bug icon) during development. There is no
  practical downside locally, and it enables breakpoints and hot code replace at any
  moment (see [03-debugging-tomcat-and-jsf.md](03-debugging-tomcat-and-jsf.md)).
- Double-click a server to open its editor:
  - *Timeouts*: raise the start timeout for a large app (e.g. 180 s) so Eclipse
    doesn't kill a slow-but-healthy startup.
  - *Publishing*: "Automatically publish when resources change" with a small interval
    is convenient; if republishing thrashes, switch to *Never publish automatically*
    and publish manually with the server context menu.
  - *Launch configuration* link: this is where you add JVM args (`-Xmx`, system
    properties, per-server `-Dspring.profiles`-style flags, the JDBC URL property if
    your app reads one).
- You have `main` and `test` servers with separate Postgres instances — name them and
  their launch configs unmistakably (`tomcat-main / db 5432`, `tomcat-test / db 5433`)
  and keep the port offsets consistent (HTTP 8080/8081, JMX, debug port). Write the
  port matrix down once (GoodNotes or a `NOTES.md`) — you will need it weekly.
- In DBeaver, use connection *color coding* (connection settings > General >
  Connection type / color) so queries against the `test` DB look visibly different
  from `main`. Cheap insurance.

## Editor & general settings worth setting on day one

- `Preferences > Java > Editor > Save Actions`: organize imports + format **edited
  lines only** (never whole file on a shared codebase — keeps diffs reviewable).
- `Preferences > General > Editors > Text Editors`: show line numbers, whitespace if
  you like; *Quick Diff* — you already use it. Set the reference source to
  **"A Git Revision"** (HEAD) instead of "version on disk", so the colored bars show
  what changed vs. the last commit, not vs. the last save.
- `Preferences > General > Keys`: the full keymap. Anything in this guide can be
  rebound; `Ctrl+Shift+L` shows the current bindings, pressing it twice opens this
  preference page.
- Spell out heap for the IDE itself in `eclipse.ini` (`-Xmx4g` or more for a large
  monorepo index).
