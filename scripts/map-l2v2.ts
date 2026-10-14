// MAP L2 authoring pipeline v2: the deterministic driver (docs/map-authoring/l2-pipeline-v2.md).
//
//   npm run map:l2v2 -- run --slice <id> [--groups a,b]       author batches (one ownership group each) up to acceptance
//   npm run map:l2v2 -- status [--slice <id>]                 batch states and the first broken stop rule
//   npm run map:l2v2 -- resume --slice <id> --group <g> --at <status>   a human resumes a stopped batch (never forward)
//   npm run map:l2v2 -- audit --sample-slice <id>             draw and deep-audit the slice's measurement sample; repairs are verified
//   npm run map:l2v2 -- audit --label <l> --concepts a,b [--slice <id> --fix]   deep audits (pilot); --fix repairs through the verified loop
//   npm run map:l2v2 -- audit --label baseline --ref <git-ref> --concepts a,b   baseline audits of records at a commit (never counted, never fixed)
//   npm run map:l2v2 -- meter --percent <n> [--note ..]       record a reading of the Claude usage meter
//   npm run map:l2v2 -- report                                tokens, time, defects and acceptance per batch
//   npm run map:l2v2 -- finalize --slice <id>                 record the v1 steps (scoped to the slice), then `l2 run --until diff`
//
// Configuration: .map-authoring/l2v2/config.json {model, timeoutMs, maxBudgetUsd} and budget.json (stop-rule thresholds).
// It never pushes, opens PRs, merges or deploys: delivery stays `map:author -- l2 run --domain <slice>`.
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { mapKnowledge } from "../src/lib/map/data.ts";
import { recordSpans } from "../src/lib/map/authoring/l2/campaign.ts";
import {
  batchMetrics, BATCH_STATUSES, DEFAULT_BUDGET, finalizeCommands, parseJson, planBatches, resumeBatch, sample, sampleProblems, stopReason, weighted,
  type BatchStatus, type Budget, type Finding, type SliceSample,
} from "../src/lib/map/authoring/l2v2/core.ts";
import { runClaude } from "../src/lib/map/authoring/l2v2/claude.ts";
import { acquireLock, appendLedger, batchDir, DATA, loadBatch, loadLedger, PROMPTS, repairAfterAudit, runBatch, saveBatch, V2_ROOT, type Env } from "../src/lib/map/authoring/l2v2/driver.ts";

const ROOT = process.cwd();
const args = process.argv.slice(2);
const flag = (name: string) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const fail = (message: string, code = 2): never => {
  console.error(`map:l2v2: ${message}`);
  process.exit(code);
};
const now = () => new Date().toISOString();
const FOCUSED_TESTS = ["src/lib/map/map.test.ts", "src/lib/map/authoring/context.test.ts", "src/components/map/explorer-model.test.ts"];

function sh(command: string, argv: readonly string[]): { ok: boolean; out: string } {
  const result = spawnSync(command, argv, { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return { ok: result.status === 0, out: `${result.stdout ?? ""}${result.stderr ?? ""}` };
}
const author = (...argv: string[]) => sh("npm", ["run", "-s", "map:author", "--", "l2", ...argv]);
const json = <T>(argv: string[]): T => {
  const result = author(...argv, "--json");
  if (!result.ok) throw new Error(`l2 ${argv.join(" ")} failed: ${result.out.slice(-1000)}`);
  return JSON.parse(result.out) as T;
};
const readJson = <T>(path: string, fallback: T): T => (existsSync(join(ROOT, path)) ? (JSON.parse(readFileSync(join(ROOT, path), "utf8")) as T) : fallback);

/** The v1 run of a slice: its groups in order, its base and its recorded steps. */
type RunFile = { domainId: string; branch: string; baseSha: string; stage: string; l2: { slice: { groups: { group: string; concepts: string[] }[] }; steps: Record<string, unknown> } };
function runOf(slice: string): RunFile {
  const path = join(".map-authoring/l2", `${slice}.json`);
  if (!existsSync(join(ROOT, path))) fail(`no v1 run for ${slice}: start it with \`npm run map:author -- l2 start --slice ${slice}\` (that keeps every v1 start safeguard)`);
  return readJson<RunFile>(path, undefined as never);
}
const baseRegistry = (base: string) => new Set([...sh("git", ["show", `${base}:src/lib/map/authoring/content-registry.ts`]).out.matchAll(/^ {2}"([a-z0-9-]+)",$/gm)].map((m) => m[1]));
const budget = (): Budget => ({ ...DEFAULT_BUDGET, ...readJson<Partial<Budget>>(join(V2_ROOT, "budget.json"), {}) });
type Config = { model: string; timeoutMs: number; maxBudgetUsd?: string };
const config = (): Config => ({ model: "claude-opus-5-5", timeoutMs: 30 * 60 * 1000, ...readJson<Partial<Config>>(join(V2_ROOT, "config.json"), {}) });
const domainOrder = (() => {
  const roots = mapKnowledge.placements.filter((placement) => !placement.parentPlacementId).sort((a, b) => a.order - b.order);
  return (domain: string) => roots.findIndex((placement) => placement.conceptId === domain);
})();

/** The real environment: headless Claude Code sessions, git, and the v1 validators. */
const env: Env = {
  root: ROOT,
  now,
  token: () => randomUUID(),
  session: ({ prompt, resume, tools }) => {
    const c = config();
    return runClaude({ bin: process.env.L2V2_CLAUDE ?? "claude", cwd: ROOT, timeoutMs: c.timeoutMs, model: c.model, maxBudgetUsd: c.maxBudgetUsd }, prompt, tools, resume);
  },
  async check(group, withRecords) {
    const problems: string[] = [];
    if (withRecords) {
      const generated = sh("npm", ["run", "-s", "map:generate"]);
      if (!generated.ok) problems.push(`map:generate failed: ${generated.out.slice(-500)}`);
    }
    const [result] = json<{ problems: string[]; stale: string[] }[]>(["check", "--group", group]);
    problems.push(...(result?.problems ?? []), ...(result?.stale ?? []).map((entry) => `stale: ${entry}`));
    if (withRecords && !problems.length) {
      const tests = sh("node", ["--test", ...FOCUSED_TESTS]);
      if (!tests.ok) problems.push(`focused tests fail: ${tests.out.split("\n").filter((line) => /not ok|Error|expected|actual/.test(line)).slice(0, 8).join(" | ")}`);
    }
    return problems;
  },
  async ensureSkeleton(group) {
    if (existsSync(join(ROOT, "src/lib/map/authoring/l2/groups", `${group}.json`))) return [];
    const result = author("territory", group, "--write");
    return result.ok ? [] : [result.out.slice(-500)];
  },
  signals: async (conceptId) => json<{ id: string; detail: string }[]>(["signals", conceptId]).map(({ id, detail }) => ({ id, detail })),
  groupSignals: async (group) => json<{ id: string; detail: string }[]>(["group-signals", group]).map(({ id, detail }) => ({ id, detail })),
  context: async (conceptId) => author("context", conceptId, "--json").out.trim(),
  territory: async (group) => author("territory", group).out.trim(),
  async facts(conceptId) {
    const context = json<{ placements: unknown[]; owner: { domain: string } }>(["context", conceptId]);
    return { placements: context.placements.length, domainOrder: domainOrder(context.owner.domain) };
  },
  async changedPaths() {
    const entries = sh("git", ["status", "--porcelain=v1", "-z", "--untracked-files=all"]).out.split("\0").filter(Boolean);
    const paths: string[] = [];
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      paths.push(entry.slice(3));
      if (entry[0] === "R" || entry[0] === "C") paths.push(entries[++i]);
    }
    return paths;
  },
  async headContent(path) {
    return sh("git", ["cat-file", "-e", `HEAD:${path}`]).ok ? sh("git", ["show", `HEAD:${path}`]).out : undefined;
  },
};

function locked<T>(fn: () => Promise<T>): Promise<T> {
  let release: () => void;
  try {
    release = acquireLock(ROOT);
  } catch (error) {
    return fail((error as Error).message, 4);
  }
  // fail() exits the process, which skips finally: release on exit as well.
  process.once("exit", release);
  return fn().finally(() => release());
}

// ---------------------------------------------------------------- commands

async function commandRun() {
  const slice = flag("--slice") ?? fail("run needs --slice <id>");
  const run = runOf(slice);
  const branch = sh("git", ["rev-parse", "--abbrev-ref", "HEAD"]).out.trim();
  if (branch !== run.branch) fail(`the run is on ${run.branch}; this checkout is on ${branch}`);
  if (run.stage !== "author") fail(`the v1 run is at stage ${run.stage}; v2 authors only while it is at "author"`);
  const only = flag("--groups")?.split(",");
  const plan = planBatches(run.l2.slice.groups, run.l2.steps, baseRegistry(run.baseSha));
  const refused = plan.refused.filter((r) => !only || only.includes(r.group));
  for (const r of refused) console.log(`refused ${r.group}: ${r.reason}`);
  for (const { group, concepts } of plan.batches.filter((b) => !only || only.includes(b.group))) {
    if (loadBatch(ROOT, slice, group)?.status === "accepted") continue;
    const reason = stopReason(loadLedger(ROOT), budget());
    if (reason) fail(`stop rule: ${reason}`, 3);
    console.log(`batch ${group}: ${concepts.join(", ")}`);
    const state = await runBatch(env, { slice, group, concepts, protectedIds: plan.protectedIds });
    console.log(`  -> ${state.status}${state.stop ? `: ${state.stop.reason}` : ""}`);
    if (state.status !== "accepted") process.exit(3);
  }
  if (refused.length) fail("some groups were refused: they need a human decision", 3);
  console.log("every requested batch is accepted");
}

function commandStatus() {
  const root = join(ROOT, V2_ROOT);
  const slices = flag("--slice") ? [flag("--slice")!] : existsSync(root) ? readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory() && e.name !== "audits").map((e) => e.name) : [];
  for (const slice of slices)
    for (const group of existsSync(join(root, slice)) ? readdirSync(join(root, slice), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name) : []) {
      const state = loadBatch(ROOT, slice, group);
      if (!state) continue;
      const counts = Object.values(state.conceptStates).reduce<Record<string, number>>((acc, c) => ((acc[c.state] = (acc[c.state] ?? 0) + 1), acc), {});
      console.log(`${slice}/${group}: ${state.status} ${JSON.stringify(counts)}${state.stop ? ` STOP (at ${state.stop.status}) ${state.stop.reason}` : ""}`);
    }
  console.log(`stop rule: ${stopReason(loadLedger(ROOT), budget()) ?? "none broken"}`);
}

async function commandResume() {
  const slice = flag("--slice") ?? fail("resume needs --slice");
  const group = flag("--group") ?? fail("resume needs --group");
  const at = (flag("--at") ?? fail(`resume needs --at <${BATCH_STATUSES.join("|")}>`)) as BatchStatus;
  if (!BATCH_STATUSES.includes(at)) fail(`--at must be one of ${BATCH_STATUSES.join(", ")}`);
  const state = loadBatch(ROOT, slice, group) ?? fail(`no batch ${slice}/${group}`);
  try {
    saveBatch(ROOT, resumeBatch(state, at, now()));
  } catch (error) {
    fail((error as Error).message);
  }
  console.log(`${slice}/${group} resumed at ${at}; run it again to continue`);
}

/** Accepted concepts of the slice's accepted v2 batches, with their group. */
function v2Concepts(slice: string): Map<string, string> {
  const map = new Map<string, string>();
  const dir = join(ROOT, V2_ROOT, slice);
  if (!existsSync(dir)) return map;
  for (const group of readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)) {
    const state = loadBatch(ROOT, slice, group);
    if (state?.status === "accepted") for (const id of state.concepts) if (state.conceptStates[id].state === "accepted") map.set(id, group);
  }
  return map;
}

type DeepAudit = { run: string; substantive: Omit<Finding, "concept" | "severity">[]; verdict: string };
/** One independent deep audit of a concept (its record from the tree or from `ref`); returns its findings and session. */
async function deepAudit(concept: string, label: string, campaign: boolean, ref?: string): Promise<{ audit: DeepAudit; sessionId: string }> {
  const dir = join(V2_ROOT, "audits", label);
  mkdirSync(join(ROOT, dir), { recursive: true });
  const fileAt = (path: string) => (ref ? sh("git", ["show", `${ref}:${path}`]).out : readFileSync(join(ROOT, path), "utf8"));
  const groupFiles = ref ? sh("git", ["ls-tree", "--name-only", ref, "src/lib/map/authoring/l2/groups/"]).out.split("\n").filter(Boolean) : readdirSync(join(ROOT, "src/lib/map/authoring/l2/groups")).map((f) => `src/lib/map/authoring/l2/groups/${f}`);
  const data = fileAt(DATA);
  const span = recordSpans(data).get(concept) ?? fail(`no record for ${concept}${ref ? ` at ${ref}` : ""}`);
  const record = data.split("\n").slice(span.start, span.end + 1).join("\n");
  const file = groupFiles.map((path) => JSON.parse(fileAt(path)) as { members: { conceptId: string; standing: string }[]; splits?: unknown; concepts?: Record<string, unknown> }).find((g) => g.members.some((m) => m.conceptId === concept && m.standing === "owned"));
  // The whole plan (siblings' claims, reservations, splits) as of the same commit, so a baseline is judged with the pilot's context.
  const pack = [`# Deep audit: ${concept}${ref ? ` (as of ${ref})` : ""}`, "", "## Record (TypeScript literal as stored)", "```ts", record, "```", "", "## Group plan and this concept's accepted work", "```json", JSON.stringify({ members: file?.members, splits: file?.splits, work: file?.concepts?.[concept] }, null, 2), "```"].join("\n");
  writeFileSync(join(ROOT, dir, `${concept}.pack.md`), `${pack}\n`);
  const out = join(dir, `${concept}.json`);
  writeFileSync(join(ROOT, out), "");
  const run = randomUUID();
  const vars = { CONCEPT: concept, PACK: join(dir, `${concept}.pack.md`), OUT: out, RUN: run, RUBRIC: join(PROMPTS, "rubric.md"), RULES: join(PROMPTS, "rules.md") };
  let text = readFileSync(join(ROOT, PROMPTS, "deep-audit.md"), "utf8");
  for (const [key, value] of Object.entries(vars)) text = text.split(`{{${key}}}`).join(value);
  const tools = ["Read", `Write(${dir}/**)`, "Bash(npm run -s map:author -- l2 context:*)", "Bash(npm run -s map:inspect --:*)"];
  let result;
  try {
    result = await env.session({ role: "deep-audit", prompt: text, tools });
  } catch (error) {
    appendLedger(ROOT, { kind: "session-failed", at: now(), slice: `audit:${label}`, group: concept, role: "deep-audit", reason: (error as Error).message.slice(0, 300) });
    throw error;
  }
  appendLedger(ROOT, { kind: "session", at: now(), slice: `audit:${label}`, group: concept, role: "deep-audit", sessionId: result.sessionId, durationMs: result.durationMs, turns: result.turns, usage: result.usage, weighted: result.usage ? weighted(result.usage) : null });
  let audit: DeepAudit | undefined;
  try {
    audit = parseJson(readFileSync(join(ROOT, out), "utf8")) as DeepAudit;
  } catch {
    audit = undefined;
  }
  if (!audit || audit.run !== run || !Array.isArray(audit.substantive)) fail(`${concept}: the audit wrote no usable ${out} for this run`, 1);
  appendLedger(ROOT, { kind: "deep-audit", at: now(), label, concept, substantive: audit!.substantive.length, campaign });
  console.log(`${concept} [${label}]: ${audit!.substantive.length} substantive defect(s)`);
  return { audit: audit!, sessionId: result.sessionId };
}

/** Repairs a sampled or pilot concept's audit findings through the verified loop of its v2 batch. */
async function repairFromAudit(slice: string, concept: string, label: string, audit: DeepAudit, sessionId: string): Promise<boolean> {
  const group = v2Concepts(slice).get(concept) ?? fail(`${concept} is not an accepted concept of a v2 batch of ${slice}: recorded or protected content needs a controlled v1 revision (\`l2 reopen --domain ${slice}\`)`);
  const run = runOf(slice);
  const plan = planBatches(run.l2.slice.groups, run.l2.steps, baseRegistry(run.baseSha));
  const state = loadBatch(ROOT, slice, group)!;
  const after = await repairAfterAudit(env, { slice, group, concepts: state.concepts, protectedIds: plan.protectedIds, concept, findings: audit.substantive, auditSession: sessionId, label });
  console.log(`  repair: ${after.status === "accepted" ? "applied, verified, accepted again" : `batch ${after.status}${after.stop ? `: ${after.stop.reason}` : ""}`}`);
  return after.status === "accepted";
}

async function commandAudit() {
  const sliceToSample = flag("--sample-slice");
  if (sliceToSample) {
    const path = join(V2_ROOT, sliceToSample, "sample.json");
    const accepted = [...v2Concepts(sliceToSample).keys()].sort();
    const sampled = readJson<SliceSample>(path, { slice: sliceToSample, concepts: sample(accepted, budget().samplePerSlice, sliceToSample), audited: {} });
    writeFileSync(join(ROOT, path), `${JSON.stringify(sampled, null, 2)}\n`);
    for (const concept of sampled.concepts.filter((id) => !sampled.audited[id])) {
      const { audit, sessionId } = await deepAudit(concept, `sample-${sliceToSample}`, true);
      const repaired = audit.substantive.length ? await repairFromAudit(sliceToSample, concept, `sample-${sliceToSample}`, audit, sessionId) : false;
      sampled.audited[concept] = { substantive: audit.substantive.length, repaired };
      writeFileSync(join(ROOT, path), `${JSON.stringify(sampled, null, 2)}\n`);
      if (audit.substantive.length && !repaired) fail(`${concept}: substantive defects could not be repaired and verified; the slice cannot be finalized`, 3);
    }
    const reason = stopReason(loadLedger(ROOT), budget());
    if (reason) fail(`stop rule: ${reason}`, 3);
    console.log(`sample of ${sliceToSample}: ${sampled.concepts.join(", ")} audited`);
    return;
  }
  const label = flag("--label") ?? fail("audit needs --label, or --sample-slice");
  const concepts = (flag("--concepts") ?? fail("audit needs --concepts a,b")).split(",");
  const ref = flag("--ref");
  if (ref && args.includes("--fix")) fail("a baseline at a ref is measured, never fixed");
  const slice = flag("--slice");
  if (args.includes("--fix") && !slice) fail("--fix needs --slice: only accepted, unfinalized v2 concepts are repaired, through the verified loop");
  for (const concept of concepts) {
    const { audit, sessionId } = await deepAudit(concept, label, !ref, ref);
    if (audit.substantive.length && args.includes("--fix") && !(await repairFromAudit(slice!, concept, label, audit, sessionId))) fail(`${concept}: not repaired; the batch is stopped for a human`, 3);
    if (audit.substantive.length && !args.includes("--fix") && !ref) console.log(`  ${concept} has known defects: it must not ship until repaired (\`--slice <id> --fix\`)`);
  }
}

function commandMeter() {
  const percent = Number(flag("--percent") ?? fail("meter needs --percent <n>"));
  if (!Number.isFinite(percent)) fail("--percent must be a number");
  appendLedger(ROOT, { kind: "meter", at: now(), percent, note: flag("--note") });
  console.log(`recorded meter ${percent}%`);
}

function commandReport() {
  const ledger = loadLedger(ROOT);
  const rows = batchMetrics(ledger);
  console.log("batch | weighted (assumed weights) | minutes | failed sessions | unmeasured | accepted | parked | escalated | defects | weighted/accepted");
  for (const m of rows) console.log(`${m.slice}/${m.group} | ${m.weighted} | ${m.minutes.toFixed(1)} | ${m.failed} | ${m.unmeasured} | ${m.accepted} | ${m.parked} | ${m.escalated} | ${m.defects} | ${m.accepted ? Math.round(m.weighted / m.accepted) : "-"}`);
  const authored = rows.filter((m) => !m.slice.startsWith("audit:"));
  const total = authored.reduce((sum, m) => sum + m.weighted, 0);
  const accepted = authored.reduce((sum, m) => sum + m.accepted, 0);
  console.log(`authoring: ${total} weighted for ${accepted} accepted (${accepted ? Math.round(total / accepted) : "-"} each; plan ${budget().perConcept}; model ${config().model})`);
  const audits = ledger.filter((e) => e.kind === "deep-audit") as Extract<(typeof ledger)[number], { kind: "deep-audit" }>[];
  const byLabel = new Map<string, { n: number; defective: number; defects: number; campaign: boolean }>();
  for (const a of audits) {
    const s = byLabel.get(a.label) ?? { n: 0, defective: 0, defects: 0, campaign: a.campaign };
    s.n++;
    s.defects += a.substantive;
    if (a.substantive) s.defective++;
    byLabel.set(a.label, s);
  }
  for (const [label, s] of byLabel) console.log(`deep audit ${label}${s.campaign ? "" : " (baseline, not counted)"}: ${s.n} concepts, ${s.defective} with substantive defects, ${(s.defects / s.n).toFixed(2)} per concept`);
  const meters = ledger.filter((e) => e.kind === "meter");
  if (meters.length) console.log(`meter readings (measured): ${meters.map((m) => `${m.at.slice(0, 16)} ${(m as { percent: number }).percent}%`).join(", ")}`);
  console.log(`stop rule: ${stopReason(ledger, budget()) ?? "none broken"}`);
}

/** Records the v1 steps in v1's order, scoped to the slice's run, then runs the v1 gates through the diff. */
async function commandFinalize() {
  const slice = flag("--slice") ?? fail("finalize needs --slice");
  const run = runOf(slice);
  const plan = planBatches(run.l2.slice.groups, run.l2.steps, baseRegistry(run.baseSha));
  if (plan.refused.length) fail(`groups with partial v1 steps need a human decision: ${plan.refused.map((r) => r.group).join(", ")}`);
  const notReady = plan.batches.map(({ group }) => [group, loadBatch(ROOT, slice, group)] as const).filter(([, s]) => s?.status !== "accepted").map(([group, s]) => `${group} (${s?.status ?? "not started"})`);
  if (notReady.length) fail(`every v2 batch of ${slice} must be accepted first: ${notReady.join(", ")}`);
  const accepted = v2Concepts(slice);
  const sampleIssues = sampleProblems(readJson<SliceSample | undefined>(join(V2_ROOT, slice, "sample.json"), undefined), (id) => accepted.has(id));
  if (sampleIssues.length) fail(`the slice's measurement sample is not settled: ${sampleIssues.join("; ")}`);
  for (const { key, argv } of finalizeCommands(slice, plan.batches, (group) => batchDir(slice, group))) {
    if (key in runOf(slice).l2.steps) continue;
    const result = author(...argv);
    if (!result.ok) fail(`l2 ${argv.join(" ")} refused:\n${result.out.slice(-1500)}`, 1);
    console.log(`recorded ${key}`);
  }
  if (runOf(slice).stage === "audit") {
    const summary = batchMetrics(loadLedger(ROOT)).filter((m) => m.slice === slice);
    const note = `v2 pipeline: ${summary.reduce((s, m) => s + m.accepted, 0)} concepts in ${summary.length} batches; ${summary.reduce((s, m) => s + m.defects, 0)} defects tracked to verified or withdrawn; ${summary.reduce((s, m) => s + m.escalated, 0)} escalated to a second review`;
    const completed = author("complete", "audit", "--note", note, "--domain", slice);
    if (!completed.ok) fail(`l2 complete audit refused:\n${completed.out.slice(-1500)}`, 1);
  }
  const gates = spawnSync("npm", ["run", "map:author", "--", "l2", "run", "--until", "diff", "--domain", slice], { cwd: ROOT, stdio: "inherit" });
  if (gates.status !== 0) process.exit(gates.status ?? 1);
  console.log(`${slice}: validated through the diff. Delivery (commit, push, PR, CI, merge) stays \`npm run map:author -- l2 run --domain ${slice}\`.`);
}

switch (args[0]) {
  case "run":
    await locked(commandRun);
    break;
  case "status":
    commandStatus();
    break;
  case "resume":
    await locked(commandResume);
    break;
  case "audit":
    await locked(commandAudit);
    break;
  case "meter":
    commandMeter();
    break;
  case "report":
    commandReport();
    break;
  case "finalize":
    await locked(commandFinalize);
    break;
  default:
    fail("usage: map:l2v2 -- run|status|resume|audit|meter|report|finalize (see the header of scripts/map-l2v2.ts)");
}
