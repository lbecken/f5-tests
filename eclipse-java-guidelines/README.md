# Eclipse + Java Daily Workflow Guidelines

Practical guidelines for working on a large Jakarta EE 9 code base (JSF, PrimeFaces,
JPA/Hibernate) built with Gradle, deployed on Tomcat 11, developed in Eclipse with a
vim emulation plugin, git in the terminal / EGit, DBeaver, and Beyond Compare.

Written against Eclipse 2026-03, but almost everything here has been stable in the
IDE for a decade — shortcuts and views rarely change.

## Contents

| File | Topic |
|------|-------|
| [01-workspaces-and-project-setup.md](01-workspaces-and-project-setup.md) | Workspaces, working sets, Gradle/Buildship, Tomcat servers view |
| [02-navigation-and-search-shortcuts.md](02-navigation-and-search-shortcuts.md) | The essential shortcuts: open class/file, follow code, navigate back, search |
| [03-debugging-tomcat-and-jsf.md](03-debugging-tomcat-and-jsf.md) | Breakpoints (conditional, exception, watchpoints), stepping, hot code replace, JSF/JPA specifics |
| [04-vim-plugin-tips.md](04-vim-plugin-tips.md) | Fixing the "space accepts autocomplete" and "double ESC" problems, vim + Eclipse coexistence |
| [05-git-workflow.md](05-git-workflow.md) | Recommended git tooling mix: terminal + EGit views + Beyond Compare + gh CLI |
| [06-exploring-a-large-codebase.md](06-exploring-a-large-codebase.md) | Strategies to understand unfamiliar code: hierarchies, call graphs, debugger-as-reader |
| [07-notes-mindmaps-and-diagrams.md](07-notes-mindmaps-and-diagrams.md) | GoodNotes, SimpleMind (and whether it's good for class diagrams), PlantUML/Mermaid, DBeaver ER diagrams |
| [08-references.md](08-references.md) | Recommended books, sites, and articles |

## The 20% that gives 80%

If you read nothing else, learn these:

- `Ctrl+Shift+T` — Open Type (any class, partial/CamelCase name)
- `Ctrl+Shift+R` — Open Resource (any file: XHTML, properties, gradle…)
- `F3` (or `Ctrl+Click`) — jump to declaration; `Alt+Left` — go back
- `Ctrl+Alt+H` — Call Hierarchy (who calls this method?)
- `Ctrl+Shift+G` — find all references in the workspace
- `Ctrl+O` — Quick Outline of the current class (type to filter)
- `Ctrl+1` — Quick Fix (fixes imports, creates methods, everything)
- `Ctrl+3` — Quick Access: type the name of any command/view when you forget its shortcut
- Start Tomcat in **Debug** mode from the Servers view and edit code while it runs —
  hot code replace applies method-body changes without redeploying.
