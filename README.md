# epub2pdf-smart

Re-typeset EPUB ebooks as **fixed-layout PDFs** (real pages, real page
numbers) — with a converter that decides *per chapter, on the fly* how to
build the best-looking pages out of the EPUB's dynamic flow layout.

```
pip install .            # or: pip install -e ".[vision,dev]"
epub2pdf mybook.epub                       # -> mybook.pdf
epub2pdf *.epub -o out/                    # batch: one PDF per book
epub2pdf mybook.epub --report -v           # see which algorithm won each chapter
epub2pdf mybook.epub --judge ollama        # let a local LLM arbitrate near-ties
```

---

## 1. The problem, and the investigation

An EPUB is a *flow* document: XHTML + CSS with no notion of a page. A PDF
book is a sequence of *fixed* pages. The conversion therefore has to answer
one core question thousands of times: **where do the page breaks go, and
what happens to images that straddle them?** Naive converters answer
greedily (fill the page, break, repeat) and produce the classic artifacts:

- **orphans** — the first line of a paragraph stranded at a page bottom;
- **widows** — the last line of a paragraph stranded alone at a page top;
- **stranded headings** — a heading as the last line of a page;
- **image craters** — a large image that doesn't fit leaves a third of a
  page empty, or gets brutally scaled down, or gets separated from its
  caption.

### What exists already

| Tool | Approach | Weakness for this goal |
|---|---|---|
| Calibre `ebook-convert` | flow HTML into pages via its viewer engine | greedy breaking, little page-quality optimization |
| `pandoc` → LaTeX | TeX's `\pagebreak` penalties | excellent type, but fragile on arbitrary EPUB HTML/images |
| WeasyPrint / Prince (HTML+CSS paged media) | CSS `orphans`/`widows` properties | rule-based only; no comparison of alternatives, no image negotiation |

None of them *generate several candidate layouts and score them* — which is
what was asked for.

### Is there a trained model for this? (Hugging Face survey)

Short answer: **no off-the-shelf model does "pagination quality" — and that's
fine, because the classical algorithmic solution is stronger anyway.**

- [LayoutLMv3](https://huggingface.co/docs/transformers/model_doc/layoutlmv3),
  DiT, and the [DocLayNet-trained detectors](https://huggingface.co/HURIDOCS/pdf-document-layout-analysis)
  ([overview](https://huggingface.co/blog/document-ai)) perform document layout
  **analysis**: they detect regions (paragraph/table/figure) in *existing*
  documents. They answer "what is on this page?", not "how should this page
  be built?".
- Layout **generation** models (LayoutDM, LayoutTransformer, …) synthesize
  poster/UI/magazine element arrangements — they don't model text flow,
  line counts, or reading order across pages.
- The pagination problem itself was solved *optimally* in classical CS: the
  [Knuth–Plass](https://en.wikipedia.org/wiki/Knuth%E2%80%93Plass_line-breaking_algorithm)
  badness/penalty framework (TeX), extended to page breaking in Michael
  Plass' PhD thesis, finds the **globally optimal** sequence of page breaks
  by dynamic programming — deterministic, exact, and ~milliseconds per
  chapter. A learned model would be an approximation of something we can
  compute exactly.

**Where a local model genuinely adds value** is *judging aesthetic
near-ties*: when two candidate layouts have similar heuristic scores
("shrink this image 15% and keep it with its paragraph" vs. "leave a
quarter-page of whitespace"), the choice is taste, not math. A small local
vision-language model (via [Ollama](https://ollama.com) — `qwen2.5vl:7b`,
`llava`, `gemma3` all run comfortably on an M4 Max / 64 GB) can look at
rendered candidate pages and vote. That is exactly — and only — the role it
gets here.

### The trade-off chosen

> **Core = a bag of deterministic pagination algorithms competing under a
> shared badness score (the Knuth-Plass idea lifted to pages).
> Optional = a local Ollama model as tie-breaking judge.**

This keeps conversion fast, reproducible and dependency-light, uses the
optimal algorithm where optimality is computable, and reserves the model
for the genuinely subjective calls. No cloud, no GPU required.

---

## 2. How it works

```
EPUB ──parse──> blocks ──measure──> lines ──flatten──> atoms ──paginate──> pages ──render──> PDF
     epub.py   content.py          layout.py                  paginate.py           render.py
```

1. **Parse** (`epub.py`, `content.py`): EPUB 2/3 container → spine documents
   → semantic blocks (headings, paragraphs, quotes, lists, code, images,
   captions, tables°). Publisher CSS is deliberately ignored (that's the
   point of re-typesetting); a few inline hints (`text-align`,
   `font-style/weight`) are honored.
2. **Measure** (`layout.py`): every paragraph is broken into lines using
   the *actual* embedded font metrics (fpdf2), so heights are exact. The
   result is a stream of **atoms**: lines, images, and droppable
   inter-block glue — images may carry *shrink capacity*, making them
   behave like TeX glue.
3. **Paginate** (`paginate.py`) — the bag of algorithms, per chapter:

   | strategy | idea |
   |---|---|
   | `greedy` | first-fit; the baseline every other candidate must beat |
   | `fixup` | greedy + retraction of widows/orphans/stranded headings (word-processor behavior) |
   | `optimal` | dynamic programming over all feasible break points, minimizing total badness — globally optimal page breaks |
   | `optimal-shrink` | same DP, but images may shrink up to 40%, letting the optimizer trade image size against break quality |
   | `float` | images that don't fit float to the next page top while text is pulled back to fill the gap (magazine floats) |

   Every candidate is scored by **one shared badness function**: penalties
   for underfull pages (squared emptiness), widows, orphans, stranded
   headings, image shrinkage, and out-of-reading-order floats. In `--strategy
   auto` (default) the lowest badness wins the chapter. If plain greedy is
   already flawless, the others aren't even run — that's the "on-the-fly"
   decision-making: each chapter gets exactly the algorithm it needs.
4. **Judge** (`judge.py`, optional): when the top candidates score within a
   near-tie band *and* actually differ, a local Ollama model votes.
   Vision-capable models (`--judge ollama:qwen2.5vl:7b`) see rendered PNGs
   of the candidate pages (needs the `vision` extra, i.e. PyMuPDF);
   text-only models get a structured feature description. Any failure
   (Ollama down, model missing) silently falls back to the heuristic
   ranking — the judge can only ever *improve* taste, never break a run.
5. **Render** (`render.py`): justified text with per-word placement, images
   centered with captions kept attached, full-page cover, printed table of
   contents with dot leaders (roman folios) whose entries carry the final
   *body* page numbers, PDF outline/bookmarks, page-number footers, PDF
   metadata.

° Tables are degraded to text rows (a real table renderer is future work).

## 3. Usage

```console
$ epub2pdf book.epub --report
book.epub -> book.pdf
  'The Deliberate Counsel': 36 pages in 0.6s (font: Georgia)
  strategy wins per chapter: optimal×4, optimal-shrink×1
  ch01 'Chapter 1: The Salt City': 8p via optimal (scores: greedy=40, fixup=40, optimal=22, optimal-shrink=22, float=250)
  ch03 'A Language of Lighthouses': 8p via optimal-shrink (scores: greedy=252, fixup=252, optimal=130, optimal-shrink=28, float=110)
       ! p2: images shrunk 16mm
  ...
```

Common flags (see `epub2pdf --help` for all):

| flag | default | meaning |
|---|---|---|
| `-o PATH` | next to input | output file, or directory in batch mode |
| `--page-size` | `6x9` | `a4`, `a5`, `letter`, `6x9`, `5x8`, or `WIDTHxHEIGHT` mm |
| `--margins T,R,B,L` | `16,14,16,14` | page margins (mm) |
| `--font-size` / `--line-height` | `11` / `1.45` | body type |
| `--font-family` | best serif found | e.g. `georgia`, `times`, `dejavu`; system fonts are auto-discovered (macOS `/System/Library/Fonts/Supplemental`, Linux dejavu/liberation/noto) |
| `--no-justify` | justified | ragged-right text |
| `--first-indent` | `5` | paragraph first-line indent, mm (`0` = off) |
| `--strategy` | `auto` | force one algorithm instead of the competition |
| `--no-toc`, `--no-page-numbers` | on | trimmings |
| `--judge ollama[:model]` | off | local LLM tie-breaker (default model `qwen2.5vl:7b`) |
| `--report`, `-v` | off | per-chapter decisions, scores and issues |

### Using the AI judge on a Mac (M-series)

```bash
brew install ollama && ollama serve &
ollama pull qwen2.5vl:7b          # vision judge (~6 GB, fast on M4 Max)
pip install ".[vision]"           # PyMuPDF, to rasterize candidate pages
epub2pdf book.epub --judge ollama --report
```

Text-only judging (no extra install): `--judge ollama:llama3.2:3b`.
Note the honest caveat: the text judge only sees the same features the
heuristic already scores, so it acts as a preference model; the *vision*
judge actually looks at the pages.

## 4. Development

```bash
pip install -e ".[dev]"
python tests/make_sample_epub.py sample.epub   # generates a 5-chapter test book
pytest tests/ -v                               # end-to-end + unit tests
```

The library is importable, so a GUI could sit directly on top of it:

```python
from epub2pdf import convert, Options
report = convert("book.epub", "book.pdf", Options(page_size="a5"))
print(report.summary())
```

### Known limitations / future work

- Tables become plain text rows; footnote links stay inline as text.
- No hyphenation yet (a `pyphen` pass before line breaking would slot into
  `layout.py` cleanly and would improve justification color further).
- SVG vector art is only supported when it wraps a raster `<image>`.
- The DP optimizer works per chapter; a whole-book pass (so a chapter's
  last page can absorb slack from the next) would be a straightforward
  extension.
- Facing-page balance (verso/recto spread evenness) is not scored.
