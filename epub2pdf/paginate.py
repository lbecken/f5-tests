"""Page breaking: the "bag of algorithms" and the badness scorer.

Every strategy turns one chapter's Atom stream into a list of fixed Pages.
A single badness function (score_layout) evaluates any candidate, so the
strategies compete on equal terms and `auto` mode simply keeps the winner.

Strategies
----------
greedy          first-fit: place atoms until the page overflows. Fast baseline.
fixup           greedy with retraction: when closing a page, push widows,
                orphans and stranded headings onto the next page (what most
                word processors do).
optimal         dynamic programming over all feasible break points, minimizing
                total badness (the page-level analogue of Knuth-Plass line
                breaking / Plass' pagination thesis).
optimal-shrink  same DP, but image atoms carry shrink capacity, so the
                optimizer may trade up to 40% of an image's size against a
                better break ("glue-like" images).
float           greedy, but an image that does not fit the remaining space is
                floated to the top of the next page while following text is
                pulled back to fill the gap (magazine-style floats).
"""

from __future__ import annotations

import math
from typing import Callable, Dict, List, Optional, Sequence, Tuple

from .model import A_IMAGE, A_LINE, A_SPACE, Atom, CandidateLayout, Page

INF = float("inf")

# Badness weights. The scale is arbitrary; only ratios matter.
W_UNDERFULL = 400.0     # x emptiness^2, non-final pages
W_WIDOW = 80.0          # last line of a paragraph alone at a page top
W_ORPHAN = 60.0         # first line of a paragraph alone at a page bottom
W_KEEP = 200.0          # break right after keep_with_next (stranded heading)
W_SHRINK = 60.0         # x fraction of available image shrink actually used
W_FLOAT = 25.0          # per image moved out of reading order

STRATEGIES = ("greedy", "fixup", "optimal", "optimal-shrink", "float")


# ------------------------------------------------------------------ shared --

def _trim(atoms: Sequence[Atom]) -> List[Atom]:
    """Strip page-edge glue."""
    i, j = 0, len(atoms)
    while i < j and atoms[i].kind == A_SPACE:
        i += 1
    while j > i and atoms[j - 1].kind == A_SPACE:
        j -= 1
    return list(atoms[i:j])


def _materialize(seg: Sequence[Atom], height_limit: float) -> Page:
    """Build a Page from trimmed atoms, distributing shrink if overfull."""
    page = Page()
    natural = sum(a.height for a in seg)
    over = natural - height_limit
    caps = [a.shrink for a in seg]
    total_cap = sum(caps)
    for a, cap in zip(seg, caps):
        h = a.height
        if over > 1e-9 and total_cap > 1e-9:
            h -= min(over, total_cap) * (cap / total_cap)
        page.add(a, h)
    return page


def _is_widow(atom: Atom) -> bool:
    return (atom.kind == A_LINE and atom.line_count > 1
            and atom.line_idx == atom.line_count - 1
            and atom.laid is not None and atom.laid.block.kind in ("para", "quote"))


def _is_orphan(atom: Atom) -> bool:
    return (atom.kind == A_LINE and atom.line_count > 1 and atom.line_idx == 0
            and atom.laid is not None and atom.laid.block.kind in ("para", "quote"))


def score_layout(pages: List[Page], height: float,
                 floats: int = 0) -> Tuple[float, List[str]]:
    """Badness of a full candidate layout + human-readable issue list."""
    cost = 0.0
    issues: List[str] = []
    for pi, page in enumerate(pages):
        last = pi == len(pages) - 1
        seg = _trim(page.atoms)
        if not seg:
            continue
        natural = sum(a.height for a in seg)
        # underfull
        emptiness = max(0.0, (height - min(natural, height)) / height)
        if not last and emptiness > 0.02:
            cost += W_UNDERFULL * emptiness ** 2
            if emptiness > 0.25:
                issues.append(f"p{pi + 1}: {emptiness:.0%} empty")
        # widow at top
        if _is_widow(seg[0]):
            cost += W_WIDOW
            issues.append(f"p{pi + 1}: widow line at top")
        # orphan / stranded heading at bottom
        tail = seg[-1]
        if not last:
            if tail.keep_with_next:
                cost += W_KEEP
                issues.append(f"p{pi + 1}: heading stranded at bottom")
            elif _is_orphan(tail):
                cost += W_ORPHAN
                issues.append(f"p{pi + 1}: orphan line at bottom")
        # shrink actually applied
        shrunk = natural - sum(page.heights)
        cap = sum(a.shrink for a in seg)
        if shrunk > 0.05 and cap > 0:
            cost += W_SHRINK * (shrunk / cap)
            issues.append(f"p{pi + 1}: images shrunk {shrunk:.0f}mm")
    if floats:
        cost += W_FLOAT * floats
        issues.append(f"{floats} image(s) floated out of reading order")
    return cost, issues


# ------------------------------------------------------------------ greedy --

def paginate_greedy(atoms: List[Atom], height: float, use_shrink: bool = False,
                    retract: bool = False) -> List[Page]:
    pages: List[Page] = []
    cur: List[Atom] = []
    cur_h = 0.0
    cur_shrink = 0.0
    queue = list(atoms)
    i = 0

    def close() -> None:
        nonlocal cur, cur_h, cur_shrink
        seg = _trim(cur)
        if seg:
            pages.append(_materialize(seg, height))
        cur, cur_h, cur_shrink = [], 0.0, 0.0

    while i < len(queue):
        a = queue[i]
        if not cur and a.kind == A_SPACE:
            i += 1
            continue
        limit = height + (cur_shrink + a.shrink if use_shrink else 0.0)
        if cur and cur_h + a.height > limit + 1e-9:
            if retract:
                kept = _retract(cur, queue, i)
                if kept is not None:
                    queue[i:i] = kept
            close()
            continue
        cur.append(a)
        cur_h += a.height
        cur_shrink += a.shrink
        i += 1
    close()
    return pages


def _retract(cur: List[Atom], queue: List[Atom], nxt: int) -> Optional[List[Atom]]:
    """Pop atoms off the end of the current page to avoid stranded headings,
    orphans and widows. Returns atoms to prepend to the remaining stream."""
    moved: List[Atom] = []

    def pop_tail_spaces() -> None:
        while cur and cur[-1].kind == A_SPACE:
            moved.insert(0, cur.pop())

    changed = True
    while changed and len([a for a in cur if a.kind != A_SPACE]) > 2:
        changed = False
        pop_tail_spaces()
        if not cur:
            break
        tail = cur[-1]
        if tail.keep_with_next or _is_orphan(tail):
            moved.insert(0, cur.pop())
            changed = True
            continue
        # widow: the paragraph continues on the next page with exactly 1 line
        j = nxt
        while j < len(queue) and queue[j].kind == A_SPACE:
            j += 1
        if (j < len(queue) and moved == [] and tail.kind == A_LINE
                and queue[j].kind == A_LINE and queue[j].para_id == tail.para_id
                and _is_widow(queue[j]) and tail.line_count > 2):
            moved.insert(0, cur.pop())
            changed = True
    return moved or None


# ------------------------------------------------------------------- float --

def paginate_float(atoms: List[Atom], height: float) -> Tuple[List[Page], int]:
    """Greedy, but images that do not fit float to the next page top."""
    pages: List[Page] = []
    cur: List[Atom] = []
    cur_h = 0.0
    deferred: List[Atom] = []   # floated images (+ trailing caption lines)
    floats = 0
    queue = list(atoms)
    i = 0

    def close() -> None:
        nonlocal cur, cur_h
        seg = _trim(cur)
        if seg:
            pages.append(_materialize(seg, height))
        # floated content leads the next page
        cur = list(deferred)
        cur_h = sum(d.height for d in cur)
        del deferred[:]

    while i < len(queue):
        a = queue[i]
        if not cur and a.kind == A_SPACE:
            i += 1
            continue
        if cur and cur_h + a.height > height + 1e-9:
            if (a.kind == A_IMAGE and not deferred
                    and a.height <= height - 1e-9):
                # float: image (+ caption) jumps to next page, text flows on
                deferred.append(a)
                floats += 1
                i += 1
                while i < len(queue) and a.keep_with_next and \
                        queue[i].kind == A_LINE and \
                        queue[i].laid is not None and \
                        queue[i].laid.block.kind == "caption":
                    deferred.append(queue[i])
                    i += 1
                continue
            close()
            continue
        cur.append(a)
        cur_h += a.height
        i += 1
    close()
    if cur:      # deferred images re-queued by the final close()
        seg = _trim(cur)
        if seg:
            pages.append(_materialize(seg, height))
    return pages, floats


# ----------------------------------------------------------------- optimal --

def paginate_optimal(atoms: List[Atom], height: float) -> List[Page]:
    """Total-fit page breaking: DP minimizing the same badness score_layout
    charges, so the result is globally optimal for this atom stream."""
    n = len(atoms)
    if n == 0:
        return []
    best = [INF] * (n + 1)
    prev = [-1] * (n + 1)
    best[0] = 0.0

    for i in range(n):
        if best[i] == INF:
            continue
        # first non-space atom of the page
        s = i
        while s < n and atoms[s].kind == A_SPACE:
            s += 1
        if s == n:
            if best[i] < best[n]:
                best[n], prev[n] = best[i], i
            break
        start = atoms[s]
        widow_pen = W_WIDOW if _is_widow(start) else 0.0
        run_h = 0.0
        run_shrink = 0.0
        placed_any = False
        k = s
        while k < n:
            a = atoms[k]
            run_h += a.height
            run_shrink += a.shrink
            if a.kind != A_SPACE:
                if run_h - run_shrink > height + 1e-9:
                    if not placed_any:
                        # single atom taller than the page: force it through
                        _relax(best, prev, i, k + 1, widow_pen + 50.0)
                    break
                placed_any = True
                over = max(0.0, run_h - height)
                cost = widow_pen
                if over > 1e-9:
                    cost += W_SHRINK * (over / max(run_shrink, 1e-9))
                is_end = k == n - 1
                if not is_end:
                    emptiness = max(0.0, (height - min(run_h, height)) / height)
                    if emptiness > 0.02:
                        cost += W_UNDERFULL * emptiness ** 2
                    if a.keep_with_next:
                        cost += W_KEEP
                    elif _is_orphan(a):
                        cost += W_ORPHAN
                _relax(best, prev, i, k + 1, cost)
            k += 1
    # walk breaks back
    if best[n] == INF:                       # defensive; should not happen
        return paginate_greedy(atoms, height)
    cuts = []
    j = n
    while j > 0:
        cuts.append((prev[j], j))
        j = prev[j]
    pages: List[Page] = []
    for a, b in reversed(cuts):
        seg = _trim(atoms[a:b])
        if seg:
            pages.append(_materialize(seg, height))
    return pages


def _relax(best: List[float], prev: List[int], i: int, j: int, cost: float) -> None:
    if best[i] + cost < best[j]:
        best[j] = best[i] + cost
        prev[j] = i


# --------------------------------------------------------------- selection --

def run_strategy(name: str, atoms_plain: List[Atom], atoms_shrink: List[Atom],
                 height: float) -> CandidateLayout:
    floats = 0
    if name == "greedy":
        pages = paginate_greedy(atoms_plain, height)
    elif name == "fixup":
        pages = paginate_greedy(atoms_plain, height, retract=True)
    elif name == "optimal":
        pages = paginate_optimal(atoms_plain, height)
    elif name == "optimal-shrink":
        pages = paginate_optimal(atoms_shrink, height)
    elif name == "float":
        pages, floats = paginate_float(atoms_plain, height)
    else:
        raise ValueError(f"unknown strategy {name!r}")
    score, issues = score_layout(pages, height, floats)
    return CandidateLayout(strategy=name, pages=pages, score=score, issues=issues)


def paginate_chapter(
    atoms_plain: List[Atom],
    atoms_shrink: List[Atom],
    height: float,
    strategy: str = "auto",
    judge: Optional[Callable[[List[CandidateLayout]], Optional[str]]] = None,
) -> Tuple[CandidateLayout, List[CandidateLayout]]:
    """Paginate one chapter. In auto mode every strategy in the bag runs and
    the lowest-badness candidate wins; a judge callback may overrule near-ties.

    Returns (winner, all_candidates).
    """
    if strategy != "auto":
        c = run_strategy(strategy, atoms_plain, atoms_shrink, height)
        return c, [c]

    # cheap first: if greedy is already flawless there is nothing to optimize
    candidates = [run_strategy("greedy", atoms_plain, atoms_shrink, height)]
    if candidates[0].score > 1e-9:
        has_images = any(a.kind == A_IMAGE for a in atoms_plain)
        bag = ["fixup", "optimal"]
        if has_images:
            bag += ["optimal-shrink", "float"]
        for name in bag:
            candidates.append(run_strategy(name, atoms_plain, atoms_shrink, height))

    ranked = sorted(candidates, key=lambda c: c.score)
    winner = ranked[0]

    # near-tie: let the (optional) local model pick
    if judge is not None and len(ranked) > 1:
        contenders = [c for c in ranked
                      if c.score <= ranked[0].score * 1.35 + 20.0][:3]
        if len(contenders) > 1 and _layouts_differ(contenders):
            pick = judge(contenders)
            if pick:
                for c in contenders:
                    if c.strategy == pick:
                        winner = c
                        break
    return winner, candidates


def _layouts_differ(cands: List[CandidateLayout]) -> bool:
    sig = {(len(c.pages), tuple(len(p.atoms) for p in c.pages)) for c in cands}
    return len(sig) > 1
