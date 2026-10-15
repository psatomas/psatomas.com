import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import test from "node:test";
import {
  acceptanceProblems, advance, allowedTools, applyClaimFixes, applyPatches, deniedTools, DENIED_TOOLS, escalationFocus, escalationReasons, finalizeCommands, knownDefectProblems, newBatch, planBatches,
  planReviewProblems, recordDefects, resumeBatch,
  reviewProblems, sample, sampleProblems, stopBatch, stopReason, verifyProblems, weighted,
  type ConceptReview, type Finding, type LedgerEntry,
} from "./core.ts";
import { claudeArgs, runClaude, SessionError } from "./claude.ts";
import type { SliceSample } from "./core.ts";
import { acquireLock, appendLedger, batchDir, DATA, GuardError, guardedSession, groupPath, loadBatch, loadLedger, REGISTRY, repairAfterAudit, runBatch, saveBatch, type Env } from "./driver.ts";
import { recordFingerprint, recordPlacement, recordsInPlaceProblems, renderRecord, secretProblems, stagedRecordsProblems, toContent, withRecords, withRegistry, type StagedRecord } from "./records.ts";
import { gitChangedPaths, gitHeadEntry, gitSurfaces, run as runCommand } from "./shell.ts";
import { withoutRecords } from "../l2/campaign.ts";
import { sandboxProblems } from "./sandbox.ts";
import { contentFingerprint } from "../representation/design.ts";
import type { MapContentBlock } from "../../types.ts";
import type { SessionResult } from "./claude.ts";

const T = "2026-10-09T00:00:00.000Z";
const record = (id: string, text: string) => ["    {", `      id: "${id}-content",`, `      conceptId: "${id}",`, `      definition: "Definition of ${id}.",`, "      body: [", `        { kind: "paragraph", text: ${JSON.stringify(text)} },`, "      ],", "    },"].join("\n");
const dataFile = (records: string[]) => ["export const mapKnowledge = {", "  concepts: [", '    { id: "x" },', "  ],", "  content: [", ...records, "  ],", "  mechanisms: [", "  ],", "};", ""].join("\n");
const defect = (concept: string, quote: string, replacement: string, rule = "overclaim"): Finding => ({ concept, severity: "defect", rule, quote, replacement, why: "test" });
const staged = (id: string, text: string, body: MapContentBlock[] = [{ kind: "paragraph", text }]): StagedRecord => ({ conceptId: id, definition: `Definition of ${id}.`, body });
const SECRET = "s3cr3t-value-123";
const review = (over: Partial<ConceptReview> = {}): ConceptReview => ({ verdict: "pass", confidence: "high", findings: [], coverage: [{ claim: 0, mechanism: true, conditions: true, failureOrConfusion: true }], note: "checked", resolutions: [], ...over });

// ---------------------------------------------------------------- pure core

test("exact repairs apply only to a unique quote in the concept's own record values, never to protected content", () => {
  const records = { a: staged("a", 'It always "holds".'), b: staged("b", "It always holds. It always holds.") };
  const { records: out, results } = applyPatches(records, [defect("a", 'It always "holds".', "It holds under synchrony."), defect("b", "It always holds.", "x"), defect("c", "q", "r")], new Set());
  assert.deepEqual(results.map((r) => r.applied), [true, false, false]);
  assert.match(results[1].problem!, /occurs 2 times/);
  assert.deepEqual(out.a.body, [{ kind: "paragraph", text: "It holds under synchrony." }]);
  assert.equal(records.a.body[0].kind === "paragraph" && records.a.body[0].text, 'It always "holds".', "the input is never mutated");
  assert.match(applyPatches(records, [defect("a", "always", "often")], new Set(["a"])).results[0].problem!, /protected/);
  assert.equal(applyPatches(records, [{ ...defect("a", "always", "often"), severity: "remark" }], new Set()).results.length, 0);
});

test("a repair reaches only content strings: never keys, kinds or ids, never an invalid or secret value", () => {
  const records = { a: staged("a", "Text of a.") };
  const apply = (quote: string, replacement: string) => applyPatches(records, [defect("a", quote, replacement)], new Set(), [SECRET]).results[0];
  // What used to be source text (keys, kinds, ids) is not content: a quote there matches nothing.
  for (const quote of ["definition:", "paragraph", "a-content", "kind", "text:"]) assert.match(apply(quote, "process.exit(1) ||").problem!, /not found/, quote);
  assert.match(apply("Text of a.", "").problem!, /invalid: .*is empty/);
  assert.match(apply("Text of a.", "Line\nbreak").problem!, /invalid/);
  assert.match(apply("Text of a.", `It leaks ${SECRET}.`).problem!, /invalid: .*local secret/);
  const code = '"), require("node:child_process").execSync("touch pwned"), ("';
  const patched = applyPatches(records, [defect("a", "Text of a.", code)], new Set(), []).records.a;
  assert.deepEqual(patched.body, [{ kind: "paragraph", text: code }], "code in a replacement stays a value");
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

/** A permission path pattern as a regular expression (gitignore-style: `**` spans directories, `*` does not). */
const glob = (pattern: string) => new RegExp(`^${pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*\//g, "\u0000").replace(/\*\*/g, "\u0001").replace(/\*/g, "[^/]*").replace(/\u0000/g, "(?:.*/)?").replace(/\u0001/g, ".*")}$`);
const deniedPath = (tool: "Edit" | "Write" | "Read", path: string, denied: readonly string[] = DENIED_TOOLS) =>
  denied.some((rule) => rule.startsWith(`${tool}(`) && !/^\w+\((~|\/\/)/.test(rule) && glob(rule.slice(tool.length + 1, -1)).test(path));

test("session permissions: bounded reads, inspection, and each role's own JSON file only; no TypeScript, recording, delivery, authorization, git or code", () => {
  const dir = ".map-authoring/l2v2/s/g";
  const pack = `${dir}/pack.md`;
  for (const role of ["plan", "plan-review", "draft", "review", "escalate", "deep-audit"] as const) {
    const out = role === "plan" ? undefined : role === "deep-audit" ? ".map-authoring/l2v2/audits/l/c.audit.json" : `${dir}/${role}.json`;
    const tools = allowedTools(role, "g", { pack, out });
    for (const tool of tools) {
      assert.doesNotMatch(tool, /record|authorize|reopen|resume|complete|l2 run|--write|python|git|curl|map:author:\*|map:author -- l2 \*|Bash\(\*\)|^Bash$|^Edit$|^Write$|^Read$/, `${role}: ${tool}`);
      if (tool.startsWith("Bash(")) assert.match(tool, /^Bash\((npm run -s map:author -- l2 (context|territory g|signals|group-signals g|check --group g)|npm run -s map:inspect --)/, `${role}: ${tool}`);
      // Never the batch directory as a whole: no session reads the batch state or another session's output.
      if (tool.startsWith("Read(")) assert.ok(["Read(src/**)", "Read(docs/**)", "Read(scripts/l2v2/prompts/**)", `Read(${pack})`, `Read(${out})`].includes(tool), `${role}: ${tool}`);
      // No session edits TypeScript or any executable file: only JSON (its output, or the plan's group file), never a denied path.
      if (/^(Edit|Write)\(/.test(tool)) {
        assert.match(tool, /\.json\)$/, `${role}: ${tool}`);
        const path = tool.slice(tool.indexOf("(") + 1, -1);
        assert.ok(!deniedPath("Edit", path) && !deniedPath("Write", path), `${role}: its own file is never denied (${path})`);
      }
    }
    assert.ok(!tools.some((tool) => tool.includes(".ts)") || tool.includes("node --test")), `${role}: no TypeScript editing or test runs`);
  }
  assert.deepEqual(allowedTools("draft", "g", { pack, out: `${dir}/draft.json` }).filter((tool) => /^(Edit|Write)/.test(tool)), [`Write(${dir}/draft.json)`, `Edit(${dir}/draft.json)`]);
  assert.ok(!allowedTools("review", "g", { pack, out: `${dir}/review.json` }).some((tool) => tool.includes("check --group")));
  // Denials win over allowances: executable and configuration surfaces, run state and authorizations are never written.
  for (const path of [
    "src/lib/map/data.ts", "src/lib/map/authoring/content-registry.ts", "src/lib/map/map.test.ts", "scripts/map-l2v2.ts", "package.json", "package-lock.json", "tsconfig.json", "CLAUDE.md",
    ".git", ".git/config", ".git/hooks/pre-commit", ".gitignore", ".claude/settings.json", ".claude/settings.local.json", ".mcp.json", "node_modules/.bin/node", "node_modules/next/package.json", ".npmrc", ".dev.vars",
    ".map-authoring/campaign.json", ".map-authoring/l2/computation-execution-1.json", ".map-authoring/campaign/ledger.jsonl", ".map-authoring/l2v2/ledger.jsonl", ".map-authoring/l2v2/budget.json", ".map-authoring/l2v2/config.json", ".map-authoring/l2v2/lock",
    `${dir}/state.json`, ".map-authoring/l2v2/s/sample.json", `${dir}/pack.md`, `${dir}/audit-x.json`, `${dir}/group-audit.json`,
  ]) assert.ok(deniedPath("Edit", path) && deniedPath("Write", path), `never written: ${path}`);
  for (const rule of ["Read(**/.dev.vars*)", "Read(**/.env*)", "Read(**/.git/**)", "Read(~/.ssh/**)", "Read(~/.claude/**)", "Edit(~/.claude/**)", "Write(~/.gitconfig)"]) assert.ok(DENIED_TOOLS.includes(rule), rule);
  assert.ok(!DENIED_TOOLS.some((rule) => /^(Read|Edit|Write)\(~\/\*\*\)$/.test(rule)), "the home directory holds the repository: never denied wholesale");
  assert.ok(deniedPath("Read", "src/lib/map/authoring/l2/groups/g.json", deniedTools("deep-audit")) && !deniedPath("Read", "src/lib/map/authoring/l2/groups/g.json", deniedTools("review")), "a deep auditor never reads earlier audits in the group files");
  const argv = claudeArgs({ bin: "claude", cwd: ".", timeoutMs: 1 }, ["Read(src/**)"], undefined, deniedTools("deep-audit"));
  assert.equal(argv[argv.indexOf("--disallowedTools") + 1], deniedTools("deep-audit").join(","));
});

test("a second reviewer is told where to look, never what the first review found", () => {
  const focus = escalationFocus(["reviewer confidence medium", "3 defects", "a defect in conditions, a formal result or the definition", "an uncertain finding", "a plan claim was corrected", "2 placements", "a claim not fully covered"]);
  assert.doesNotMatch(focus.join("; "), /confidence|\d+ defects|uncertain|finding|first review/);
  assert.match(focus.join("; "), /formal results.*plan claims corrected.*every placement.*mechanism, conditions/);
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
/** What `git status` would list: everything except the ignored paths (run state, git, Claude Code settings, dependencies). */
const IGNORED = new Set([".map-authoring", ".git", ".claude", ".mcp.json", "node_modules", ".worktrees"]);
const files = (root: string): string[] => {
  const walk = (dir: string): string[] => readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (dir === root && IGNORED.has(name)) return [];
    return statSync(full).isDirectory() ? walk(full) : [relative(root, full)];
  });
  return walk(root);
};

function fakeEnv(root: string, script: Script): Env & { calls: string[]; prompts: string[]; requests: { role: string; tools: readonly string[]; denied: readonly string[] }[] } {
  const calls: string[] = [];
  const prompts: string[] = [];
  const requests: { role: string; tools: readonly string[]; denied: readonly string[] }[] = [];
  let n = 0;
  let tokens = 0;
  let clock = 0;
  return {
    root,
    calls,
    prompts,
    requests,
    now: () => T,
    // Each reading is a minute later: a session lasts a minute.
    clock: () => (clock += 60_000),
    token: () => `tok${++tokens}`,
    async session({ role, prompt, resume, tools, denied }): Promise<SessionResult> {
      const key = resume ? `${role}:resume` : role;
      calls.push(key);
      prompts.push(prompt);
      requests.push({ role, tools, denied });
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
    surfaces: async () => ({
      content: [join(root, ".git/config"), join(root, ".git/hooks"), join(root, ".claude"), join(root, ".mcp.json")],
      metadata: [join(root, "node_modules/.bin"), join(root, "node_modules/pkg/package.json")],
    }),
    secrets: async () => [SECRET],
  };
}
const plan = (root: string) => writeFileSync(join(root, groupPath("g")), `${JSON.stringify({ members: [{ conceptId: "x", claims: ["every node agrees"] }, { conceptId: "y", claims: ["c"] }], concepts: { x: { model: { claims: ["every node agrees"] } } } }, null, 2)}\n`);
const passes = (ids: string[], answers: Record<string, unknown[]> = {}) => Object.fromEntries(ids.map((id) => [id, { verdict: "pass", findings: [], defects: answers[id] ?? [], note: `${id} verified`, resolutions: [] }]));
const happy: Script = {
  plan,
  "plan-review": (root, p) => emit(root, p, { verdict: "pass", claimFixes: [], note: "ok" }),
  draft: (root, p) => emit(root, p, { records: [staged("x", "Nodes always agree."), staged("y", "Fine text.")] }),
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
  ["changes an accepted record", (r: string) => writeFileSync(join(r, DATA), readFileSync(join(r, DATA), "utf8").replace("Accepted text.", "Rewritten.")), /src\/lib\/map\/data\.ts/],
  ["changes taxonomy in data.ts", (r: string) => writeFileSync(join(r, DATA), readFileSync(join(r, DATA), "utf8").replace('{ id: "x" }', '{ id: "x2" }')), /src\/lib\/map\/data\.ts/],
  ["writes its own record into data.ts", (r: string) => appendRecord(r, "x", "Drafted in TypeScript."), /content-registry\.ts, src\/lib\/map\/data\.ts/],
  ["edits a test", (r: string) => writeFileSync(join(r, "src/lib/map/map.test.ts"), "// weakened\n"), /src\/lib\/map\/map\.test\.ts/],
  ["creates a file", (r: string) => writeFileSync(join(r, "src/new.ts"), "x"), /src\/new\.ts/],
  ["rewrites its batch state", (r: string) => writeFileSync(join(r, batchDir("s", "g"), "state.json"), "{}"), /state\.json/],
  ["rewrites a campaign authorization", (r: string) => (mkdirSync(join(r, ".map-authoring"), { recursive: true }), writeFileSync(join(r, ".map-authoring/campaign.json"), '{"merge":true}')), /\.map-authoring\/campaign\.json/],
] as const) {
  test(`a draft session that ${name} is stopped and every change of that session is rolled back`, async () => {
    const root = fixture();
    const before = { data: readFileSync(join(root, DATA), "utf8"), test: readFileSync(join(root, "src/lib/map/map.test.ts"), "utf8") };
    const state = await runBatch(fakeEnv(root, { ...happy, draft: (r, p) => (happy.draft!(r, p), tamper(r)) }), input);
    assert.equal(state.status, "stopped");
    assert.match(state.stop!.reason, expect);
    assert.equal(readFileSync(join(root, DATA), "utf8"), before.data);
    assert.equal(readFileSync(join(root, "src/lib/map/map.test.ts"), "utf8"), before.test);
    assert.ok(!existsSync(join(root, "src/new.ts")));
    assert.ok(!existsSync(join(root, ".map-authoring/campaign.json")));
    assert.equal(loadBatch(root, "s", "g")!.status, "stopped", "the batch state is the driver's");
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

// ---------------------------------------------------------------- staged records: data in, never code

const EVERY_KIND: MapContentBlock[] = [
  { kind: "paragraph", text: "Prose." },
  { kind: "heading", text: "A heading" },
  { kind: "flow", label: "Order", stages: [["Start"], ["Left", ["Right one", "Right two"]], ["End"]] },
  { kind: "distinction", left: "Safety", right: "Liveness", further: ["Fairness"] },
  { kind: "tensions", label: "Forces", pairs: [["Speed", "Safety"]] },
  { kind: "terms", terms: ["One", "Two"] },
  { kind: "cycle", label: "Loop", steps: ["Propose", "Vote"] },
  { kind: "comparison", label: "Options", dimensions: ["Cost", "Risk"], alternatives: [{ name: "A", values: ["Low", "High"] }, { name: "B", values: ["High", "Low"] }] },
  { kind: "state", label: "Modes", states: ["Idle", "Busy"], transitions: [{ from: "Idle", to: "Busy", when: "work arrives" }, { from: "Busy", to: "Idle", when: "work ends" }] },
];
/** Strings that would be code if they ever reached data.ts outside a string literal. */
const PAYLOADS = [
  '"), (globalThis.pwned = "quote"), ("',
  "${(globalThis.pwned = 'template')}",
  "\\\"; globalThis.pwned = 'backslash'; //",
  "*/ globalThis.pwned = 'comment' /*",
  "}, ], }; globalThis.pwned = 'brace'; export const x = [{",
  "import('node:child_process').then((m) => m.execSync('touch pwned'))",
];

test("a staged draft is plain data within the record contract, or it is refused", () => {
  const ok = { run: "r", records: [staged("a", "Fine.", EVERY_KIND)] };
  assert.deepEqual(stagedRecordsProblems(ok, ["a"], "r", []), []);
  const record = (over: Record<string, unknown>) => ({ run: "r", records: [{ ...staged("a", "Fine."), ...over }] });
  const block = (b: unknown) => record({ body: [b] });
  for (const [what, value, expect] of [
    ["a stale token", { ...ok, run: "old" }, /stale or foreign/],
    ["an extra top-level field", { ...ok, code: "x" }, /unexpected field "code"/],
    ["a record with its own id", record({ id: "a-content" }), /unexpected field "id"/],
    ["a legacy prose field", record({ summary: "s" }), /unexpected field "summary"/],
    ["a prototype key", JSON.parse('{"run":"r","records":[{"conceptId":"a","definition":"D.","body":[],"__proto__":{"x":1}}]}'), /unexpected field "__proto__"/],
    ["a number for text", block({ kind: "paragraph", text: 1 }), /text must be a string/],
    ["an object for text", block({ kind: "paragraph", text: { toString: "x" } }), /text must be a string/],
    ["an unknown block kind", block({ kind: "script", text: "x" }), /unknown block kind "script"/],
    ["a block field of another kind", block({ kind: "paragraph", text: "x", label: "y" }), /unexpected field "label"/],
    ["a malformed comparison", block({ kind: "comparison", label: "L", dimensions: ["a", "b"], alternatives: [{ name: "A", values: ["1"], extra: 1 }] }), /unexpected field "extra"/],
    ["a block shape validation.ts refuses", block({ kind: "cycle", label: "L", steps: ["one"] }), /must contain at least two steps/],
    ["a line break", record({ definition: "One\ntwo." }), /contains a line break/],
    ["markup", record({ definition: "A **bold** claim." }), /markdown/],
    ["a control character", record({ definition: "Bell\u0007." }), /control or unpaired/],
    ["an empty definition", record({ definition: " " }), /definition is empty/],
    ["another concept", record({ conceptId: "b" }), /conceptId must be one of a.*a: exactly one record/],
    ["a duplicate", { run: "r", records: [staged("a", "One."), staged("a", "Two.")] }, /a: exactly one record/],
    ["a local secret", { run: "r", records: [staged("a", `Key ${SECRET}.`)] }, /local secret/],
    ["a credential", { run: "r", records: [staged("a", "Token ghp_abcdefghijklmnopqrstuvwxyz0123456789.")] }, /GitHub token/],
  ] as const) assert.match(stagedRecordsProblems(value, ["a"], "r", [SECRET]).join("; "), expect, what);
});

test("the driver's rendering keeps every value a string literal: importing it yields exactly the staged data and runs nothing", async () => {
  const records = PAYLOADS.map((text, i) => staged(`p${i}`, text, [{ kind: "paragraph", text }, ...EVERY_KIND, { kind: "heading", text }]));
  assert.deepEqual(stagedRecordsProblems({ run: "r", records }, records.map((r) => r.conceptId), "r", []), [], "the payloads are valid text, so only the rendering keeps them inert");
  const dir = mkdtempSync(join(tmpdir(), "l2v2-render-"));
  const data = withRecords(dataFile([record("old", "Accepted text.")]), records.map(toContent));
  const registry = withRegistry('export const AUTHORED_CONTENT_CONCEPTS = [\n  "old",\n];\n', records.map((r) => r.conceptId));
  assert.deepEqual(recordsInPlaceProblems(data, registry, records), []);
  writeFileSync(join(dir, "data.ts"), data);
  const imported = (await import(pathToFileURL(join(dir, "data.ts")).href)) as { mapKnowledge: { content: unknown[] } };
  assert.equal((globalThis as { pwned?: unknown }).pwned, undefined, "no payload ran");
  assert.equal(existsSync(join(process.cwd(), "pwned")), false);
  assert.deepEqual(imported.mapKnowledge.content.slice(1), records.map(toContent));
  // The fingerprint kept at acceptance is the one v1 computes from the imported record.
  records.forEach((r, i) => assert.equal(recordFingerprint(r), contentFingerprint(imported.mapKnowledge.content[i + 1] as never)));
  // Rendering again in place is stable.
  assert.equal(withRecords(data, records.map(toContent)), data);
});

test("a draft session cannot inject code: TypeScript written directly is a violation, rolled back before any check imports it", async () => {
  const root = fixture();
  const before = readFileSync(join(root, DATA), "utf8");
  const seen: string[] = [];
  const env = fakeEnv(root, {
    ...happy,
    draft: (r, p) => {
      happy.draft!(r, p);
      writeFileSync(join(r, DATA), readFileSync(join(r, DATA), "utf8").replace("  ],\n  mechanisms: [", `    {\n      id: "x-content",\n      conceptId: "x",\n      definition: require("node:child_process").execSync("touch pwned").toString(),\n    },\n  ],\n  mechanisms: [`));
    },
  });
  env.check = async () => (seen.push(readFileSync(join(root, DATA), "utf8")), []);
  const state = await runBatch(env, input);
  assert.equal(state.status, "stopped");
  assert.match(state.stop!.reason, /draft changed what it may not \(rolled back; nothing of it was used\): .*src\/lib\/map\/data\.ts/);
  assert.equal(readFileSync(join(root, DATA), "utf8"), before);
  assert.ok(seen.every((text) => !text.includes("child_process")), "no check ever ran on the injected source");
});

test("a draft whose staged values are not plain data is refused twice and never reaches data.ts", async () => {
  const root = fixture();
  const before = readFileSync(join(root, DATA), "utf8");
  const seen: string[] = [];
  const bad = (r: string, p: string) => emit(r, p, { records: [{ ...staged("x", "x"), body: [{ kind: "paragraph", text: { $code: "process.exit(1)" } }] }, staged("y", "Fine.")] });
  const env = fakeEnv(root, { ...happy, draft: bad, "draft:resume": bad });
  env.check = async (_group, withRecords) => (withRecords && seen.push("records"), []);
  const state = await runBatch(env, input);
  assert.equal(state.status, "stopped");
  assert.match(state.stop!.reason, /draft\.json unusable: .*text must be a string/);
  assert.deepEqual(env.calls.slice(-2), ["draft", "draft:resume"]);
  assert.deepEqual(seen, [], "nothing was rendered or checked");
  assert.equal(readFileSync(join(root, DATA), "utf8"), before);
  assert.equal(loadBatch(root, "s", "g")!.records, undefined);
});

test("a draft that fails validation is rewritten once from the problems, then rendered by the driver", async () => {
  const root = fixture();
  let checks = 0;
  const env = fakeEnv(root, {
    ...happy,
    "draft:resume": (r, p) => emit(r, p, { records: [staged("x", "Correct nodes agree under synchrony."), staged("y", "Fine text.")] }),
    review: (r, p) => emit(r, p, { concepts: { x: review(), y: review() }, group: { note: "n", findings: [], resolutions: [] } }),
  });
  env.check = async (_group, withRecords) => (withRecords && ++checks === 1 ? ["x: record too thin"] : []);
  const state = await runBatch(env, input);
  assert.equal(state.status, "accepted", state.stop?.reason);
  assert.deepEqual(env.calls.slice(2, 4), ["draft", "draft:resume"]);
  const data = readFileSync(join(root, DATA), "utf8");
  assert.match(data, /Correct nodes agree under synchrony\./);
  assert.doesNotMatch(data, /Nodes always agree/);
});

test("secrets: a staged secret is refused; one in an audit note parks the concept", async () => {
  const leaky = await runBatch(fakeEnv(fixture(), { ...happy, draft: (r, p) => emit(r, p, { records: [staged("x", `It is ${SECRET}.`), staged("y", "Fine.")] }), "draft:resume": (r, p) => emit(r, p, { records: [staged("x", `Still ${SECRET}.`), staged("y", "Fine.")] }) }), input);
  assert.equal(leaky.status, "stopped");
  assert.match(leaky.stop!.reason, /local secret/);
  assert.doesNotMatch(leaky.stop!.reason, new RegExp(SECRET), "a secret is never echoed");
  const root = fixture();
  const noted = await runBatch(fakeEnv(root, { ...happy, review: (r, p) => emit(r, p, { concepts: { x: review(), y: review({ note: "Checked with key AKIAABCDEFGHIJKLMNOP." }) }, group: { note: "n", findings: [], resolutions: [] } }) }), input);
  assert.equal(noted.conceptStates.y.state, "parked");
  assert.match(noted.conceptStates.y.parkReason!, /AWS access key/);
  assert.doesNotMatch(readFileSync(join(root, DATA), "utf8"), /y-content/);
  assert.deepEqual(secretProblems(["A hash such as SHA-256 has a 256-bit output."], []), []);
});

test("directory entries (nested worktrees) in the change list are compared by presence, never read", async () => {
  const root = fixture();
  mkdirSync(join(root, ".worktrees/other"), { recursive: true });
  const env = fakeEnv(root, happy);
  env.changedPaths = async () => [...files(root), ".worktrees/other/"];
  const state = await runBatch(env, input);
  assert.equal(state.status, "accepted", state.stop?.reason);
});

test("acceptance binds each record: an edit afterwards is refused by the audit repair and detected for finalize", async () => {
  const root = fixture();
  const state = await runBatch(fakeEnv(root, happy), input);
  assert.equal(state.conceptStates.y.accepted!.fingerprint, recordFingerprint(state.records!.y));
  const records = [state.records!.x, state.records!.y];
  assert.deepEqual(recordsInPlaceProblems(readFileSync(join(root, DATA), "utf8"), readFileSync(join(root, REGISTRY), "utf8"), records), []);
  writeFileSync(join(root, DATA), readFileSync(join(root, DATA), "utf8").replace("Fine text.", "Fine text, edited by hand."));
  assert.match(recordsInPlaceProblems(readFileSync(join(root, DATA), "utf8"), readFileSync(join(root, REGISTRY), "utf8"), records).join(), /y: data\.ts does not hold the driver's rendering/);
  await assert.rejects(repairAfterAudit(fakeEnv(root, {}), { ...input, concept: "y", findings: [], auditSession: "a", label: "l" }), /does not hold its accepted record/);
});

test("known defects block finalize: any deep audit with defects at or after a concept's last acceptance, until it is accepted again", () => {
  const audit = (concept: string, substantive: number, at: string, label = "pilot"): LedgerEntry => ({ kind: "deep-audit", at, label, concept, substantive, campaign: true });
  const accepted = new Map([["a", { at: "2026-10-09T01:00:00Z", fingerprint: "fa" }], ["b", { at: "2026-10-09T01:00:00Z", fingerprint: "fb" }]]);
  assert.deepEqual(knownDefectProblems([audit("a", 2, "2026-10-09T00:00:00Z"), audit("b", 0, "2026-10-09T02:00:00Z")], accepted), [], "before acceptance, or clean");
  assert.match(knownDefectProblems([audit("a", 2, "2026-10-09T02:00:00Z"), audit("a", 0, "2026-10-09T03:00:00Z")], accepted).join(), /a: substantive defects found by deep audit "pilot" \(2/, "a later clean audit does not clear a known defect");
  assert.deepEqual(knownDefectProblems([audit("a", 2, "2026-10-09T02:00:00Z")], new Map([["a", { at: "2026-10-09T02:30:00Z", fingerprint: "repaired" }]])), [], "repaired and accepted again");
  // Accepted again without a change to the text (a resume): the defect is still known, whatever the time.
  assert.match(knownDefectProblems([{ ...audit("a", 2, "2026-10-09T02:00:00Z"), fingerprint: "same" } as LedgerEntry], new Map([["a", { at: "2026-10-09T02:30:00Z", fingerprint: "same" }]])).join(), /a: substantive/);
});

// ---------------------------------------------------------------- the guard's reach: ignored executable and configuration surfaces

/** The ignored surfaces the fake environment watches: git config and hooks, Claude Code settings, dependencies. */
function withSurfaces(root: string): string {
  mkdirSync(join(root, ".git/hooks"), { recursive: true });
  writeFileSync(join(root, ".git/config"), "[core]\n\tbare = false\n");
  writeFileSync(join(root, ".git/hooks/pre-commit.sample"), "#!/bin/sh\n");
  mkdirSync(join(root, ".claude"), { recursive: true });
  writeFileSync(join(root, ".claude/settings.json"), "{}\n");
  mkdirSync(join(root, "node_modules/.bin"), { recursive: true });
  mkdirSync(join(root, "node_modules/pkg"), { recursive: true });
  writeFileSync(join(root, "node_modules/.bin/next"), "#!/bin/sh\n");
  writeFileSync(join(root, "node_modules/pkg/package.json"), "{}\n");
  return root;
}

test("a session that plants a git hook, rewrites git or Claude Code configuration, adds an MCP server or a dependency executable is stopped and all of it is undone", async () => {
  const root = withSurfaces(fixture());
  const config = readFileSync(join(root, ".git/config"), "utf8");
  const state = await runBatch(fakeEnv(root, {
    ...happy,
    review: (r, p) => {
      happy.review!(r, p);
      writeFileSync(join(r, ".git/hooks/pre-commit"), "#!/bin/sh\ncurl example.com\n");
      writeFileSync(join(r, ".git/config"), "[core]\n\thooksPath = /tmp/hooks\n");
      writeFileSync(join(r, ".claude/settings.json"), '{"hooks":{"Stop":[]}}');
      writeFileSync(join(r, ".mcp.json"), "{}");
      writeFileSync(join(r, "node_modules/.bin/node"), "#!/bin/sh\n");
    },
  }), input);
  assert.equal(state.status, "stopped");
  for (const path of [".git/hooks/pre-commit", ".git/config", ".claude/settings.json", ".mcp.json", "node_modules/.bin/node"]) assert.ok(state.stop!.reason.includes(path), `${path} in: ${state.stop!.reason}`);
  assert.ok(!existsSync(join(root, ".git/hooks/pre-commit")) && !existsSync(join(root, ".mcp.json")) && !existsSync(join(root, "node_modules/.bin/node")));
  assert.equal(readFileSync(join(root, ".git/config"), "utf8"), config);
  assert.equal(readFileSync(join(root, ".claude/settings.json"), "utf8"), "{}\n");
});

test("a changed dependency executable or manifest is detected by metadata and stops for a human: dependencies are never read or restored", async () => {
  for (const path of ["node_modules/.bin/next", "node_modules/pkg/package.json"]) {
    const root = withSurfaces(fixture());
    const state = await runBatch(fakeEnv(root, { ...happy, review: (r, p) => (happy.review!(r, p), writeFileSync(join(r, path), "#!/bin/sh\nchanged\n")) }), input);
    assert.equal(state.status, "stopped");
    assert.match(state.stop!.reason, new RegExp(`rollback incomplete, manual recovery required: .*${path.replace(/[./]/g, "\\$&")}: a dependency is never restored automatically`));
  }
});

test("the first deep-audit session is guarded: authorization, batch and sample state, the ledger, records and registry come back; only its output may change", async () => {
  const root = withSurfaces(fixture());
  assert.equal((await runBatch(fakeEnv(root, happy), input)).status, "accepted");
  writeFileSync(join(root, ".map-authoring/campaign.json"), '{"merge":false}\n');
  writeFileSync(join(root, ".map-authoring/l2v2/s/sample.json"), '{"slice":"s","concepts":["y"],"audited":{}}\n');
  const guarded = [".map-authoring/campaign.json", `${batchDir("s", "g")}/state.json`, ".map-authoring/l2v2/s/sample.json", ".map-authoring/l2v2/ledger.jsonl", DATA, REGISTRY];
  const before = Object.fromEntries(guarded.map((path) => [path, readFileSync(join(root, path), "utf8")]));
  const out = ".map-authoring/l2v2/audits/pilot/y.audit.json";
  const request = { role: "deep-audit" as const, prompt: "audit y", tools: [], denied: [], files: { pack: ".map-authoring/l2v2/audits/pilot/y.pack.md", out }, tree: [DATA, REGISTRY], allowed: new Set<string>(), out, slice: "audit:pilot", group: "y" };
  const tamper = fakeEnv(root, { "deep-audit": (r) => (mkdirSync(join(r, ".map-authoring/l2v2/audits/pilot"), { recursive: true }), writeFileSync(join(r, out), "{}"), guarded.forEach((path) => writeFileSync(join(r, path), "tampered")), writeFileSync(join(r, ".git/hooks/post-merge"), "x")) });
  await assert.rejects(guardedSession(tamper, request), (error: unknown) => error instanceof GuardError && [...guarded, ".git/hooks/post-merge"].every((path) => (error as Error).message.includes(path)));
  for (const path of guarded.filter((p) => !p.endsWith("ledger.jsonl"))) assert.equal(readFileSync(join(root, path), "utf8"), before[path], path);
  const ledger = readFileSync(join(root, ".map-authoring/l2v2/ledger.jsonl"), "utf8");
  assert.ok(ledger.startsWith(before[".map-authoring/l2v2/ledger.jsonl"]) && /"role":"deep-audit"/.test(ledger.split("\n").at(-2)!), "the ledger comes back, then records the session");
  assert.ok(!existsSync(join(root, out)) && !existsSync(join(root, ".git/hooks/post-merge")));
  // An honest audit writes only its output, which stays.
  await guardedSession(fakeEnv(root, { "deep-audit": (r) => writeFileSync(join(r, out), '{"run":"r"}') }), request);
  assert.equal(readFileSync(join(root, out), "utf8"), '{"run":"r"}');
});

// ---------------------------------------------------------------- persisted records, shell output, rollback

test("records read back from batch state are validated before anything renders them: hand-edited state never becomes code", async () => {
  const data = withRecords(dataFile([]), [toContent(staged("y", "Fine."))]);
  const registry = 'export const AUTHORED_CONTENT_CONCEPTS = [\n  "y",\n];\n';
  const evil: unknown[] = [
    { ...staged("y", "x"), body: [{ kind: "flow", label: "L", stages: [{ "a: (globalThis.pwned = 1), b": "x" }] }] },
    { ...staged("y", "x"), conceptId: 'y", (globalThis.pwned = 1), "' },
    { ...staged("y", "x"), body: [{ kind: ["paragraph"], text: "x" }] },
    JSON.parse('{"conceptId":"y","definition":"D.","body":[{"kind":"paragraph","text":"x","__proto__":{"y":1}}]}'),
    { ...staged("y", "x"), definition: { toString: "x" } },
  ];
  for (const record of evil) {
    assert.match(recordsInPlaceProblems(data, registry, [record]).join(), /not valid \(never rendered\)/);
    assert.equal(recordPlacement(data, record), "invalid");
    assert.throws(() => toContent(record as StagedRecord), /invalid record/);
  }
  assert.throws(() => withRegistry(registry, ['x", (globalThis.pwned = 1), "']), /not concept identifiers/);
  assert.throws(() => renderRecord({ id: "y-content", conceptId: "y", definition: "D.", body: [{ kind: "paragraph", text: "x", "evil: 1, x": "y" } as never] }), /refusing to render the key/);
  // A batch in review whose persisted record was edited by hand stops; data.ts is never touched.
  const root = fixture();
  const stalled = await runBatch(fakeEnv(root, { ...happy, review: () => {}, "review:resume": () => {} }), input);
  assert.equal(stalled.stop!.status, "drafted");
  const resumed = resumeBatch(loadBatch(root, "s", "g")!, "drafted", T);
  resumed.records!.y = evil[0] as StagedRecord;
  saveBatch(root, resumed);
  const before = readFileSync(join(root, DATA), "utf8");
  const state = await runBatch(fakeEnv(root, happy), input);
  assert.match(state.stop!.reason, /changed outside the driver or are not valid: y \(invalid\)/);
  assert.equal(readFileSync(join(root, DATA), "utf8"), before);
  assert.equal((globalThis as { pwned?: unknown }).pwned, undefined);
});

test("shell: stdout is data and stderr never mixes in; git content is read as bytes with its executable bit; nested worktrees are skipped", () => {
  const out = runCommand(process.execPath, ["-e", "process.stdout.write('data'); process.stderr.write('warning')"], tmpdir());
  assert.deepEqual([out.ok, out.stdout, out.stderr], [true, "data", "warning"]);
  const repo = mkdtempSync(join(tmpdir(), "l2v2-git-"));
  const git = (cwd: string, ...args: string[]) => spawnSync("git", ["-c", "user.email=t@example.com", "-c", "user.name=t", ...args], { cwd, encoding: "utf8" });
  git(repo, "init", "-q");
  const binary = Buffer.from([...Array(256).keys()]);
  writeFileSync(join(repo, "bin.dat"), binary);
  writeFileSync(join(repo, "tool.sh"), "#!/bin/sh\n");
  chmodSync(join(repo, "tool.sh"), 0o755);
  git(repo, "add", ".");
  git(repo, "commit", "-qm", "base");
  mkdirSync(join(repo, ".worktrees/other"), { recursive: true });
  git(join(repo, ".worktrees/other"), "init", "-q");
  writeFileSync(join(repo, "note.txt"), "x");
  const bin = gitHeadEntry(repo, "bin.dat")!;
  assert.ok(bin.kind === "file" && bin.data.equals(binary) && bin.mode === 0o644);
  assert.equal((gitHeadEntry(repo, "tool.sh") as { mode: number }).mode, 0o755);
  assert.equal(gitHeadEntry(repo, "missing.txt"), undefined);
  assert.deepEqual(gitChangedPaths(repo), ["note.txt"]);
  const real = (path: string) => spawnSync("realpath", ["-m", path], { encoding: "utf8" }).stdout.trim();
  assert.deepEqual(gitSurfaces(repo).map(real), ["config", "config.worktree", "hooks", "info"].map((name) => real(join(repo, ".git", name))));
});

test("rollback restores bytes and modes: a binary user file and an executable bit come back exactly", async () => {
  const root = fixture();
  const binary = Buffer.from([...Array(256).keys()]);
  writeFileSync(join(root, "assets.bin"), binary);
  writeFileSync(join(root, "tool.sh"), "#!/bin/sh\n");
  chmodSync(join(root, "tool.sh"), 0o755);
  const state = await runBatch(fakeEnv(root, { ...happy, review: (r, p) => (happy.review!(r, p), writeFileSync(join(r, "assets.bin"), "text"), chmodSync(join(r, "tool.sh"), 0o644)) }), input);
  assert.equal(state.status, "stopped");
  assert.ok(readFileSync(join(root, "assets.bin")).equals(binary));
  assert.equal(statSync(join(root, "tool.sh")).mode & 0o777, 0o755);
});

test("a draft rewrite that fails leaves nothing of the draft rendered: the tree is as it was before the draft", async () => {
  const root = fixture();
  let before: { data: string; registry: string } | undefined;
  const env = fakeEnv(root, {
    ...happy,
    draft: (r, p) => ((before = { data: readFileSync(join(r, DATA), "utf8"), registry: readFileSync(join(r, REGISTRY), "utf8") }), happy.draft!(r, p)),
    "draft:resume": (r) => writeFileSync(join(r, "src/new.ts"), "x"),
  });
  let checks = 0;
  env.check = async (_group, withRecords) => (withRecords && ++checks === 1 ? ["x: record too thin"] : []);
  const state = await runBatch(env, input);
  assert.match(state.stop!.reason, /draft changed what it may not/);
  assert.deepEqual({ data: readFileSync(join(root, DATA), "utf8"), registry: readFileSync(join(root, REGISTRY), "utf8") }, before);
  assert.equal(state.records, undefined);
  assert.ok(!existsSync(join(root, "src/new.ts")));
});

// ---------------------------------------------------------------- limits, resumes, independence

test("batch limits: sessions (failed ones count) and wall-clock time stop the batch before another session starts", async () => {
  const counted = fakeEnv(fixture(), happy);
  const limited = await runBatch(counted, { ...input, limits: { sessions: 3, minutes: 600, sessionTimeoutMs: 1 } });
  assert.match(limited.stop!.reason, /session limit: the batch used its 3 sessions/);
  assert.deepEqual([counted.calls.length, limited.window!.sessions], [3, 3]);
  const root = fixture();
  await assert.rejects(runBatch(fakeEnv(root, { ...happy, "plan-review": () => { throw new Error("usage limit"); } }), input), /usage limit/);
  assert.deepEqual([loadBatch(root, "s", "g")!.window!.sessions, loadBatch(root, "s", "g")!.window!.failed], [2, 1]);
  // The fake clock makes each session last a minute: two minutes allow two sessions.
  const timed = await runBatch(fakeEnv(fixture(), happy), { ...input, limits: { sessions: 99, minutes: 2, sessionTimeoutMs: 1 } });
  assert.match(timed.stop!.reason, /time limit: the batch used its 2 minutes/);
  assert.equal(timed.window!.ms, 120_000);
});

test("a session the driver never saw finish counts as interrupted, for its whole timeout, and the batch stops for a human", async () => {
  const root = fixture();
  const state = newBatch("s", "g", ["x", "y"], T);
  state.window!.sessions = 1;
  state.window!.inFlight = { role: "plan", startedAt: T };
  saveBatch(root, state);
  const env = fakeEnv(root, happy);
  const after = await runBatch(env, { ...input, limits: { sessions: 20, minutes: 240, sessionTimeoutMs: 1_800_000 } });
  assert.match(after.stop!.reason, /interrupted .* never checked/);
  assert.deepEqual([after.window!.interrupted, after.window!.ms, after.window!.inFlight, env.calls.length], [1, 1_800_000, undefined, 0]);
  assert.match((loadLedger(root).at(-1) as { reason: string }).reason, /^interrupted/);
});

const misquote: Script = {
  ...happy,
  review: (r, p) => emit(r, p, { concepts: { y: review(), x: review({ verdict: "defect", findings: [defect("x", "Not in the record.", "Fixed.")] }) }, group: { note: "n", findings: [], resolutions: [] } }),
  "review:resume": (r, p) => emit(r, p, { concepts: passes(["x", "y"], { x: [{ id: "review-x-1", status: "fixed", why: "" }] }) }),
};
const clean: Script = { ...happy, review: (r, p) => emit(r, p, { concepts: { x: review(), y: review() }, group: { note: "n", findings: [], resolutions: [] } }) };

test("a resume restarts from the evidence of the status resumed at: stale findings never decide, the history keeps them", async () => {
  const root = fixture();
  const parked = await runBatch(fakeEnv(root, misquote), input);
  assert.equal(parked.conceptStates.x.state, "parked");
  saveBatch(root, resumeBatch(loadBatch(root, "s", "g")!, "drafted", T));
  const state = await runBatch(fakeEnv(root, clean), input);
  assert.equal(state.status, "accepted", state.stop?.reason);
  assert.equal(state.defects["review-x-1"], undefined, "the earlier attempt's refused defect does not decide");
  assert.equal(state.history![0].evidence.defects["review-x-1"].status, "refused", "it stays in the history");
  assert.equal(state.attempt, 2);
  assert.match(readFileSync(join(root, DATA), "utf8"), /x-content/, "the parked record was rendered again from its validated data");
});

test("a corrected plan claim still sends its concept to the second review after a resume", async () => {
  const fixing: Script = { ...happy, "plan-review": (r, p) => emit(r, p, { verdict: "fix", claimFixes: [{ concept: "x", quote: "every node agrees", replacement: "correct nodes agree", why: "overclaim" }], note: "" }), "plan-review:resume": (r, p) => emit(r, p, { verdict: "pass", claimFixes: [], note: "confirmed" }), escalate: (r, p) => emit(r, p, { concepts: { x: review() } }) };
  const root = fixture();
  assert.equal((await runBatch(fakeEnv(root, { ...fixing, review: () => {}, "review:resume": () => {} }), input)).stop!.status, "drafted");
  saveBatch(root, resumeBatch(loadBatch(root, "s", "g")!, "drafted", T));
  const env = fakeEnv(root, fixing);
  assert.equal((await runBatch(env, input)).status, "accepted");
  assert.ok(env.calls.includes("escalate"));
});

test("open deep-audit defects survive a resume that keeps the record, and go only with a redraft", () => {
  let state = newBatch("s", "g", ["x"], T);
  for (const to of ["planned", "plan-reviewed", "drafted", "reviewed", "escalated"] as const) state = advance(state, to, T);
  recordDefects(state, [defect("x", "q", "r")], "audit-pilot-x-0", "deep-audit");
  recordDefects(state, [defect("x", "q2", "r2")], "escalate-x", "escalate");
  state = stopBatch(state, "parked", T);
  const kept = resumeBatch(state, "escalated", T);
  assert.deepEqual(Object.keys(kept.defects), ["audit-pilot-x-0-1"]);
  assert.equal(kept.conceptStates.x.state, "open");
  assert.deepEqual(Object.keys(resumeBatch(state, "reviewed", T).defects), ["audit-pilot-x-0-1"], "the escalation's own defects go with the escalation it reruns");
  const redrafted = resumeBatch(state, "plan-reviewed", T);
  assert.deepEqual(redrafted.defects, {});
  assert.equal(Object.keys(redrafted.history![0].evidence.defects).length, 2);
});

test("independent reviewers read only the sources, the prompts and their pack: never the batch state or another session's output, never the first review", async () => {
  const formal: Script = {
    ...happy,
    review: (r, p) => emit(r, p, { concepts: { y: review(), x: review({ verdict: "defect", note: "FIRST-REVIEW-NOTE", confidence: "medium", findings: [defect("x", "Nodes always agree.", "Correct nodes agree under synchrony.", "formal-results")] }) }, group: { note: "n", findings: [], resolutions: [] } }),
    escalate: (r, p) => emit(r, p, { concepts: { x: review() } }),
  };
  const env = fakeEnv(fixture(), formal);
  assert.equal((await runBatch(env, input)).status, "accepted");
  const escalation = env.prompts[env.calls.indexOf("escalate")];
  assert.doesNotMatch(escalation, /FIRST-REVIEW-NOTE|confidence medium|Correct nodes agree|formal-results|review-x-1/);
  assert.match(escalation, /formal results with all their conditions/);
  // Each session reads the sources, docs and prompts, its pack, and the one file it writes: nothing else of the batch.
  for (const request of env.requests)
    for (const tool of request.tools.filter((t) => t.startsWith("Read("))) {
      const path = tool.slice(5, -1);
      assert.ok(["src/**", "docs/**", "scripts/l2v2/prompts/**", `${batchDir("s", "g")}/pack.md`].includes(path) || request.tools.includes(`Write(${path})`), `${request.role}: ${tool}`);
    }
});

// ---------------------------------------------------------------- the CLI: finalize, requireTree and the guarded deep audit

const SCRIPT = join(import.meta.dirname, "../../../../../scripts/map-l2v2.ts");
/** A stand-in for the dedicated token: every CLI session needs one, in a file only its owner can read. */
const TOKEN_FILE = (() => {
  const file = join(mkdtempSync(join(tmpdir(), "l2v2-token-")), "token");
  writeFileSync(file, "test-token-not-real\n", { mode: 0o600 });
  return file;
})();
/**
 * CLI tests that start sessions need the sandbox (bubblewrap, user namespaces). They never run unsandboxed: where the
 * sandbox cannot exist they are skipped, unless L2V2_REQUIRE_SANDBOX=1 (Linux CI), where they run and fail.
 */
const SANDBOX_PROBLEMS = sandboxProblems({ root: tmpdir(), bwrap: process.env.L2V2_BWRAP ?? "bwrap", claude: process.execPath, tokenFile: TOKEN_FILE, egress: [], relay: { upstream: "http://127.0.0.1:9", paths: ["/v1/"] }, configRoot: tmpdir(), launcher: join(import.meta.dirname, "../../../../../scripts/l2v2/sandbox-launch.mjs") });
const NO_SANDBOX = process.env.L2V2_REQUIRE_SANDBOX !== "1" && SANDBOX_PROBLEMS.length > 0 ? `the session sandbox is unavailable here: ${SANDBOX_PROBLEMS[0]}` : false;
test("the session sandbox is available wherever L2V2_REQUIRE_SANDBOX=1 requires it", { skip: process.env.L2V2_REQUIRE_SANDBOX !== "1" && "not required here" }, () => {
  assert.deepEqual(SANDBOX_PROBLEMS, []);
});
const cli = (root: string, args: string[], extra: Record<string, string> = {}) =>
  spawnSync(process.execPath, ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", SCRIPT, ...args], { cwd: root, encoding: "utf8", env: { ...process.env, L2V2_TOKEN_FILE: TOKEN_FILE, ...extra } });
/** A git checkout with a v1 run of slice s whose only group g was authored and accepted by v2, its sample settled. */
async function acceptedSlice(): Promise<string> {
  const root = fixture();
  const git = (...args: string[]) => spawnSync("git", ["-c", "user.email=t@example.com", "-c", "user.name=t", ...args], { cwd: root, encoding: "utf8" });
  writeFileSync(join(root, ".gitignore"), "/.map-authoring/\n/node_modules/\n.claude/\n");
  git("init", "-q");
  git("add", ".");
  git("commit", "-qm", "base");
  mkdirSync(join(root, ".map-authoring/l2"), { recursive: true });
  writeFileSync(join(root, ".map-authoring/l2/s.json"), JSON.stringify({ domainId: "s", branch: "main", baseSha: git("rev-parse", "HEAD").stdout.trim(), stage: "author", l2: { slice: { groups: [{ group: "g", concepts: ["x", "y"] }] }, steps: {} } }));
  assert.equal((await runBatch(fakeEnv(root, happy), input)).status, "accepted");
  writeFileSync(join(root, ".map-authoring/l2v2/s/sample.json"), JSON.stringify({ slice: "s", concepts: ["y"], audited: { y: { substantive: 0, repaired: false } } }));
  return root;
}
/** A stand-in for the claude CLI: writes the session's output (a deep audit's, by default) with `body` and, when asked, tampers with the campaign authorization. */
function stubClaude(body: string, tamper = false, output = "\\.map-authoring/l2v2/audits/[^ ]*\\.audit\\.json"): string {
  const bin = join(mkdtempSync(join(tmpdir(), "l2v2-bin-")), "claude");
  writeFileSync(bin, [
    "#!/bin/sh",
    'prompt=$(cat)',
    `out=$(printf '%s' "$prompt" | grep -o '${output}' | head -1)`,
    `run=$(printf '%s' "$prompt" | grep -o '"run": "[^"{}]*"' | head -1 | sed 's/"run": "\\(.*\\)"/\\1/')`,
    `printf '{"run":"%s",${body}}' "$run" > "$out"`,
    ...(tamper ? [`printf '{"merge":true}' > .map-authoring/campaign.json`] : []),
    // A fresh session id per session, or the resumed one, as the CLI reports them.
    'id=$(cat /proc/sys/kernel/random/uuid); prev=; for a; do [ "$prev" = --resume ] && id=$a; prev=$a; done',
    `printf '{"session_id":"%s","result":"done","num_turns":1,"duration_ms":1}\\n' "$id"`,
    "",
  ].join("\n"));
  chmodSync(bin, 0o755);
  return bin;
}

test("finalize: with every gate met it reaches v1's recording; a known audit defect, an edited record or hand-edited state blocks it first", async () => {
  const root = await acceptedSlice();
  const clean = cli(root, ["finalize", "--slice", "s"]);
  assert.equal(clean.status, 1);
  assert.match(clean.stderr, /l2 record plan g --domain s refused/, "every v2 gate passed; v1's own recording is the next step");
  appendLedger(root, { kind: "deep-audit", at: "2026-10-09T01:00:00.000Z", label: "pilot", concept: "y", substantive: 1, campaign: true });
  const known = cli(root, ["finalize", "--slice", "s"]);
  assert.equal(known.status, 3);
  assert.match(known.stderr, /known defects must be repaired first.*\n- y: substantive defects found by deep audit "pilot"/);
});

test("requireTree: an edited record or hand-edited batch state stops run, audit and finalize before anything is imported or run", async () => {
  const edited = await acceptedSlice();
  writeFileSync(join(edited, DATA), readFileSync(join(edited, DATA), "utf8").replace("Fine text.", "Fine text, edited by hand."));
  for (const args of [["finalize", "--slice", "s"], ["run", "--slice", "s"], ["audit", "--label", "pilot", "--concepts", "y", "--slice", "s"]]) {
    const result = cli(edited, args);
    assert.equal(result.status, 1, args.join(" "));
    assert.match(result.stderr, /changed outside the driver \(nothing was imported or run\):\n- g: y: data\.ts does not hold/, args.join(" "));
  }
  const tampered = await acceptedSlice();
  const state = loadBatch(tampered, "s", "g")!;
  state.records!.y = { ...state.records!.y, body: [{ kind: "flow", label: "L", stages: [{ "a: (globalThis.pwned = 1), b": "x" }] } as never] };
  saveBatch(tampered, state);
  const result = cli(tampered, ["finalize", "--slice", "s"]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /a persisted record is not valid \(never rendered\)/);
});

test("the CLI's deep audit runs in the sandbox: a write to the campaign authorization never reaches the host; an honest audit's defects then block finalize", { skip: NO_SANDBOX }, async () => {
  const root = await acceptedSlice();
  writeFileSync(join(root, ".map-authoring/campaign.json"), '{"merge":false}');
  const defects = `"verdict":"defect","confidence":"high","substantive":[{"rule":"overclaim","quote":"Fine text.","replacement":"Fine.","why":"t"}],"remarks":[],"coverage":[],"depth":"d"`;
  // The stand-in CLI also tries to overwrite campaign.json: in the sandbox the run state does not exist and /work is read-only.
  const tampering = cli(root, ["audit", "--label", "pilot", "--concepts", "y", "--slice", "s"], { L2V2_CLAUDE: stubClaude(defects, true) });
  assert.equal(tampering.status, 0, tampering.stderr);
  assert.equal(readFileSync(join(root, ".map-authoring/campaign.json"), "utf8"), '{"merge":false}');
  const honest = cli(root, ["audit", "--label", "pilot", "--concepts", "y", "--slice", "s"], { L2V2_CLAUDE: stubClaude(defects) });
  assert.equal(honest.status, 0, honest.stderr);
  assert.match(honest.stdout, /y has known defects: finalize refuses its slice/);
  const entry = loadLedger(root).findLast((e) => e.kind === "deep-audit") as { fingerprint?: string };
  assert.equal(entry.fingerprint, recordFingerprint(loadBatch(root, "s", "g")!.records!.y), "the audit is bound to the record it read");
  assert.equal(cli(root, ["finalize", "--slice", "s"]).status, 3);
});

// ---------------------------------------------------------------- closure: resume, preservation, foreign records, audit bounds, process groups

const REVIEW_PASS = `{"verdict":"pass","confidence":"high","findings":[],"coverage":[{"claim":0,"mechanism":true,"conditions":true,"failureOrConfusion":true}],"note":"n","resolutions":[]}`;
/**
 * A git checkout where the CLI can run a batch for real: stand-ins for the npm
 * scripts the driver calls (`map:author -- l2 ...` and `map:generate`) and the
 * focused tests, all committed, and a v1 run of slice s with group g.
 */
function cliCheckout(): string {
  const root = fixture();
  const git = (...args: string[]) => spawnSync("git", ["-c", "user.email=t@example.com", "-c", "user.name=t", ...args], { cwd: root, encoding: "utf8" });
  writeFileSync(join(root, ".gitignore"), "/.map-authoring/\n/node_modules/\n.claude/\n");
  writeFileSync(join(root, "package.json"), JSON.stringify({ private: true, type: "module", scripts: { "map:author": "node l2-stub.mjs", "map:generate": "node -e 0" } }));
  writeFileSync(join(root, "l2-stub.mjs"), [
    "const [, command] = process.argv.slice(2);",
    'const out = { signals: [], "group-signals": [], check: [{ problems: [], stale: [] }], context: { placements: [{}], owner: { domain: "d" } } }[command];',
    "if (out === undefined) process.exit(1);",
    "process.stdout.write(JSON.stringify(out));",
  ].join("\n"));
  for (const test of ["src/lib/map/map.test.ts", "src/lib/map/authoring/context.test.ts", "src/components/map/explorer-model.test.ts"]) {
    mkdirSync(join(root, test, ".."), { recursive: true });
    writeFileSync(join(root, test), 'import test from "node:test";\ntest("ok", () => {});\n');
  }
  git("init", "-q");
  git("add", ".");
  git("commit", "-qm", "base");
  mkdirSync(join(root, ".map-authoring/l2"), { recursive: true });
  writeFileSync(join(root, ".map-authoring/l2/s.json"), JSON.stringify({ domainId: "s", branch: git("rev-parse", "--abbrev-ref", "HEAD").stdout.trim(), baseSha: git("rev-parse", "HEAD").stdout.trim(), stage: "author", l2: { slice: { groups: [{ group: "g", concepts: ["x", "y"] }] }, steps: {} } }));
  return root;
}

test("CLI: park, resume, run: the parked record is rendered again and the batch completes; a missing accepted record is still refused", { skip: NO_SANDBOX }, async () => {
  const root = cliCheckout();
  const parked = await runBatch(fakeEnv(root, misquote), input);
  assert.equal(parked.conceptStates.x.state, "parked");
  assert.doesNotMatch(readFileSync(join(root, DATA), "utf8"), /x-content/);
  const resumed = cli(root, ["resume", "--slice", "s", "--group", "g", "--at", "drafted"]);
  assert.equal(resumed.status, 0, resumed.stderr);
  const ran = cli(root, ["run", "--slice", "s"], { L2V2_CLAUDE: stubClaude(`"concepts":{"x":${REVIEW_PASS},"y":${REVIEW_PASS}},"group":{"note":"n","findings":[],"resolutions":[]}`, false, "\\.map-authoring/l2v2/s/g/[^ ]*\\.json") });
  assert.equal(ran.status, 0, ran.stderr);
  assert.match(ran.stdout, /batch g: x, y\n {2}-> accepted\nevery requested batch is accepted/);
  const state = loadBatch(root, "s", "g")!;
  assert.deepEqual([state.status, state.conceptStates.x.state, state.attempt], ["accepted", "accepted", 2]);
  assert.match(readFileSync(join(root, DATA), "utf8"), /x-content/);
  // Usage the CLI did not report stays unknown.
  const session = loadLedger(root).findLast((e) => e.kind === "session") as { usage: unknown; weighted: unknown };
  assert.deepEqual([session.usage, session.weighted], [null, null]);
  // An accepted record that goes missing is still refused before anything runs.
  writeFileSync(join(root, DATA), withoutRecords(readFileSync(join(root, DATA), "utf8"), ["y"]));
  writeFileSync(join(root, ".map-authoring/l2v2/s/sample.json"), JSON.stringify({ slice: "s", concepts: ["x"], audited: { x: { substantive: 0, repaired: false } } }));
  const refused = cli(root, ["finalize", "--slice", "s"]);
  assert.equal(refused.status, 1, refused.stderr);
  assert.match(refused.stderr, /- g: y: data\.ts does not hold the driver's rendering/);
});

/** An accepted batch whose audit repair of y failed verification: y is parked, the batch stopped. */
async function failedRepair(root: string) {
  assert.equal((await runBatch(fakeEnv(root, happy), input)).status, "accepted");
  const stillOpen = (r: string, p: string) => {
    const id = Object.keys(loadBatch(r, "s", "g")!.defects).find((d) => d.startsWith("audit-"))!;
    emit(r, p, { concepts: { y: { verdict: "defect", findings: [], defects: [{ id, status: "open", why: "still overclaims" }], note: "not fixed", resolutions: [] } } });
  };
  const after = await repairAfterAudit(fakeEnv(root, { "deep-audit:resume": stillOpen }), { ...input, concept: "y", findings: [{ rule: "overclaim", quote: "Fine text.", replacement: "Fine text, under its conditions.", why: "audit" }], auditSession: "audit-1", label: "pilot" });
  assert.deepEqual([after.status, after.conceptStates.y.state, after.conceptStates.x.state], ["stopped", "parked", "accepted"]);
  return after;
}

test("a failed audit repair, then a resume: the history keeps every record, accepted but unfinalized text included, and nothing historical counts as accepted", async () => {
  const root = fixture();
  const stopped = await failedRepair(root);
  const accepted = stopped.records!.x;
  const redraft = resumeBatch(stopped, "plan-reviewed", T);
  assert.deepEqual(redraft.history![0].records!.x, accepted, "the accepted text is preserved");
  assert.equal(redraft.history![0].evidence.conceptStates.x.state, "accepted");
  assert.equal(redraft.records, undefined, "a redraft starts without current records");
  assert.ok(Object.values(redraft.conceptStates).every((c) => c.state !== "accepted" && !c.accepted), "no current concept is accepted");
  saveBatch(root, redraft);
  const state = await runBatch(fakeEnv(root, { ...happy, draft: (r, p) => emit(r, p, { records: [staged("x", "Nodes always agree."), staged("y", "Redrafted text.")] }) }), input);
  assert.equal(state.status, "accepted", state.stop?.reason);
  assert.deepEqual(state.history![0].records!.x, accepted);
  const data = readFileSync(join(root, DATA), "utf8");
  assert.equal(data.split('id: "x-content",').length, 2, "the driver's own earlier rendering was replaced, not duplicated");
  assert.match(data, /Redrafted text\./);
  // Resuming without a redraft keeps the records, and the history holds them too.
  const kept = resumeBatch(await failedRepair(fixture()), "escalated", T);
  assert.ok(kept.records?.x && kept.history![0].records?.x);
});

test("draft cleanup removes only the driver's own renderings: a record or registry entry it did not write, or one edited since, stops the batch and stays", async () => {
  for (const [name, plant] of [
    ["a hand-written record", (r: string) => appendRecord(r, "x", "Written by hand.")],
    ["a registry entry alone", (r: string) => writeFileSync(join(r, REGISTRY), readFileSync(join(r, REGISTRY), "utf8").replace("];", '  "x",\n];'))],
  ] as const) {
    const root = fixture();
    plant(root);
    const before = { data: readFileSync(join(root, DATA), "utf8"), registry: readFileSync(join(root, REGISTRY), "utf8") };
    const env = fakeEnv(root, happy);
    const state = await runBatch(env, input);
    assert.match(state.stop!.reason, /records the driver did not write are in the tree \(nothing was removed\): x:/, name);
    assert.deepEqual({ data: readFileSync(join(root, DATA), "utf8"), registry: readFileSync(join(root, REGISTRY), "utf8") }, before, name);
    assert.equal(env.calls.length, 0, `${name}: no session ran`);
  }
  // The driver's own rendering, edited by hand after a stop: refused at the redraft, the edit kept.
  const root = fixture();
  saveBatch(root, resumeBatch(await failedRepair(root), "plan-reviewed", T));
  writeFileSync(join(root, DATA), readFileSync(join(root, DATA), "utf8").replace("Correct nodes agree under synchrony.", "Edited by hand."));
  const state = await runBatch(fakeEnv(root, happy), input);
  assert.match(state.stop!.reason, /x: data\.ts holds a record this driver did not render, or one edited since/);
  assert.match(readFileSync(join(root, DATA), "utf8"), /Edited by hand\./);
});

test("stop rules count failed and interrupted sessions of every role", () => {
  const ok = (i: number): LedgerEntry => ({ kind: "session", at: T, slice: "s", group: "g", role: "review", sessionId: `s${i}`, durationMs: 1, turns: 1, usage: null, weighted: null });
  const failed = (i: number): LedgerEntry => ({ kind: "session-failed", at: T, slice: "audit:pilot", group: `c${i}`, role: "deep-audit", reason: i ? "exit" : "interrupted: the CLI stopped" });
  assert.equal(stopReason([failed(0), failed(1), ...Array.from({ length: 10 }, (_, i) => ok(i))]), undefined, "only the recent window counts");
  assert.match(stopReason([ok(0), failed(0), failed(1), failed(2)])!, /3 of the last 4 sessions failed or were interrupted/);
});

test("CLI audits are bounded: a concept cap per command, the stop rules before every session, failed sessions counted, an interrupted one reported", { skip: NO_SANDBOX }, async () => {
  const root = await acceptedSlice();
  const sessions = () => loadLedger(root).filter((e) => e.kind === "session" || e.kind === "session-failed").length;
  const start = sessions();
  // A stand-in CLI, so the result never depends on whether Claude Code is installed here; arguments are refused before any session.
  const standIn = { L2V2_CLAUDE: stub("exit 1") };
  const capped = cli(root, ["audit", "--label", "pilot", "--concepts", Array.from({ length: 13 }, (_, i) => `c${i}`).join(",")], standIn);
  assert.equal(capped.status, 2);
  assert.match(capped.stderr, /at most 12 concepts \(budget\.json maxAuditConcepts\); 13 given/);
  writeFileSync(join(root, ".map-authoring/l2v2/budget.json"), '{"maxAuditConcepts":1}');
  assert.equal(cli(root, ["audit", "--label", "pilot", "--concepts", "x,y", "--slice", "s"], standIn).status, 2);
  rmSync(join(root, ".map-authoring/l2v2/budget.json"));
  // Valid arguments still fail closed without the sandbox's prerequisites (here, no CLI).
  const noCli = cli(root, ["audit", "--label", "pilot", "--concepts", "y", "--slice", "s"], { L2V2_CLAUDE: "/nonexistent/claude" });
  assert.equal(noCli.status, 1);
  assert.match(noCli.stderr, /the session sandbox cannot be set up, so no session was started:\n- the Claude CLI is missing/);
  assert.equal(sessions(), start, "no session started");
  // Failed sessions count: after three, the stop rule refuses the next audit before it starts.
  const broken = stub("exit 1");
  for (let i = 0; i < 3; i++) assert.equal(cli(root, ["audit", "--label", "pilot", "--concepts", "y", "--slice", "s"], { L2V2_CLAUDE: broken }).status, 1);
  assert.ok(!existsSync(join(root, ".map-authoring/l2v2/audits/in-flight.json")), "a failed session is not mistaken for an interrupted one");
  const gated = cli(root, ["audit", "--label", "pilot", "--concepts", "y", "--slice", "s"], { L2V2_CLAUDE: broken });
  assert.equal(gated.status, 3);
  assert.match(gated.stderr, /stop rule: 3 of the last \d+ sessions failed or were interrupted/);
  rmSync(join(root, ".map-authoring/l2v2/s/sample.json"));
  const sampleGated = cli(root, ["audit", "--sample-slice", "s"], { L2V2_CLAUDE: broken });
  assert.equal(sampleGated.status, 3);
  assert.equal(sessions(), start + 3, "the gated commands started no session");
});

test("CLI: a sample audit runs one guarded session per sampled concept with unknown usage kept unknown; an interrupted audit session is reported once", { skip: NO_SANDBOX }, async () => {
  const root = await acceptedSlice();
  rmSync(join(root, ".map-authoring/l2v2/s/sample.json"));
  const pass = stubClaude(`"verdict":"pass","confidence":"high","substantive":[],"remarks":[],"coverage":[],"depth":"d"`);
  const sampled = cli(root, ["audit", "--sample-slice", "s"], { L2V2_CLAUDE: pass });
  assert.equal(sampled.status, 0, sampled.stderr);
  const sample = JSON.parse(readFileSync(join(root, ".map-authoring/l2v2/s/sample.json"), "utf8")) as SliceSample;
  assert.deepEqual(Object.keys(sample.audited).sort(), [...sample.concepts].sort());
  const audits = loadLedger(root).filter((e): e is Extract<LedgerEntry, { kind: "session" }> => e.kind === "session" && e.role === "deep-audit");
  assert.equal(audits.length, sample.concepts.length);
  assert.ok(audits.every((e) => e.usage === null && e.weighted === null), "usage the CLI did not report stays unknown");
  // A session the CLI never saw finish: recorded as interrupted, the command stops for a human; the next one runs.
  mkdirSync(join(root, ".map-authoring/l2v2/audits"), { recursive: true });
  writeFileSync(join(root, ".map-authoring/l2v2/audits/in-flight.json"), JSON.stringify({ label: "pilot", concept: "y", startedAt: T }));
  const interrupted = cli(root, ["audit", "--label", "pilot", "--concepts", "y", "--slice", "s"], { L2V2_CLAUDE: pass });
  assert.equal(interrupted.status, 3);
  assert.match(interrupted.stderr, /the deep audit of y \(pilot\) was interrupted and its changes were never checked/);
  assert.match((loadLedger(root).at(-1) as { reason: string }).reason, /^interrupted/);
  assert.equal(cli(root, ["audit", "--label", "pilot", "--concepts", "y", "--slice", "s"], { L2V2_CLAUDE: pass }).status, 0);
});

test("a session's whole process group dies with it: on a timeout and when it exits, no child it started can still write", async () => {
  for (const [name, body, timeoutMs] of [
    ["timeout", "sleep 5", 200],
    ["normal exit", `echo '{"session_id":"s","result":"done"}'`, 5000],
  ] as const) {
    const mark = join(mkdtempSync(join(tmpdir(), "l2v2-late-")), "late");
    const bin = stub(`( sleep 0.4; echo late > "${mark}" ) >/dev/null 2>&1 &\n${body}`);
    const outcome = await runClaude(options(bin, timeoutMs), "p", []).then(() => "resolved", (e: unknown) => (e instanceof SessionError ? e.reason : "other"));
    assert.equal(outcome, name === "timeout" ? "timeout" : "resolved", name);
    await new Promise((resolve) => setTimeout(resolve, 900));
    assert.ok(!existsSync(mark), `${name}: the background child never wrote`);
  }
});

// ---------------------------------------------------------------- acknowledged recovery from failures, and the kill escalation

test("the failure stop rule: resume and meter entries never clear it; an acknowledgment with a note starts a new window and clears nothing else", () => {
  const failed = (): LedgerEntry => ({ kind: "session-failed", at: T, slice: "s", group: "g", role: "draft", reason: "usage limit" });
  const ok = (): LedgerEntry => ({ kind: "session", at: T, slice: "s", group: "g", role: "draft", sessionId: "s", durationMs: 1, turns: 1, usage: null, weighted: null });
  const ack = (note = "Quota recovered; reviewed previous failures"): LedgerEntry => ({ kind: "ack", at: T, note, failures: 3 });
  const three = [failed(), failed(), failed()];
  assert.match(stopReason(three)!, /3 of the last 3 sessions failed or were interrupted/);
  assert.match(stopReason([...three, { kind: "resume", at: T, slice: "s", group: "g", status: "drafted" }, { kind: "meter", at: T, percent: 5 }])!, /3 of the last 3/, "a resume or a meter reading is no acknowledgment");
  assert.match(stopReason([...three, ack("   ")])!, /3 of the last 3/, "an acknowledgment without a note is none");
  assert.equal(stopReason([...three, ack()]), undefined, "a new window starts");
  assert.equal(stopReason([...three, ack(), ok(), ok()]), undefined, "sessions run again");
  assert.match(stopReason([...three, ack(), ok(), failed(), failed(), failed()])!, /3 of the last 4/, "new failures stop it again");
  // Only that rule: parked concepts and defective audits still stop the campaign.
  const parked: LedgerEntry = { kind: "batch", at: T, slice: "s", group: "g", accepted: 1, parked: 1, escalated: 0, defects: 1 };
  assert.match(stopReason([parked, ...three, ack()])!, /parked/);
  const defective = Array.from({ length: 8 }, (_, i): LedgerEntry => ({ kind: "deep-audit", at: T, label: "pilot", concept: `c${i}`, substantive: 1, campaign: true }));
  assert.match(stopReason([...defective, ...three, ack()])!, /sampled concepts had substantive defects/);
});

test("CLI clear-failures: a note is required; it appends an acknowledgment, keeps every failure, lets sessions run again and bypasses no other gate", { skip: NO_SANDBOX }, async () => {
  const root = await acceptedSlice();
  const ledgerPath = join(root, ".map-authoring/l2v2/ledger.jsonl");
  const audit = (bin: string) => cli(root, ["audit", "--label", "pilot", "--concepts", "y", "--slice", "s"], { L2V2_CLAUDE: bin });
  const broken = stub("exit 1");
  for (let i = 0; i < 3; i++) assert.equal(audit(broken).status, 1);
  assert.equal(audit(broken).status, 3, "the failure stop rule is broken");
  const before = readFileSync(ledgerPath, "utf8");
  for (const args of [["clear-failures"], ["clear-failures", "--note"], ["clear-failures", "--note", "   "]]) {
    const refused = cli(root, args);
    assert.equal(refused.status, 2, args.join(" "));
    assert.match(refused.stderr, /clear-failures needs --note/);
  }
  // A session awaiting recovery is never acknowledged away: an interrupted audit, or a batch session in flight.
  mkdirSync(join(root, ".map-authoring/l2v2/audits"), { recursive: true });
  writeFileSync(join(root, ".map-authoring/l2v2/audits/in-flight.json"), JSON.stringify({ label: "pilot", concept: "y", startedAt: T }));
  assert.match(cli(root, ["clear-failures", "--note", "checked"]).stderr, /awaits recovery: a deep audit/);
  rmSync(join(root, ".map-authoring/l2v2/audits/in-flight.json"));
  const state = loadBatch(root, "s", "g")!;
  saveBatch(root, { ...state, window: { ...state.window!, inFlight: { role: "review", startedAt: T } } });
  const blocked = cli(root, ["clear-failures", "--note", "checked"]);
  assert.equal(blocked.status, 3);
  assert.match(blocked.stderr, /awaits recovery: s\/g \(review\)/);
  saveBatch(root, state);
  assert.equal(readFileSync(ledgerPath, "utf8"), before, "nothing was appended by a refusal");
  const acked = cli(root, ["clear-failures", "--note", "Quota recovered; reviewed previous failures"]);
  assert.equal(acked.status, 0, acked.stderr);
  assert.match(acked.stdout, /acknowledged 3 failed or interrupted session\(s\) of the last \d+; they stay in the ledger\nstop rule: none broken/);
  const after = readFileSync(ledgerPath, "utf8");
  assert.ok(after.startsWith(before), "every earlier entry, failures included, is kept as it was");
  assert.deepEqual(JSON.parse(after.trim().split("\n").at(-1)!), { kind: "ack", at: (JSON.parse(after.trim().split("\n").at(-1)!) as { at: string }).at, note: "Quota recovered; reviewed previous failures", failures: 3 });
  assert.equal(cli(root, ["clear-failures", "--note", "again"]).status, 2, "nothing left to acknowledge");
  // Sessions run again.
  assert.equal(audit(stubClaude(`"verdict":"pass","confidence":"high","substantive":[],"remarks":[],"coverage":[],"depth":"d"`)).status, 0);
  // Other gates stand: an edited record and a known defect still block finalize.
  writeFileSync(join(root, DATA), readFileSync(join(root, DATA), "utf8").replace("Fine text.", "Edited by hand."));
  assert.match(cli(root, ["finalize", "--slice", "s"]).stderr, /changed outside the driver/);
  writeFileSync(join(root, DATA), readFileSync(join(root, DATA), "utf8").replace("Edited by hand.", "Fine text."));
  appendLedger(root, { kind: "deep-audit", at: "2026-10-09T01:00:00.000Z", label: "pilot", concept: "y", substantive: 1, campaign: true });
  const known = cli(root, ["finalize", "--slice", "s"]);
  assert.equal(known.status, 3);
  assert.match(known.stderr, /known defects must be repaired first/);
  // New failures stop it again.
  for (let i = 0; i < 3; i++) assert.equal(audit(broken).status, 1);
  assert.match(audit(broken).stderr, /stop rule: 3 of the last \d+ sessions failed/);
});

test("the SIGKILL escalation is cancelled once the session has closed, and still kills a group that ignores SIGTERM", async () => {
  const original = process.kill;
  const late: [number, unknown][] = [];
  let settled = false;
  process.kill = ((pid: number, signal?: string | number) => {
    if (settled && pid < 0) late.push([pid, signal]);
    return original.call(process, pid, signal as NodeJS.Signals);
  }) as typeof process.kill;
  try {
    const ended = await runClaude({ ...options(stub("sleep 5"), 100), killGraceMs: 300 }, "p", []).catch((error: unknown) => error);
    settled = true;
    assert.ok(ended instanceof SessionError && ended.reason === "timeout");
    await new Promise((resolve) => setTimeout(resolve, 600));
    assert.deepEqual(late, [], "no signal reaches the group id after the session closed");
  } finally {
    process.kill = original;
  }
  const started = Date.now();
  const stubborn = await runClaude({ ...options(stub("trap '' TERM\nsleep 3"), 100), killGraceMs: 300 }, "p", []).catch((error: unknown) => error);
  assert.ok(stubborn instanceof SessionError && stubborn.reason === "timeout");
  assert.ok(Date.now() - started < 2000, "SIGKILL ended the group that ignored SIGTERM");
});

test("CLI: when the sandbox cannot be set up (no bubblewrap, no token), run and audit start no session at all", async () => {
  const fresh = cliCheckout();
  for (const extra of [{ L2V2_BWRAP: "/nonexistent/bwrap" }, { L2V2_TOKEN_FILE: join(fresh, "no-token") }] as Record<string, string>[]) {
    const ran = cli(fresh, ["run", "--slice", "s"], { L2V2_CLAUDE: stub("exit 0"), ...extra });
    assert.equal(ran.status, 1, JSON.stringify(extra));
    assert.match(ran.stderr, /the session sandbox cannot be set up, so no session was started/);
  }
  assert.equal(loadBatch(fresh, "s", "g"), undefined, "no batch began");
  assert.deepEqual(loadLedger(fresh), [], "no session, failed or not, was recorded");
  const accepted = await acceptedSlice();
  const before = loadLedger(accepted).length;
  const audited = cli(accepted, ["audit", "--label", "pilot", "--concepts", "y", "--slice", "s"], { L2V2_BWRAP: "/nonexistent/bwrap" });
  assert.equal(audited.status, 1);
  assert.match(audited.stderr, /bubblewrap is not available at \/nonexistent\/bwrap/);
  assert.equal(loadLedger(accepted).length, before);
});
