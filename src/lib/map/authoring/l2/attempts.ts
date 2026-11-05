/**
 * Attempts: one durable record per launch of a model-driven step of an L2 run
 * (docs/map-authoring/l2-simplified/v2.md, "Attempts and recovery").
 *
 * An attempt is begun, and its input identity persisted, before its agent is
 * launched: the run, the step (kind, subject, role, auditor), the pipeline and
 * the fingerprints the step judges. Its output (an audit artifact, a recorded
 * draft) is bound to exactly those inputs. Lifecycle:
 *
 *   pending --launch--> running --output captured--> completed --step recorded--> committed
 *      \--> failed       |--> failed (the session reported failure)  \--> failed (stale or invalid)
 *                        \--> interrupted (no output, outcome unknown) --> completed (output found later)
 *                                                                      \--> failed (a human decision)
 *
 * Committed and failed are final. On resume, reconciliation (reconcile) compares
 * each attempt with durable evidence (the run state's recorded steps, the
 * output artifacts, the sessions' own reports) and moves it only when that
 * evidence says so; an interrupted call is never assumed to have succeeded,
 * and a step with an undecided attempt cannot be begun again. Session evidence
 * is plain data (who ran, whether it reports finishing, measured cost), so any
 * launcher can supply it. Pure; development tooling only.
 */
import { createHash } from "node:crypto";
import type { L2BudgetLedger, L2SpendSession } from "./budget.ts";

export const ATTEMPTS_VERSION = 1;
export const ATTEMPT_STATUSES = ["pending", "running", "completed", "committed", "failed", "interrupted"] as const;
export type L2AttemptStatus = (typeof ATTEMPT_STATUSES)[number];
export const TRANSITIONS: Readonly<Record<L2AttemptStatus, readonly L2AttemptStatus[]>> = {
  pending: ["running", "failed"],
  running: ["completed", "failed", "interrupted"],
  completed: ["committed", "failed"],
  interrupted: ["completed", "failed"],
  committed: [],
  failed: [],
};
/** Attempts still open: one of these for a step forbids beginning another. */
export const OPEN: ReadonlySet<L2AttemptStatus> = new Set(["pending", "running", "completed", "interrupted"]);

export type L2AttemptRole = "author" | "repair" | "first-audit" | "re-audit" | "group-audit";
export type L2AttemptStep = { kind: "author" | "audit" | "group-audit"; subject: string; role: L2AttemptRole; auditor?: string };
export type L2Attempt = {
  version: 1;
  id: string;
  run: string;
  step: L2AttemptStep;
  model?: string;
  pipeline: { mode: string; version: number };
  /** Named input fingerprints (records, neighbours, plan, repair cycle); `binding` is an audit's complete evidence. */
  inputs: Record<string, string>;
  binding?: { records: Record<string, string>; neighbours?: Record<string, string> };
  inputKey: string;
  status: L2AttemptStatus;
  createdAt: string;
  updatedAt: string;
  history: { from?: L2AttemptStatus; to: L2AttemptStatus; at: string; reason: string }[];
  launch?: { ref: string; at: string };
  /** What the attempt produced: an audit artifact (its path and binding key), or a recorded draft (its record fingerprint). */
  output?: { kind: "artifact" | "record"; ref: string; key: string; at: string };
  /** Spend measured for its session; kept when the session's transcript is gone. Never estimated. */
  usage?: { usd: number; calls: number; unpriced: string[]; unmeasured: number; measuredAt: string };
  decision?: { kind: "relaunch" | "abandon"; reason: string; at: string };
  /** A human's release of the reserve a launched attempt holds while its spend was never measured (attemptBudget). */
  holdReleased?: { reason: string; at: string };
};
export type L2AttemptLog = { version: 1; run: string; attempts: L2Attempt[] };

export class AttemptError extends Error {}

/**
 * How long a launched attempt may go without any session reporting it before
 * reconciliation calls it interrupted: a subagent's transcript can appear
 * after its launch, and a false interruption invites paying for it twice.
 */
export const LAUNCH_GRACE_MS = 15 * 60_000;

const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
export const stepId = (step: L2AttemptStep) => `${step.kind}:${step.subject}:${step.role}${step.auditor ? `:${step.auditor}` : ""}`;
/** The text a launched agent's task carries, by which its session, budget reservation and attempt are matched. */
export const attemptMarker = (id: string) => `#${id}`;
/** The marker in a launch description, if any. */
export const markerIn = (description: string | undefined) => description?.match(/#(att-[0-9a-f]{4,}-\d{3,})/)?.[1];
const ordered = (values: Record<string, string>) => Object.fromEntries(Object.entries(values).sort(([a], [b]) => a.localeCompare(b)));
/** The identity of an attempt's inputs: the run, the step, the pipeline and every input fingerprint. */
export const inputKeyOf = (run: string, step: L2AttemptStep, pipeline: L2Attempt["pipeline"], inputs: Record<string, string>) => hash({ run, step: stepId(step), pipeline: [pipeline.mode, pipeline.version], inputs: ordered(inputs) });

export const emptyLog = (run: string): L2AttemptLog => ({ version: ATTEMPTS_VERSION, run, attempts: [] });

/** The attempt with a lifecycle transition, or an AttemptError when the lifecycle does not allow it. */
export function transition(attempt: L2Attempt, to: L2AttemptStatus, at: string, reason: string, extra: Partial<L2Attempt> = {}): L2Attempt {
  if (!TRANSITIONS[attempt.status].includes(to)) throw new AttemptError(`attempt ${attempt.id} is ${attempt.status}: it cannot become ${to}${attempt.status === "committed" && to === "committed" ? " (already committed: a duplicate commit)" : ""}`);
  return { ...attempt, ...extra, status: to, updatedAt: at, history: [...attempt.history, { from: attempt.status, to, at, reason }] };
}

/** Replaces one attempt in the log. */
export const withAttempt = (log: L2AttemptLog, attempt: L2Attempt): L2AttemptLog => ({ ...log, attempts: log.attempts.map((entry) => (entry.id === attempt.id ? attempt : entry)) });
export const attemptIn = (log: L2AttemptLog, id: string) => log.attempts.find((entry) => entry.id === id) ?? (() => { throw new AttemptError(`no attempt ${id} in ${log.run}`); })();

/**
 * Begins an attempt (pending), or refuses with why another must not start:
 * an attempt of the same step still open (pending or running: in flight;
 * completed: its output is there to record, not to pay for again;
 * interrupted: its outcome is unknown until a human decides), or the step
 * already committed for exactly these inputs.
 */
export function beginAttempt(log: L2AttemptLog, input: { step: L2AttemptStep; pipeline: L2Attempt["pipeline"]; inputs: Record<string, string>; binding?: L2Attempt["binding"]; model?: string; now: string }): { log: L2AttemptLog; attempt: L2Attempt } {
  const id = stepId(input.step);
  const inputKey = inputKeyOf(log.run, input.step, input.pipeline, input.inputs);
  const same = log.attempts.filter((entry) => stepId(entry.step) === id);
  const open = same.find((entry) => OPEN.has(entry.status));
  if (open) {
    const why: Record<string, string> = {
      pending: "is begun and not yet launched: launch it, or fail it (`l2 attempt fail`)",
      running: "is running: wait for it, or reconcile (`l2 reconcile`) if its session has ended",
      completed: open.inputKey === inputKey ? "holds a completed output for these inputs: record it instead of paying for it again" : "holds an output for older inputs: reconcile first (`l2 reconcile`)",
      interrupted: "was interrupted and its outcome is unknown: decide first (`l2 attempt decide <id> --relaunch|--abandon --reason ..`)",
    };
    throw new AttemptError(`attempt ${open.id} of ${id} ${why[open.status]}`);
  }
  const committed = same.find((entry) => entry.status === "committed" && entry.inputKey === inputKey);
  if (committed) throw new AttemptError(`${id} is already committed for these inputs (attempt ${committed.id}): nothing to launch`);
  const attempt: L2Attempt = {
    version: ATTEMPTS_VERSION,
    id: `att-${createHash("sha256").update(`${log.run}\0${id}\0${input.now}\0${log.attempts.length}`).digest("hex").slice(0, 8)}-${String(log.attempts.length + 1).padStart(3, "0")}`,
    run: log.run,
    step: input.step,
    ...(input.model ? { model: input.model } : {}),
    pipeline: input.pipeline,
    inputs: ordered(input.inputs),
    ...(input.binding ? { binding: input.binding } : {}),
    inputKey,
    status: "pending",
    createdAt: input.now,
    updatedAt: input.now,
    history: [{ to: "pending", at: input.now, reason: "begun: inputs persisted before launch" }],
  };
  return { log: { ...log, attempts: [...log.attempts, attempt] }, attempt };
}

/**
 * What durable evidence says about one attempt now:
 * - `inputKey`: the key its inputs would have if it were begun now (undefined: they cannot be computed);
 * - `output`: its output's state, if it has one: valid for its inputs, stale (judged older inputs),
 *   invalid (malformed or mismatched), or missing;
 * - `committed`: the run state records its step with this attempt;
 * - `sessions`: the sessions launched for it (matched by its marker).
 */
export type L2AttemptEvidence = {
  inputKey?: string;
  output: { state: "valid" | "stale" | "invalid" | "missing"; ref?: string; key?: string; detail?: string };
  committed: boolean;
  sessions: readonly Pick<L2SpendSession, "finished" | "usd" | "unpriced" | "unmeasured" | "calls">[];
};

export type L2Reconciliation = { attempt: L2Attempt; changed: boolean; explanation: string; decision?: string };

/**
 * Moves an attempt only as its evidence requires, and says why. Applied to its
 * own result it changes nothing more (idempotent).
 */
export function reconcile(attempt: L2Attempt, evidence: L2AttemptEvidence, now: string): L2Reconciliation {
  let next = recordUsage(attempt, evidence, now);
  const stale = evidence.inputKey !== undefined && evidence.inputKey !== attempt.inputKey;
  const finished = evidence.sessions.some((session) => session.finished);
  const ran = evidence.sessions.length > 0;
  const move = (to: L2AttemptStatus, reason: string, extra: Partial<L2Attempt> = {}) => {
    next = transition(next, to, now, reason, extra);
    return reason;
  };
  const output = evidence.output.state === "valid" && evidence.output.ref ? { output: { kind: attempt.step.kind === "author" ? ("record" as const) : ("artifact" as const), ref: evidence.output.ref, key: evidence.output.key ?? attempt.inputKey, at: now } } : {};
  let explanation: string;
  let decision: string | undefined;
  switch (attempt.status) {
    case "committed":
    case "failed":
      explanation = `${attempt.status}: final`;
      break;
    case "pending":
      if (stale) explanation = move("failed", "its inputs changed before it was launched");
      else if (ran) explanation = move("running", "a session was launched for it");
      else explanation = "pending: begun, not launched";
      // A launched pending attempt continues as running below, in the same reconciliation.
      if (next.status === "running") return reconcile(next, evidence, now);
      break;
    case "running":
    case "interrupted":
      if (evidence.committed && evidence.output.state === "valid") {
        if (attempt.status === "interrupted" || attempt.status === "running") move("completed", "its output was recorded before the process stopped", output);
        explanation = move("committed", "the run state records its step with this attempt");
      } else if (evidence.output.state === "valid" && !stale) explanation = move("completed", attempt.status === "interrupted" ? "its output was found after the interruption, bound to its inputs" : "its output was captured, bound to its inputs", output);
      else if (evidence.output.state === "stale" || (evidence.output.state === "valid" && stale)) explanation = move("failed", `its output judged inputs that have since changed${evidence.output.detail ? ` (${evidence.output.detail})` : ""}`);
      else if (evidence.output.state === "invalid") explanation = move("failed", `its output is invalid: ${evidence.output.detail ?? "malformed or mismatched"}`);
      else if (attempt.status === "interrupted") {
        explanation = "interrupted: no output was captured";
        decision = `outcome unknown: its model call may have completed without its result being captured. Decide before paying for it again: \`l2 attempt decide ${attempt.id} --relaunch|--abandon --reason ".."\``;
      } else if (!finished && !ran && Date.parse(now) - Date.parse(attempt.launch?.at ?? attempt.updatedAt) < LAUNCH_GRACE_MS) {
        explanation = `running: launched at ${attempt.launch?.at ?? attempt.updatedAt}; no session reports it yet (within the ${LAUNCH_GRACE_MS / 60_000}-minute launch grace)`;
      } else if (finished || !ran) {
        explanation = move("interrupted", finished ? "its session reports finishing, but no output was captured" : "no session reports running it and no output was captured");
        decision = `outcome unknown: its model call may have completed without its result being captured. Decide before paying for it again: \`l2 attempt decide ${attempt.id} --relaunch|--abandon --reason ".."\``;
      } else explanation = "running: its session has not reported finishing; if its process is gone, `l2 attempt interrupt` it";
      break;
    case "completed":
      if (evidence.committed) explanation = move("committed", "the run state records its step with this attempt");
      else if (stale || evidence.output.state === "stale") explanation = move("failed", "its output judged inputs that have since changed");
      else if (evidence.output.state !== "valid") explanation = move("failed", `its output is ${evidence.output.state}${evidence.output.detail ? `: ${evidence.output.detail}` : ""}`);
      else explanation = "completed: its output is valid for the current inputs; record it (no new launch)";
      break;
  }
  return { attempt: next, changed: JSON.stringify(next) !== JSON.stringify(attempt), explanation, ...(decision ? { decision } : {}) };
}

/** The attempt with its sessions' measured spend; a recorded spend is never lowered, and never invented when no session is seen. */
function recordUsage(attempt: L2Attempt, evidence: L2AttemptEvidence, now: string): L2Attempt {
  if (!evidence.sessions.length) return attempt;
  const usd = evidence.sessions.reduce((sum, session) => sum + session.usd, 0);
  const calls = evidence.sessions.reduce((sum, session) => sum + (session.calls ?? 0), 0);
  const unpriced = [...new Set(evidence.sessions.flatMap((session) => session.unpriced))].sort();
  const unmeasured = evidence.sessions.reduce((sum, session) => sum + session.unmeasured, 0);
  const before = attempt.usage;
  if (before && before.usd >= usd && before.calls >= calls && before.unmeasured >= unmeasured && unpriced.every((model) => before.unpriced.includes(model))) return attempt;
  return { ...attempt, usage: { usd: Math.max(usd, before?.usd ?? 0), calls: Math.max(calls, before?.calls ?? 0), unpriced: [...new Set([...unpriced, ...(before?.unpriced ?? [])])].sort(), unmeasured: Math.max(unmeasured, before?.unmeasured ?? 0), measuredAt: now } };
}

/** A human's decision on an interrupted (or stuck running) attempt: it fails, with the decision kept, and the step may be begun again. */
export function decide(attempt: L2Attempt, kind: "relaunch" | "abandon", reason: string | undefined, now: string): L2Attempt {
  if (!reason?.trim()) throw new AttemptError("a recovery decision needs the human's reason: --reason \"..\"");
  if (attempt.status !== "interrupted") throw new AttemptError(`attempt ${attempt.id} is ${attempt.status}: only an interrupted attempt needs a recovery decision`);
  return transition(attempt, "failed", now, `decision (${kind}): ${reason}`, { decision: { kind, reason, at: now } });
}

/** Whether an attempt was ever launched: a model may have been called for it. */
export const launched = (attempt: L2Attempt) => Boolean(attempt.launch) || attempt.history.some((entry) => entry.to === "running");

/**
 * A human's release of the reserve a launched attempt still holds (attemptBudget):
 * its spend was never measured, and releasing says it is known to be no more
 * than what is measured elsewhere. Only an attempt that is resolved (committed
 * or failed) and holds a reserve is released; the decision is kept.
 */
export function releaseHold(attempt: L2Attempt, reason: string | undefined, now: string): L2Attempt {
  if (!reason?.trim()) throw new AttemptError("releasing an attempt's reserve needs the human's reason: --reason \"..\"");
  if (OPEN.has(attempt.status)) throw new AttemptError(`attempt ${attempt.id} is ${attempt.status}: resolve it first (an interrupted one by \`l2 attempt decide\`)`);
  if (!launched(attempt)) throw new AttemptError(`attempt ${attempt.id} was never launched: it holds nothing`);
  if (attempt.holdReleased) throw new AttemptError(`attempt ${attempt.id}'s reserve was already released (${attempt.holdReleased.at})`);
  return { ...attempt, holdReleased: { reason, at: now }, updatedAt: now };
}

/**
 * Why an audit artifact is not the output of `attempt`: it names another
 * attempt, or another step (subject, role, auditor), or the attempt's
 * captured output is another artifact. Undefined when it is that output.
 */
export function artifactAttemptProblem(attempt: L2Attempt, artifact: { attempt?: string; subject: string; role: string; auditor: string; key: string }, ref: string): string | undefined {
  if (artifact.attempt !== attempt.id) return `the artifact ${ref} names attempt ${artifact.attempt ?? "none"}, not ${attempt.id}`;
  if (artifact.subject !== attempt.step.subject || artifact.role !== attempt.step.role || artifact.auditor !== (attempt.step.auditor ?? "")) return `the artifact ${ref} is ${artifact.role} ${artifact.auditor} of ${artifact.subject}, not attempt ${attempt.id}'s ${stepId(attempt.step)}`;
  if (attempt.output && (attempt.output.ref !== ref || attempt.output.key !== artifact.key)) return `attempt ${attempt.id}'s output is ${attempt.output.ref}, not ${ref}: one attempt has one output`;
  return undefined;
}

/**
 * What attempts add to a run's budget so recovery never frees spending
 * authorization (budget.ts budgetStatus `extra`):
 * - spend recorded for an attempt whose sessions are no longer measured (a
 *   transcript removed) still counts as spent;
 * - a running or interrupted attempt that no measured session or unreleased
 *   budget reservation accounts for holds its role's reserve, less what it
 *   has measurably spent;
 * - so does a launched attempt that is resolved (failed by a decision, say)
 *   whose spend was never measured or recorded: resolving it says nothing of
 *   what its model call cost, so only an explicit release (releaseHold) frees it;
 * - recorded spend with an unpriced model or unmeasured calls is unknown.
 */
export function attemptBudget(log: L2AttemptLog | undefined, sessions: readonly Pick<L2SpendSession, "description">[], ledger: L2BudgetLedger, reserveFor: (role: string) => number): { recordedUsd: number; heldUsd: number; unknown: string[] } {
  let recordedUsd = 0;
  let heldUsd = 0;
  const unknown: string[] = [];
  for (const attempt of log?.attempts ?? []) {
    const marker = attemptMarker(attempt.id);
    const measured = sessions.some((session) => session.description.includes(marker));
    if (attempt.usage && !measured) {
      recordedUsd += attempt.usage.usd;
      if (attempt.usage.unpriced.length || attempt.usage.unmeasured) unknown.push(`attempt ${attempt.id}'s recorded spend includes unpriced or unmeasured calls`);
    }
    if (!launched(attempt) || measured) continue;
    const reserved = ledger.reservations.some((reservation) => !reservation.released && (reservation.description ?? "").includes(marker));
    if (reserved) continue;
    if (attempt.status === "running" || attempt.status === "interrupted") heldUsd += Math.max(0, reserveFor(attempt.step.role) - (attempt.usage?.usd ?? 0));
    else if (!attempt.usage && !attempt.holdReleased) heldUsd += reserveFor(attempt.step.role);
  }
  return { recordedUsd, heldUsd, unknown };
}
