import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import type { MapConceptContent } from "../../types.ts";
import { createL2RunState, pendingL2Steps, recordL2Step, reopenL2, type RunState } from "../orchestrator/run-state.ts";
import { contentFingerprint } from "../representation/design.ts";
import { pilotSlice, stepKey } from "./campaign.ts";
import { withConceptAudit, workProblems, type L2Audit } from "./contracts.ts";
import { filledG1, model, REGISTRY } from "./fixtures.ts";
import { repairBaseline, repairScopeProblems } from "./repair.ts";
import type { L2GroupFile } from "./territory.ts";

// Repair scope under both pipelines: the baseline a reopen takes of a concept's model and design must compare equal
// to the same model and design after the repair, however the concept-work entry is shaped (absent, audit-only, or
// carrying a model and design).

const T0 = "2026-10-30T00:00:00.000Z";
const ALPHA: MapConceptContent = { id: "a-content", conceptId: "a", definition: "Alpha is how a sequence starts.", body: [{ kind: "paragraph", text: "A start prepares before it commits." }] };
const REPAIRED: MapConceptContent = { ...ALPHA, body: [{ kind: "paragraph", text: "A start prepares, then commits." }] };
const audit = (record: MapConceptContent): L2Audit => ({ at: T0, note: "judged", resolutions: [], recordFingerprint: contentFingerprint(record) });
const scope = (baseline: ReturnType<typeof repairBaseline>, plans: L2GroupFile[], redesigned: string[] = []) =>
  repairScopeProblems({ baseline, reopened: ["a"], plans, redesigned: new Set(redesigned), replanned: new Set() });

/** g1 under the simplified pipeline, with no concept work yet. */
function simplifiedG1(): L2GroupFile {
  const plan: L2GroupFile = { ...filledG1(), pipeline: { mode: "simplified", version: 1 } };
  delete plan.concepts;
  return plan;
}
/** g1 under the legacy pipeline, with a's model and design. */
function legacyG1(meaning = "Alpha is how a sequence starts."): L2GroupFile {
  return { ...filledG1(), concepts: { a: { model: { meaning, kind: "mechanism" }, design: { decision: "prose" } } } };
}

test("simplified: a first audit that fails, a reopen, a repair and a re-audit that creates the audit-only entry (the rehearsal's B1)", () => {
  // The run: plan recorded, a drafted; its first audit fails, so nothing is recorded and the group file holds no entry.
  let state: RunState = createL2RunState({ slice: pilotSlice(model(), ["g1"], REGISTRY), remaining: ["a", "b"], branch: "feat/map-x-l2-1", baseSha: "base", now: T0, pipeline: { mode: "simplified", version: 1 } });
  state = recordL2Step(state, { kind: "plan", subject: "g1" }, T0);
  state = recordL2Step(state, { kind: "author", subject: "a" }, T0, { fingerprint: contentFingerprint(ALPHA) });
  const before = simplifiedG1();
  assert.equal(before.concepts, undefined);
  // The reopen captures the absent-work baseline.
  const baseline = repairBaseline([before], ["a"]);
  state = reopenL2(state, { concepts: ["a"], reason: "first audit A FAIL: B1", baseline, now: T0 });
  assert.equal(state.l2!.repair!.baseline.work.a, baseline.work.a);
  assert.deepEqual(pendingL2Steps(state).map(stepKey).slice(0, 2), ["author:a", "audit:a"]);
  // Re-recording the repaired draft is within scope: the file still holds no entry.
  assert.deepEqual(scope(baseline, [before]), []);
  state = recordL2Step(state, { kind: "author", subject: "a" }, T0, { fingerprint: contentFingerprint(REPAIRED) });
  // The re-audit's --audit-file creates the audit-only entry: no model or design moved, so it is accepted.
  const after = withConceptAudit(simplifiedG1(), "a", audit(REPAIRED));
  assert.deepEqual(Object.keys(after.concepts!.a as object), ["audit"]);
  assert.deepEqual(scope(baseline, [after]), []);
  const m = model([REPAIRED]);
  assert.deepEqual(workProblems(after, "a", m, "audited"), []);
  state = recordL2Step(state, { kind: "audit", subject: "a" }, T0, { fingerprint: contentFingerprint(REPAIRED) });
  assert.equal(state.l2!.steps["audit:a"].fingerprint, contentFingerprint(REPAIRED));
});

test("simplified: a model or design that appears during a repair is still caught by the scope check", () => {
  const baseline = repairBaseline([simplifiedG1()], ["a"]);
  const smuggled = { ...simplifiedG1(), concepts: { a: { model: { meaning: "m" }, audit: audit(ALPHA) } } };
  assert.match(scope(baseline, [smuggled]).join(), /a: its model or design changed without being recorded again/);
  // And the simplified contract refuses it on its own terms as well.
  assert.match(workProblems(smuggled, "a", model([ALPHA]), "audited").join(), /keeps no concept model or design/);
});

test("simplified: a repair after a recorded audit (a group-audit finding) keeps working", () => {
  const audited = withConceptAudit(simplifiedG1(), "a", audit(ALPHA));
  const baseline = repairBaseline([audited], ["a"]);
  assert.deepEqual(scope(baseline, [withConceptAudit(simplifiedG1(), "a", audit(REPAIRED))]), []);
  // The baseline of an audit-only entry equals that of no entry: the fingerprint is of the model and design only.
  assert.equal(baseline.work.a, repairBaseline([simplifiedG1()], ["a"]).work.a);
});

test("legacy: a model or design changed in a repair is rejected unless the design is recorded again", () => {
  const baseline = repairBaseline([legacyG1()], ["a"]);
  // A new audit on the same model and design is within scope.
  assert.deepEqual(scope(baseline, [withConceptAudit(legacyG1(), "a", audit(REPAIRED))]), []);
  // A changed model is rejected, and accepted once its design step is recorded again in the repair.
  const remodelled = legacyG1("Alpha is how every sequence starts.");
  assert.match(scope(baseline, [remodelled]).join(), /a: its model or design changed without being recorded again in the repair \(`l2 record design a`\)/);
  assert.deepEqual(scope(baseline, [remodelled], ["a"]), []);
  // Removing the model and design is a change too.
  const stripped = { ...legacyG1(), concepts: { a: { audit: audit(ALPHA) } } };
  assert.match(scope(baseline, [stripped]).join(), /a: its model or design changed/);
});

test("legacy: fingerprints of entries with a model and design are unchanged, so recorded baselines stay comparable", () => {
  // The same model and design fingerprint alike with or without an audit, and absent work stays distinct from them.
  const withModel = repairBaseline([legacyG1()], ["a"]).work.a;
  // The formula baselines were recorded with before this fix: sha256 of the JSON of { model, design }, or of null.
  const recorded = (value: unknown) => createHash("sha256").update(JSON.stringify(value ?? null)).digest("hex");
  const work = legacyG1().concepts!.a as { model: unknown; design: unknown };
  assert.equal(withModel, recorded({ model: work.model, design: work.design }));
  assert.equal(repairBaseline([simplifiedG1()], ["a"]).work.a, recorded(null));
  assert.equal(repairBaseline([withConceptAudit(legacyG1(), "a", audit(ALPHA))], ["a"]).work.a, withModel);
  assert.notEqual(repairBaseline([simplifiedG1()], ["a"]).work.a, withModel);
});
