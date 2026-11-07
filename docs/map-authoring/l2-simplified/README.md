# L2 simplified pipeline

The agent instructions for slices started with `npm run map:author -- l2 start --slice <id> --pipeline simplified`
(version 2, the current one) or `--pipeline simplified@1` (version 1). Version 2 runs each group drafts-first and
records audits from the auditors' submitted findings: read [v2.md](v2.md) with each step's instructions.
A driver reads the run's state from `l2 next --json`, whose contract is [orchestration.md](orchestration.md).
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
- 2 (2026-11-05): group-batched ([v2.md](v2.md)). Each group drafts every owned concept before any first audit, so
  both independent first auditors see every sibling's record; auditors submit immutable, structured findings
  (`l2 submit-audit`) and only the orchestrator records them, so a group's audits can run concurrently; overlap
  neighbours add the member's exclusions and the authored concepts its record names; `l2 repair-diff` shows what a
  repair changed. Unchanged: both first audits, repair limits and exceptions, signal coverage, fingerprints, group
  audits, budget, drift and every gate. Version 1 runs keep their order and contract.
  Maintenance (2026-11-07, after the first v2 pilot): a reopened concept keeps its own findings with their source
  artifacts (`l2 repair-findings`), readable after a sibling's repair and never current evidence; a re-auditor is
  given exactly those findings and submits a verification of each; `l2 findings` withholds first audits until both
  are in; the tooling prints every agent's prompt, and agents report back in one to three lines. Cycles opened before
  it carry no evidence and run as before.
