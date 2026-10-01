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

export const STAGES = ["author", "audit", "gates", "browser", "render", "diff", "commit", "push", "pr", "ci", "done"] as const;
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

export type RunState = {
  version: 1;
  /** Absent for a domain authoring run. */
  kind?: "refactor";
  refactor?: RefactorRecord;
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
  return { ...state, stage: nextStage(stage), completed: { ...state.completed, [stage]: { at: now, ...(detail ? { detail } : {}) } } };
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
  return { kind: "tool", stage: state.stage, message: `run \`map:author -- ${state.kind === "refactor" ? "refactor run" : "run"}\` to perform ${state.stage}` };
}
