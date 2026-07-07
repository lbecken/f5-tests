# Debugging on Tomcat 11 — Breakpoints, Stepping, Hot Code Replace

## Baseline setup

- Start Tomcat from the Servers view with the **Debug** button (bug icon), always.
  Breakpoints then work at any time without restarting.
- If you ever need to attach to a Tomcat started *outside* Eclipse (e.g.
  `catalina.sh jpda start`, default port 8000), create a
  `Debug Configurations… > Remote Java Application` pointing at `localhost:8000`.
  Same debugging experience.
- The Debug perspective opens automatically on the first hit breakpoint. Learn its
  four core views: **Debug** (threads/stack), **Variables**, **Breakpoints**,
  **Expressions**.

## Stepping — the keys

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+B` | Toggle breakpoint on current line (also: double-click the editor gutter) |
| `F5` | Step Into |
| `F6` | Step Over |
| `F7` | Step Return (run to the end of the current method) |
| `F8` | Resume |
| `Ctrl+R` | Run to Line (temporary breakpoint at the cursor) |
| `Ctrl+F2` | Terminate |
| `Ctrl+Shift+I` | **Inspect** selected expression (popup with the value) |
| `Ctrl+Shift+D` | **Display** selected expression (evaluate and show result) |

Two habits worth building:

- **Step Into Selection**: hover a specific call on a line with several calls and use
  the hyperlink (Ctrl+Alt+Click) or context menu *Step Into Selection* — avoids
  stepping through the whole chain.
- **Drop to Frame** (Debug view context menu): re-run the current method from its
  start without restarting the request. With hot code replace (below), this is a
  edit–drop–rerun loop measured in seconds. Caveat: side effects already performed
  (DB writes, list mutations) are *not* undone.

## Breakpoint types you should actually use

Open the **Breakpoints view**; right-click a breakpoint > *Breakpoint Properties…*

- **Conditional breakpoint** — in a loop over 10,000 entities, condition
  `"ACME".equals(customer.getName())`. The condition is arbitrary Java evaluated in
  the frame. There's also *Hit count* to stop on the Nth pass.
- **Java Exception Breakpoint** — the `J!` button in the Breakpoints view. Add one
  for e.g. `NullPointerException` or `org.hibernate.LazyInitializationException`,
  caught and/or uncaught. This stops **at the throw site**, which for exceptions that
  get wrapped/swallowed by frameworks (JSF loves doing this) is often the only way to
  see the true origin.
- **Watchpoint** — double-click the gutter on a *field declaration*: stops whenever
  the field is read and/or written. Perfect for "who keeps setting this to null?"
- **Method entry breakpoint** — double-click the gutter on a *method declaration*:
  works even when the body is a one-liner or the source is a decompiled library class.
- **Trigger points** (Breakpoint Properties > "Trigger point"): all other breakpoints
  stay dormant until the trigger is hit first. Ideal on a busy server where a shared
  utility breakpoint would otherwise fire from every request thread.
- **"Poor man's logpoint"**: conditional breakpoint whose condition is
  `System.out.println("here: " + order.getId()) != null ? false : false` — prints
  without stopping. Ugly but effective when you can't edit the code.

Also in the Breakpoints view: **Skip All Breakpoints** (toolbar) to temporarily ignore
everything without deleting your carefully placed set.

## Evaluating things mid-flight

- **Expressions view**: add watches like `order.getItems().size()`.
- **Debug Shell** (`Window > Show View > Debug Shell`): a scratchpad where you can
  write multi-line Java, select it, and run it in the context of the suspended frame —
  e.g. call `entityManager.find(...)` to check DB state as the entity manager sees it.
- In the Variables view, *Show Logical Structure* (toolbar) renders collections and
  maps as their contents rather than internal fields — turn it on and leave it on.

## Hot Code Replace (HCR)

When Tomcat runs in debug mode, saving a Java file compiles it and swaps the method
bodies into the running JVM. **What works**: any change inside existing method bodies.
**What doesn't**: adding/removing methods or fields, changing signatures, class
hierarchy changes — Eclipse will tell you ("Hot code replace failed / obsolete
methods") and you restart/republish.

Combined with Drop to Frame: hit breakpoint → see the bug → fix the line → save →
Drop to Frame → `F8`. No redeploy, no re-click through the UI.

## Debugging multi-threaded server code

- The Debug view shows every suspended thread. Default suspend policy stops only the
  breakpoint's thread — other requests keep running. For race conditions, set the
  breakpoint to *Suspend VM* (Breakpoint Properties) to freeze everything.
- If the UI "hangs" while debugging, check whether a breakpoint suspended a thread
  holding a lock other requests need. Use *Skip All Breakpoints* before doing
  UI-heavy testing.
- **Step filtering** (`Preferences > Java > Debug > Step Filtering`): enable it and
  filter `java.*`, `jakarta.*`, `com.sun.*`, `org.apache.el.*`, proxy/CGLIB classes,
  so `F5` lands in *your* code instead of framework plumbing. Toggle with the
  Step-Filters button in the Debug view toolbar.

## JSF / PrimeFaces / JPA specifics

- Set the JSF project stage in `web.xml` for dev servers:
  ```xml
  <context-param>
    <param-name>jakarta.faces.PROJECT_STAGE</param-name>
    <param-value>Development</param-value>
  </context-param>
  ```
  You get facelet-level error pages, unswallowed messages, and no aggressive resource
  caching.
- Typical JSF breakpoint spots: the backing-bean action method; a `PhaseListener` (or
  a breakpoint in your bean's getter — remember JSF calls getters *several times per
  request*, so make getters cheap and put conditions on those breakpoints).
- `LazyInitializationException`: use the exception breakpoint to find the access
  point, then fix by fetching what the view needs inside the transactional service
  layer (fetch join / entity graph), not by holding sessions open.
- **See the SQL**: enable `hibernate.show_sql`/`format_sql` on dev, or better,
  datasource proxying (p6spy / datasource-proxy) to see bind parameters and timings.
  Cross-check in DBeaver — with the connection color-coding per environment from
  file 01, and keep `pg_stat_activity` handy to spot hanging transactions
  (`idle in transaction` while your debugger holds a suspended thread is a classic).
- While a thread is suspended inside a transaction, DBeaver won't see its uncommitted
  writes — query through the Debug Shell/`entityManager` if you need the
  transaction's view of the data.
