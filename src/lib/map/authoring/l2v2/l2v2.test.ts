import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  advance, applyClaimFixes, applyPatches, changedRecords, escalationReasons, newBatch, planReviewProblems, resumeBatch, reviewProblems, sample, stopBatch, stopReason, verifyProblems, weighted,
  type ConceptReview, type Finding, type LedgerEntry,
} from "./core.ts";
import { batchDir, DATA, groupPath, loadBatch, loadLedger, REGISTRY, runBatch, type Env, type SessionResult } from "./driver.ts";

const T = "2026-10-09T00:00:00.000Z";
const record = (id: string, text: string) => ["    {", `      id: "${id}-content",`, `      conceptId: "${id}",`, `      definition: "Definition of ${id}.",`, "      body: [", `        { kind: "paragraph", text: ${JSON.stringify(text)} },`, "      ],", "    },"].join("\n");
const dataFile = (records: string[]) => ["export const mapKnowledge = {", "  content: [", ...records, "  ],", "  mechanisms: [", "  ],", "};", ""].join("\n");
const defect = (concept: string, quote: string, replacement: string, rule = "overclaim"): Finding => ({ concept, severity: "defect", rule, quote, replacement, why: "test" });

// ---------------------------------------------------------------- pure core

test("exact repairs apply only to a unique quote inside the concept's own record, never to protected content", () => {
  const source = dataFile([record("a", 'It always "holds".'), record("b", "It always holds. It always holds.")]);
  const { source: out, results } = applyPatches(source, [defect("a", 'It always "holds".', "It holds under synchrony."), defect("b", "It always holds.", "x"), defect("c", "q", "r")], new Set());
  assert.deepEqual(results.map((r) => r.applied), [true, false, false]);
  assert.match(results[1].problem!, /occurs 2 times/);
  assert.match(out, /It holds under synchrony\./);
  assert.deepEqual(changedRecords(source, out, new Set(["a"])), []);
  assert.deepEqual(applyPatches(source, [defect("a", "always", "often")], new Set(["a"])).results[0].problem, "a is accepted content outside this batch");
  // A remark is never applied.
  assert.equal(applyPatches(source, [{ ...defect("a", "always", "often"), severity: "remark" }], new Set()).results.length, 0);
});

test("claim fixes change one claim exactly and keep the model's copy identical", () => {
  const file = JSON.stringify({ members: [{ conceptId: "a", claims: ["every node agrees", "how it fails"] }], concepts: { a: { model: { claims: ["every node agrees", "how it fails"] } } } });
  const fixed = applyClaimFixes(file, [{ concept: "a", quote: "every node agrees", replacement: "correct nodes agree", why: "" }]);
  const parsed = JSON.parse(fixed.text);
  assert.deepEqual([fixed.problems, parsed.members[0].claims[0], parsed.concepts.a.model.claims[0]], [[], "correct nodes agree", "correct nodes agree"]);
  assert.equal(applyClaimFixes(file, [{ concept: "a", quote: "missing", replacement: "x", why: "" }]).problems.length, 1);
});

const review = (over: Partial<ConceptReview> = {}): ConceptReview => ({ verdict: "pass", confidence: "high", findings: [], coverage: [{ claim: 0, mechanism: true, conditions: true, failureOrConfusion: true }], note: "checked", resolutions: [], ...over });

test("session outputs are refused unless complete: a pass cannot hide a defect, a defect needs its replacement", () => {
  assert.deepEqual(reviewProblems({ concepts: { a: review() }, group: { note: "n", findings: [], resolutions: [] } }, ["a"], { group: true }), []);
  assert.match(reviewProblems({ concepts: { a: review({ findings: [defect("a", "q", "r")] }) } }, ["a"], { group: false }).join(), /a pass cannot carry a defect/);
  assert.match(reviewProblems({ concepts: { a: review({ verdict: "defect", findings: [{ ...defect("a", "q", "r"), replacement: undefined }] }) } }, ["a"], { group: false }).join(), /exact replacement/);
  assert.match(reviewProblems({ concepts: {} }, ["a"], { group: false }).join(), /no review for a/);
  assert.match(verifyProblems({ concepts: {} }, ["a"]).join(), /no verification for a/);
  assert.deepEqual(planReviewProblems({ verdict: "pass", claimFixes: [], note: "" }, ["a"]), []);
  assert.match(planReviewProblems({ verdict: "stop", claimFixes: [], note: "" }, ["a"]).join(), /stopReason/);
});

test("escalation follows findings, confidence, coverage and concept facts, not a feature list alone", () => {
  const facts = { placements: 1, domainOrder: 3 };
  assert.deepEqual(escalationReasons(review(), facts, false), []);
  assert.match(escalationReasons(review({ confidence: "medium" }), facts, false).join(), /confidence/);
  assert.match(escalationReasons(review({ verdict: "defect", findings: [defect("a", "q", "r", "formal-results")] }), facts, false).join(), /formal result/);
  assert.match(escalationReasons(review({ coverage: [{ claim: 0, mechanism: true, conditions: false, failureOrConfusion: true }] }), facts, false).join(), /not fully covered/);
  assert.match(escalationReasons(review(), { placements: 2, domainOrder: 20 }, true).join(), /claim was corrected.*placements.*emerging/);
});

test("stop rules: cost, escalation, parking, sampled defects and the usage meter", () => {
  const session = (group: string, w: number, at = T): LedgerEntry => ({ kind: "session", at, slice: "s", group, role: "draft", sessionId: "x", durationMs: 60000, turns: 3, usage: { input_tokens: w, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 }, weighted: w });
  const batch = (group: string, accepted: number, extra: Partial<Extract<LedgerEntry, { kind: "batch" }>> = {}, at = T): LedgerEntry => ({ kind: "batch", at, slice: "s", group, accepted, parked: 0, escalated: 0, defects: 0, ...extra });
  const cheap = ["g1", "g2", "g3"].flatMap((g) => [session(g, 300_000), batch(g, 5)]);
  assert.equal(stopReason(cheap), undefined);
  assert.match(stopReason(["g1", "g2", "g3"].flatMap((g) => [session(g, 900_000), batch(g, 5)]))!, /last 3 batches/);
  assert.match(stopReason([...cheap, session("g4", 1), batch("g4", 1, { escalated: 7 })])!, /escalated/);
  assert.match(stopReason([...cheap, batch("g4", 3, { parked: 1 })])!, /parked/);
  assert.match(stopReason([...cheap, ...Array.from({ length: 8 }, (_, i): LedgerEntry => ({ kind: "deep-audit", at: T, label: "s", concept: `c${i}`, substantive: 1 }))])!, /deep-audited/);
  const metered: LedgerEntry[] = [{ kind: "meter", at: "2026-10-09T00:00:00Z", percent: 10 }, session("g9", 1, "2026-10-09T01:00:00Z"), batch("g9", 5, {}, "2026-10-09T01:00:00Z"), { kind: "meter", at: "2026-10-09T02:00:00Z", percent: 12 }];
  assert.match(stopReason(metered)!, /usage meter/);
  assert.equal(weighted({ input_tokens: 10, output_tokens: 10, cache_creation_input_tokens: 100, cache_read_input_tokens: 1000 }), 10 + 50 + 125 + 100);
});

test("batch state only moves forward; a stopped batch needs a human resume; sampling is deterministic", () => {
  let state = newBatch("s", "g", ["a"], T);
  state = advance(state, "planned", T);
  assert.throws(() => advance(state, "pending", T), /cannot move/);
  state = stopBatch(state, "why", T);
  assert.throws(() => advance(state, "drafted", T), /stopped/);
  assert.equal(resumeBatch(state, "planned", T).status, "planned");
  assert.deepEqual(sample(["a", "b", "c", "d"], 2, "seed"), sample(["a", "b", "c", "d"], 2, "seed"));
});

// ---------------------------------------------------------------- the driver, against a fake Claude

type Script = Partial<Record<string, (root: string, prompt: string) => void>>;
function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), "l2v2-"));
  mkdirSync(join(root, "src/lib/map/authoring/l2/groups"), { recursive: true });
  cpSync(join(import.meta.dirname, "../../../../../scripts/l2v2/prompts"), join(root, "scripts/l2v2/prompts"), { recursive: true });
  writeFileSync(join(root, DATA), dataFile([record("old", "Accepted text.")]));
  writeFileSync(join(root, REGISTRY), 'export const AUTHORED_CONTENT_CONCEPTS = [\n  "old",\n];\n');
  return root;
}
const appendRecord = (root: string, id: string, text: string) => {
  writeFileSync(join(root, DATA), readFileSync(join(root, DATA), "utf8").replace("  ],\n  mechanisms: [", `${record(id, text)}\n  ],\n  mechanisms: [`));
  writeFileSync(join(root, REGISTRY), readFileSync(join(root, REGISTRY), "utf8").replace("];", `  "${id}",\n];`));
};
const out = (root: string, prompt: string) => join(root, prompt.match(/(\.map-authoring\/l2v2\/\S+?\.json)/)![1]);
const conceptsOk = (ids: string[]) => Object.fromEntries(ids.map((id) => [id, review()]));

function fakeEnv(root: string, script: Script): Env & { calls: string[] } {
  const calls: string[] = [];
  let n = 0;
  return {
    root,
    calls,
    now: () => T,
    async session({ role, prompt, resume }): Promise<SessionResult> {
      const key = resume ? `${role}:resume` : role;
      calls.push(key);
      (script[key] ?? script[role])?.(root, prompt);
      return { sessionId: resume ?? `s${++n}`, usage: { input_tokens: 0, output_tokens: 100, cache_creation_input_tokens: 1000, cache_read_input_tokens: 10000 }, durationMs: 1000, turns: 2, isError: false, text: "done" };
    },
    check: async () => [],
    signals: async () => [],
    groupSignals: async () => [],
    context: async (id) => `{"concept":"${id}"}`,
    territory: async () => "{}",
    facts: async () => ({ placements: 1, domainOrder: 2 }),
  };
}
const happy: Script = {
  plan: (root) => writeFileSync(join(root, groupPath("g")), `${JSON.stringify({ members: [{ conceptId: "x", claims: ["c"] }, { conceptId: "y", claims: ["c"] }] }, null, 2)}\n`),
  "plan-review": (root, p) => writeFileSync(out(root, p), JSON.stringify({ verdict: "pass", claimFixes: [], note: "ok" })),
  draft: (root) => (appendRecord(root, "x", "Nodes always agree."), appendRecord(root, "y", "Fine text.")),
  review: (root, p) => writeFileSync(out(root, p), JSON.stringify({ concepts: { ...conceptsOk(["y"]), x: review({ verdict: "defect", findings: [defect("x", "Nodes always agree.", "Correct nodes agree under synchrony.", "examples")] }) }, group: { note: "side by side", findings: [], resolutions: [] } })),
  "review:resume": (root, p) => writeFileSync(out(root, p), JSON.stringify({ concepts: { x: { verdict: "pass", findings: [], note: "repair verified", resolutions: [] }, y: { verdict: "pass", findings: [], note: "ok", resolutions: [] } } })),
};

test("a batch goes plan → plan review → draft → review → exact repair → verification → accepted, touching only its own records", async () => {
  const root = fixture();
  const env = fakeEnv(root, happy);
  const state = await runBatch(env, { slice: "s", group: "g", concepts: ["x", "y"], protectedIds: new Set(["old"]) });
  assert.equal(state.status, "accepted", state.stop?.reason);
  assert.deepEqual(env.calls, ["plan", "plan-review", "draft", "review", "review:resume"]);
  const data = readFileSync(join(root, DATA), "utf8");
  assert.match(data, /Correct nodes agree under synchrony\./);
  assert.match(data, /Accepted text\./);
  const audit = JSON.parse(readFileSync(join(root, batchDir("s", "g"), "audit-x.json"), "utf8"));
  assert.match(audit.note, /review: checked \| review verification 1: repair verified/);
  const ledger = loadLedger(root);
  assert.equal(ledger.filter((e) => e.kind === "session").length, 5);
  assert.deepEqual(ledger.filter((e) => e.kind === "batch").map((e) => (e as { accepted: number }).accepted), [2]);
  // Idempotent: an accepted batch runs nothing more.
  await runBatch(env, { slice: "s", group: "g", concepts: ["x", "y"], protectedIds: new Set(["old"]) });
  assert.equal(env.calls.length, 5);
});

test("a run interrupted after drafting resumes without duplicating records", async () => {
  const root = fixture();
  const crashing = fakeEnv(root, { ...happy, review: () => { throw new Error("usage limit"); } });
  await assert.rejects(runBatch(crashing, { slice: "s", group: "g", concepts: ["x", "y"], protectedIds: new Set(["old"]) }), /usage limit/);
  assert.equal(loadBatch(root, "s", "g")!.status, "drafted");
  const state = await runBatch(fakeEnv(root, happy), { slice: "s", group: "g", concepts: ["x", "y"], protectedIds: new Set(["old"]) });
  assert.equal(state.status, "accepted");
  const data = readFileSync(join(root, DATA), "utf8");
  assert.equal(data.split('id: "x-content",').length - 1, 1);
  assert.equal(readFileSync(join(root, REGISTRY), "utf8").split('"x",').length - 1, 1);
});

test("a session that changes accepted content outside its batch stops the batch", async () => {
  const root = fixture();
  const state = await runBatch(fakeEnv(root, { ...happy, draft: (r) => (happy.draft!(r, ""), writeFileSync(join(r, DATA), readFileSync(join(r, DATA), "utf8").replace("Accepted text.", "Rewritten."))) }), { slice: "s", group: "g", concepts: ["x", "y"], protectedIds: new Set(["old"]) });
  assert.equal(state.status, "stopped");
  assert.match(state.stop!.reason, /changed records outside its batch: old/);
});

test("a defect that survives two verified repair rounds is parked: removed from the tree, the batch stops for a human", async () => {
  const root = fixture();
  const stubborn: Script = { ...happy, "review:resume": (r, p) => writeFileSync(out(r, p), JSON.stringify({ concepts: { x: { verdict: "defect", findings: [defect("x", "Correct nodes agree under synchrony.", "Still wrong.")], note: "", resolutions: [] }, y: { verdict: "pass", findings: [], note: "ok", resolutions: [] } } })) };
  const state = await runBatch(fakeEnv(root, stubborn), { slice: "s", group: "g", concepts: ["x", "y"], protectedIds: new Set(["old"]) });
  assert.equal(state.status, "stopped");
  assert.equal(state.conceptStates.x.state, "parked");
  assert.equal(state.conceptStates.y.state, "accepted");
  const data = readFileSync(join(root, DATA), "utf8");
  assert.doesNotMatch(data, /x-content/);
  assert.match(data, /y-content/);
  assert.doesNotMatch(readFileSync(join(root, REGISTRY), "utf8"), /"x"/);
  assert.match(stopReason(loadLedger(root))!, /parked/);
});
