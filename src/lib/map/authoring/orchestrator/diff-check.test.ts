import assert from "node:assert/strict";
import test from "node:test";
import type { MapKnowledgeModel } from "../../types.ts";
import { CONTENT_FILES, MAX_FIX_LINES, validateContentDiff, validateFixes, type DiffInput } from "./diff-check.ts";
import { orchestratorModel, registryOf, viewOf } from "./fixtures.ts";

const base = orchestratorModel();
const head = orchestratorModel({ authored: ["c", "t"] });
const TEST_FIX = { kind: "test", message: "test(map): derive child expectations from the registry", files: ["src/lib/map/map.test.ts"] };

function input(overrides: Partial<DiffInput> & { head?: MapKnowledgeModel } = {}): DiffInput {
  const after = overrides.head ?? head;
  return {
    base,
    head: after,
    baseView: viewOf(base),
    headView: viewOf(after),
    baseRegistry: registryOf(base),
    headRegistry: registryOf(after),
    changedFiles: [...CONTENT_FILES],
    data: { added: ["  {", '    id: "c-content",', '    conceptId: "c",', "  },"], deleted: 0 },
    registry: { added: ['  "c",', '  "t",'], deleted: 0 },
    expectedConcepts: ["c", "t"],
    fixes: [],
    fixLines: 0,
    ...overrides,
  };
}
const problems = (overrides: Parameters<typeof input>[0]) => validateContentDiff(input(overrides)).problems;

test("a content-only run passes, flipping hasContent at every placement of the authored concepts", () => {
  const report = validateContentDiff(input());
  assert.deepEqual(report.problems, []);
  assert.ok(report.ok);
  assert.deepEqual(report.addedConcepts.sort(), ["c", "t"]);
  assert.deepEqual(report.registryAdded.sort(), ["c", "t"]);
  assert.deepEqual(report.flipped, ["c", "c-in-d2", "t", "t-in-d1"]);
});

test("files outside the content set fail unless a declared fix owns them, and declared fix files must change", () => {
  const changedFiles = [...CONTENT_FILES, "src/lib/map/map.test.ts"];
  assert.deepEqual(problems({ changedFiles }), ["unexpected changed file: src/lib/map/map.test.ts"]);
  assert.ok(validateContentDiff(input({ changedFiles, fixes: [TEST_FIX], fixLines: 12 })).ok);
  assert.deepEqual(problems({ fixes: [TEST_FIX], fixLines: 12 }), ["declared fix files without changes: src/lib/map/map.test.ts"]);
});

test("changed or removed accepted content fails", () => {
  const edited = orchestratorModel({ authored: ["c", "t"] });
  edited.content = edited.content.map((record) => (record.conceptId === "done" ? { ...record, definition: "Rewritten." } : record));
  assert.ok(problems({ head: edited }).includes("existing content changed: done"));
  const removed = orchestratorModel({ authored: ["c", "t"] });
  removed.content = removed.content.filter((record) => record.conceptId !== "done");
  assert.ok(problems({ head: removed, headRegistry: registryOf(removed).concat("done") }).includes("existing content removed: done"));
  assert.ok(problems({ data: { added: [], deleted: 2 } })[0].startsWith("data.ts deletes 2 line(s)"));
});

test("content or registrations beyond or short of the recorded concepts fail", () => {
  assert.match(problems({ expectedConcepts: ["c"] }).join("\n"), /added content \["c","t"\] differs/);
  assert.match(problems({ expectedConcepts: ["c", "t", "single"] }).join("\n"), /registry additions/);
  const extra = orchestratorModel({ authored: ["c", "t", "single"] });
  assert.match(problems({ head: extra, headRegistry: registryOf(head) }).join("\n"), /added content \["c","single","t"\] differs/);
  assert.match(problems({ headRegistry: [...registryOf(head), "single"] }).join("\n"), /registry additions \["c","single","t"\] differ/);
});

test("duplicate records or registrations fail even when the concept set matches", () => {
  const doubled = orchestratorModel({ authored: ["c", "t"] });
  doubled.content = [...doubled.content, { id: "c-content-2", conceptId: "c", definition: "Again." }];
  assert.ok(problems({ head: doubled }).includes("several content records for: c"));
  assert.ok(problems({ headRegistry: [...registryOf(head), "c"] }).includes("duplicate registry entries: c"));
});

test("taxonomy, relationship, mechanism and path changes fail", () => {
  const moved = orchestratorModel({ authored: ["c", "t"] });
  moved.placements = moved.placements.map((placement) => (placement.id === "q" ? { ...placement, order: 5 } : placement));
  assert.ok(problems({ head: moved }).includes("placements changed; a content run changes none"));
  const renamed = orchestratorModel({ authored: ["c", "t"] });
  renamed.concepts = renamed.concepts.map((concept) => (concept.id === "single" ? { ...concept, title: "Renamed" } : concept));
  assert.ok(problems({ head: renamed }).includes("concepts changed; a content run changes none"));
  const related = orchestratorModel({ authored: ["c", "t"] });
  related.relationships = [{ id: "r1", sourceConceptId: "c", targetConceptId: "t", typeId: "dependsOn" }];
  assert.ok(problems({ head: related }).includes("relationships changed; a content run changes none"));
  const pathed = orchestratorModel({ authored: ["c", "t"] });
  pathed.knowledgePaths = [{ id: "p1" } as MapKnowledgeModel["knowledgePaths"][number]];
  assert.ok(problems({ head: pathed }).includes("knowledgePaths changed; a content run changes none"));
});

test("registry removals, stray registry lines and code added to data.ts fail", () => {
  assert.ok(problems({ baseRegistry: [...registryOf(base), "ghost"] }).includes("registry entries removed: ghost"));
  assert.match(problems({ registry: { added: ['  "c",', "export const extra = 1;"], deleted: 0 } }).join("\n"), /adds lines that are not entries: export const extra = 1;/);
  assert.match(problems({ registry: { added: ['  "c",'], deleted: 1 } }).join("\n"), /registry file deletes 1 line/);
  assert.match(problems({ data: { added: ["export const hidden = true;"], deleted: 0 } }).join("\n"), /data.ts adds code, not content records: export const hidden = true;/);
});

test("generated-view changes beyond the expected hasContent flips fail", () => {
  const relabeled = viewOf(head);
  relabeled.roots[0].label = "Renamed";
  assert.ok(problems({ headView: relabeled }).includes("generated view changed beyond a hasContent flip at d1"));
  assert.match(problems({ headView: viewOf(base) }).join("\n"), /hasContent flips \[\] differ/);
  const unflipped = viewOf(orchestratorModel({ authored: ["c", "t", "single"] }));
  assert.match(problems({ headView: unflipped }).join("\n"), /hasContent flips \["c","c-in-d2","single","t","t-in-d1"\] differ/);
  const reordered = viewOf(head);
  reordered.roots.reverse();
  assert.ok(problems({ headView: reordered }).includes("generated view placements or their order changed"));
});

test("the fix policy admits small test and tooling fixes only", () => {
  assert.deepEqual(validateFixes([TEST_FIX], 12), []);
  assert.deepEqual(validateFixes([{ kind: "fix", message: "fix(map): keep the parent section boundary", files: ["src/lib/map/authoring/context.ts", "src/lib/map/authoring/context.test.ts"] }]), []);
  assert.deepEqual(validateFixes([{ kind: "test", message: "test(map): new browser check", files: ["e2e/map/interaction.mts"] }]), []);
  const rejected = (fix: { kind: string; message: string; files: string[] }, lines = 0) => validateFixes([fix], lines).join("\n");
  assert.match(rejected({ kind: "feat", message: "feat(map): anything", files: ["src/lib/map/map.test.ts"] }), /kind must be test or fix/);
  assert.match(rejected({ kind: "test", message: "fix(map): mislabeled", files: ["src/lib/map/map.test.ts"] }), /must be "test\(map\): <what>"/);
  assert.match(rejected({ kind: "test", message: "test(map): x", files: ["src/lib/map/authoring/context.ts"] }), /outside what a test\(map\) fix may change/);
  assert.match(rejected({ kind: "fix", message: "fix(map): x", files: ["src/components/map/concept-exposition.tsx"] }), /outside what a fix\(map\) fix may change/);
  assert.match(rejected({ kind: "fix", message: "fix(map): x", files: ["src/lib/map/resolver.ts"] }), /outside/);
  assert.match(rejected({ kind: "fix", message: "fix(map): x", files: ["src/lib/map/data.ts"] }), /is a content file/);
  assert.match(rejected({ kind: "fix", message: "fix(map): x", files: [] }), /no files/);
  assert.match(rejected(TEST_FIX, MAX_FIX_LINES + 1), /materially larger/);
  assert.match(validateFixes([TEST_FIX, { ...TEST_FIX, message: "test(map): second" }]).join("\n"), /belongs to two fixes/);
  // A diff that relies on a rejected fix is rejected too.
  const changedFiles = [...CONTENT_FILES, "src/components/map/concept-exposition.tsx"];
  assert.ok(!validateContentDiff(input({ changedFiles, fixes: [{ kind: "fix", message: "fix(map): x", files: ["src/components/map/concept-exposition.tsx"] }], fixLines: 3 })).ok);
});
