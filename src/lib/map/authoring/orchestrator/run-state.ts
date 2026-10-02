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

/** An L2 slice run's own record (docs/map-authoring/l2-authoring.md). */
export type L2RunRecord = {
  slice: L2Slice;
  /** Each recorded judgment step ("plan:<group>", "design:<concept>", ...) and when. */
  steps: Record<string, { at: string; note?: string }>;
  /** Concepts whose design blocks them: they stay unauthored. */
  blocked: string[];
  /** Times each concept was re-authored after its audit: more than two stops the run. */
  repairs: Record<string, number>;
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

/**
 * Records one judgment step after the tool has validated it. Steps run in
 * order: a step before an earlier one is refused. Recording a concept's
 * drafting again after its audit reopens the audit and counts a repair.
 * Recording a design that blocks the concept marks it done and skips its
 * drafting.
 */
export function recordL2Step(state: RunState, step: { kind: L2StepKind; subject: string }, now: string, options: { blocks?: boolean; note?: string } = {}): RunState {
  assertLive(state);
  if (state.kind !== "l2" || !state.l2) throw new RunStateError("steps belong to L2 runs");
  const record = state.l2;
  const all = sliceSteps(record.slice.groups);
  const key = stepKey(step);
  const index = all.findIndex((candidate) => stepKey(candidate) === key);
  if (index < 0) throw new RunStateError(`${key} is not a step of slice ${record.slice.id}`);
  const expectedStage = step.kind === "group-audit" ? "audit" : "author";
  if (state.stage !== expectedStage) throw new RunStateError(`cannot record ${key} at stage ${state.stage}`);
  const earlier = pendingL2Steps(state).filter((pending) => all.findIndex((candidate) => stepKey(candidate) === stepKey(pending)) < index);
  if (earlier.length) throw new RunStateError(`record ${stepKey(earlier[0])} first`);
  if (step.kind === "author" && atL2Checkpoint(state)) throw new RunStateError("the pilot checkpoint holds drafting until a human has reviewed every plan and design");
  const steps = { ...record.steps, [key]: { at: now, ...(options.note ? { note: options.note } : {}) } };
  let repairs = record.repairs;
  let concepts = state.concepts;
  if (step.kind === "author" && record.steps[`audit:${step.subject}`]) {
    delete steps[`audit:${step.subject}`];
    repairs = { ...repairs, [step.subject]: (repairs[step.subject] ?? 0) + 1 };
    concepts = { ...concepts, [step.subject]: { done: false } };
  }
  const blocked = step.kind === "design" && options.blocks ? [...new Set([...record.blocked, step.subject])] : step.kind === "design" ? record.blocked.filter((conceptId) => conceptId !== step.subject) : record.blocked;
  if (step.kind === "audit" || (step.kind === "design" && options.blocks)) concepts = { ...concepts, [step.subject]: { done: true, at: now } };
  let next: RunState = { ...state, concepts, l2: { ...record, steps, repairs, blocked } };
  if (next.stage === "author" && pendingConcepts(next).length === 0) next = { ...next, stage: "audit", completed: { ...next.completed, author: { at: now } } };
  return next;
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
  // Once committed, the validated tree is HEAD; any tracked change on top of it was never validated.
  if (state.commits.length > 0 && observed.trackedChanges.length) problems.push(`tracked changes after the run's commits: ${observed.trackedChanges.join(", ")}`);
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
  if (state.commits.length > 0) throw new RunStateError("cannot revalidate a run that has commits");
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
  if (state.stop || state.commits.length > 0) return { state };
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
    const messages: Record<L2StepKind, string> = {
      plan: `write ${step.subject}'s territory plan: \`map:author -- l2 territory ${step.subject} --write\`, fill claims, reservations and splits, then \`map:author -- l2 record plan ${step.subject}\``,
      design: `model and design ${step.subject} in ${step.group}'s group file from \`map:author -- l2 context ${step.subject}\`, then \`map:author -- l2 record design ${step.subject}\``,
      author: `author ${step.subject} in a fresh context from \`map:author -- l2 context ${step.subject}\` and its design, register it, then \`map:author -- l2 record author ${step.subject}\``,
      audit: `audit ${step.subject}: resolve every \`map:author -- l2 signals ${step.subject}\` signal in its audit, then \`map:author -- l2 record audit ${step.subject}\``,
      "group-audit": `audit group ${step.subject} as a whole: resolve its group signals in groupAudit, then \`map:author -- l2 record group-audit ${step.subject}\``,
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
