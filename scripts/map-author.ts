// Drives one MAP L1 domain from a clean, current main to a validated PR
// awaiting human merge. See docs/map-authoring/domain-runbook.md.
//
//   npm run map:author -- domains                       every domain's L1 status; the next incomplete one
//   npm run map:author -- plan --domain <id> [--json]   a domain's plan, read-only
//   npm run map:author -- start --domain <id> [--dry-run]
//   npm run map:author -- status | next                 the active run
//   npm run map:author -- context <concept-id>          focused authoring context for one concept
//   npm run map:author -- record <concept-id>           regenerate, focused tests, confirm registration
//   npm run map:author -- audit [--json]                mechanical audit facts for the new content
//   npm run map:author -- complete audit --note "..."
//   npm run map:author -- fix --kind test|fix --message "..." --files a,b --reason "..."
//   npm run map:author -- stop --subject .. --evidence .. --why .. --decision ..
//   npm run map:author -- resume --decision "..."       after a human decision resolved the stop
//   npm run map:author -- run [--dry-run] [--trailer ".."] [--footer ".."] [--ci-wait <minutes>]
//   npm run map:author -- represent catalog|context|record|audit ...  read-only representation audit
//                                                       (scripts/map-author-represent.ts)
//
// Every command except domains/plan acts on the active run (the one unfinished
// state file under .map-authoring/, or --domain). The tool never merges,
// deploys, force-pushes, amends or starts a domain without an explicit --domain.
//
// Representation refactor runs (docs/map-authoring/representation-design.md#refactor-mode)
// share every stage, check and safeguard, with their own state under
// .map-authoring/refactor/ and their own branch and PR naming:
//
//   npm run map:author -- refactor domains                    every domain's refactor status; the next with work
//   npm run map:author -- refactor plan --domain <id> [--json]
//   npm run map:author -- refactor start --domain <id> [--dry-run]
//   npm run map:author -- refactor context <concept-id>       the concept, its accepted design and the boundary
//   npm run map:author -- refactor record <concept-id> --decision execute|reduce|keep --note "..."
//   npm run map:author -- refactor status | next | audit | complete audit --note ".." | fix .. | stop .. | resume .. | run ..
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { mapKnowledge } from "../src/lib/map/data.ts";
import { commandRepresent } from "./map-author-represent.ts";
import { AUTHORED_CONTENT_CONCEPTS } from "../src/lib/map/authoring/content-registry.ts";
import { createMapAuthoringInspector, MapAuthoringContextError } from "../src/lib/map/authoring/context.ts";
import { formatMapConceptAuthoringContext } from "../src/lib/map/authoring/format.ts";
import type { MapKnowledgeModel } from "../src/lib/map/types.ts";
import { auditConcepts } from "../src/lib/map/authoring/orchestrator/audit.ts";
import { validateContentDiff, validateFixes } from "../src/lib/map/authoring/orchestrator/diff-check.ts";
import { planFixVerification } from "../src/lib/map/authoring/orchestrator/fix-verification.ts";
import { listDomains, nextIncompleteDomain, planDomain, renderExpectations, renderSample } from "../src/lib/map/authoring/orchestrator/plan.ts";
import { completionReport, contentCommitMessage, fixCommitMessage, prBody, prTitle, refactorCommitMessage, refactorCompletionReport, refactorPrBody, refactorPrTitle } from "../src/lib/map/authoring/orchestrator/report.ts";
import { ACCEPTED_DESIGNS_FILE, decisionProblems, designSetFingerprint, MAP_RUN_BRANCH, planRefactor, refactorBranch, refactorCampaign, resolveSpec, specProblems, targetKinds, type AcceptedDesignSpec, type Decision, DECISIONS } from "../src/lib/map/authoring/representation/refactor.ts";
import { validateRefactorDiff } from "../src/lib/map/authoring/representation/refactor-diff.ts";
import {
  addFix,
  AGENT_STAGES,
  completeStage,
  changedConcepts,
  commitGroups,
  compositionProblems,
  createRefactorRunState,
  createRunState,
  gitProblems,
  invalidate,
  recordDecision,
  startProblems,
  nextAction,
  pendingConcepts,
  recordCheck,
  recordConcept,
  resumeRun,
  RunStateError,
  STAGES,
  stopRun,
  classifyCi,
  prMismatch,
  type FixGroup,
  type RemoteCheck,
  type RemotePr,
  type RunState,
  type Stage,
} from "../src/lib/map/authoring/orchestrator/run-state.ts";

const ROOT = new URL("..", import.meta.url).pathname;
const STATE_ROOT = join(ROOT, ".map-authoring");
/** Temporary verification trees: inside the repository's filesystem so node_modules can be hard-linked, and git-ignored. */
const VERIFY_DIR = join(STATE_ROOT, "verify");
const MAIN = "main";
const VIEW_FILE = "src/components/map/explorer-view.generated.json";
const FOCUSED_TESTS = ["src/lib/map/map.test.ts", "src/lib/map/authoring/context.test.ts", "src/components/map/explorer-model.test.ts"];
const now = () => new Date().toISOString();
// Browser checks always start their own production server on a free port: a
// MAP_BASE_URL (a running dev server, say) must never stand in for the build.
delete process.env.MAP_BASE_URL;

// ---------------------------------------------------------------- arguments

const [first, ...rest] = process.argv.slice(2);
const flags = new Map<string, string | true>();
const positional: string[] = [];
for (let index = 0; index < rest.length; index++) {
  const arg = rest[index];
  if (!arg.startsWith("--")) positional.push(arg);
  else if (["--json", "--dry-run"].includes(arg)) flags.set(arg, true);
  else {
    const value = rest[++index];
    if (value === undefined || value.startsWith("--")) fail(`${arg} needs a value`);
    flags.set(arg, value);
  }
}
const flag = (name: string) => (typeof flags.get(name) === "string" ? (flags.get(name) as string) : undefined);
const dryRun = flags.has("--dry-run");
/** `refactor <command>` runs the same commands over representation refactor state. */
const refactor = first === "refactor";
const command = refactor ? (positional.shift() ?? "domains") : first;
const STATE_DIR = refactor ? join(STATE_ROOT, "refactor") : STATE_ROOT;
const CLI = refactor ? "map:author -- refactor" : "map:author --";

function fail(message: string, code = 2): never {
  console.error(`map:author: ${message}`);
  process.exit(code);
}

// ---------------------------------------------------------------- processes

type Result = { ok: boolean; status: number | null; out: string };

function sh(cmd: string, args: string[], options: { input?: string; cwd?: string } = {}): Result {
  const result = spawnSync(cmd, args, { cwd: options.cwd ?? ROOT, encoding: "utf8", input: options.input, maxBuffer: 1 << 28, env: { ...process.env, FORCE_COLOR: "0" } });
  const out = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  return { ok: result.status === 0, status: result.status, out };
}
const git = (...args: string[]) => sh("git", args);
const gitOut = (...args: string[]) => {
  const result = git(...args);
  if (!result.ok) throw new ToolFailure(`git ${args.join(" ")}`, result.out);
  return result.out.trim();
};
const lines = (value: string) => value.split("\n").map((line) => line.trim()).filter(Boolean);
const tail = (value: string, count = 25) => lines(value).slice(-count).join("\n");

class ToolFailure extends Error {
  readonly what: string;
  readonly evidence: string;
  constructor(what: string, evidence: string) {
    super(`${what} failed`);
    this.what = what;
    this.evidence = evidence;
  }
}

// ---------------------------------------------------------------- state

const statePath = (domainId: string) => join(STATE_DIR, `${domainId}.json`);
function readState(domainId: string): RunState | undefined {
  if (!existsSync(statePath(domainId))) return undefined;
  const state = JSON.parse(readFileSync(statePath(domainId), "utf8")) as RunState;
  if (state.version !== 1 || state.domainId !== domainId) fail(`${statePath(domainId)} is not a version-1 run for ${domainId}; inspect it before continuing`, 1);
  // A run of one kind is never resumed as the other.
  if ((state.kind === "refactor") !== refactor) fail(`${statePath(domainId)} is a ${state.kind ?? "domain authoring"} run, not a ${refactor ? "refactor" : "domain authoring"} run`, 1);
  return state;
}
function saveState(state: RunState) {
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(statePath(state.domainId), `${JSON.stringify(state, null, 2)}\n`);
}

function activeState(): RunState {
  const domainId = flag("--domain");
  if (domainId) return readState(domainId) ?? fail(`no run for ${domainId}; start one with \`${CLI} start --domain ${domainId}\``);
  const runs = existsSync(STATE_DIR)
    ? readdirSync(STATE_DIR).filter((file) => file.endsWith(".json")).map((file) => readState(file.slice(0, -5))!).filter((state) => state.stage !== "done")
    : [];
  if (runs.length === 0) fail(`no active run; see \`${CLI} domains\`, then \`${CLI} start --domain <id>\``);
  if (runs.length > 1) fail(`several active runs (${runs.map((state) => state.domainId).join(", ")}); pass --domain`);
  return runs[0];
}

/** Records a stop and prints the stop report: stage, subject, evidence, why, and the smallest decision needed. */
function stop(state: RunState, stopInput: { subject: string; evidence: string; why: string; decision: string }): never {
  const stopped = stopRun(state, stopInput, now());
  saveState(stopped);
  printStop(stopped);
  process.exit(1);
}

function printStop(state: RunState) {
  const record = state.stop!;
  console.log(
    [
      `STOP  ${state.title} (${state.domainId}), stage ${record.stage}`,
      `subject:  ${record.subject}`,
      `evidence: ${record.evidence.split("\n").join("\n          ")}`,
      `why:      ${record.why}`,
      `decision: ${record.decision}`,
    ].join("\n"),
  );
}

// ---------------------------------------------------------------- git state

const currentBranch = () => gitOut("rev-parse", "--abbrev-ref", "HEAD");
const head = () => gitOut("rev-parse", "HEAD");
const trackedChanges = () => lines(gitOut("status", "--porcelain", "--untracked-files=no"));
const remoteSha = (ref: string) => lines(gitOut("ls-remote", "origin", ref))[0]?.split(/\s+/)[0];

/** Recorded run versus the actual repository; any mismatch is a stop before anything else happens. */
function verifyGit(state: RunState) {
  const problems = gitProblems(state, {
    branch: currentBranch(),
    head: head(),
    baseIsAncestor: git("merge-base", "--is-ancestor", state.baseSha, "HEAD").ok,
    trackedChanges: trackedChanges(),
    remoteHead: state.pushedSha ? remoteSha(`refs/heads/${state.branch}`) : undefined,
  });
  if (problems.length) {
    stop(state, {
      subject: "git state",
      evidence: problems.join("\n"),
      why: "the repository no longer matches the recorded run, so continuing could duplicate or lose work",
      decision: "restore the recorded branch state, or discard this run's state file and start again",
    });
  }
}

// ---------------------------------------------------------------- models at a revision

/** Loads data.ts and the registry as they were at a revision. Both are self-contained modules. */
async function modelAt(sha: string): Promise<{ model: MapKnowledgeModel; registry: readonly string[] }> {
  const dir = mkdtempSync(join(tmpdir(), "map-author-"));
  writeFileSync(join(dir, "data.ts"), gitOut("show", `${sha}:src/lib/map/data.ts`));
  writeFileSync(join(dir, "content-registry.ts"), gitOut("show", `${sha}:src/lib/map/authoring/content-registry.ts`));
  const data = await import(pathToFileURL(join(dir, "data.ts")).href);
  const registry = await import(pathToFileURL(join(dir, "content-registry.ts")).href);
  rmSync(dir, { recursive: true, force: true });
  return { model: data.mapKnowledge, registry: registry.AUTHORED_CONTENT_CONCEPTS };
}

// ---------------------------------------------------------------- commands

function printPlan(domainId: string) {
  const plan = planDomain(mapKnowledge, domainId);
  if (flags.has("--json")) return console.log(JSON.stringify(plan, null, 2));
  console.log(`${plan.ordinal} ${plan.title} (${plan.domainId}): ${plan.complete ? "complete" : "incomplete"}`);
  for (const topic of plan.topics) {
    const notes = [topic.facet ? `facet: ${topic.carriers.map((carrier) => carrier.placementId + (carrier.isPreferred ? "*" : "")).join(", ")}` : "", topic.reason ?? ""].filter(Boolean);
    console.log(`  ${topic.status.padEnd(8)} ${topic.conceptId.padEnd(32)} ${topic.childrenWithContent}/${topic.childCount} children${notes.length ? `  ${notes.join("; ")}` : ""}`);
  }
}

function commandDomains() {
  const domains = listDomains(mapKnowledge);
  if (flags.has("--json")) return console.log(JSON.stringify(domains, null, 2));
  for (const domain of domains) {
    const counts = `${domain.authored} authored, ${domain.eligible} to author, ${domain.deferred} deferred${domain.stops ? `, ${domain.stops} STOP` : ""}`;
    console.log(`${domain.ordinal} ${domain.title.padEnd(36)} ${domain.complete ? "complete  " : "incomplete"} ${counts}`);
  }
  const next = nextIncompleteDomain(mapKnowledge);
  console.log(next ? `\nnext incomplete: ${next.domainId} (not started; run \`map:author -- start --domain ${next.domainId}\`)` : "\nevery domain is complete");
}

/** What `start` sees of the repository and GitHub; shared by both kinds of run. */
function observeStart(branch: string, domainId: string) {
  const onBranch = currentBranch();
  const remoteMain = remoteSha(`refs/heads/${MAIN}`);
  const prs = sh("gh", ["pr", "list", "--state", "open", "--json", "number,headRefName,title"]);
  return startProblems(branch, {
    existingRun: Boolean(readState(domainId)),
    trackedChanges: trackedChanges(),
    branch: onBranch,
    localMainAhead: Boolean(remoteMain && onBranch === MAIN && head() !== remoteMain && !git("merge-base", "--is-ancestor", "HEAD", remoteMain).ok && git("cat-file", "-e", remoteMain).ok),
    remoteMain,
    branchExists: git("rev-parse", "--verify", "--quiet", `refs/heads/${branch}`).ok || Boolean(remoteSha(`refs/heads/${branch}`)),
    prsReadable: prs.ok,
    openRunPrs: prs.ok ? (JSON.parse(prs.out) as { number: number; headRefName: string; title: string }[]).filter((pr) => MAP_RUN_BRANCH.test(pr.headRefName)) : [],
  });
}

/** Fast-forwards main, then creates the branch, or asks for a rerun when main moved so the plan is read from the new tree. */
function branchFromMain(branch: string): string | undefined {
  const before = head();
  gitOut("fetch", "--quiet", "origin", MAIN);
  gitOut("merge", "--quiet", "--ff-only", `origin/${MAIN}`);
  if (head() !== before) {
    console.log(`\n${MAIN} fast-forwarded to ${head().slice(0, 7)}; rerun start to plan from it`);
    return undefined;
  }
  gitOut("switch", "--quiet", "-c", branch);
  return head();
}

function commandStart() {
  if (refactor) return commandRefactorStart();
  const domainId = flag("--domain") ?? fail("start needs an explicit --domain; see `map:author -- domains`");
  const plan = planDomain(mapKnowledge, domainId);
  const branch = `feat/map-${domainId}-l1`;
  const existing = readState(domainId);
  if (existing) {
    console.log(`a run for ${domainId} already exists; resuming it instead of starting again`);
    return commandStatus(existing);
  }
  const problems: string[] = [];
  if (plan.stops.length) problems.push(...plan.stops.map((entry) => `${entry.conceptId}: ${entry.reason}`));
  if (plan.eligible.length === 0) problems.push(`${domainId} has no eligible L1 topics`);
  problems.push(...observeStart(branch, domainId));

  printPlan(domainId);
  if (problems.length) {
    console.log(`\ncannot start ${domainId}:\n  ${problems.join("\n  ")}`);
    process.exit(1);
  }
  if (dryRun) return console.log(`\ndry run: would update ${MAIN} to ${remoteSha(`refs/heads/${MAIN}`)!.slice(0, 7)}, create ${branch} and author ${plan.eligible.join(", ")}`);
  const baseSha = branchFromMain(branch);
  if (!baseSha) return;
  const state = createRunState({ plan, branch, baseSha, now: now() });
  saveState(state);
  console.log(`\nstarted ${domainId} on ${branch} at ${state.baseSha.slice(0, 7)}`);
  console.log(`next: ${(nextAction(state) as { message: string }).message}`);
}

// ---------------------------------------------------------------- representation refactor runs

/** The accepted-design spec in the working tree, or as committed at a revision. */
function readSpec(sha?: string): AcceptedDesignSpec {
  const text = sha ? git("show", `${sha}:${ACCEPTED_DESIGNS_FILE}`) : { ok: existsSync(join(ROOT, ACCEPTED_DESIGNS_FILE)), out: existsSync(join(ROOT, ACCEPTED_DESIGNS_FILE)) ? readFileSync(join(ROOT, ACCEPTED_DESIGNS_FILE), "utf8") : "" };
  if (!text.ok) fail(`no accepted-design spec at ${ACCEPTED_DESIGNS_FILE}${sha ? ` in ${sha.slice(0, 7)}` : ""}`, 1);
  return JSON.parse(text.out) as AcceptedDesignSpec;
}

function commandRefactorStatus() {
  const spec = readSpec();
  const problems = specProblems(spec, mapKnowledge);
  const campaign = refactorCampaign(spec, mapKnowledge);
  if (flags.has("--json")) return console.log(JSON.stringify({ ...campaign, problems }, null, 2));
  for (const domain of campaign.domains) {
    const counts = [
      ...(domain.state === "no work" ? [] : [`${domain.actionable} to reconsider`, `${domain.resolved} resolved`]),
      ...(domain.blocked ? [`${domain.blocked} blocked`] : []),
      ...(domain.stale ? [`${domain.stale} STALE`] : []),
    ].join(", ");
    console.log(`${domain.ordinal} ${domain.title.padEnd(36)} ${domain.state.padEnd(9)} ${counts}`);
  }
  const blocked = spec.designs.filter((design) => design.status === "blocked");
  if (blocked.length) console.log(`\nblocked: ${blocked.map((design) => `${design.conceptId} (${design.blockedBy?.join(", ")})`).join("; ")}`);
  for (const problem of problems) console.log(`SPEC PROBLEM: ${problem}`);
  console.log(campaign.next ? `\nnext with work: ${campaign.next} (not started; run \`${CLI} start --domain ${campaign.next}\`)` : "\nevery domain's actionable designs are resolved");
}

function printRefactorPlan(domainId: string) {
  const plan = planRefactor(readSpec(), mapKnowledge, domainId);
  if (flags.has("--json")) return console.log(JSON.stringify(plan, null, 2));
  console.log(`${plan.ordinal} ${plan.title} (${plan.domainId}): ${plan.noop ? "no work" : plan.complete ? "complete" : "pending"}`);
  for (const design of plan.actionable) {
    console.log(`  actionable ${design.conceptId.padEnd(34)} ${design.classification.padEnd(8)} → ${targetKinds(design).join(" + ") || "prose"}${plan.stale.includes(design.conceptId) ? "  STALE" : ""}`);
  }
  for (const design of plan.resolved) console.log(`  resolved   ${design.conceptId.padEnd(34)} ${design.resolution!.decision}`);
  for (const design of plan.blocked) console.log(`  blocked    ${design.conceptId.padEnd(34)} needs ${design.blockedBy?.join(", ")}`);
  console.log(`  keep       ${plan.keep.length} other L1 concept(s), protected`);
}

function commandRefactorStart() {
  const domainId = flag("--domain") ?? fail(`start needs an explicit --domain; see \`${CLI} domains\``);
  const spec = readSpec();
  const plan = planRefactor(spec, mapKnowledge, domainId);
  const branch = refactorBranch(domainId);
  const existing = readState(domainId);
  if (existing && existing.stage !== "done") {
    console.log(`a refactor run for ${domainId} already exists; resuming it instead of starting again`);
    return commandStatus(existing);
  }
  const problems: string[] = [];
  if (existing) problems.push(`a finished refactor run for ${domainId} exists (${statePath(domainId)}); its PR must be merged or closed and the file removed before another run`);
  problems.push(...specProblems(spec, mapKnowledge).map((problem) => `spec: ${problem}`));
  if (plan.noop) problems.push(`${domainId} has no actionable designs: nothing to refactor, no branch or PR`);
  else if (plan.complete) problems.push(`${domainId}'s actionable designs are all resolved`);
  if (plan.stale.length) problems.push(`designs reviewed against different content: ${plan.stale.join(", ")}`);
  problems.push(...observeStart(branch, domainId));
  printRefactorPlan(domainId);
  if (problems.length) {
    console.log(`\ncannot start ${domainId}:\n  ${problems.join("\n  ")}`);
    process.exit(1);
  }
  const placements = renderExpectations(mapKnowledge, plan.actionable.map((design) => design.conceptId)).flatMap((target) => target.placements.map((placement) => placement.placementId));
  if (dryRun) {
    console.log(`\ndry run: would update ${MAIN} to ${remoteSha(`refs/heads/${MAIN}`)!.slice(0, 7)} and create ${branch}`);
    console.log(`may change at most: ${plan.actionable.map((design) => design.conceptId).join(", ")}`);
    console.log(`render checks, if all change: ${placements.join(", ")} (each at 1280 and 375)`);
    return;
  }
  const baseSha = branchFromMain(branch);
  if (!baseSha) return;
  const state = createRefactorRunState({ plan, designSet: designSetFingerprint(spec, domainId), branch, baseSha, now: now() });
  saveState(state);
  console.log(`\nstarted the ${domainId} refactor on ${branch} at ${state.baseSha.slice(0, 7)}`);
  console.log(`next: ${(nextAction(state) as { message: string }).message}`);
}

/** The run's accepted design for one concept, as committed on its base. */
function designOf(state: RunState, conceptId: string) {
  const design = readSpec(state.baseSha).designs.find((candidate) => candidate.conceptId === conceptId && candidate.domainId === state.domainId);
  if (!design || !state.plan.eligible.includes(conceptId)) fail(`${conceptId} has no actionable design in this run (${state.plan.eligible.join(", ")}); KEEP and blocked concepts are not changed`, 1);
  return design;
}

function commandRefactorContext() {
  const state = activeState();
  const conceptId = positional[0] ?? fail("context needs a concept id");
  const design = designOf(state, conceptId);
  const carriers = createMapAuthoringInspector(mapKnowledge).inspectConcept(conceptId).childLayers.carriers;
  const primary = (carriers.find((carrier) => carrier.isPreferred) ?? carriers[0])?.placementId;
  process.stdout.write(formatMapConceptAuthoringContext(createMapAuthoringInspector(mapKnowledge).inspectConcept(conceptId, primary ? { contextPlacementId: primary } : {})));
  console.log(
    [
      "",
      `Accepted design (${design.classification}), reviewed against ${design.current.sequence}`,
      `  purpose: ${design.model.purpose}`,
      ...design.target.map((choice) => `  target ${choice.structure}: ${choice.purpose}`),
      `  justification: ${design.justification}`,
      ...(design.canonicalNote ? [`  placements: ${design.canonicalNote}`] : []),
      ...(design.facetNote ? [`  facets: ${design.facetNote}`] : []),
      "",
      "Boundary",
      "  Reconsider the design against the context above before editing. Then either:",
      `  - execute: reach exactly ${targetKinds(design).join(" + ") || "prose"} as structured blocks;`,
      "  - reduce: a smaller change within those structures (or the record's own);",
      "  - keep: leave the record exactly as it is.",
      design.classification === "rewrite" ? "  This design is a rewrite: the definition may change." : "  The definition and legacy fields stay unchanged; changing them is a rewrite and needs its own accepted design.",
      "  A different representation, another primitive, a sibling or taxonomy is outside the run: stop instead.",
    ].join("\n"),
  );
}

async function commandRefactorRecord() {
  let state = activeState();
  const conceptId = positional[0] ?? fail("record needs a concept id");
  if (state.stop) return printStop(state);
  verifyGit(state);
  const design = designOf(state, conceptId);
  const decision = flag("--decision") as Decision | undefined;
  if (!decision || !DECISIONS.includes(decision)) fail(`record needs --decision ${DECISIONS.join("|")}`);
  const note = flag("--note") ?? fail("record needs --note saying why");
  const base = (await modelAt(state.baseSha)).model.content.find((record) => record.conceptId === conceptId);
  const current = mapKnowledge.content.find((record) => record.conceptId === conceptId);
  const problems = decisionProblems(design, base, current, decision);
  if (problems.length) fail(`not within the accepted design:\n  ${problems.join("\n  ")}\nchange the record, record another decision, or stop (\`${CLI} stop\`) if a different design is needed`, 1);
  const generated = sh("npm", ["run", "--silent", "map:generate"]);
  if (!generated.ok) fail(`map:generate failed\n${tail(generated.out)}`, 1);
  const focused = sh("node", ["--test", ...FOCUSED_TESTS]);
  if (!focused.ok) fail(`focused tests failed (${testCounts(focused.out)})\n${tail(focused.out, 40)}`, 1);
  state = recordDecision(state, conceptId, decision, note, now());
  saveState(state);
  console.log(`recorded ${conceptId}: ${decision} (focused tests ${testCounts(focused.out)}); ${pendingConcepts(state).length} to go`);
  commandNext(state);
}

function gitPosition(state: RunState): string {
  if (state.pr) return `in PR #${state.pr.number} ${state.pr.url}`;
  if (state.pushedSha) return `pushed at ${state.pushedSha.slice(0, 7)}`;
  if (state.commits.length) return `committed (${state.commits.length} commit(s)), not pushed`;
  const changes = currentBranch() === state.branch ? trackedChanges() : [];
  return changes.length ? `uncommitted (${changes.length} changed file(s))` : "nothing written yet";
}

function commandStatus(state = activeState()) {
  const done = state.plan.eligible.filter((conceptId) => state.concepts[conceptId].done);
  const stageIndex = STAGES.indexOf(state.stage);
  const report = [
    `${state.title} (${state.domainId}): stage ${state.stage}${state.stop ? " (STOPPED)" : ""}`,
    `branch ${state.branch} from ${state.baseSha.slice(0, 7)}; ${gitPosition(state)}`,
    refactor
      ? `decided ${done.length}/${state.plan.eligible.length}: ${done.map((conceptId) => `${conceptId} ${state.refactor!.decisions[conceptId]?.decision}`).join(", ") || "none"}${pendingConcepts(state).length ? ` | to reconsider: ${pendingConcepts(state).join(", ")}` : ""} | blocked: ${state.refactor!.blocked.join(", ") || "none"} | keep protected: ${state.refactor!.keep.length}`
      : `authored ${done.length}/${state.plan.eligible.length}: ${done.join(", ") || "none"}${pendingConcepts(state).length ? ` | pending: ${pendingConcepts(state).join(", ")}` : ""}`,
    `already authored: ${state.plan.authored.join(", ") || "none"}`,
    `deferred: ${state.plan.deferred.map((entry) => `${entry.conceptId} (${entry.reason})`).join("; ") || "none"}`,
    `fixes: ${state.fixes.map((fix) => fix.message).join("; ") || "none"}`,
    `checks passed: ${Object.entries(state.checks).filter(([, check]) => check.ok).map(([name]) => name).join(", ") || "none"}`,
    `stages remaining: ${STAGES.slice(stageIndex).filter((stage) => stage !== "done").join(", ") || "none"}`,
  ];
  console.log(report.join("\n"));
  for (const resolved of state.resolvedStops ?? []) console.log(`resolved stop at ${resolved.stage}: ${resolved.subject} → ${resolved.resolution}`);
  if (state.stop) printStop(state);
  else commandNext(state);
}

function commandNext(state = activeState()) {
  const action = nextAction(state);
  if (action.kind === "done") console.log(`next: nothing; the PR awaits human merge`);
  else if (action.kind === "stop") printStop(state);
  else console.log(`next: ${action.message}`);
}

function topicOf(state: RunState, conceptId: string) {
  const topic = planDomain(mapKnowledge, state.domainId).topics.find((candidate) => candidate.conceptId === conceptId);
  if (!topic) fail(`${conceptId} is not an L1 topic of ${state.domainId}`);
  return topic;
}

function commandContext() {
  const state = activeState();
  const conceptId = positional[0] ?? fail("context needs a concept id");
  const topic = topicOf(state, conceptId);
  const run = state.concepts[conceptId] ? (state.concepts[conceptId].done ? "recorded" : "to author") : topic.status;
  console.log(`run: ${state.domainId} | ${conceptId}: ${run}${topic.facet ? " | FACET RULE: one exposition for every child layer; relate the facets, synthesize neither one layer nor the union" : ""}\n`);
  const context = createMapAuthoringInspector(mapKnowledge).inspectConcept(conceptId, { contextPlacementId: topic.placementId });
  process.stdout.write(formatMapConceptAuthoringContext(context));
}

function commandRecord() {
  let state = activeState();
  const conceptId = positional[0] ?? fail("record needs a concept id");
  if (state.stop) return printStop(state);
  verifyGit(state);
  if (!(conceptId in state.concepts)) fail(`${conceptId} is not a concept this run authors (${state.plan.eligible.join(", ")})`, 1);
  if (state.concepts[conceptId].done) return console.log(`${conceptId} already recorded`), commandNext(state);
  const registration = createMapAuthoringInspector(mapKnowledge).inspectConcept(conceptId).registration;
  if (registration !== "registered") fail(`the inspector reports ${conceptId} as ${registration}; add its content and registry entry first`, 1);
  const generated = sh("npm", ["run", "--silent", "map:generate"]);
  if (!generated.ok) fail(`map:generate failed\n${tail(generated.out)}`, 1);
  const focused = sh("node", ["--test", ...FOCUSED_TESTS]);
  const counts = testCounts(focused.out);
  if (!focused.ok) fail(`focused tests failed (${counts})\n${tail(focused.out, 40)}`, 1);
  const unrecorded = state.plan.eligible.filter((other) => other !== conceptId && !state.concepts[other].done && AUTHORED_CONTENT_CONCEPTS.includes(other));
  state = recordConcept(state, conceptId, now());
  saveState(state);
  console.log(`recorded ${conceptId} (focused tests ${counts}); ${pendingConcepts(state).length} to go${unrecorded.length ? `; also registered but unrecorded: ${unrecorded.join(", ")}` : ""}`);
  commandNext(state);
}

function commandAudit() {
  const state = activeState();
  const audits = auditConcepts(mapKnowledge, refactor ? changedConcepts(state) : state.plan.eligible.filter((conceptId) => state.concepts[conceptId].done));
  if (refactor && !audits.length) console.log("every design was reconsidered and kept: no changed record to audit");
  if (flags.has("--json")) return console.log(JSON.stringify(audits, null, 2));
  const phrases = (entries: { conceptId: string; phrases: string[] }[]) =>
    entries.map((entry) => `${entry.conceptId}: ${entry.phrases.slice(0, 3).map((phrase) => `"${phrase}"`).join(", ")}${entry.phrases.length > 3 ? ` +${entry.phrases.length - 3}` : ""}`).join("; ");
  for (const audit of audits) {
    console.log(`${audit.conceptId}: ${audit.words} words, ${audit.blocks}`);
    if (audit.parentOverlap.length) console.log(`  parent overlap: ${phrases(audit.parentOverlap)}`);
    if (audit.siblingOverlap.length) console.log(`  sibling overlap: ${phrases(audit.siblingOverlap)}`);
    if (audit.corpusOverlap.length) console.log(`  corpus overlap: ${phrases(audit.corpusOverlap)}`);
    for (const sentence of audit.verbatim) console.log(`  verbatim elsewhere: "${sentence}"`);
    for (const sentence of audit.positional) console.log(`  positional?: "${sentence}"`);
    if (audit.sharedDefinitionTemplate.length) console.log(`  definition opening shared with: ${audit.sharedDefinitionTemplate.join(", ")}`);
  }
  console.log(`\nJudge these against docs/map-authoring/quality-contract.md${refactor ? " and representation-design.md" : ""}; correct only this run's ${refactor ? "changed records, within their accepted designs" : "content"}.`);
}

async function commandComplete() {
  let state = activeState();
  if (state.stop) return printStop(state);
  verifyGit(state);
  const stage = positional[0] as Stage;
  if (!AGENT_STAGES.has(stage)) fail(`only the agent's stages (${[...AGENT_STAGES].join(", ")}) are completed by hand; tool stages advance through \`run\``);
  const note = flag("--note");
  if (stage === "audit" && !note && !state.completed.audit) fail("complete audit needs --note summarizing what the audit found and corrected (\"No corrections.\" is a valid note)");
  if (note && !state.completed[stage]) state = { ...state, auditNotes: [...state.auditNotes, note] };
  if (refactor && stage === "audit") {
    // Every decision must still hold for the records as audited, and is then written into the spec.
    const base = (await modelAt(state.baseSha)).model;
    const problems = Object.entries(state.refactor!.decisions).flatMap(([conceptId, recorded]) =>
      decisionProblems(designOf(state, conceptId), base.content.find((record) => record.conceptId === conceptId), mapKnowledge.content.find((record) => record.conceptId === conceptId), recorded.decision),
    );
    if (problems.length) fail(`the audited records no longer match their recorded decisions:\n  ${problems.join("\n  ")}\nrecord the decisions again or restore the records`, 1);
    const notes = Object.fromEntries(Object.entries(state.refactor!.decisions).map(([conceptId, recorded]) => [conceptId, { decision: recorded.decision, note: recorded.note }]));
    writeFileSync(join(ROOT, ACCEPTED_DESIGNS_FILE), `${JSON.stringify(resolveSpec(readSpec(state.baseSha), notes, mapKnowledge), null, 2)}\n`);
  }
  state = completeStage(state, stage, now(), note);
  if (stage === "audit") state = { ...state, auditContent: contentFingerprint(state) };
  saveState(state);
  commandNext(state);
}

function commandFix() {
  const state = activeState();
  if (state.stop) return printStop(state);
  verifyGit(state);
  const kind = flag("--kind") ?? fail("fix needs --kind test|fix");
  const message = flag("--message") ?? fail("fix needs --message, e.g. \"test(map): derive child expectations from the registry\"");
  const files = (flag("--files") ?? fail("fix needs --files a,b")).split(",").map((file) => file.trim()).filter(Boolean);
  const reason = flag("--reason") ?? fail("fix needs --reason");
  const fix = { kind: kind as FixGroup["kind"], message, files, reason };
  const fixes = [...state.fixes.filter((existing) => existing.message !== message), fix];
  const problems = validateFixes(fixes, fixLines(state, fixes.flatMap((entry) => entry.files)));
  if (problems.length) fail(`not a general fix; stop instead (\`map:author -- stop\`) if the run needs it:\n  ${problems.join("\n  ")}`, 1);
  saveState(addFix(state, fix));
  console.log(`declared ${message} (${files.join(", ")}); it is verified on its own base and committed before the content`);
}

function commandStop() {
  const state = activeState();
  if (state.stop) return printStop(state);
  const need = (name: string) => flag(`--${name}`) ?? fail(`stop needs --subject, --evidence, --why and --decision`);
  stop(state, { subject: need("subject"), evidence: need("evidence"), why: need("why"), decision: need("decision") });
}

function commandResume() {
  const state = activeState();
  if (!state.stop) return console.log("the run is not stopped"), commandNext(state);
  const resumed = resumeRun(state, flag("--decision") ?? fail("resume needs --decision \"<the human decision that resolved the stop>\""), now());
  saveState(resumed);
  console.log(`resumed at ${resumed.stage}`);
  commandNext(resumed);
}

// ---------------------------------------------------------------- tool stages

const testCounts = (out: string) => {
  const pass = out.match(/ℹ pass (\d+)/)?.[1];
  const failCount = out.match(/ℹ fail (\d+)/)?.[1];
  return pass ? `${pass} passing, ${failCount ?? 0} failing` : "no summary";
};

/** A file's blob in the working tree, the index or a commit; a missing file is recorded as deleted. */
const DELETED = "(deleted)";
const worktreeBlob = (file: string) => (existsSync(join(ROOT, file)) ? gitOut("hash-object", "--", file) : DELETED);
const blobAt = (ref: string, file: string) => {
  const result = git("rev-parse", `${ref}:${file}`);
  return result.ok ? result.out.trim() : DELETED;
};

/** Declared fix files that git does not track yet (a new test file, say). */
const untrackedFixFiles = (state: RunState) => {
  const untracked = new Set(lines(gitOut("ls-files", "--others", "--exclude-standard")));
  return state.fixes.flatMap((fix) => fix.files).filter((file) => untracked.has(file));
};

/** Files that differ from the base: tracked changes (renames split into delete and add) plus untracked declared fix files. */
const changedFiles = (state: RunState) => [...new Set([...lines(gitOut("diff", "--no-renames", "--name-only", state.baseSha)), ...untrackedFixFiles(state)])];

/** Identifies the tree a check ran against: the whole diff from the base, plus untracked fix files. */
function treeFingerprint(state: RunState): string {
  const hash = createHash("sha256").update(gitOut("diff", "--no-renames", "--binary", state.baseSha));
  for (const file of untrackedFixFiles(state).sort()) hash.update(`\0${file}\0`).update(readFileSync(join(ROOT, file)));
  return hash.digest("hex");
}

/** Added and deleted lines of one file relative to the base. */
function fileDiff(state: RunState, file: string): { added: string[]; deleted: number } {
  const patch = lines(gitOut("diff", "--no-renames", "-U0", state.baseSha, "--", file).split("\n").map((line) => line.replace(/\s+$/, "")).join("\n"));
  return {
    added: patch.filter((line) => line.startsWith("+") && !line.startsWith("+++")).map((line) => line.slice(1)),
    deleted: patch.filter((line) => line.startsWith("-") && !line.startsWith("---")).length,
  };
}

/** Added plus deleted lines across fix files; an untracked file counts all its lines. */
function fixLines(state: RunState, files: readonly string[]): number {
  const untracked = new Set(lines(gitOut("ls-files", "--others", "--exclude-standard")));
  return files.reduce((sum, file) => {
    if (untracked.has(file)) return sum + readFileSync(join(ROOT, file), "utf8").split("\n").length;
    const stat = gitOut("diff", "--no-renames", "--numstat", state.baseSha, "--", file).split(/\s+/);
    return sum + (Number(stat[0]) || 0) + (Number(stat[1]) || 0);
  }, 0);
}

/** Browser-suite sections a file defines, read from the file as the fix leaves it. */
async function sectionsOf(file: string): Promise<string[]> {
  const exported = (await import(pathToFileURL(join(ROOT, file)).href)) as Record<string, unknown>;
  return Object.values(exported)
    .filter(Array.isArray)
    .flat()
    .filter((entry): entry is { name: string } => typeof entry === "object" && entry !== null && "name" in entry && "run" in entry)
    .map((entry) => entry.name);
}

/** Leftover verification trees from an interrupted run would be linted, type-checked and built as part of the repository. */
function clearVerifyTrees() {
  if (existsSync(VERIFY_DIR)) rmSync(VERIFY_DIR, { recursive: true, force: true });
  git("worktree", "prune");
}

type CheckFn = (current: RunState, name: string, result: Result, detail: string, what: string, why: string) => RunState;

/**
 * Verifies each declared fix on its own: a worktree of the base plus the fixes
 * up to it, without any content, must pass the smallest sufficient check
 * (fix-verification.ts): the type-check and unit suite, and for a browser-check
 * fix, those browser checks against a production build of that tree. A fix
 * with no focused verification stops the run.
 */
async function verifyFixesAlone(state: RunState, check: CheckFn): Promise<RunState> {
  let current = state;
  const base = state.fixes.some((fix) => fix.files.some((file) => file.startsWith("e2e/"))) ? await modelAt(state.baseSha) : undefined;
  for (let index = 0; index < state.fixes.length; index++) {
    const fix = state.fixes[index];
    const names = new Map<string, string[]>();
    for (const file of fix.files) if (file.startsWith("e2e/map/") && existsSync(join(ROOT, file))) names.set(file, await sectionsOf(file));
    const plan = planFixVerification(fix.files, (file) => names.get(file) ?? []);
    const sample = plan.render ? renderSample(base!.model, base!.registry) : [];
    const what = `fix "${fix.message}" alone`;
    if (plan.unverifiable.length || (plan.render && sample.length === 0)) {
      stop(current, {
        subject: what,
        evidence: plan.unverifiable.length ? `no focused browser check exercises ${plan.unverifiable.join(", ")}` : "the base has no authored concept to render",
        why: "the fix cannot be verified independently of the run's content, so it is not an isolated general fix",
        decision: "drop the fix from this run, or decide how it should be verified",
      });
    }
    clearVerifyTrees();
    const dir = join(VERIFY_DIR, "tree");
    mkdirSync(VERIFY_DIR, { recursive: true });
    const steps: string[] = [];
    let outcome: Result = { ok: true, status: 0, out: "" };
    gitOut("worktree", "add", "--quiet", "--detach", dir, state.baseSha);
    try {
      for (const file of state.fixes.slice(0, index + 1).flatMap((declared) => declared.files)) {
        if (existsSync(join(ROOT, file))) {
          mkdirSync(dirname(join(dir, file)), { recursive: true });
          copyFileSync(join(ROOT, file), join(dir, file));
        } else rmSync(join(dir, file), { force: true });
      }
      // Hard links, not a symlink: the production build rejects a node_modules outside the project.
      for (const local of ["node_modules", ".dev.vars"]) {
        if (!existsSync(join(ROOT, local))) continue;
        const linked = sh("cp", ["-al", join(ROOT, local), join(dir, local)]);
        if (!linked.ok) throw new ToolFailure(`hard-linking ${local} into the verification tree`, linked.out);
      }
      const run = (label: string, cmd: string, args: string[], summary: (out: string) => string, passed = (result: Result) => result.ok) => {
        if (!outcome.ok) return;
        const result = sh(cmd, args, { cwd: dir });
        outcome = { ...result, ok: passed(result) };
        steps.push(`${label} ${outcome.ok ? summary(result.out) : "FAILED"}`);
      };
      // Route and asset types come from Next itself, as its docs prescribe for type-checking without a build.
      run("typegen", "npx", ["next", "typegen"], () => "ok");
      run("types", "npx", ["tsc", "--noEmit", "-p", "."], () => "ok");
      run("unit", "node", ["--test", "src/**/*.test.ts"], testCounts);
      if (plan.build) run("build", "npm", ["run", "build"], () => "ok");
      if (plan.suite === "all" || plan.suite.length) {
        const only = plan.suite === "all" ? [] : [`--only=${plan.suite.join(",")}`];
        run(`browser ${plan.suite === "all" ? "suite" : plan.suite.join(",")}`, "node", ["e2e/map/run.mts", ...only], suiteSummary, suitePassed);
      }
      if (plan.render) run(`render ${sample.join(",")}`, "node", ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", "e2e/map/render-check.mts", ...sample], (out) => lines(out).at(-1) ?? "ok");
    } finally {
      // Removed before judging the outcome: a failed check stops the process.
      clearVerifyTrees();
    }
    current = check(current, `fix: ${fix.message}`, outcome, `on the base without content: ${steps.join("; ")}`, what, "a declared fix does not stand on its own, so it is not an isolated general fix");
  }
  return current;
}

/** The browser suite passed only if it exited cleanly and reported every check passing. */
const suitePassed = (result: Result) => result.ok && /\bALL CHECKS PASSED\b/.test(result.out) && /\b\d+ checks, 0 failures\b/.test(result.out);
const suiteSummary = (out: string) => out.match(/\b(\d+ checks, \d+ failures)\b(?![\s\S]*\b\d+ checks, \d+ failures)/)?.[1] ?? "no summary";

/** Untracked paths are not part of the tracked tree, so lint ignores them (e.g. .worktrees/), except declared fix files. */
const lintIgnores = (state: RunState) => {
  const fixFiles = untrackedFixFiles(state);
  return lines(gitOut("ls-files", "--others", "--directory", "--exclude-standard"))
    .filter((path) => !fixFiles.some((file) => file === path || file.startsWith(path)))
    .flatMap((path) => ["--ignore-pattern", path.endsWith("/") ? `${path}**` : path])
    .concat("--ignore-pattern", ".map-authoring/**");
};

const buildId = () => (existsSync(join(ROOT, ".next/BUILD_ID")) ? readFileSync(join(ROOT, ".next/BUILD_ID"), "utf8").trim() : undefined);

/** The run's content records, fingerprinted: what the audit judged. */
const contentFingerprint = (state: RunState) =>
  createHash("sha256")
    .update(JSON.stringify(state.plan.eligible.map((conceptId) => mapKnowledge.content.find((record) => record.conceptId === conceptId) ?? null)))
    .digest("hex");

type Gate = { name: string; label: string; run: (state: RunState) => Result; detail: (result: Result) => string };
const GATES: Gate[] = [
  {
    name: "generate",
    label: "map:generate without drift",
    run: () => {
      const before = readFileSync(join(ROOT, VIEW_FILE), "utf8");
      const result = sh("npm", ["run", "--silent", "map:generate"]);
      const drift = result.ok && readFileSync(join(ROOT, VIEW_FILE), "utf8") !== before;
      return drift ? { ok: false, status: 1, out: "the generated view changed; `record` should have regenerated it" } : result;
    },
    detail: () => "no drift",
  },
  { name: "test", label: "unit tests", run: () => sh("npm", ["test"]), detail: (result) => testCounts(result.out) },
  { name: "lint", label: "lint (tracked tree)", run: (state) => sh("npx", ["eslint", ...lintIgnores(state), "."]), detail: () => "clean" },
  { name: "build", label: "build", run: () => sh("npm", ["run", "build"]), detail: () => "succeeded" },
];

async function runStage(state: RunState): Promise<RunState> {
  const stage = state.stage;
  const at = now();
  const tree = treeFingerprint(state);
  const check = (current: RunState, name: string, result: Result, detail: string, what: string, why: string): RunState => {
    const recorded = recordCheck(current, name, result.ok, result.ok ? detail : `FAILED: ${detail}`, at, tree);
    saveState(recorded);
    if (!result.ok) {
      stop(recorded, {
        subject: what,
        evidence: tail(result.out, 30),
        why,
        decision: "fix it in this run's content, or declare a general fix (`map:author -- fix`), then `map:author -- resume --decision ..` and `run`; if the fix would change established behavior, decide the behavior first",
      });
    }
    console.log(`  ok  ${what}: ${detail}`);
    return recorded;
  };

  switch (stage) {
    case "gates": {
      let current = state;
      for (const gate of GATES) {
        const result = gate.run(current);
        current = check(current, gate.name, result, gate.detail(result), gate.label, `the ${gate.label} gate failed`);
      }
      // The browser and render checks must run against exactly this build.
      return completeStage({ ...current, buildId: buildId() }, "gates", at);
    }
    case "browser": {
      const result = sh("npm", ["run", "test:map:browser"]);
      // Success needs a clean exit and the suite's own all-passed summary, never the attempt alone.
      const failures = lines(result.out).filter((line) => line.startsWith("FAIL")).slice(0, 20).join("\n");
      const outcome = { ...result, ok: suitePassed(result), out: failures ? `${failures}\n${tail(result.out, 3)}` : result.out };
      return completeStage(check(state, "browser", outcome, suiteSummary(result.out), "browser suite", "the full MAP browser suite failed on the final tree"), "browser", at);
    }
    case "render": {
      const { checkRender, formatRenderFailures } = await import("../e2e/map/render-check.mts");
      // A refactor renders what it changed: every placement of every changed record.
      const concepts = refactor ? changedConcepts(state) : state.plan.eligible;
      if (concepts.length === 0) return completeStage(check(state, "render", { ok: true, status: 0, out: "" }, "no changed record to render", "render verification", ""), "render", at);
      const targets = renderExpectations(mapKnowledge, concepts);
      const report = await checkRender(concepts);
      const evidence = formatRenderFailures(report);
      const placements = targets.reduce((sum, target) => sum + target.placements.length, 0);
      const detail = `${report.renders} renders across ${placements} placements`;
      return completeStage(check(state, "render", { ok: report.ok, status: report.ok ? 0 : 1, out: evidence }, detail, "render verification", "an authored concept renders incorrectly at one of its placements"), "render", at);
    }
    case "diff": {
      const base = await modelAt(state.baseSha);
      const files = changedFiles(state);
      if (refactor) {
        const baseSpec = readSpec(state.baseSha);
        if (designSetFingerprint(baseSpec, state.domainId) !== state.refactor!.designSet) {
          stop(state, { subject: "accepted designs", evidence: `the base's designs for ${state.domainId} differ from those the run started with`, why: "the run would validate against designs it did not reconsider", decision: "discard the run and start again from main" });
        }
        const decisions = Object.fromEntries(Object.entries(state.refactor!.decisions).map(([conceptId, recorded]) => [conceptId, recorded.decision]));
        const report = validateRefactorDiff({
          base: base.model,
          head: mapKnowledge,
          baseRegistry: base.registry,
          headRegistry: AUTHORED_CONTENT_CONCEPTS,
          baseView: JSON.parse(gitOut("show", `${state.baseSha}:${VIEW_FILE}`)),
          headView: JSON.parse(readFileSync(join(ROOT, VIEW_FILE), "utf8")),
          baseSpec,
          headSpec: readSpec(),
          designs: baseSpec.designs.filter((design) => state.plan.eligible.includes(design.conceptId) && design.domainId === state.domainId),
          decisions,
          changedFiles: files,
          fixes: state.fixes,
          fixLines: fixLines(state, state.fixes.flatMap((fix) => fix.files)),
        });
        if (!report.ok) {
          stop(recordCheck(state, "diff", false, `FAILED: ${report.problems.length} problem(s)`, at, tree), {
            subject: "refactor diff",
            evidence: report.problems.join("\n"),
            why: "the diff contains more, or other, than the run's decisions within their accepted designs",
            decision: "revert the unexpected change, or stop if a different design is needed",
          });
        }
        const verified = await verifyFixesAlone(state, check);
        const validatedFiles = Object.fromEntries(files.map((file) => [file, worktreeBlob(file)]));
        const detail = `${report.changed.length} changed record(s), ${report.kept.length} kept, ${files.length} file(s)`;
        const recorded = check(verified, "diff", { ok: true, status: 0, out: "" }, detail, "refactor diff", "");
        return completeStage({ ...recorded, validatedFiles, refactor: { ...recorded.refactor!, diff: { changed: report.changed, kept: report.kept } } }, "diff", at);
      }
      const diff = validateContentDiff({
        base: base.model,
        head: mapKnowledge,
        baseView: JSON.parse(gitOut("show", `${state.baseSha}:${VIEW_FILE}`)),
        headView: JSON.parse(readFileSync(join(ROOT, VIEW_FILE), "utf8")),
        baseRegistry: base.registry,
        headRegistry: AUTHORED_CONTENT_CONCEPTS,
        changedFiles: files,
        data: fileDiff(state, "src/lib/map/data.ts"),
        registry: fileDiff(state, "src/lib/map/authoring/content-registry.ts"),
        expectedConcepts: state.plan.eligible,
        fixes: state.fixes,
        fixLines: fixLines(state, state.fixes.flatMap((fix) => fix.files)),
      });
      if (!diff.ok) {
        stop(recordCheck(state, "diff", false, `FAILED: ${diff.problems.length} problem(s)`, at, tree), {
          subject: "working diff",
          evidence: diff.problems.join("\n"),
          why: "the diff contains more, or less, than this run's content and its declared general fixes",
          decision: "revert the unexpected change, or decide how the run should treat it",
        });
      }
      const verified = await verifyFixesAlone(state, check);
      const validatedFiles = Object.fromEntries(files.map((file) => [file, worktreeBlob(file)]));
      const detail = `${diff.addedConcepts.length} records, ${diff.flipped.length} hasContent flips, ${files.length} files`;
      const recorded = check(verified, "diff", { ok: true, status: 0, out: "" }, detail, "diff", "");
      return completeStage({ ...recorded, diff, validatedFiles }, "diff", at);
    }
    case "commit":
      return completeStage(commit(state), "commit", at);
    case "push":
      return completeStage(push(state), "push", at);
    case "pr":
      return completeStage(openPr(state), "pr", at);
    case "ci":
      return completeStage(watchCi(state), "ci", at);
    default:
      throw new RunStateError(`${stage} is not a tool stage`);
  }
}

/** Commits each declared fix, then the content, and proves the commits compose to the validated tree. */
function commit(state: RunState): RunState {
  const groups = commitGroups(state, {
    fix: (fix) => fixCommitMessage(fix, state.attribution?.trailer),
    content: refactor ? refactorCommitMessage(state, state.attribution?.trailer) : contentCommitMessage(state, state.attribution?.trailer),
  });
  const drifted = Object.entries(state.validatedFiles!).filter(([file, hash]) => worktreeBlob(file) !== hash).map(([file]) => file);
  if (state.commits.length === 0 && drifted.length) {
    stop(state, { subject: "working tree", evidence: `changed since validation: ${drifted.join(", ")}`, why: "commits must reproduce the validated tree exactly", decision: "revert the later change, or keep it: `resume --decision ..` then `run` revalidates from the gates" });
  }
  if (lines(gitOut("diff", "--cached", "--name-only")).length) {
    stop(state, { subject: "index", evidence: gitOut("diff", "--cached", "--name-only"), why: "files were staged outside the run", decision: "unstage them (`git restore --staged`)" });
  }
  let current = state;
  for (const group of groups.slice(state.commits.length)) {
    gitOut("add", "--all", "--", ...group.files);
    const staged = lines(gitOut("diff", "--cached", "--no-renames", "--name-only")).sort();
    const unvalidated = group.files.filter((file) => blobAt("", file) !== state.validatedFiles![file]);
    if (JSON.stringify(staged) !== JSON.stringify([...group.files].sort()) || unvalidated.length) {
      stop(current, {
        subject: "staging",
        evidence: `staged ${staged.join(", ")}; expected ${group.files.join(", ")}; content differing from validation: ${unvalidated.join(", ") || "none"}`,
        why: "only the group's intended files, exactly as validated, may be staged",
        decision: "inspect the index and working tree; nothing has been committed for this group",
      });
    }
    const committed = sh("git", ["commit", "--quiet", "-F", "-"], { input: group.message });
    if (!committed.ok) throw new ToolFailure("git commit", committed.out);
    current = { ...current, commits: [...current.commits, { sha: head(), message: group.message, files: group.files }] };
    saveState(current);
    console.log(`  ok  commit ${head().slice(0, 7)} ${group.message.split("\n")[0]}`);
  }
  const composition = compositionProblems(state.validatedFiles!, { files: lines(gitOut("diff", "--no-renames", "--name-only", state.baseSha, "HEAD")), blobAtHead: (file) => blobAt("HEAD", file) });
  if (composition.length || trackedChanges().length) {
    stop(current, {
      subject: "commits",
      evidence: `${composition.join("; ") || "commits match validation"}; left uncommitted: ${trackedChanges().join(", ") || "none"}`,
      why: "the commits do not compose to the validated tree",
      decision: "inspect the commits; nothing has been pushed",
    });
  }
  return current;
}

function assertBaseSafe(state: RunState) {
  gitOut("fetch", "--quiet", "origin", MAIN);
  const moved = lines(gitOut("diff", "--no-renames", "--name-only", state.baseSha, `origin/${MAIN}`));
  const touched = moved.filter((file) => state.validatedFiles && file in state.validatedFiles);
  const merge = git("merge-tree", "--write-tree", "--quiet", `origin/${MAIN}`, "HEAD");
  if (touched.length || !merge.ok) {
    stop(state, {
      subject: `origin/${MAIN}`,
      evidence: `${MAIN} moved since ${state.baseSha.slice(0, 7)}; it also changed ${touched.join(", ") || "no run file"}${merge.ok ? "" : "; the branch no longer merges cleanly"}`,
      why: "the base diverged in files this run changes, so its validation no longer holds",
      decision: "rebase the run onto the new main and revalidate, or abandon it",
    });
  }
}

function push(state: RunState): RunState {
  verifyGit(state);
  assertBaseSafe(state);
  const remote = remoteSha(`refs/heads/${state.branch}`);
  const local = head();
  if (remote && remote !== local) {
    stop(state, { subject: `origin/${state.branch}`, evidence: `remote is ${remote.slice(0, 7)}, local ${local.slice(0, 7)}`, why: "the remote branch holds work this run did not push; the tool never force-pushes", decision: "reconcile the remote branch by hand" });
  }
  if (!remote) {
    const result = sh("git", ["push", "--quiet", "-u", "origin", state.branch]);
    if (!result.ok) throw new ToolFailure("git push", result.out);
  }
  console.log(`  ok  ${remote ? "already on the remote" : "pushed"}: ${state.branch} at ${local.slice(0, 7)}`);
  return { ...state, pushedSha: local };
}

const PR_FIELDS = "number,url,state,headRefOid,baseRefName";

function branchPrs(state: RunState): RemotePr[] {
  const listed = sh("gh", ["pr", "list", "--head", state.branch, "--state", "all", "--json", PR_FIELDS]);
  if (!listed.ok) throw new ToolFailure("gh pr list", listed.out);
  return JSON.parse(listed.out) as RemotePr[];
}

/** The branch's one open PR, if it matches the run; any other PR on the branch is a stop. */
function matchingPr(state: RunState, prs: RemotePr[]): RemotePr | undefined {
  if (prs.length === 0) return undefined;
  const open = prs.filter((pr) => pr.state === "OPEN");
  const problem = open.length === 1 ? prMismatch(state.pushedSha, open[0], MAIN) : prs.map((pr) => `#${pr.number} ${pr.state}`).join(", ");
  if (problem) {
    stop(state, { subject: "pull request", evidence: problem, why: "the branch's pull request does not match the recorded run", decision: "reconcile the pull request by hand, or abandon this run" });
  }
  return open[0];
}

function openPr(state: RunState): RunState {
  verifyGit(state);
  const existing = matchingPr(state, branchPrs(state));
  if (existing) {
    console.log(`  ok  PR #${existing.number} already open at ${existing.headRefOid.slice(0, 7)}`);
    return { ...state, pr: { number: existing.number, url: existing.url } };
  }
  const body = refactor ? refactorPrBody(state, state.refactor!.diff!, state.attribution?.footer) : prBody(state, state.diff!, state.attribution?.footer);
  const title = refactor ? refactorPrTitle(state) : prTitle(state);
  const result = sh("gh", ["pr", "create", "--base", MAIN, "--head", state.branch, "--title", title, "--body-file", "-"], { input: body });
  // The outcome is read back from GitHub, never inferred from the attempt.
  const created = matchingPr(state, branchPrs(state));
  if (!created) throw new ToolFailure("gh pr create", result.out || "no pull request exists for the branch after creating one");
  console.log(`  ok  opened ${created.url}`);
  return { ...state, pr: { number: created.number, url: created.url } };
}

/** The PR's CI as GitHub reports it now (classifyCi); an unreadable answer is a tool failure, not a CI result. */
function readCi(state: RunState): { status: "pending" | "failing" | "passing"; detail: string } {
  const result = sh("gh", ["pr", "checks", String(state.pr!.number), "--json", "name,bucket,state,link"]);
  try {
    return classifyCi(JSON.parse(result.out) as RemoteCheck[]);
  } catch {
    if (/no checks reported/i.test(result.out)) return classifyCi([]);
    throw new ToolFailure("gh pr checks", result.out);
  }
}

function watchCi(state: RunState): RunState {
  const minutes = Number(flag("--ci-wait") ?? 30);
  const deadline = Date.now() + minutes * 60_000;
  let current = state;
  for (;;) {
    verifyGit(current);
    const viewed = sh("gh", ["pr", "view", String(current.pr!.number), "--json", PR_FIELDS]);
    if (!viewed.ok) throw new ToolFailure("gh pr view", viewed.out);
    const problem = prMismatch(current.pushedSha, JSON.parse(viewed.out) as RemotePr, MAIN);
    if (problem) stop(current, { subject: `PR #${current.pr!.number}`, evidence: problem, why: "the pull request no longer matches the recorded run", decision: "reconcile the pull request by hand" });
    const ci = readCi(current);
    current = { ...current, ci: { ...ci, at: now() } };
    saveState(current);
    if (ci.status === "failing") {
      stop(current, { subject: `CI on PR #${current.pr!.number}`, evidence: ci.detail, why: "CI failed after local validation passed", decision: "inspect the failing check by hand; the tool adds no commits after the content and never amends" });
    }
    if (ci.status === "passing") {
      console.log(`  ok  CI: ${ci.detail}`);
      return current;
    }
    if (Date.now() >= deadline) {
      // Pending is not success: the run stays at ci and a later `run` picks it up.
      console.log(`  ..  CI pending (${ci.detail}); rerun \`map:author -- run\` to keep waiting`);
      process.exit(0);
    }
    spawnSync("sleep", ["20"]);
  }
}

async function commandRun() {
  let state = activeState();
  if (state.stop) return printStop(state);
  if (flag("--trailer") || flag("--footer")) {
    state = { ...state, attribution: { trailer: flag("--trailer") ?? state.attribution?.trailer, footer: flag("--footer") ?? state.attribution?.footer } };
  }
  const action = nextAction(state);
  if (action.kind !== "tool") return commandNext(state);
  if (dryRun) {
    const remaining = STAGES.slice(STAGES.indexOf(state.stage)).filter((stage) => stage !== "done");
    console.log(`dry run: would perform ${remaining.join(" → ")} for the ${state.domainId} ${refactor ? "refactor" : "run"}, stopping at "validated PR awaiting human merge"`);
    return;
  }
  verifyGit(state);
  clearVerifyTrees();
  // Nothing validated earlier is trusted if what it depended on has changed since.
  const invalidated = invalidate(state, { tree: treeFingerprint(state), content: contentFingerprint(state), buildId: buildId() });
  if (invalidated.reason) console.log(invalidated.reason);
  state = invalidated.state;
  saveState(state);
  while (nextAction(state).kind === "tool") {
    console.log(`${state.stage}`);
    const before = state.stage;
    try {
      state = await runStage(state);
      if (state.stage === before) throw new RunStateError(`stage ${before} did not advance`);
    } catch (error) {
      if (!(error instanceof ToolFailure)) throw error;
      // A stage saves its progress as it goes (each commit, say); stop from that, not from the stage's start.
      stop(readState(state.domainId) ?? state, { subject: error.what, evidence: tail(error.evidence), why: `${error.what} failed unexpectedly`, decision: "inspect the failure; `map:author -- resume --decision ..` and `run` once resolved" });
    }
    saveState(state);
  }
  if (state.stage === "done") console.log(`\n${refactor ? refactorCompletionReport(state, state.refactor?.diff) : completionReport(state)}`);
  else commandNext(state);
}

// ---------------------------------------------------------------- dispatch

try {
  switch (command) {
    case "domains":
      if (refactor) commandRefactorStatus();
      else commandDomains();
      break;
    case "plan":
      if (refactor) printRefactorPlan(flag("--domain") ?? fail("plan needs --domain"));
      else printPlan(flag("--domain") ?? fail("plan needs --domain"));
      break;
    case "start":
      commandStart();
      break;
    case "status":
      commandStatus();
      break;
    case "next":
      commandNext();
      break;
    case "context":
      if (refactor) commandRefactorContext();
      else commandContext();
      break;
    case "record":
      if (refactor) await commandRefactorRecord();
      else commandRecord();
      break;
    case "audit":
      commandAudit();
      break;
    case "complete":
      await commandComplete();
      break;
    case "fix":
      commandFix();
      break;
    case "stop":
      commandStop();
      break;
    case "resume":
      commandResume();
      break;
    case "run":
      await commandRun();
      break;
    case "represent":
      if (refactor) fail("represent is not a refactor command");
      try {
        commandRepresent(positional, flag, (name) => flags.has(name));
      } catch (error) {
        fail((error as Error).message, 1);
      }
      break;
    default:
      fail(`unknown command ${command ?? "(none)"}; see the header of scripts/map-author.ts or docs/map-authoring/domain-runbook.md`);
  }
} catch (error) {
  if (error instanceof MapAuthoringContextError || error instanceof RunStateError) fail(error.message, 1);
  if (error instanceof ToolFailure) fail(`${error.message}\n${tail(error.evidence)}`, 1);
  throw error;
}
