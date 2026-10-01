# MAP representation design

How an exposition's form is chosen. Every new or revised exposition passes
through:

```text
Context → Analysis → Concept model → Representation design → Authoring → Editorial audit → Verification
```

The form of an exposition must follow from what the concept is. Prose is
not the automatic default, and structured blocks are not decoration. This
document extends [content-architecture.md](content-architecture.md#structure-follows-meaning)
and the [quality contract](quality-contract.md). It does not replace them.

## Why this step exists

The L1 campaign skipped it. Its first four domains used flows, distinctions
and tensions where the concept had that shape (11 records). From Networks &
Infrastructure onward, all 299 L1 records are definition plus paragraphs.
Audit notes recorded "structure left as paragraphs, following accepted L1
precedent". Each prose-only record became the precedent for the next, and
form stopped being a decision. The fix is not more structure. It is a
decision made each time, after the concept is understood.

## What the content model can express

Blocks are defined in [`types.ts`](../../src/lib/map/types.ts) and rendered by
[`concept-exposition.tsx`](../../src/components/map/concept-exposition.tsx) and
[`exposition-models.tsx`](../../src/components/map/exposition-models.tsx).

| Block | Schema | Rendering | Accessibility and width |
|---|---|---|---|
| `paragraph` | `text` | Prose in the knowledge field. The definition leads at a larger size. | Plain text. |
| `heading` | `text` | A section title (`h4`) in the prose rhythm. | Real heading element. |
| `flow` | `label`, `stages` of elements. A multi-element stage is a parallel set; an element may be a branch of steps. | Bordered nodes joined by arrows. A parallel set branches and converges. At most 6 per set. | One `role="img"` with a generated text alternative ("label: A, then B, C and D, then E"). Parallel sets stack beside a rail on narrow screens and become columns at `sm` (≤3) or `lg` (≤6). |
| `distinction` | `left`, `right`, optional `further` | An axiom "A ≠ B" on the structural axis, or a vertical chain. | `role="img"`, "A is not the same as B…". Centred, wraps at any width. |
| `tensions` | `label`, `pairs` | Rows of node ↔ node. | List of `role="img"` pairs, "A in tension with B". Compact nodes on narrow screens. |
| `terms` | `terms` | A mono strip of vocabulary. | `role="list"`, `aria-label="Key terms"`. |

What protects them:

- `validation.ts` checks block shapes, at most 6 elements per parallel set,
  no duplicate keys, and plain text. `map.test.ts` exercises it.
- The Foundations L0 test pins one record of each model kind.
- The browser suite opens every L0 domain at five widths and every L1 context
  at two, checking overflow and clipping.
- The render check verifies, for authored concepts, text alternatives,
  overflow and identical text at every placement and width.

### Structures, and where each fits

`npm run map:author -- represent catalog` prints the catalog
([`catalog.ts`](../../src/lib/map/authoring/representation/catalog.ts)). A
**structure** is a property of the concept's meaning. A block is how the
content model writes it down.

| Structure | Block | Fit |
|---|---|---|
| prose: argument, causation, conditions | paragraph | native |
| distinction: likely conflations | distinction | native |
| process: ordered stages, branching and converging | flow | native |
| lifecycle: stages from creation to retirement | flow | native, with no return to an earlier stage |
| failure path: how a fault propagates or branches | flow | native |
| composition: a whole and its parts | flow | approximate, one level |
| variants: kinds of something, each with what follows from it | flow | approximate, one short branch per kind |
| interaction: who acts, in what order | flow | approximate, no message lanes |
| tension: forces that pull against each other | tensions | native |
| vocabulary | terms | native |
| cycle: output fed back into input | none | **gap** |
| state: states and transitions, including returns | none | **gap** |
| comparison: alternatives × shared dimensions | none | **gap** |
| dependency: a graph of what relies on what | none | **gap** |

A gap is recorded in the design as needed capability. It is never forced
into the nearest block: a feedback loop drawn as a one-way flow teaches the
wrong model. New primitives are added only when audits show a gap
repeatedly justified by meaning, and through ordinary product work, not
inside a content run.

## Roles by depth

The [content architecture](content-architecture.md) defines each role. For
representation, each role tends to need different structures:

- **L0, conceptual territory.** Major relationships, broad flows, boundaries,
  mental models and the domain's major distinctions.
- **L1, a system-level concept.** Architecture and interactions, meaningful
  processes, dependencies, trade-offs, lifecycle or state where they
  organize the concept, failure surfaces, and relations to surrounding
  concepts.
- **L2, a mechanism.** Technical sequences, assumptions and invariants,
  implementation-relevant distinctions, variants, failure paths and
  mechanism-level comparisons.

These are tendencies, not templates. Depth changes which structures are
likely to matter. It never fixes a block sequence.

## Analysis and concept model

Before deciding form, analyse the concept with `map:author -- represent
context <concept-id>`. That shows the full authoring context, the record's
current form and its placements. Write a model with only the fields the
concept actually has:

`purpose` (required), `problem`, `actors`, `inputs`, `outputs`,
`relationships`, `sequence`, `lifecycle`, `composition`, `dependencies`,
`assumptions`, `invariants`, `variants`, `tradeoffs`, `failures`,
`distinctions`, and `context` (relations to the L0 parent, siblings,
authored neighbours and other placements).

The model is reasoning, not exposition. It is never inserted into MAP.

## Representation decision

From the model, decide the whole representation, prose included. Each
structure is listed with its purpose: what it shows that prose would show
less clearly.

- **Prose-only is valid** when the concept is an argument, a set of
  conditions or a causal story without a shape of its own.
- **A structure is valid only when it carries meaning** that would be
  materially harder to perceive from prose. Examples: an order that matters,
  a branch, a loop, a real conflation, forces in tension, or alternatives
  compared on the same dimensions.
- **An unnecessary structure is a quality failure**, as much as missing
  useful structure is. Decoration, a flow restating a paragraph, or a
  distinction nobody would conflate all fail.
- **Design for the concept, not the siblings.** A form normalized to
  neighbouring records is the precedent failure this step exists to stop.
- **No quotas.** No block type has a target count or share, anywhere.
- **Canonical placements.** With several placements, the design states why
  the representation holds at each, including leaf placements. With several
  child-carrying placements, it states how the form relates the facets
  without drawing one layer, or the union of layers, as *the* decomposition.

### Classifying existing exposition

| Classification | Meaning |
|---|---|
| **keep** | The exposition and its form already fit the concept. The recommended form equals the current one. |
| **refactor** | Keep the substance, but reorganize part of it into a stronger form: build a structure from what the prose already says, or remove one that does not earn its place. |
| **enhance** | Keep the exposition and add a structure exposing a relationship the record does not make clear. |
| **rewrite** | The substance itself is wrong, misleading or at the wrong level. This needs a concrete justification and should be uncommon. |

Classification judges explanatory quality, never visual variety. A
prose-only record is not a defect, and accepted exposition is not discarded
because it is prose.

## Audit mode (read-only)

```bash
npm run map:author -- represent catalog
npm run map:author -- represent context <concept-id>
npm run map:author -- represent record <concept-id> --file <design.json>
npm run map:author -- represent audit [--concept <id> | --domain <id>] [--json] [--report <abs path under .map-authoring/>]
```

- **Designs** are stored per owning domain in
  `.map-authoring/representation/<domain>.json`. That path is git-ignored
  local state, and ownership follows the [runbook](domain-runbook.md#the-plan).
  Each design records the fingerprint of the record it judged. A later
  content change makes it **stale**.
- **`record`** validates the design and refuses it when:
  - the content files have uncommitted changes;
  - the classification is inconsistent with the current form (for example a
    keep that recommends a change, or an enhance that adds nothing);
  - a rewrite has no justification;
  - a multi-placement concept lacks its canonical note, or a multi-carrier
    concept its facet note.
- **`audit`** reports, per concept: the classification, the model, the
  current and recommended form, the reasoning, the affected placements and
  any capability gap. Across a domain or the corpus it adds descriptive
  usage counts, which are never targets.
- **No command mutates anything.** None creates a branch, edits content,
  commits, pushes, opens a PR, merges or deploys. Every command compares
  HEAD, the branch and the content files before and after it runs, and fails
  on any difference.

## Refactor mode (designed, not yet run)

Accepted improvements are applied later, domain by domain, through the
[runbook](domain-runbook.md) mechanics. A refactor run:

1. **Starts** from current `main` and the domain's recorded designs. Only
   designs a human accepted, classified refactor, enhance or rewrite, and
   not stale are in scope. Keep and pending concepts are untouched.
2. **Authors** each in-scope record in place, preserving its substance
   wherever the design says so. Ownership and every placement keep their
   meaning: the record is still one canonical exposition for all of them.
3. **Verifies** with the normal gates (tests, lint, build), the full
   browser suite, and the render check of every placement of every changed
   concept at both widths.
4. **Validates the diff** with `validateRefactorDiff`
   ([`refactor-diff.ts`](../../src/lib/map/authoring/representation/refactor-diff.ts)):
   - only `data.ts` may change, and only for concepts with a current
     improvement design;
   - no record is added or removed, and ids are unchanged;
   - the registry, taxonomy, relationships, mechanisms and paths are
     unchanged;
   - the generated view is byte-identical, because existing content flips no
     `hasContent` flag. A content change after the design was recorded is a
     stop.
5. **Commits and opens a PR** as a domain run does, with the design
   summaries in the PR so reviewers see why each form changed.

A design that needs a capability gap is not applied until the capability
exists, or until a human accepts a different representation.
