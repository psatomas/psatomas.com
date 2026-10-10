// MAP L2 authoring pipeline v2: the deterministic driver (docs/map-authoring/l2-pipeline-v2.md).
//
//   npm run map:l2v2 -- run --slice <id> [--groups a,b]     author batches (one ownership group each) up to acceptance
//   npm run map:l2v2 -- status [--slice <id>]               batch states and the first broken stop rule
//   npm run map:l2v2 -- resume --slice <id> --group <g> --at <status>   a human resumes a stopped batch
//   npm run map:l2v2 -- audit --label <l> --concepts a,b [--ref <git-ref>] [--fix]   independent deep audits
//   npm run map:l2v2 -- meter --percent <n> [--note ..]     record a reading of the Claude usage meter
//   npm run map:l2v2 -- report                              tokens, time, defects and acceptance per batch
//   npm run map:l2v2 -- finalize --slice <id>               record the v1 steps in order, then `l2 run --until diff`
//
// It never pushes, opens PRs, merges or deploys: delivery stays `map:author -- l2 run`.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { mapKnowledge } from "../src/lib/map/data.ts";
import { recordSpans } from "../src/lib/map/authoring/l2/campaign.ts";
import {
  applyPatches, batchMetrics, DEFAULT_BUDGET, parseJson, resumeBatch, stopReason, weighted, BATCH_STATUSES,
  type BatchStatus, type Budget, type Finding, type Usage,
} from "../src/lib/map/authoring/l2v2/core.ts";
import { appendLedger, batchDir, DATA, loadBatch, loadLedger, PROMPTS, runBatch, V2_ROOT, type Env, type SessionResult } from "../src/lib/map/authoring/l2v2/driver.ts";

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
  if (!result.ok) fail(`l2 ${argv.join(" ")} failed:\n${result.out.slice(-2000)}`, 1);
  return JSON.parse(result.out) as T;
};

/** The v1 run of a slice: its groups in order, its base and its recorded steps. */
type RunFile = { domainId: string; branch: string; baseSha: string; stage: string; l2: { slice: { groups: { group: string; concepts: string[] }[] }; steps: Record<string, unknown> } };
function runOf(slice: string): RunFile {
  const path = join(ROOT, ".map-authoring/l2", `${slice}.json`);
  if (!existsSync(path)) fail(`no v1 run for ${slice}: start it with \`npm run map:author -- l2 start --slice ${slice}\` (that keeps every v1 start safeguard)`);
  return JSON.parse(readFileSync(path, "utf8")) as RunFile;
}
/** Concepts registered at the run's base: accepted content v2 never edits. */
function protectedAt(base: string): Set<string> {
  const registry = sh("git", ["show", `${base}:src/lib/map/authoring/content-registry.ts`]).out;
  return new Set([...registry.matchAll(/^ {2}"([a-z0-9-]+)",$/gm)].map((match) => match[1]));
}
function budget(): Budget {
  const path = join(ROOT, V2_ROOT, "budget.json");
  return { ...DEFAULT_BUDGET, ...(existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as Partial<Budget>) : {}) };
}
const domainOrder = (() => {
  const roots = mapKnowledge.placements.filter((placement) => !placement.parentPlacementId).sort((a, b) => a.order - b.order);
  return (domain: string) => roots.findIndex((placement) => placement.conceptId === domain);
})();

/** The real environment: headless Claude Code sessions and the v1 validators. */
const env: Env = {
  root: ROOT,
  now,
  session: ({ prompt, resume, tools }) =>
    new Promise<SessionResult>((resolve, reject) => {
      const argv = ["-p", "--output-format", "json", "--permission-mode", "acceptEdits", "--allowedTools", tools.join(","), ...(resume ? ["--resume", resume] : []), ...(process.env.L2V2_MODEL ? ["--model", process.env.L2V2_MODEL] : [])];
      const child = spawn(process.env.L2V2_CLAUDE ?? "claude", argv, { cwd: ROOT, stdio: ["pipe", "pipe", "inherit"] });
      let out = "";
      child.stdout.on("data", (chunk) => (out += chunk));
      child.on("error", reject);
      child.on("close", () => {
        try {
          const r = JSON.parse(out) as { session_id: string; usage?: Partial<Usage>; duration_ms?: number; num_turns?: number; is_error?: boolean; result?: string };
          const u = r.usage ?? {};
          resolve({
            sessionId: r.session_id,
            usage: { input_tokens: u.input_tokens ?? 0, output_tokens: u.output_tokens ?? 0, cache_creation_input_tokens: u.cache_creation_input_tokens ?? 0, cache_read_input_tokens: u.cache_read_input_tokens ?? 0 },
            durationMs: r.duration_ms ?? 0,
            turns: r.num_turns ?? 0,
            isError: Boolean(r.is_error),
            text: r.result ?? "",
          });
        } catch {
          reject(new Error(`claude returned no JSON result (a usage limit, perhaps): ${out.slice(0, 300)}`));
        }
      });
      child.stdin.end(prompt);
    }),
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
  async signals(conceptId) {
    return json<{ id: string; detail: string }[]>(["signals", conceptId]).map(({ id, detail }) => ({ id, detail }));
  },
  async groupSignals(group) {
    return json<{ id: string; detail: string }[]>(["group-signals", group]).map(({ id, detail }) => ({ id, detail }));
  },
  async context(conceptId) {
    return author("context", conceptId, "--json").out.trim();
  },
  async territory(group) {
    return author("territory", group).out.trim();
  },
  async facts(conceptId) {
    const context = json<{ placements: unknown[]; owner: { domain: string } }>(["context", conceptId]);
    return { placements: context.placements.length, domainOrder: domainOrder(context.owner.domain) };
  },
};

// ---------------------------------------------------------------- commands

async function commandRun() {
  const slice = flag("--slice") ?? fail("run needs --slice <id>");
  const run = runOf(slice);
  const branch = sh("git", ["rev-parse", "--abbrev-ref", "HEAD"]).out.trim();
  if (branch !== run.branch) fail(`the run is on ${run.branch}; this checkout is on ${branch}`);
  if (run.stage !== "author") fail(`the v1 run is at stage ${run.stage}; v2 authors only while it is at "author"`);
  const only = flag("--groups")?.split(",");
  const protectedIds = protectedAt(run.baseSha);
  for (const { group, concepts } of run.l2.slice.groups.filter((entry) => !only || only.includes(entry.group))) {
    const existing = loadBatch(ROOT, slice, group);
    if (existing?.status === "accepted") continue;
    const reason = stopReason(loadLedger(ROOT), budget());
    if (reason) fail(`stop rule: ${reason}`, 3);
    console.log(`batch ${group}: ${concepts.join(", ")}`);
    const state = await runBatch(env, { slice, group, concepts, protectedIds });
    console.log(`  -> ${state.status}${state.stop ? `: ${state.stop.reason}` : ""}`);
    if (state.status !== "accepted") process.exit(3);
  }
  console.log("every requested batch is accepted");
}

function commandStatus() {
  const slices = flag("--slice") ? [flag("--slice")!] : existsSync(join(ROOT, V2_ROOT)) ? readdirSync(join(ROOT, V2_ROOT)).filter((entry) => !entry.includes(".")) : [];
  for (const slice of slices)
    for (const group of readdirSync(join(ROOT, V2_ROOT, slice))) {
      const state = loadBatch(ROOT, slice, group);
      if (!state) continue;
      const counts = Object.values(state.conceptStates).reduce<Record<string, number>>((acc, c) => ((acc[c.state] = (acc[c.state] ?? 0) + 1), acc), {});
      console.log(`${slice}/${group}: ${state.status} ${JSON.stringify(counts)}${state.stop ? ` STOP ${state.stop.reason}` : ""}`);
    }
  console.log(`stop rule: ${stopReason(loadLedger(ROOT), budget()) ?? "none broken"}`);
}

function commandResume() {
  const slice = flag("--slice") ?? fail("resume needs --slice");
  const group = flag("--group") ?? fail("resume needs --group");
  const at = (flag("--at") ?? fail(`resume needs --at <${BATCH_STATUSES.join("|")}>`)) as BatchStatus;
  if (!BATCH_STATUSES.includes(at) || at === "stopped") fail(`--at must be one of ${BATCH_STATUSES.filter((s) => s !== "stopped").join(", ")}`);
  const state = loadBatch(ROOT, slice, group) ?? fail(`no batch ${slice}/${group}`);
  writeFileSync(join(ROOT, batchDir(slice, group), "state.json"), `${JSON.stringify(resumeBatch(state, at, now()), null, 2)}\n`);
  console.log(`${slice}/${group} resumed at ${at}`);
}

/** Independent deep audits: the measurement sample, the pilot, and the baseline (`--ref` reads records from a commit). */
async function commandAudit() {
  const label = flag("--label") ?? fail("audit needs --label");
  const concepts = (flag("--concepts") ?? fail("audit needs --concepts a,b")).split(",");
  const ref = flag("--ref");
  const dir = join(V2_ROOT, "audits", label);
  mkdirSync(join(ROOT, dir), { recursive: true });
  const fileAt = (path: string) => (ref ? sh("git", ["show", `${ref}:${path}`]).out : readFileSync(join(ROOT, path), "utf8"));
  const groups = ref ? sh("git", ["ls-tree", "--name-only", ref, "src/lib/map/authoring/l2/groups/"]).out.split("\n").filter(Boolean) : readdirSync(join(ROOT, "src/lib/map/authoring/l2/groups")).map((f) => `src/lib/map/authoring/l2/groups/${f}`);
  for (const concept of concepts) {
    const data = fileAt(DATA);
    const span = recordSpans(data).get(concept) ?? fail(`no record for ${concept}${ref ? ` at ${ref}` : ""}`);
    const record = data.split("\n").slice(span.start, span.end + 1).join("\n");
    const file = groups.map((path) => JSON.parse(fileAt(path)) as { group: string; members: { conceptId: string; standing: string }[]; concepts?: Record<string, unknown> }).find((g) => g.members.some((m) => m.conceptId === concept && m.standing === "owned"));
    const member = file?.members.find((m) => m.conceptId === concept);
    const pack = [`# Deep audit: ${concept}${ref ? ` (record as of ${ref})` : ""}`, "", "## Record (TypeScript literal as stored)", "```ts", record, "```", "", "## Plan entry and accepted work", "```json", JSON.stringify({ member, work: file?.concepts?.[concept] }, null, 2), "```"].join("\n");
    writeFileSync(join(ROOT, dir, `${concept}.pack.md`), `${pack}\n`);
    const out = join(dir, `${concept}.json`);
    const vars = { CONCEPT: concept, PACK: join(dir, `${concept}.pack.md`), OUT: out, RUBRIC: join(PROMPTS, "rubric.md"), RULES: join(PROMPTS, "rules.md") };
    let text = readFileSync(join(ROOT, PROMPTS, "deep-audit.md"), "utf8");
    for (const [key, value] of Object.entries(vars)) text = text.split(`{{${key}}}`).join(value);
    const result = await env.session({ role: "deep-audit", prompt: text, tools: ["Read", "Write", "Bash(npm run map:author:*)", "Bash(npm run -s map:author:*)", "Bash(npm run map:inspect:*)", "Bash(grep:*)"] });
    appendLedger(ROOT, { kind: "session", at: now(), slice: `audit:${label}`, group: concept, role: "deep-audit", sessionId: result.sessionId, durationMs: result.durationMs, turns: result.turns, usage: result.usage, weighted: weighted(result.usage) });
    const audit = (existsSync(join(ROOT, out)) ? parseJson(readFileSync(join(ROOT, out), "utf8")) : undefined) as { substantive?: Finding[] } | undefined;
    if (!audit || !Array.isArray(audit.substantive)) fail(`${concept}: the audit wrote no usable ${out}`, 1);
    appendLedger(ROOT, { kind: "deep-audit", at: now(), label, concept, substantive: audit!.substantive!.length });
    console.log(`${concept}: ${audit!.substantive!.length} substantive defect(s)`);
    if (audit!.substantive!.length && args.includes("--fix") && !ref) {
      const patched = applyPatches(readFileSync(join(ROOT, DATA), "utf8"), audit!.substantive!.map((f) => ({ ...f, concept, severity: "defect" as const })), new Set());
      writeFileSync(join(ROOT, DATA), patched.source);
      console.log(`  repairs: ${patched.results.map((r) => (r.applied ? "applied" : `refused (${r.problem})`)).join(", ")}; verify with a fresh audit of ${concept} before it ships`);
    }
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
  console.log("batch | weighted | minutes | accepted | parked | escalated | defects | weighted/accepted");
  for (const m of rows) console.log(`${m.slice}/${m.group} | ${m.weighted} | ${m.minutes.toFixed(1)} | ${m.accepted} | ${m.parked} | ${m.escalated} | ${m.defects} | ${m.accepted ? Math.round(m.weighted / m.accepted) : "-"}`);
  const authored = rows.filter((m) => !m.slice.startsWith("audit:"));
  const total = authored.reduce((sum, m) => sum + m.weighted, 0);
  const accepted = authored.reduce((sum, m) => sum + m.accepted, 0);
  console.log(`authoring: ${total} weighted for ${accepted} accepted (${accepted ? Math.round(total / accepted) : "-"} each; plan ${budget().perConcept})`);
  const audits = ledger.filter((e) => e.kind === "deep-audit") as Extract<(typeof ledger)[number], { kind: "deep-audit" }>[];
  const byLabel = new Map<string, { n: number; defective: number; defects: number }>();
  for (const a of audits) {
    const s = byLabel.get(a.label) ?? { n: 0, defective: 0, defects: 0 };
    s.n++;
    s.defects += a.substantive;
    if (a.substantive) s.defective++;
    byLabel.set(a.label, s);
  }
  for (const [label, s] of byLabel) console.log(`deep audit ${label}: ${s.n} concepts, ${s.defective} with substantive defects, ${(s.defects / s.n).toFixed(2)} defects per concept`);
  const meters = ledger.filter((e) => e.kind === "meter");
  if (meters.length) console.log(`meter readings: ${meters.map((m) => `${m.at.slice(0, 16)} ${(m as { percent: number }).percent}%`).join(", ")}`);
  console.log(`stop rule: ${stopReason(ledger, budget()) ?? "none broken"}`);
}

/** Records the v1 steps in v1's order from accepted batches, then runs the v1 gates through the diff. */
function commandFinalize() {
  const slice = flag("--slice") ?? fail("finalize needs --slice");
  const run = runOf(slice);
  const groups = run.l2.slice.groups;
  const states = groups.map(({ group }) => [group, loadBatch(ROOT, slice, group)] as const);
  const notReady = states.filter(([, state]) => state?.status !== "accepted").map(([group, state]) => `${group} (${state?.status ?? "not started"})`);
  if (notReady.length) fail(`every batch of ${slice} must be accepted first: ${notReady.join(", ")}`);
  const done = (key: string) => key in runOf(slice).l2.steps;
  const step = (key: string, argv: string[]) => {
    if (done(key)) return;
    const result = author("record", ...argv);
    if (!result.ok) fail(`l2 record ${argv.join(" ")} refused:\n${result.out.slice(-1500)}`, 1);
    console.log(`recorded ${key}`);
  };
  for (const { group } of groups) step(`plan:${group}`, ["plan", group]);
  for (const { concepts } of groups) for (const id of concepts) step(`design:${id}`, ["design", id]);
  for (const { group, concepts } of groups)
    for (const id of concepts) {
      step(`author:${id}`, ["author", id]);
      step(`audit:${id}`, ["audit", id, "--audit-file", join(batchDir(slice, group), `audit-${id}.json`)]);
    }
  for (const { group } of groups) step(`group-audit:${group}`, ["group-audit", group, "--audit-file", join(batchDir(slice, group), "group-audit.json")]);
  const summary = batchMetrics(loadLedger(ROOT)).filter((m) => m.slice === slice);
  if (runOf(slice).stage === "audit") {
    const note = `v2 pipeline: ${summary.reduce((s, m) => s + m.accepted, 0)} concepts in ${summary.length} batches; ${summary.reduce((s, m) => s + m.defects, 0)} defects repaired and verified; ${summary.reduce((s, m) => s + m.escalated, 0)} escalated to a second review`;
    const completed = author("complete", "audit", "--note", note);
    if (!completed.ok) fail(`l2 complete audit refused:\n${completed.out.slice(-1500)}`, 1);
  }
  const gates = spawnSync("npm", ["run", "map:author", "--", "l2", "run", "--until", "diff"], { cwd: ROOT, stdio: "inherit" });
  if (gates.status !== 0) process.exit(gates.status ?? 1);
  console.log(`${slice}: validated through the diff. Delivery (commit, push, PR, CI, merge) stays \`npm run map:author -- l2 run\`.`);
}

switch (args[0]) {
  case "run":
    await commandRun();
    break;
  case "status":
    commandStatus();
    break;
  case "resume":
    commandResume();
    break;
  case "audit":
    await commandAudit();
    break;
  case "meter":
    commandMeter();
    break;
  case "report":
    commandReport();
    break;
  case "finalize":
    commandFinalize();
    break;
  default:
    fail("usage: map:l2v2 -- run|status|resume|audit|meter|report|finalize (see the header of scripts/map-l2v2.ts)");
}
