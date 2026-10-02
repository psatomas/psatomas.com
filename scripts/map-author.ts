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
//   npm run map:author -- run [--dry-run] [--until <stage>] [--trailer ".."] [--footer ".."] [--ci-wait <minutes>]
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
//   npm run map:author -- refactor review <concept-id> --decision keep --note "..."   re-review a blocked design (outside a run)
//   npm run map:author -- refactor status | next | audit | complete audit --note ".." | fix .. | stop .. | resume .. | run ..
//
// L2 authoring (docs/map-authoring/l2-authoring.md), from scripts/map-author-l2.ts:
//
//   npm run map:author -- l2 context <concept-id> [--json]
//   npm run map:author -- l2 territory <group> [--write]
//   npm run map:author -- l2 check [--group <group>] [--json]
//   npm run map:author -- l2 campaign                    every slice, the next one, and whether merging is authorized
//   npm run map:author -- l2 start --slice <id> | --pilot [--dry-run]
//   npm run map:author -- l2 record plan|design|author|audit|group-audit <subject> [--note ..] [--audit-file <json>]
//   npm run map:author -- l2 group-signals <group>       a group audit's signals
//   npm run map:author -- l2 reopen <id>[,<id>..] --reason ".."   repair drafted concepts (a counted cycle)
//   npm run map:author -- l2 sync                        merge a moved main into the run's branch and revalidate
//   npm run map:author -- l2 checkpoint --decision ".."   the pilot's human review of plans and designs
//   npm run map:author -- l2 authorize --authorization ".."   record a human's explicit campaign merge authorization
//   npm run map:author -- l2 status | next | complete audit --note .. | fix .. | stop .. | resume .. | run [--until <stage>] ..
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { mapKnowledge } from "../src/lib/map/data.ts";
import { commandRepresent } from "./map-author-represent.ts";
import { commandL2, groupSignalsOf, planReport, readPlans, signalsOf } from "./map-author-l2.ts";
import { DATA_FILE as L2_DATA_FILE, finishedConcepts, groupCommitMessage, groupCommitTrees, l2Branch, l2PrBody, l2PrTitle, l2Slices, pilotSlice, PILOT_SLICE, REGISTRY_FILE as L2_REGISTRY_FILE, repairCommitMessage, sliceRemaining, VIEW_FILE as L2_VIEW_FILE, withRecordsFrom, type L2Slice, type L2StepKind } from "../src/lib/map/authoring/l2/campaign.ts";
import { repairBaseline, repairScopeProblems } from "../src/lib/map/authoring/l2/repair.ts";
import { contentFingerprint as recordFingerprint } from "../src/lib/map/authoring/representation/design.ts";
import { groupAuditProblems, workProblems, type L2ConceptWork, type L2Design, type L2GroupAudit } from "../src/lib/map/authoring/l2/contracts.ts";
import { validateL2Diff } from "../src/lib/map/authoring/l2/diff.ts";
import { inventoryL2 } from "../src/lib/map/authoring/l2/inventory.ts";
import { driftReport } from "../src/lib/map/authoring/l2/signals.ts";
import { crossPlanProblems, groupFile, GROUPS_DIR, planProblems, staleProblems, type L2GroupFile } from "../src/lib/map/authoring/l2/territory.ts";
import { AUTHORED_CONTENT_CONCEPTS } from "../src/lib/map/authoring/content-registry.ts";
import { createMapAuthoringInspector, MapAuthoringContextError } from "../src/lib/map/authoring/context.ts";
import { formatMapConceptAuthoringContext } from "../src/lib/map/authoring/format.ts";
import type { MapKnowledgeModel } from "../src/lib/map/types.ts";
import { auditConcepts } from "../src/lib/map/authoring/orchestrator/audit.ts";
import { validateContentDiff, validateFixes } from "../src/lib/map/authoring/orchestrator/diff-check.ts";
import { planFixVerification } from "../src/lib/map/authoring/orchestrator/fix-verification.ts";
import { listDomains, nextIncompleteDomain, planDomain, renderExpectations, renderSample } from "../src/lib/map/authoring/orchestrator/plan.ts";
import { completionReport, contentCommitMessage, fixCommitMessage, prBody, prTitle, refactorCommitMessage, refactorCompletionReport, refactorPrBody, refactorPrTitle } from "../src/lib/map/authoring/orchestrator/report.ts";
import { ACCEPTED_DESIGNS_FILE, decisionProblems, designSetFingerprint, MAP_RUN_BRANCH, planRefactor, refactorBranch, refactorCampaign, resolveSpec, reviewBlockedDesign, specDiffProblems, specProblems, targetKinds, type AcceptedDesignSpec, type Decision, DECISIONS } from "../src/lib/map/authoring/representation/refactor.ts";
import { validateRefactorDiff } from "../src/lib/map/authoring/representation/refactor-diff.ts";
import {
  addFix,
  AGENT_STAGES,
  clearL2Checkpoint,
  createL2RunState,
  pendingL2Steps,
  recordL2Step,
  reopenL2,
  RepairLimitError,
  repairAllowance,
  repairLimitSubject,
  staleL2Steps,
  syncL2Base,
  unadoptableMerge,
  type ObservedAudits,
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
  else if (["--json", "--dry-run", "--write", "--pilot"].includes(arg)) flags.set(arg, true);
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
/** `l2 <command>` runs L2 slice runs (docs/map-authoring/l2-authoring.md); its read-only commands live in map-author-l2.ts. */
const l2Mode = first === "l2";
const L2_READ_ONLY = new Set(["context", "territory", "check", "signals", "group-signals", "drift"]);
const command = refactor ? (positional.shift() ?? "domains") : l2Mode ? (positional.shift() ?? "campaign") : first;
const STATE_DIR = refactor ? join(STATE_ROOT, "refactor") : l2Mode ? join(STATE_ROOT, "l2") : STATE_ROOT;
const CLI = refactor ? "map:author -- refactor" : l2Mode ? "map:author -- l2" : "map:author --";
const RUN_KIND = refactor ? "refactor" : l2Mode ? "l2" : undefined;

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
  // A run of one kind is never resumed as another.
  if (state.kind !== RUN_KIND) fail(`${statePath(domainId)} is a ${state.kind ?? "domain authoring"} run, not a ${RUN_KIND ?? "domain authoring"} run`, 1);
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
    ? readdirSync(STATE_DIR).filter((file) => file.endsWith(".json") && file !== L2_CAMPAIGN_FILE).map((file) => readState(file.slice(0, -5))!).filter((state) => state.stage !== "done")
    : [];
  if (runs.length === 0) fail(l2Mode ? `no active run; see \`${CLI} campaign\`, then \`${CLI} start --slice <id>\` or \`--pilot\`` : `no active run; see \`${CLI} domains\`, then \`${CLI} start --domain <id>\``);
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
  if (l2Mode) return commandL2Start();
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
      ...(domain.state === "no work" ? (domain.resolved ? [`${domain.resolved} re-reviewed`] : []) : [`${domain.actionable} to reconsider`, `${domain.resolved} resolved`]),
      ...(domain.blocked ? [`${domain.blocked} blocked`] : []),
      ...(domain.stale ? [`${domain.stale} STALE`] : []),
    ].join(", ");
    console.log(`${domain.ordinal} ${domain.title.padEnd(36)} ${domain.state.padEnd(9)} ${counts}`);
  }
  const blocked = spec.designs.filter((design) => design.status === "blocked" && !design.resolution);
  if (blocked.length) console.log(`\nblocked: ${blocked.map((design) => `${design.conceptId} (${design.blockedBy?.join(", ")})`).join("; ")}`);
  for (const problem of problems) console.log(`SPEC PROBLEM: ${problem}`);
  console.log(campaign.next ? `\nnext with work: ${campaign.next} (not started; run \`${CLI} start --domain ${campaign.next}\`)` : "\nevery domain's actionable designs are resolved");
}

/** Resolves a blocked design as keep after re-review: the spec is the only file written. */
function commandRefactorReview() {
  const conceptId = positional[0] ?? fail(`review needs a concept id: ${CLI} review <concept-id> --decision keep --note "..."`);
  if (flag("--decision") !== "keep") fail("a blocked design can only be re-reviewed as --decision keep; a different representation needs a new accepted design", 2);
  if (git("status", "--porcelain", "--untracked-files=no", "--", "src/lib/map/data.ts").out.trim()) fail("commit or discard content changes first", 1);
  // Uncommitted re-reviews may accumulate in the spec; any other change must be committed or discarded first.
  const [committed, working] = [readSpec("HEAD"), readSpec()];
  const reviewed = working.designs.filter((design) => design.status === "blocked" && design.resolution && !committed.designs.find((old) => old.conceptId === design.conceptId)?.resolution).map((design) => design.conceptId);
  const unrelated = specDiffProblems(committed, working, reviewed);
  if (unrelated.length) fail(`the spec has uncommitted changes other than re-reviews:\n${unrelated.join("\n")}`, 1);
  const { spec, problems } = reviewBlockedDesign(working, mapKnowledge, conceptId, flag("--note") ?? "");
  if (!spec) fail(problems.join("\n"), 1);
  writeFileSync(join(ROOT, ACCEPTED_DESIGNS_FILE), `${JSON.stringify(spec, null, 2)}\n`);
  console.log(`${conceptId}: blocked design re-reviewed and resolved as keep in ${ACCEPTED_DESIGNS_FILE}; the record is unchanged`);
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

// ---------------------------------------------------------------- L2 slice runs

/** Local campaign state: the human's merge authorization, if any. Never committed. */
const L2_CAMPAIGN_FILE = "campaign.json";
type L2Campaign = { mergeAuthorization?: { at: string; authorization: string } };
const campaignPath = () => join(STATE_ROOT, "l2", L2_CAMPAIGN_FILE);
const readCampaign = (): L2Campaign => (existsSync(campaignPath()) ? (JSON.parse(readFileSync(campaignPath(), "utf8")) as L2Campaign) : {});
const PILOT_FILE = "src/lib/map/authoring/l2/pilot.json";
const l2Records = (state: RunState) => state.l2!;

/** The run's records and the fingerprints its audits are bound to, as the working tree holds them. */
function observedAudits(state: RunState): ObservedAudits {
  const plans = readPlans();
  const concepts = state.l2!.slice.groups.flatMap((group) => group.concepts);
  const workOf = (conceptId: string) => plans.flatMap((plan) => Object.entries(plan.concepts ?? {})).find(([id]) => id === conceptId)?.[1] as L2ConceptWork | undefined;
  return {
    records: Object.fromEntries(concepts.map((conceptId) => [conceptId, recordOf(conceptId) ? recordFingerprint(recordOf(conceptId)) : undefined])),
    conceptAudits: Object.fromEntries(concepts.map((conceptId) => [conceptId, workOf(conceptId)?.audit?.recordFingerprint])),
    groupAudits: Object.fromEntries(state.l2!.slice.groups.map((group) => [group.group, (plans.find((plan) => plan.group === group.group) as (L2GroupFile & { groupAudit?: L2GroupAudit }) | undefined)?.groupAudit?.records])),
  };
}
const recordOf = (conceptId: string) => mapKnowledge.content.find((entry) => entry.conceptId === conceptId);

function campaignSlices(): { slices: L2Slice[]; finished: Set<string> } {
  return { slices: l2Slices(mapKnowledge), finished: finishedConcepts(mapKnowledge, readPlans()) };
}

function commandL2Campaign() {
  const { slices, finished } = campaignSlices();
  const rows = slices.map((slice) => ({ slice, remaining: sliceRemaining(slice, finished).length, total: slice.groups.reduce((sum, group) => sum + group.concepts.length, 0) }));
  if (flags.has("--json")) return console.log(JSON.stringify(rows.map((row) => ({ id: row.slice.id, groups: row.slice.groups.map((group) => group.group), remaining: row.remaining, total: row.total })), null, 2));
  for (const row of rows) console.log(`${row.slice.ordinal} ${row.slice.id.padEnd(40)} ${row.remaining === 0 ? "complete" : `${row.total - row.remaining}/${row.total}`.padEnd(8)} ${row.slice.groups.length} group(s)`);
  const next = rows.find((row) => row.remaining > 0);
  const campaign = readCampaign();
  const l2Total = rows.reduce((sum, row) => sum + row.total, 0);
  console.log(`\n${rows.filter((row) => row.remaining === 0).length}/${rows.length} slices complete; ${l2Total - rows.reduce((sum, row) => sum + row.remaining, 0)}/${l2Total} L2 concepts finished`);
  console.log(next ? `next: ${next.slice.id} (\`${CLI} start --slice ${next.slice.id}\`)` : "every slice is complete");
  console.log(`merging: ${campaign.mergeAuthorization ? `authorized ${campaign.mergeAuthorization.at}: ${campaign.mergeAuthorization.authorization}` : "not authorized; each validated PR awaits human merge"}`);
}

function commandL2Authorize() {
  const authorization = flag("--authorization") ?? fail('authorize needs --authorization "<the human\'s explicit campaign authorization, quoted>"');
  mkdirSync(dirname(campaignPath()), { recursive: true });
  writeFileSync(campaignPath(), `${JSON.stringify({ ...readCampaign(), mergeAuthorization: { at: now(), authorization } }, null, 2)}\n`);
  console.log("recorded the campaign's merge authorization; runs started from now merge their own validated PRs (never the pilot)");
}

function commandL2Start() {
  const inventory = inventoryL2(mapKnowledge);
  if (inventory.problems.length) fail(`the L2 inventory has problems; resolve them first:\n  ${inventory.problems.join("\n  ")}`, 1);
  const { slices, finished } = campaignSlices();
  let slice: L2Slice;
  if (flags.has("--pilot")) {
    if (!existsSync(join(ROOT, PILOT_FILE))) fail(`no pilot definition at ${PILOT_FILE}`, 1);
    slice = pilotSlice(mapKnowledge, (JSON.parse(readFileSync(join(ROOT, PILOT_FILE), "utf8")) as { groups: string[] }).groups);
  } else {
    const id = flag("--slice") ?? fail(`start needs --slice <id> or --pilot; see \`${CLI} campaign\``);
    slice = slices.find((candidate) => candidate.id === id) ?? fail(`unknown slice ${id}; see \`${CLI} campaign\``, 1);
  }
  const remaining = sliceRemaining(slice, finished);
  const branch = l2Branch(slice);
  const existing = readState(slice.id);
  if (existing && existing.stage !== "done") {
    console.log(`a run for ${slice.id} already exists; resuming it`);
    return commandStatus(existing);
  }
  const problems = [...(remaining.length ? [] : [`${slice.id} has nothing left to author`]), ...observeStart(branch, slice.id).filter((problem) => !(existing && /already exists/.test(problem)))];
  for (const group of slice.groups) console.log(`  ${group.group.padEnd(48)} ${group.concepts.filter((conceptId) => remaining.includes(conceptId)).join(", ") || "(done)"}`);
  if (problems.length) {
    console.log(`\ncannot start ${slice.id}:\n  ${problems.join("\n  ")}`);
    process.exit(1);
  }
  if (dryRun) return console.log(`\ndry run: would create ${branch} and author ${remaining.length} concept(s)`);
  const baseSha = branchFromMain(branch);
  if (!baseSha) return;
  const pilot = slice.id === PILOT_SLICE;
  let state = createL2RunState({ slice, remaining, branch, baseSha, now: now(), pilot });
  const authorization = readCampaign().mergeAuthorization;
  // The pilot always ends at a PR for detailed human review, whatever the campaign authorizes.
  if (authorization && !pilot) state = { ...state, l2: { ...state.l2!, mergeAuthorized: authorization } };
  saveState(state);
  console.log(`\nstarted ${slice.id} on ${branch} at ${baseSha.slice(0, 7)}${state.l2!.mergeAuthorized ? " (merge authorized)" : ""}`);
  console.log(`next: ${(nextAction(state) as { message: string }).message}`);
}

function planOf(group: string): L2GroupFile {
  const plan = readPlans().find((candidate) => candidate.group === group);
  return plan ?? fail(`no plan for ${group}: \`${CLI} territory ${group} --write\``, 1);
}

/** Validates one judgment step against the repository, then records it; a failed validation changes nothing. */
async function commandL2Record() {
  let state = activeState();
  if (state.stop) return printStop(state);
  verifyGit(state);
  const kind = positional[0] as L2StepKind;
  const subject = positional[1] ?? fail("record needs <plan|design|author|audit|group-audit> <subject>");
  const record = l2Records(state);
  const group = kind === "plan" || kind === "group-audit" ? subject : record.slice.groups.find((entry) => entry.concepts.includes(subject))?.group;
  if (!group) fail(`${subject} is not a concept of this slice`, 1);
  const plans = readPlans();
  const plan = planOf(group);
  const refuse = (problems: string[]) => problems.length && fail(`cannot record ${kind} ${subject}:\n  ${problems.join("\n  ")}`, 1);
  const repair = record.repair;
  // A repair stays within the territory, models and designs it was reopened with, except what it re-records.
  const scope = (extra: { redesigned?: string[]; replanned?: string[] } = {}) =>
    repair
      ? repairScopeProblems({
          baseline: repair.baseline,
          reopened: repair.concepts,
          plans,
          redesigned: new Set([...repair.concepts.filter((conceptId) => (state.l2!.steps[`design:${conceptId}`]?.at ?? "") >= repair.at), ...(extra.redesigned ?? [])]),
          replanned: new Set([...repair.groups.filter((entry) => (state.l2!.steps[`plan:${entry}`]?.at ?? "") >= repair.at), ...(extra.replanned ?? [])]),
        })
      : [];
  const auditFile = flag("--audit-file");
  if (auditFile && (kind === "audit" || kind === "group-audit")) writeAudit(kind, subject, group, auditFile);
  let blocks = false;
  let fingerprint: string | undefined;
  switch (kind) {
    case "plan":
      refuse([...planProblems(plan, mapKnowledge), ...staleProblems(plan, mapKnowledge).map((problem) => `stale: ${problem}`), ...crossPlanProblems(plans, inventoryL2(mapKnowledge)).filter((problem) => problem.includes(group) || plan.members.some((member) => problem.startsWith(`${member.conceptId}:`))), ...scope({ replanned: [group] })]);
      break;
    case "design":
      refuse([...staleProblems(plan, mapKnowledge).map((problem) => `the plan is stale: ${problem}`), ...workProblems(plan, subject, mapKnowledge, "designed"), ...scope({ redesigned: [subject] })]);
      blocks = (plan.concepts[subject] as L2ConceptWork).design.decision === "block";
      break;
    case "author": {
      const registration = createMapAuthoringInspector(mapKnowledge).inspectConcept(subject).registration;
      if (registration !== "registered") fail(`the inspector reports ${subject} as ${registration}; add its record and registry entry first`, 1);
      refuse([...staleProblems(plan, mapKnowledge).map((problem) => `the plan is stale: ${problem}`), ...workProblems(plan, subject, mapKnowledge, "authored"), ...scope()]);
      fingerprint = recordFingerprint(recordOf(subject));
      const generated = sh("npm", ["run", "--silent", "map:generate"]);
      if (!generated.ok) fail(`map:generate failed\n${tail(generated.out)}`, 1);
      const focused = sh("node", ["--test", ...FOCUSED_TESTS]);
      if (!focused.ok) fail(`focused tests failed (${testCounts(focused.out)})\n${tail(focused.out, 40)}`, 1);
      break;
    }
    case "audit": {
      fingerprint = recordFingerprint(recordOf(subject));
      const drafted = state.l2!.steps[`author:${subject}`]?.fingerprint;
      // An audit that found a defect reopens the concept: a record edited in place would be a repair nobody counted.
      if (drafted && drafted !== fingerprint) refuse([`${subject}'s record changed since it was drafted: an audit that finds a defect reopens it (\`${CLI} reopen ${subject} --reason ..\`), then it is drafted and audited again`]);
      refuse([...workProblems(plan, subject, mapKnowledge, "audited", signalsOf(subject, plans).map((signal) => signal.id)), ...scope()]);
      break;
    }
    case "group-audit":
      refuse([...groupAuditProblems(plan as L2GroupFile & { groupAudit?: L2GroupAudit }, mapKnowledge, groupSignalsOf(plan).map((signal) => signal.id)), ...scope()]);
      break;
    default:
      fail("record needs <plan|design|author|audit|group-audit> <subject>");
  }
  try {
    state = recordL2Step(state, { kind, subject }, now(), { blocks, note: flag("--note"), fingerprint });
  } catch (error) {
    if (error instanceof RunStateError) fail(error.message, 1);
    throw error;
  }
  saveState(state);
  console.log(`recorded ${kind} ${subject}; ${pendingL2Steps(state).length} step(s) to go`);
  if (blocks) {
    const design = (plan.concepts[subject] as L2ConceptWork).design as L2Design;
    stop(state, {
      subject: `representation gap: ${subject}`,
      evidence: `${design.gap?.structure}: ${design.gap?.reason}`,
      why: "a relationship the concept needs has no primitive and prose cannot carry it accurately",
      decision: `leave ${subject} unauthored in this run (\`${CLI} resume --decision ..\`), or change its design`,
    });
  }
  commandNext(state);
}

/**
 * Writes an audit into its group file, bound to exactly the records as they
 * are now: a concept audit to its record's fingerprint, a group audit to
 * every owned member's. The file holds { note, resolutions }. Recording
 * then validates it like any audit.
 */
function writeAudit(kind: "audit" | "group-audit", subject: string, group: string, file: string) {
  const input = JSON.parse(readFileSync(file, "utf8")) as { note?: string; resolutions?: { id: string; resolution: string }[] };
  const path = join(ROOT, groupFile(group));
  const plan = JSON.parse(readFileSync(path, "utf8")) as L2GroupFile & { groupAudit?: L2GroupAudit };
  const audit = { at: now(), note: input.note ?? "", resolutions: input.resolutions ?? [] };
  if (kind === "audit") (plan.concepts[subject] as L2ConceptWork).audit = { ...audit, recordFingerprint: recordFingerprint(recordOf(subject)) };
  else {
    const owned = plan.members.filter((member) => member.standing === "owned").map((member) => member.conceptId);
    plan.groupAudit = { ...audit, records: Object.fromEntries(owned.map((conceptId) => [conceptId, recordFingerprint(recordOf(conceptId))])) };
  }
  writeFileSync(path, `${JSON.stringify(plan, null, 2)}\n`);
}

/**
 * Reopens drafted concepts for repair (reopenL2): after their audit, their
 * group's audit, or a human review of the run's PR. A concept past its
 * repair allowance stops the run for a human.
 */
function commandL2Reopen() {
  let state = activeState();
  if (state.stop) return printStop(state);
  verifyGit(state);
  const concepts = (positional[0] ?? fail(`reopen needs concept ids: ${CLI} reopen <id>[,<id>..] --reason ".."`)).split(",").map((conceptId) => conceptId.trim()).filter(Boolean);
  const reason = flag("--reason") ?? fail("reopen needs --reason: the finding the repair answers");
  try {
    state = reopenL2(state, { concepts, reason, baseline: repairBaseline(readPlans(), concepts), now: now() });
  } catch (error) {
    if (error instanceof RepairLimitError) {
      const [conceptId] = error.conceptIds;
      stop(state, {
        subject: repairLimitSubject(conceptId),
        evidence: `${conceptId} was reopened in ${state.l2!.repairs[conceptId] ?? 0} repair cycle(s), its allowance (${repairAllowance(state, conceptId)}); this repair: ${reason}`,
        why: "a concept still failing after its repairs needs a human look at the concept, its plan or its design",
        decision: `inspect ${conceptId}; \`${CLI} resume --decision ..\` allows one more repair cycle, or change its plan or design first`,
      });
    }
    if (error instanceof RunStateError) fail(error.message, 1);
    throw error;
  }
  saveState(state);
  console.log(`reopened ${concepts.join(", ")} in repair cycle ${state.l2!.repair!.cycle}: ${state.l2!.repair!.reason}`);
  commandNext(state);
}

/**
 * Adopts a merge of main already at HEAD as the run's synchronization
 * (unadoptableMerge), after the same check `sync` makes before merging:
 * main changed none of the run's files.
 */
function adoptMerge(state: RunState) {
  const parents = gitOut("rev-list", "--parents", "-n", "1", "HEAD").split(" ").slice(1);
  const merged = parents.length === 2 ? git("merge-tree", "--write-tree", parents[0], parents[1]) : undefined;
  const problem = unadoptableMerge(state, {
    parents,
    secondParentInMain: parents.length === 2 && git("merge-base", "--is-ancestor", parents[1], `origin/${MAIN}`).ok,
    cleanMerge: Boolean(merged?.ok && lines(merged.out)[0] === gitOut("rev-parse", "HEAD^{tree}")),
    trackedChanges: trackedChanges(),
  });
  if (problem) fail(`HEAD is not the run's recorded head, nor a merge of ${MAIN} it can adopt: ${problem}`, 1);
  const runFiles = lines(gitOut("diff", "--no-renames", "--name-only", state.baseSha, parents[0]));
  const touched = lines(gitOut("diff", "--no-renames", "--name-only", state.baseSha, parents[1])).filter((file) => runFiles.includes(file));
  if (touched.length) fail(`the merged ${MAIN} changed files this run changes (${touched.join(", ")}); decide by hand`, 1);
  state = syncL2Base(state, { base: parents[1], merge: head(), now: now() });
  saveState(state);
  console.log(`adopted ${head().slice(0, 7)} as the merge of ${MAIN} (${parents[1].slice(0, 7)}); the run revalidates from ${state.stage}`);
  commandNext(state);
}

/**
 * Brings a moved main into an open run: merges origin/main into the run's
 * branch (never a rebase or a force-push), and rebases the run's
 * validation on it. Refused when main changed a file the run changes.
 */
function commandL2Sync() {
  let state = activeState();
  if (state.stop) return printStop(state);
  gitOut("fetch", "--quiet", "origin", MAIN);
  if (currentBranch() === state.branch && head() !== (state.commits.at(-1)?.sha ?? state.baseSha)) return adoptMerge(state);
  verifyGit(state);
  if (trackedChanges().length) fail(`commit or reopen nothing first: sync merges into a clean tree (uncommitted: ${trackedChanges().join(", ")})`, 1);
  const target = remoteSha(`refs/heads/${MAIN}`)!;
  if (git("merge-base", "--is-ancestor", target, "HEAD").ok) return console.log(`${state.branch} already contains origin/${MAIN} at ${target.slice(0, 7)}`);
  const runFiles = lines(gitOut("diff", "--no-renames", "--name-only", state.baseSha, "HEAD"));
  const touched = lines(gitOut("diff", "--no-renames", "--name-only", state.baseSha, target)).filter((file) => runFiles.includes(file));
  if (touched.length) fail(`origin/${MAIN} changed files this run changes (${touched.join(", ")}): merging would mix them into the run's content; decide by hand`, 1);
  try {
    syncL2Base({ ...state }, { base: target, merge: "pending", now: now() });
  } catch (error) {
    if (error instanceof RunStateError) fail(error.message, 1);
    throw error;
  }
  const message = `Merge origin/${MAIN} into ${state.branch}${state.attribution?.trailer ? `\n\n${state.attribution.trailer}` : ""}`;
  const merged = sh("git", ["merge", "--no-ff", "--quiet", "-m", message, `origin/${MAIN}`]);
  if (!merged.ok) {
    git("merge", "--abort");
    fail(`merging origin/${MAIN} failed; nothing changed:\n${tail(merged.out)}`, 1);
  }
  state = syncL2Base(state, { base: target, merge: head(), now: now() });
  saveState(state);
  console.log(`merged origin/${MAIN} (${target.slice(0, 7)}) into ${state.branch} as ${head().slice(0, 7)}; the run revalidates from ${state.stage}`);
  commandNext(state);
}

function commandL2Checkpoint() {
  let state = activeState();
  const decision = flag("--decision") ?? fail('checkpoint needs --decision "<the human review decision on the plans and designs>"');
  try {
    state = clearL2Checkpoint(state, decision, now());
  } catch (error) {
    if (error instanceof RunStateError) fail(error.message, 1);
    throw error;
  }
  saveState(state);
  console.log("checkpoint cleared: drafting may begin");
  commandNext(state);
}

/** The slice's authored records in order, for the drift check that closes its audit. */
function sliceDrift(state: RunState) {
  const authored = state.plan.eligible.filter((conceptId) => !state.l2!.blocked.includes(conceptId) && recordOf(conceptId));
  return driftReport(authored.map((conceptId) => ({ title: mapKnowledge.concepts.find((concept) => concept.id === conceptId)!.title, record: recordOf(conceptId)! })));
}

/** Concepts an L2 run authored: every concept of the slice its design does not block. */
const l2Authored = (state: RunState) => state.plan.eligible.filter((conceptId) => !state.l2!.blocked.includes(conceptId));

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
    ...(state.l2
      ? [
          `slice ${state.l2.slice.id}: ${state.l2.slice.groups.map((group) => group.group).join(", ")}`,
          `steps recorded: ${Object.keys(state.l2.steps).length}; next steps: ${pendingL2Steps(state).slice(0, 4).map((step) => `${step.kind} ${step.subject}`).join(", ") || "none"}`,
          `blocked: ${state.l2.blocked.join(", ") || "none"}; repair cycles: ${Object.entries(state.l2.repairs).map(([conceptId, count]) => `${conceptId} ${count}`).join(", ") || "none"}`,
          ...(state.l2.repair ? [`repair open: cycle ${state.l2.repair.cycle} (${state.l2.repair.concepts.join(", ")}): ${state.l2.repair.reason}`] : []),
          ...(state.l2.history ?? []).map((entry) => (entry.kind === "repair" ? `history: repair cycle ${entry.cycle} (${entry.concepts.join(", ")}) closed ${entry.closedAt}` : `history: merged main ${entry.from.slice(0, 7)} → ${entry.to.slice(0, 7)} at ${entry.merge.slice(0, 7)}`)),
          ...staleL2Steps(state, observedAudits(state)).map((entry) => `STALE ${entry.step}: ${entry.reason}; reopen the concept to repair and re-audit it`),
          ...(state.l2.checkpoint ? [`checkpoint: ${state.l2.checkpoint.clearedAt ? `cleared ${state.l2.checkpoint.clearedAt}: ${state.l2.checkpoint.decision}` : "holds drafting until a human review"}`] : []),
          `merging: ${state.l2.mergeAuthorized ? `authorized (${state.l2.mergeAuthorized.authorization})` : "awaits human merge"}${state.l2.merged ? `; merged ${state.l2.merged.sha.slice(0, 7)}` : ""}`,
        ]
      : []),
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
  if (action.kind === "done") console.log(state.l2?.merged ? `next: nothing; merged as ${state.l2.merged.sha.slice(0, 7)}; \`${CLI} campaign\` names the next slice` : `next: nothing; the PR awaits human merge`);
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
  if (l2Mode && stage === "audit") {
    // A convergence signal across the whole slice pauses the campaign for calibration, once.
    const drift = sliceDrift(state);
    if (drift.signals.length && !(state.resolvedStops ?? []).some((resolved) => resolved.subject === "slice drift")) {
      stop(state, { subject: "slice drift", evidence: drift.signals.map((signal) => signal.detail).join("\n"), why: "the slice's records converge on one opening, opener, length or form: precedent may be standing in for decisions", decision: "review the flagged records against their designs, correct any that copied precedent, then resume with the calibration decision" });
    }
  }
  try {
    state = completeStage(state, stage, now(), note);
  } catch (error) {
    if (error instanceof RunStateError) fail(error.message, 1);
    throw error;
  }
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

/** Run files that git does not track yet: a declared fix's new test file, say, or an L2 run's new group files. */
const untrackedFixFiles = (state: RunState) => {
  const untracked = new Set(lines(gitOut("ls-files", "--others", "--exclude-standard")));
  const groupFiles = state.l2 ? state.l2.slice.groups.map((group) => groupFile(group.group)) : [];
  return [...state.fixes.flatMap((fix) => fix.files), ...groupFiles].filter((file) => untracked.has(file));
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
    // An L2 run's audit also judged its group files: plans, models, designs and audits.
    .update(state.l2 ? state.l2.slice.groups.map((group) => (existsSync(join(ROOT, groupFile(group.group))) ? readFileSync(join(ROOT, groupFile(group.group)), "utf8") : "")).join("\0") : "")
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
/** An L2 run's own gate: every plan valid and current, and each run group's work complete and audited. */
const L2_GATE: Gate = {
  name: "l2-check",
  label: "L2 plans and concept work",
  run: (state) => {
    const groups = state.l2!.slice.groups.map((group) => group.group);
    const missing = groups.filter((group) => !existsSync(join(ROOT, groupFile(group))));
    if (missing.length) return { ok: false, status: 1, out: `no plan for ${missing.join(", ")}` };
    const report = planReport(readPlans(), groups);
    const problems = report.flatMap((entry) => [...entry.problems, ...entry.stale.map((problem) => `stale: ${problem}`)].map((problem) => `${entry.group}: ${problem}`));
    return { ok: problems.length === 0, status: problems.length ? 1 : 0, out: problems.length ? problems.join("\n") : `${groups.length} group(s) valid, current and audited` };
  },
  detail: (result) => result.out,
};

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
      for (const gate of l2Mode ? [...GATES, L2_GATE] : GATES) {
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
      const concepts = refactor ? changedConcepts(state) : l2Mode ? l2Authored(state) : state.plan.eligible;
      if (concepts.length === 0) return completeStage(check(state, "render", { ok: true, status: 0, out: "" }, "no changed record to render", "render verification", ""), "render", at);
      const targets = renderExpectations(mapKnowledge, concepts);
      const report = await checkRender(concepts);
      const evidence = formatRenderFailures(report);
      const placements = targets.reduce((sum, target) => sum + target.placements.length, 0);
      const detail = `${report.renders} renders across ${placements} placements`;
      const rendered = check(state, "render", { ok: report.ok, status: report.ok ? 0 : 1, out: evidence }, detail, "render verification", "an authored concept renders incorrectly at one of its placements");
      if (!l2Mode) return completeStage(rendered, "render", at);
      // L2 also enters every L2 placement the way a reader does: from its parent, by activating the row.
      const { checkExpansion, formatExpansionFailures } = await import("../e2e/map/l2-expansion.mts");
      const expansion = await checkExpansion(concepts);
      const expanded = check(rendered, "expansion", { ok: expansion.ok, status: expansion.ok ? 0 : 1, out: formatExpansionFailures(expansion) }, `${expansion.expansions} expansions`, "L2 expansion", "an authored concept does not open correctly from one of its parents");
      return completeStage(expanded, "render", at);
    }
    case "diff": {
      const base = await modelAt(state.baseSha);
      const files = changedFiles(state);
      if (l2Mode) return completeStage(await diffL2(state, base, files, check, at, tree), "diff", at);
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
      return completeStage(l2Mode ? commitL2(state) : commit(state), "commit", at);
    case "push":
      return completeStage(push(state), "push", at);
    case "pr":
      return completeStage(openPr(state), "pr", at);
    case "ci":
      return completeStage(watchCi(state), "ci", at);
    case "merge":
      return completeStage(mergeL2(state), "merge", at);
    default:
      throw new RunStateError(`${stage} is not a tool stage`);
  }
}

/** Every plan as committed at a revision. */
function plansAt(sha: string): L2GroupFile[] {
  const listed = git("ls-tree", "--name-only", sha, `${GROUPS_DIR}/`);
  if (!listed.ok) return [];
  return lines(listed.out).filter((file) => file.endsWith(".json")).map((file) => JSON.parse(gitOut("show", `${sha}:${file}`)) as L2GroupFile);
}

/** The L2 diff boundary (validateL2Diff); validated files are written as blobs so group commits can be rebuilt from them. */
async function diffL2(state: RunState, base: { model: MapKnowledgeModel; registry: readonly string[] }, files: string[], check: CheckFn, at: string, tree: string): Promise<RunState> {
  const headPlans = readPlans();
  const groups = state.l2!.slice.groups.map((group) => group.group);
  const authored = l2Authored(state);
  const report = validateL2Diff({
    base: base.model,
    head: mapKnowledge,
    baseView: JSON.parse(gitOut("show", `${state.baseSha}:${VIEW_FILE}`)),
    headView: JSON.parse(readFileSync(join(ROOT, VIEW_FILE), "utf8")),
    baseRegistry: base.registry,
    headRegistry: AUTHORED_CONTENT_CONCEPTS,
    changedFiles: files,
    data: fileDiff(state, "src/lib/map/data.ts"),
    registry: fileDiff(state, "src/lib/map/authoring/content-registry.ts"),
    fixes: state.fixes,
    fixLines: fixLines(state, state.fixes.flatMap((fix) => fix.files)),
    groups,
    basePlans: plansAt(state.baseSha),
    headPlans,
    signals: Object.fromEntries(authored.filter((conceptId) => recordOf(conceptId)).map((conceptId) => [conceptId, signalsOf(conceptId, headPlans).map((signal) => signal.id)])),
    groupSignals: Object.fromEntries(headPlans.filter((plan) => groups.includes(plan.group)).map((plan) => [plan.group, groupSignalsOf(plan).map((signal) => signal.id)])),
  });
  if (!report.ok) {
    stop(recordCheck(state, "diff", false, `FAILED: ${report.problems.length} problem(s)`, at, tree), {
      subject: "L2 diff",
      evidence: report.problems.join("\n"),
      why: "the diff contains more, less or other than the slice's planned, designed and audited concepts",
      decision: "revert the unexpected change, or decide how the run should treat it",
    });
  }
  const verified = await verifyFixesAlone(state, check);
  // Written into the object store, so a group commit can be rebuilt from exactly the validated content.
  const validatedFiles = Object.fromEntries(files.map((file) => [file, existsSync(join(ROOT, file)) ? gitOut("hash-object", "-w", "--", file) : DELETED]));
  const recorded = check(verified, "diff", { ok: true, status: 0, out: "" }, `${report.authored.length} records, ${report.blocked.length} blocked, ${report.flipped.length} hasContent flips, ${files.length} files`, "L2 diff", "");
  return { ...recorded, validatedFiles, diff: report, l2: { ...recorded.l2!, diff: { authored: report.authored, blocked: report.blocked, flipped: report.flipped } } };
}

/** Stages exactly the candidate files that exist or are tracked, and commits them; anything else staged is a stop. */
function commitStaged(state: RunState, candidates: string[], message: string): RunState {
  // A later group's file does not exist yet in an earlier group's tree: stage only what exists or is tracked.
  const files = candidates.filter((file) => existsSync(join(ROOT, file)) || blobAt("HEAD", file) !== DELETED);
  gitOut("add", "--all", "--", ...files);
  const staged = lines(gitOut("diff", "--cached", "--no-renames", "--name-only")).sort();
  if (!staged.length) stop(state, { subject: "staging", evidence: `nothing staged for ${message.split("\n")[0]}`, why: "every commit carries its group's change", decision: "inspect the tree; nothing more has been committed" });
  if (staged.some((file) => !files.includes(file))) stop(state, { subject: "staging", evidence: `staged ${staged.join(", ")}; expected only ${files.join(", ")}`, why: "only the group's intended files may be staged", decision: "inspect the index" });
  const committed = sh("git", ["commit", "--quiet", "-F", "-"], { input: message });
  if (!committed.ok) throw new ToolFailure("git commit", committed.out);
  const next = { ...state, commits: [...state.commits, { sha: head(), message, files: staged }] };
  saveState(next);
  console.log(`  ok  commit ${head().slice(0, 7)} ${message.split("\n")[0]}`);
  return next;
}

const blobText = (hash: string | undefined) => (hash && hash !== DELETED ? spawnSync("git", ["cat-file", "blob", hash], { cwd: ROOT, encoding: "utf8", maxBuffer: 1 << 28 }).stdout : "");

/** HEAD must be exactly the validated tree, measured from the base, with nothing left uncommitted. */
function assertComposition(state: RunState) {
  const composition = compositionProblems(state.validatedFiles!, { files: lines(gitOut("diff", "--no-renames", "--name-only", state.baseSha, "HEAD")), blobAtHead: (file) => blobAt("HEAD", file) });
  if (composition.length || trackedChanges().length) {
    stop(state, { subject: "commits", evidence: `${composition.join("; ") || "commits match validation"}; left uncommitted: ${trackedChanges().join(", ") || "none"}`, why: "the commits do not compose to the validated tree", decision: "inspect the commits; nothing has been pushed" });
  }
}

/**
 * Commits each declared fix, then one commit per ownership group, each the
 * exact tree after that group; proves they compose to the validated tree.
 * Once those exist, later content is a repair: one commit per repaired
 * group on top, carrying only that group's repaired records and its group
 * file. Every commit is a fast-forward; nothing is amended.
 */
function commitL2(state: RunState): RunState {
  const validated = state.validatedFiles!;
  const drifted = Object.entries(validated).filter(([file, hash]) => worktreeBlob(file) !== hash).map(([file]) => file);
  const record = state.l2!;
  const firstCommitsDone = Boolean(record.committed || state.pushedSha);
  if ((state.commits.length === 0 || firstCommitsDone) && drifted.length) {
    stop(state, { subject: "working tree", evidence: `changed since validation: ${drifted.join(", ")}`, why: "commits must reproduce the validated tree exactly", decision: "revert the later change, or keep it: `resume --decision ..` then `run` revalidates from the gates" });
  }
  if (lines(gitOut("diff", "--cached", "--name-only")).length) stop(state, { subject: "index", evidence: gitOut("diff", "--cached", "--name-only"), why: "files were staged outside the run", decision: "unstage them (`git restore --staged`)" });
  if (firstCommitsDone) return commitL2Repair(state);
  const groups = record.slice.groups.map((group) => ({ group: group.group, title: group.title, authored: group.concepts.filter((conceptId) => !record.blocked.includes(conceptId)), blocked: group.concepts.filter((conceptId) => record.blocked.includes(conceptId)), file: groupFile(group.group) }));
  const contentFiles = [L2_DATA_FILE, L2_REGISTRY_FILE, L2_VIEW_FILE, ...groups.map((group) => group.file)];
  // Read untrimmed: the validated blobs and base files keep their final newlines.
  const final = Object.fromEntries(contentFiles.map((file) => [file, blobText(validated[file])]));
  const baseFiles = Object.fromEntries(contentFiles.map((file) => [file, git("cat-file", "-e", `${state.baseSha}:${file}`).ok ? spawnSync("git", ["show", `${state.baseSha}:${file}`], { cwd: ROOT, encoding: "utf8", maxBuffer: 1 << 28 }).stdout : undefined]));
  const { problems, trees } = groupCommitTrees({ model: mapKnowledge, groups, final, base: baseFiles });
  if (problems.length) stop(state, { subject: "group commits", evidence: problems.join("\n"), why: "the validated tree cannot be split into whole groups", decision: "inspect data.ts and the registry; nothing has been committed" });
  let current = state;
  for (const fix of state.fixes.slice(current.commits.length)) current = commitStaged(current, fix.files, fixCommitMessage(fix, state.attribution?.trailer));
  for (let index = current.commits.length - state.fixes.length; index < groups.length; index++) {
    for (const [file, text] of Object.entries(trees[index])) {
      if (text === undefined) rmSync(join(ROOT, file), { force: true });
      else {
        mkdirSync(dirname(join(ROOT, file)), { recursive: true });
        writeFileSync(join(ROOT, file), text);
      }
    }
    current = commitStaged(current, contentFiles, groupCommitMessage(groups[index], state.attribution?.trailer));
  }
  assertComposition(current);
  return current;
}

/** After the first commits: the open repair, one commit per repaired group; without one, HEAD must already be the validated tree. */
function commitL2Repair(state: RunState): RunState {
  const record = state.l2!;
  const changed = trackedChanges();
  const repair = record.repair;
  if (changed.length && !repair) stop(state, { subject: "uncommitted content", evidence: changed.join(", "), why: "content changed on top of the run's commits outside a repair", decision: `reopen the concepts concerned (\`${CLI} reopen ..\`), or revert the change` });
  let current = state;
  if (changed.length && repair) {
    const groups = record.slice.groups.filter((group) => repair.groups.includes(group.group));
    const allowed = [L2_DATA_FILE, ...groups.map((group) => groupFile(group.group))];
    const outside = changed.filter((file) => !allowed.includes(file));
    if (outside.length) stop(state, { subject: "repair scope", evidence: `changed outside the repaired records and group files: ${outside.join(", ")}`, why: "a repair changes only its reopened records and their groups' files", decision: "revert those files, or reopen what they belong to" });
    const final = blobText(state.validatedFiles![L2_DATA_FILE]);
    let data = spawnSync("git", ["show", `HEAD:${L2_DATA_FILE}`], { cwd: ROOT, encoding: "utf8", maxBuffer: 1 << 28 }).stdout;
    for (const group of groups) {
      const repaired = group.concepts.filter((conceptId) => repair.concepts.includes(conceptId));
      data = withRecordsFrom(data, final, repaired);
      writeFileSync(join(ROOT, L2_DATA_FILE), data);
      writeFileSync(join(ROOT, groupFile(group.group)), blobText(state.validatedFiles![groupFile(group.group)]));
      current = commitStaged(current, [L2_DATA_FILE, groupFile(group.group)], repairCommitMessage({ title: group.title, repaired }, repair, state.attribution?.trailer));
    }
    if (data !== final) {
      writeFileSync(join(ROOT, L2_DATA_FILE), final);
      stop(current, { subject: "repair scope", evidence: "data.ts differs from the validated tree outside the reopened records", why: "a repair changes only its reopened records", decision: "the validated data.ts is restored in the working tree; reopen the other records concerned, or revert them" });
    }
  }
  assertComposition(current);
  if (!changed.length) console.log("  ok  no repair to commit: HEAD is the validated tree");
  return current;
}

function l2Body(state: RunState): string {
  const record = state.l2!;
  return l2PrBody({
    slice: record.slice,
    groups: record.slice.groups.map((group) => ({ group: group.group, title: group.title, authored: group.concepts.filter((conceptId) => !record.blocked.includes(conceptId)), blocked: group.concepts.filter((conceptId) => record.blocked.includes(conceptId)) })),
    checks: Object.fromEntries(Object.entries(state.checks).map(([name, entry]) => [name, { ok: entry.ok, detail: entry.detail }])),
    fixes: state.fixes,
    auditNotes: state.auditNotes,
    history: record.history,
    footer: state.attribution?.footer,
  });
}

/**
 * Merges the run's own PR, only under a human's recorded campaign
 * authorization, and only when it is exactly the validated run: open against
 * main at the pushed commit, cleanly mergeable, CI passing and its files the
 * validated set. Then main is synchronized and must contain the pushed head.
 */
function mergeL2(state: RunState): RunState {
  if (!state.l2?.mergeAuthorized) stop(state, { subject: "merge", evidence: "no recorded authorization", why: "a run merges only under a human's explicit campaign authorization", decision: "merge by hand, or record the authorization" });
  verifyGit(state);
  const viewed = sh("gh", ["pr", "view", String(state.pr!.number), "--json", `${PR_FIELDS},mergeable,mergeStateStatus,files`]);
  if (!viewed.ok) throw new ToolFailure("gh pr view", viewed.out);
  const pr = JSON.parse(viewed.out) as RemotePr & { mergeable: string; mergeStateStatus: string; files: { path: string }[] };
  const problems = [
    prMismatch(state.pushedSha, pr, MAIN),
    pr.mergeable !== "MERGEABLE" || pr.mergeStateStatus !== "CLEAN" ? `#${pr.number} is ${pr.mergeable}/${pr.mergeStateStatus}` : undefined,
    JSON.stringify(pr.files.map((file) => file.path).sort()) !== JSON.stringify(Object.keys(state.validatedFiles ?? {}).sort()) ? `#${pr.number} changes ${pr.files.map((file) => file.path).sort().join(", ")}, not the validated files` : undefined,
  ].filter(Boolean);
  const ci = readCi(state);
  if (ci.status !== "passing") problems.push(`CI is ${ci.status}: ${ci.detail}`);
  if (problems.length) stop(state, { subject: `merging PR #${pr.number}`, evidence: problems.join("\n"), why: "the PR is not exactly the validated run with passing CI", decision: "reconcile the PR by hand; nothing was merged" });
  const merged = sh("gh", ["pr", "merge", String(pr.number), "--merge", "--match-head-commit", state.pushedSha!]);
  const result = sh("gh", ["pr", "view", String(pr.number), "--json", "state,mergeCommit"]);
  const outcome = result.ok ? (JSON.parse(result.out) as { state: string; mergeCommit?: { oid: string } }) : undefined;
  if (outcome?.state !== "MERGED" || !outcome.mergeCommit) throw new ToolFailure("gh pr merge", `${merged.out}\n${result.out}`);
  gitOut("fetch", "--quiet", "origin", MAIN);
  gitOut("switch", "--quiet", MAIN);
  gitOut("merge", "--quiet", "--ff-only", `origin/${MAIN}`);
  if (!git("merge-base", "--is-ancestor", state.pushedSha!, "HEAD").ok || head() !== remoteSha(`refs/heads/${MAIN}`)) throw new ToolFailure("synchronizing main after the merge", `HEAD ${head()}, origin/${MAIN} ${remoteSha(`refs/heads/${MAIN}`)}`);
  console.log(`  ok  merged #${pr.number} as ${outcome.mergeCommit.oid.slice(0, 7)}; ${MAIN} is at ${head().slice(0, 7)}`);
  return { ...state, l2: { ...state.l2!, merged: { sha: outcome.mergeCommit.oid, at: now() } } };
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
  // A repair or a merged main adds commits on top of what the run pushed: a fast-forward of its own push.
  const fastForward = Boolean(remote && remote !== local && remote === state.pushedSha && git("merge-base", "--is-ancestor", remote, local).ok);
  if (remote && remote !== local && !fastForward) {
    stop(state, { subject: `origin/${state.branch}`, evidence: `remote is ${remote.slice(0, 7)}, local ${local.slice(0, 7)}`, why: "the remote branch holds work this run did not push; the tool never force-pushes", decision: "reconcile the remote branch by hand" });
  }
  if (fastForward) {
    const result = sh("git", ["push", "--quiet", "origin", `HEAD:refs/heads/${state.branch}`]);
    if (!result.ok) throw new ToolFailure("git push", result.out);
    console.log(`  ok  pushed: ${state.branch} ${remote!.slice(0, 7)}..${local.slice(0, 7)}`);
    return { ...state, pushedSha: local };
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

/** The branch's PRs once GitHub shows the pushed head: after a fast-forward push it may briefly show the previous one. */
function settledBranchPrs(state: RunState): RemotePr[] {
  for (let attempt = 0; ; attempt++) {
    const prs = branchPrs(state);
    const lagging = prs.some((pr) => pr.state === "OPEN" && pr.headRefOid !== state.pushedSha && state.l2?.history?.length);
    if (!lagging || attempt >= 6) return prs;
    spawnSync("sleep", ["10"]);
  }
}

function openPr(state: RunState): RunState {
  verifyGit(state);
  const existing = matchingPr(state, settledBranchPrs(state));
  if (existing) {
    // A repaired or resynchronized L2 run keeps its PR; its text is regenerated so it describes what is there now.
    if (l2Mode) {
      const edited = sh("gh", ["pr", "edit", String(existing.number), "--body-file", "-"], { input: l2Body(state) });
      if (!edited.ok) throw new ToolFailure("gh pr edit", edited.out);
    }
    console.log(`  ok  PR #${existing.number} already open at ${existing.headRefOid.slice(0, 7)}`);
    return { ...state, pr: { number: existing.number, url: existing.url } };
  }
  const body = refactor ? refactorPrBody(state, state.refactor!.diff!, state.attribution?.footer) : l2Mode ? l2Body(state) : prBody(state, state.diff!, state.attribution?.footer);
  const title = refactor ? refactorPrTitle(state) : l2Mode ? l2PrTitle(state.l2!.slice) : prTitle(state);
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
  // `--until <stage>` stops after that stage: validate and commit locally without pushing, say.
  const until = flag("--until") as Stage | undefined;
  if (until && !STAGES.includes(until)) fail(`--until must be one of ${STAGES.join(", ")}`);
  while (nextAction(state).kind === "tool" && !(until && state.completed[until])) {
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
  if (state.stage === "done") console.log(`\n${refactor ? refactorCompletionReport(state, state.refactor?.diff) : l2Mode ? l2CompletionReport(state) : completionReport(state)}`);
  else commandNext(state);
}

function l2CompletionReport(state: RunState): string {
  const record = state.l2!;
  return [
    `${state.title}: ${record.merged ? `merged as ${record.merged.sha.slice(0, 7)}` : "validated PR awaiting human merge"}${state.pr ? ` (${state.pr.url})` : ""}`,
    `authored: ${record.diff?.authored.join(", ") || "none"}`,
    `blocked: ${record.blocked.join(", ") || "none"}`,
    `commits: ${state.commits.map((entry) => `${entry.sha.slice(0, 7)} ${entry.message.split("\n")[0]}`).join("; ")}`,
    `checks: ${Object.entries(state.checks).map(([name, entry]) => `${name} ${entry.ok ? "ok" : "FAILED"}`).join(", ")}`,
  ].join("\n");
}

// ---------------------------------------------------------------- dispatch

if (l2Mode && L2_READ_ONLY.has(command)) {
  try {
    commandL2(command, positional, flag, (name) => flags.has(name));
  } catch (error) {
    fail((error as Error).message, 1);
  }
  process.exit(process.exitCode ?? 0);
}

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
    case "review":
      if (!refactor) fail("review is a refactor command: map:author -- refactor review <concept-id> --decision keep --note \"...\"");
      commandRefactorReview();
      break;
    case "record":
      if (refactor) await commandRefactorRecord();
      else if (l2Mode) await commandL2Record();
      else commandRecord();
      break;
    case "campaign":
      if (!l2Mode) fail("campaign is an l2 command: map:author -- l2 campaign");
      commandL2Campaign();
      break;
    case "authorize":
      if (!l2Mode) fail("authorize is an l2 command");
      commandL2Authorize();
      break;
    case "checkpoint":
      if (!l2Mode) fail("checkpoint is an l2 command");
      commandL2Checkpoint();
      break;
    case "reopen":
      if (!l2Mode) fail("reopen is an l2 command");
      commandL2Reopen();
      break;
    case "sync":
      if (!l2Mode) fail("sync is an l2 command");
      commandL2Sync();
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
