# L2 authoring pipeline v2

v1 ([l2-authoring.md](l2-authoring.md)) authored one concept at a time with a fresh
agent per step under a long-lived orchestrating conversation. It cost about 2.3 M
weighted tokens per accepted concept. v2 keeps v1's contracts, validators, run
state, gates and delivery, and replaces only how the content is produced:

- **Batches:** one ownership group (2–8 concepts) per batch.
- **A deterministic driver** (`scripts/map-l2v2.ts`) in place of an LLM
  orchestrator.
- **Bounded headless sessions** (`claude -p`), each with a written role.

## Quality policy

- **Nothing ships with a known unresolved substantive defect.**
- **Every defect is tracked.** It gets a stable id in the batch's defect
  ledger and closes only as **verified** (an applied repair the reviewer
  confirms) or **withdrawn** (with a written reason).
- **A refused repair can never be confirmed.** A repair whose quote does not
  match exactly once is refused, and only a superseding finding or a
  withdrawal can close it.
- **Unresolved concepts are parked.** A concept with any open defect after the
  verified repair rounds is parked: its draft leaves the tree and the batch
  stops for a human.
- **Reviews are independent.** The plan review and the batch review run in
  sessions that wrote nothing being reviewed. Escalated concepts get a second,
  independent review.
- **Plan-review claim fixes are verified** before drafting.
- **Acceptance re-checks the evidence:**
  - no open defect;
  - full claim coverage at the last review;
  - confidence not low;
  - the second review done for every escalated concept;
  - every signal resolved.
- **A defect verdict must name its defects.**
- **Sampling measures, it never authorizes.** A defect found by a deep audit is
  repaired and verified like any other.

The rubric is [`scripts/l2v2/prompts/rubric.md`](../../scripts/l2v2/prompts/rubric.md),
distilled from the Foundations audits.

## A batch

| Status | Session | Checks between sessions |
|---|---|---|
| pending → planned | **plan**: claims, excludes, splits, models, designs in the group file (the driver creates the skeleton) | `l2 check --group`; one fix round, else rolled back |
| planned → plan-reviewed | **plan-review** (independent); claim fixes applied exactly, then verified in the resumed session | `l2 check`; an unconfirmed fix is rolled back |
| plan-reviewed → drafted | **draft**: every record of the batch in `data.ts` plus registry | generate, `l2 check`, focused tests; each record and entry exactly once; else rolled back |
| drafted → reviewed | **review** (independent, side by side) | repairs applied exactly; the resumed reviewer answers every defect id; at most 2 rounds |
| reviewed → escalated | **escalate**: a second independent review of escalated concepts | the same repair and verification loop |
| escalated → accepted | — | the acceptance gates; v1 audit files written; parked concepts removed |

**Escalation triggers:**
- confidence below high;
- 3 or more defects;
- a defect in conditions, a formal result or the definition;
- an uncertain finding;
- a claim touching another domain's concept;
- a corrected plan claim;
- more than one placement;
- an emerging domain;
- a claim not fully covered.

## Safeguards

- **Session permissions:** `--permission-mode dontAsk` with explicit allowed
  tools (`allowedTools` in [`core.ts`](../../src/lib/map/authoring/l2v2/core.ts)).
  - Every role may Read, and may run only `l2 context`, `l2 territory <group>`,
    `l2 signals`, `l2 group-signals <group>` and `map:inspect`.
  - Only plan and draft sessions may also run `l2 check --group <group>` and
    the map tests.
  - The plan session may edit only its group file; the draft session only
    `data.ts` and the registry; reviewers may write only their output files.
  - No session may record, authorize, reopen, run delivery, write territory,
    use git or run arbitrary code.

  These permissions are defense in depth; the integrity guard below is the
  boundary.
- **Integrity guard and rollback:**
  - Before every session, the driver snapshots every changed or untracked file
    plus `data.ts`, the registry and the group file.
  - Afterwards, any change outside the role's allowed files is a violation:
    tests, tooling, other groups, created or deleted files, and in `data.ts`
    anything outside the batch's own records (taxonomy, placements, other
    records).
  - On a violation, a failed session or a failed validation, exactly the
    changes made since the snapshot are restored: pre-existing user changes
    come back as they were, and files the session created are removed.
  - If a restore fails, the batch stops for manual recovery.
  - Nothing ever resets or cleans the repository.
- **Output files carry the session's run token.** Each output is deleted
  before its session runs and must contain the token the driver generated, so
  a stale or foreign file is never consumed.
- **Partly authored v1 slices:**
  - v2 authors only groups with no v1 step recorded.
  - Groups v1 finished are skipped.
  - Groups with some steps recorded are refused, for a human to decide.
  - Concepts registered at the base or drafted or audited in the v1 run are
    protected, and the driver refuses a batch that includes one.
- **Resume never skips forward:** `resume --at` accepts the status the batch
  stopped at or an earlier one, and the later stages run again. Accepting a
  batch through `resume` is refused.
- **One driver per checkout:** a lock in `.map-authoring/l2v2/lock`. A lock
  left by a dead process is reported, never stolen.
- **Session execution:**
  - A timeout (default 30 minutes) kills the session.
  - Failures (timeout, non-zero exit, no JSON, an error result, a usage
    limit) are recorded as `session-failed` with no usage; usage the CLI did
    not report stays unknown, never zero.
  - The model is explicit (`config.json`, default `claude-opus-5-5`); an
    optional `maxBudgetUsd` limits spend per session.
  - The CLI has no turn limit; the timeout bounds sessions instead.

## Delivery

v2 runs inside a v1 slice run and delivers through it:

1. `npm run map:author -- l2 start --slice <id>`: v1's start safeguards and
   branch.
2. `npm run map:l2v2 -- run --slice <id> [--groups ..]`: the batches.
3. `npm run map:l2v2 -- audit --sample-slice <id>`: the measurement sample
   (4 per slice by default), drawn deterministically from the slice id. A
   defect found is repaired exactly, verified by the auditor's resumed session
   and re-accepted through the gates, or parked.
4. `npm run map:l2v2 -- finalize --slice <id>`:
   - refuses unless every v2 batch is accepted and the sample is settled;
   - records the v1 steps in v1's order, every command with `--domain <id>`,
     so it works while another run (such as the paused `foundations-1`)
     exists;
   - runs `l2 complete audit` and `l2 run --until diff`.
5. `npm run map:author -- l2 run --domain <id>`: commit, push, PR, CI and
   merge under the recorded campaign authorization. v2 itself never pushes or
   merges.

**Repairing content after a deep audit:**
- `audit --fix --slice <id>` repairs only accepted, not yet finalized v2
  concepts, through the same verified loop.
- Recorded or protected records need a controlled v1 revision (`l2 reopen`).
- Baselines read at a commit (`--ref`) are measured and never fixed.

## Cost measurement and stop rules

`.map-authoring/l2v2/ledger.jsonl` records:
- every session's usage as the CLI reported it (**measured**);
- failed sessions;
- batch outcomes;
- deep audits, with campaign and baseline audits kept apart;
- readings of the usage meter (`meter --percent <n>`, **measured**).

The weighting is **assumed**: input 1, cache read 0.1, cache write 1.25,
output 5. `report` prints it all.

**Stop rules** (defaults in `DEFAULT_BUDGET`, overridable in `budget.json`):
- the last 3 batches average more than 1.3 × 122 k weighted per accepted
  concept;
- escalation runs above 40%, once there are at least 10 concepts;
- any parked concept;
- 8 or more of the last 20 **campaign** audits have substantive defects
  (baselines never count);
- within one weekly window, the meter rises more than 0.109% per accepted
  concept (use 0.163% for 3 weeks). A drop in the reading marks a weekly
  reset.

## Calibration pilot (before scaling)

The pilot is about 12 concepts in Computation & Execution, plus 6 Foundations
records as a baseline.

1. Read the meter: `meter --percent <n>`.
2. Start the slice with `l2 start`, then run `run --slice <id> --groups <g1,g2,g3>`.
3. Read the meter again.
4. Deep-audit every pilot concept:
   `audit --label pilot --concepts <ids> --slice <id> --fix`.
5. Deep-audit the baseline from the checkpoint, with its plan and accepted work
   as of that commit:
   `audit --label baseline --ref refs/checkpoints/l2-foundations-1-2026-10-08 --concepts <6 ids>`.
6. Compare: `report`.

**Pass only if all hold:**
- pilot substantive defects per concept ≤ max(0.2, 1.5 × the baseline);
- every pilot defect found is repaired and verified;
- zero territory leaks;
- every claim fully covered;
- meter cost per accepted concept within the plan;
- nothing parked, or each parked concept explained.

Scale only after a pass.
