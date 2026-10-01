import assert from "node:assert/strict";
import test from "node:test";
import type { MapConceptContent, MapKnowledgeModel } from "../../types.ts";
import { orchestratorModel, registryOf } from "../orchestrator/fixtures.ts";
import { REPRESENTATION_CATALOG, STRUCTURES } from "./catalog.ts";
import { acceptedContentProblems, aggregate, auditRepresentation, conceptsAtLevel, mutations, usageOf } from "./audit.ts";
import { capabilityGaps, contentFingerprint, designStatus, emptyStore, placementsOf, profileOf, recordDesign, validateDesign, type RepresentationDesign } from "./design.ts";
import { validateRefactorDiff } from "./refactor-diff.ts";

/**
 * The orchestrator's synthetic ontology with L1 content: single (one
 * placement, prose only), c (two child-carrying placements, owned by Domain
 * Two under the facet rule, with a distinction) and t (carried in Domain Two,
 * a leaf in Domain One).
 */
function model(): MapKnowledgeModel {
  const base = orchestratorModel({ authored: ["single", "c", "t"] });
  const bodies: Record<string, MapConceptContent["body"]> = {
    single: [{ kind: "paragraph", text: "Single explained." }],
    c: [{ kind: "paragraph", text: "Concept explained." }, { kind: "distinction", left: "Concept", right: "Kilo" }],
    t: [{ kind: "paragraph", text: "Transit explained." }],
  };
  return { ...base, content: base.content.map((record) => (bodies[record.conceptId] ? { ...record, body: bodies[record.conceptId] } : record)) };
}

const design = (conceptId: string, overrides: Partial<RepresentationDesign> = {}): RepresentationDesign => ({
  conceptId,
  classification: "keep",
  model: { purpose: "a synthetic purpose" },
  representation: [{ structure: "prose", purpose: "the reasoning is causal" }],
  reasoning: "prose carries it",
  ...overrides,
});
const record = (m: MapKnowledgeModel, conceptId: string) => m.content.find((candidate) => candidate.conceptId === conceptId);
const check = (m: MapKnowledgeModel, value: RepresentationDesign) => validateDesign(value, record(m, value.conceptId), placementsOf(m, value.conceptId));

test("the catalog names every structure once, and only gaps lack a block", () => {
  assert.deepEqual(REPRESENTATION_CATALOG.map((entry) => entry.structure).sort(), [...STRUCTURES].sort());
  for (const entry of REPRESENTATION_CATALOG) assert.equal(entry.block === undefined, entry.fit === "gap", entry.structure);
});

test("a profile describes the current form: sequence, words and structured blocks", () => {
  const m = model();
  assert.deepEqual(profileOf(record(m, "single")!), { sequence: "def+P", kinds: { paragraph: 1 }, words: 12, structured: [], proseOnly: true });
  assert.deepEqual(profileOf(record(m, "c")!).structured, ["distinction"]);
  assert.equal(profileOf(record(m, "c")!).proseOnly, false);
});

test("placement facts follow the runbook's ownership: one carrier, the preferred carrier, else the preferred placement", () => {
  const m = model();
  assert.deepEqual(placementsOf(m, "single"), { placements: [{ placementId: "single", level: "L1", domainId: "d1" }], carriers: 1, ownerDomainId: "d1" });
  const c = placementsOf(m, "c");
  assert.deepEqual([c.carriers, c.ownerDomainId, c.placements.length], [2, "d2", 2]);
  const t = placementsOf(m, "t");
  assert.deepEqual([t.carriers, t.ownerDomainId, t.placements.length], [1, "d2", 2]);
});

test("a prose-only keep is a valid decision when it matches the record", () => {
  assert.deepEqual(check(model(), design("single")), []);
});

test("each classification must be consistent with the current form", () => {
  const m = model();
  const flow = { structure: "process" as const, purpose: "the stages are ordered" };
  assert.match(check(m, design("single", { representation: [{ structure: "prose", purpose: "x" }, flow] })).join(), /keep recommends the current form/);
  assert.deepEqual(check(m, design("single", { classification: "enhance", representation: [{ structure: "prose", purpose: "x" }, flow] })), []);
  assert.match(check(m, design("single", { classification: "enhance" })).join(), /enhance adds a structure/);
  assert.match(check(m, design("single", { classification: "refactor" })).join(), /refactor changes the record's form/);
  // Removing a structure that does not earn its place is a refactor.
  const facets = { canonicalNote: "holds in both domains", facetNote: "names both facets" };
  assert.deepEqual(check(m, design("c", { classification: "refactor", ...facets })), []);
  assert.match(check(m, design("single", { classification: "rewrite" })).join(), /rewrite needs a concrete justification/);
  assert.deepEqual(check(m, design("single", { classification: "rewrite", rewriteJustification: "a claim is wrong" })), []);
  assert.match(check(m, design("single", { rewriteJustification: "stray" })).join(), /only a rewrite/);
});

test("a design needs a purpose, reasoning and known structures with purposes", () => {
  const problems = check(model(), design("single", { model: { purpose: " " }, reasoning: "", representation: [{ structure: "mosaic" as never, purpose: "" }] })).join("\n");
  for (const expected of [/needs a purpose/, /needs reasoning/, /unknown structure "mosaic"/, /structure "mosaic" needs a purpose/]) assert.match(problems, expected);
  assert.match(check(model(), design("single", { representation: [] })).join(), /at least one structure/);
});

test("multi-placement concepts need a canonical note; multi-carrier concepts also need a facet note", () => {
  const m = model();
  assert.match(check(m, design("t")).join(), /2 placements: the design needs a canonical note/);
  assert.deepEqual(check(m, design("t", { canonicalNote: "true as a leaf in Domain One" })), []);
  const keepC = design("c", { representation: [{ structure: "prose", purpose: "x" }, { structure: "distinction", purpose: "a real conflation" }] });
  assert.match(check(m, keepC).join(), /facet note/);
  assert.deepEqual(check(m, { ...keepC, canonicalNote: "both domains", facetNote: "relates both layers" }), []);
});

test("structures without a block are capability gaps, never silently mapped to a block", () => {
  const m = model();
  const loop = design("single", { classification: "enhance", representation: [{ structure: "prose", purpose: "x" }, { structure: "state", purpose: "transitions can return" }] });
  assert.deepEqual(check(m, loop), []);
  assert.deepEqual(capabilityGaps(loop), ["state"]);
  // Cycle and comparison have blocks of their own: native, not gaps.
  const native = design("single", { classification: "enhance", representation: [{ structure: "prose", purpose: "x" }, { structure: "cycle", purpose: "feeds back" }, { structure: "comparison", purpose: "alternatives by dimensions" }] });
  assert.deepEqual([check(m, native), capabilityGaps(native)], [[], []]);
  assert.match(check(m, { ...loop, classification: "keep" }).join(), /no capability gap/);
});

test("designs bind to the content they judged: pending, designed, stale, invalid", () => {
  const m = model();
  const facts = placementsOf(m, "single");
  assert.equal(designStatus(undefined, record(m, "single"), facts).status, "pending");
  const store = recordDesign(emptyStore("d1"), design("single"), record(m, "single"), facts, "2026-10-01T00:00:00Z");
  const stored = store.designs.single;
  assert.equal(stored.contentFingerprint, contentFingerprint(record(m, "single")));
  assert.equal(designStatus(stored, record(m, "single"), facts).status, "designed");
  const edited = { ...record(m, "single")!, definition: "Single, revised." };
  assert.equal(designStatus(stored, edited, facts).status, "stale");
  assert.equal(designStatus({ ...stored, reasoning: "" }, record(m, "single"), facts).status, "invalid");
});

test("recording refuses an invalid design and a concept owned by another domain, and replaces an earlier design", () => {
  const m = model();
  const facts = placementsOf(m, "single");
  assert.throws(() => recordDesign(emptyStore("d1"), design("single", { reasoning: "" }), record(m, "single"), facts, "now"), /invalid design for single/);
  assert.throws(() => recordDesign(emptyStore("d2"), design("single"), record(m, "single"), facts, "now"), /owned by d1, not d2/);
  const once = recordDesign(emptyStore("d1"), design("single"), record(m, "single"), facts, "first");
  const twice = recordDesign(once, design("single", { reasoning: "second thoughts" }), record(m, "single"), facts, "second");
  assert.deepEqual([Object.keys(twice.designs), twice.designs.single.reasoning], [["single"], "second thoughts"]);
});

test("the audit reads concept, domain or corpus scope in canonical order and never changes the model", () => {
  const m = model();
  const frozen = structuredClone(m);
  assert.deepEqual(conceptsAtLevel(m, 1), ["c", "single", "done", "t", "k"]);
  const stores = [recordDesign(emptyStore("d1"), design("single"), record(m, "single"), placementsOf(m, "single"), "now")];
  const all = auditRepresentation(m, stores, { all: true });
  assert.deepEqual(all.map((entry) => [entry.conceptId, entry.status]), [["c", "pending"], ["single", "designed"], ["done", "pending"], ["t", "pending"], ["k", "pending"]]);
  assert.deepEqual(auditRepresentation(m, stores, { domainId: "d2" }).map((entry) => entry.conceptId), ["c", "t"]);
  assert.deepEqual(auditRepresentation(m, stores, { conceptId: "single" }).map((entry) => entry.conceptId), ["single"]);
  assert.throws(() => auditRepresentation(m, stores, { conceptId: "a" }), /not an L1 concept with content/);
  assert.deepEqual(m, frozen);
  assert.deepEqual(aggregate(all), { concepts: 5, status: { pending: 4, designed: 1 }, classification: { keep: 1 }, recommended: { prose: 1 }, capabilityGaps: {} });
  assert.deepEqual(usageOf(m, ["single", "c"]), { records: 2, proseOnly: 1, kinds: { paragraph: 2, distinction: 1 }, recordsUsing: { paragraph: 2, distinction: 1 } });
});

test("audit mode refuses to judge uncommitted content and reports any mutation", () => {
  const files = ["src/lib/map/data.ts", "src/lib/map/authoring/content-registry.ts"];
  assert.deepEqual(acceptedContentProblems(["README.md"], files), []);
  assert.match(acceptedContentProblems(["src/lib/map/data.ts"], files).join(), /uncommitted changes/);
  const before = { head: "a".repeat(40), branch: "main", contentFiles: { "src/lib/map/data.ts": "1" } };
  assert.deepEqual(mutations(before, structuredClone(before)), []);
  assert.deepEqual(mutations(before, { head: "b".repeat(40), branch: "feat/x", contentFiles: { "src/lib/map/data.ts": "2" } }), [
    "HEAD moved from aaaaaaa to bbbbbbb",
    "branch changed from main to feat/x",
    "src/lib/map/data.ts changed",
  ]);
});

test("a future refactor may change only records with a current improvement design", () => {
  const base = model();
  const facts = (conceptId: string) => placementsOf(base, conceptId);
  const enhanceSingle = recordDesign(emptyStore("d1"), design("single", { classification: "enhance", representation: [{ structure: "prose", purpose: "x" }, { structure: "process", purpose: "ordered" }] }), record(base, "single"), facts("single"), "now").designs.single;
  const keepT = recordDesign(emptyStore("d2"), design("t", { canonicalNote: "both" }), record(base, "t"), facts("t"), "now").designs.t;
  const withBody = (m: MapKnowledgeModel, conceptId: string, text: string) => ({ ...m, content: m.content.map((entry) => (entry.conceptId === conceptId ? { ...entry, body: [{ kind: "paragraph" as const, text }] } : entry)) });
  const input = (head: MapKnowledgeModel, overrides = {}) => ({
    base,
    head,
    baseRegistry: registryOf(base),
    headRegistry: registryOf(head),
    baseView: { roots: [] },
    headView: { roots: [] },
    designs: [enhanceSingle, keepT],
    changedFiles: ["src/lib/map/data.ts"],
    ...overrides,
  });

  assert.deepEqual(validateRefactorDiff(input(withBody(base, "single", "Single, now with its stages."))), { ok: true, problems: [], changed: ["single"] });
  assert.match(validateRefactorDiff(input(withBody(base, "t", "Transit rewritten."))).problems.join(), /t changed without an accepted improvement design/);
  const staleBase = withBody(base, "single", "Changed after the design.");
  assert.match(validateRefactorDiff({ ...input(withBody(staleBase, "single", "Refactored.")), base: staleBase }).problems.join(), /judged different content than the base/);
  const added = { ...base, content: [...base.content, { id: "a-content", conceptId: "a", definition: "Alpha." }] };
  assert.match(validateRefactorDiff(input(added)).problems.join(), /content added: a/);
  const removed = { ...base, content: base.content.filter((entry) => entry.conceptId !== "k") };
  assert.match(validateRefactorDiff(input(removed)).problems.join(), /content removed: k/);
  assert.match(validateRefactorDiff(input(base, { headView: { roots: [1] } })).problems.join(), /generated explorer view changed/);
  assert.match(validateRefactorDiff(input(base, { changedFiles: ["src/lib/map/data.ts", "src/lib/map/authoring/content-registry.ts"] })).problems.join(), /unexpected changed file/);
  assert.match(validateRefactorDiff(input({ ...base, placements: base.placements.slice(1) })).problems.join(), /placements changed/);
  assert.match(validateRefactorDiff(input(base, { headRegistry: [...registryOf(base), "extra"] })).problems.join(), /registry changed/);
});
