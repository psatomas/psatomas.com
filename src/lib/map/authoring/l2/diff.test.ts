import assert from "node:assert/strict";
import test from "node:test";
import type { MapConceptContent, MapKnowledgeModel } from "../../types.ts";
import { contentFingerprint } from "../representation/design.ts";
import type { L2ConceptWork } from "./contracts.ts";
import { validateL2Diff, type L2DiffInput } from "./diff.ts";
import { filledG1, filledG2, HAZARDS, model, REGISTRY } from "./fixtures.ts";
import { groupFile, type L2GroupFile } from "./territory.ts";

type Node = { placementId: string; hasContent: boolean; children: Node[] };
function viewOf(m: MapKnowledgeModel): { roots: Node[] } {
  const withContent = new Set(m.content.map((record) => record.conceptId));
  const node = (id: string): Node => ({
    placementId: id,
    hasContent: withContent.has(m.placements.find((placement) => placement.id === id)!.conceptId),
    children: m.placements.filter((placement) => placement.parentPlacementId === id).sort((a, b) => a.order - b.order).map((placement) => node(placement.id)),
  });
  return { roots: m.placements.filter((placement) => !placement.parentPlacementId).map((placement) => node(placement.id)) };
}

const record = (conceptId: string): MapConceptContent => ({ id: `${conceptId}-content`, conceptId, definition: `${conceptId} is defined.`, body: [{ kind: "paragraph", text: `How ${conceptId} works.` }] });
const work = (conceptId: string, claims: string[], decision: "prose" | "block" = "prose"): L2ConceptWork => ({
  model: { meaning: `${conceptId} meaning`, kind: "mechanism", parents: { g1: "what it adds" }, claims, excludes: [], placements: { [conceptId]: "holds" }, fields: { sequence: ["x"], failures: ["y"] } },
  design: decision === "prose"
    ? { decision, relationship: "r", whyProse: "argument", level: "here", territory: "own", placements: "one" }
    : { decision, relationship: "r", gap: { structure: "dependency", reason: "a dependency graph is the meaning" }, level: "here", territory: "own", placements: "one" },
});

/** g1 authored: a and b get records, work, audits and a group audit. */
function run({ blockB = false } = {}) {
  const base = model();
  const records = blockB ? [record("a")] : [record("a"), record("b")];
  const head = model(records);
  const plan = filledG1(base) as L2GroupFile & { groupAudit?: unknown };
  plan.concepts = { a: work("a", ["how alpha starts"]), b: work("b", ["how beta follows"], blockB ? "block" : "prose") };
  for (const entry of records) (plan.concepts[entry.conceptId] as L2ConceptWork).audit = { at: "t", note: "judged", resolutions: [], recordFingerprint: contentFingerprint(entry) };
  plan.groupAudit = { at: "t", note: "boundaries hold", resolutions: [], records: { a: contentFingerprint(records[0]), b: contentFingerprint(records[1]) } };
  const input: L2DiffInput = {
    base,
    head,
    baseView: viewOf(base),
    headView: viewOf(head),
    baseRegistry: REGISTRY,
    headRegistry: [...REGISTRY, ...records.map((entry) => entry.conceptId)],
    changedFiles: ["src/lib/map/data.ts", "src/lib/map/authoring/content-registry.ts", "src/components/map/explorer-view.generated.json", groupFile("g1")],
    data: { added: ["    {", '      id: "a-content",'], deleted: 0 },
    registry: { added: records.map((entry) => `  "${entry.conceptId}",`), deleted: 0 },
    fixes: [],
    fixLines: 0,
    groups: ["g1"],
    basePlans: [filledG2(base)],
    headPlans: [plan, filledG2(base)],
    signals: {},
    groupSignals: {},
    hazards: HAZARDS,
  };
  return input;
}

test("a run's diff is its groups' owned concepts, registered, flipped, planned and audited, and nothing else", () => {
  const report = validateL2Diff(run());
  assert.deepEqual(report.problems, []);
  assert.deepEqual([report.authored.sort(), report.blocked, report.flipped], [["a", "b"], [], ["a", "b"]]);
});

test("a member whose design blocks it stays unauthored, and the run is still valid", () => {
  const report = validateL2Diff(run({ blockB: true }));
  assert.deepEqual(report.problems, []);
  assert.deepEqual([report.authored, report.blocked], [["a"], ["b"]]);
});

test("another group's plan, a missing audit, a changed parent or an unexpected record is refused", () => {
  const otherPlan = run();
  const g2 = filledG2();
  g2.members.find((member) => member.conceptId === "t")!.claims = ["how tango moves, changed"];
  otherPlan.headPlans = [otherPlan.headPlans[0], g2];
  assert.match(validateL2Diff(otherPlan).problems.join(), /another group's plan changed: g2/);

  const unaudited = run();
  delete (unaudited.headPlans[0].concepts.b as L2ConceptWork).audit;
  assert.match(validateL2Diff(unaudited).problems.join(), /b: the concept audit is missing/);

  const unresolved = run();
  unresolved.signals = { a: ["dated:1"] };
  assert.match(validateL2Diff(unresolved).problems.join(), /a: signal dated:1 is unresolved/);

  const parentEdited = run();
  parentEdited.head = { ...parentEdited.head, content: parentEdited.head.content.map((entry) => (entry.conceptId === "g1" ? { ...entry, definition: "Group One, edited." } : entry)) };
  const problems = validateL2Diff(parentEdited).problems.join("\n");
  assert.match(problems, /existing content changed: g1/);
  assert.match(problems, /g1 is stale: parent g1 changed/);

  const extra = run();
  extra.head = model([record("a"), record("b"), record("t")]);
  extra.headView = viewOf(extra.head);
  assert.match(validateL2Diff(extra).problems.join(), /added content \["a","b","t"\] differs from the run's authored concepts/);

  const missingFile = run();
  missingFile.changedFiles = missingFile.changedFiles.filter((file) => !file.endsWith("g1.json"));
  assert.match(validateL2Diff(missingFile).problems.join(), /the run's group file .*g1\.json is unchanged/);
});
