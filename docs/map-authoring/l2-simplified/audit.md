# Step: independent concept audit of ONE drafted L2 record (simplified pipeline v1, fresh bounded context)

First read common.md and follow it.

You are an independent auditor. You did not write the record and you never edit it. The tooling records drafting
once; any change is a counted repair the orchestrator opens with `l2 reopen` on your blocking findings. Severity is
defined in docs/map-authoring/l2-authoring.md, "Finding severity". Your task says whether this is a FIRST audit or
a RE-AUDIT, and whether you are auditor A (records a pass) or the second-opinion auditor B.

## Read (bounded)
- docs/map-authoring/quality-contract.md §B (all 12 criteria).
- docs/map-authoring/content-architecture.md: the L2 role, one exposition across placements, the block table.
- docs/map-authoring/representation-design.md: "Structures, and where each fits", "Choosing among the structured blocks".
- docs/map-authoring/l2-authoring.md: "Finding severity", "Signals", "Depth", "Territory precedents", "Repairs".
- src/lib/map/types.ts, for block shapes.
- `npm run map:author -- l2 context <concept>`, including its hazards and facet watch.
- The record: `npm run map:inspect -- <concept>`, and `--context <placement-id>` for every other placement. Read
  parent records in full where needed. Read authored sibling or hazard-partner records only to check boundaries.
- `npm run map:author -- l2 signals <concept>`.
There is no concept model or design: the plan's topic labels are the territory, and the record is judged as written.

## First audit: complete, in one pass
Read EVERY sentence against the criteria and list every blocking finding at once.

## Re-audit: a scoped re-review
The task names the findings the repair answered.
1. Confirm each blocking finding is resolved.
2. Re-read every changed statement, its paragraph and the labels that depend on it; every other use of a term the
   repair changed or narrowed; anything the repair introduced.
3. Expand into a complete audit when the repair changed the argument, its assumptions, the record's structure or
   its scope, and say so.
4. A material defect anywhere is still blocking. Non-material defects in untouched text are advisory.

## Judge each finding against these criteria
1. Accuracy: every technical claim correct, and conditional where it depends on assumptions; every general
   statement scoped; no overclaims; examples fit their category; one term, one sense; summaries consistent with
   what they summarize; no unsupported facts (doubt about a material claim is BLOCKING); the definition against
   every paragraph; causal direction as well as truth.
2. Parent overlap: a sentence that restates a parent's or the domain's sentence about this concept.
3. Territory: a sibling's label, an excluded concept or a reservation explained rather than named, including by
   paraphrase; content outside this concept's labels; a hazard split crossed; a label left unexplained.
4. Representation: judged under representation-design.md, since no design was recorded. A structured block must
   show what prose would obscure, be accurate in every cell for every case its row names, and not be spelled out by
   the prose beside it; prose must not hide an order, conflation or comparison a structure would show plainly. An
   unnecessary structure is as much a defect as a missing one.
5. Canonical validity at every placement: no positional or time-sensitive words; identity; American English; plain text.
6. Economy and depth: a point made twice, setup that announces, a conclusion that repeats, background the labels
   do not need; or a label named but not explained. Length alone is never a finding.

## Classify each finding
- BLOCKING: a technically false or materially misleading claim; a missing condition that makes a statement wrong;
  a contradiction; an unsupported claim the explanation depends on; a violation of ownership, parent context or
  territory; an example that misrepresents the mechanism; a structure that misrepresents what it compares.
- ADVISORY: a wording improvement that changes no claim; a stylistic preference; minor redundancy; an optional
  clarification.

## Decide
- PASS (no blocking finding), auditor A:
  1. Write WORK/audits/<concept>.json as `{ "note": "...", "resolutions": [ { "id": "<signal id exactly as printed>", "resolution": "<how judged, concretely>" }, ... ] }`,
     with one resolution for EVERY signal `l2 signals` prints. The note says what you checked (overlap per
     placement, territory and splits, representation, accuracy and depth) and ends with "Advisory:" and each
     advisory finding, or "Advisory: none".
  2. Run `npm run map:author -- l2 record audit <concept> --audit-file <that file>`. Report any failure.
- FAIL (one or more blocking findings): do NOT record. Write WORK/findings/<concept>.md (or the name your task gives).
  - List the BLOCKING findings first. For each give the criterion, the exact sentence (quoted), why it is wrong,
    and the proposed fix within the accepted territory. Proposed replacement wording is welcome; check it against
    the record's conditioned sentences before writing it, since copied fix text is a known source of new defects.
  - Then list the ADVISORY findings, one line each.
  - Say explicitly if a fix would need the territory changed or a label reworded.

## Second-opinion mode (auditor B)
Same severity rules; you never record. On PASS, write nothing and report PASS with your advisory findings. On FAIL,
write WORK/findings/<concept>-b.md in the same format. Do not coordinate with auditor A.

## Report back (at most 8 lines)
PASS or FAIL; each blocking finding, one line each; the number of advisory findings; for a pass, whether
`l2 record audit` succeeded; for a re-audit, whether you expanded; any real weakness in the tooling or plan.
