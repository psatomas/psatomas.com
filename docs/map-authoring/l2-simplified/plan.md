# Step: territory plan for ONE ownership group (simplified pipeline v1)

First read common.md and follow it.

You write the territory plan of the group your task names: who owns what among its L2 members, before any concept
is drafted. Plans of other groups in the slice may be written concurrently; the orchestrator records plans in
slice order and messages you if cross-plan checks need a change.

## Read (bounded)
- docs/map-authoring/l2-authoring.md: "Territory plans", "Context", "Depth", "Territory precedents", "Pipeline modes".
- docs/map-authoring/content-architecture.md: the L2 role and "One canonical exposition, many placements".
- docs/map-authoring/quality-contract.md §B criteria 3–7.
- The skeleton: `npm run map:author -- l2 territory <group>`; if no file exists create it with
  `npm run map:author -- l2 territory <group> --write --pipeline simplified` (the file then declares the pipeline).
- The parent: `npm run map:inspect -- <group's parentConceptId>`. Its exposition is a premise: L2 starts beyond it.
- Each member: `npm run map:author -- l2 context <member-id>` (placements, parent sentences that mention it,
  hazards, reservations other groups hold for it, same-title concepts).
- Existing plans that matter: the owner's group file for each owned-elsewhere member, and any reservation other
  plans hold for YOUR owned members (shown in `l2 context`).

## Write into src/lib/map/authoring/l2/groups/<group>.json (only this file; keep basis, members order and "pipeline")
- For each `owned` member: `claims`, as many as the concept needs (usually two to four), as TOPIC LABELS.
  - A topic label is one short phrase (at most 24 words) naming a question only this concept answers in the
    corpus, for example "when acceptance happens and what checking costs on chain".
  - It asserts nothing: no mechanism stated as fact, no conditions, no examples, no "such as" or "for example"
    lists, no colon or semicolon, no parenthetical, no full stop. The author decides what is true; a label that
    asserts is the commonest source of first-audit defects.
  - A label is not a chapter: it names one bounded question. Avoid labels that are a parent's sentence or a
    sibling's subject. Follow the facet watch and hazard notes in `l2 context`.
  `excludes`: concepts this member may name but must not explain (siblings with adjacent territory, hazard
  partners, close concepts in other groups or domains, reserved members). Excluded ids must exist.
- For each `owned-elsewhere` member not yet authored: `reserved`, as claims held for the owner (prefer the
  owner's own claim wording if its plan exists).
- `revisions`: only when this plan narrows a reservation another group made for one of YOUR owned members.
- `splits`: one entry for every hazard pair the skeleton lists, `{ "concepts": [a, b], "split": "<A> owns …; <B> owns …" }`.
  If no defensible split exists, that is a taxonomy question: STOP and report.
- Apply the Territory precedents: classify each overlap as legitimate (divide by angle), reference only, or
  ownership collision (narrow the label and exclude).
- Do not add `concepts` entries: the simplified pipeline keeps no model or design.

## Validate
`npm run map:author -- l2 check --group <group>` must report the plan valid, including the topic-label check. Do
NOT run `l2 record plan`: the orchestrator records plans in order.

## Stop (write nothing more, report precisely) if
membership, identity or a hazard pair has no defensible split; a member's meaning differs incompatibly across
placements; or ownership cannot be decided without changing taxonomy.

## Report back (at most 12 lines)
`l2 check` result; per owned member its label count and one-line gist; reservations; splits; any cross-plan issue,
uncertainty, or stop.
