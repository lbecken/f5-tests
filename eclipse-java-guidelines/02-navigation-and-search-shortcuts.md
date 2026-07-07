# Navigation & Search — the Daily Shortcuts

Shortcuts below are the Windows/Linux defaults. On macOS, `Ctrl` is generally `Cmd`
and `Alt` is `Option`. If a shortcut doesn't respond, check `Ctrl+Shift+L` (key
assist) — vim emulation plugins occasionally shadow a binding in the editor.

> Meta-shortcut: **`Ctrl+3` (Quick Access)** — type any command, view, or preference
> name. When you forget "how do I open the call hierarchy again?", `Ctrl+3` → "call h"
> → Enter. It also teaches you the real shortcut in the dropdown.

## Opening things

| Shortcut | Action | Notes |
|----------|--------|-------|
| `Ctrl+Shift+T` | **Open Type** | Any Java class/interface on the classpath, including libraries. Supports partial names and CamelCase: `CuSeIm` finds `CustomerServiceImpl`; `*ServiceImpl` and `?` wildcards work too. |
| `Ctrl+Shift+R` | **Open Resource** | Any file in the workspace: `.xhtml`, `.properties`, `build.gradle`, SQL migrations. Same partial/CamelCase matching. |
| `Ctrl+E` | Switch editor | Filterable list of open editors — faster than clicking tabs. |
| `Ctrl+F6` / `Ctrl+Page↑/↓` | Cycle editors / tabs | |
| `F4` / `Ctrl+T` | Type Hierarchy (view / quick popup) | On a class or method. `Ctrl+T` twice toggles supertype/subtype direction. On an interface method, `Ctrl+T` is the fastest way to find *implementations*. |
| `Ctrl+O` | **Quick Outline** | Popup with all members of the current class; type to filter; press `Ctrl+O` again to include inherited members. Beats scrolling in a 2,000-line class. |
| `Ctrl+Shift+H` | Open Type in Hierarchy | Open a class directly inside the Type Hierarchy view. |

## Following code and coming back

| Shortcut | Action | Notes |
|----------|--------|-------|
| `F3` or `Ctrl+Click` | Open Declaration | Jump into the method/class under the cursor. On a call whose target is an interface, prefer `Ctrl+Alt+Click` / hover menu "Open Implementation" to land in the concrete class. |
| `Alt+Left` / `Alt+Right` | **Back / Forward** | Your browser-style history. `F3` down five levels, `Alt+Left` five times to return. The single most important pair for reading code. |
| `Ctrl+Q` | Last Edit Location | Jump back to where you last *typed*, no matter how far you've navigated since. |
| `Ctrl+Alt+H` | **Call Hierarchy** | Who calls this method (callers), or what does it call (callees — toggle in the view). Fundamental for impact analysis. |
| `Ctrl+Shift+G` | Find References in Workspace | All usages of the selected class/method/field. |
| `Ctrl+G` | Find Declarations in Workspace | Rarely needed; useful for overloaded methods. |
| `Alt+Shift+O` | Toggle Mark Occurrences | Highlights all occurrences of the selected element in the file; navigate them with `Ctrl+.` / `Ctrl+,` (next/previous annotation). |
| `Ctrl+Shift+P` | Go to matching bracket | |
| `Ctrl+Shift+↑/↓` | Previous / next member | Skip method-by-method through a class. |
| `Ctrl+L` | Go to Line | |
| `F2` | Show Javadoc popup (focus) | Hover equivalent, keyboard-friendly; from the popup you can jump to the full Javadoc. |
| `Alt+Shift+B` (or breadcrumb toggle on toolbar) | Editor breadcrumb | Shows package > class > method path atop the editor; each element is a dropdown. |

## Searching

| Shortcut | Action | Notes |
|----------|--------|-------|
| `Ctrl+H` | Search dialog | Two tabs matter: **File Search** (plain text/regex over files — use for XHTML, EL expressions, SQL, property keys) and **Java Search** (semantic — knows the difference between a method named `save` and the word "save"). Scope searches to a *working set* on a monorepo. |
| `Ctrl+Alt+G` | Find selected text in workspace | Instant grep of the selection, no dialog. |
| `Ctrl+J` | Incremental find | Type-as-you-search in the current file, `Enter` to stop; often faster than `Ctrl+F`. |
| `Ctrl+K` / `Ctrl+Shift+K` | Find next / previous occurrence of last search or selection | |
| — | Search view: use the ⬅➡ arrows or `Ctrl+.` to walk hits | Pin interesting search results (pin icon) so a new search doesn't overwrite them. |

**JSF-specific searching:** EL expressions like `#{orderBean.submit}` are plain text
to Eclipse. To find where a backing-bean method is used from views, File-Search for
`orderBean.submit` across `*.xhtml`. Conversely, from an XHTML file, `Ctrl+Shift+T`
the bean class name. Getting fluent at hopping the Java↔XHTML boundary with
`Ctrl+Shift+R` + File Search is a core JSF skill.

## Editing (the ones that pay rent)

| Shortcut | Action | Notes |
|----------|--------|-------|
| `Ctrl+Space` | Content Assist | Also completes CamelCase (`SB` → `StringBuilder`) and, invoked twice, cycles proposal categories (templates, chain completions). |
| `Ctrl+1` | **Quick Fix / Quick Assist** | The universal "do what I mean": create missing method, add cast, split variable, invert if, convert to lambda, assign to field… When anything is underlined, `Ctrl+1` first. |
| `Ctrl+Shift+O` | Organize Imports | Adds missing, removes unused. |
| `Ctrl+Shift+F` | Format | Prefer format-on-save of *edited lines* (see file 01). |
| `Alt+↑/↓` | Move line/selection up/down | |
| `Ctrl+Alt+↓/↑` | Duplicate line/selection | Note: on Linux desktops these are sometimes grabbed by the window manager — rebind in `Preferences > Keys` if dead. |
| `Ctrl+D` | Delete line | |
| `Ctrl+/` | Toggle line comment | `Ctrl+Shift+/` block comment in Java; also works in XHTML with the right editor. |
| `Alt+Shift+R` | Rename (refactor) | Renames across the workspace, including references — never rename with find/replace. |
| `Alt+Shift+M` / `Alt+Shift+L` | Extract Method / Extract Local Variable | The two refactorings you'll use daily when cleaning legacy code. |
| `Alt+Shift+Z` | Surround With | try/catch, loops, templates. |
| `Ctrl+M` | Maximize/restore current editor or view | Great on small screens. |
| `Ctrl+Shift+X` / `Ctrl+Shift+Y` | To UPPER / lower case | |

## Recommendations

1. **Adopt shortcuts in batches of three.** Pick three from this page, use them for a
   week until automatic, pick the next three. Trying to learn thirty at once teaches
   none.
2. Keep a printed/GoodNotes one-pager of *your* current batch.
3. When you catch yourself doing something with the mouse three times in a row, hit
   `Ctrl+3` and find the command — then check its shortcut with `Ctrl+Shift+L`.
