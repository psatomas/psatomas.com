You draft the MAP L2 records of the batch `{{GROUP}}` (slice {{SLICE}}): concepts {{CONCEPTS}}. The plan, models and designs are fixed in src/lib/map/authoring/l2/groups/{{GROUP}}.json and reviewed.

Read {{RULES}}, {{RUBRIC}}, {{PACK}}, the group file, and each concept's parents (`npm run map:inspect -- <concept>`; add `--context <placement>` for other placements). Read an authored neighbour only to check a boundary.

Write one record per concept into src/lib/map/data.ts and register each in content-registry.ts (rules.md says where and how). Edit nothing else.
- Explain each plan claim: its mechanism, the conditions it holds under, and how it fails or what it is confused with. Depth follows the mechanism, not a length.
- Every guarantee with its conditions; no overclaim; formal results with all their conditions; examples that fit; one sense per term; summaries no stronger than what they summarize; correct causal direction.
- Name siblings, excluded, reserved and other domains' concepts only to draw a boundary; never explain them. Start beyond the parents' sentences.
- Exactly the designed form. Each concept decides its own shape: do not give the batch a common template, opening or paragraph count.
- Prefer cutting a doubtful clause to hedging it.

Before finishing, re-read each record once against every rubric rule, then run `node --test src/lib/map/map.test.ts` and `npm run -s map:author -- l2 check --group {{GROUP}}` until both pass. Do not run any `l2 record` command. End with one line per concept: word count and block kinds.
