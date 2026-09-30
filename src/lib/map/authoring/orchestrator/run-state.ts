/**
 * Durable state for one MAP L1 domain run (docs/map-authoring/domain-runbook.md).
 * Pure transitions only; the CLI (scripts/map-author.ts) persists the state
 * as JSON under .map-authoring/ and performs every side effect. Each stage
 * is either the agent's (judgment) or the tool's (mechanical), and a run ends
 * at "done" (a validated PR awaiting human merge) or at a recorded stop.
 */
import { validateFixes, type DiffReport, type FixKind } from "./diff-check.ts";
import type { DomainPlan } from "./plan.ts";

export const STAGES = ["author", "audit", "gates", "browser", "render", "diff", "commit", "push", "pr", "ci", "done"] as const;
export type Stage = (typeof STAGES)[number];

/** Stages whose work needs the agent's judgment; every other stage is run by the tool. */
export const AGENT_STAGES: ReadonlySet<Stage> = new Set(["author", "audit"]);

export type StopRecord = { stage: Stage; subject: string; evidence: string; why: string; decision: string; at: string };

/** A general test or infrastructure fix discovered during the run, committed before the content. */
export type FixGroup = { kind: FixKind; message: string; files: string[]; reason: string };

/** Tool stages whose checks validate the working tree; content changes after them invalidate them. */
export const VALIDATION_STAGES: readonly Stage[] = ["gates", "browser", "render", "diff"];

export type RunState = {
  version: 1;
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
  return { kind: "tool", stage: state.stage, message: `run \`map:author -- run\` to perform ${state.stage}` };
}
