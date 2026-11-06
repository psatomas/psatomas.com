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

  A command the view lists can still refuse, and a refusal is final for that view: read the view again.
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
| `blockers` | What stops work, each with `code`, `subject`, `actor` (`human` or `driver`), `detail` and usually a `command` |
| `permitted` | The operation names a driver may perform now, sorted |
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
| `tool-stages` | Content is recorded; `l2 run` performs the validation, commit, push, PR and CI stages |
| `awaiting-merge` | The validated PR waits for a human merge (and the merge stage without an unrevoked authorization) |
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
| `blocked` | It needs a human: an interrupted attempt, an invalid or inconsistent artifact, a repair limit, the budget, the hook, the pilot checkpoint, a stop, or the run's stage |
| `stale` | Recorded, but bound to records that have since changed: never current evidence |

Order is the pipeline's own: plans first, then for version 2 each group drafts every concept in turn, then its
concept audits, which may run concurrently but are recorded in order, then its group audit, and then the next
group. Legacy and version 1 runs keep their order and their `--audit-file` contract.

**Units** are the model-driven pieces of a step: one per draft, plan or design, one per independent auditor (A and B
for first audits, R for a re-audit, G for a group audit). Each unit gives its `role`, `auditor`, current `attempt`
(id and status, in tracked runs), whether its `output` is `present`, and what it `expects`:
- `record`: a draft of the concept in data.ts;
- `findings`: the auditor's private inbox file and the `submit-audit` command;
- `audit-file`: version 1 and legacy audits;
- `plan`: the group file;
- `design`: the concept's design.

**Operations** have `op`, `actor`, `paid`, and a `command` or, for a launch, the `task` description that carries the
attempt's marker:

| `op` | Paid | Command |
|---|---|---|
| `author-plan`, `author-design` | yes | Writes the territory plan or design (`l2 territory .. --write`, `l2 context ..`) |
| `run-agent` | yes | Untracked runs: an agent drafts or audits from the given command's context or prompt |
| `begin-attempt` | no | Tracked runs: `l2 attempt begin ..` or `l2 audit-task ..`, which persists the attempt's inputs and prints its task |
| `launch-agent` | yes | Launches the begun attempt's agent with `task`, through the budget hook (or `l2 attempt launch <id> --ref <ref>`) |
| `record-step` | no | `l2 record ..`: recording is validated as always |
| `reopen` | no | `l2 reopen <ids> --from-findings` on blocking findings; it counts a repair cycle |
| `reconcile` | no | `l2 reconcile`: moves attempts as their durable evidence requires |

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

Each stale step is a `stale-audit` or `stale-draft` blocker for a human, with its resolution:
- **`reopen`:** its own record (or a group member's) changed; repair and re-audit it with `l2 reopen ..`.
- **`re-audit`:** only bound neighbours or members changed; the auditors judge it again (`l2 audit-task ..`, then
  `l2 record audit ..`).

Completing a recovered commit never makes its audit current: the view judges it like any other recorded audit.

## Batches

A batch is one run: whole groups of a slice, in the slice's order, with at most 12 concepts.
- `l2 batches` packs the remaining groups greedily into consecutive batches. Groups an open or unintegrated run
  holds (`claimed`) and groups already integrated are left out.
- A group of more than 12 concepts is never split. It is planned alone, with a problem.
- Each batch gives its `l2 start --slice .. --groups ..` command.
- `startable` is false while any run of the slice is open or unintegrated, since a slice's runs start one at a time.
- The driver view reports a run larger than 12 concepts as a `batch-too-large` blocker: a driver must not drive it.
  A human can, as before.

## Consuming the view safely

1. Run `l2 next --json`. Refuse an unknown `schema` or `version`, and stop on a non-zero exit.
2. If `state` is `recovery-required`, run its operation and start again. Never act on anything else first.
3. Never perform a `human` blocker's command, or anything not in `permitted`. Merging, resuming a stop, deciding an
   interrupted attempt, releasing a hold, changing the cap and clearing a checkpoint are always a human's.
4. Perform one operation at a time, from an `actionable` step or `operations`. Then read the view again; never act
   on a stale copy of it. Concurrent operations are safe only where the view lists them at once (the concept audits
   of one group), and each still goes through its own lock and gate.
5. Paid operations (`paid: true`) start model work and reserve budget through the hook. While
   `governance.paidExecution` is `attended-only`, a driver performs them only with a human present. Unattended
   paid execution stays disabled until reservation reconciliation and release semantics have been reviewed.
6. Treat every `stale` step as not done, whatever the run state says, until it is reopened or re-audited.
7. When `waiting`, run `reconcile` (when permitted) or wait. Never relaunch: a relaunch is a human's decision.
