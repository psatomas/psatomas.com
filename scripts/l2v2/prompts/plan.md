You plan one batch of the MAP L2 campaign (v2) in the repository at the current directory: the ownership group `{{GROUP}}` (slice {{SLICE}}), concepts {{CONCEPTS}}.

Read, and nothing beyond what they point to unless a question stays open:
1. {{RULES}} and {{RUBRIC}}.
2. {{PACK}}: the plan skeleton or existing plan, and each concept's bounded context (placements, the parent sentences that mention it, siblings' and other groups' territory, reservations, hazards). If no group file exists, create it with `npm run -s map:author -- l2 territory {{GROUP}} --write`.
3. The parent's exposition: `npm run map:inspect -- <parent>`.

Write src/lib/map/authoring/l2/groups/{{GROUP}}.json (only this file): the plan (claims, excludes, reservations, splits) and, for every owned concept, `concepts.<id> = { model, design }`.
- Claims are authoring prompts: an inaccurate word in a claim or model becomes a defect in the record. Apply the rubric to every claim and model statement (conditions, overclaims, formal results, examples).
- For each claim, the model must make the mechanism, its conditions and its failure or confusion explicit (in `fields`), so the draft can explain all three.
- Decide each design from the concept's own structure; prose is the default.
- If a hazard pair has no defensible split, or a concept's meaning differs across placements, do not invent one: write `STOP: <reason>` as your final message.

Then run `npm run -s map:author -- l2 check --group {{GROUP}}` until it reports no problem for this group. Do not draft records. End with a one-line summary.
