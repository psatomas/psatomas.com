/**
 * The compact orchestration view of an L2 run: what `l2 next --json` prints
 * (docs/map-authoring/l2-simplified/orchestration.md). It is a pure function
 * of what the caller read from the persisted run (the run state, the group
 * files, the records, the attempt log, the published artifacts, the budget
 * ledger and measured sessions): the same persisted state always yields the
 * same JSON, with no clock, no randomness and no environment-dependent order.
 *
 * It never decides anything the tools do not: it reports the run's steps in
 * their recording order, which of them a driver may act on now, which wait,
 * which are blocked on a human, and which recorded steps no longer describe
 * the records they were bound to. Every gate (step order, draft-before-audit,
 * independent auditors, repair limits, the budget hook, attempts, the commit
 * journal, human-only merging) stays where it is enforced; a driver that
 * follows this view still goes through those commands, which refuse what
 * they always refused. Development tooling only.
 */
import { AUDITORS, type L2AuditRole } from "./audit-artifacts.ts";
import { ATTEMPT_STATUSES, stepId, type L2Attempt, type L2AttemptRole } from "./attempts.ts";
import type { L2BudgetStatus } from "./budget.ts";
import { MAX_BATCH_CONCEPTS, sliceSteps, stepKey, type L2Slice, type L2Step } from "./campaign.ts";
import { isBatched, pipelineOf, pipelineSpec } from "./pipeline.ts";
import { atL2Checkpoint, auditNeed, pendingDrafts, pendingL2Steps, repairAllowance, VALIDATION_STAGES, type RunState } from "../orchestrator/run-state.ts";

export const NEXT_SCHEMA = "map-l2-next";
/** Bumped on any change a consumer could observe: a renamed or removed field, or a changed meaning. */
export const NEXT_VERSION = 1;
/** Every command in the view is run as `<prefix> <command>`. */
export const COMMAND_PREFIX = "npm run map:author --";
/** The most concepts one run (a batch) holds: whole groups only, never a split one (campaign.ts). */
export { MAX_BATCH_CONCEPTS };

// ---------------------------------------------------------------- freshness

/** Fingerprints by concept: what a recorded step was bound to, or what a fresh one would bind now. */
export type L2Binding = Readonly<Record<string, string>>;
export type L2StaleKind = "record-changed" | "neighbour-changed" | "neighbour-removed" | "member-changed" | "member-added" | "member-removed";
export type L2StaleReason = { kind: L2StaleKind; concept: string };

/** How a bound set of records differs from the set as it is now, in concept order. */
export function bindingDrift(bound: L2Binding, current: L2Binding): { concept: string; drift: "changed" | "added" | "removed" }[] {
  const ids = [...new Set([...Object.keys(bound), ...Object.keys(current)])].sort();
  return ids.flatMap((concept): { concept: string; drift: "changed" | "added" | "removed" }[] => {
    if (!Object.hasOwn(current, concept)) return [{ concept, drift: "removed" }];
    if (!Object.hasOwn(bound, concept)) return [{ concept, drift: "added" }];
    return bound[concept] !== current[concept] ? [{ concept, drift: "changed" }] : [];
  });
}

/**
 * What recorded steps were bound to, against what they would bind now:
 * - a draft, its record's fingerprint when it was recorded;
 * - a concept audit, its own record and, unless it predates neighbour binding (`neighbours` absent: it covers only its
 *   own record, as it was validated), its authored neighbours' records (coverage.ts neighbourBasis);
 * - a group audit, every owned member's record.
 */
export type L2FreshnessInput = {
  drafts: Readonly<Record<string, { bound?: string; current: string }>>;
  audits: Readonly<Record<string, { record: { bound: string; current: string }; neighbours?: { bound: L2Binding; current: L2Binding } }>>;
  groupAudits: Readonly<Record<string, { bound: L2Binding; current: L2Binding }>>;
};

/**
 * Whether a recorded step still describes the records. A recorded audit is never current once its own record, or
 * any record it was bound to, has changed or disappeared; a group audit also once an owned member was added. A
 * neighbour authored after a concept audit (`unbound`) does not make it stale: that overlap is judged by the newer
 * record's own audit, which binds both (coverage.ts), and the gates check it.
 */
export function stepFreshness(key: string, input: L2FreshnessInput): { stale: L2StaleReason[]; unbound: string[] } {
  const [kind, subject] = splitKey(key);
  if (kind === "author") {
    const draft = input.drafts[subject];
    return { stale: draft?.bound !== undefined && draft.bound !== draft.current ? [{ kind: "record-changed", concept: subject }] : [], unbound: [] };
  }
  if (kind === "audit") {
    const audit = input.audits[subject];
    if (!audit) return { stale: [], unbound: [] };
    const stale: L2StaleReason[] = audit.record.bound !== audit.record.current ? [{ kind: "record-changed", concept: subject }] : [];
    const drift = audit.neighbours ? bindingDrift(audit.neighbours.bound, audit.neighbours.current) : [];
    for (const entry of drift) if (entry.drift !== "added") stale.push({ kind: entry.drift === "changed" ? "neighbour-changed" : "neighbour-removed", concept: entry.concept });
    return { stale, unbound: drift.filter((entry) => entry.drift === "added").map((entry) => entry.concept) };
  }
  if (kind === "group-audit") {
    const audit = input.groupAudits[subject];
    if (!audit) return { stale: [], unbound: [] };
    return { stale: bindingDrift(audit.bound, audit.current).map((entry) => ({ kind: `member-${entry.drift}` as L2StaleKind, concept: entry.concept })), unbound: [] };
  }
  return { stale: [], unbound: [] };
}

const splitKey = (key: string): [string, string] => {
  const index = key.indexOf(":");
  return [key.slice(0, index), key.slice(index + 1)];
};

/** One line per stale reason kind, for the human-readable status: `n1 (changed), n2 (removed)`. */
export const staleSummary = (reasons: readonly L2StaleReason[]) => reasons.map((reason) => `${reason.concept} (${reason.kind})`).join(", ");

// ---------------------------------------------------------------- batches

export type L2BatchGroup = { group: string; concepts: string[] };

/** Why a set of groups is not a batch a driver may run: a split or repeated concept, an empty group, too many concepts. */
export function batchProblems(groups: readonly L2BatchGroup[], max = MAX_BATCH_CONCEPTS): string[] {
  const problems: string[] = [];
  const seen = new Map<string, string>();
  for (const group of groups) {
    if (!group.concepts.length) problems.push(`group ${group.group} has no concepts to author`);
    for (const conceptId of group.concepts) {
      if (seen.has(conceptId)) problems.push(`${conceptId} is in both ${seen.get(conceptId)} and ${group.group}`);
      else seen.set(conceptId, group.group);
    }
  }
  const names = groups.map((group) => group.group);
  const repeated = [...new Set(names.filter((name, index) => names.indexOf(name) !== index))];
  if (repeated.length) problems.push(`groups named twice: ${repeated.join(", ")}`);
  const total = groups.reduce((sum, group) => sum + group.concepts.length, 0);
  if (total > max) problems.push(`${total} concepts exceed the batch limit of ${max}: start it as partial runs of whole groups (\`l2 batches --slice <id>\`)`);
  return problems;
}

export const BATCHES_SCHEMA = "map-l2-batches";
export const BATCHES_VERSION = 1;

export type L2BatchPlan = {
  schema: typeof BATCHES_SCHEMA;
  version: typeof BATCHES_VERSION;
  slice: string;
  maxConcepts: number;
  /** Whether the first batch may start now: no run of the slice is open (run-state.ts partialStartProblems). */
  startable: boolean;
  /** Runs of the slice that must finish, and be integrated, before another starts. */
  openRuns: string[];
  batches: { index: number; groups: { group: string; concepts: number }[]; concepts: number; problems: string[]; command: string }[];
  /** Groups an existing run of the slice holds: never planned again. */
  claimed: { group: string; run: string }[];
  /** Groups with every concept already integrated. */
  integrated: string[];
  /** Groups larger than the limit: never split, so never a batch; a group-batched run of one is refused at its start. */
  unbatchable: { group: string; concepts: number }[];
};

/**
 * A slice's remaining work as consecutive batches of whole groups, in the slice's order, each of at most `max`
 * concepts: deterministic for the same slice, remaining set and runs. A group larger than `max` is never split and
 * never batched: it is reported as unbatchable. Each batch is one partial run (`l2 start --slice .. --groups ..`),
 * started only once the previous run of the slice has finished (run-state.ts partialStartProblems).
 */
export function planBatches(input: { slice: Pick<L2Slice, "id" | "groups">; remaining: ReadonlySet<string>; claimed?: Readonly<Record<string, string>>; openRuns?: readonly string[]; pipeline?: string; max?: number }): L2BatchPlan {
  const max = input.max ?? MAX_BATCH_CONCEPTS;
  const claimed = Object.entries(input.claimed ?? {}).map(([group, run]) => ({ group, run })).sort((a, b) => a.group.localeCompare(b.group));
  const integrated = input.slice.groups.filter((group) => !group.concepts.some((conceptId) => input.remaining.has(conceptId))).map((group) => group.group);
  const open = input.slice.groups
    .filter((group) => !Object.hasOwn(input.claimed ?? {}, group.group) && !integrated.includes(group.group))
    .map((group) => ({ group: group.group, concepts: group.concepts.filter((conceptId) => input.remaining.has(conceptId)) }));
  const unbatchable = open.filter((group) => group.concepts.length > max).map((group) => ({ group: group.group, concepts: group.concepts.length }));
  // Consecutive: an unbatchable group closes the batch before it, so no batch spans it.
  const packed: L2BatchGroup[][] = [];
  let closed = true;
  for (const group of open) {
    if (group.concepts.length > max) {
      closed = true;
      continue;
    }
    const current = packed.at(-1);
    const size = current?.reduce((sum, entry) => sum + entry.concepts.length, 0) ?? 0;
    if (current && !closed && size + group.concepts.length <= max) current.push(group);
    else packed.push([group]);
    closed = false;
  }
  const everything = open.length === input.slice.groups.length && !unbatchable.length;
  const batches = packed.map((groups, index) => {
    const whole = everything && packed.length === 1;
    return {
      index: index + 1,
      groups: groups.map((group) => ({ group: group.group, concepts: group.concepts.length })),
      concepts: groups.reduce((sum, group) => sum + group.concepts.length, 0),
      problems: batchProblems(groups, max),
      command: `l2 start --slice ${input.slice.id}${whole ? "" : ` --groups ${groups.map((group) => group.group).join(",")}`}${input.pipeline ? ` --pipeline ${input.pipeline}` : ""} --budget-usd <usd>`,
    };
  });
  const openRuns = [...(input.openRuns ?? [])].sort();
  return { schema: BATCHES_SCHEMA, version: BATCHES_VERSION, slice: input.slice.id, maxConcepts: max, startable: !openRuns.length && batches.length > 0 && !batches[0].problems.length, openRuns, batches, claimed, integrated, unbatchable };
}

// ---------------------------------------------------------------- the view

/** What a v2 audit step's current artifacts support (audit-artifacts.ts auditOutcome), or why they cannot be read. */
export type L2SubmittedAudit = {
  submitted: readonly { role: string; auditor: string }[];
  outcome: "record" | "missing" | "blocking" | "inconsistent" | "invalid";
  /** The concepts blocking findings name (outcome "blocking"). */
  concepts?: readonly string[];
  /** Why the artifacts are inconsistent (outcome "inconsistent"): first auditors who judged different neighbours, or a repair verification that does not account for every finding. */
  problem?: string;
  /**
   * Tracked runs, outcome "record": why recording would refuse the artifacts' attempts (the CLI's attemptsOf, the
   * check `l2 record` makes), and whether `l2 reconcile` settles it. Absent when recording would accept them.
   */
  attempts?: { problem: string; reconcilable: boolean };
};

export type L2NextInput = {
  state: RunState;
  /** An unrecovered commit journal exists: nothing else in the run state is reported until it is recovered. */
  journal: boolean;
  freshness: L2FreshnessInput;
  /** The run tracks attempts (attempts.ts); `attempts` is its log, in creation order. */
  tracked: boolean;
  attempts: readonly L2Attempt[];
  /** Tracked runs: whether each attempt's inputs are still the current ones (its input key), by attempt id. */
  inputsCurrent: Readonly<Record<string, boolean>>;
  /** Whether a draft of each concept is in data.ts now. */
  drafts: Readonly<Record<string, boolean>>;
  /** Whether each group's plan file exists, and (legacy runs) each concept's design is in it. */
  plans: Readonly<Record<string, boolean>>;
  designs: Readonly<Record<string, boolean>>;
  /** Group-batched runs: each audit step's current artifacts, by step key. */
  audits: Readonly<Record<string, L2SubmittedAudit>>;
  /** Absent when the run has no spending cap. `refused` gives, per launch role, why the cap refuses a launch now. */
  budget?: { status: L2BudgetStatus; refused: Readonly<Record<string, string | undefined>> };
  governance: { mergeAuthorized: boolean; hookRegistered: boolean };
  /** The task description an attempt's agent is launched with (it carries the attempt's marker). */
  taskOf: (attempt: L2Attempt) => string;
  /** An auditor's private findings file, relative to the repository. */
  inboxOf: (subject: string, role: L2AuditRole, auditor: string) => string;
};

export type L2NextState = "recovery-required" | "stopped" | "actionable" | "waiting" | "blocked" | "tool-stages" | "awaiting-merge" | "done";
export type L2StepStatus = "actionable" | "waiting" | "pending" | "blocked" | "stale";
/**
 * Who may perform an operation:
 * - `driver`: deterministic remediation that starts no model work and decides nothing a human must (begin an
 *   attempt, record a submitted output, reconcile, reopen on blocking findings, run the tool stages up to CI);
 * - `attended`: paid model work (a launch, a plan or design written by the orchestrator), performed only with a
 *   human present while governance `paidExecution` is `attended-only`;
 * - `human`: a judgment (a decision on an interrupted attempt, a repair reason, a stop, a cap, a merge).
 */
export type L2Actor = "driver" | "attended" | "human";
/** One operation. `command` is run after COMMAND_PREFIX; `task` is the description an agent is launched with. */
export type L2Operation = { op: string; actor: L2Actor; paid: boolean; command?: string; task?: string; role?: string };
export type L2Blocker = { code: string; subject: string; actor: L2Actor; detail: string; command?: string };
export type L2Expectation =
  | { kind: "plan"; file: string; record: string }
  | { kind: "design"; concept: string; record: string }
  | { kind: "record"; concept: string; record: string }
  | { kind: "findings"; role: L2AuditRole; auditor: string; inbox: string; submit: string }
  | { kind: "audit-file"; record: string };
export type L2Unit = { role: string; auditor?: string; attempt?: { id: string; status: string }; output: "none" | "present"; expects: L2Expectation };
export type L2NextStep = { key: string; kind: L2Step["kind"]; subject: string; group: string; status: L2StepStatus; dependsOn: string[]; reasons?: string[]; units?: L2Unit[]; operations?: L2Operation[] };
/**
 * A stale recorded step and how it is brought back, as the run's rules allow it now:
 * - `re-audit` (attended): only records it was bound to around it changed, and its audit may be replaced now
 *   (`after`: once that earlier step is recorded);
 * - `reopen` (human): its own record changed, or the audit may no longer be replaced (the run has commits, or it is
 *   past the stages that record audits): a counted repair cycle with a human's reason;
 * - `repair-run` (human): the run is merging or merged: a repair run of the concepts once merged.
 */
export type L2StaleStep = { step: string; reasons: L2StaleReason[]; resolution: "re-audit" | "reopen" | "repair-run"; actor: L2Actor; command: string; after?: string };

/** The view. Its fields are emitted in a fixed order (schema, version, commandPrefix, run, governance, details, state, ..., operations), locked by its schema test. */
export type L2Next = {
  schema: typeof NEXT_SCHEMA;
  version: typeof NEXT_VERSION;
  commandPrefix: string;
  run: {
    id: string;
    slice: string;
    stage: string;
    pipeline: { mode: string; version: number; batched: boolean };
    tracksAttempts: boolean;
    scope: { part: number; groups: string[] } | null;
    repair: { cycle: number; concepts: string[] } | null;
    pr: number | null;
  };
  governance: { merge: "authorized" | "human-only"; hookRegistered: boolean; paidExecution: "attended-only" };
  details: Record<string, string>;
  state: L2NextState;
  batch: { maxConcepts: number; concepts: number; withinLimit: boolean; groups: { group: string; concepts: string[]; status: "done" | "stale" | "active" | "pending" }[]; problems: string[] } | null;
  progress: { steps: number; recorded: number; stale: number; remaining: number } | null;
  steps: L2NextStep[];
  freshness: { stale: L2StaleStep[]; unbound: { step: string; concepts: string[] }[] };
  attempts: { counts: Record<string, number>; open: { id: string; step: string; status: string }[] } | null;
  budget: { capUsd: number; spentUsd: number; reservedUsd: number; heldUsd: number; headroomUsd: number; availableUsd: number; openLaunches: number; unknown: number; launchAllowed: Record<string, boolean> } | null;
  blockers: L2Blocker[];
  /** The `driver` operations available now: everything an unattended driver may do. */
  permitted: string[];
  /** The `attended` (paid) operations available now: only with a human present. */
  attended: string[];
  /** Run-level operations (not of one step): recover the journal, reconcile attempts, complete the audit stage, run the tool stages. */
  operations: L2Operation[];
};

const cents = (usd: number) => Math.round(usd * 100) / 100;
const PAID_ROLES: Readonly<Record<string, true>> = { plan: true, design: true, author: true, repair: true, "first-audit": true, "re-audit": true, "group-audit": true };
const by = <T>(key: (item: T) => string) => (a: T, b: T) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0);
const BLOCKER_ORDER = ["journal-unrecovered", "run-stopped", "merge-awaits-human", "batch-too-large", "checkpoint", "attempt-interrupted", "attempt-inputs-changed", "artifact-invalid", "artifact-attempt", "audit-inconsistent", "repair-limit", "hook-unregistered", "budget-missing", "budget-unknown", "budget-refused", "stale-draft", "stale-audit"];

/** `l2 next --json` when there is no single active run to report: none, or several (`--domain` chooses one). */
export type L2NoRun = { schema: typeof NEXT_SCHEMA; version: typeof NEXT_VERSION; commandPrefix: string; state: "no-run" | "ambiguous"; runs: string[]; details: Record<string, string> };
export const l2NoRun = (runs: readonly string[]): L2NoRun => ({
  schema: NEXT_SCHEMA,
  version: NEXT_VERSION,
  commandPrefix: COMMAND_PREFIX,
  state: runs.length ? "ambiguous" : "no-run",
  runs: [...runs].sort(),
  details: runs.length ? { choose: "l2 next --json --domain <run>" } : { campaign: "l2 campaign --json", batches: "l2 batches --slice <id> --json" },
});

/**
 * Whether a recorded audit may be replaced now, as run-state.ts recordL2Step allows it: a concept audit while the
 * run drafts or audits, or while it validates before its first commit (or within an open repair); a group audit only
 * while the run drafts or audits (version 2) or audits (legacy, version 1). `after`: the earlier step it waits for.
 */
export function auditReplacement(state: RunState, key: string): { now: boolean; after?: string } {
  const record = state.l2!;
  const [kind] = splitKey(key);
  const stages: readonly string[] =
    kind === "group-audit"
      ? isBatched(pipelineOf(record))
        ? ["author", "audit"]
        : ["audit"]
      : ["author", "audit", ...((state.commits.length === 0 || record.repair) ? [...VALIDATION_STAGES, "commit"] : [])];
  if (!stages.includes(state.stage)) return { now: false };
  const all = sliceSteps(record.slice.groups, pipelineOf(record).mode, pipelineOf(record).version).map(stepKey);
  const earlier = pendingL2Steps(state).map(stepKey).filter((pending) => all.indexOf(pending) < all.indexOf(key));
  return earlier.length ? { now: false, after: earlier[0] } : { now: true };
}

/** The orchestration view of an L2 run. Pure: everything it reports comes from `input`. */
export function l2Next(input: L2NextInput): L2Next {
  const state = input.state;
  const record = state.l2!;
  const pipeline = pipelineOf(record);
  const batched = isBatched(pipeline);
  const governance = { merge: input.governance.mergeAuthorized ? ("authorized" as const) : ("human-only" as const), hookRegistered: input.governance.hookRegistered, paidExecution: "attended-only" as const };
  const run: L2Next["run"] = {
    id: state.domainId,
    slice: record.slice.id,
    stage: state.stage,
    pipeline: { mode: pipeline.mode, version: pipeline.version, batched },
    tracksAttempts: input.tracked,
    scope: record.scope ? { part: record.scope.part, groups: [...record.scope.groups] } : null,
    repair: record.repair ? { cycle: record.repair.cycle, concepts: [...record.repair.concepts] } : null,
    pr: state.pr?.number ?? null,
  };
  const details = { status: "l2 status", attempts: "l2 attempts --json", budget: "l2 budget --json", check: "l2 check --json" };
  const shell = { schema: NEXT_SCHEMA, version: NEXT_VERSION, commandPrefix: COMMAND_PREFIX, run, governance, details } as const;

  // A commit interrupted between its writes: the run state may be half of it, so nothing else is read from it.
  if (input.journal) {
    const recover: L2Operation = { op: "recover-journal", actor: "driver", paid: false, command: "l2 reconcile" };
    return {
      ...shell,
      state: "recovery-required",
      batch: null,
      progress: null,
      steps: [],
      freshness: { stale: [], unbound: [] },
      attempts: null,
      budget: null,
      blockers: [{ code: "journal-unrecovered", subject: state.domainId, actor: "driver", detail: "an interrupted commit is unrecovered; `l2 next --json` never recovers it. Recovering completes the decided commit, or refuses and leaves it to a human", command: "l2 reconcile" }],
      permitted: ["recover-journal"],
      attended: [],
      operations: [recover],
    };
  }

  const all = sliceSteps(record.slice.groups, pipeline.mode, pipeline.version);
  const skipped = (step: L2Step) => record.blocked.includes(step.subject) && (step.kind === "author" || step.kind === "audit");
  const live = all.filter((step) => !skipped(step));
  const pendingSteps = pendingL2Steps(state);
  const pendingKeys = pendingSteps.map(stepKey);
  const pending = new Set(pendingKeys);
  const head = pendingKeys[0];
  const blockers: L2Blocker[] = [];
  const runOps: L2Operation[] = [];
  const reopenable = !record.merged && state.stage !== "merge";
  const conceptCount = record.slice.groups.reduce((sum, group) => sum + group.concepts.length, 0);
  const batchIssues = batchProblems(record.slice.groups.map((group) => ({ group: group.group, concepts: group.concepts })));
  const overLimit = batchIssues.length > 0;
  if (overLimit) blockers.push({ code: "batch-too-large", subject: state.domainId, actor: "human", detail: `${batchIssues.join("; ")}; a driver drives only runs of whole groups with at most ${MAX_BATCH_CONCEPTS} concepts: nothing is offered`, command: `l2 batches --slice ${record.slice.id}` });

  // Recorded steps that no longer describe the records, and how each is brought back now.
  const stale: L2StaleStep[] = [];
  const unbound: { step: string; concepts: string[] }[] = [];
  const staleDrafts = new Set<string>();
  for (const step of live) {
    const key = stepKey(step);
    if (pending.has(key)) continue;
    const fresh = stepFreshness(key, input.freshness);
    if (fresh.unbound.length) unbound.push({ step: key, concepts: fresh.unbound });
    if (!fresh.stale.length) continue;
    if (step.kind === "author") staleDrafts.add(step.subject);
    const changedOwn = step.kind === "group-audit" ? fresh.stale.filter((reason) => reason.kind === "member-changed").map((reason) => reason.concept) : fresh.stale.some((reason) => reason.kind === "record-changed") || step.kind === "author" ? [step.subject] : [];
    const repairable = changedOwn.filter((conceptId) => Boolean(record.steps[`author:${conceptId}`]) || conceptId === step.subject);
    const replace = changedOwn.length ? { now: false } : auditReplacement(state, key);
    const reAudit = step.kind === "group-audit" ? `l2 audit-task ${step.subject} --role group-audit --auditor G` : batched ? `l2 audit-task ${step.subject} --role ${auditNeed(state, "audit", step.subject)} --auditor <${AUDITORS[auditNeed(state, "audit", step.subject) as L2AuditRole].join("|")}>` : `l2 record audit ${step.subject} --audit-file <json>`;
    const targets = (repairable.length ? repairable : step.kind === "group-audit" ? [] : [step.subject]).join(",") || "<member>";
    let entry: L2StaleStep;
    if (!changedOwn.length && (replace.now || replace.after)) entry = { step: key, reasons: fresh.stale, resolution: "re-audit", actor: "attended", command: reAudit, ...(replace.after ? { after: replace.after } : {}) };
    else if (reopenable) entry = { step: key, reasons: fresh.stale, resolution: "reopen", actor: "human", command: `l2 reopen ${targets} --reason ".."` };
    else entry = { step: key, reasons: fresh.stale, resolution: "repair-run", actor: "human", command: `l2 start --slice ${record.slice.id} --repair ${targets} --reason ".."${record.merged ? "" : " (once the PR is merged)"}` };
    stale.push(entry);
    blockers.push({ code: step.kind === "author" ? "stale-draft" : "stale-audit", subject: key, actor: entry.actor, detail: `recorded against records that have since changed: ${staleSummary(fresh.stale)}; it is not current evidence. ${entry.resolution === "re-audit" ? `Its auditors judge it again${entry.after ? ` once ${entry.after} is recorded` : ""}, then it is recorded again` : entry.resolution === "reopen" ? "Its audit can no longer simply be replaced: a human reopens it with a reason" : "The run is merging or merged: a human repairs it in a new run"}`, command: entry.command });
  }

  const latestAttempt = (kind: L2Step["kind"], subject: string, role: string, auditor?: string) =>
    [...input.attempts].reverse().find((attempt) => attempt.step.kind === kind && attempt.step.subject === subject && attempt.step.role === role && (attempt.step.auditor ?? undefined) === auditor);
  const lastDraftOf = (group: string) => live.filter((step) => step.group === group && step.kind === "author").map(stepKey).at(-1);
  const dependsOn = (step: L2Step): string[] => {
    if (batched && step.kind === "audit") {
      const draft = lastDraftOf(step.group);
      return draft ? [draft] : [];
    }
    const index = live.findIndex((candidate) => stepKey(candidate) === stepKey(step));
    return index > 0 ? [stepKey(live[index - 1])] : [];
  };
  // A group-batched run's concept audits may run at once, but only once everything recorded before them is: every
  // draft of their group (a repair's included), and every earlier group. Any other step runs alone, in order.
  const ready = (step: L2Step) => {
    if (!(batched && step.kind === "audit")) return stepKey(step) === head;
    const before = pendingSteps.slice(0, pendingSteps.findIndex((candidate) => stepKey(candidate) === stepKey(step)));
    return pendingDrafts(state, step.group).length === 0 && before.every((candidate) => candidate.kind === "audit" && candidate.group === step.group);
  };
  const groupOf = (conceptId: string) => record.slice.groups.find((group) => group.concepts.includes(conceptId))?.group;

  // Budget and hook gate any step whose next operation leads to paid model work.
  const paidGate = (role: string): L2Blocker | undefined => {
    if (!input.governance.hookRegistered) return { code: "hook-unregistered", subject: role, actor: "human", detail: "the L2 budget hook is not registered, so nothing enforces the cap before a launch", command: "l2 budget hook" };
    if (!input.budget) return { code: "budget-missing", subject: role, actor: "human", detail: "the run has no spending cap (it predates caps, and the hook lets its launches through): a driver launches nothing without one", command: 'l2 budget set --usd <n> --decision ".."' };
    const refused = input.budget.refused[role];
    return refused ? { code: "budget-refused", subject: role, actor: "human", detail: refused, command: 'l2 budget set --usd <n> --decision ".."' } : undefined;
  };

  const steps: L2NextStep[] = [];
  for (const step of live) {
    const key = stepKey(step);
    const base = { key, kind: step.kind, subject: step.subject, group: step.group, dependsOn: dependsOn(step) };
    const staleEntry = stale.find((entry) => entry.step === key);
    if (!pending.has(key)) {
      if (staleEntry) steps.push({ ...base, status: "stale", reasons: [staleSummary(staleEntry.reasons)] });
      continue;
    }
    if (state.stop || !(state.stage === "author" || state.stage === "audit")) {
      steps.push({ ...base, status: "blocked", reasons: [state.stop ? "the run is stopped" : `the run is at stage ${state.stage}`] });
      continue;
    }
    if (overLimit) {
      steps.push({ ...base, status: "blocked", reasons: ["the run exceeds the batch limit"] });
      continue;
    }
    if (!ready(step)) {
      steps.push({ ...base, status: "pending" });
      continue;
    }
    if (step.kind === "author" && atL2Checkpoint(state)) {
      steps.push({ ...base, status: "blocked", reasons: ["the pilot checkpoint holds drafting until a human reviews every plan and design"] });
      continue;
    }
    // A draft changed outside a repair is never audited as it stands: recording its audit refuses until it is reopened.
    const unreviewed = step.kind === "audit" ? (staleDrafts.has(step.subject) ? [step.subject] : []) : step.kind === "group-audit" ? [...staleDrafts].filter((conceptId) => groupOf(conceptId) === step.group).sort() : [];
    if (unreviewed.length) {
      steps.push({ ...base, status: "blocked", reasons: [`${unreviewed.join(", ")} changed since drafted, outside a repair: reopen it first`] });
      continue;
    }
    steps.push({ ...base, ...stepWork(step, key === head) });
  }

  /** The units, operations and status of a step whose dependencies are recorded: only what its command accepts now. */
  function stepWork(step: L2Step, isHead: boolean): Pick<L2NextStep, "status" | "reasons" | "units" | "operations"> {
    const ops: L2Operation[] = [];
    const reasons: string[] = [];
    const block = (blocker: L2Blocker) => {
      blockers.push(blocker);
      if (!reasons.includes(blocker.detail)) reasons.push(blocker.detail);
    };
    const gated = (role: string) => {
      const gate = paidGate(role);
      if (gate) block({ ...gate, subject: stepKey(step) });
      return Boolean(gate);
    };
    const driver = (op: string, command: string): L2Operation => ({ op, actor: "driver", paid: false, command });
    const reconcile = driver("reconcile", "l2 reconcile");
    const done = (status: L2StepStatus, units?: L2Unit[]) => ({ status, ...(reasons.length ? { reasons } : {}), ...(units ? { units } : {}), ...(ops.length ? { operations: ops } : {}) });

    if (step.kind === "plan") {
      const unit: L2Unit = { role: "plan", output: input.plans[step.subject] ? "present" : "none", expects: { kind: "plan", file: `src/lib/map/authoring/l2/groups/${step.subject}.json`, record: `l2 record plan ${step.subject}` } };
      if (input.plans[step.subject]) {
        ops.push(driver("record-step", `l2 record plan ${step.subject}`));
        return done("actionable", [unit]);
      }
      if (gated("plan")) return done("blocked", [unit]);
      ops.push({ op: "author-plan", actor: "attended", paid: true, role: "plan", command: `l2 territory ${step.subject} --write${pipeline.mode === "legacy" ? "" : ` --pipeline ${pipelineSpec(pipeline)}`}` });
      return done("actionable", [unit]);
    }
    if (step.kind === "design") {
      const unit: L2Unit = { role: "design", output: input.designs[step.subject] ? "present" : "none", expects: { kind: "design", concept: step.subject, record: `l2 record design ${step.subject}` } };
      if (input.designs[step.subject]) {
        ops.push(driver("record-step", `l2 record design ${step.subject}`));
        return done("actionable", [unit]);
      }
      if (gated("design")) return done("blocked", [unit]);
      ops.push({ op: "author-design", actor: "attended", paid: true, role: "design", command: `l2 context ${step.subject}` });
      return done("actionable", [unit]);
    }
    if (step.kind === "author") {
      const role: L2AttemptRole = record.repair?.concepts.includes(step.subject) ? "repair" : "author";
      const present = Boolean(input.drafts[step.subject]);
      const unit: L2Unit = { role, output: present ? "present" : "none", expects: { kind: "record", concept: step.subject, record: `l2 record author ${step.subject}${input.tracked ? " --attempt <id>" : ""}` } };
      if (!input.tracked) {
        if (present) {
          ops.push(driver("record-step", `l2 record author ${step.subject}`));
          return done("actionable", [unit]);
        }
        if (gated(role)) return done("blocked", [unit]);
        ops.push({ op: "run-agent", actor: "attended", paid: true, role, command: `l2 context ${step.subject}` });
        return done("actionable", [unit]);
      }
      const attempt = latestAttempt("author", step.subject, role);
      const open = attempt && attempt.status !== "failed" && attempt.status !== "committed" ? attempt : undefined;
      if (open) unit.attempt = { id: open.id, status: open.status };
      const current = open ? input.inputsCurrent[open.id] === true : false;
      // `record author --attempt` takes a launched (running or interrupted) attempt's draft, for exactly its inputs.
      if (open && (open.status === "running" || open.status === "interrupted") && present) {
        if (current) {
          ops.push(driver("record-step", `l2 record author ${step.subject} --attempt ${open.id}`));
          return done("actionable", [unit]);
        }
        block({ code: "attempt-inputs-changed", subject: open.id, actor: "human", detail: `the inputs of ${open.id} (its territory, repair cycle or pre-repair record) changed since it began, so its draft is not recorded: a human fails it and the draft is begun again`, command: `l2 attempt fail ${open.id} --reason ".."` });
        return done("blocked", [unit]);
      }
      if (open?.status === "interrupted") {
        block({ code: "attempt-interrupted", subject: open.id, actor: "human", detail: `${stepId(open.step)} was interrupted with no output captured: its model call may have completed; a human decides before paying for it again`, command: `l2 attempt decide ${open.id} --relaunch|--abandon --reason ".."` });
        return done("blocked", [unit]);
      }
      if (open?.status === "running" || open?.status === "completed" || (open?.status === "pending" && !current)) {
        reasons.push(open.status === "running" ? `attempt ${open.id} is running: wait for its agent, then record its draft` : open.status === "completed" ? `attempt ${open.id} completed but its draft is not in data.ts: reconcile it` : `the inputs of the pending attempt ${open.id} changed: reconciling fails it`);
        ops.push(reconcile);
        return done("waiting", [unit]);
      }
      if (gated(role)) return done("blocked", [unit]);
      if (open?.status === "pending") ops.push({ op: "launch-agent", actor: "attended", paid: true, role, task: input.taskOf(open) });
      else ops.push(driver("begin-attempt", `l2 attempt begin author ${step.subject} --role ${role}`));
      return done("actionable", [unit]);
    }

    // A concept audit or a group audit.
    const kind = step.kind as "audit" | "group-audit";
    const recordCommand = `l2 record ${kind} ${step.subject}`;
    if (!batched) {
      const role = kind === "group-audit" ? "group-audit" : auditNeed(state, "audit", step.subject);
      const unit: L2Unit = { role, output: "none", expects: { kind: "audit-file", record: `${recordCommand} --audit-file <json>` } };
      if (gated(role)) return done("blocked", [unit]);
      ops.push({ op: "run-agent", actor: "attended", paid: true, role, command: kind === "group-audit" ? `l2 group-signals ${step.subject}` : `l2 signals ${step.subject}` });
      return done("actionable", [unit]);
    }
    const need = auditNeed(state, kind, step.subject) as L2AuditRole;
    const submitted = input.audits[stepKey(step)] ?? { submitted: [], outcome: "missing" as const };
    const units = AUDITORS[need].map((auditor) => {
      const present = submitted.submitted.some((entry) => entry.role === need && entry.auditor === auditor);
      const unit: L2Unit = {
        role: need,
        auditor,
        output: present ? "present" : "none",
        expects: { kind: "findings", role: need, auditor, inbox: input.inboxOf(step.subject, need, auditor), submit: `l2 submit-audit ${step.subject} --role ${need} --auditor ${auditor} --file <inbox>${input.tracked ? " --attempt <id>" : ""}` },
      };
      const attempt = input.tracked ? latestAttempt(kind, step.subject, need, auditor) : undefined;
      if (attempt) unit.attempt = { id: attempt.id, status: attempt.status };
      return unit;
    });
    if (submitted.outcome === "invalid") {
      block({ code: "artifact-invalid", subject: stepKey(step), actor: "human", detail: "a published findings artifact is malformed or mismatched; artifacts are never rewritten: a human inspects it", command: `l2 findings ${step.subject}` });
      return done("blocked", units);
    }
    for (const unit of units) {
      if (unit.attempt?.status === "interrupted" && unit.output === "none") block({ code: "attempt-interrupted", subject: unit.attempt.id, actor: "human", detail: `the ${need} by auditor ${unit.auditor} was interrupted with no output captured: its model call may have completed; a human decides before paying for it again`, command: `l2 attempt decide ${unit.attempt.id} --relaunch|--abandon --reason ".."` });
    }
    if (reasons.length) return done("blocked", units);
    if (submitted.outcome === "inconsistent") {
      block({ code: "audit-inconsistent", subject: stepKey(step), actor: "human", detail: submitted.problem ?? "auditors A and B judged different versions of its neighbours' records", command: `l2 findings ${step.subject}` });
      return done("blocked", units);
    }
    if (submitted.outcome === "blocking") {
      const concepts = [...(submitted.concepts ?? [])].sort();
      const atLimit = concepts.filter((conceptId) => (record.repairs[conceptId] ?? 0) >= repairAllowance(state, conceptId));
      if (atLimit.length) {
        block({ code: "repair-limit", subject: atLimit.join(","), actor: "human", detail: `blocking findings need a repair of ${atLimit.join(", ")}, which has used its repair cycles: reopening it stops the run for a human`, command: `l2 findings ${step.subject}` });
        return done("blocked", units);
      }
      reasons.push(`blocking findings: ${concepts.join(", ")} must be repaired`);
      ops.push(driver("reopen", `l2 reopen ${concepts.join(",")} --from-findings`));
      return done("actionable", units);
    }
    if (submitted.outcome === "record") {
      if (submitted.attempts) {
        if (submitted.attempts.reconcilable) {
          reasons.push(submitted.attempts.problem);
          ops.push(reconcile);
          return done("waiting", units);
        }
        block({ code: "artifact-attempt", subject: stepKey(step), actor: "human", detail: submitted.attempts.problem, command: `l2 findings ${step.subject}` });
        return done("blocked", units);
      }
      if (isHead) {
        ops.push(driver("record-step", recordCommand));
        return done("actionable", units);
      }
      reasons.push(`every auditor has submitted; it is recorded after ${head}`);
      return done("waiting", units);
    }
    // Missing auditors: each is begun, launched, reconciled or waited for on its own.
    let waiting = false;
    for (const unit of units.filter((entry) => entry.output === "none")) {
      const auditTask = `l2 audit-task ${step.subject} --role ${need} --auditor ${unit.auditor}`;
      if (!input.tracked) {
        if (!gated(need)) ops.push({ op: "run-agent", actor: "attended", paid: true, role: need, command: auditTask });
        continue;
      }
      const attempt = unit.attempt ? input.attempts.find((entry) => entry.id === unit.attempt!.id) : undefined;
      const current = attempt ? input.inputsCurrent[attempt.id] === true : false;
      if (attempt?.status === "running" || attempt?.status === "completed" || (attempt?.status === "pending" && !current)) {
        // Running: its auditor has not submitted. Completed with nothing for the current records, or pending for older
        // ones: its inputs changed, and reconciling fails it before another is begun.
        waiting = true;
        if (!ops.some((op) => op.op === "reconcile")) ops.push(reconcile);
        continue;
      }
      if (gated(need)) continue;
      ops.push(attempt?.status === "pending" ? { op: "launch-agent", actor: "attended", paid: true, role: need, task: input.taskOf(attempt) } : driver("begin-attempt", auditTask));
    }
    if (ops.some((op) => op.op !== "reconcile")) return done("actionable", units);
    if (reasons.length) return done("blocked", units);
    if (waiting) reasons.push("an auditor's attempt is in flight or must be reconciled before another begins");
    return done("waiting", units);
  }

  // Run-level state, operations and blockers.
  let nextState: L2NextState;
  const merged = Boolean(record.merged);
  if (state.stop) {
    blockers.unshift({ code: "run-stopped", subject: state.stop.subject, actor: "human", detail: `${state.stop.why}; decision needed: ${state.stop.decision}`, command: 'l2 resume --decision ".."' });
    nextState = "stopped";
  } else if (state.stage === "done" && merged) nextState = "done";
  else if (state.stage === "done" || state.stage === "merge") {
    // Merging is never a driver's: a run without an unrevoked authorization waits for a human merge; with one, a
    // human runs the merge stage (`l2 run`).
    blockers.push({ code: "merge-awaits-human", subject: state.pr ? `#${state.pr.number}` : state.domainId, actor: "human", detail: input.governance.mergeAuthorized ? "the run may merge under a recorded human authorization; a human runs its merge stage" : "the validated PR is merged only by a human; once merged, `l2 run` records the merge", command: "l2 run" });
    nextState = "awaiting-merge";
  } else if (state.stage !== "author" && state.stage !== "audit") {
    // Validation, commit, push, PR and CI: the tool stages, stopping before any merge. Stale steps fail the gates.
    if (stale.length || overLimit) nextState = "blocked";
    else {
      runOps.push({ op: "run-tool-stages", actor: "driver", paid: false, command: "l2 run --until ci" });
      nextState = "tool-stages";
    }
  } else if (!pendingKeys.length) {
    // `complete audit` runs the l2-check gate, which refuses any stale step.
    if (state.stage === "audit" && !stale.length && !overLimit) {
      runOps.push({ op: "complete-audit", actor: "driver", paid: false, command: 'l2 complete audit --note ".."' });
      nextState = "actionable";
    } else nextState = "blocked";
  } else if (steps.some((step) => step.status === "actionable")) nextState = "actionable";
  else if (steps.some((step) => step.status === "waiting")) nextState = "waiting";
  else nextState = "blocked";
  if (atL2Checkpoint(state) && !state.stop) blockers.push({ code: "checkpoint", subject: state.domainId, actor: "human", detail: "the pilot checkpoint holds drafting until a human reviews every plan and design", command: 'l2 checkpoint --decision ".."' });

  const open = input.attempts.filter((attempt) => attempt.status !== "committed" && attempt.status !== "failed");
  if (input.tracked && !state.stop && open.some((attempt) => attempt.status !== "pending" || input.inputsCurrent[attempt.id] !== true)) runOps.push({ op: "reconcile", actor: "driver", paid: false, command: "l2 reconcile" });
  const permitted = new Set<string>();
  const attended = new Set<string>();
  for (const step of steps) if (step.status === "actionable" || step.status === "waiting") for (const op of step.operations ?? []) (op.actor === "driver" ? permitted : op.actor === "attended" ? attended : new Set()).add(op.op);
  for (const op of runOps) permitted.add(op.op);

  const groups = record.slice.groups.map((group) => {
    const audit = `group-audit:${group.group}`;
    const status = stale.some((entry) => entry.step === audit) ? ("stale" as const) : !pending.has(audit) ? ("done" as const) : head && all.find((step) => stepKey(step) === head)?.group === group.group ? ("active" as const) : ("pending" as const);
    return { group: group.group, concepts: [...group.concepts], status };
  });

  const status = input.budget?.status;
  const budget: L2Next["budget"] =
    input.budget && status
      ? {
          capUsd: cents(status.capUsd),
          spentUsd: cents(status.spentUsd),
          reservedUsd: cents(status.reservedUsd),
          heldUsd: cents(status.attempts?.heldUsd ?? 0),
          headroomUsd: cents(status.headroomUsd),
          availableUsd: cents(Math.max(0, status.availableUsd)),
          openLaunches: status.open.length,
          unknown: status.unknown.length,
          launchAllowed: Object.fromEntries(Object.keys(input.budget.refused).filter((role) => PAID_ROLES[role]).sort().map((role) => [role, !input.budget!.refused[role]])),
        }
      : null;
  if (input.budget && status?.unknown.length) blockers.push({ code: "budget-unknown", subject: state.domainId, actor: "human", detail: `the run's spend cannot be measured (${status.unknown.length} reason(s)): every launch is refused`, command: "l2 budget" });

  // One blocker per code and subject, in a fixed order.
  const unique = new Map<string, L2Blocker>();
  for (const blocker of blockers) if (!unique.has(`${blocker.code}\u0000${blocker.subject}`)) unique.set(`${blocker.code}\u0000${blocker.subject}`, blocker);
  const sortedBlockers = [...unique.values()].sort((a, b) => BLOCKER_ORDER.indexOf(a.code) - BLOCKER_ORDER.indexOf(b.code) || (a.subject < b.subject ? -1 : a.subject > b.subject ? 1 : 0));

  return {
    ...shell,
    state: nextState,
    batch: { maxConcepts: MAX_BATCH_CONCEPTS, concepts: conceptCount, withinLimit: !overLimit, groups, problems: batchIssues },
    progress: { steps: live.length, recorded: live.length - pendingKeys.length, stale: stale.length, remaining: pendingKeys.length },
    steps,
    freshness: { stale, unbound },
    attempts: input.tracked
      ? {
          counts: Object.fromEntries(ATTEMPT_STATUSES.map((status) => [status, input.attempts.filter((attempt) => attempt.status === status).length])),
          open: open.map((attempt) => ({ id: attempt.id, step: stepId(attempt.step), status: attempt.status })).sort(by((entry) => entry.id)),
        }
      : null,
    budget,
    blockers: sortedBlockers,
    permitted: [...permitted].sort(),
    attended: [...attended].sort(),
    operations: runOps,
  };
}
