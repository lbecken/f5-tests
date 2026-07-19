# Bookmark Manager

A modern, fast, **single-file** bookmark management app. No install, no server, no
dependencies — open `index.html` in any browser and it just works. Your data is
stored locally in the browser (localStorage) and can be exported/imported at any
time as a standard bookmarks file.

Built to fix the pain of managing a *large* bookmark collection in Chrome:
instead of scrolling a cramped folder list every time you save a page, you get
instant search over your whole folder tree and a keyboard-driven folder picker.

## Getting started (recommended: with the Node server)

```bash
cd bookmark-manager
npm start          # = node server.js  →  http://localhost:3000
```

Then:

1. In Chrome/Edge: **Bookmarks manager → ⋮ → Export bookmarks** → saves an HTML file.
2. Open **http://localhost:3000** in your browser.
3. Click **Import** (or just drag the exported file onto the page) and choose
   **Replace everything** (first time) or **Add as new folder**.
4. Browse, search, reorganize. When you want the result back in Chrome:
   **Export → Export HTML**, then in Chrome **Bookmarks manager → ⋮ → Import bookmarks**.

With the server running, everything is saved to **`bookmark-manager/bookmarks.json`**
on disk (plus `bookmarks.backup.json`, the previous version, kept on every write).
Stop/restart the server whenever you like — the data is in the file, not in memory.
The server has **zero npm dependencies** (that's why there is no `node_modules`);
`PORT=8080 npm start` changes the port, `BOOKMARKS_FILE=/path/data.json` the file.

You can also skip the server entirely and open `index.html` directly (double-click)
— the app then stores data in that browser's localStorage instead (see below).

A `sample-bookmarks.html` file is included if you want to try the import without
touching your real bookmarks.

## Features

- **Import / export** the standard Netscape bookmarks HTML format used by
  Chrome, Edge and Firefox (round-trips cleanly, keeps favicons and the
  "Bookmarks bar" flag). JSON export/import for full-fidelity backup.
- **Instant search** (`/` to focus) across bookmark names, URLs, folder names,
  folder paths and tags. Results show the folder path; click it to jump there.
- **Fast folder picker** when adding/editing a bookmark: type a few letters to
  filter the *entire* folder tree by name or path, arrow keys + Enter to choose.
  Recently-used folders are offered first — no more scrolling a giant tree.
- **Tags** (optional) in addition to folders — one bookmark can belong to
  several groupings. Click a tag to see everything with that tag. Tags survive
  HTML export via the `TAGS` attribute (Firefox-compatible).
- **Folder tree sidebar** with per-folder bookmark counts, collapse/expand,
  rename, delete.
- **Drag & drop**: drag bookmarks or folders onto any folder in the sidebar to
  move them. Multi-select with checkboxes for bulk **move / delete**.
- **Undo** (Ctrl+Z or the toast button) for deletes, moves, edits and imports.
- **Duplicate finder** (Tools) — lists URLs bookmarked more than once.
- **Paste URLs** (Tools) — dump a whole window's worth of tab URLs (one per
  line) straight into a folder.
- **Bookmarklet** (Tools) — a "Save to Bookmarks" link you drag to your
  bookmarks bar; clicking it on any page opens this app with the Add dialog
  pre-filled with that page's URL and title. (Requires the app to be opened
  from an `http(s)://` address, not `file://` — see Hosting.)
- **Dark / light theme**, keyboard shortcuts, sort by name/date, mobile-friendly.

## Keyboard shortcuts

| Key | Action |
|---|---|
| `/` | Focus search |
| `Esc` | Clear search / close dialog / clear selection |
| `Ctrl`+`Z` | Undo last change |
| `↑` `↓` `Enter` | Navigate + choose in the folder picker |
| `Enter` | Save, in the Add/Edit dialog |

## Where is my data?

The footer always tells you which mode you are in.

**Server mode** (opened via `node server.js`): everything lives in
`bookmark-manager/bookmarks.json` — a plain, human-readable JSON file you can
back up, sync, or version yourself. Every save first copies the previous
version to `bookmarks.backup.json`, then writes atomically. Both files are
gitignored so your personal bookmarks never end up in a commit. If the server
goes down mid-session, the app keeps an emergency copy in localStorage and
warns you.

The very first time you open the app through the server, anything previously
saved in that browser's localStorage is automatically copied into
`bookmarks.json`.

**localStorage mode** (opened as `file://…` or from a static host with no
`/api/bookmarks`): data is saved in the browser under the key `bmm.state.v1`.
⚠ localStorage is **per origin** — scheme + host + **port**. These are all
*different, independent* stores:

- `file:///…/index.html`
- `http://localhost:8080`
- `http://127.0.0.1:8080`  (yes, different from `localhost`!)
- `http://localhost:8081`

So if your bookmarks "disappear", you almost certainly opened the app from a
different address than last time — reopen the exact same URL and they're back
(then export, or switch to server mode and they'll be migrated into the file).
Clearing browser site data deletes localStorage — export now and then. If
storage fills up (embedded favicons), the app drops favicons first and warns
you before anything is lost.

## Hosting (optional, enables the bookmarklet)

Any static hosting works, e.g.:

- **GitHub Pages**: enable Pages for this repo and open
  `https://<user>.github.io/<repo>/bookmark-manager/`
- **Local server**: `python3 -m http.server` in this folder → `http://localhost:8000/`

## Files

| File | Purpose |
|---|---|
| `index.html` | The whole app (HTML + CSS + JS, no dependencies) |
| `server.js` | Optional zero-dependency Node server: serves the app + persists `bookmarks.json` |
| `package.json` | `npm start` convenience (no dependencies to install) |
| `sample-bookmarks.html` | Small Chrome-format export for trying the import |
| `bookmarks.json` | **Your data** (created at runtime in server mode; gitignored) |
| `bookmarks.backup.json` | Previous version of your data, refreshed on every save (gitignored) |
