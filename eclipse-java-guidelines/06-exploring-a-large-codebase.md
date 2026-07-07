# Exploring and Understanding a Large, Unfamiliar Code Base

Reading a big legacy codebase is a skill of its own. The goal is never "read it all" —
it's building a **mental map of the 20 places that matter** for your current task.

## Strategy 1 — Trace one request end-to-end

For a JSF app, pick one concrete user action (e.g. "save customer") and follow it
through every layer once:

1. Find the view: `Ctrl+Shift+R` → `customer*.xhtml`.
2. Read the EL: `#{customerBean.save}` → `Ctrl+Shift+T` → `CustomerBean`.
3. `F3` your way down: bean → service → repository/DAO → entity.
4. Note the pattern: where transactions start, where validation happens, how errors
   travel back to the UI (FacesMessages? exceptions?), how entities map to tables.

Most codebases are architecturally repetitive — after tracing two or three flows
carefully, you can predict where everything else lives. Sketch the layer diagram in
GoodNotes while tracing; the act of drawing is what makes it stick.

## Strategy 2 — The debugger as a reading tool

Static reading lies (dependency injection, proxies, and EL hide the real call graph).
The debugger doesn't:

- Put a breakpoint in the backing-bean method, click the button in the browser, and
  **read the stack trace bottom-up** in the Debug view. That stack is the truthful
  architecture diagram of the request: filters, phases, interceptors, your layers.
- Step with the step filters from file 03 enabled, so you stay in project code.
- Use an exception breakpoint when you don't even know where something happens —
  "it fails somewhere" becomes an exact file:line.

## Strategy 3 — Hierarchies and call graphs

- `Ctrl+T` on an interface → all implementations. In DI-heavy code this answers
  "which class actually runs?"
- `Ctrl+Alt+H` (Call Hierarchy) on a method → callers tree. Expand it two or three
  levels to see all entry points that reach a piece of logic. Do it on a setter or
  constructor to learn how an object gets created/mutated.
- `Ctrl+Shift+G` on an entity class → every place it's used; on a constant → who
  depends on that value.
- **Type Hierarchy on entities** (`F4` on a base entity/`@MappedSuperclass`) gives a
  quick inventory of the domain model.

## Strategy 4 — Learn from history

`Team > Show Revision Information` (blame) and the History view are documentation:

- A weird line's commit message often explains the bug it fixed. Follow the commit to
  its PR in GitHub (`gh` or web) for the review discussion.
- `git log --follow -p -- path/File.java` in the terminal shows a file's whole life.
- For "when did behavior X break?", `git bisect` with a quick Gradle test as the
  probe is dramatically faster than reading code.

## Strategy 5 — Map the data model

For a JPA/Hibernate app the database *is* half the architecture:

- In **DBeaver**, open the schema and use the **ER Diagram** tab of a schema/table —
  auto-generated from foreign keys, exportable as image. This is the fastest accurate
  MER you'll get; sketch simplified versions in GoodNotes for the subset you work on.
- Cross-reference with the entities: `Ctrl+Shift+T` the entity, check `@Table`,
  `@OneToMany` etc. Mismatch between the diagram and annotations (missing FKs,
  logical-only relations) is worth noting — it's where surprises live.
- Keep a scratch SQL file per investigation in DBeaver; name them by ticket.

## Making Eclipse pleasant on a big repo

- **Working sets** to scope the Package Explorer and searches (file 01).
- **Link with Editor** (the two-arrows icon in Package Explorer): the tree follows
  the open file. Some prefer it off + `Alt+Shift+W` ("Show In…") on demand.
- Pin editors you keep returning to (right-click tab > Pin), or use `Ctrl+E` and let
  tabs rot.
- Close projects you're not touching (right-click > Close Project) — the indexer and
  validators skip them; on a monorepo with many Gradle subprojects this noticeably
  speeds everything up. Closed projects reopen in seconds.
- Turn off validators you don't need (`Preferences > Validation`) if XHTML/XML
  validation is slow on thousands of files.

## Capture what you learn

- Keep a running "repo field notes" doc (GoodNotes or a private markdown file):
  port matrix, odd conventions, "class X is the god class, everything passes
  through it", people-to-ask per module.
- Mind-map the module/technology landscape in SimpleMind (see file 07) and add
  pointers as you discover them. Re-organizing the map monthly is a genuinely good
  way to consolidate understanding.
- When a note graduates from "my observation" to "true and useful for everyone",
  promote it into the repo (README/docs) as a small PR. New-joiner eyes see gaps the
  veterans can't; documenting them is high-value, low-risk early work.
