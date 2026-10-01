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
| `cycle` | `label`, `steps` (2 to 6) | Steps stack on the model's axis joined by forward arrows; a return rail leaves the last step and enters the first. | One `role="img"`, "label: A, then B, then C, then back to A, and again." The same column at every width. |
| `comparison` | `label`, `dimensions` (2 to 4), `alternatives` (2 to 6), each with one value per dimension | Dimensions as column headers and alternatives as rows on wide screens; each alternative stacked with its dimension names beside the values on narrow ones. | An ARIA table (`role="table"`, column and row headers, labelled), the same table at every width, so values are read with their dimension and alternative. |

What protects them:

- `validation.ts` checks block shapes, at most 6 elements per parallel set,
  no duplicate keys, and plain text. `map.test.ts` exercises it.
- The Foundations L0 test pins one record of each model kind.
- The browser suite opens every L0 domain at five widths and every L1 context
  at two, checking overflow and clipping.
- The render check verifies, for authored concepts, text alternatives (and
  table labels), overflow and identical text at every placement and width.
- The browser suite's `models` section serves a fixture exposition through
  the content API and checks cycle and comparison in the real components at
  1280 and 375 pixels: the generated text alternative, the return rail
  joining last step to first, table headers and cells, both layouts, clipping,
  overflow and identical text.

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
| cycle: a recurrent process whose output starts the next pass | cycle | native |
| comparison: alternatives × shared dimensions | comparison | native |
| state: states and transitions, including returns | none | **gap** |
| dependency: a graph of what relies on what | none | **gap** |

A gap is recorded in the design as needed capability. It is never forced
into the nearest block: a feedback loop drawn as a one-way flow teaches the
wrong model. New primitives are added only when audits show a gap
repeatedly justified by meaning, and through ordinary product work, not
inside a content run.

### Choosing among the structured blocks

**`cycle` or `flow`.** Use `cycle` only when the process recurs and its last
step feeds the next pass of its first: a controller measuring the effect of
its own last adjustment, prices drawing in buyers who raise prices, an
experiment chosen from the last result. The return is the meaning, and the
model shows it. Use `flow` for a process that ends (a lifecycle, a pipeline, a
cascade that runs out), and for one that merely repeats from scratch, such as
a block produced every few seconds, where nothing of one pass feeds the next.
A cycle whose loop the paragraph could state in one clause adds little; draw
it when the loop's steps, and where delay or amplification enters it, are what
the reader needs to see.

**`comparison` or something else.** Use `comparison` when several
alternatives differ along the same two or more named dimensions and the
reader needs to read across them: which option costs what, waits how long,
trusts whom. It is not a generic table to break up prose.

- One dimension per alternative is a set of **variants**: a `flow` branching
  into one short branch per kind, or simply a sentence.
- Two notions a reader would conflate are a **`distinction`**, not a
  two-row comparison.
- Forces that pull against each other within one design are **`tensions`**;
  a comparison sets alternatives side by side.
- A list of vocabulary is **`terms`**.

**Variants do not justify a block by themselves.** A concept having kinds,
or alternatives, is common. Draw them only when seeing them side by side
materially changes understanding: when the reader must compare what each
implies and prose spreads that across sentences. Two or three alternatives
explained in a paragraph each usually read better as prose. The same test
applies to every structured block, including `cycle` and `comparison`.

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

## Refactor mode

Accepted improvements are applied domain by domain through `map:author --
refactor`, which shares every stage, check and safeguard of a
[domain run](domain-runbook.md).

### Accepted designs are repository-owned

[`accepted-designs.json`](../../src/lib/map/authoring/representation/accepted-designs.json)
is the governance for refactor runs, reviewed and accepted by merging it.

- **What is listed.** Only improvement designs, each actionable or blocked.
  Each entry holds:
  - the concept and its owning domain;
  - its classification and a short concept model;
  - its form when reviewed, and the accepted target;
  - the justification, every placement, and canonical or facet notes;
  - the fingerprint of the exact record it reviewed.
- **KEEP is everything else.** A run may change nothing the spec does not
  list as actionable for its domain.
- **Blocked designs** need a primitive no block expresses yet (today:
  `state`). They are kept visible, never executed, and never block other
  designs in their domain.
- **The spec is written from the audit** with `map:author -- represent
  export-accepted`. A spec that already records resolutions is never
  regenerated.
- **A unit test keeps the spec valid against the corpus.** If a listed
  record changes outside a run, its design is stale and must be reviewed
  again.

### A run

```bash
npm run map:author -- refactor domains                   # every domain: no work, pending, complete, stale; blocked; the next
npm run map:author -- refactor plan --domain <id>
npm run map:author -- refactor start --domain <id> [--dry-run]
npm run map:author -- refactor context <concept-id>      # the concept, its accepted design and the boundary
npm run map:author -- refactor record <concept-id> --decision execute|reduce|keep --note "..."
npm run map:author -- refactor audit
npm run map:author -- refactor complete audit --note "..."
npm run map:author -- refactor run [--trailer ..] [--footer ..]
```

1. **Start.** Starting requires:
   - a clean, current `main`;
   - no open MAP run PR of either kind;
   - no existing branch or run for the domain;
   - a valid spec, with no stale design for the domain.

   It creates `refactor/map-<domain>-l1-representations` and records the
   base and the domain's design set. A domain with nothing actionable never
   gets a branch.
2. **Reconsider and edit**, one actionable design at a time, against
   current context. The agent then records one decision:
   - **execute**: reach exactly the accepted structured form;
   - **reduce**: a smaller change within it;
   - **keep**: leave the record exactly as reviewed.

   A refactor or enhancement keeps the definition and legacy fields. Using
   a block the design does not include, changing a definition outside a
   rewrite design, or touching another concept is refused at `record` and
   again at the diff. If a materially different design is needed, the run
   stops.
3. **Audit** the changed records. Completing the audit writes each
   decision into the spec as that design's resolution: the decision, the
   resulting structured form and the result's fingerprint.
4. **Verify.**
   - The normal gates and the full browser suite.
   - The render check of every placement of every changed concept at 1280
     and 375 pixels: trail, current and expanded state, exact children at
     each carrier, no facet leakage, text alternatives and table labels,
     overflow, and identical text at every placement.
5. **Validate the diff** with `validateRefactorDiff`
   ([`refactor-diff.ts`](../../src/lib/map/authoring/representation/refactor-diff.ts)).
   Expectations come from the base's designs and the recorded decisions:
   - exactly the executed or reduced records changed, each within its
     design;
   - kept, blocked, KEEP and other domains' records are byte-identical;
   - nothing is added or removed, and ids, registry, taxonomy,
     relationships, mechanisms, paths and the generated view are unchanged;
   - the spec changes only by this run's resolutions, consistent with the
     records;
   - declared general fixes are the only other file class.
6. **Commit, push, open the PR and wait for CI.** The commit is
   `refactor(map): improve <domain> L1 representations` (after any fix
   commits). The PR text, generated from the run, lists changed and kept
   concepts with their reasons, blocked designs, verification and the diff
   boundary. The run ends at "validated PR awaiting human merge". A run in
   which every design was kept still opens a PR, because the spec records
   those resolutions.

The run state lives in `.map-authoring/refactor/<domain>.json`. As for domain
runs:
- every command first reconciles the branch, HEAD, remote branch and PR with
  the recorded run;
- a changed tree or build invalidates earlier checks;
- a content change after the audit reopens it.

A domain is complete once all its actionable designs are resolved on `main`.
`refactor domains` names the next domain with work in canonical order.

**No shortcut for new content.** A refactor run changes existing L1 records
only, within accepted designs. It can never add a record, so new exposition,
including all L2 authoring, still goes through context, analysis, concept
model, representation design, authoring, editorial audit and verification.
