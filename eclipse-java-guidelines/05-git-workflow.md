# Git Tooling — Recommended Mix

You're comfortable with git in the terminal. Good news: **keep the terminal as your
primary git tool.** It's precise, scriptable, and identical to what CI and every
tutorial does. Use GUI tools where they genuinely add value — visualizing history,
diffing, and line-level archaeology — rather than replacing your muscle memory.

## The recommended setup

| Task | Tool |
|------|------|
| status, add/stage, commit, branch, rebase, stash, push/pull | **Terminal** |
| fast interactive staging/branching in the terminal | **lazygit** (or `tig`) — optional but excellent |
| "what changed in this file / who wrote this line" while coding | **Eclipse EGit annotations** |
| browsing history of a file/method | **Eclipse History view** |
| diffing branches, directories, complicated merges | **Beyond Compare** wired into git |
| PRs, reviews, CI status | **GitHub web** + **`gh` CLI** |

### Why not do everything in EGit?

EGit is decent but slower and more click-heavy than the terminal for write
operations, and its rebase/conflict UX is confusing under pressure. Where it shines
is *read* operations integrated with the editor:

- **Quick Diff against HEAD** (you have it — set the reference to "A Git Revision",
  see file 01): colored change bars while editing.
- **Right-click > Team > Show Revision Information**: inline blame in the gutter;
  hover shows the commit. The fastest way to answer "why is this line like this?" —
  and the commit message + linked PR is often the only documentation that exists.
- **Team > Show in History**, then toggle "Show all changes of the selected
  resource": full history of one file, with diffs per commit.
- The **Git Staging** view is fine for reviewing your changes hunk-by-hunk before
  committing, if you prefer that over `git add -p`.

### Beyond Compare as git's diff/merge tool

You already like BC — make git use it:

```ini
# ~/.gitconfig
[diff]
    tool = bc
[difftool "bc"]
    path = bcompare        # or full path; 'bcomp' on Windows
[difftool]
    prompt = false
[merge]
    tool = bc
[mergetool "bc"]
    path = bcompare
    trustExitCode = true
```

Then:

```bash
git difftool main..HEAD -- src/…      # file-by-file in BC
git difftool -d main..HEAD            # ONE BC window, whole diff as folder compare
git mergetool                         # resolve conflicts in BC's 3-way view
```

`git difftool -d` (directory diff) is the killer feature: reviewing a whole branch
as a BC folder comparison is far more pleasant than paging through `git diff`.

### gh CLI

Since PRs live in GitHub, install `gh`:

```bash
gh pr create --fill                    # PR from current branch
gh pr view --web                       # open current branch's PR in browser
gh pr checkout 123                     # review someone's PR locally
gh pr diff 123                         # or pipe it to your pager
gh run watch                           # follow the GitHub Actions run
gh run view --log-failed               # see why CI failed without clicking around
```

`gh pr checkout` + `git difftool -d main...HEAD` + running the app locally is a solid
review routine for non-trivial PRs; use the GitHub web UI for the actual line
comments.

## Workflow tips for the monorepo + master flow

- **Small, single-purpose commits** with imperative messages
  ("Fix rounding in invoice total"). Rebase-cleanup (`git rebase -i main`) before
  opening the PR so reviewers see a readable story.
- `git pull --rebase` (set `pull.rebase = true`) to keep feature branches linear.
- `git fetch origin main` + `git rebase origin/main` regularly on long-lived
  branches — small frequent rebases beat one giant conflict session.
- Useful aliases:
  ```ini
  [alias]
      st = status -sb
      lg = log --oneline --graph --decorate -20
      last = log -1 --stat
      fixup = commit --fixup
      ri = rebase -i --autosquash
  ```
- `git stash` before switching contexts inside one workspace; but for parallel work
  consider a **second clone/workspace** (file 01) or `git worktree add` — worktrees
  give each branch its own directory without a second `.git`, which pairs nicely
  with a second Eclipse workspace for reviews.
- Before pushing, run what CI runs: `./gradlew build` (or the project's designated
  check task). A red GitHub Action costs you a round-trip; a local run costs minutes.
