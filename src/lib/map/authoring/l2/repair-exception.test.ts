import assert from "node:assert/strict";
import test from "node:test";
import { repairLimitSubject, resumeRun, stopRun, type RunState } from "../orchestrator/run-state.ts";
import { repairExceptionProblem } from "./repair.ts";

const T = "2026-10-08T00:00:00.000Z";
const run = { version: 1, kind: "l2", stage: "author", concepts: {}, completed: {}, checks: {} } as unknown as RunState;
const limit = (state: RunState) => stopRun(state, { subject: repairLimitSubject("a"), evidence: "two cycles", why: "needs a human", decision: "inspect" }, T);

test("the standing repair exception resolves a repair-limit stop once per concept, and no other stop", () => {
  assert.equal(repairExceptionProblem(limit(run)), undefined);
  // Once resolved (by a human or the exception), the same concept's next limit stop needs a human.
  assert.match(repairExceptionProblem(limit(resumeRun(limit(run), "one more", T)))!, /a already had its extra repair cycle/);
  assert.match(repairExceptionProblem(stopRun(run, { subject: "diff", evidence: "", why: "", decision: "" }, T))!, /only a repair-limit stop/);
  assert.match(repairExceptionProblem(run)!, /only a repair-limit stop/);
});
