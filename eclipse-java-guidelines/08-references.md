# Recommended References

## Books

- **Effective Java, 3rd ed.** — Joshua Bloch. The canonical "write good Java" book;
  read a few items per week, they map directly onto code-review comments you'll
  give and receive.
- **Working Effectively with Legacy Code** — Michael Feathers. *The* book for your
  current situation: how to understand, characterize with tests, and safely change a
  large existing codebase. The "seam" concept alone is worth the price.
- **A Philosophy of Software Design, 2nd ed.** — John Ousterhout. Short, opinionated,
  excellent vocabulary for discussing complexity in reviews.
- **High-Performance Java Persistence** — Vlad Mihalcea. The best deep dive on
  JPA/Hibernate + JDBC + Postgres behavior: fetching strategies, N+1, transactions,
  identifiers, batching. Directly applicable to your stack.
- **Java Persistence with Spring Data and Hibernate** — Cătălin Tudose (successor to
  the classic *Java Persistence with Hibernate*). Ignore the Spring chapters if not
  relevant; the Hibernate/JPA halves are solid foundations.
- **The Definitive Guide to JSF in Java EE 8** — Bauke Scholtz (BalusC) & Arjan
  Tijms. Written by the people behind OmniFaces/answers you'll find on Stack
  Overflow. Jakarta EE 9 JSF is the same spec with `jakarta.*` packages, so it maps
  almost 1:1 to your stack.
- **Pro Git, 2nd ed.** — Scott Chacon & Ben Straub. Free at <https://git-scm.com/book>.
  Chapters on branching, rewriting history, and reset/checkout internals turn git
  from ritual into a model you can reason about.

## Sites & documentation

- **vogella.com** — <https://www.vogella.com/tutorials/Eclipse/article.html> and the
  Eclipse shortcuts article. The best free Eclipse tutorials; also solid Java/Git
  material.
- **Eclipse Help** — <https://help.eclipse.org> → *Java development user guide*.
  Underrated; the debugger and refactoring docs are complete and accurate.
- **Baeldung** — <https://www.baeldung.com>. Reliable recipes for Java, JPA,
  Jakarta EE topics; good first search hit.
- **Vlad Mihalcea's blog** — <https://vladmihalcea.com>. JPA/Hibernate performance,
  Postgres specifics, transaction pitfalls.
- **Thorben Janssen** — <https://thorben-janssen.com>. Hibernate tutorials with a
  gentler slope than Vlad's deep dives.
- **PrimeFaces** — showcase <https://www.primefaces.org/showcase/> and per-version
  docs. The showcase has runnable examples + source for every component; keep it
  bookmarked.
- **OmniFaces showcase & BalusC's writing** — <https://showcase.omnifaces.org>,
  <https://balusc.omnifaces.org>. BalusC's Stack Overflow answers are the de-facto
  JSF documentation; his "communication in JSF" articles explain bean scopes and
  request lifecycle better than the spec.
- **Postgres docs** — <https://www.postgresql.org/docs/>. Genuinely readable;
  especially the chapters on transactions/MVCC and `EXPLAIN`.
- **Vrapper** — <https://vrapper.sourceforge.net/documentation/>. Full list of
  supported vim features and `:eclipseaction` usage.
- **gh CLI manual** — <https://cli.github.com/manual/>; **lazygit** —
  <https://github.com/jesseduffield/lazygit>.
- **PlantUML** — <https://plantuml.com>; **Mermaid** —
  <https://mermaid.js.org> (renders natively in GitHub markdown).
- **Tomcat 11 docs** — <https://tomcat.apache.org/tomcat-11.0-doc/>, particularly
  the JNDI datasource and logging how-tos.

## Articles / short reads

- Vogella, *Eclipse Shortcuts* — the classic printable list.
- Kent Beck's maxim to keep in mind while working legacy code: *"for each desired
  change, make the change easy (warning: this may be hard), then make the easy
  change."*
- Vlad Mihalcea, *The best way to fix the Hibernate LazyInitializationException* —
  read before adopting any quick fix from Stack Overflow.
- GitHub docs, *About protected branches* and *About status checks* — to understand
  exactly what your team's PR/Actions gates do.

## Suggested reading order for your first months

1. Working Effectively with Legacy Code (skim strategically, keep as reference)
2. Effective Java (steady drip)
3. High-Performance Java Persistence (when the first slow query or N+1 hits you —
   it will)
4. Pro Git chapters 2–3 & 7 (when the first rebase goes sideways)
