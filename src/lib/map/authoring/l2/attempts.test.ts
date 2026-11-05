import assert from "node:assert/strict";
import test from "node:test";
import { artifactAttemptProblem, attemptBudget, AttemptError, attemptMarker, beginAttempt, decide, emptyLog, inputKeyOf, LAUNCH_GRACE_MS, markerIn, reconcile, releaseHold, TRANSITIONS, transition, withAttempt, type L2Attempt, type L2AttemptEvidence, type L2AttemptLog, type L2AttemptStep } from "./attempts.ts";

const T0 = "2026-11-05T10:00:00.000Z";
const T1 = "2026-11-05T11:00:00.000Z";
const V2 = { mode: "simplified", version: 2 };
const A: L2AttemptStep = { kind: "audit", subject: "a", role: "first-audit", auditor: "A" };
const B: L2AttemptStep = { ...A, auditor: "B" };
const BINDING = { records: { a: "fp-a1" }, neighbours: { b: "fp-b1" } };
const begin = (log: L2AttemptLog, step = A, inputs = { binding: "key-1" }) => beginAttempt(log, { step, pipeline: V2, inputs, binding: BINDING, now: T0 });
const current = (attempt: L2Attempt) => attempt.inputKey;
/** Evidence with nothing: no output, not committed, no session. */
const none = (attempt: L2Attempt, extra: Partial<L2AttemptEvidence> = {}): L2AttemptEvidence => ({ inputKey: current(attempt), output: { state: "missing" }, committed: false, sessions: [], ...extra });
const session = (finished: boolean, usd = 1) => ({ finished, usd, unpriced: [] as string[], unmeasured: 0, calls: 3 });
const running = () => {
  const { log, attempt } = begin(emptyLog("r"));
  return { log, attempt: transition(attempt, "running", T0, "launched", { launch: { ref: "toolu_1", at: T0 } }) };
};

test("the lifecycle allows only its transitions; final states are final and a duplicate commit is refused", () => {
  const { attempt } = begin(emptyLog("r"));
  assert.equal(attempt.status, "pending");
  assert.throws(() => transition(attempt, "completed", T0, "x"), /pending: it cannot become completed/);
  const done = transition(transition(transition(attempt, "running", T0, "l"), "completed", T0, "o"), "committed", T0, "r");
  assert.throws(() => transition(done, "committed", T0, "again"), /already committed: a duplicate commit/);
  assert.throws(() => transition(done, "failed", T0, "x"), AttemptError);
  assert.deepEqual(TRANSITIONS.failed, []);
  assert.deepEqual(done.history.map((entry) => entry.to), ["pending", "running", "completed", "committed"]);
  // An attempt's identity is its inputs: the same step with other fingerprints is another key.
  assert.notEqual(inputKeyOf("r", A, V2, { binding: "key-1" }), inputKeyOf("r", A, V2, { binding: "key-2" }));
  assert.notEqual(inputKeyOf("r", A, V2, { binding: "key-1" }), inputKeyOf("r", A, { mode: "simplified", version: 1 }, { binding: "key-1" }));
  assert.equal(inputKeyOf("r", A, V2, { x: "1", y: "2" }), inputKeyOf("r", A, V2, { y: "2", x: "1" }));
  assert.equal(markerIn(`First audit A a ${attemptMarker(attempt.id)}`), attempt.id);
  assert.equal(markerIn("First audit A a"), undefined);
});

test("a step cannot be begun again while an attempt of it is open, nor for inputs already committed", () => {
  const first = begin(emptyLog("r"));
  assert.throws(() => begin(first.log), /is begun and not yet launched/);
  let log = withAttempt(first.log, transition(first.attempt, "running", T0, "l"));
  assert.throws(() => begin(log), /is running/);
  log = withAttempt(log, transition(log.attempts[0], "completed", T0, "o"));
  // A completed output is reused (recorded), never paid for again.
  assert.throws(() => begin(log), /holds a completed output for these inputs: record it instead of paying for it again/);
  assert.throws(() => begin(log, A, { binding: "key-2" }), /holds an output for older inputs: reconcile first/);
  log = withAttempt(log, transition(log.attempts[0], "committed", T0, "r"));
  assert.throws(() => begin(log), /already committed for these inputs/);
  // New inputs (a neighbour changed) may be audited again; another auditor is another step.
  assert.equal(begin(log, A, { binding: "key-2" }).attempt.status, "pending");
  assert.equal(begin(log, B).attempt.status, "pending");
});

test("an interrupted attempt blocks its step until a human decides; the decision is kept and allows a new attempt", () => {
  const { log, attempt } = running();
  const interrupted = transition(attempt, "interrupted", T1, "process gone");
  const withIt = withAttempt(log, interrupted);
  assert.throws(() => begin(withIt), /was interrupted and its outcome is unknown: decide first/);
  assert.throws(() => decide(interrupted, "relaunch", " ", T1), /needs the human's reason/);
  assert.throws(() => decide(attempt, "relaunch", "r", T1), /only an interrupted attempt needs a recovery decision/);
  const decided = decide(interrupted, "relaunch", "the session was killed before submitting", T1);
  assert.deepEqual([decided.status, decided.decision?.kind], ["failed", "relaunch"]);
  assert.equal(begin(withAttempt(withIt, decided)).attempt.status, "pending");
});

test("reconcile: a captured output completes a running attempt, a recorded step commits it, and running it again changes nothing", () => {
  const { attempt } = running();
  const output = { state: "valid" as const, ref: "first-audit-A-001", key: "k" };
  const completed = reconcile(attempt, none(attempt, { output, sessions: [session(true)] }), T1);
  assert.deepEqual([completed.attempt.status, completed.changed, completed.attempt.output?.ref], ["completed", true, "first-audit-A-001"]);
  const again = reconcile(completed.attempt, none(completed.attempt, { output, sessions: [session(true)] }), T1);
  assert.equal(again.changed, false);
  assert.match(again.explanation, /record it \(no new launch\)/);
  const committed = reconcile(completed.attempt, none(completed.attempt, { output, committed: true, sessions: [session(true)] }), T1);
  assert.equal(committed.attempt.status, "committed");
  assert.equal(reconcile(committed.attempt, none(committed.attempt, { output, committed: true, sessions: [session(true)] }), T1).changed, false);
  // Killed after recording but before marking the attempt: the run state's step names it, so it is committed.
  const lost = reconcile(attempt, none(attempt, { output, committed: true }), T1);
  assert.deepEqual(lost.attempt.history.slice(-2).map((entry) => entry.to), ["completed", "committed"]);
});

test("reconcile: an unknown model-call outcome is reported and needs a decision; it is never assumed to have succeeded", () => {
  const { attempt } = running();
  // The session reports finishing but no output was captured: the call may have completed.
  const finished = reconcile(attempt, none(attempt, { sessions: [session(true, 0.8)] }), T1);
  assert.equal(finished.attempt.status, "interrupted");
  assert.match(finished.decision!, /outcome unknown: its model call may have completed without its result being captured.*attempt decide/);
  // No session reports it at all (a launch that may or may not have run).
  const silent = reconcile(attempt, none(attempt), T1);
  assert.deepEqual([silent.attempt.status, Boolean(silent.decision)], ["interrupted", true]);
  // A session still running is left running, never moved on a guess.
  const live = reconcile(attempt, none(attempt, { sessions: [session(false, 0.3)] }), T1);
  assert.deepEqual([live.attempt.status, live.decision], ["running", undefined]);
  // Interrupted stays interrupted (idempotent) until output appears, which completes it without a relaunch.
  assert.equal(reconcile(finished.attempt, none(finished.attempt), T1).changed, false);
  const late = reconcile(finished.attempt, none(finished.attempt, { output: { state: "valid", ref: "first-audit-A-001" } }), T1);
  assert.equal(late.attempt.status, "completed");
});

test("reconcile: changed inputs, stale, missing, malformed or mismatched outputs fail the attempt instead of being accepted", () => {
  const { attempt } = running();
  assert.equal(reconcile(attempt, none(attempt, { output: { state: "stale", detail: "neighbour b changed" } }), T1).attempt.status, "failed");
  assert.equal(reconcile(attempt, none(attempt, { inputKey: "other", output: { state: "valid", ref: "x" } }), T1).attempt.status, "failed");
  const invalid = reconcile(attempt, none(attempt, { output: { state: "invalid", detail: "does not match the current run" } }), T1);
  assert.deepEqual([invalid.attempt.status, invalid.attempt.history.at(-1)!.reason], ["failed", "its output is invalid: does not match the current run"]);
  const completed = transition(attempt, "completed", T0, "o");
  assert.equal(reconcile(completed, none(completed, { inputKey: "other", output: { state: "valid", ref: "x" } }), T1).attempt.status, "failed");
  assert.match(reconcile(completed, none(completed), T1).attempt.history.at(-1)!.reason, /its output is missing/);
  // A pending attempt whose inputs changed before launch is failed; one that was launched is running.
  const { attempt: pending } = begin(emptyLog("r"));
  assert.equal(reconcile(pending, none(pending, { inputKey: "other" }), T1).attempt.status, "failed");
  assert.equal(reconcile(pending, none(pending, { sessions: [session(false)] }), T1).attempt.status, "running");
});

test("recovered attempts keep their measured cost; it is never lowered or invented", () => {
  const { attempt } = running();
  const measured = reconcile(attempt, none(attempt, { sessions: [session(false, 1.25)] }), T1).attempt;
  assert.deepEqual([measured.usage?.usd, measured.usage?.calls], [1.25, 3]);
  // The transcript is gone: no session is seen, the recorded spend stays.
  assert.equal(reconcile(measured, none(measured), T1).attempt.usage?.usd, 1.25);
  assert.equal(reconcile(measured, none(measured, { sessions: [session(false, 0.5)] }), T1).attempt.usage?.usd, 1.25);
  assert.equal(reconcile(attempt, none(attempt), T1).attempt.usage, undefined);
});

test("budget across recovery: recorded spend still counts, unaccounted open attempts hold their reserve, nothing is freed", () => {
  const reserve = () => 3;
  const ledger = { version: 1 as const, run: "r", reservations: [] as { id: string; role: string; usd: number; at: string; description?: string; released?: { at: string; reason: string } }[] };
  const { attempt } = running();
  const spent = { ...attempt, status: "committed" as const, usage: { usd: 2, calls: 4, unpriced: [], unmeasured: 0, measuredAt: T1 } };
  const log = (...attempts: L2Attempt[]): L2AttemptLog => ({ version: 1, run: "r", attempts });
  // Its transcript is gone: the recorded $2 is still spent.
  assert.deepEqual(attemptBudget(log(spent), [], ledger, reserve), { recordedUsd: 2, heldUsd: 0, unknown: [] });
  // Its transcript is measured: counted there, not twice.
  assert.deepEqual(attemptBudget(log(spent), [{ description: `First audit A a ${attemptMarker(spent.id)}` }], ledger, reserve), { recordedUsd: 0, heldUsd: 0, unknown: [] });
  // Interrupted with an unknown outcome and no reservation still held: its reserve is held, less what it spent.
  const interrupted = { ...transition(attempt, "interrupted", T1, "gone"), usage: { usd: 0.5, calls: 1, unpriced: [], unmeasured: 0, measuredAt: T1 } };
  assert.deepEqual(attemptBudget(log(interrupted), [], ledger, reserve), { recordedUsd: 0.5, heldUsd: 2.5, unknown: [] });
  // Its budget reservation still holds it: not held twice.
  const reserved = { ...ledger, reservations: [{ id: "toolu_1", role: "first-audit", usd: 3, at: T0, description: `First audit A a ${attemptMarker(attempt.id)}` }] };
  assert.equal(attemptBudget(log(interrupted), [], reserved, reserve).heldUsd, 0);
  // A decided attempt holds nothing more, but its recorded spend stays spent.
  const decided = decide(interrupted, "abandon", "gone for good", T1);
  assert.deepEqual(attemptBudget(log(decided), [], ledger, reserve), { recordedUsd: 0.5, heldUsd: 0, unknown: [] });
  // Recorded spend with unpriced or unmeasured calls makes spend unknown (the budget then refuses every launch).
  const unknown = { ...spent, usage: { ...spent.usage, unmeasured: 1 } };
  assert.equal(attemptBudget(log(unknown), [], ledger, reserve).unknown.length, 1);
  assert.deepEqual(attemptBudget(undefined, [], ledger, reserve), { recordedUsd: 0, heldUsd: 0, unknown: [] });
});

test("independent audit recovery: one auditor's interruption never touches the other's output, and both must judge the same evidence", () => {
  let log = emptyLog("r");
  const a = begin(log, A);
  log = a.log;
  const b = begin(log, B);
  log = b.log;
  const aDone = reconcile(transition(a.attempt, "running", T0, "l"), none(a.attempt, { output: { state: "valid", ref: "first-audit-A-001" } }), T1).attempt;
  const bLost = reconcile(transition(b.attempt, "running", T0, "l"), none(b.attempt, { sessions: [session(true)] }), T1).attempt;
  log = withAttempt(withAttempt(log, aDone), bLost);
  assert.deepEqual([aDone.status, bLost.status], ["completed", "interrupted"]);
  // A's completed output is reused, not re-audited; only B needs a decision, then a new attempt of B alone.
  assert.throws(() => begin(log, A), /record it instead of paying for it again/);
  assert.throws(() => begin(log, B), /decide first/);
  log = withAttempt(log, decide(bLost, "relaunch", "killed before submitting", T1));
  const b2 = begin(log, B);
  assert.equal(b2.attempt.inputKey === b.attempt.inputKey, true);
  // A neighbour changes before B2 submits: A's output is stale for the new evidence, so A is failed too and both audit again.
  const moved = reconcile(aDone, none(aDone, { inputKey: "new-key", output: { state: "stale" } }), T1);
  assert.equal(moved.attempt.status, "failed");
});

// ---------------------------------------------------------------- adversarial review of PR-4

test("a just-launched attempt whose session has not appeared yet stays running: a false interruption would invite paying for it twice", () => {
  const { attempt } = running();
  const soon = new Date(Date.parse(T0) + LAUNCH_GRACE_MS - 60_000).toISOString();
  const quiet = reconcile(attempt, none(attempt), soon);
  assert.equal(quiet.attempt.status, "running");
  assert.equal(quiet.changed, false);
  assert.equal(quiet.decision, undefined);
  assert.match(quiet.explanation, /launch grace/);
  // Past the grace, no session ever reporting it is an unknown outcome: interrupted, and a decision is needed.
  const late = reconcile(attempt, none(attempt), new Date(Date.parse(T0) + LAUNCH_GRACE_MS).toISOString());
  assert.equal(late.attempt.status, "interrupted");
  assert.ok(late.decision);
  // A session that reports finishing without output is interrupted at once.
  assert.equal(reconcile(attempt, none(attempt, { sessions: [session(true, 0)] }), soon).attempt.status, "interrupted");
});

test("a human recovery decision never frees spending authorization: a launched attempt whose spend was never measured holds its reserve until it is explicitly released", () => {
  const reserve = () => 3;
  const ledger = { version: 1 as const, run: "r", reservations: [] as { id: string; role: string; usd: number; at: string; description?: string }[] };
  const log = (...attempts: L2Attempt[]): L2AttemptLog => ({ version: 1, run: "r", attempts });
  const { attempt } = running();
  const interrupted = transition(attempt, "interrupted", T1, "gone");
  assert.equal(attemptBudget(log(interrupted), [], ledger, reserve).heldUsd, 3);
  // Deciding (relaunch or abandon) resolves the step, not what its model call cost: the reserve stays held.
  for (const kind of ["relaunch", "abandon"] as const) assert.equal(attemptBudget(log(decide(interrupted, kind, "gone", T1)), [], ledger, reserve).heldUsd, 3, kind);
  // So does failing a launched attempt by hand.
  assert.equal(attemptBudget(log(transition(attempt, "failed", T1, "its session crashed")), [], ledger, reserve).heldUsd, 3);
  // A relaunch begins a new attempt; both are held, never one in place of the other.
  const decided = decide(interrupted, "relaunch", "gone", T1);
  const again = transition(beginAttempt(log(decided), { step: A, pipeline: V2, inputs: { binding: "key-1" }, binding: BINDING, now: T1 }).attempt, "running", T1, "launched", { launch: { ref: "toolu_2", at: T1 } });
  assert.equal(attemptBudget(log(decided, again), [], ledger, reserve).heldUsd, 6);
  // Only an explicit release, with the human's reason, frees it; the release is kept.
  const released = releaseHold(decided, "the session made no model call: its transcript shows none", T1);
  assert.equal(released.holdReleased?.reason, "the session made no model call: its transcript shows none");
  assert.equal(attemptBudget(log(released), [], ledger, reserve).heldUsd, 0);
  assert.throws(() => releaseHold(decided, " ", T1), /needs the human's reason/);
  assert.throws(() => releaseHold(released, "again", T1), /already released/);
  assert.throws(() => releaseHold(interrupted, "x", T1), /interrupted: resolve it first/);
  // A never-launched attempt holds nothing, and has nothing to release.
  const unlaunched = transition(begin(emptyLog("r")).attempt, "failed", T1, "inputs changed");
  assert.equal(attemptBudget(log(unlaunched), [], ledger, reserve).heldUsd, 0);
  assert.throws(() => releaseHold(unlaunched, "x", T1), /never launched/);
  // Measured or recorded spend accounts for it: nothing more is held.
  assert.equal(attemptBudget(log(decided), [{ description: `First audit A a ${attemptMarker(decided.id)}` }], ledger, reserve).heldUsd, 0);
});

test("an audit artifact is the output of exactly one attempt: its own step, and the artifact that attempt captured", () => {
  const { attempt } = running();
  const artifact = { attempt: attempt.id, subject: "a", role: "first-audit", auditor: "A", key: "k1" };
  assert.equal(artifactAttemptProblem(attempt, artifact, "first-audit-A-001"), undefined);
  assert.match(artifactAttemptProblem(attempt, { ...artifact, attempt: "att-00000000-009" }, "first-audit-A-001")!, /names attempt att-00000000-009/);
  assert.match(artifactAttemptProblem(attempt, { ...artifact, attempt: undefined }, "first-audit-A-001")!, /names attempt none/);
  assert.match(artifactAttemptProblem(attempt, { ...artifact, auditor: "B" }, "first-audit-B-001")!, /not attempt .*first-audit:A/);
  assert.match(artifactAttemptProblem(attempt, { ...artifact, subject: "b" }, "first-audit-A-001")!, /of b, not attempt/);
  const completed = transition(attempt, "completed", T1, "submitted", { output: { kind: "artifact", ref: "first-audit-A-001", key: "k1", at: T1 } });
  assert.equal(artifactAttemptProblem(completed, artifact, "first-audit-A-001"), undefined);
  // A second submission naming the same attempt is not its output.
  assert.match(artifactAttemptProblem(completed, artifact, "first-audit-A-002")!, /one attempt has one output/);
  assert.match(artifactAttemptProblem(completed, { ...artifact, key: "k2" }, "first-audit-A-001")!, /one attempt has one output/);
});
