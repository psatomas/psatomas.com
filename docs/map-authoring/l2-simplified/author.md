# Step: draft ONE L2 record (simplified pipeline v1, fresh bounded context)

First read common.md and follow it.

You are the author of one L2 exposition record. The territory plan is recorded; its claims are topic labels that
name what to explain and assert nothing, so the accuracy of every statement is yours. There is no concept model and
no representation design: you decide the form. Steps are recorded in order, so you are the only writer of data.ts.

## Edit only
1. src/lib/map/data.ts: add ONE record to `mapKnowledge.content`, appended as the last element of the content
   array (immediately before the line `  ],` that precedes `  mechanisms: [`).
2. src/lib/map/authoring/content-registry.ts: append the concept id as the last entry of `AUTHORED_CONTENT_CONCEPTS`.
Never edit the group file, any other record, taxonomy, tests or tooling. If an unrelated test fails, stop and report.

## Read first (bounded)
1. docs/map-authoring/content-architecture.md (whole).
2. docs/map-authoring/quality-contract.md (A's block-shape rules and all of B).
3. docs/map-authoring/representation-design.md: "Structures, and where each fits", "Choosing among the structured blocks".
4. docs/map-authoring/l2-authoring.md: "Context", "Signals", "Depth", "Territory precedents".
5. src/lib/map/types.ts (MapContentBlock and friends) and src/lib/map/validation.ts `contentBlockShapeProblems`.
6. Your context: `npm run map:author -- l2 context <concept>` (claims, excludes, siblings' territory, hazards).
7. The parents' texts: `npm run map:inspect -- <concept>` and, for each other placement, `--context <placement-id>`.
   Read an authored neighbour's record only to check a boundary, never as a stylistic example.

## What to write
`{ id: "<concept>-content", conceptId: "<concept>", definition: "...", body: [ ...blocks ] }`, formatted like the
neighbouring records (4-space record indentation, double quotes, trailing commas).
- Definition: the concept's meaning in one or two sentences, true at every placement. The body never repeats it.
- Explain ONLY the plan's labels, each at the depth its mechanism needs: how it works, the conditions under which
  it holds, how it fails, what it is confused with, an example only where the label needs one. Parent sentences
  that mention the concept are premises: start beyond them.
- Excluded concepts, siblings' labels and reservations may be NAMED to draw a boundary, never explained (not even
  by paraphrase). Hazard splits in the context are binding.
- Form: decide it from the labels under representation-design.md. Prose is the default. Use a structured block
  only where it shows something prose would obscure (an order that matters, a real conflation, forces in tension,
  a loop, alternatives compared on shared dimensions, persistent states), never because the primitive exists. The
  prose must not spell out the block's entries one by one, and every cell must hold for every case its row names.
- One canonical text, true and self-sufficient at every placement. No positional words ("below", "above", "this
  domain", "the following"); no dates, versions or time-sensitive words. Plain text only; words, not symbols.
- Accuracy: state guarantees conditionally where they depend on assumptions. If unsure a technical claim is
  correct, leave it out. Re-read every sentence once purely for overclaims (including lead and summary sentences
  against the conditioned sentences they summarize), once for examples that do not fit their category, once for
  terms used in two senses, and once for a point already made in another paragraph.
- Scope every general statement; name the implementation when a fact holds for one (Ethereum, Solana, ...).
- Depth: no word target and no cap. Keep the mechanism, conditions, failure modes and the hedges that make a claim
  true; cut setup that announces, conclusions that repeat, a point made twice, more examples than the point needs.

## Then
1. `node --test src/lib/map/map.test.ts` must pass (fix only your record).
2. `npm run map:author -- l2 signals <concept>` with the record in place; fix real defects it exposes.
3. `npm run map:author -- l2 record author <concept>`: validates registration, plan and American English,
   regenerates the view and runs focused tests. Drafting is recorded ONCE: after recording, never edit the record
   again, not even to silence a signal (any later change is a counted repair).

## Stop instead of authoring if
the meaning cannot be one text true at every placement; the labels cannot be explained without explaining an
excluded or reserved concept; a parent's text would have to be contradicted; or a label names territory that is
not this concept's. Add nothing and report precisely why.

## Report back (at most 8 lines; do not paste the record)
whether `l2 record author` succeeded; block kinds (each structured block: label and entries in one line) and
paragraph count; word count; the `l2 signals` ids with one-line details; the facts you were least sure of.
