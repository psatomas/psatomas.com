// MAP L2 authoring pipeline v2: the deterministic driver (docs/map-authoring/l2-pipeline-v2.md).
//
//   npm run map:l2v2 -- run --slice <id> [--groups a,b]       author batches (one ownership group each) up to acceptance
//   npm run map:l2v2 -- status [--slice <id>]                 batch states and the first broken stop rule
//   npm run map:l2v2 -- resume --slice <id> --group <g> --at <status>   a human resumes a stopped batch (never forward)
//   npm run map:l2v2 -- audit --sample-slice <id>             draw and deep-audit the slice's measurement sample; repairs are verified
//   npm run map:l2v2 -- audit --label <l> --concepts a,b [--slice <id> --fix]   deep audits (pilot); --fix repairs through the verified loop
//   npm run map:l2v2 -- audit --label baseline --ref <git-ref> --concepts a,b   baseline audits of records at a commit (never counted, never fixed)
//   npm run map:l2v2 -- meter --percent <weekly> [--session <5-hour>] [--read-at <iso>] [--bracket before|after --batch <id> [--exclusive]] [--note ..]
//                                                             record an account-wide usage reading (availability; never attributed to the campaign)
//   npm run map:l2v2 -- policy --version <1|2> --note <why> [--acknowledge <every current stop, quoted>]   record the accounting policy
//   npm run map:l2v2 -- clear-failures --note <why>           acknowledge reviewed failed sessions: the failure stop rule counts only later ones
//   npm run map:l2v2 -- report                                tokens (authoring and audits apart), time, defects and acceptance per batch
//   npm run map:l2v2 -- finalize --slice <id>                 record the v1 steps (scoped to the slice), then `l2 run --until diff`
//
// Every session runs in the bubblewrap sandbox (src/lib/map/authoring/l2v2/sandbox.ts); if it cannot be set up, no session starts.
// Sessions get no credential: the driver's relay adds a dedicated `claude setup-token` token, kept in
// ~/.config/map-l2v2/oauth-token (mode 0600; L2V2_TOKEN_FILE overrides), to their API calls outside the sandbox.
// Configuration: .map-authoring/l2v2/config.json {model, timeoutMs, maxBudgetUsd, egress, relay} and budget.json (stop-rule thresholds and
// per-batch limits: maxSessionsPerBatch, maxBatchMinutes). maxBudgetUsd does not bound a subscription's quota: the limits, the recorded
// weighted tokens and, under accounting policy 2, a fresh availability reading before every session do (docs: "Accounting policy").
// It never pushes, opens PRs, merges or deploys: delivery stays `map:author -- l2 run --domain <slice>`.
// data.ts is imported only after the v2 records in it are checked, as text, against their validated drafts.
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { recordSpans } from "../src/lib/map/authoring/l2/campaign.ts";
import {
  accountingPolicy, activeFailures, allowedTools, batchCosts, batchMetrics, BATCH_STATUSES, budgetHash, campaignCost, DEFAULT_BUDGET, deniedTools, finalizeCommands, knownDefectProblems, meterEvidence, parseJson, planBatches,
  policyActivation,
  policyChangeProblems, policyEntry, readingProblems, resumeBatch, sample, sampleProblems, sessionGate, stopReason,
  type BatchState, type BatchStatus, type Budget, type Finding, type SliceSample,
} from "../src/lib/map/authoring/l2v2/core.ts";
import { runSandboxed, sandboxProblems, sandboxToken, type SandboxConfig } from "../src/lib/map/authoring/l2v2/sandbox.ts";
import {
  acquireLock, appendLedger, batchDir, DATA, GuardError, guardedSession, loadBatch, loadLedger, PROMPTS, recoverRepair, REGISTRY, repairAfterAudit, runBatch, SANDBOX_CONFIG, saveBatch, V2_ROOT, type Env, type Limits,
} from "../src/lib/map/authoring/l2v2/driver.ts";
import { recordFingerprint, recordPlacement, recordsInPlaceProblems } from "../src/lib/map/authoring/l2v2/records.ts";
import { gitChangedPaths, gitHeadEntry, gitSurfaces, run } from "../src/lib/map/authoring/l2v2/shell.ts";

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

/** stdout is data; stderr only ever appears in messages. */
const sh = (command: string, argv: readonly string[]) => run(command, argv, ROOT);
const output = (result: { stdout: string; stderr: string }) => `${result.stderr}\n${result.stdout}`.trim();
const author = (...argv: string[]) => sh("npm", ["run", "-s", "map:author", "--", "l2", ...argv]);
const json = <T>(argv: string[]): T => {
  const result = author(...argv, "--json");
  if (!result.ok) throw new Error(`l2 ${argv.join(" ")} failed: ${output(result).slice(-1000)}`);
  return JSON.parse(result.stdout) as T;
};
const readJson = <T>(path: string, fallback: T): T => (existsSync(join(ROOT, path)) ? (JSON.parse(readFileSync(join(ROOT, path), "utf8")) as T) : fallback);

/** The v1 run of a slice: its groups in order, its base and its recorded steps. */
type RunFile = { domainId: string; branch: string; baseSha: string; stage: string; l2: { slice: { groups: { group: string; concepts: string[] }[] }; steps: Record<string, unknown> } };
function runOf(slice: string): RunFile {
  const path = join(".map-authoring/l2", `${slice}.json`);
  if (!existsSync(join(ROOT, path))) fail(`no v1 run for ${slice}: start it with \`npm run map:author -- l2 start --slice ${slice}\` (that keeps every v1 start safeguard)`);
  return readJson<RunFile>(path, undefined as never);
}
const baseRegistry = (base: string) => new Set([...sh("git", ["show", `${base}:src/lib/map/authoring/content-registry.ts`]).stdout.matchAll(/^ {2}"([a-z0-9-]+)",$/gm)].map((m) => m[1]));
const budget = (): Budget => ({ ...DEFAULT_BUDGET, ...readJson<Partial<Budget>>(join(V2_ROOT, "budget.json"), {}) });
/**
 * egress: the `host:port` pairs a session's sandbox may tunnel to; relay: the API the sandbox reaches through the
 * driver's relay, which adds the token (the sandbox never holds it), and the path prefixes it forwards.
 */
type Config = { model: string; timeoutMs: number; maxBudgetUsd?: string; egress: string[]; relay: { upstream: string; paths: string[] } };
const config = (): Config => ({
  model: "claude-opus-5-5", timeoutMs: 30 * 60 * 1000, egress: ["api.anthropic.com:443"], relay: { upstream: "https://api.anthropic.com", paths: ["/v1/"] },
  ...readJson<Partial<Config>>(join(V2_ROOT, "config.json"), {}),
});
/** A command by path or on PATH; undefined when there is none. */
const which = (name: string) => (name.includes("/") ? name : (process.env.PATH ?? "").split(":").map((dir) => join(dir, name)).find((path) => existsSync(path)));
/** The sandbox every session runs in; L2V2_BWRAP, L2V2_CLAUDE and L2V2_TOKEN_FILE override its defaults. */
const sandbox = (): SandboxConfig => ({
  root: ROOT,
  bwrap: which(process.env.L2V2_BWRAP ?? "bwrap") ?? "bwrap",
  claude: which(process.env.L2V2_CLAUDE ?? "claude") ?? "claude",
  tokenFile: process.env.L2V2_TOKEN_FILE ?? join(homedir(), ".config/map-l2v2/oauth-token"),
  egress: config().egress,
  relay: config().relay,
  configRoot: join(ROOT, SANDBOX_CONFIG),
  launcher: join(import.meta.dirname, "l2v2/sandbox-launch.mjs"),
});
/** Before any session: the sandbox must be ready, or nothing starts. */
function requireSandbox() {
  const problems = sandboxProblems(sandbox());
  if (problems.length) fail(`the session sandbox cannot be set up, so no session was started:\n- ${problems.join("\n- ")}`, 1);
}
const limits = (): Limits => ({ sessions: budget().maxSessionsPerBatch, minutes: budget().maxBatchMinutes, sessionTimeoutMs: config().timeoutMs });
/** Before every session of a batch or an audit repair: the accounting policy's gate on the ledger as it stands then. */
const gate = () => sessionGate(loadLedger(ROOT), budget(), now());
/** A domain's position among the roots; data.ts is imported lazily, once its v2 records have been checked. */
async function domainOrder(domain: string) {
  const { mapKnowledge } = await import("../src/lib/map/data.ts");
  const roots = mapKnowledge.placements.filter((placement) => !placement.parentPlacementId).sort((a, b) => a.order - b.order);
  return roots.findIndex((placement) => placement.conceptId === domain);
}
/** Values of the local secret files, matched (never logged) against what would be committed. */
function localSecrets(): string[] {
  const files = readdirSync(ROOT).filter((name) => name.startsWith(".env") || name.startsWith(".dev.vars"));
  return files.flatMap((name) =>
    readFileSync(join(ROOT, name), "utf8").split("\n").map((line) => {
      const value = line.match(/^\s*(?:export\s+)?[A-Za-z_][A-Za-z0-9_]*\s*=\s*(.*?)\s*$/)?.[1] ?? "";
      const quoted = value.match(/^(["'])(.*)\1$/);
      return quoted ? quoted[2] : value.replace(/\s+#.*$/, "");
    }).filter((value) => value.length >= 8),
  );
}
/**
 * Dependencies' executables and manifests, watched by metadata only (never
 * the whole tree): node_modules/.bin, which npm puts first on every script's
 * PATH, the installed lockfile, and every top-level package's manifest.
 */
function dependencyMetadata(): string[] {
  const modules = join(ROOT, "node_modules");
  if (!existsSync(modules)) return [];
  const list = (dir: string) => {
    try {
      return readdirSync(dir);
    } catch {
      return [];
    }
  };
  const packages = list(modules).filter((name) => !name.startsWith(".")).flatMap((name) => (name.startsWith("@") ? list(join(modules, name)).map((scoped) => join(modules, name, scoped)) : [join(modules, name)]));
  return [join(modules, ".bin"), join(modules, ".package-lock.json"), ...packages.map((dir) => join(dir, "package.json"))];
}

/** The real environment: headless Claude Code sessions, git, and the v1 validators. */
const env: Env = {
  root: ROOT,
  now,
  clock: () => performance.now(),
  token: () => randomUUID(),
  session: (request) => {
    const c = config();
    return runSandboxed(sandbox(), { ...request, timeoutMs: c.timeoutMs, model: c.model, maxBudgetUsd: c.maxBudgetUsd });
  },
  async check(group, withRecords) {
    const problems: string[] = [];
    if (withRecords) {
      const generated = sh("npm", ["run", "-s", "map:generate"]);
      if (!generated.ok) problems.push(`map:generate failed: ${output(generated).slice(-500)}`);
    }
    const [result] = json<{ problems: string[]; stale: string[] }[]>(["check", "--group", group]);
    problems.push(...(result?.problems ?? []), ...(result?.stale ?? []).map((entry) => `stale: ${entry}`));
    if (withRecords && !problems.length) {
      const tests = sh("node", ["--test", ...FOCUSED_TESTS]);
      if (!tests.ok) problems.push(`focused tests fail: ${output(tests).split("\n").filter((line) => /not ok|Error|expected|actual/.test(line)).slice(0, 8).join(" | ")}`);
    }
    return problems;
  },
  async ensureSkeleton(group) {
    if (existsSync(join(ROOT, "src/lib/map/authoring/l2/groups", `${group}.json`))) return [];
    const result = author("territory", group, "--write");
    return result.ok ? [] : [output(result).slice(-500)];
  },
  signals: async (conceptId) => json<{ id: string; detail: string }[]>(["signals", conceptId]).map(({ id, detail }) => ({ id, detail })),
  groupSignals: async (group) => json<{ id: string; detail: string }[]>(["group-signals", group]).map(({ id, detail }) => ({ id, detail })),
  context: async (conceptId) => author("context", conceptId, "--json").stdout.trim(),
  territory: async (group) => author("territory", group).stdout.trim(),
  inspect: async (conceptId) => {
    const result = sh("npm", ["run", "-s", "map:inspect", "--", conceptId]);
    if (!result.ok) throw new Error(`map:inspect ${conceptId}: ${output(result).slice(-300)}`);
    return result.stdout.trim();
  },
  async facts(conceptId) {
    const context = json<{ placements: unknown[]; owner: { domain: string } }>(["context", conceptId]);
    return { placements: context.placements.length, domainOrder: await domainOrder(context.owner.domain) };
  },
  changedPaths: async () => gitChangedPaths(ROOT),
  headContent: async (path) => gitHeadEntry(ROOT, path),
  surfaces: async () => ({
    content: [...gitSurfaces(ROOT), join(ROOT, ".claude"), join(ROOT, ".mcp.json"), join(ROOT, ".npmrc"), join(homedir(), ".gitconfig"), join(homedir(), ".npmrc"), join(homedir(), ".claude", "settings.json")],
    metadata: dependencyMetadata(),
  }),
  // The sandbox's token is a secret too: nothing that would be committed may hold it.
  secrets: async () => [...localSecrets(), ...(sandboxProblems(sandbox()).length ? [] : [sandboxToken(sandbox())])],
};

/** Every v2 batch of every slice. */
const allBatches = (): BatchState[] =>
  existsSync(join(ROOT, V2_ROOT)) ? readdirSync(join(ROOT, V2_ROOT), { withFileTypes: true }).filter((e) => e.isDirectory() && e.name !== "audits").flatMap((e) => sliceBatches(e.name)) : [];
/** Every v2 batch of a slice. */
function sliceBatches(slice: string): BatchState[] {
  const dir = join(ROOT, V2_ROOT, slice);
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => loadBatch(ROOT, slice, e.name)).filter((s): s is BatchState => !!s);
}
/**
 * Why the v2 records of a slice in data.ts are not exactly the driver's
 * rendering of their validated drafts (as text, before anything imports
 * data.ts); accepted ones must also match their fingerprint at acceptance.
 */
function treeProblems(slice: string): string[] {
  const data = readFileSync(join(ROOT, DATA), "utf8");
  const registry = readFileSync(join(ROOT, REGISTRY), "utf8");
  const problems: string[] = [];
  for (const state of sliceBatches(slice)) {
    if (!state.records || ["pending", "planned", "plan-reviewed"].includes(state.status) || (state.status === "stopped" && ["pending", "planned", "plan-reviewed"].includes(state.stop!.status))) continue;
    // A record a park took out of the tree is rendered again by the driver on a resume: missing is expected, unless the concept is accepted.
    const live = state.concepts.filter((id) => state.records![id] && state.conceptStates[id].state !== "parked" && !(state.conceptStates[id].state !== "accepted" && recordPlacement(data, state.records![id]) === "missing"));
    problems.push(...recordsInPlaceProblems(data, registry, live.map((id) => state.records![id])).map((p) => `${state.group}: ${p}`));
    // An invalid record is reported above and never rendered or fingerprinted.
    for (const id of live.filter((concept) => recordPlacement(data, state.records![concept]) !== "invalid")) {
      const accepted = state.conceptStates[id].accepted;
      if (state.conceptStates[id].state === "accepted" && (!accepted || accepted.fingerprint !== recordFingerprint(state.records[id]))) problems.push(`${state.group}: ${id} is not the record that was accepted`);
    }
  }
  return problems;
}
function requireTree(slice: string) {
  const problems = treeProblems(slice);
  if (problems.length) fail(`the v2 records of ${slice} changed outside the driver (nothing was imported or run):\n- ${problems.join("\n- ")}`, 1);
}

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

/**
 * Before run, audit and finalize: an audit repair a stopped process left under way is rolled back (or, if its
 * re-acceptance had completed, closed), reported, and the command stops so a human sees it before anything runs.
 */
function recoverRepairs() {
  const recovered = allBatches().flatMap((state) => recoverRepair(env, state.slice, state.group) ?? []);
  if (recovered.length) fail(`${recovered.join("\n")}\nnothing else was run; run the command again`, 3);
}

async function commandRun() {
  const slice = flag("--slice") ?? fail("run needs --slice <id>");
  recoverRepairs();
  requireTree(slice);
  requireSandbox();
  const run = runOf(slice);
  const branch = sh("git", ["rev-parse", "--abbrev-ref", "HEAD"]).stdout.trim();
  if (branch !== run.branch) fail(`the run is on ${run.branch}; this checkout is on ${branch}`);
  if (run.stage !== "author") fail(`the v1 run is at stage ${run.stage}; v2 authors only while it is at "author"`);
  const only = flag("--groups")?.split(",");
  const plan = planBatches(run.l2.slice.groups, run.l2.steps, baseRegistry(run.baseSha));
  const refused = plan.refused.filter((r) => !only || only.includes(r.group));
  for (const r of refused) console.log(`refused ${r.group}: ${r.reason}`);
  for (const { group, concepts } of plan.batches.filter((b) => !only || only.includes(b.group))) {
    if (loadBatch(ROOT, slice, group)?.status === "accepted") continue;
    const reason = stopReason(loadLedger(ROOT), budget(), now());
    if (reason) fail(`stop rule: ${reason}`, 3);
    console.log(`batch ${group}: ${concepts.join(", ")}`);
    const state = await runBatch(env, { slice, group, concepts, protectedIds: plan.protectedIds, limits: limits(), gate });
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
  const policy = accountingPolicy(loadLedger(ROOT));
  console.log(`accounting policy ${policy.version}${policy.entry ? "" : " (legacy: no policy recorded)"}`);
  console.log(`stop rule: ${stopReason(loadLedger(ROOT), budget(), now()) ?? "none broken"}`);
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
  // The human's decision on the batch's parked concepts: they stop counting toward the parking stop rule.
  appendLedger(ROOT, { kind: "resume", at: now(), slice, group, status: at });
  console.log(`${slice}/${group} resumed at ${at}; run it again to continue`);
}

/** Accepted concepts of the slice's accepted v2 batches, with their group. */
function v2Concepts(slice: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const state of sliceBatches(slice)) if (state.status === "accepted") for (const id of state.concepts) if (state.conceptStates[id].state === "accepted") map.set(id, state.group);
  return map;
}

type DeepAudit = { run: string; substantive: Omit<Finding, "concept" | "severity">[]; verdict: string };
/** Marks a deep-audit session in flight: one the CLI never saw finish is found by the next audit command. */
const AUDIT_IN_FLIGHT = join(V2_ROOT, "audits", "in-flight.json");
/**
 * Before any audit command: an audit session the CLI never saw finish (the
 * process stopped) is recorded as interrupted, and the command stops so a
 * human checks the tree first; the next one may run.
 */
function auditInterrupted() {
  const marker = readJson<{ label: string; concept: string; startedAt: string } | undefined>(AUDIT_IN_FLIGHT, undefined);
  if (!marker) return;
  appendLedger(ROOT, { kind: "session-failed", at: now(), slice: `audit:${marker.label}`, group: marker.concept, role: "deep-audit", reason: `interrupted: the CLI stopped during the session started at ${marker.startedAt}` });
  rmSync(join(ROOT, AUDIT_IN_FLIGHT), { force: true });
  fail(`the deep audit of ${marker.concept} (${marker.label}) was interrupted and its changes were never checked: inspect \`git status\` and .map-authoring, then run the audit again`, 3);
}
/** Each audit session starts only while no stop rule is broken (failed and interrupted sessions count). */
function auditGate() {
  const reason = stopReason(loadLedger(ROOT), budget(), now());
  if (reason) fail(`stop rule: ${reason}`, 3);
}

/** One independent deep audit of a concept (its record from the tree or from `ref`); returns its findings and session. */
async function deepAudit(concept: string, label: string, campaign: boolean, ref?: string): Promise<{ audit: DeepAudit; sessionId: string }> {
  auditGate();
  const dir = join(V2_ROOT, "audits", label);
  mkdirSync(join(ROOT, dir), { recursive: true });
  const fileAt = (path: string) => (ref ? sh("git", ["show", `${ref}:${path}`]).stdout : readFileSync(join(ROOT, path), "utf8"));
  const groupFiles = ref ? sh("git", ["ls-tree", "--name-only", ref, "src/lib/map/authoring/l2/groups/"]).stdout.split("\n").filter(Boolean) : readdirSync(join(ROOT, "src/lib/map/authoring/l2/groups")).map((f) => `src/lib/map/authoring/l2/groups/${f}`);
  const data = fileAt(DATA);
  const span = recordSpans(data).get(concept) ?? fail(`no record for ${concept}${ref ? ` at ${ref}` : ""}`);
  const record = data.split("\n").slice(span.start, span.end + 1).join("\n");
  const file = groupFiles.map((path) => JSON.parse(fileAt(path)) as { members: { conceptId: string; standing: string }[]; splits?: unknown; concepts?: Record<string, { model?: unknown; design?: unknown }> }).find((g) => g.members.some((m) => m.conceptId === concept && m.standing === "owned"));
  // The whole plan (siblings' claims, reservations, splits) as of the same commit, so a baseline is judged with the pilot's context.
  // The concept's model and design only: never an earlier audit's verdict.
  const work = file?.concepts?.[concept];
  const pack = [`# Deep audit: ${concept}${ref ? ` (as of ${ref})` : ""}`, "", "## Record (TypeScript literal as stored)", "```ts", record, "```", "", "## Group plan and this concept's accepted work", "```json", JSON.stringify({ members: file?.members, splits: file?.splits, work: work && { model: work.model, design: work.design } }, null, 2), "```"].join("\n");
  const packPath = join(dir, `${concept}.pack.md`);
  writeFileSync(join(ROOT, packPath), `${pack}\n`);
  const out = join(dir, `${concept}.audit.json`);
  rmSync(join(ROOT, out), { force: true });
  const run = randomUUID();
  const vars = { CONCEPT: concept, PACK: packPath, OUT: out, RUN: run, RUBRIC: join(PROMPTS, "rubric.md"), RULES: join(PROMPTS, "rules.md") };
  let text = readFileSync(join(ROOT, PROMPTS, "deep-audit.md"), "utf8");
  for (const [key, value] of Object.entries(vars)) text = text.split(`{{${key}}}`).join(value);
  // Under the same guard as every batch session: only its output file may change; the session's usage is recorded either way.
  let result;
  writeFileSync(join(ROOT, AUDIT_IN_FLIGHT), `${JSON.stringify({ label, concept, startedAt: now() })}\n`);
  try {
    result = await guardedSession(env, { role: "deep-audit", prompt: text, tools: allowedTools("deep-audit", "", { pack: packPath, out }), denied: deniedTools("deep-audit"), files: { pack: packPath, out }, tree: [DATA, REGISTRY], allowed: new Set(), out, slice: `audit:${label}`, group: concept });
  } catch (error) {
    // The session ended (failed or undone) and is in the ledger: it was not interrupted. fail() exits, so no finally would run.
    rmSync(join(ROOT, AUDIT_IN_FLIGHT), { force: true });
    return fail(`${concept}: the deep audit ${error instanceof GuardError ? "changed what it may not and was rolled back" : "failed"}: ${(error as Error).message}`, 1);
  }
  rmSync(join(ROOT, AUDIT_IN_FLIGHT), { force: true });
  let audit: DeepAudit | undefined;
  try {
    audit = parseJson(readFileSync(join(ROOT, out), "utf8")) as DeepAudit;
  } catch {
    audit = undefined;
  }
  if (!audit || audit.run !== run || !Array.isArray(audit.substantive)) fail(`${concept}: the audit wrote no usable ${out} for this run`, 1);
  // The audited record's fingerprint, when it is a v2 record in place: a known defect stays bound to that text.
  const v2 = ref ? undefined : allBatches().find((state) => state.records?.[concept]);
  const fingerprint = v2 && recordPlacement(data, v2.records![concept]) === "in-place" ? recordFingerprint(v2.records![concept]) : undefined;
  appendLedger(ROOT, { kind: "deep-audit", at: now(), label, concept, substantive: audit!.substantive.length, campaign, ...(fingerprint ? { fingerprint } : {}) });
  console.log(`${concept} [${label}]: ${audit!.substantive.length} substantive defect(s)`);
  return { audit: audit!, sessionId: result.sessionId };
}

/** Repairs a sampled or pilot concept's audit findings through the verified loop of its v2 batch. */
async function repairFromAudit(slice: string, concept: string, label: string, audit: DeepAudit, sessionId: string): Promise<boolean> {
  const group = v2Concepts(slice).get(concept) ?? fail(`${concept} is not an accepted concept of a v2 batch of ${slice}: recorded or protected content needs a controlled v1 revision (\`l2 reopen --domain ${slice}\`)`);
  const run = runOf(slice);
  const plan = planBatches(run.l2.slice.groups, run.l2.steps, baseRegistry(run.baseSha));
  const state = loadBatch(ROOT, slice, group)!;
  const before = state.conceptStates[concept].accepted?.at;
  const after = await repairAfterAudit(env, { slice, group, concepts: state.concepts, protectedIds: plan.protectedIds, limits: limits(), gate, concept, findings: audit.substantive, auditSession: sessionId, label });
  // Repaired only if accepted again through the gates; otherwise the accepted record was restored, its findings still open.
  const repaired = after.status === "accepted" && after.conceptStates[concept].accepted?.at !== before;
  console.log(`  repair: ${repaired ? "applied, verified, accepted again" : `not repaired, the accepted record is restored and the findings stay open: ${after.history?.at(-1)?.stop?.reason ?? after.stop?.reason ?? after.status}`}`);
  return repaired;
}

async function commandAudit() {
  auditInterrupted();
  recoverRepairs();
  const sliceToSample = flag("--sample-slice");
  for (const slice of [sliceToSample, flag("--slice")]) if (slice) requireTree(slice);
  // Arguments are validated first (exit 2); the sandbox is checked just before the first session.
  const max = budget().maxAuditConcepts;
  if (sliceToSample) {
    const path = join(V2_ROOT, sliceToSample, "sample.json");
    const accepted = [...v2Concepts(sliceToSample).keys()].sort();
    const sampled = readJson<SliceSample>(path, { slice: sliceToSample, concepts: sample(accepted, budget().samplePerSlice, sliceToSample), audited: {} });
    if (sampled.concepts.filter((id) => !sampled.audited[id]).length > max) fail(`the sample has more than ${max} concepts to audit (budget.json maxAuditConcepts)`);
    requireSandbox();
    writeFileSync(join(ROOT, path), `${JSON.stringify(sampled, null, 2)}\n`);
    for (const concept of sampled.concepts.filter((id) => !sampled.audited[id])) {
      const { audit, sessionId } = await deepAudit(concept, `sample-${sliceToSample}`, true);
      const repaired = audit.substantive.length ? await repairFromAudit(sliceToSample, concept, `sample-${sliceToSample}`, audit, sessionId) : false;
      sampled.audited[concept] = { substantive: audit.substantive.length, repaired };
      writeFileSync(join(ROOT, path), `${JSON.stringify(sampled, null, 2)}\n`);
      if (audit.substantive.length && !repaired) fail(`${concept}: substantive defects could not be repaired and verified; the slice cannot be finalized`, 3);
    }
    const reason = stopReason(loadLedger(ROOT), budget(), now());
    if (reason) fail(`stop rule: ${reason}`, 3);
    console.log(`sample of ${sliceToSample}: ${sampled.concepts.join(", ")} audited`);
    return;
  }
  const label = flag("--label") ?? fail("audit needs --label, or --sample-slice");
  const concepts = (flag("--concepts") ?? fail("audit needs --concepts a,b")).split(",");
  if (concepts.length > max) fail(`one audit command audits at most ${max} concepts (budget.json maxAuditConcepts); ${concepts.length} given`);
  const ref = flag("--ref");
  if (ref && args.includes("--fix")) fail("a baseline at a ref is measured, never fixed");
  const slice = flag("--slice");
  if (args.includes("--fix") && !slice) fail("--fix needs --slice: only accepted, unfinalized v2 concepts are repaired, through the verified loop");
  requireSandbox();
  for (const concept of concepts) {
    const { audit, sessionId } = await deepAudit(concept, label, !ref, ref);
    if (audit.substantive.length && args.includes("--fix") && !(await repairFromAudit(slice!, concept, label, audit, sessionId))) fail(`${concept}: not repaired; its accepted record is restored and the audit's findings stay open for a human`, 3);
    if (audit.substantive.length && !args.includes("--fix") && !ref) console.log(`  ${concept} has known defects: finalize refuses its slice until they are repaired (\`--slice <id> --fix\`)`);
  }
}

/** A number given on the command line, or NaN: "", "12abc" and the like are never read as numbers. */
const numberFlag = (name: string) => {
  const raw = flag(name);
  return raw === undefined ? undefined : /^\d+(\.\d+)?$/.test(raw) ? Number(raw) : Number.NaN;
};
/**
 * An account-wide reading of the usage meter, as a human read it: weekly (--percent) and 5-hour (--session) usage,
 * and when (--read-at, default now). It is availability, never a campaign cost; the ledger keeps every reading.
 */
function commandMeter() {
  const percent = numberFlag("--percent") ?? fail("meter needs --percent <weekly usage>");
  const session = numberFlag("--session");
  const readAt = flag("--read-at");
  const phase = flag("--bracket");
  const batch = flag("--batch");
  if ((phase === undefined) !== (batch === undefined)) fail("--bracket before|after and --batch <slice/group or audit:label> go together");
  const at = now();
  const entry = {
    kind: "meter" as const, at, percent, ...(session === undefined ? {} : { session }), ...(readAt ? { readAt } : {}), note: flag("--note"),
    ...(phase ? { bracket: { phase: phase as "before" | "after", batch: batch! } } : {}), ...(args.includes("--exclusive") ? { exclusive: true } : {}),
  };
  const ledger = loadLedger(ROOT);
  const problems = readingProblems(entry, at, accountingPolicy(ledger).version === 2);
  if (problems.length) fail(`the reading was not recorded:\n- ${problems.join("\n- ")}`);
  // Stamped when it is appended (a reading's own time is readAt), so a batch appending meanwhile keeps the ledger in order.
  appendLedger(ROOT, { ...entry, at: now() });
  console.log(`recorded account-wide reading: weekly ${percent}%${session === undefined ? "" : `, 5-hour ${session}%`}${phase ? ` (${phase} ${batch})` : ""}: availability, not attributed to the campaign`);
  console.log(`stop rule: ${stopReason(loadLedger(ROOT), budget(), now()) ?? "none broken"}`);
}

/**
 * Records the accounting policy, pinning the effective budget. Every stop condition the current policy reports must be
 * quoted exactly in --acknowledge; recording a policy clears none of them. It holds the driver lock: no batch or
 * audit runs while the policy changes. Re-recording the same version is how a reviewed budget change is pinned.
 */
function commandPolicy() {
  const version = numberFlag("--version") ?? fail("policy needs --version <1|2>");
  const note = flag("--note");
  const acknowledged = flag("--acknowledge");
  const release = (() => {
    try {
      return acquireLock(ROOT);
    } catch (error) {
      return fail((error as Error).message, 4);
    }
  })();
  // fail() exits the process, which skips finally: release on exit as well.
  process.once("exit", release);
  try {
    const inFlight = allBatches().filter((state) => state.window?.inFlight).map((state) => `${state.slice}/${state.group} (${state.window!.inFlight!.role})`);
    if (existsSync(join(ROOT, AUDIT_IN_FLIGHT))) inFlight.push("a deep audit");
    if (inFlight.length) fail(`a session was interrupted and awaits recovery: ${inFlight.join(", ")}; recover it first`, 3);
    const ledger = loadLedger(ROOT);
    const at = now();
    const problems = policyChangeProblems(ledger, budget(), at, version, note, acknowledged);
    if (problems.length) fail(`the policy was not recorded:\n- ${problems.join("\n- ")}`, 3);
    const entry = policyEntry(ledger, budget(), at, version, note!, acknowledged);
    appendLedger(ROOT, entry);
    console.log(`recorded accounting policy ${version} (budget ${entry.budgetHash.slice(0, 12)}); before it: policy ${entry.previous.version}, ${entry.previous.reasons.length ? `stops acknowledged: ${entry.previous.reasons.join("; ")}` : "no stop condition"}`);
    console.log(`stop rule now: ${stopReason(loadLedger(ROOT), budget(), now()) ?? "none broken"}`);
  } finally {
    release();
  }
}

/**
 * A human acknowledges the failed or interrupted sessions in the active
 * failure window, after checking the CLI, the quota and the tree. It appends
 * an entry; every failure stays in the ledger. It clears only that rule: never
 * a parked concept, a known defect, a changed record or another stop rule,
 * and never while a session is in flight or awaits recovery.
 */
function commandClearFailures() {
  const note = flag("--note")?.trim();
  if (!note || note.startsWith("--")) fail('clear-failures needs --note "<what was checked and why the failures are resolved>"');
  const inFlight = allBatches().filter((state) => state.window?.inFlight).map((state) => `${state.slice}/${state.group} (${state.window!.inFlight!.role})`);
  if (existsSync(join(ROOT, AUDIT_IN_FLIGHT))) inFlight.push("a deep audit");
  if (inFlight.length) fail(`a session was interrupted and awaits recovery: ${inFlight.join(", ")}; run that batch or audit command first, so it is recorded and the tree inspected`, 3);
  const { sessions, failed } = activeFailures(loadLedger(ROOT), budget());
  if (!failed) fail(`no failed or interrupted session in the active window (${sessions} sessions): nothing to acknowledge`);
  appendLedger(ROOT, { kind: "ack", at: now(), note: note!, failures: failed });
  console.log(`acknowledged ${failed} failed or interrupted session(s) of the last ${sessions}; they stay in the ledger`);
  const reason = stopReason(loadLedger(ROOT), budget(), now());
  console.log(`stop rule: ${reason ?? "none broken"}`);
}

function commandReport() {
  const ledger = loadLedger(ROOT);
  const rows = batchMetrics(ledger);
  console.log("batch | weighted (assumed weights) | minutes | failed sessions | unmeasured | accepted | parked | escalated | defects | weighted/accepted");
  for (const m of rows) console.log(`${m.slice}/${m.group} | ${m.weighted} | ${m.minutes.toFixed(1)} | ${m.failed} | ${m.unmeasured} | ${m.accepted} | ${m.parked} | ${m.escalated} | ${m.defects} | ${m.accepted ? Math.round(m.weighted / m.accepted) : "-"}`);
  const authored = rows.filter((m) => !m.slice.startsWith("audit:"));
  const total = authored.reduce((sum, m) => sum + m.weighted, 0);
  const accepted = authored.reduce((sum, m) => sum + m.accepted, 0);
  const policy = accountingPolicy(ledger);
  console.log(`accounting policy ${policy.version}${policy.entry ? ` (recorded ${policy.entry.at}; budget ${policy.entry.budgetHash.slice(0, 12)}, now ${budgetHash(budget()).slice(0, 12)})` : " (legacy: no policy recorded)"}`);
  console.log(`authoring: ${total} weighted for ${accepted} accepted (${accepted ? Math.round(total / accepted) : "-"} each; plan ${budget().perConcept}; model ${config().model})`);
  const cost = campaignCost(ledger);
  if (policyActivation(ledger) >= 0) {
    console.log(`since policy 2's activation (${ledger[policyActivation(ledger)].at}), what the single-batch ceiling judges; the totals above stay as recorded:`);
    for (const b of batchCosts(ledger))
      console.log(`  ${b.slice}/${b.group}: ${b.sincePolicy} of ${b.total} weighted (${b.startedUnderPolicy ? "started under policy 2" : "started before it"}${b.completedUnderPolicy ? ", accepted since" : ""}${b.unmeasuredSincePolicy ? `, ${b.unmeasuredSincePolicy} unmeasured` : ""}${b.failedSincePolicy ? `, ${b.failedSincePolicy} failed` : ""})`);
  }
  console.log(`audits: ${cost.audits} weighted, apart from authoring`);
  for (const [label, row] of Object.entries(cost.byLabel)) console.log(`  ${label}: ${row.sessions} sessions${row.unmeasured ? ` (${row.unmeasured} unmeasured)` : ""}, ${row.weighted} weighted, ${row.concepts} concepts (${row.concepts ? Math.round(row.weighted / row.concepts) : "-"} each)`);
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
  const meters = ledger.filter((e): e is Extract<(typeof ledger)[number], { kind: "meter" }> => e.kind === "meter");
  if (meters.length) console.log(`account-wide readings (availability${policy.version === 2 ? "; not attributed to the campaign" : "; policy 1 attributes their rise"}): ${meters.map((m) => `${new Date(m.readAt ?? m.at).toISOString().slice(0, 16)}Z weekly ${m.percent}%${m.session === undefined ? "" : ` 5-hour ${m.session}%`}`).join(", ")}`);
  const evidence = meterEvidence(ledger);
  for (const e of evidence) console.log(`bracket ${e.batch}${e.exclusive ? " (exclusive, by a human's account)" : ""}: weekly +${e.percent}% around ${e.weighted} weighted (${e.weightedPerPercent ?? "-"} per percent; supplementary, an upper bound${e.outlier ? "; far from the median of the other brackets" : ""})`);
  console.log(`stop rule: ${stopReason(ledger, budget(), now()) ?? "none broken"}`);
}

/** Records the v1 steps in v1's order, scoped to the slice's run, then runs the v1 gates through the diff. */
async function commandFinalize() {
  const slice = flag("--slice") ?? fail("finalize needs --slice");
  recoverRepairs();
  const run = runOf(slice);
  const plan = planBatches(run.l2.slice.groups, run.l2.steps, baseRegistry(run.baseSha));
  if (plan.refused.length) fail(`groups with partial v1 steps need a human decision: ${plan.refused.map((r) => r.group).join(", ")}`);
  const notReady = plan.batches.map(({ group }) => [group, loadBatch(ROOT, slice, group)] as const).filter(([, s]) => s?.status !== "accepted").map(([group, s]) => `${group} (${s?.status ?? "not started"})`);
  if (notReady.length) fail(`every v2 batch of ${slice} must be accepted first: ${notReady.join(", ")}`);
  const accepted = v2Concepts(slice);
  const sampleIssues = sampleProblems(readJson<SliceSample | undefined>(join(V2_ROOT, slice, "sample.json"), undefined), (id) => accepted.has(id));
  if (sampleIssues.length) fail(`the slice's measurement sample is not settled: ${sampleIssues.join("; ")}`);
  // No known defect ships: any deep audit (sample, pilot or other) since a concept's last acceptance must have found none.
  const acceptedRecords = new Map(sliceBatches(slice).flatMap((state) => state.concepts.filter((id) => accepted.has(id)).map((id) => [id, { at: state.conceptStates[id].accepted?.at ?? "", fingerprint: state.conceptStates[id].accepted?.fingerprint }] as const)));
  const known = knownDefectProblems(loadLedger(ROOT), acceptedRecords);
  if (known.length) fail(`known defects must be repaired first (\`audit --label <l> --concepts <ids> --slice ${slice} --fix\`):\n- ${known.join("\n- ")}`, 3);
  // Exactly the accepted records, as accepted: an edit after acceptance is never recorded unreviewed.
  requireTree(slice);
  for (const { key, argv } of finalizeCommands(slice, plan.batches, (group) => batchDir(slice, group))) {
    if (key in runOf(slice).l2.steps) continue;
    const result = author(...argv);
    if (!result.ok) fail(`l2 ${argv.join(" ")} refused:\n${output(result).slice(-1500)}`, 1);
    console.log(`recorded ${key}`);
  }
  if (runOf(slice).stage === "audit") {
    const summary = batchMetrics(loadLedger(ROOT)).filter((m) => m.slice === slice);
    const note = `v2 pipeline: ${summary.reduce((s, m) => s + m.accepted, 0)} concepts in ${summary.length} batches; ${summary.reduce((s, m) => s + m.defects, 0)} defects tracked to verified or withdrawn; ${summary.reduce((s, m) => s + m.escalated, 0)} escalated to a second review`;
    const completed = author("complete", "audit", "--note", note, "--domain", slice);
    if (!completed.ok) fail(`l2 complete audit refused:\n${output(completed).slice(-1500)}`, 1);
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
  case "policy":
    commandPolicy();
    break;
  case "report":
    commandReport();
    break;
  case "clear-failures":
    await locked(async () => commandClearFailures());
    break;
  case "finalize":
    await locked(commandFinalize);
    break;
  default:
    fail("usage: map:l2v2 -- run|status|resume|audit|meter|policy|report|finalize|clear-failures (see the header of scripts/map-l2v2.ts)");
}
