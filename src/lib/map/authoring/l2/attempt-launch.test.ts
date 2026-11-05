import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { completeStage, createL2RunState, recordL2Step, STAGES } from "../orchestrator/run-state.ts";
import { attemptBudget, attemptIn, attemptMarker, beginAttempt, transition, withAttempt } from "./attempts.ts";
import { readAttemptLog, updateAttemptLog } from "./attempts-io.ts";
import { reserveFor, startBudget } from "./budget.ts";
import { launchGate, readLedger, type LaunchInput } from "./budget-io.ts";
import { pilotSlice } from "./campaign.ts";
import { roleOf } from "./cost.ts";
import { model, REGISTRY } from "./fixtures.ts";

const BRANCH = "feat/map-x-l2-1";
const T0 = "2026-11-05T00:00:00.000Z";
const budget = startBudget("20", undefined, T0);

/** A capped, attempt-tracked run on disk, with the hook's attempts adapter over its own files. */
function world(tracked = true) {
  const root = mkdtempSync(join(tmpdir(), "l2-attempt-launch-"));
  const stateDir = join(root, "state");
  const transcripts = join(root, "transcripts");
  for (const dir of [stateDir, transcripts]) mkdirSync(dir, { recursive: true });
  writeFileSync(join(stateDir, "run.json"), JSON.stringify({ version: 1, kind: "l2", domainId: "run", branch: BRANCH, createdAt: T0, stage: "author", l2: { budget, ...(tracked ? { attempts: { version: 1 } } : {}) } }));
  const attempts = join(root, "attempts", "run.json");
  const ledger = join(root, "ledgers", "run.json");
  const adapter = {
    pending: (run: string, marker: string | undefined) => {
      if (!marker) return "every model launch is begun as an attempt first";
      const attempt = readAttemptLog(attempts, run).attempts.find((entry) => entry.id === marker);
      return attempt?.status === "pending" ? undefined : `attempt ${marker} is ${attempt?.status ?? "unknown"}, not pending`;
    },
    claim: (run: string, marker: string, ref: string, now: string) => updateAttemptLog(attempts, run, (log) => ({ log: withAttempt(log, transition(attemptIn(log, marker), "running", now, "launched", { launch: { ref, at: now } })), result: undefined })),
    extra: (run: string, sessions: Parameters<typeof attemptBudget>[1], ledgerNow: Parameters<typeof attemptBudget>[2]) => attemptBudget(readAttemptLog(attempts, run), sessions, ledgerNow, (role) => reserveFor(budget, role)),
  };
  const gate = (description: string, id: string) =>
    launchGate({ tool_name: "Agent", tool_use_id: id, transcript_path: join(transcripts, "s1.jsonl"), tool_input: { description } } as LaunchInput, { stateDir, branch: BRANCH, ledgerPath: () => ledger, measure: () => [], transcripts, now: T0, role: roleOf, attempts: adapter });
  const begin = (auditor: string) =>
    updateAttemptLog(attempts, "run", (log) => {
      const begun = beginAttempt(log, { step: { kind: "audit", subject: "a", role: "first-audit", auditor }, pipeline: { mode: "simplified", version: 2 }, inputs: { binding: "k" }, now: T0 });
      return { log: begun.log, result: begun.attempt };
    });
  return { root, attempts, ledger, gate, begin, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

test("in an attempt-tracked run a launch needs a pending attempt's marker; it is launched once, and never paid for twice", () => {
  const w = world();
  try {
    assert.match((w.gate("First audit A a", "toolu_1") as { reason: string }).reason, /begun as an attempt first/);
    const attempt = w.begin("A");
    const description = `First audit A a ${attemptMarker(attempt.id)}`;
    assert.equal(w.gate(description, "toolu_1").allow, true);
    assert.deepEqual([attemptIn(readAttemptLog(w.attempts, "run"), attempt.id).status, attemptIn(readAttemptLog(w.attempts, "run"), attempt.id).launch?.ref], ["running", "toolu_1"]);
    assert.equal(readLedger(w.ledger, "run").reservations.length, 1);
    // Launching the same attempt again (a retry that might duplicate a paid call) is refused, and reserves nothing.
    assert.match((w.gate(description, "toolu_2") as { reason: string }).reason, /is running, not pending/);
    assert.equal(readLedger(w.ledger, "run").reservations.length, 1);
  } finally {
    w.cleanup();
  }
});

test("an interrupted attempt with no reservation left still holds its reserve: recovery creates no spending authorization", () => {
  const w = world();
  try {
    // $20 cap, $5 headroom, $3 per audit: five launches fit.
    const ids = ["A", "B"].map((auditor) => w.begin(auditor));
    // A's launch was reserved, then interrupted; its reservation was released by a human, but no decision was taken on the attempt.
    updateAttemptLog(w.attempts, "run", (log) => ({ log: withAttempt(log, transition(transition(attemptIn(log, ids[0].id), "running", T0, "l"), "interrupted", T0, "gone")), result: undefined }));
    const status = attemptBudget(readAttemptLog(w.attempts, "run"), [], readLedger(w.ledger, "run"), (role) => reserveFor(budget, role));
    assert.equal(status.heldUsd, 3);
    // B launches; the interrupted A still holds $3: of the $15 under the cap, four launches fit, not the five a clean run allows.
    assert.equal(w.gate(`First audit B a ${attemptMarker(ids[1].id)}`, "toolu_b").allow, true);
    const more = ["x", "y", "z", "w"].map((auditor, index) => {
      const attempt = updateAttemptLog(w.attempts, "run", (log) => {
        const begun = beginAttempt(log, { step: { kind: "audit", subject: `c${index}`, role: "first-audit", auditor: "A" }, pipeline: { mode: "simplified", version: 2 }, inputs: { binding: auditor }, now: T0 });
        return { log: begun.log, result: begun.attempt };
      });
      return w.gate(`First audit A c${index} ${attemptMarker(attempt.id)}`, `toolu_${auditor}`).allow;
    });
    assert.deepEqual(more, [true, true, true, false]);
  } finally {
    w.cleanup();
  }
});

test("a run without attempt tracking launches as before: no marker is needed", () => {
  const w = world(false);
  try {
    assert.equal(w.gate("First audit A a", "toolu_1").allow, true);
  } finally {
    w.cleanup();
  }
});

test("v1 compatibility: legacy and simplified v1 runs never track attempts; v2 runs started now do; a step is never committed twice from one attempt", () => {
  const slice = pilotSlice(model(), ["g1"], REGISTRY);
  const start = (pipeline?: { mode: "legacy" | "simplified"; version: number }) => createL2RunState({ slice, remaining: ["a", "b"], branch: BRANCH, baseSha: "base", now: T0, ...(pipeline ? { pipeline } : {}) });
  assert.equal(start().l2!.attempts, undefined);
  assert.equal(start({ mode: "simplified", version: 1 }).l2!.attempts, undefined);
  assert.deepEqual(start({ mode: "simplified", version: 2 }).l2!.attempts, { version: 1 });
  // A persisted v2 run from before attempts existed has none, and stays without them.
  const older = JSON.parse(JSON.stringify(start({ mode: "simplified", version: 2 })));
  delete older.l2.attempts;
  assert.equal(older.l2.attempts, undefined);
  // Steps record the attempts they were committed from; the same attempt cannot commit the step again.
  let state = recordL2Step(start({ mode: "simplified", version: 2 }), { kind: "plan", subject: "g1" }, T0);
  state = recordL2Step(state, { kind: "author", subject: "a" }, T0, { fingerprint: "a1", attempts: ["att-1"] });
  assert.deepEqual(state.l2!.steps["author:a"].attempts, ["att-1"]);
  state = recordL2Step(recordL2Step(state, { kind: "author", subject: "b" }, T0, { fingerprint: "b1" }), { kind: "audit", subject: "a" }, T0, { fingerprint: "a1", attempts: ["att-2", "att-3"] });
  assert.throws(() => recordL2Step(state, { kind: "audit", subject: "a" }, T0, { fingerprint: "a1", attempts: ["att-3"] }), /already recorded from attempt\(s\) att-3: a duplicate commit/);
  // v1 steps carry no attempts field.
  let v1 = recordL2Step(start({ mode: "simplified", version: 1 }), { kind: "plan", subject: "g1" }, T0);
  v1 = recordL2Step(v1, { kind: "author", subject: "a" }, T0, { fingerprint: "a1" });
  assert.equal("attempts" in v1.l2!.steps["author:a"], false);
  assert.ok(STAGES.includes("done") && typeof completeStage === "function");
});
