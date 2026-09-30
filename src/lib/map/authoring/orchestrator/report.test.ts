import assert from "node:assert/strict";
import test from "node:test";
import { mapKnowledge } from "../../data.ts";
import { auditConcepts } from "./audit.ts";
import { validateContentDiff, CONTENT_FILES } from "./diff-check.ts";
import { orchestratorModel, registryOf, viewOf } from "./fixtures.ts";
import { planDomain } from "./plan.ts";
import { completionReport, contentCommitMessage, domainPhrase, fixCommitMessage, prBody, prTitle } from "./report.ts";
import { addFix, createRunState, recordCheck } from "./run-state.ts";

const NOW = "2026-09-30T00:00:00.000Z";
const TRAILER = "Co-Authored-By: Example <noreply@example.com>";

function finishedRun() {
  const model = orchestratorModel();
  let state = createRunState({ plan: planDomain(model, "d1", { authoredContent: registryOf(model) }), branch: "feat/map-d1-l1", baseSha: "abc", now: NOW });
  state = addFix(state, { kind: "test", message: "test(map): derive child expectations", files: ["src/lib/map/map.test.ts"], reason: "The test pinned authored state." });
  state = recordCheck(state, "test", true, "412 passing", NOW);
  return { ...state, title: "Domain Three & More", auditNotes: ["Tightened one definition."] };
}

test("domain phrases spell out ampersands for commit subjects", () => {
  assert.equal(domainPhrase("Identity, Accounts & Authority"), "identity, accounts and authority");
});

test("commit messages follow the semantic convention and carry the trailer", () => {
  const state = finishedRun();
  const message = contentCommitMessage(state, TRAILER);
  assert.equal(message.split("\n")[0], "feat(map): add domain three and more L1 content");
  assert.match(message, /Canonical exposition for single,/);
  assert.match(message, /Deferred to their owning domains: c, t\./);
  assert.ok(message.endsWith(`\n\n${TRAILER}\n`));
  assert.equal(fixCommitMessage(state.fixes[0]), "test(map): derive child expectations\n\nThe test pinned authored state.\n");
});

test("the PR text is generated from the run state and the validated diff", () => {
  const state = finishedRun();
  const base = orchestratorModel();
  const head = orchestratorModel({ authored: ["single"] });
  const diff = validateContentDiff({
    base, head, baseView: viewOf(base), headView: viewOf(head), baseRegistry: registryOf(base), headRegistry: registryOf(head),
    changedFiles: [...CONTENT_FILES], data: { added: [], deleted: 0 }, registry: { added: ['  "single",'], deleted: 0 }, expectedConcepts: ["single"], fixes: [], fixLines: 0,
  });
  assert.ok(diff.ok, diff.problems.join("\n"));
  assert.equal(prTitle(state), "MAP: Domain Three & More L1 content");
  const body = prBody(state, diff, "FOOTER");
  assert.match(body, /- \*\*Authored in this run:\*\* single\n/);
  assert.match(body, /- \*\*Deferred:\*\* c \(facet rule: authoring owned by Domain Two/);
  assert.match(body, /`test\(map\): derive child expectations`/);
  assert.match(body, /1 content records and 1 registry entries added; hasContent false → true at 1 placements\./);
  assert.match(body, /- Unit tests: 412 passing\n- Lint \(tracked tree\): not run/);
  assert.ok(body.endsWith("FOOTER\n"));
  const report = completionReport({ ...state, diff, pr: { number: 7, url: "https://example.com/7" }, ci: { status: "passing", at: NOW, detail: "build" } });
  assert.match(report, /^Domain Three & More: validated PR awaiting human merge\n/);
  assert.match(report, /\ndiff: 1 records, 1 registry entries, 1 hasContent flips; nothing else\n/);
  assert.match(report, /\nverified: test 412 passing\n/);
  assert.match(report, /PR: https:\/\/example.com\/7 \| CI: passing \(build\)$/);
  assert.ok(report.split("\n").length <= 8, "the completion report stays compact");
});

test("the audit reports facts about new content against parents, siblings and the corpus", () => {
  const model = orchestratorModel({ authored: ["c", "t"] });
  model.content = model.content.map((record) =>
    record.conceptId === "t"
      ? { ...record, body: [{ kind: "paragraph", text: "The topics below each carry part of the synthetic concept used by the orchestrator tests." }] }
      : record,
  );
  const [c, t] = auditConcepts(model, ["c", "t"]);
  assert.equal(t.blocks, "def+P");
  assert.equal(c.blocks, "def");
  assert.deepEqual(t.positional, ["The topics below each carry part of the synthetic concept used by the orchestrator tests."]);
  // The fixture definitions share one template, so every overlap class is populated.
  assert.ok(c.parentOverlap.some((entry) => entry.conceptId === "d1"));
  assert.ok(c.siblingOverlap.some((entry) => entry.conceptId === "t"));
  assert.ok(c.corpusOverlap.some((entry) => entry.conceptId === "k"));
  assert.ok(c.sharedDefinitionTemplate.includes("done"));
  assert.throws(() => auditConcepts(model, ["single"]), /no content for single/);
});

test("the audit runs over the canonical ontology's authored concepts", () => {
  const [audit] = auditConcepts(mapKnowledge, ["distributed-systems"]);
  assert.ok(audit.words > 50);
  assert.match(audit.blocks, /^def(\+[PHFDTS])*$/);
});
