# MAP authoring quality contract

Two kinds of quality, kept separate on purpose:

- **A. Mechanical invariants** are enforced by code. A change that violates
  one fails `npm test`, `npm run build`, or the resolver.
- **B. Editorial and semantic criteria** are judged by the author and by
  review. Code cannot establish them, and nothing here pretends it can.

## A. Mechanically enforced invariants

| Invariant | Why | Enforced in |
|---|---|---|
| Each content record references an existing concept; at most one record per concept. | Content belongs to the canonical concept (spec §8, §11). | `validateMapKnowledge` ([`validation.ts`](../../src/lib/map/validation.ts)) |
| Content IDs are `<concept-id>-content`, valid identifiers, unique. | A predictable identity for every record. | `validation.ts`; `map.test.ts` "content exists exactly where it was intentionally authored" |
| Content exists exactly for the concepts registered in `AUTHORED_CONTENT_CONCEPTS` ([`content-registry.ts`](../../src/lib/map/authoring/content-registry.ts)). | Content must be intentional, never accidental; structural work adds none. | `assertAuthoredContentOnly` / `assertContentRegistry` ([`map.test.ts`](../../src/lib/map/map.test.ts)), in the global test and every domain's tree tests |
| The definition is not blank; present legacy fields (`summary`, `explanation`, `whyItMatters`) are not blank. | The definition leads every exposition; empty strings render as empty paragraphs. | `validation.ts` |
| Block shapes: paragraphs and headings non-empty; flows have a label, at least 2 stages, no empty elements, branches only inside parallel sets, no two parallel sets in a row; distinctions name every side; tensions have at least one complete pair; terms strips list at least 2 terms; cycles have a label and 2 to 6 distinct steps; comparisons have a label, 2 to 4 distinct dimensions and 2 to 6 distinct alternatives, each with exactly one non-empty value per dimension; state models have a label, 2 to 6 distinct states and at most 8 transitions, each between listed states with its event or condition and no two between the same states, every state reachable from the first, and at least one transition back to an earlier or the same state that closes a loop (otherwise it is a flow); kinds are only those in `types.ts`. | Each shape is what the renderer can present meaningfully. | `validation.ts` (`contentBlockShapeProblems`) |
| A parallel flow stage has at most 6 elements. | The renderer lays a parallel set out as columns sized for at most six in the knowledge field (`PARALLEL` in [`exposition-models.tsx`](../../src/components/map/exposition-models.tsx)). | `validation.ts` |
| No duplicate strings within one terms strip, distinction chain, tension list, flow stage or flow branch. | The renderer uses these strings as React keys ([`concept-exposition.tsx`](../../src/components/map/concept-exposition.tsx), `exposition-models.tsx`), so duplicates collide. The same notion in *different* stages is fine. | `validation.ts` |
| All text is plain: no HTML tags, no markdown syntax (`**`, `__`, backticks, `](`), no line breaks. | Every string is rendered verbatim: markup would show literally and line breaks collapse into spaces. Plain symbols such as `>` or `≠` are fine. | `validation.ts` |
| Placements, parents, ordering, acyclicity and preferred placements resolve; taxonomy has at most two levels below L0. | The context an exposition is shown in must exist. | `validation.ts`; `map.test.ts` tree tests |
| The committed explorer view matches the ontology, including every `hasContent` flag. | `/map` ships the generated view; stale flags would hide or fake exposition. | `explorer-model.test.ts` (run `npm run map:generate`) |
| Explorer rows follow content: each row's `hasContent` is its concept's, and a row is expandable exactly when it has exposition or children. | Adding content changes interaction: a leaf with content becomes expandable at every placement. | `assertRowsFollowContent` and the global rule in [`explorer-model.test.ts`](../../src/components/map/explorer-model.test.ts) |
| Exposition text never enters the client taxonomy view. | Bounded client payload (spec §18). | `explorer-model.test.ts` |
| Authoring tooling is never imported by the runtime. | MAP has no AI or authoring runtime dependency (spec §3). | [`authoring/context.test.ts`](../../src/lib/map/authoring/context.test.ts) |

**Not mechanically checked, by design:** length, tone, block mix, heading
wording, whether terms mirror taxonomy labels, and technical accuracy. There
are no length quotas. The right length depends on the concept and its role,
and a number would reward padding or truncation rather than explanation.

## B. Editorial and semantic review criteria

Review every new or revised exposition against each question. In the report,
state how each was checked, especially where the answer is uncertain.

1. **Conceptual accuracy.** Is every technical claim correct and stated
   under its conditions? Are guarantees stated as conditional where they
   depend on assumptions? The corpus consistently avoids unconditional claims
   of security, correctness or finality.
2. **Correct abstraction level.** Does it do its role's job (see
   [content-architecture.md](content-architecture.md))? L1 synthesizes and
   relates the branch; L2 explains the concept itself.
3. **No parent duplication.** Does it add to the parent's section (shown by
   `map:inspect`) rather than restating its sentences, headings or flows?
4. **No sibling leakage.** Does it stay within its branch, mentioning sibling
   topics only to draw a boundary?
5. **No child pre-emption.** Does it give children only as much as the
   synthesis needs, leaving each child's mechanism and detail to the child?
   Does it relate to children that already have content rather than restate
   them?
6. **Canonical validity across placements.** Read it once in each placement
   `map:inspect` lists. Is it true and self-sufficient in each, including
   leaf placements with nothing beneath? Is it free of positional language
   ("below", "this domain")? Where several placements carry children, does
   it relate their facets without synthesizing one layer, or the union of
   all layers, as the concept's decomposition?
7. **Identity discipline.** Does it describe this concept, not a same-title
   concept or a domain-specific sense of the word? Does it use contextual
   labels only as labels?
8. **Economy.** Does every paragraph and block carry meaning? Are there
   repeated hedges, restated definitions, or throat-clearing?
9. **No artificial template repetition.** Is the structure chosen for this
   concept, rather than cloned from the L0 pattern or from sibling
   expositions? Is a `distinction` there because the conflation is real? Is
   a `flow` there because order or branching matters?
10. **Meaningful progression.** Does each block follow from the one before,
    moving from definition to model to relations, so the exposition reads as
    continuous technical explanation rather than a list of facts?
11. **Representation follows the concept.** Was the form decided from an
    analysis of the concept ([representation-design.md](representation-design.md))?
    Does each structured block show something prose would obscure: an order
    that matters, a branch, a real conflation, forces in tension? Does
    structure the concept clearly has (a process, a lifecycle, a failure path)
    stay buried in paragraphs? An unnecessary structure fails this as much as
    a missing one, and so does a form copied from sibling records. There is
    no quota for any block type.

## Tests for authored content

- **Do not pin authored wording.** Exact phrases, heading lists or block
  sequences make every editorial improvement a test change, and when the
  same agent writes both they verify nothing independent. The many existing
  L0 phrase assertions in `map.test.ts` are legacy protection for the L0
  corpus. Do not extend that pattern to new content.
- **Do assert structural decisions that are intentional and general.** For
  example, if a later decision makes some structure mandatory for a class of
  exposition, express it as one generic invariant over all matching records.
  Do not write per-concept copies.
- **Registration is the per-concept assertion.** Adding the concept to
  `AUTHORED_CONTENT_CONCEPTS` states that its content is intended. The generic
  invariants above then apply to it.
