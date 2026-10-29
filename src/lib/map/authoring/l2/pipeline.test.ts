import assert from "node:assert/strict";
import test from "node:test";
import type { MapConceptContent } from "../../types.ts";
import { createL2RepairRunState, createL2RunState, nextAction, pendingL2Steps, recordL2Step, RunStateError, type RunState } from "../orchestrator/run-state.ts";
import { pilotSlice, sliceSteps, stepKey } from "./campaign.ts";
import { conceptWorkOf, workProblems } from "./contracts.ts";
import { filledG1, model, options, REGISTRY } from "./fixtures.ts";
import { DEFAULT_ROUTING, parseRouting, PipelineError, pipelineOf, pipelineProblems, routingOf, startPipeline, topicLabelProblems } from "./pipeline.ts";
import { repairBaseline } from "./repair.ts";
import { planProblems, type L2GroupFile } from "./territory.ts";

const T0 = "2026-10-29T00:00:00.000Z";
const ALPHA: MapConceptContent = { id: "a-content", conceptId: "a", definition: "Alpha is how a sequence starts.", body: [{ kind: "paragraph", text: "A start prepares before it commits." }] };
const SIMPLIFIED = { mode: "simplified" as const, version: 1 };

const simplifiedRun = (): RunState => createL2RunState({ slice: pilotSlice(model(), ["g1"], REGISTRY), remaining: ["a", "b"], branch: "feat/map-x-l2-1", baseSha: "base", now: T0, pipeline: SIMPLIFIED });
/** g1 written for the simplified pipeline: topic-label claims, no concept work yet. */
function simplifiedG1(m = model()): L2GroupFile {
  const plan = { ...filledG1(m), pipeline: SIMPLIFIED };
  delete plan.concepts;
  return plan;
}

test("a pipeline is chosen per run at its current version; none declared is legacy", () => {
  assert.deepEqual(startPipeline(undefined), { mode: "legacy", version: 1 });
  assert.deepEqual(startPipeline("simplified"), { mode: "simplified", version: 1 });
  assert.throws(() => startPipeline("fast"), PipelineError);
  assert.deepEqual(pipelineOf(undefined), { mode: "legacy", version: 1 });
  assert.deepEqual(pipelineOf({}), { mode: "legacy", version: 1 });
  assert.deepEqual(pipelineProblems({ mode: "simplified", version: 2 }), ["simplified pipeline version 2 is not one this tooling knows (1..1)"]);
  assert.deepEqual(pipelineProblems({ mode: "other" as never, version: 1 }), ["unknown pipeline mode other"]);
  assert.deepEqual(pipelineProblems(undefined), []);
});

test("routing has per-mode defaults and per-role overrides; the simplified mode has no design role", () => {
  assert.equal(routingOf(startPipeline("simplified")).author, "opus");
  assert.equal(routingOf(startPipeline(undefined)).author, DEFAULT_ROUTING.legacy.author);
  const routed = startPipeline("simplified", "author=sonnet, repair=sonnet");
  assert.deepEqual(routed.routing, { author: "sonnet", repair: "sonnet" });
  assert.deepEqual([routingOf(routed).author, routingOf(routed)["first-audit"]], ["sonnet", "opus"]);
  assert.deepEqual(parseRouting("author=claude-sonnet-5-5", "simplified"), { author: "claude-sonnet-5-5" });
  assert.throws(() => parseRouting("design=opus", "simplified"), /no design role/);
  assert.equal(parseRouting("design=opus", "legacy").design, "opus");
  assert.throws(() => parseRouting("author=gpt", "simplified"), /unknown model gpt/);
  assert.throws(() => parseRouting("author", "simplified"), /not role=model/);
});

test("a topic label names a question and asserts nothing", () => {
  assert.deepEqual(topicLabelProblems("when acceptance happens and what checking costs on chain"), []);
  assert.match(topicLabelProblems("what metering does not capture: decoding, signatures").join(), /colon or semicolon/);
  assert.match(topicLabelProblems("fee destinations (burn, proposer)").join(), /parenthetical/);
  assert.match(topicLabelProblems("designs such as sidechains and channels").join(), /lists instances/);
  assert.match(topicLabelProblems("A check passes. The result takes effect").join(), /a sentence/);
  assert.match(topicLabelProblems(Array.from({ length: 25 }, () => "word").join(" ")).join(), /25 words/);
});

test("the simplified slice has no design steps; legacy keeps them, and a legacy run state (no pipeline) is unchanged", () => {
  const groups = [{ group: "g1", concepts: ["a", "b"] }];
  assert.deepEqual(sliceSteps(groups, "simplified").map(stepKey), ["plan:g1", "author:a", "audit:a", "author:b", "audit:b", "group-audit:g1"]);
  assert.deepEqual(sliceSteps(groups).map(stepKey), ["plan:g1", "design:a", "design:b", "author:a", "audit:a", "author:b", "audit:b", "group-audit:g1"]);
  const legacy = createL2RunState({ slice: pilotSlice(model(), ["g1"], REGISTRY), remaining: ["a", "b"], branch: "feat/map-x-l2-1", baseSha: "base", now: T0 });
  assert.equal(legacy.l2!.pipeline, undefined);
  assert.deepEqual(pendingL2Steps(legacy).map(stepKey).slice(0, 3), ["plan:g1", "design:a", "design:b"]);
});

test("a simplified run records plan, drafting and audits in order, refuses a design step, and points agents to its instructions", () => {
  let state = simplifiedRun();
  assert.deepEqual(state.l2!.pipeline, SIMPLIFIED);
  assert.match((nextAction(state) as { message: string }).message, /topic-label claims.*l2-simplified\/plan\.md/);
  assert.match((nextAction(state) as { message: string }).message, /--pipeline simplified/);
  state = recordL2Step(state, { kind: "plan", subject: "g1" }, T0);
  assert.throws(() => recordL2Step(state, { kind: "design", subject: "a" }, T0), (error: unknown) => error instanceof RunStateError && /design:a is not a step/.test(error.message));
  const author = (nextAction(state) as { message: string }).message;
  assert.match(author, /author a in a fresh context \(opus\)/);
  assert.match(author, /choosing its representation \(docs\/map-authoring\/l2-simplified\/author\.md\)/);
  assert.doesNotMatch(author, /its design/);
  for (const conceptId of ["a", "b"]) {
    state = recordL2Step(state, { kind: "author", subject: conceptId }, T0, { fingerprint: `${conceptId}-v1` });
    state = recordL2Step(state, { kind: "audit", subject: conceptId }, T0, { fingerprint: `${conceptId}-v1` });
  }
  assert.deepEqual(pendingL2Steps(state).map(stepKey), ["group-audit:g1"]);
});

test("a repair run keeps its slice's pipeline and carries no design steps under the simplified one", () => {
  let state = simplifiedRun();
  state = recordL2Step(state, { kind: "plan", subject: "g1" }, T0);
  for (const conceptId of ["a", "b"]) {
    state = recordL2Step(state, { kind: "author", subject: conceptId }, T0, { fingerprint: `${conceptId}-v1` });
    state = recordL2Step(state, { kind: "audit", subject: conceptId }, T0, { fingerprint: `${conceptId}-v1` });
  }
  const merged: RunState = { ...state, l2: { ...state.l2!, merged: { sha: "m", at: T0 } } };
  const repair = createL2RepairRunState(merged, { id: "x-1-repair-1", concepts: ["a"], reason: "review", baseline: repairBaseline([simplifiedG1()], ["a"]), branch: "fix/x", baseSha: "main", now: T0 });
  assert.deepEqual(repair.l2!.pipeline, SIMPLIFIED);
  assert.deepEqual(Object.keys(repair.l2!.steps), ["plan:g1"]);
  assert.deepEqual(pendingL2Steps(repair).map(stepKey), ["author:a", "audit:a", "group-audit:g1"]);
  assert.match((nextAction(repair) as { message: string }).message, /l2-simplified\/repair\.md/);
});

test("simplified concept work holds only audits: no model or design is required, and one is refused", () => {
  const m = model([ALPHA]);
  const plan = simplifiedG1(m);
  // No `concepts` key at all: the authored stage needs no work, and nothing crashes.
  assert.equal(conceptWorkOf(plan, "a"), undefined);
  assert.deepEqual(workProblems(plan, "a", m, "authored"), []);
  assert.deepEqual(workProblems(plan, "a", m, "audited"), ["a: the concept audit is missing"]);
  assert.match(workProblems(plan, "a", m, "designed").join(), /no design stage/);
  const withModel = { ...plan, concepts: { a: { model: { meaning: "x" }, design: { decision: "prose" } } } };
  assert.match(workProblems(withModel, "a", m, "authored").join(), /keeps no concept model or design/);
  const british = model([{ ...ALPHA, body: [{ kind: "paragraph", text: "A start's behaviour." }] }]);
  assert.match(workProblems(simplifiedG1(british), "a", british, "authored").join(), /British spelling/);
  // Legacy keeps requiring the model and design, and reports a missing entry instead of crashing on it.
  const legacy = filledG1(m);
  delete legacy.concepts;
  assert.deepEqual(workProblems(legacy, "a", m, "authored"), ["a: no concept work in g1"]);
});

test("a simplified plan's claims must be topic labels; a legacy plan's claims are not held to that", () => {
  const m = model();
  assert.deepEqual(planProblems(simplifiedG1(m), m, options), []);
  const asserting = simplifiedG1(m);
  asserting.members.find((member) => member.conceptId === "a")!.claims = ["how alpha starts: it prepares, then commits"];
  assert.match(planProblems(asserting, m, options).join(), /a: claim "how alpha starts: it prepares, then commits" is not a topic label: a colon or semicolon/);
  const legacy = filledG1(m);
  legacy.members.find((member) => member.conceptId === "a")!.claims = ["how alpha starts: it prepares, then commits"];
  assert.doesNotMatch(planProblems(legacy, m, options).join(), /topic label/);
  assert.match(planProblems({ ...simplifiedG1(m), pipeline: { mode: "simplified", version: 9 } }, m, options).join(), /version 9 is not one this tooling knows/);
});
