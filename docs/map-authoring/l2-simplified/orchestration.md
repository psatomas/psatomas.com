# L2 orchestration view: `l2 next --json`

`l2 next --json` prints the active L2 run's orchestration view: a compact, versioned JSON document that a driver
(a human orchestrator today; a future automated driver) reads to choose its next command. It is built by
[`orchestration.ts`](../../../src/lib/map/authoring/l2/orchestration.ts) from the persisted run and nothing else.
`l2 batches --slice <id> --json` plans a slice's remaining work as runs of at most 12 concepts.

```bash
npm run map:author -- l2 next --json [--domain <run>]
npm run map:author -- l2 batches --slice <id> [--json] [--pipeline <spec>]
```

Every other form of `l2 next` and `l2 status` prints what it printed before. `l2 status` adds a `STALE` line for a
recorded audit whose bound neighbour or group member changed (its own record's changes were already listed).

## Guarantees

- **Read-only.** `next --json` and `batches` write nothing. They never recover a commit journal (an unrecovered one
  is reported as `recovery-required`), reconcile or begin an attempt, launch an agent, reserve budget, or merge.
  Every other `l2` command recovers a journal on load. Only these two don't.
- **Deterministic.** The same persisted state and repository contents give byte-identical output. The state comes
  from the run state, group files, records, attempt log, published artifacts, budget ledger and the measured session
  transcripts. The output holds no timestamps, random identifiers or clock-dependent verdicts, and every list is in
  a fixed order. For example, whether a running attempt has outlived its 15-minute launch grace is left to
  `l2 reconcile`.
- **No new authority.** The view only reports. Every gate stays enforced by the command that enforces it today:
  - step order and draft-before-audit;
  - independent auditors and immutable artifacts;
  - attempts and the commit journal;
  - repair limits;
  - the budget hook and cap;
  - human-only merging.

  An operation is listed only when its command's state-machine preconditions hold now:
  - the step order, the run's stage and its commits;
  - the attempt's status and whether its inputs are still current;
  - the auditor's role, and draft-before-audit;
  - the repair limit and the budget gate;
  - the output it records being present (a plan file, a design, a draft, or every auditor's artifact with its
    completed attempt).

  Recording still validates content (a plan's territory, a draft's registration and tests, an audit's signal
  coverage) and may refuse what fails it. Git state is checked by the command too. A refusal is final for that view:
  read the view again.
- **Compact.** No prompts, record texts, findings or histories. Each entry carries the command that retrieves the
  details (`details`, and each step's `operations` and `expects`).

## The document (`schema: "map-l2-next"`, `version: 1`)

The version is bumped on any change a consumer could observe: a field renamed, removed or retyped, or a value given
a new meaning. A driver refuses a schema or version it does not know. Fields appear in this order:

| Field | Meaning |
|---|---|
| `schema`, `version` | `"map-l2-next"`, `1` |
| `commandPrefix` | `npm run map:author --`: every `command` is run after it |
| `run` | `id`, `slice`, `stage`, `pipeline {mode, version, batched}`, `tracksAttempts`, `scope` (a partial run's part and groups, or null), `repair` (the open cycle and its concepts, or null), `pr` (number or null) |
| `governance` | `merge`: `human-only` unless an unrevoked human authorization is recorded (`authorized`); `hookRegistered`; `paidExecution: "attended-only"` |
| `details` | Commands for the full picture: `l2 status`, `l2 attempts --json`, `l2 budget --json`, `l2 check --json` |
| `state` | The run's state (below) |
| `batch` | The run's groups and concepts, each group `done`, `stale`, `active` or `pending`; `withinLimit` and `problems` against the 12-concept limit |
| `progress` | `steps` (blocked concepts' steps excluded), `recorded`, `stale`, `remaining` |
| `steps` | Every step not yet recorded, and every recorded step that is stale, in recording order (below) |
| `freshness` | `stale`: recorded steps that no longer describe the records, with reasons. `unbound`: neighbours authored after an audit, which it did not judge |
| `attempts` | Tracked runs: `counts` by status, and every open attempt's `id`, `step` and `status`. Null otherwise |
| `budget` | `capUsd`, `spentUsd`, `reservedUsd`, `heldUsd`, `headroomUsd`, `availableUsd` (to the cent), `openLaunches`, `unknown` (how many reasons spend is unknown), `launchAllowed` by role. Null without a cap |
| `blockers` | What stops work, each with `code`, `subject`, `actor` (below), `detail` and usually a `command` |
| `permitted` | The `driver` operations available now, sorted: everything an unattended driver may do |
| `attended` | The `attended` (paid) operations available now, sorted: only with a human present |
| `operations` | Run-level operations with their commands: `recover-journal`, `reconcile`, `complete-audit`, `run-tool-stages` |

Without a single active run, the document is `{schema, version, commandPrefix, state: "no-run" | "ambiguous", runs,
details}`; with several runs, pass `--domain`. A non-zero exit means no document was printed: the driver stops.

### Run states

| `state` | Meaning |
|---|---|
| `recovery-required` | An interrupted commit's journal is unrecovered. Nothing else is read from the state: `steps` is empty and `batch`, `progress`, `attempts` and `budget` are null. The only operation is `recover-journal` (`l2 reconcile`), which completes the decided commit or refuses and leaves it to a human |
| `stopped` | The run is stopped (a repair limit, a failed stage, ...): a human resolves it with `l2 resume --decision ".."` |
| `actionable` | At least one step, or `complete-audit`, can be acted on now |
| `waiting` | Work is in flight (a running attempt) and nothing else can start |
| `blocked` | Nothing can proceed without a human (see `blockers`) |
| `tool-stages` | Content is recorded and nothing is stale; `l2 run --until ci` performs the validation, commit, push, PR and CI stages, and stops before any merge |
| `awaiting-merge` | The merge stage, or a validated PR: merging is a human's, under a recorded authorization or not |
| `done` | Merged and recorded |

### Steps

Each step: `key` (`plan:g`, `design:c`, `author:c`, `audit:c`, `group-audit:g`), `kind`, `subject`, `group`,
`status`, `dependsOn` (the step that must be recorded before this one can start: the previous step in recording
order, or for a group-batched concept audit the group's last draft), and when relevant `reasons`, `units` and
`operations`.

| `status` | Meaning |
|---|---|
| `actionable` | Its dependencies are recorded and an operation can be performed now |
| `waiting` | Its work is in flight, or it is complete and waits to be recorded after an earlier step |
| `pending` | A step it depends on is not recorded yet |
| `blocked` | It needs a human: an interrupted attempt, an attempt whose inputs changed, an invalid or inconsistent artifact or one its attempt does not account for, a repair limit, the budget, the hook, the pilot checkpoint, a stop, the run's stage, the batch limit, or (for an audit) a draft changed outside a repair |
| `stale` | Recorded, but bound to records that have since changed: never current evidence |

Order is the pipeline's own: plans first, then for version 2 each group drafts every concept in turn, then its
concept audits, which may run concurrently but are recorded in order, then its group audit, and then the next
group. Legacy and version 1 runs keep their order and their `--audit-file` contract.

**Units** are the model-driven pieces of a step: one per draft, plan or design, one per independent auditor (A and B
for first audits, R for a re-audit, G for a group audit). Each unit gives its `role`, `auditor`, current `attempt`
(id and status, in tracked runs), whether its `output` is `present`, and what it `expects`, with the command that
records it once present:
- `record`: a draft of the concept in data.ts;
- `findings`: the auditor's private inbox file and the `submit-audit` command;
- `audit-file`: version 1 and legacy audits;
- `plan`: the group file;
- `design`: the concept's design.

**Operations** have `op`, `actor`, `paid`, and a `command` or, for a launch, the `task` description that carries the
attempt's marker. There are three actors:
- **`driver`:** deterministic remediation that starts no model work and decides nothing a human must.
- **`attended`:** paid model work. A driver performs it only with a human present while `governance.paidExecution`
  is `attended-only`, which it is until reservation reconciliation and release semantics have been reviewed.
- **`human`:** a judgment.

`paid` is true exactly for `attended` operations.

| `op` | Actor | When and what |
|---|---|---|
| `author-plan`, `author-design` | attended | No plan file, or no design, yet: the orchestrator writes it (`l2 territory .. --write`, `l2 context ..`) |
| `run-agent` | attended | Untracked runs only: an agent drafts or audits from the command's context or prompt |
| `begin-attempt` | driver | Tracked runs, no open attempt for the unit: `l2 attempt begin ..` or `l2 audit-task ..` persists its inputs and prints its task |
| `launch-agent` | attended | A pending attempt for the current inputs: launch its agent with `task`, through the budget hook |
| `record-step` | driver | Its output is present, and in tracked runs its attempt is launched (a draft) or completed (every auditor) for the current inputs: `l2 record ..` |
| `reopen` | driver | Blocking findings under the repair limit: `l2 reopen <ids> --from-findings` (a counted repair cycle; at the limit it is a human's) |
| `reconcile` | driver | An attempt in flight, or one whose inputs changed: `l2 reconcile` moves it as its durable evidence requires |
| `complete-audit` | driver | Every step recorded, at stage `audit`, nothing stale |
| `run-tool-stages` | driver | Content recorded, nothing stale: `l2 run --until ci`, never the merge stage |
| `recover-journal` | driver | An unrecovered journal: `l2 reconcile` |

No operation for a driver or an attended session merges, resumes a stop, decides an interrupted attempt, fails an
attempt, releases a hold or reservation, changes the cap, clears a checkpoint, or launches outside attempt tracking
in a tracked run. Those appear only as `human` blockers.

## Freshness

A recorded step is stale when what it was bound to has changed:
- **A draft:** its own record changed outside a repair (`record-changed`).
- **A concept audit:** its own record changed (`record-changed`), or a neighbour's record it was bound to changed
  (`neighbour-changed`) or is no longer one of its neighbours or no longer exists (`neighbour-removed`). An audit
  recorded before neighbours were bound covers only its own record, as when it was validated.
- **A group audit:** an owned member's record changed, or a member was added or removed (`member-changed`,
  `member-added`, `member-removed`).

A neighbour authored after a concept audit is listed under `unbound`, not stale. That audit never judged it; the
overlap between the two is judged by the newer record's own audit, which binds both, and `l2 check` verifies it.

Each stale step is a `stale-audit` or `stale-draft` blocker. Its resolution is the one the run's rules allow now:
- **`re-audit` (attended):** only bound neighbours or members changed, and the audit may still be replaced. For a
  concept audit that means while the run drafts or audits, or validates before its first commit (or within an open
  repair). For a group audit, only while the run drafts or audits. The auditors judge it again
  (`l2 audit-task ..`, then `l2 record ..`). `after` names an earlier step that must be recorded first.
- **`reopen` (human):** its own record (or a group member's) changed, or its audit can no longer be replaced: the run
  has commits, or it is past the stages that record audits. A human reopens it with a reason (a counted repair
  cycle).
- **`repair-run` (human):** the run is merging or merged; a human repairs it in a repair run once it is merged.

A pending audit of a concept whose draft is stale is blocked: recording it refuses until the draft is reopened.
While anything is stale, neither `complete-audit` nor the tool stages are offered, because the l2-check gate would
refuse them.

Completing a recovered commit never makes its audit current: the view judges it like any other recorded audit.

## Batches

A batch is one run: whole groups of a slice, in the slice's order, with at most 12 concepts.
- `l2 batches` packs the remaining groups greedily into consecutive batches. Groups an open or unintegrated run
  holds (`claimed`) and groups already integrated are left out.
- A group of more than 12 concepts is never split and never batched: it is listed under `unbatchable`, and it closes
  the batch before it, so batches stay consecutive.
- Each batch gives its `l2 start --slice .. --groups ..` command.
- `startable` is false while any run of the slice is open or unintegrated, since a slice's runs start one at a time.

**Enforcement.** A new group-batched (simplified version 2) run, partial, full-slice, pilot or repair, holds at most
12 concepts:
- `l2 start` refuses a larger one before any branch is made, and run creation refuses it again.
- The run records the limit it was started under (`batch.maxConcepts`).
- Before any attempt begins (`attempt begin`, `audit-task`), the CLI checks that the run still satisfies it. Every
  tracked model launch starts there, so a state edited past the limit launches nothing.
- The view reports any run past the limit as a `batch-too-large` blocker and offers nothing.

Legacy and version 1 runs, and runs started before the limit, are not limited and keep their behaviour.

## Consuming the view safely

1. Run `l2 next --json`. Refuse an unknown `schema` or `version`, and stop on a non-zero exit.
2. If `state` is `recovery-required`, run its operation and start again. Never act on anything else first.
3. Unattended, perform only what `permitted` lists. Perform `attended` operations only with a human present. Never
   perform a `human` blocker's command. Merging, resuming a stop, deciding or failing an attempt, releasing a hold,
   changing the cap and clearing a checkpoint are always a human's.
4. Perform one operation at a time, from an `actionable` step or `operations`. Then read the view again; never act
   on a stale copy of it. Concurrent operations are safe only where the view lists them at once (the concept audits
   of one group), and each still goes through its own lock and gate.
5. Paid operations (`paid: true`) start model work and reserve budget through the hook. While
   `governance.paidExecution` is `attended-only`, a driver performs them only with a human present. Unattended
   paid execution stays disabled until reservation reconciliation and release semantics have been reviewed.
6. Treat every `stale` step as not done, whatever the run state says, until it is reopened or re-audited as its
   resolution says.
7. When `waiting`, run `reconcile` (when permitted) or wait. Never relaunch: a relaunch is a human's decision.
