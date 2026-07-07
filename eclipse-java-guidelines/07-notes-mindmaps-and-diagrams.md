# Notes, Mindmaps, and Diagrams — GoodNotes, SimpleMind, and Friends

You already have a good instinct: separate **thinking tools** (fast, messy, private)
from **communication tools** (precise, durable, shared). Keep both, and promote
content from the first to the second when it proves valuable.

## GoodNotes (tablet)

Great for: request-flow sketches while tracing code, quick MER subsets, meeting
notes, the port/environment matrix, "architecture as I currently believe it to be"
drawings that you expect to redraw as understanding improves.

Tips:

- One notebook per project, sections per theme (architecture / DB / ops / people).
- Date your sketches. An architecture sketch from week 1 vs. week 6 is a useful
  record of what was non-obvious — those deltas are documentation gaps.
- Redraw rather than patch: redrawing a diagram from memory is active recall and
  shows you instantly which parts you don't actually understand yet.

## SimpleMind Pro — and the class diagram question

SimpleMind is excellent for what it is: **a mind-mapping tool** — radial trees of
ideas with free-form cross-links. Perfect for:

- the technology landscape map you're already building,
- module/domain overviews ("billing depends on…"),
- investigation maps for a gnarly bug (symptoms → hypotheses → evidence),
- onboarding notes: people, systems, credentials-where, glossary.

**For class diagrams: no, not really.** You *can* draw boxes and links, but a class
diagram's value is in its semantics, which SimpleMind has no notion of:
inheritance vs. composition vs. association look identical, no multiplicities, no
attribute/method compartments, no way to keep the diagram consistent with the code.
Beyond ~5 classes it turns into a picture that only you can read, and that silently
goes stale.

Use SimpleMind for the *conceptual* level ("these 8 domain concepts relate roughly
like this") and switch tools the moment you're drawing actual classes:

### Recommended: diagrams as text (PlantUML or Mermaid)

```
@startuml
abstract class BaseEntity { id: Long }
class Customer extends BaseEntity {
  name: String
  +addOrder(o: Order)
}
Customer "1" *-- "many" Order
@enduml
```

Why text-based diagrams win for code diagrams:

- **They live in the repo**, version with the code, and show up in PR diffs.
- **Mermaid renders natively in GitHub** markdown (READMEs, PR descriptions, issues) —
  a class or sequence diagram in a PR description costs three minutes and earns
  reviewer goodwill.
- PlantUML is more powerful (better class/sequence/component support, skinparams);
  Eclipse has PlantUML viewer plugins, and the VS Code/IntelliJ ecosystems render it
  too. Mermaid is more portable (GitHub). Pick one as the team default; both are
  fine.
- Sequence diagrams — text-based ones especially — are *the* most useful UML flavor
  for understanding JSF request flows; consider them before class diagrams.

For the **database**, don't hand-draw full MERs: DBeaver generates ER diagrams from
the live schema (open a schema → ER Diagram tab; you can lay out and export). Hand-
sketch only simplified task-scoped subsets in GoodNotes.

(If you want automatic class diagrams *from* Java sources in Eclipse: the historical
answer, ObjectAid, is abandoned. Practical current options: generate PlantUML from
code with tools/scripts when needed, or accept that hand-curated small diagrams beat
auto-generated wallpaper. A diagram with 12 hand-picked classes explains more than
one with 300.)

## The promotion pipeline

```
GoodNotes / SimpleMind          →  PlantUML / Mermaid in the repo  →  team docs
(private, fast, disposable)        (durable, versioned, reviewable)
```

Rule of thumb: the second time you *re-draw* or *re-explain* something, that's the
signal to promote it to a text diagram in the repo.
