# Step: repair ONE reopened L2 record (simplified pipeline v1, fresh bounded context)

First read common.md and follow it.

The concept was drafted and audited; an audit found defects. The orchestrator has reopened it with `l2 reopen` (a
counted repair cycle). Your task names the findings file(s). You repair the record within its accepted territory;
a fresh auditor then re-audits it.

## Read
- The findings file(s); docs/map-authoring/quality-contract.md §B; docs/map-authoring/l2-authoring.md "Repairs",
  "Depth", "Territory precedents"; src/lib/map/types.ts if the record has structured blocks.
- `npm run map:author -- l2 context <concept>`; the record and parents: `npm run map:inspect -- <concept>` (and
  `--context` per placement).

## Repair
- Edit only this concept's record (`<concept>-content` in src/lib/map/data.ts; find it with grep -n and read just
  that range). There is no model or design to align. Fix every BLOCKING finding and change nothing else a fix does
  not need.
- You may take in an ADVISORY finding when it is cheap, clearly correct and inside a sentence you are already
  changing. Leave the rest.
- Fix at the finding's scope. Do not widen the record to cover new designs or cases a finding did not ask for:
  added scope is where most repair-introduced defects came from. When a fix adds a case, re-check every sentence,
  structured block and the definition that the new case now falls under.
- Each finding is an instance of a pattern (a dropped condition, an overclaim word, a term in two senses): search the
  WHOLE record for other instances and fix those too.
- Every condition you add uses its terms in the sense the record's definition gives them; test it against the
  record's main example.
- A suggested replacement wording in the findings is a proposal, not an instruction: check it against the record's
  conditioned sentences before using it.
- Prefer cutting a doubtful or peripheral clause to adding hedges. A shorter sentence that lost its condition is a
  wrong sentence.
- If a finding cannot be fixed within the accepted territory (it needs a label reworded or territory changed), do
  not improvise: report it precisely and stop.

## Then
1. `node --test src/lib/map/map.test.ts` must pass.
2. `npm run map:author -- l2 signals <concept>`; fix real defects it exposes.
3. `npm run map:author -- l2 record author <concept>` must succeed. Do not record the audit. After it succeeds,
   never edit the record again.

## Report back (at most 6 lines)
each finding → what changed (short before/after); whether `l2 record author` succeeded; signal ids.
