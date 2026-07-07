# Vim Emulation in Eclipse — Making It Coexist with Content Assist

(The most common Eclipse vim plugin is **Vrapper**; viPlugin is the paid alternative.
The advice below is written for Vrapper but the Eclipse-side settings apply to any
emulator, since the problems are caused by Eclipse's content assist, not by vim.)

## Problem 1 — typing space accepts an unwanted autocomplete

What happens: you're in insert mode, the content-assist popup opened automatically
(usually after `.`), and Eclipse treats your next typed character as "accept the
selected proposal".

**The fix is an Eclipse preference, not a vim one:**

`Window > Preferences > Java > Editor > Content Assist` →
check **“Disable insertion triggers except 'Enter'”**.

After that, only `Enter` inserts a proposal; space, `;`, `.` etc. just type the
character and the popup closes. This single checkbox removes 90% of the friction
between vim-style typing and content assist. (If your Eclipse build doesn't show it,
search "insertion" inside the Content Assist preference page — it has been present
since Eclipse Photon.)

Related settings on the same page worth tuning:

- **"Insert single proposals automatically"** — *uncheck it*. Otherwise when only one
  proposal matches, Eclipse inserts it without even showing the popup.
- **Auto activation**: either
  - keep auto-activation on `.` but raise the delay (e.g. 200–500 ms) so the popup
    doesn't flash open mid-typing, or
  - disable auto activation entirely and summon completion explicitly with
    `Ctrl+Space`. Many vim users prefer the explicit style — it matches the
    "completion on demand" (`Ctrl+N`) habit from vim.

## Problem 2 — needing ESC twice to leave insert mode

This is by design, not a bug: the **first `Esc` closes the open popup** (content
assist, parameter hints, rename-in-place box), and only then does the next `Esc`
reach the vim emulator to leave insert mode. You'll see the same with any open
overlay.

Ways to reduce it:

1. The auto-activation changes above — fewer popups open uninvited, so `Esc` almost
   always reaches vim directly.
2. Map an alternative that content assist doesn't intercept. In `~/.vrapperrc`:
   ```vim
   " leave insert mode with jk (never intercepted by popups)
   inoremap jk <Esc>
   ```
3. After accepting a completion with `Enter`, Eclipse often leaves *linked mode*
   (tab-cycling through method arguments, shown as boxes). `Esc` first exits linked
   mode. Accepting/finishing arguments with `Enter` before reaching for `Esc` avoids
   the extra press.

## A working `~/.vrapperrc` starting point

```vim
" search behaves like modern vim
set ignorecase
set smartcase
set incsearch
set hlsearch

" navigation niceties
set number
inoremap jk <Esc>

" make :w etc. behave; Vrapper maps :w to Eclipse save already

" use Eclipse features from normal mode
nnoremap gr :eclipseaction org.eclipse.jdt.ui.edit.text.java.search.references.in.workspace<CR>
nnoremap gi :eclipseaction org.eclipse.jdt.ui.edit.text.java.open.implementation<CR>
```

`:eclipseaction` is Vrapper's superpower: any Eclipse command (find its ID via
`Ctrl+3` → hover, or the Keys preference page) can be bound to a vim keystroke. That
lets you keep vim-motions for editing and Eclipse for everything semantic.

## Division of labor that works well

- **vim layer**: motions, text objects (`ciw`, `di(`, `.` repeat), registers, visual
  block, `/` search within file, `:%s` small substitutions.
- **Eclipse layer**: everything semantic — `Ctrl+1` quick fix, `Alt+Shift+R` rename,
  organize imports, extract method, content assist, navigation (`F3`, `Ctrl+Alt+H`).
  Don't replicate refactoring with vim macros; Eclipse's refactorings are
  workspace-aware and update all references.
- `:w` works in Vrapper as save; save actions (format edited lines, organize imports)
  run on it just like `Ctrl+S`.
- If a specific Eclipse binding fights with vim (rare; e.g. `Ctrl+W`), decide who
  wins in `Preferences > General > Keys` — unbind or move the Eclipse command.
