import assert from "node:assert/strict";
import test from "node:test";
import type { MapConceptContent } from "../../types.ts";
import { contentFingerprint } from "../representation/design.ts";
import { assembleL2Context } from "./context.ts";
import { designProblems, groupAuditProblems, modelProblems, recordDesignProblems, workProblems, type L2ConceptWork, type L2Design } from "./contracts.ts";
import { filledG1, model, options } from "./fixtures.ts";
import { conceptSignals, containment, driftReport, groupSignals, mentionedConcepts } from "./signals.ts";

const work = (): L2ConceptWork => ({
  model: {
    meaning: "Alpha is how a sequence starts.",
    kind: "mechanism",
    parents: { g1: "the conditions under which a start is valid, which the group only names" },
    claims: ["how alpha starts"],
    excludes: [],
    placements: { a: "its only placement; the group introduces it" },
    fields: { sequence: ["prepare", "commit"], failures: ["a start that commits twice"] },
  },
  design: { decision: "prose", relationship: "conditions and their consequences", whyProse: "a causal argument with no order or branch", level: "the start is alpha's own mechanism", territory: "beta's following is named, not drawn", placements: "one placement" },
});
const ALPHA: MapConceptContent = { id: "a-content", conceptId: "a", definition: "Alpha is how a sequence starts.", body: [{ kind: "paragraph", text: "A start prepares before it commits, and committing twice breaks the sequence." }] };

test("a concept model works out its kind and carries the plan, every parent and every placement", () => {
  const plan = filledG1();
  assert.deepEqual(modelProblems(work(), "a", plan, model()), []);
  const broken = work();
  broken.model.kind = "property";
  broken.model.fields = { statement: "x", sequence: ["y"], violatedBy: [] };
  broken.model.claims = ["something else"];
  broken.model.parents = {};
  broken.model.placements = { a: " " };
  const problems = modelProblems(broken, "a", plan, model()).join("\n");
  for (const expected of [/field "sequence" belongs to no property model/, /a property model works out at least 2/, /field "violatedBy" is empty/, /claims must be the plan's/, /parents must be exactly g1/, /placement a: say why/]) assert.match(problems, expected);
  assert.match(modelProblems(work(), "b", plan, model()).join(), /claims must be the plan's/);
});

test("a failure is its own kind: causes and manifestations, not an attacker's preconditions and defences", () => {
  const plan = filledG1();
  const failure = work();
  failure.model.kind = "failure";
  failure.model.fields = { causes: ["a stalled relay", "a reorganization"], manifestation: ["one leg confirmed, the other not"], impact: ["funds stranded"] };
  assert.deepEqual(modelProblems(failure, "a", plan, model()), []);
  // An attack's fields do not describe a failure, and a failure's do not describe an attack.
  failure.model.fields = { preconditions: ["x"], defences: ["y"], causes: ["z"] };
  const problems = modelProblems(failure, "a", plan, model()).join("\n");
  assert.match(problems, /field "preconditions" belongs to no failure model/);
  assert.match(problems, /a failure model works out at least 2 of causes, manifestation, impact, detection, recovery/);
  const attack = work();
  attack.model.kind = "attack";
  attack.model.fields = { preconditions: ["x"], mechanism: ["y"], recovery: ["z"] };
  assert.match(modelProblems(attack, "a", plan, model()).join(), /field "recovery" belongs to no attack model/);
});

test("a design decides prose, structure or block, and justifies the decision both ways", () => {
  assert.deepEqual(designProblems(work().design), []);
  const structure: L2Design = { ...work().design, decision: "structure", structures: [{ structure: "state", purpose: "modes and returns", whyNotProse: "the return is lost in prose" }], division: "prose says why; the model shows the transitions" };
  delete structure.whyProse;
  assert.deepEqual(designProblems(structure), []);
  assert.match(designProblems({ ...structure, division: undefined }).join(), /says what the prose explains/);
  assert.match(designProblems({ ...structure, structures: [{ structure: "dependency", purpose: "x", whyNotProse: "y" }] }).join(), /"dependency" is no structured block/);
  assert.match(designProblems({ ...work().design, whyProse: undefined }).join(), /a prose decision says why/);
  assert.match(designProblems({ ...work().design, decision: "block" }).join(), /a block decision records the missing structure/);
  assert.deepEqual(designProblems({ ...work().design, decision: "block", whyProse: undefined, gap: { structure: "dependency", reason: "a shared dependency graph is the meaning" } }), []);
  assert.match(designProblems({ ...work().design, territory: " " }).join(), /needs "territory"/);
});

test("the authored record must write exactly the designed structures", () => {
  assert.deepEqual(recordDesignProblems(work().design, ALPHA), []);
  const withState: MapConceptContent = { ...ALPHA, body: [...ALPHA.body!, { kind: "state", label: "Modes", states: ["A", "B"], transitions: [{ from: "A", to: "B", when: "x" }, { from: "B", to: "A", when: "y" }] }] };
  assert.match(recordDesignProblems(work().design, withState).join(), /writes state; the design decided prose only/);
  assert.match(recordDesignProblems(work().design, undefined).join(), /no record/);
});

test("work is checked stage by stage, and an audit binds to exactly the record it judged", () => {
  const plan = filledG1();
  plan.concepts = { a: work() };
  const authored = model([ALPHA]);
  assert.deepEqual(workProblems(plan, "a", model(), "designed"), []);
  assert.match(workProblems(plan, "a", model(), "authored").join(), /no record has been authored/);
  assert.deepEqual(workProblems(plan, "a", authored, "authored"), []);
  assert.match(workProblems(plan, "a", authored, "audited", ["names-concept:1"]).join(), /the concept audit is missing/);
  (plan.concepts.a as L2ConceptWork).audit = { at: "t", note: "judged", resolutions: [{ id: "names-concept:1", resolution: "named only" }], recordFingerprint: contentFingerprint(ALPHA) };
  assert.deepEqual(workProblems(plan, "a", authored, "audited", ["names-concept:1"]), []);
  assert.match(workProblems(plan, "a", authored, "audited", ["names-concept:1", "dated:2"]).join(), /signal dated:2 is unresolved/);
  const edited = model([{ ...ALPHA, definition: "Alpha, rewritten." }]);
  assert.match(workProblems(plan, "a", edited, "audited", ["names-concept:1"]).join(), /changed after its audit/);
  assert.match(workProblems(plan, "b", authored, "designed").join(), /no concept work/);
});

test("the group audit covers every owned member as authored", () => {
  const plan = { ...filledG1(), groupAudit: { at: "t", note: "boundaries hold", resolutions: [], records: { a: contentFingerprint(ALPHA), b: contentFingerprint(undefined) } } };
  assert.deepEqual(groupAuditProblems(plan, model([ALPHA])), []);
  assert.match(groupAuditProblems(plan, model([{ ...ALPHA, definition: "Changed." }])).join(), /a changed after the group audit/);
  assert.match(groupAuditProblems(filledG1(), model()).join(), /group audit is missing/);
});

const signalsFor = (record: MapConceptContent, extra: Partial<Parameters<typeof conceptSignals>[0]> = {}) => {
  const m = model([record]);
  return conceptSignals({ conceptId: record.conceptId, record, context: assembleL2Context(record.conceptId, m, [filledG1(m)], options), model: m, neighbours: [], domainOrder: 0, ...extra });
};
const checks = (signals: { check: string }[]) => [...new Set(signals.map((entry) => entry.check))].sort();

test("deterministic findings: positional and dated language, a repeated or circular definition, other concepts named", () => {
  const record: MapConceptContent = {
    id: "a-content",
    conceptId: "a",
    definition: "Alpha is the alpha step that starts a sequence of moves.",
    body: [
      { kind: "paragraph", text: "As shown above, it starts. Alpha is the alpha step that starts a sequence of moves. Today Group One needs it." },
      { kind: "paragraph", text: "Beta follows it, and Tango is unrelated." },
    ],
  };
  const signals = signalsFor(record);
  assert.deepEqual(checks(signals.filter((entry) => entry.kind === "deterministic")), ["circular-definition", "dated", "definition-repeated", "names-concept", "positional"]);
  // Two-word titles are found anywhere; single-word titles only for nearby concepts (b is a sibling, t a hazard partner).
  assert.deepEqual(mentionedConcepts(record, model([record]), "a", new Set(["b", "t"])), ["b", "g1", "t"]);
  assert.deepEqual(signalsFor(ALPHA).filter((entry) => entry.kind === "deterministic"), []);
});

test("heuristic signals: parent and neighbour overlap, absolutes, unhedged speculation, math, narrated structure, an unused model", () => {
  const parentEcho: MapConceptContent = { ...ALPHA, body: [{ kind: "paragraph", text: "Alphas come first in every group of things." }] };
  assert.ok(checks(signalsFor(parentEcho)).includes("parent-overlap"));
  const neighbour: MapConceptContent = { id: "b-content", conceptId: "b", definition: "Beta follows.", body: [{ kind: "paragraph", text: "A start prepares before it commits, and committing twice breaks the sequence." }] };
  assert.ok(checks(signalsFor(ALPHA, { neighbours: [neighbour] })).includes("neighbour-overlap"));
  const absolute: MapConceptContent = { ...ALPHA, body: [{ kind: "paragraph", text: "It always works, never fails and cannot be stopped; x = y." }] };
  assert.deepEqual(checks(signalsFor(absolute)).filter((check) => ["absolutes", "math"].includes(check)), ["absolutes", "math"]);
  const assertive: MapConceptContent = { ...ALPHA, body: [{ kind: "paragraph", text: Array.from({ length: 12 }, () => "Machines own property and sign contracts.").join(" ") }] };
  assert.ok(checks(signalsFor(assertive, { domainOrder: 25 })).includes("speculative"));
  assert.ok(!checks(signalsFor(assertive, { domainOrder: 3 })).includes("speculative"));
  const narrated: MapConceptContent = { ...ALPHA, body: [{ kind: "flow", label: "Start", stages: [["Prepare the start"], ["Commit the start"]] }, { kind: "paragraph", text: "First prepare the start, then commit the start." }] };
  assert.ok(checks(signalsFor(narrated)).includes("prose-narrates-structure"));
  const unused = { ...work(), model: { ...work().model, fields: { sequence: ["validators exchange signatures across quorums"], failures: ["equivocation"] } } };
  assert.ok(checks(signalsFor(ALPHA, { work: unused })).includes("model-unused"));
  assert.deepEqual(signalsFor(ALPHA).filter((entry) => entry.kind === "heuristic"), []);
});

test("group signals: siblings overlapping, a shared opening, and one form for every member", () => {
  const same = (conceptId: string, title: string): { conceptId: string; title: string; record: MapConceptContent } => ({
    conceptId,
    title,
    record: { id: `${conceptId}-content`, conceptId, definition: `${title} is the part of a protocol that decides ${conceptId}.`, body: [{ kind: "distinction", left: `${title} one`, right: `${title} two` }, { kind: "paragraph", text: `A shared sentence about how protocols handle ${conceptId} under load.` }] },
  });
  const signals = groupSignals([same("a", "Alpha"), same("b", "Beta"), same("s", "Shared"), same("t", "Tango")]);
  assert.deepEqual(checks(signals), ["shared-form", "shared-opening", "sibling-overlap"]);
  assert.ok(containment("one two three four five", "zero one two three four five six") === 1);
});

test("the drift report describes a window and flags convergence without asking for more or fewer structures", () => {
  const uniform = Array.from({ length: 12 }, (_, index) => ({
    title: `Thing ${index}`,
    record: { id: `t${index}-content`, conceptId: `t${index}`, definition: `Thing ${index} is the mechanism by which work ${index} happens.`, body: [{ kind: "paragraph" as const, text: `This mechanism matters because ${"word ".repeat(30)}.` }, { kind: "paragraph" as const, text: `This mechanism fails when ${"word ".repeat(30)}.` }] },
  }));
  const report = driftReport(uniform);
  assert.equal(report.window, 12);
  assert.deepEqual(checks(report.signals), ["drift-opener", "drift-opening", "drift-uniform-length"]);
  // Uniform prose alone never trips the form flag: prose is a valid majority, not a target to diversify away from.
  assert.equal(report.signals.some((entry) => entry.check === "drift-form"), false);
  assert.deepEqual(driftReport(uniform.slice(0, 5)).signals, []);
});
