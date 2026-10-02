/**
 * Durable state for one MAP L1 domain run (docs/map-authoring/domain-runbook.md).
 * Pure transitions only; the CLI (scripts/map-author.ts) persists the state
 * as JSON under .map-authoring/ and performs every side effect. Each stage
 * is either the agent's (judgment) or the tool's (mechanical), and a run ends
 * at "done" (a validated PR awaiting human merge) or at a recorded stop.
 */
import { validateFixes, type DiffReport, type FixKind } from "./diff-check.ts";
import type { DomainPlan } from "./plan.ts";
import type { Decision, RefactorPlan } from "../representation/refactor.ts";
import { sliceSteps, stepKey, type L2Slice, type L2Step, type L2StepKind } from "../l2/campaign.ts";
import type { L2RepairBaseline } from "../l2/repair.ts";

/**
 * A run's stages. "merge" exists only for an L2 campaign run whose merging a
 * human has explicitly authorized; every other run passes from "ci" to
 * "done", a validated PR awaiting human merge.
 */
export const STAGES = ["author", "audit", "gates", "browser", "render", "diff", "commit", "push", "pr", "ci", "merge", "done"] as const;
export type Stage = (typeof STAGES)[number];

/** Stages whose work needs the agent's judgment; every other stage is run by the tool. */
export const AGENT_STAGES: ReadonlySet<Stage> = new Set(["author", "audit"]);

export type StopRecord = { stage: Stage; subject: string; evidence: string; why: string; decision: string; at: string };

/** A general test or infrastructure fix discovered during the run, committed before the content. */
export type FixGroup = { kind: FixKind; message: string; files: string[]; reason: string };

/** Tool stages whose checks validate the working tree; content changes after them invalidate them. */
export const VALIDATION_STAGES: readonly Stage[] = ["gates", "browser", "render", "diff"];

/** A representation refactor run's own record (docs/map-authoring/representation-design.md#refactor-mode). */
export type RefactorRecord = {
  /** The domain's accepted designs, without resolutions, when the run started. */
  designSet: string;
  blocked: string[];
  /** The domain's other concepts with content: KEEP, protected from any change. */
  keep: string[];
  /** The decision recorded for each actionable design after reconsidering it. */
  decisions: Record<string, { decision: Decision; note: string; at: string }>;
  /** The validated diff: records changed and designs kept. */
  diff?: { changed: string[]; kept: string[] };
};

/**
 * An open repair cycle: drafted concepts reopened after their audit, the
 * group audit or review, to be repaired within the territory, model and
 * design they were accepted with (the baseline), re-audited, and committed
 * on top of the run's commits.
 */
export type L2Repair = { cycle: number; at: string; reason: string; concepts: string[]; groups: string[]; baseline: L2RepairBaseline };
/** What happened to a run after its first drafting: closed repair cycles and base synchronizations, in order. */
export type L2HistoryEntry =
  | { kind: "repair"; cycle: number; at: string; reason: string; concepts: string[]; closedAt: string }
  | { kind: "sync"; at: string; from: string; to: string; merge: string };

/** An L2 slice run's own record (docs/map-authoring/l2-authoring.md). */
export type L2RunRecord = {
  slice: L2Slice;
  /** Each recorded judgment step ("plan:<group>", "design:<concept>", ...), when, and for drafting and audits the record they bound. */
  steps: Record<string, { at: string; note?: string; fingerprint?: string }>;
  /** Concepts whose design blocks them: they stay unauthored. */
  blocked: string[];
  /** Repair cycles each concept has been reopened in: more than the allowance stops the run (repairAllowance). */
  repairs: Record<string, number>;
  repair?: L2Repair;
  history?: L2HistoryEntry[];
  /** Set once the run's first group commits exist; later content is committed as repairs on top of them. */
  committed?: boolean;
  /** The pilot's human checkpoint between design and drafting, and its resolution. */
  checkpoint?: { required: true; clearedAt?: string; decision?: string };
  /** Set only from a human's explicit campaign authorization: the run may merge its own validated PR. */
  mergeAuthorized?: { at: string; authorization: string };
  diff?: { authored: string[]; blocked: string[]; flipped: string[] };
  merged?: { sha: string; at: string };
};

export type RunState = {
  version: 1;
  /** Absent for a domain authoring run. */
  kind?: "refactor" | "l2";
  refactor?: RefactorRecord;
  l2?: L2RunRecord;
  domainId: string;
  title: string;
  branch: string;
  baseSha: string;
  createdAt: string;
  stage: Stage;
  completed: Partial<Record<Stage, { at: string; detail?: string }>>;
  plan: { authored: string[]; eligible: string[]; deferred: { conceptId: string; reason: string }[]; facet: string[] };
  /** Eligible concepts and whether each has been authored and recorded. */
  concepts: Record<string, { done: boolean; at?: string }>;
  fixes: FixGroup[];
  auditNotes: string[];
  /** Each check's latest result, and the fingerprint of the tree it ran against. */
  checks: Record<string, { ok: boolean; at: string; detail: string; tree?: string }>;
  /** Fingerprint of the run's content records when the audit completed; later content changes reopen the audit. */
  auditContent?: string;
  /** The production build the browser and render checks ran against (.next/BUILD_ID). */
  buildId?: string;
  /** Content hashes of the changed files as validated; commits must reproduce them exactly. */
  validatedFiles?: Record<string, string>;
  /** The validated diff, from which the PR text is generated. */
  diff?: DiffReport;
  /** Commit trailer and PR footer, fixed at the first tool run so a resumed run uses the same. */
  attribution?: { trailer?: string; footer?: string };
  commits: { sha: string; message: string; files: string[] }[];
  pushedSha?: string;
  pr?: { number: number; url: string };
  ci?: { status: "pending" | "failing" | "passing"; at: string; detail: string };
  stop?: StopRecord;
  /** Earlier stops and the human decision that resolved each. */
  resolvedStops?: (StopRecord & { resolution: string; resolvedAt: string })[];
};

export class RunStateError extends Error {}

export function createRunState(input: { plan: DomainPlan; branch: string; baseSha: string; now: string }): RunState {
  const { plan } = input;
  if (plan.stops.length > 0) throw new RunStateError(`domain ${plan.domainId} has unresolved stops: ${plan.stops.map((stop) => `${stop.conceptId} (${stop.reason})`).join("; ")}`);
  if (plan.eligible.length === 0) throw new RunStateError(`domain ${plan.domainId} has no eligible L1 topics: nothing to author`);
  return {
    version: 1,
    domainId: plan.domainId,
    title: plan.title,
    branch: input.branch,
    baseSha: input.baseSha,
    createdAt: input.now,
    stage: "author",
    completed: {},
    plan: {
      authored: plan.authored,
      eligible: plan.eligible,
      deferred: plan.deferred,
      facet: plan.topics.filter((topic) => topic.status === "eligible" && topic.facet).map((topic) => topic.conceptId),
    },
    concepts: Object.fromEntries(plan.eligible.map((conceptId) => [conceptId, { done: false }])),
    fixes: [],
    auditNotes: [],
    checks: {},
    commits: [],
  };
}

const nextStage = (stage: Stage): Stage => STAGES[Math.min(STAGES.indexOf(stage) + 1, STAGES.length - 1)];
/** Whether the run may merge its own PR: only an L2 run with a recorded human authorization. */
export const mayMerge = (state: RunState) => state.kind === "l2" && Boolean(state.l2?.mergeAuthorized);

function assertLive(state: RunState) {
  if (state.stop) throw new RunStateError(`run is stopped at ${state.stop.stage}: ${state.stop.subject}`);
}

/** The eligible concepts still to author, in sibling order. */
export const pendingConcepts = (state: RunState) => state.plan.eligible.filter((conceptId) => !state.concepts[conceptId]?.done);

/**
 * A refactor run for one domain: its actionable designs play the role an
 * authoring run's eligible topics play, each "done" once a decision is
 * recorded for it.
 */
export function createRefactorRunState(input: { plan: RefactorPlan; designSet: string; branch: string; baseSha: string; now: string }): RunState {
  const { plan } = input;
  if (plan.stale.length) throw new RunStateError(`designs reviewed against different content: ${plan.stale.join(", ")}`);
  if (plan.actionable.length === 0) throw new RunStateError(`domain ${plan.domainId} has no unresolved actionable designs: nothing to refactor`);
  const eligible = plan.actionable.map((design) => design.conceptId);
  return {
    version: 1,
    kind: "refactor",
    refactor: { designSet: input.designSet, blocked: plan.blocked.map((design) => design.conceptId), keep: plan.keep, decisions: {} },
    domainId: plan.domainId,
    title: plan.title,
    branch: input.branch,
    baseSha: input.baseSha,
    createdAt: input.now,
    stage: "author",
    completed: {},
    plan: { authored: [], eligible, deferred: plan.blocked.map((design) => ({ conceptId: design.conceptId, reason: `blocked by ${design.blockedBy?.join(", ") ?? "a missing primitive"}` })), facet: plan.actionable.filter((design) => design.facetNote).map((design) => design.conceptId) },
    concepts: Object.fromEntries(eligible.map((conceptId) => [conceptId, { done: false }])),
    fixes: [],
    auditNotes: [],
    checks: {},
    commits: [],
  };
}

/**
 * An L2 slice run: its concepts play the role an authoring run's eligible
 * topics play, each done once audited (or blocked by its design). The
 * judgment steps before and after them are recorded one by one (sliceSteps).
 */
export function createL2RunState(input: { slice: L2Slice; remaining: readonly string[]; branch: string; baseSha: string; now: string; pilot?: boolean }): RunState {
  const groups = input.slice.groups.map((group) => ({ group: group.group, concepts: group.concepts.filter((conceptId) => input.remaining.includes(conceptId)) })).filter((group) => group.concepts.length > 0);
  const eligible = groups.flatMap((group) => group.concepts);
  if (eligible.length === 0) throw new RunStateError(`slice ${input.slice.id} has nothing left to author`);
  return {
    version: 1,
    kind: "l2",
    l2: { slice: { ...input.slice, groups: input.slice.groups.filter((group) => groups.some((entry) => entry.group === group.group)).map((group) => ({ ...group, concepts: groups.find((entry) => entry.group === group.group)!.concepts })) }, steps: {}, blocked: [], repairs: {}, ...(input.pilot ? { checkpoint: { required: true as const } } : {}) },
    domainId: input.slice.id,
    title: input.slice.id === "pilot" ? "L2 pilot" : `${input.slice.domainTitle} L2, part ${input.slice.index}`,
    branch: input.branch,
    baseSha: input.baseSha,
    createdAt: input.now,
    stage: "author",
    completed: {},
    plan: { authored: [], eligible, deferred: [], facet: [] },
    concepts: Object.fromEntries(eligible.map((conceptId) => [conceptId, { done: false }])),
    fixes: [],
    auditNotes: [],
    checks: {},
    commits: [],
  };
}

/** The slice's judgment steps not yet recorded, in order; a blocked concept skips its drafting and audit. */
export function pendingL2Steps(state: RunState): L2Step[] {
  const record = state.l2!;
  return sliceSteps(record.slice.groups).filter((step) => !record.steps[stepKey(step)] && !(record.blocked.includes(step.subject) && (step.kind === "author" || step.kind === "audit")));
}

/** Whether the pilot's checkpoint holds the run: every plan and design recorded, drafting not yet cleared. */
export const atL2Checkpoint = (state: RunState) => Boolean(state.l2?.checkpoint && !state.l2.checkpoint.clearedAt && pendingL2Steps(state)[0]?.kind === "author");

const drafted = (record: L2RunRecord, conceptId: string) => Boolean(record.steps[`author:${conceptId}`]);
const groupOf = (record: L2RunRecord, conceptId: string) => record.slice.groups.find((group) => group.concepts.includes(conceptId))?.group;

/**
 * Records one judgment step after the tool has validated it. Steps run in
 * order: a step before an earlier one is refused. Recording a design that
 * blocks the concept marks it done and skips its drafting.
 *
 * Drafting is recorded once. Any change to a drafted concept (its record,
 * model, design or its group's territory) is a repair: it needs the concept
 * reopened first (reopenL2), which counts the cycle. Re-recording an audit
 * whose record is unchanged only replaces its note, and counts nothing.
 */
export function recordL2Step(state: RunState, step: { kind: L2StepKind; subject: string }, now: string, options: { blocks?: boolean; note?: string; fingerprint?: string } = {}): RunState {
  assertLive(state);
  if (state.kind !== "l2" || !state.l2) throw new RunStateError("steps belong to L2 runs");
  const record = state.l2;
  const all = sliceSteps(record.slice.groups);
  const key = stepKey(step);
  const index = all.findIndex((candidate) => stepKey(candidate) === key);
  if (index < 0) throw new RunStateError(`${key} is not a step of slice ${record.slice.id}`);
  const replacingAudit = step.kind === "audit" && Boolean(record.steps[key]);
  const expectedStage = step.kind === "group-audit" ? ["audit"] : replacingAudit ? ["author", "audit"] : ["author"];
  if (!expectedStage.includes(state.stage)) throw new RunStateError(`cannot record ${key} at stage ${state.stage}`);
  const reopen = (conceptId: string) => `${conceptId} is drafted: changing it is a repair; reopen it first (\`l2 reopen ${conceptId} --reason ..\`)`;
  if ((step.kind === "author" || step.kind === "design") && drafted(record, step.subject)) throw new RunStateError(reopen(step.subject));
  if (step.kind === "plan") {
    const closed = (record.slice.groups.find((group) => group.group === step.subject)?.concepts ?? []).filter((conceptId) => drafted(record, conceptId) && !record.repair?.concepts.includes(conceptId));
    // Within a repair of the group, the tool checks that only reopened concepts' territory moved (repairScopeProblems).
    if (closed.length && record.steps[key] && !record.repair?.groups.includes(step.subject)) throw new RunStateError(`${step.subject} has drafted concepts outside a repair (${closed.join(", ")}): changing its territory is a repair; reopen them first`);
  }
  const earlier = pendingL2Steps(state).filter((pending) => all.findIndex((candidate) => stepKey(candidate) === stepKey(pending)) < index);
  if (earlier.length) throw new RunStateError(`record ${stepKey(earlier[0])} first`);
  if (step.kind === "author" && atL2Checkpoint(state)) throw new RunStateError("the pilot checkpoint holds drafting until a human has reviewed every plan and design");
  const steps = { ...record.steps, [key]: { at: now, ...(options.note ? { note: options.note } : {}), ...(options.fingerprint ? { fingerprint: options.fingerprint } : {}) } };
  let concepts = state.concepts;
  const blocked = step.kind === "design" && options.blocks ? [...new Set([...record.blocked, step.subject])] : step.kind === "design" ? record.blocked.filter((conceptId) => conceptId !== step.subject) : record.blocked;
  if (step.kind === "audit" || (step.kind === "design" && options.blocks)) concepts = { ...concepts, [step.subject]: { done: true, at: now } };
  let next: RunState = { ...state, concepts, l2: { ...record, steps, blocked } };
  if (next.stage === "author" && pendingConcepts(next).length === 0) next = { ...next, stage: "audit", completed: { ...next.completed, author: { at: now } } };
  return next;
}

/** Repair cycles a concept may be reopened in: two, plus one for each stop at its limit a human has resolved. */
export const MAX_REPAIRS = 2;
export const repairLimitSubject = (conceptId: string) => `repair limit: ${conceptId}`;
export const repairAllowance = (state: RunState, conceptId: string) => MAX_REPAIRS + (state.resolvedStops ?? []).filter((resolved) => resolved.subject === repairLimitSubject(conceptId)).length;

/** A reopen that would take concepts past their repair allowance: the run stops for a human. */
export class RepairLimitError extends RunStateError {
  readonly conceptIds: string[];
  constructor(conceptIds: string[]) {
    super(`${conceptIds.join(", ")} already used every allowed repair cycle`);
    this.conceptIds = conceptIds;
  }
}

/**
 * Reopens drafted concepts for repair after their audit, their group's audit
 * or human review. Each concept counts one repair cycle, however often it
 * is edited within it; reopening more concepts while a repair is open joins
 * that cycle. The concepts' drafting and audits and their groups' audits must
 * be recorded again, so a repair is re-audited in fresh context like the
 * first draft. The run returns to drafting from wherever it was, keeping its
 * commits, push and PR: the repair is validated in full and committed on top.
 * The baseline fixes the territory, models and designs the repair must stay
 * within (repairScopeProblems).
 */
export function reopenL2(state: RunState, input: { concepts: readonly string[]; reason: string; baseline: L2RepairBaseline; now: string }): RunState {
  assertLive(state);
  if (state.kind !== "l2" || !state.l2) throw new RunStateError("only L2 runs reopen concepts");
  const record = state.l2;
  if (!input.reason.trim()) throw new RunStateError("a repair needs its reason: the finding it answers");
  if (record.merged || state.stage === "merge") throw new RunStateError("the run's PR is merging or merged: repair in a new run");
  if (!input.concepts.length) throw new RunStateError("name the concepts to reopen");
  for (const conceptId of input.concepts) {
    if (!(conceptId in state.concepts)) throw new RunStateError(`${conceptId} is not a concept of slice ${record.slice.id}`);
    if (record.blocked.includes(conceptId)) throw new RunStateError(`${conceptId} is blocked by its design: there is no record to repair`);
    if (!drafted(record, conceptId) && !record.repair?.concepts.includes(conceptId)) throw new RunStateError(`${conceptId} is not drafted yet: draft it, nothing to repair`);
  }
  const fresh = input.concepts.filter((conceptId) => !record.repair?.concepts.includes(conceptId));
  const over = fresh.filter((conceptId) => (record.repairs[conceptId] ?? 0) + 1 > repairAllowance(state, conceptId));
  if (over.length) throw new RepairLimitError(over);
  const groups = [...new Set(input.concepts.map((conceptId) => groupOf(record, conceptId)!))];
  const steps = { ...record.steps };
  for (const conceptId of input.concepts) {
    delete steps[`author:${conceptId}`];
    delete steps[`audit:${conceptId}`];
  }
  for (const group of groups) delete steps[`group-audit:${group}`];
  const repairs = { ...record.repairs };
  for (const conceptId of fresh) repairs[conceptId] = (repairs[conceptId] ?? 0) + 1;
  const open = record.repair;
  const merge = <T>(earlier: Record<string, T>, later: Record<string, T>) => ({ ...later, ...earlier });
  const repair: L2Repair = open
    ? {
        ...open,
        concepts: [...new Set([...open.concepts, ...input.concepts])],
        groups: [...new Set([...open.groups, ...groups])],
        // The baseline is what the cycle started from: entries already fixed stay.
        baseline: { work: merge(open.baseline.work, input.baseline.work), members: merge(open.baseline.members, input.baseline.members), splits: merge(open.baseline.splits, input.baseline.splits) },
      }
    : { cycle: (record.history ?? []).filter((entry) => entry.kind === "repair").length + 1, at: input.now, reason: input.reason, concepts: [...input.concepts], groups, baseline: input.baseline };
  const concepts = { ...state.concepts };
  for (const conceptId of input.concepts) concepts[conceptId] = { done: false };
  const reopened: RunState = { ...state, stage: "author", completed: {}, concepts, checks: {}, l2: { ...record, steps, repairs, repair, diff: undefined } };
  delete reopened.validatedFiles;
  delete reopened.diff;
  delete reopened.buildId;
  delete reopened.auditContent;
  delete reopened.ci;
  return reopened;
}

/**
 * Merges a moved main into an open run (the tool made the merge commit) and
 * rebases the run on it: the run's diff is then measured from the new main,
 * and everything validated is validated again. Content is unchanged, so the
 * agent's stages stand. Never during an open repair, and never before the
 * run's first commits.
 */
export function syncL2Base(state: RunState, input: { base: string; merge: string; now: string }): RunState {
  assertLive(state);
  if (state.kind !== "l2" || !state.l2) throw new RunStateError("only L2 runs synchronize their base");
  if (!state.l2.committed && !state.pushedSha) throw new RunStateError("the run has not committed yet: nothing to synchronize");
  if (state.l2.repair) throw new RunStateError("a repair is open: finish it before synchronizing");
  const gates = STAGES.indexOf("gates");
  const synced: RunState = {
    ...state,
    baseSha: input.base,
    stage: STAGES.indexOf(state.stage) > gates ? "gates" : state.stage,
    completed: Object.fromEntries(Object.entries(state.completed).filter(([stage]) => STAGES.indexOf(stage as Stage) < gates)),
    checks: {},
    commits: [...state.commits, { sha: input.merge, message: `Merge origin/main into ${state.branch}`, files: [] }],
    l2: { ...state.l2, diff: undefined, history: [...(state.l2.history ?? []), { kind: "sync", at: input.now, from: state.baseSha, to: input.base, merge: input.merge }] },
  };
  delete synced.validatedFiles;
  delete synced.diff;
  delete synced.buildId;
  delete synced.ci;
  return synced;
}

/** The records and audits as they are now, by fingerprint. */
export type ObservedAudits = {
  records: Record<string, string | undefined>;
  /** The record fingerprint each concept audit is bound to. */
  conceptAudits: Record<string, string | undefined>;
  /** The record fingerprints each group audit is bound to, by concept. */
  groupAudits: Record<string, Record<string, string> | undefined>;
};

/**
 * Recorded steps that no longer describe the records: a drafted record
 * changed without being reopened, a concept audit or a group audit bound to
 * a record that has since changed. Each is a repair to open, never to paper
 * over.
 */
export function staleL2Steps(state: RunState, observed: ObservedAudits): { step: string; reason: string }[] {
  const record = state.l2;
  if (!record) return [];
  const stale: { step: string; reason: string }[] = [];
  for (const group of record.slice.groups) {
    for (const conceptId of group.concepts) {
      const current = observed.records[conceptId];
      const authored = record.steps[`author:${conceptId}`];
      if (authored?.fingerprint && authored.fingerprint !== current) stale.push({ step: `author:${conceptId}`, reason: `${conceptId}'s record changed since it was drafted, outside a repair` });
      if (record.steps[`audit:${conceptId}`] && observed.conceptAudits[conceptId] !== current) stale.push({ step: `audit:${conceptId}`, reason: `${conceptId}'s audit judged a different record` });
    }
    if (!record.steps[`group-audit:${group.group}`]) continue;
    const bound = observed.groupAudits[group.group];
    const changed = group.concepts.filter((conceptId) => !record.blocked.includes(conceptId) && bound?.[conceptId] !== observed.records[conceptId]);
    if (changed.length) stale.push({ step: `group-audit:${group.group}`, reason: `${group.group}'s group audit judged different records of ${changed.join(", ")}` });
  }
  return stale;
}

/** A human cleared the pilot checkpoint after reviewing every plan and design. */
export function clearL2Checkpoint(state: RunState, decision: string, now: string): RunState {
  if (!state.l2?.checkpoint) throw new RunStateError("this run has no checkpoint");
  if (!decision.trim()) throw new RunStateError("clearing the checkpoint needs the human decision");
  if (pendingL2Steps(state).some((step) => step.kind === "plan" || step.kind === "design")) throw new RunStateError("every plan and design must be recorded before the checkpoint can be cleared");
  return { ...state, l2: { ...state.l2, checkpoint: { required: true, clearedAt: now, decision } } };
}

/** Records the decision for one actionable design and marks it done; replaying the same decision is a no-op. */
export function recordDecision(state: RunState, conceptId: string, decision: Decision, note: string, now: string): RunState {
  if (state.kind !== "refactor" || !state.refactor) throw new RunStateError("decisions belong to refactor runs");
  if (!note.trim()) throw new RunStateError("a decision needs a note saying why");
  const existing = state.refactor.decisions[conceptId];
  if (existing && state.concepts[conceptId]?.done && existing.decision === decision && existing.note === note) return state;
  if (!(conceptId in state.concepts)) throw new RunStateError(`${conceptId} is not an actionable design of ${state.domainId}`);
  const decisions = { ...state.refactor.decisions, [conceptId]: { decision, note, at: now } };
  // The editorial audit may revise a decision (reverting a change to keep, say); the audit is then completed again.
  if (state.stage === "audit") return { ...state, refactor: { ...state.refactor, decisions } };
  if (state.stage !== "author") throw new RunStateError(`cannot change a decision at stage ${state.stage}; change the record, which returns the run to the audit`);
  const reopened = state.concepts[conceptId]?.done ? { ...state, concepts: { ...state.concepts, [conceptId]: { done: false } } } : state;
  return recordConcept({ ...reopened, refactor: { ...state.refactor, decisions } }, conceptId, now);
}

/** Concepts a refactor run changes: decided execute or reduce. */
export const changedConcepts = (state: RunState) =>
  Object.entries(state.refactor?.decisions ?? {}).filter(([, value]) => value.decision !== "keep").map(([conceptId]) => conceptId).sort();

/**
 * The commits a run makes: each declared fix on its own, in declaration
 * order, then everything else it validated. Together they cover exactly the
 * validated files, each in one commit.
 */
export function commitGroups(state: RunState, messages: { fix: (fix: FixGroup) => string; content: string }): { message: string; files: string[] }[] {
  const validated = Object.keys(state.validatedFiles ?? {});
  return [
    ...state.fixes.map((fix) => ({ message: messages.fix(fix), files: fix.files })),
    { message: messages.content, files: validated.filter((file) => !state.fixes.some((fix) => fix.files.includes(file))) },
  ].filter((group) => group.files.length > 0);
}

/** Why commits do not reproduce the validated tree: the files they changed and each one's blob at HEAD. */
export function compositionProblems(validatedFiles: Record<string, string>, committed: { files: string[]; blobAtHead: (file: string) => string }): string[] {
  const problems: string[] = [];
  if (JSON.stringify([...committed.files].sort()) !== JSON.stringify(Object.keys(validatedFiles).sort())) problems.push(`committed ${[...committed.files].sort().join(", ")}; validated ${Object.keys(validatedFiles).sort().join(", ")}`);
  const mismatched = Object.entries(validatedFiles).filter(([file, hash]) => committed.blobAtHead(file) !== hash).map(([file]) => file);
  if (mismatched.length) problems.push(`differing from validation: ${mismatched.join(", ")}`);
  return problems;
}

/** What the repository looks like when a command resumes a run. */
export type ObservedGit = { branch: string; head: string; baseIsAncestor: boolean; trackedChanges: string[]; remoteHead?: string };

/** Recorded run versus the actual repository; any problem means the run cannot continue as recorded. */
export function gitProblems(state: RunState, observed: ObservedGit): string[] {
  if (observed.branch !== state.branch) return [`on branch ${observed.branch}, the run is on ${state.branch}`];
  const problems: string[] = [];
  if (!observed.baseIsAncestor) problems.push(`base ${state.baseSha.slice(0, 7)} is not an ancestor of HEAD`);
  const expectedHead = state.commits.at(-1)?.sha ?? state.baseSha;
  if (observed.head !== expectedHead) problems.push(`HEAD is ${observed.head.slice(0, 7)}, the run recorded ${expectedHead.slice(0, 7)}`);
  // Once committed, the validated tree is HEAD; any tracked change on top of it was never validated, unless a repair is open.
  if (state.commits.length > 0 && observed.trackedChanges.length && !state.l2?.repair) problems.push(`tracked changes after the run's commits: ${observed.trackedChanges.join(", ")}${state.kind === "l2" ? "; changing committed content is a repair: reopen the concepts concerned" : ""}`);
  if (state.pushedSha && observed.remoteHead !== state.pushedSha) problems.push(`origin/${state.branch} is ${observed.remoteHead?.slice(0, 7) ?? "missing"}, the run pushed ${state.pushedSha.slice(0, 7)}`);
  return problems;
}

/** What `start` observes before creating a run. */
export type ObservedStart = {
  existingRun: boolean;
  trackedChanges: string[];
  branch: string;
  localMainAhead: boolean;
  remoteMain?: string;
  branchExists: boolean;
  openRunPrs: { number: number; title: string; headRefName: string }[];
  prsReadable: boolean;
};

/** Why a run of either kind may not start; empty when it may. Never weakened for one kind. */
export function startProblems(branch: string, observed: ObservedStart, main = "main"): string[] {
  const problems: string[] = [];
  if (observed.trackedChanges.length) problems.push(`tracked changes present: ${observed.trackedChanges.join(", ")}`);
  if (observed.branch !== main) problems.push(`on ${observed.branch}; start from ${main}`);
  if (!observed.remoteMain) problems.push(`origin has no ${main}`);
  else if (observed.localMainAhead) problems.push(`local ${main} has commits that origin/${main} does not`);
  if (observed.branchExists) problems.push(`branch ${branch} already exists`);
  if (!observed.prsReadable) problems.push("cannot read open PRs");
  else if (observed.openRunPrs.length) problems.push(`unmerged MAP run PRs: ${observed.openRunPrs.map((pr) => `#${pr.number} ${pr.title}`).join("; ")}`);
  return problems;
}

/** Marks one authored concept as recorded. Idempotent; the last one advances the run to the audit. */
export function recordConcept(state: RunState, conceptId: string, now: string): RunState {
  assertLive(state);
  if (!(conceptId in state.concepts)) throw new RunStateError(`${conceptId} is not an eligible concept of ${state.domainId}`);
  if (state.concepts[conceptId].done) return state;
  if (state.stage !== "author") throw new RunStateError(`cannot record ${conceptId} at stage ${state.stage}`);
  const concepts = { ...state.concepts, [conceptId]: { done: true, at: now } };
  const next = { ...state, concepts };
  return pendingConcepts(next).length === 0 ? { ...next, stage: "audit", completed: { ...state.completed, author: { at: now } } } : next;
}

/** Completes the current stage and advances. Completing a stage the run has already passed is a no-op. */
export function completeStage(state: RunState, stage: Stage, now: string, detail?: string): RunState {
  assertLive(state);
  if (state.stage !== stage) {
    if (state.completed[stage] && STAGES.indexOf(stage) < STAGES.indexOf(state.stage)) return state;
    throw new RunStateError(`cannot complete ${stage}: the run is at ${state.stage}`);
  }
  if (stage === "author" && pendingConcepts(state).length > 0) throw new RunStateError(`concepts still to author: ${pendingConcepts(state).join(", ")}`);
  if (state.kind === "l2" && stage === "audit") {
    const missing = pendingL2Steps(state).filter((step) => step.kind === "group-audit");
    if (missing.length) throw new RunStateError(`group audits still to record: ${missing.map((step) => step.subject).join(", ")}`);
  }
  const completed = { ...state.completed, [stage]: { at: now, ...(detail ? { detail } : {}) } };
  // A repair is committed by the commit stage: the cycle closes into the run's history.
  if (stage === "commit" && state.l2) {
    const { repair, ...rest } = state.l2;
    const l2: L2RunRecord = { ...rest, committed: true, ...(repair ? { history: [...(rest.history ?? []), { kind: "repair" as const, cycle: repair.cycle, at: repair.at, reason: repair.reason, concepts: repair.concepts, closedAt: now }] } : {}) };
    return { ...state, l2, stage: nextStage(stage), completed };
  }
  // Without a human's authorization a run never merges: it ends at a validated PR awaiting human merge.
  if (stage === "ci" && !mayMerge(state)) return { ...state, stage: "done", completed: { ...completed, merge: { at: now, detail: "awaiting human merge" } } };
  return { ...state, stage: nextStage(stage), completed };
}

export function recordCheck(state: RunState, name: string, ok: boolean, detail: string, now: string, tree?: string): RunState {
  return { ...state, checks: { ...state.checks, [name]: { ok, at: now, detail, ...(tree ? { tree } : {}) } } };
}

/** Checks that ran against a different tree than `tree`: their results no longer describe the run. */
export const staleChecks = (state: RunState, tree: string) =>
  Object.entries(state.checks).filter(([, check]) => check.tree !== undefined && check.tree !== tree).map(([name]) => name);

/**
 * Returns an uncommitted run to the gates, so that a tree changed after it was
 * validated (a gate fix, say) is validated again in full. Every check bound to
 * a tree is dropped with it. Never rewinds past the agent's stages or across
 * commits.
 */
export function revalidate(state: RunState): RunState {
  assertLive(state);
  if (state.commits.length > 0 && !state.l2?.repair) throw new RunStateError("cannot revalidate a run that has commits");
  if (![...VALIDATION_STAGES, "commit"].includes(state.stage)) throw new RunStateError(`cannot revalidate at ${state.stage}`);
  const gates = STAGES.indexOf("gates");
  const rewound: RunState = {
    ...state,
    stage: "gates",
    completed: Object.fromEntries(Object.entries(state.completed).filter(([stage]) => STAGES.indexOf(stage as Stage) < gates)),
    checks: Object.fromEntries(Object.entries(state.checks).filter(([, check]) => check.tree === undefined)),
  };
  delete rewound.validatedFiles;
  delete rewound.diff;
  delete rewound.buildId;
  if (rewound.refactor?.diff) rewound.refactor = { ...rewound.refactor, diff: undefined };
  return rewound;
}

/** What the tool observes about the working tree before continuing a run. */
export type Observed = { tree: string; content: string; buildId?: string };

/**
 * The run's dependency model. Before any tool stage continues an uncommitted
 * run, it compares what earlier results depended on with what is there now:
 * - the run's content records changed after the audit: the audit no longer
 *   describes them, so the run returns to the audit and revalidates after it;
 * - the tree changed since a check (a gate or test fix, say): every check is
 *   redone from the gates;
 * - the production build is not the one the gates made: the browser and
 *   render checks would test something else, so the gates rebuild it.
 * Once commits exist nothing is rewound: the commits and git checks guard them.
 */
export function invalidate(state: RunState, observed: Observed): { state: RunState; reason?: string } {
  // An open repair's content is uncommitted on top of the run's commits, and is invalidated like a first draft.
  if (state.stop || (state.commits.length > 0 && !state.l2?.repair)) return { state };
  const at = STAGES.indexOf(state.stage);
  if (state.completed.audit && state.auditContent !== undefined && state.auditContent !== observed.content) {
    const rewound: RunState = {
      ...revalidate({ ...state, stage: "gates" }),
      stage: "audit",
      completed: Object.fromEntries(Object.entries(state.completed).filter(([stage]) => STAGES.indexOf(stage as Stage) < STAGES.indexOf("audit"))),
    };
    delete rewound.auditContent;
    delete rewound.buildId;
    return { state: rewound, reason: "the run's content changed after the audit; audit it again" };
  }
  if (at < STAGES.indexOf("gates") || at > STAGES.indexOf("commit")) return { state };
  const stale = staleChecks(state, observed.tree);
  if (stale.length) return { state: revalidate(state), reason: `the tree changed since ${stale.join(", ")}; revalidating from the gates` };
  if ((state.stage === "browser" || state.stage === "render") && state.buildId !== observed.buildId) {
    return { state: revalidate(state), reason: "the production build is not the one the gates made; rebuilding from the gates" };
  }
  return { state };
}

/** Declares a general test or tooling fix. Allowed only before commits exist, once per message, and within the fix policy. */
export function addFix(state: RunState, fix: FixGroup): RunState {
  assertLive(state);
  if (state.commits.length > 0) throw new RunStateError("fixes must be declared before committing");
  if (state.fixes.some((existing) => existing.message === fix.message)) return state;
  const problems = validateFixes([...state.fixes, fix]);
  if (problems.length) throw new RunStateError(`not a general fix: ${problems.join("; ")}`);
  return { ...state, fixes: [...state.fixes, fix] };
}

/** Records a stop. A run already stopped keeps its first stop: the reason is never overwritten. */
export function stopRun(state: RunState, stop: Omit<StopRecord, "stage" | "at">, now: string): RunState {
  if (state.stop) return state;
  return { ...state, stop: { ...stop, stage: state.stage, at: now } };
}

/** Clears a recorded stop once a human decision has resolved it, keeping the stop and the decision in the history. */
export function resumeRun(state: RunState, resolution: string, now: string): RunState {
  if (!state.stop) return state;
  if (!resolution.trim()) throw new RunStateError("resuming needs the decision that resolved the stop");
  const resumed = { ...state, resolvedStops: [...(state.resolvedStops ?? []), { ...state.stop, resolution, resolvedAt: now }] };
  delete resumed.stop;
  return resumed;
}

/** A pull request as `gh pr list/view --json number,url,state,headRefOid,baseRefName` reports it. */
export type RemotePr = { number: number; url: string; state: string; headRefOid: string; baseRefName: string };

/** Why a PR is not this run's: it must be open, target `base` and carry exactly the pushed commit. */
export function prMismatch(pushedSha: string | undefined, pr: RemotePr, base = "main"): string | undefined {
  if (pr.state !== "OPEN") return `#${pr.number} is ${pr.state}`;
  if (pr.baseRefName !== base) return `#${pr.number} targets ${pr.baseRefName}, not ${base}`;
  if (!pushedSha || pr.headRefOid !== pushedSha) return `#${pr.number} is at ${pr.headRefOid.slice(0, 7)}, the run pushed ${pushedSha?.slice(0, 7) ?? "nothing"}`;
  return undefined;
}

/** A check as `gh pr checks --json name,bucket,state,link` reports it. */
export type RemoteCheck = { name: string; bucket: string; state: string; link?: string };

/**
 * CI as evidence: passing needs at least one check and every check passed or
 * skipped. Any failed or cancelled check is failing; anything else, including
 * no checks reported yet, is pending and never success.
 */
export function classifyCi(checks: readonly RemoteCheck[]): { status: "pending" | "failing" | "passing"; detail: string } {
  const failed = checks.filter((check) => check.bucket === "fail" || check.bucket === "cancel");
  if (failed.length) return { status: "failing", detail: failed.map((check) => `${check.name} ${check.state}${check.link ? ` ${check.link}` : ""}`).join("; ") };
  const unsettled = checks.filter((check) => check.bucket !== "pass" && check.bucket !== "skipping");
  if (unsettled.length || checks.length === 0) return { status: "pending", detail: unsettled.map((check) => `${check.name} ${check.state}`).join(", ") || "no checks reported yet" };
  return { status: "passing", detail: checks.map((check) => check.name).join(", ") };
}

export type NextAction =
  | { kind: "stop"; stage: Stage; stop: StopRecord }
  | { kind: "done"; stage: "done" }
  | { kind: "agent"; stage: Stage; conceptId?: string; message: string }
  | { kind: "tool"; stage: Stage; message: string };

/** What the run needs next, so that an interrupted run resumes exactly where it left off. */
export function nextAction(state: RunState): NextAction {
  if (state.stop) return { kind: "stop", stage: state.stop.stage, stop: state.stop };
  if (state.stage === "done") return { kind: "done", stage: "done" };
  if (state.kind === "l2" && (state.stage === "author" || state.stage === "audit")) {
    if (atL2Checkpoint(state)) {
      return { kind: "agent", stage: state.stage, message: "pilot checkpoint: every territory plan and design is recorded; a human reviews them before any drafting, then `map:author -- l2 checkpoint --decision \"...\"`" };
    }
    const [step] = pendingL2Steps(state);
    if (!step) return { kind: "agent", stage: "audit", message: "every group audit is recorded: `map:author -- l2 complete audit --note \"...\"`" };
    const repairing = state.l2!.repair;
    if (repairing && (repairing.concepts.includes(step.subject) || repairing.groups.includes(step.subject))) {
      const repairMessages: Partial<Record<L2StepKind, string>> = {
        author: `repair ${step.subject} (cycle ${repairing.cycle}: ${repairing.reason}) in a fresh context, within its accepted territory, model and design; if the finding needs its model, design or territory changed, re-record its design or plan first; then \`map:author -- l2 record author ${step.subject}\``,
        audit: `re-audit ${step.subject} in a fresh context against its record as repaired, then \`map:author -- l2 record audit ${step.subject} --audit-file <json>\``,
        "group-audit": `re-audit group ${step.subject} in a fresh context with its repaired records, then \`map:author -- l2 record group-audit ${step.subject} --audit-file <json>\``,
      };
      const message = repairMessages[step.kind];
      if (message) return { kind: "agent", stage: state.stage, conceptId: step.kind === "group-audit" ? undefined : step.subject, message };
    }
    const messages: Record<L2StepKind, string> = {
      plan: `write ${step.subject}'s territory plan: \`map:author -- l2 territory ${step.subject} --write\`, fill claims, reservations and splits, then \`map:author -- l2 record plan ${step.subject}\``,
      design: `model and design ${step.subject} in ${step.group}'s group file from \`map:author -- l2 context ${step.subject}\`, then \`map:author -- l2 record design ${step.subject}\``,
      author: `author ${step.subject} in a fresh context from \`map:author -- l2 context ${step.subject}\` and its design, register it, check \`map:author -- l2 signals ${step.subject}\`, then \`map:author -- l2 record author ${step.subject}\` (recorded once: later changes are repairs)`,
      audit: `audit ${step.subject} in a fresh context: resolve every \`map:author -- l2 signals ${step.subject}\` signal; a defect reopens it (\`map:author -- l2 reopen ${step.subject} --reason ..\`); otherwise \`map:author -- l2 record audit ${step.subject} --audit-file <json>\``,
      "group-audit": `audit group ${step.subject} as a whole in a fresh context: resolve \`map:author -- l2 group-signals ${step.subject}\`; a defect reopens the member concerned; otherwise \`map:author -- l2 record group-audit ${step.subject} --audit-file <json>\``,
    };
    return { kind: "agent", stage: state.stage, conceptId: step.kind === "plan" || step.kind === "group-audit" ? undefined : step.subject, message: messages[step.kind] };
  }
  if (state.stage === "author" && state.kind === "refactor") {
    const [conceptId] = pendingConcepts(state);
    return {
      kind: "agent",
      stage: "author",
      conceptId,
      message: `reconsider ${conceptId}: read \`map:author -- refactor context ${conceptId}\`, change the record within its accepted design or leave it, then \`map:author -- refactor record ${conceptId} --decision execute|reduce|keep --note "..."\``,
    };
  }
  if (state.stage === "audit" && state.kind === "refactor") {
    return { kind: "agent", stage: "audit", message: "audit the changed records: read `map:author -- refactor audit`, correct only them, then `map:author -- refactor complete audit --note \"...\"`" };
  }
  if (state.stage === "author") {
    const [conceptId] = pendingConcepts(state);
    return {
      kind: "agent",
      stage: "author",
      conceptId,
      message: `author ${conceptId}: read \`map:author -- context ${conceptId}\`, write its canonical exposition, then \`map:author -- record ${conceptId}\``,
    };
  }
  if (state.stage === "audit") {
    return { kind: "agent", stage: "audit", message: "audit the domain: read `map:author -- audit`, correct only the new content, then `map:author -- complete audit --note \"...\"`" };
  }
  return { kind: "tool", stage: state.stage, message: `run \`map:author -- ${state.kind === "refactor" ? "refactor run" : state.kind === "l2" ? "l2 run" : "run"}\` to perform ${state.stage}` };
}
