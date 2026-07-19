# Bookmark Manager

A modern, fast, **single-file** bookmark management app. No install, no server, no
dependencies — open `index.html` in any browser and it just works. Your data is
stored locally in the browser (localStorage) and can be exported/imported at any
time as a standard bookmarks file.

Built to fix the pain of managing a *large* bookmark collection in Chrome:
instead of scrolling a cramped folder list every time you save a page, you get
instant search over your whole folder tree and a keyboard-driven folder picker.

## Getting started

1. In Chrome/Edge: **Bookmarks manager → ⋮ → Export bookmarks** → saves an HTML file.
2. Open `bookmark-manager/index.html` in your browser (double-click, or serve it —
   see *Hosting* below).
3. Click **Import** (or just drag the exported file onto the page) and choose
   **Replace everything** (first time) or **Add as new folder**.
4. Browse, search, reorganize. When you want the result back in Chrome:
   **Export → Export HTML**, then in Chrome **Bookmarks manager → ⋮ → Import bookmarks**.

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

In your browser's localStorage under the key `bmm.state.v1`, saved automatically
on every change. That means:

- It stays on your machine; nothing is sent anywhere.
- It is **per browser + per address** — if you open the app from a different
  path or browser, it starts empty (just import your latest export).
- Clearing the browser's site data deletes it — **export to a file now and then**
  as a backup (JSON keeps tags; HTML is what Chrome re-imports).
- If storage fills up (huge collections with many embedded favicons), the app
  drops favicons first and warns you before anything is lost.

## Hosting (optional, enables the bookmarklet)

Any static hosting works, e.g.:

- **GitHub Pages**: enable Pages for this repo and open
  `https://<user>.github.io/<repo>/bookmark-manager/`
- **Local server**: `python3 -m http.server` in this folder → `http://localhost:8000/`

## Files

| File | Purpose |
|---|---|
| `index.html` | The whole app (HTML + CSS + JS, no dependencies) |
| `sample-bookmarks.html` | Small Chrome-format export for trying the import |
