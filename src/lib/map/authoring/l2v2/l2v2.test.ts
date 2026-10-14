import assert from "node:assert/strict";
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import test from "node:test";
import {
  acceptanceProblems, advance, allowedTools, applyClaimFixes, applyPatches, escalationReasons, finalizeCommands, newBatch, planBatches, planReviewProblems, resumeBatch, reviewProblems,
  sample, sampleProblems, stopBatch, stopReason, verifyProblems, weighted,
  type ConceptReview, type Finding, type LedgerEntry,
} from "./core.ts";
import { runClaude, SessionError } from "./claude.ts";
import { acquireLock, batchDir, DATA, groupPath, loadBatch, loadLedger, REGISTRY, repairAfterAudit, runBatch, type Env } from "./driver.ts";
import type { SessionResult } from "./claude.ts";

const T = "2026-10-09T00:00:00.000Z";
const record = (id: string, text: string) => ["    {", `      id: "${id}-content",`, `      conceptId: "${id}",`, `      definition: "Definition of ${id}.",`, "      body: [", `        { kind: "paragraph", text: ${JSON.stringify(text)} },`, "      ],", "    },"].join("\n");
const dataFile = (records: string[]) => ["export const mapKnowledge = {", "  concepts: [", '    { id: "x" },', "  ],", "  content: [", ...records, "  ],", "  mechanisms: [", "  ],", "};", ""].join("\n");
const defect = (concept: string, quote: string, replacement: string, rule = "overclaim"): Finding => ({ concept, severity: "defect", rule, quote, replacement, why: "test" });
const review = (over: Partial<ConceptReview> = {}): ConceptReview => ({ verdict: "pass", confidence: "high", findings: [], coverage: [{ claim: 0, mechanism: true, conditions: true, failureOrConfusion: true }], note: "checked", resolutions: [], ...over });

// ---------------------------------------------------------------- pure core

test("exact repairs apply only to a unique quote inside the concept's own record, never to protected content", () => {
  const source = dataFile([record("a", 'It always "holds".'), record("b", "It always holds. It always holds.")]);
  const { source: out, results } = applyPatches(source, [defect("a", 'It always "holds".', "It holds under synchrony."), defect("b", "It always holds.", "x"), defect("c", "q", "r")], new Set());
  assert.deepEqual(results.map((r) => r.applied), [true, false, false]);
  assert.match(results[1].problem!, /occurs 2 times/);
  assert.match(out, /It holds under synchrony\./);
  assert.match(applyPatches(source, [defect("a", "always", "often")], new Set(["a"])).results[0].problem!, /protected/);
  assert.equal(applyPatches(source, [{ ...defect("a", "always", "often"), severity: "remark" }], new Set()).results.length, 0);
});

test("claim fixes change one claim exactly and keep the model's copy identical", () => {
  const file = JSON.stringify({ members: [{ conceptId: "a", claims: ["every node agrees", "how it fails"] }], concepts: { a: { model: { claims: ["every node agrees", "how it fails"] } } } });
  const fixed = applyClaimFixes(file, [{ concept: "a", quote: "every node agrees", replacement: "correct nodes agree", why: "" }]);
  const parsed = JSON.parse(fixed.text);
  assert.deepEqual([fixed.problems, parsed.members[0].claims[0], parsed.concepts.a.model.claims[0]], [[], "correct nodes agree", "correct nodes agree"]);
  assert.equal(applyClaimFixes(file, [{ concept: "a", quote: "missing", replacement: "x", why: "" }]).problems.length, 1);
});

test("outputs are refused unless complete, consistent and stamped with this session's run token", () => {
  const ok = { run: "r1", concepts: { a: review() }, group: { note: "n", findings: [], resolutions: [] } };
  assert.deepEqual(reviewProblems(ok, ["a"], { group: true, run: "r1" }), []);
  assert.match(reviewProblems(ok, ["a"], { group: true, run: "r2" }).join(), /stale or foreign/);
  assert.match(reviewProblems({ run: "r", concepts: { a: review({ findings: [defect("a", "q", "r")] }) } }, ["a"], { group: false, run: "r" }).join(), /a pass cannot carry a defect/);
  assert.match(reviewProblems({ run: "r", concepts: { a: review({ verdict: "defect" }) } }, ["a"], { group: false, run: "r" }).join(), /must name each defect/);
  assert.match(reviewProblems({ run: "r", concepts: { a: review({ verdict: "defect", findings: [{ ...defect("a", "q", "r"), replacement: undefined }] }) } }, ["a"], { group: false, run: "r" }).join(), /exact replacement/);
  assert.match(reviewProblems({ run: "r", concepts: { a: review({ coverage: [] }) } }, ["a"], { group: false, run: "r" }).join(), /coverage must list/);
  assert.deepEqual(planReviewProblems({ run: "r", verdict: "pass", claimFixes: [], note: "" }, ["a"], "r"), []);
  assert.match(planReviewProblems({ run: "r", verdict: "stop", claimFixes: [], note: "" }, ["a"], "r").join(), /stopReason/);
});

test("a verification must answer every defect by id, and a withdrawal needs its reason", () => {
  const v = (defects: unknown[]) => ({ run: "r", concepts: { a: { verdict: "pass", findings: [], defects, note: "", resolutions: [] } } });
  assert.match(verifyProblems(v([]), ["a"], { a: ["d1"] }, "r").join(), /defect d1 needs status/);
  assert.match(verifyProblems(v([{ id: "d1", status: "withdrawn", why: "" }]), ["a"], { a: ["d1"] }, "r").join(), /needs its reason/);
  assert.deepEqual(verifyProblems(v([{ id: "d1", status: "fixed", why: "" }]), ["a"], { a: ["d1"] }, "r"), []);
});

test("escalation follows findings, confidence, coverage and concept facts", () => {
  const facts = { placements: 1, domainOrder: 3 };
  assert.deepEqual(escalationReasons(review(), facts, false), []);
  assert.match(escalationReasons(review({ confidence: "medium" }), facts, false).join(), /confidence/);
  assert.match(escalationReasons(review({ verdict: "defect", findings: [defect("a", "q", "r", "formal-results")] }), facts, false).join(), /formal result/);
  assert.match(escalationReasons(review({ coverage: [{ claim: 0, mechanism: true, conditions: false, failureOrConfusion: true }] }), facts, false).join(), /not fully covered/);
  assert.match(escalationReasons(review(), { placements: 2, domainOrder: 20 }, true).join(), /claim was corrected.*placements.*emerging/);
});

test("batch state moves one step at a time; resume never skips forward", () => {
  let state = newBatch("s", "g", ["a"], T);
  state = advance(state, "planned", T);
  assert.throws(() => advance(state, "drafted", T), /cannot move/);
  state = stopBatch(advance(state, "plan-reviewed", T), "why", T);
  assert.equal(state.stop!.status, "plan-reviewed");
  assert.throws(() => resumeBatch(state, "accepted", T), /earned/);
  assert.throws(() => resumeBatch(state, "drafted", T), /would skip stages/);
  assert.equal(resumeBatch(state, "planned", T).status, "planned");
  assert.throws(() => resumeBatch(newBatch("s", "g", ["a"], T), "pending", T), /not stopped/);
});

test("acceptance requires every defect verified or withdrawn, full coverage, adequate confidence and the second review when escalated", () => {
  const state = newBatch("s", "g", ["a"], T);
  assert.match(acceptanceProblems(state, "a").join(), /never reviewed/);
  state.conceptStates.a.lastReview = { by: "review", verdict: "pass", confidence: "high", coverageComplete: true };
  assert.deepEqual(acceptanceProblems(state, "a"), []);
  state.defects.d = { id: "d", concept: "a", finding: defect("a", "q", "r"), status: "refused" };
  assert.match(acceptanceProblems(state, "a").join(), /unresolved defects: d \(refused\)/);
  state.defects.d.status = "verified";
  state.conceptStates.a.escalate = true;
  assert.match(acceptanceProblems(state, "a").join(), /never given the second review/);
  state.conceptStates.a.lastReview = { by: "escalate", verdict: "pass", confidence: "low", coverageComplete: false };
  assert.match(acceptanceProblems(state, "a").join(), /not fully covered.*low confidence/);
});

test("session permissions are read-only inspection plus each role's own files: no recording, delivery, authorization, territory writing, git or code", () => {
  for (const role of ["plan", "plan-review", "draft", "review", "escalate", "deep-audit"] as const) {
    const tools = allowedTools(role, "g", ".map-authoring/l2v2/s/g");
    for (const tool of tools) {
      assert.doesNotMatch(tool, /record|authorize|reopen|resume|complete|l2 run|--write|python|git|curl|map:author:\*|map:author -- l2 \*|Bash\(\*\)|^Bash$|^Edit$|^Write$/, `${role}: ${tool}`);
      if (tool.startsWith("Bash(")) assert.match(tool, /^Bash\((npm run -s map:author -- l2 (context|territory g|signals|group-signals g|check --group g)|npm run -s map:inspect --|node --test src\/lib\/map\/map\.test\.ts)/, `${role}: ${tool}`);
    }
  }
  assert.ok(allowedTools("draft", "g", "o").includes("Edit(src/lib/map/data.ts)"));
  assert.ok(!allowedTools("review", "g", "o").some((tool) => tool.startsWith("Edit(")));
  assert.ok(!allowedTools("review", "g", "o").some((tool) => tool.includes("check --group")));
});

test("batches over a v1 run: untouched groups only; finished groups skipped; partly recorded groups refused; drafted concepts protected", () => {
  const groups = [{ group: "done", concepts: ["a", "b"] }, { group: "mixed", concepts: ["c", "d"] }, { group: "planned", concepts: ["e"] }, { group: "fresh", concepts: ["f", "g"] }];
  const steps = { "plan:done": {}, "design:a": {}, "design:b": {}, "author:a": {}, "audit:a": {}, "author:b": {}, "audit:b": {}, "group-audit:done": {}, "plan:mixed": {}, "author:c": {}, "audit:c": {}, "plan:planned": {} };
  const plan = planBatches(groups, steps, new Set(["base"]));
  assert.deepEqual(plan.batches, [{ group: "fresh", concepts: ["f", "g"] }]);
  assert.deepEqual(plan.complete, ["done"]);
  assert.deepEqual(plan.refused.map((r) => r.group), ["mixed", "planned"]);
  assert.deepEqual([...plan.protectedIds].sort(), ["a", "b", "base", "c"]);
});

test("finalize records the v1 steps in v1 order, every command scoped to the slice's own run (two active runs coexist)", () => {
  const cmds = finalizeCommands("computation-execution-1", [{ group: "g1", concepts: ["a"] }, { group: "g2", concepts: ["b"] }], (g) => `dir/${g}`);
  assert.ok(cmds.every((c) => c.argv.slice(-2).join(" ") === "--domain computation-execution-1"), "every command names its run");
  assert.deepEqual(cmds.map((c) => c.key), ["plan:g1", "plan:g2", "design:a", "design:b", "author:a", "audit:a", "author:b", "audit:b", "group-audit:g1", "group-audit:g2"]);
  assert.ok(cmds.find((c) => c.key === "audit:a")!.argv.includes("dir/g1/audit-a.json"));
});

test("stop rules: cost, escalation, parking, campaign samples only (baselines never count), and the meter within one weekly window", () => {
  const session = (group: string, w: number, at = T): LedgerEntry => ({ kind: "session", at, slice: "s", group, role: "draft", sessionId: "x", durationMs: 60000, turns: 3, usage: { input_tokens: w, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 }, weighted: w });
  const batch = (group: string, accepted: number, extra: Partial<Extract<LedgerEntry, { kind: "batch" }>> = {}, at = T): LedgerEntry => ({ kind: "batch", at, slice: "s", group, accepted, parked: 0, escalated: 0, defects: 0, ...extra });
  const cheap = ["g1", "g2", "g3"].flatMap((g) => [session(g, 300_000), batch(g, 5)]);
  assert.equal(stopReason(cheap), undefined);
  assert.match(stopReason(["g1", "g2", "g3"].flatMap((g) => [session(g, 900_000), batch(g, 5)]))!, /last 3 batches/);
  assert.match(stopReason([...cheap, session("g4", 1), batch("g4", 1, { escalated: 7 })])!, /escalated/);
  assert.match(stopReason([...cheap, batch("g4", 3, { parked: 1 })])!, /parked/);
  const audits = (campaign: boolean) => Array.from({ length: 8 }, (_, i): LedgerEntry => ({ kind: "deep-audit", at: T, label: "x", concept: `c${i}`, substantive: 1, campaign }));
  assert.match(stopReason([...cheap, ...audits(true)])!, /sampled concepts/);
  assert.equal(stopReason([...cheap, ...audits(false)]), undefined);
  const metered: LedgerEntry[] = [{ kind: "meter", at: "2026-10-09T00:00:00Z", percent: 10 }, session("g9", 1, "2026-10-09T01:00:00Z"), batch("g9", 5, {}, "2026-10-09T01:00:00Z"), { kind: "meter", at: "2026-10-09T02:00:00Z", percent: 12 }];
  assert.match(stopReason(metered)!, /usage meter/);
  // After a weekly reset (the reading drops), only readings in the new window count.
  assert.equal(stopReason([...metered, { kind: "meter", at: "2026-10-09T03:00:00Z", percent: 1 }]), undefined);
  assert.equal(weighted({ input_tokens: 10, output_tokens: 10, cache_creation_input_tokens: 100, cache_read_input_tokens: 1000 }), 10 + 50 + 125 + 100);
});

test("sampling is deterministic per slice; a slice finalizes only with its sample audited and every defect repaired and accepted again", () => {
  assert.deepEqual(sample(["a", "b", "c", "d", "e"], 2, "slice-1"), sample(["a", "b", "c", "d", "e"], 2, "slice-1"));
  assert.match(sampleProblems(undefined, () => true).join(), /not been drawn/);
  const s = { slice: "s", concepts: ["a", "b"], audited: { a: { substantive: 0, repaired: false } } };
  assert.match(sampleProblems(s, () => true).join(), /b: sampled but not audited/);
  assert.match(sampleProblems({ ...s, audited: { a: { substantive: 0, repaired: false }, b: { substantive: 2, repaired: true } } }, () => false).join(), /b: 2 substantive/);
  assert.deepEqual(sampleProblems({ ...s, audited: { a: { substantive: 0, repaired: false }, b: { substantive: 2, repaired: true } } }, () => true), []);
});

test("one driver per checkout: a second lock is refused", () => {
  const root = mkdtempSync(join(tmpdir(), "l2v2-lock-"));
  const release = acquireLock(root);
  assert.throws(() => acquireLock(root), /another driver/);
  release();
  acquireLock(root)();
});

// ---------------------------------------------------------------- the session runner, against stub executables

function stub(body: string): string {
  const dir = mkdtempSync(join(tmpdir(), "l2v2-bin-"));
  const bin = join(dir, "claude");
  writeFileSync(bin, `#!/bin/sh\ncat > /dev/null\n${body}\n`);
  chmodSync(bin, 0o755);
  return bin;
}
const options = (bin: string, timeoutMs = 5000) => ({ bin, cwd: tmpdir(), timeoutMs });

test("the session runner reads exact usage, keeps missing usage unknown, and rejects timeouts, junk and error results", async () => {
  const ok = await runClaude(options(stub(`echo '{"session_id":"s1","usage":{"input_tokens":3,"output_tokens":4,"cache_creation_input_tokens":5,"cache_read_input_tokens":6},"duration_ms":7,"num_turns":2,"result":"done"}'`)), "p", ["Read"]);
  assert.deepEqual([ok.sessionId, ok.usage, ok.turns], ["s1", { input_tokens: 3, output_tokens: 4, cache_creation_input_tokens: 5, cache_read_input_tokens: 6 }, 2]);
  assert.equal((await runClaude(options(stub(`echo '{"session_id":"s2","result":"x"}'`)), "p", [])).usage, null);
  await assert.rejects(runClaude(options(stub("echo 'You have hit your session limit'")), "p", []), (e: unknown) => e instanceof SessionError && e.reason === "no-json");
  await assert.rejects(runClaude(options(stub(`echo '{"session_id":"s3","is_error":true,"subtype":"error_max_turns"}'`)), "p", []), (e: unknown) => e instanceof SessionError && e.reason === "error-result");
  await assert.rejects(runClaude(options(stub("sleep 5"), 300), "p", []), (e: unknown) => e instanceof SessionError && e.reason === "timeout");
});

// ---------------------------------------------------------------- the driver, against a fake Claude

type Script = Partial<Record<string, (root: string, prompt: string) => void>>;
function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), "l2v2-"));
  mkdirSync(join(root, "src/lib/map/authoring/l2/groups"), { recursive: true });
  cpSync(join(import.meta.dirname, "../../../../../scripts/l2v2/prompts"), join(root, "scripts/l2v2/prompts"), { recursive: true });
  writeFileSync(join(root, DATA), dataFile([record("old", "Accepted text.")]));
  writeFileSync(join(root, REGISTRY), 'export const AUTHORED_CONTENT_CONCEPTS = [\n  "old",\n];\n');
  writeFileSync(join(root, "src/lib/map/map.test.ts"), "// a test\n");
  return root;
}
const appendRecord = (root: string, id: string, text: string) => {
  writeFileSync(join(root, DATA), readFileSync(join(root, DATA), "utf8").replace("  ],\n  mechanisms: [", `${record(id, text)}\n  ],\n  mechanisms: [`));
  writeFileSync(join(root, REGISTRY), readFileSync(join(root, REGISTRY), "utf8").replace("];", `  "${id}",\n];`));
};
const out = (root: string, prompt: string) => join(root, prompt.match(/(\.map-authoring\/l2v2\/\S+?\.json)/)![1]);
const run = (prompt: string) => prompt.match(/"run": "([^"{}]+)"/)![1];
const emit = (root: string, prompt: string, body: object) => writeFileSync(out(root, prompt), JSON.stringify({ run: run(prompt), ...body }));
const files = (root: string): string[] => {
  const walk = (dir: string): string[] => readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (name === ".map-authoring") return [];
    return statSync(full).isDirectory() ? walk(full) : [relative(root, full)];
  });
  return walk(root);
};

function fakeEnv(root: string, script: Script): Env & { calls: string[] } {
  const calls: string[] = [];
  let n = 0;
  let tokens = 0;
  return {
    root,
    calls,
    now: () => T,
    token: () => `tok${++tokens}`,
    async session({ role, prompt, resume }): Promise<SessionResult> {
      const key = resume ? `${role}:resume` : role;
      calls.push(key);
      (script[key] ?? script[role])?.(root, prompt);
      return { sessionId: resume ?? `s${++n}`, usage: { input_tokens: 0, output_tokens: 100, cache_creation_input_tokens: 1000, cache_read_input_tokens: 10000 }, durationMs: 1000, turns: 2, isError: false, text: "done" };
    },
    check: async () => [],
    ensureSkeleton: async (group) => {
      if (!existsSync(join(root, groupPath(group)))) writeFileSync(join(root, groupPath(group)), "{}\n");
      return [];
    },
    signals: async () => [],
    groupSignals: async () => [],
    context: async (id) => `{"concept":"${id}"}`,
    territory: async () => "{}",
    facts: async () => ({ placements: 1, domainOrder: 2 }),
    changedPaths: async () => files(root),
    headContent: async () => undefined,
  };
}
const plan = (root: string) => writeFileSync(join(root, groupPath("g")), `${JSON.stringify({ members: [{ conceptId: "x", claims: ["every node agrees"] }, { conceptId: "y", claims: ["c"] }], concepts: { x: { model: { claims: ["every node agrees"] } } } }, null, 2)}\n`);
const passes = (ids: string[], answers: Record<string, unknown[]> = {}) => Object.fromEntries(ids.map((id) => [id, { verdict: "pass", findings: [], defects: answers[id] ?? [], note: `${id} verified`, resolutions: [] }]));
const happy: Script = {
  plan,
  "plan-review": (root, p) => emit(root, p, { verdict: "pass", claimFixes: [], note: "ok" }),
  draft: (root) => (appendRecord(root, "x", "Nodes always agree."), appendRecord(root, "y", "Fine text.")),
  review: (root, p) => emit(root, p, { concepts: { y: review(), x: review({ verdict: "defect", findings: [defect("x", "Nodes always agree.", "Correct nodes agree under synchrony.", "examples")] }) }, group: { note: "side by side", findings: [], resolutions: [] } }),
  "review:resume": (root, p) => emit(root, p, { concepts: passes(["x", "y"], { x: [{ id: "review-x-1", status: "fixed", why: "" }] }) }),
};
const input = { slice: "s", group: "g", concepts: ["x", "y"], protectedIds: new Set(["old"]) };

test("a batch goes plan → plan review → draft → review → exact repair → verified → accepted, touching only its own records", async () => {
  const root = fixture();
  const env = fakeEnv(root, happy);
  const state = await runBatch(env, input);
  assert.equal(state.status, "accepted", state.stop?.reason);
  assert.deepEqual(env.calls, ["plan", "plan-review", "draft", "review", "review:resume"]);
  const data = readFileSync(join(root, DATA), "utf8");
  assert.match(data, /Correct nodes agree under synchrony\./);
  assert.match(data, /Accepted text\./);
  assert.equal(state.defects["review-x-1"].status, "verified");
  assert.match(JSON.parse(readFileSync(join(root, batchDir("s", "g"), "audit-x.json"), "utf8")).note, /review verification 1: x verified/);
  assert.equal(loadLedger(root).filter((e) => e.kind === "session").length, 5);
  await runBatch(env, input);
  assert.equal(env.calls.length, 5, "an accepted batch runs nothing more");
});

test("a failed session is recorded without invented usage, its changes are undone, and the rerun completes without duplicates", async () => {
  const root = fixture();
  const failing: Script = { ...happy, review: () => { throw new Error("usage limit"); } };
  await assert.rejects(runBatch(fakeEnv(root, failing), input), /usage limit/);
  assert.equal(loadBatch(root, "s", "g")!.status, "drafted");
  const failed = loadLedger(root).filter((e) => e.kind === "session-failed");
  assert.deepEqual(failed.map((e) => (e as { role: string }).role), ["review"]);
  const state = await runBatch(fakeEnv(root, happy), input);
  assert.equal(state.status, "accepted");
  assert.equal(readFileSync(join(root, DATA), "utf8").split('id: "x-content",').length - 1, 1);
  assert.equal(readFileSync(join(root, REGISTRY), "utf8").split('"x",').length - 1, 1);
});

for (const [name, tamper, expect] of [
  ["changes an accepted record", (r: string) => writeFileSync(join(r, DATA), readFileSync(join(r, DATA), "utf8").replace("Accepted text.", "Rewritten.")), /src\/lib\/map\/data\.ts outside this batch's records/],
  ["changes taxonomy in data.ts", (r: string) => writeFileSync(join(r, DATA), readFileSync(join(r, DATA), "utf8").replace('{ id: "x" }', '{ id: "x2" }')), /outside this batch's records/],
  ["edits a test", (r: string) => writeFileSync(join(r, "src/lib/map/map.test.ts"), "// weakened\n"), /src\/lib\/map\/map\.test\.ts/],
  ["creates a file", (r: string) => writeFileSync(join(r, "src/new.ts"), "x"), /src\/new\.ts/],
] as const) {
  test(`a draft session that ${name} is stopped and every change of that session is rolled back`, async () => {
    const root = fixture();
    const before = { data: readFileSync(join(root, DATA), "utf8"), test: readFileSync(join(root, "src/lib/map/map.test.ts"), "utf8") };
    const state = await runBatch(fakeEnv(root, { ...happy, draft: (r) => (happy.draft!(r, ""), tamper(r)) }), input);
    assert.equal(state.status, "stopped");
    assert.match(state.stop!.reason, expect);
    assert.equal(readFileSync(join(root, DATA), "utf8"), before.data);
    assert.equal(readFileSync(join(root, "src/lib/map/map.test.ts"), "utf8"), before.test);
    assert.ok(!existsSync(join(root, "src/new.ts")));
  });
}

test("a reviewer that edits data.ts is stopped and rolled back", async () => {
  const root = fixture();
  const state = await runBatch(fakeEnv(root, { ...happy, review: (r, p) => (happy.review!(r, p), writeFileSync(join(r, DATA), readFileSync(join(r, DATA), "utf8").replace("Fine text.", "Changed."))) }), input);
  assert.equal(state.status, "stopped");
  assert.match(readFileSync(join(root, DATA), "utf8"), /Fine text\./);
});

test("a stale output from an earlier run is never consumed", async () => {
  const root = fixture();
  const env = fakeEnv(root, { ...happy, review: () => {}, "review:resume": () => {} });
  mkdirSync(join(root, batchDir("s", "g")), { recursive: true });
  const stale = { run: "old-run", concepts: { x: review(), y: review() }, group: { note: "stale", findings: [], resolutions: [] } };
  writeFileSync(join(root, batchDir("s", "g"), "review.json"), JSON.stringify(stale));
  const state = await runBatch(env, input);
  assert.equal(state.status, "stopped");
  assert.match(state.stop!.reason, /review\.json unusable: review\.json was not written/);
});

test("an unapplied repair cannot be cleared by a passing verifier: the concept is parked and leaves the tree", async () => {
  const root = fixture();
  const misquote: Script = {
    ...happy,
    review: (r, p) => emit(r, p, { concepts: { y: review(), x: review({ verdict: "defect", findings: [defect("x", "Not in the record.", "Fixed.")] }) }, group: { note: "n", findings: [], resolutions: [] } }),
    "review:resume": (r, p) => emit(r, p, { concepts: passes(["x", "y"], { x: [{ id: "review-x-1", status: "fixed", why: "" }] }) }),
  };
  const state = await runBatch(fakeEnv(root, misquote), input);
  assert.equal(state.status, "stopped");
  assert.equal(state.conceptStates.x.state, "parked");
  assert.equal(state.defects["review-x-1"].status, "refused");
  assert.equal(state.conceptStates.y.state, "accepted");
  assert.doesNotMatch(readFileSync(join(root, DATA), "utf8"), /x-content/);
  assert.doesNotMatch(readFileSync(join(root, REGISTRY), "utf8"), /"x"/);
  assert.match(stopReason(loadLedger(root))!, /parked/);
});

test("escalation: a formal-result defect gets a second independent review; low confidence or incomplete coverage there parks the concept", async () => {
  const formal: Script = {
    ...happy,
    review: (r, p) => emit(r, p, { concepts: { y: review(), x: review({ verdict: "defect", findings: [defect("x", "Nodes always agree.", "Correct nodes agree under synchrony.", "formal-results")] }) }, group: { note: "n", findings: [], resolutions: [] } }),
    escalate: (r, p) => emit(r, p, { concepts: { x: review({ note: "second look" }) } }),
  };
  const root = fixture();
  const env = fakeEnv(root, formal);
  const state = await runBatch(env, input);
  assert.equal(state.status, "accepted", state.stop?.reason);
  assert.deepEqual(env.calls, ["plan", "plan-review", "draft", "review", "review:resume", "escalate"]);
  assert.equal(state.conceptStates.x.lastReview!.by, "escalate");
  const unsure = await runBatch(fakeEnv(fixture(), { ...formal, escalate: (r, p) => emit(r, p, { concepts: { x: review({ confidence: "low" }) } }) }), input);
  assert.equal(unsure.conceptStates.x.state, "parked");
  assert.match(unsure.conceptStates.x.parkReason!, /low confidence/);
  const thin = await runBatch(fakeEnv(fixture(), { ...formal, escalate: (r, p) => emit(r, p, { concepts: { x: review({ coverage: [{ claim: 0, mechanism: true, conditions: false, failureOrConfusion: true }] }) } }) }), input);
  assert.match(thin.conceptStates.x.parkReason!, /not fully covered/);
});

test("plan review: claim fixes are applied exactly and verified; an unconfirmed fix is rolled back; a stop stops", async () => {
  const fixing: Script = { ...happy, "plan-review": (r, p) => emit(r, p, { verdict: "fix", claimFixes: [{ concept: "x", quote: "every node agrees", replacement: "correct nodes agree", why: "overclaim" }], note: "" }), "plan-review:resume": (r, p) => emit(r, p, { verdict: "pass", claimFixes: [], note: "confirmed" }), escalate: (r, p) => emit(r, p, { concepts: { x: review() } }) };
  const root = fixture();
  const env = fakeEnv(root, fixing);
  const state = await runBatch(env, input);
  assert.equal(state.status, "accepted", state.stop?.reason);
  assert.deepEqual(env.calls.slice(0, 3), ["plan", "plan-review", "plan-review:resume"]);
  assert.ok(env.calls.includes("escalate"), "a corrected claim sends its concept to the second review");
  assert.match(readFileSync(join(root, groupPath("g")), "utf8"), /correct nodes agree/);
  assert.ok(state.conceptStates.x.reasons.includes("a plan claim was corrected"));
  const root2 = fixture();
  const unconfirmed = await runBatch(fakeEnv(root2, { ...fixing, "plan-review:resume": (r, p) => emit(r, p, { verdict: "stop", claimFixes: [], stopReason: "still wrong", note: "" }) }), input);
  assert.equal(unconfirmed.status, "stopped");
  assert.match(readFileSync(join(root2, groupPath("g")), "utf8"), /every node agrees/);
  const stopped = await runBatch(fakeEnv(fixture(), { ...happy, "plan-review": (r, p) => emit(r, p, { verdict: "stop", claimFixes: [], stopReason: "no defensible split", note: "" }) }), input);
  assert.match(stopped.stop!.reason, /no defensible split/);
});

test("protected concepts can never enter a batch", async () => {
  await assert.rejects(runBatch(fakeEnv(fixture(), happy), { ...input, protectedIds: new Set(["old", "x"]) }), /protected concepts x/);
});

test("a deep audit's defects reopen the concept, are repaired exactly, verified by the auditor, and accepted again only through the gates", async () => {
  const root = fixture();
  await runBatch(fakeEnv(root, happy), input);
  const verified = fakeEnv(root, { "deep-audit:resume": (r, p) => emit(r, p, { concepts: { y: { verdict: "pass", findings: [], defects: [{ id: Object.keys(loadBatch(r, "s", "g")!.defects).find((id) => id.startsWith("audit-"))!, status: "fixed", why: "" }], note: "audit fix verified", resolutions: [] } } }) });
  const after = await repairAfterAudit(verified, { ...input, concept: "y", findings: [{ rule: "overclaim", quote: "Fine text.", replacement: "Fine text, under its conditions.", why: "audit" }], auditSession: "audit-1", label: "sample-s" });
  assert.equal(after.status, "accepted", after.stop?.reason);
  assert.match(readFileSync(join(root, DATA), "utf8"), /under its conditions/);
  await assert.rejects(repairAfterAudit(verified, { ...input, concept: "old", findings: [], auditSession: "a", label: "l" }), /cannot be repaired here/);
});
