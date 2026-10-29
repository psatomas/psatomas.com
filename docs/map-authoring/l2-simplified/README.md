# L2 simplified pipeline, version 1

The agent instructions for slices started with `npm run map:author -- l2 start --slice <id> --pipeline simplified`.
The mode, its version and its routing are defined in
[`pipeline.ts`](../../../src/lib/map/authoring/l2/pipeline.ts); the procedure is
[`l2-authoring.md`](../l2-authoring.md), "Pipeline modes". These files are the instructions for version 1. A change
to them that changes what an agent does is a new version: add the version in `pipeline.ts` and say what changed
below.

| Step | Instructions | Default model |
|---|---|---|
| territory plan (topic-label claims), per group | [plan.md](plan.md) | opus |
| drafting, per concept | [author.md](author.md) | opus |
| first audits A and B, per concept, independent | [audit.md](audit.md) | opus |
| repair, per reopened concept | [repair.md](repair.md) | opus |
| scoped re-audit | [audit.md](audit.md), "Re-audit" | opus |
| group audit, per group | [group-audit.md](group-audit.md) | opus |

Every agent reads [common.md](common.md) first. `l2 status` prints the run's routing; `--routing role=model,...` at
`l2 start` overrides it (roles: plan, author, first-audit, repair, re-audit, group-audit). The Opus default is the
pilot's choice, not a finding that one model suits every role.

What differs from the legacy pipeline:

- Plan claims are topic labels: one short phrase naming a question the concept must explain, asserting nothing.
  `l2 check` refuses claims with the mechanical signs of an assertion (pipeline.ts `topicLabelProblems`).
- No concept model and no representation design is written or recorded. The author decides the representation
  under representation-design.md, and the audits judge it there.
- Everything else is unchanged: two independent first audits, audit records bound to record fingerprints, territory
  (excludes, splits, reservations), group audits, repair accounting and limits, the gates and the guarded merge.

## Versions

- 1 (2026-10-29): first version, from the campaign prompts of computation-execution-2 and the pipeline benchmark of
  2026-10-28/29 (arm C).
