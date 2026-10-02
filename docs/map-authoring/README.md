# MAP content authoring

The entry point for any agent or person who authors or revises MAP canonical
concept exposition: the `mapKnowledge.content` records in
[`src/lib/map/data.ts`](../../src/lib/map/data.ts).

This is repository tooling and method. It is not part of MAP's product
runtime. MAP stays static typed data rendered without any LLM, retrieval,
embedding, or agent dependency ([spec §3](../map-spec.md#3-non-goals)).
Nothing in `src/app` or `src/components` may import the authoring tooling, and
a unit test enforces that.

## Canonical sources

Read these before authoring. If they disagree, the earlier source wins.

1. [`docs/map-spec.md`](../map-spec.md) is the MAP architecture. The sections that
   matter most here are §6 (principles), §8 (identity), §9 (placements),
   §11 (content), §15 (explorer) and §22 (validation).
2. [`content-architecture.md`](content-architecture.md) says what exposition at
   each taxonomy role is responsible for, and how one canonical exposition
   serves several placements.
3. [`authoring-workflow.md`](authoring-workflow.md) is the step-by-step loop,
   including when to stop and ask.
4. [`quality-contract.md`](quality-contract.md) lists what code enforces and what
   review must judge.
5. [`representation-design.md`](representation-design.md) is how an exposition's
   form is chosen (analysis, concept model, representation design) and the
   read-only representation audit.
6. [`l2-analysis.md`](l2-analysis.md) is the read-only L2 analysis and the
   proposed L2 authoring architecture. It is a proposal, not yet a
   procedure; `npm run map:l2` prints the L2 inventory it is based on.
   [`l2-content-scale.md`](l2-content-scale.md) measures whether the content
   architecture carries full L2, and records the decision (OPTIMIZE).
7. The code is the ground truth for shapes and rules:
   [`types.ts`](../../src/lib/map/types.ts) (content blocks),
   [`validation.ts`](../../src/lib/map/validation.ts) (structural rules),
   [`concept-exposition.tsx`](../../src/components/map/concept-exposition.tsx) and
   [`exposition-models.tsx`](../../src/components/map/exposition-models.tsx)
   (rendering).

## Identity and placement in one paragraph

A **concept** is one canonical identity (`id` equals `slug`). A **placement**
is one pedagogical appearance of it in the taxonomy forest. Level is not a
property of a concept: it is a placement's depth (0 = L0 domain, 1 = L1 topic,
2 = L2 topic), derived from its ancestry. A concept can have several
placements, sometimes at different levels: Protocol Properties is an L1 topic
of Foundations and also an L2 leaf under Protocols. **Content belongs to the
concept.** There is at most one record per concept, and every placement of the
concept opens onto that same exposition. A placement's `contextualLabel`
changes only the wording shown in the explorer, and `preferredPlacementId` is
only presentation policy. Neither creates a second identity or a second
exposition.

## Inspecting a concept

Never author from the whole data file. Inspect the target instead:

```bash
npm run map:inspect -- --domain <l0-domain-id>                  # a domain's L1 topics, in order, with content status
npm run map:inspect -- <concept-id>                             # bounded context from the preferred placement
npm run map:inspect -- <concept-id> --context <placement-id>    # from an explicit placement of that concept
npm run map:inspect -- <concept-id> --json                      # the same context as JSON
```

For one concept, the output reports:

- its canonical content (the full existing exposition, if any);
- every placement, with level, context trail, contextual label or note,
  parent, ordered siblings and ordered children, including which children
  already own content;
- the section of the parent's exposition that covers the primary placement,
  or the whole exposition when the parent has no sections (an L1 parent);
- relationships, mechanisms and knowledge paths that reference the concept;
- other concepts that share its title;
- an **Attention** list of the facts that constrain the writing, such as
  placements at several levels, a preferred placement that is a leaf, or
  existing content.

The command exits non-zero with a clear message for an unknown concept, an
unknown placement, a placement that belongs to another concept, or
structurally invalid MAP data.

## The loop

```text
select bounded target → inspect → derive responsibility → author → check → register
→ map:generate → gates → report
```

The full procedure and its stop conditions are in
[`authoring-workflow.md`](authoring-workflow.md). A whole domain's L1 topics
are authored through [`domain-runbook.md`](domain-runbook.md) and
`npm run map:author`, which carries a run from `main` to a validated PR
awaiting human merge. The gates are:

```bash
npm run map:generate
npm test
npm run lint
npm run build
```

## What not to do

- Do not create placement-specific copies of exposition, or write text that is
  only true in one placement.
- Do not change taxonomy (concepts, placements, labels, preferred placements)
  as part of content work. Taxonomy changes are separate decisions.
- Do not pin authored wording in tests. See
  [`quality-contract.md`](quality-contract.md#tests-for-authored-content).
- Do not add AI, retrieval, CMS or database dependencies to MAP.
