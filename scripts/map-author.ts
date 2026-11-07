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
//   npm run map:author -- l2 cost [--branch <b>] [--since <iso>] [--until <iso>] [--session <id>] [--agents] [--json]
//   npm run map:author -- l2 territory <group> [--write]
//   npm run map:author -- l2 check [--group <group>] [--json]
//   npm run map:author -- l2 campaign                    every slice, the next one, and whether merging is authorized
//   npm run map:author -- l2 start --slice <id> | --pilot --budget-usd <usd> [--reserve role=usd,..] [--headroom-usd <usd>] [--dry-run]
//   npm run map:author -- l2 budget [--json] | hook | reserve --role <r> [--id <id>] | release <id> --reason ".." | set --usd <n> --decision ".."
//                                                        the run's hard spending cap (l2/budget.ts); every start needs one
//   npm run map:author -- l2 start --slice <id> --groups <group>[,<group>..] [--dry-run]   a partial run: those groups of the slice only
//   npm run map:author -- l2 start --slice <id> --repair <id>[,<id>..] --reason ".." [--dry-run]   repair merged concepts in a new run
//   npm run map:author -- l2 record plan|design|author|audit|group-audit <subject> [--note ..] [--audit-file <json>]
//   npm run map:author -- l2 group-signals <group>       a group audit's signals
//   npm run map:author -- l2 reopen <id>[,<id>..] --reason ".."   repair drafted concepts (a counted cycle)
//   npm run map:author -- l2 sync                        merge a moved main into the run's branch and revalidate
//   npm run map:author -- l2 checkpoint --decision ".."   the pilot's human review of plans and designs
//   npm run map:author -- l2 authorize --authorization ".."   record a human's explicit campaign merge authorization
//   npm run map:author -- l2 attempts [--json] | reconcile [--json]   (tracked v2 runs) every attempt and its evidence; apply reconciliation (idempotent)
//   npm run map:author -- l2 attempt begin <author|audit|group-audit> <subject> --role <r> [--auditor X] [--model m]
//                                                        | launch <id> --ref <ref> | fail|interrupt <id> --reason .. | decide <id> --relaunch|--abandon --reason .. | release <id> --reason .. | show <id>
//   npm run map:author -- l2 audit-task <concept|group> --role first-audit|re-audit|group-audit --auditor A|B|R|G
//                                                        (v2) one auditor's own prompt, naming only its private findings file
//   npm run map:author -- l2 submit-audit <concept|group> --role first-audit|re-audit|group-audit --auditor A|B|R|G --file <json>
//                                                        group-batched runs (simplified v2): an auditor's immutable findings; only the orchestrator records
//   npm run map:author -- l2 findings <concept|group> [--json]   the findings submitted against the current records, and what they support
//   npm run map:author -- l2 repair-findings <concept> [--json]  a reopened concept's own findings in the open repair cycle (historical, provenance-checked)
//   npm run map:author -- l2 repair-diff <concept> [--json]      what a repair changed, against the record its failing audit judged
//   npm run map:author -- l2 reopen <id>[,<id>..] --from-findings   (v2) reopen with the submitted blocking findings as the reason
//   npm run map:author -- l2 authorize --revoke-merge --decision ".."   revoke it (kept in the campaign's history); runs started later await human merge
//   npm run map:author -- l2 status | next | complete audit --note .. | fix .. | stop .. | resume .. | run [--until <stage>] ..
//   npm run map:author -- l2 next --json [--domain <run>]   the versioned, read-only driver view (l2/orchestration.ts)
//   npm run map:author -- l2 batches --slice <id> [--json]   the slice's remaining work as runs of at most 12 concepts
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { mapKnowledge } from "../src/lib/map/data.ts";
import { commandRepresent } from "./map-author-represent.ts";
import { commandL2, coverageFor, groupSignalsOf, planReport, readPlans, signalsOf } from "./map-author-l2.ts";
import { DATA_FILE as L2_DATA_FILE, finishedConcepts, groupCommitMessage, groupCommitTrees, l2Branch, l2PrBody, l2RepairBranch, l2PrTitle, l2RunId, l2Slices, L2ScopeError, pilotSlice, PILOT_SLICE, selectGroups, stepKey, REGISTRY_FILE as L2_REGISTRY_FILE, repairCommitMessage, sliceRemaining, VIEW_FILE as L2_VIEW_FILE, withRecordsFrom, type L2RunScope, type L2Slice, type L2StepKind } from "../src/lib/map/authoring/l2/campaign.ts";
import { authorizeMerge, AuthorizationError, authorizeRequest, inheritedMergeAuthorization, mergeStatusLines, revocationOf, revokeMerge, type AuthorizeRequest, type L2Campaign } from "../src/lib/map/authoring/l2/authorization.ts";
import { REPAIR_EXCEPTION, repairBaseline, repairExceptionProblem, repairScopeProblems } from "../src/lib/map/authoring/l2/repair.ts";
import { contentFingerprint as recordFingerprint } from "../src/lib/map/authoring/representation/design.ts";
import { auditCoverageProblems, conceptWorkOf, groupAuditProblems, groupFileWithoutAudits, withConceptAudit, workProblems, type L2ConceptWork, type L2Design, type L2GroupAudit } from "../src/lib/map/authoring/l2/contracts.ts";
import { neighbourBasis } from "../src/lib/map/authoring/l2/coverage.ts";
import { l2Next, l2NoRun, planBatches, staleSummary, stepFreshness, type L2FreshnessInput, type L2NextInput, type L2SubmittedAudit } from "../src/lib/map/authoring/l2/orchestration.ts";
import { AttemptError, artifactAttemptProblem, attemptIn, attemptMarker, beginAttempt, decide, inputKeyOf, reconcile, releaseHold, stepId, transition, withAttempt, type L2Attempt, type L2AttemptEvidence, type L2AttemptLog, type L2AttemptRole, type L2AttemptStep } from "../src/lib/map/authoring/l2/attempts.ts";
import { launchAttempt, readAttemptLog, updateAttemptLog } from "../src/lib/map/authoring/l2/attempts-io.ts";
import { journaledCommit, JournalError, recoverJournal, sha } from "../src/lib/map/authoring/l2/journal.ts";
import { artifactPath, AUDIT_ROLES, AuditArtifactError, AUDITORS, auditorInbox, auditOutcome, auditTaskPrompt, bindingKey, commitAuditRecording, draftTaskPrompt, findingsProblems, findingsReason, inboxProblem, provenanceProblem, readArtifacts, repairItems, staleArtifacts, submitArtifact, type L2AuditBinding, type L2AuditOutcome, type L2AuditRole, type L2FindingsInput, type L2RepairEvidence, type L2RepairItem } from "../src/lib/map/authoring/l2/audit-artifacts.ts";
import { formatRecordDiff, recordDiff, recordLines } from "../src/lib/map/authoring/l2/record-diff.ts";
import { BudgetError, budgetStatus, changeCap, describeBudget, launchProblem, releaseLaunch, startBudget, type L2Budget, type L2SpendSession } from "../src/lib/map/authoring/l2/budget.ts";
import { BudgetLockError, readLedger, reserveUnderLock, withLock, writeLedger } from "../src/lib/map/authoring/l2/budget-io.ts";
import { attemptsAdapter, attemptsPath, HOOK_SETTINGS, hookInstalled, journalPath, ledgerPath, measure } from "./map-l2-budget.ts";
import { describePipeline, isBatched, PipelineError, PIPELINES, pipelineMismatchProblem, pipelineOf, pipelineStatus, startPipeline, type L2Pipeline } from "../src/lib/map/authoring/l2/pipeline.ts";
import { validateL2Diff } from "../src/lib/map/authoring/l2/diff.ts";
import { inventoryL2 } from "../src/lib/map/authoring/l2/inventory.ts";
import { driftReport, sliceStopSignals } from "../src/lib/map/authoring/l2/signals.ts";
import { crossPlanProblems, groupFile, GROUPS_DIR, planProblems, staleProblems, type L2GroupFile } from "../src/lib/map/authoring/l2/territory.ts";
import { AUTHORED_CONTENT_CONCEPTS } from "../src/lib/map/authoring/content-registry.ts";
import { createMapAuthoringInspector, MapAuthoringContextError } from "../src/lib/map/authoring/context.ts";
import { formatMapConceptAuthoringContext } from "../src/lib/map/authoring/format.ts";
import type { MapConceptContent, MapKnowledgeModel } from "../src/lib/map/types.ts";
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
  batchLimitProblem,
  batchStartProblem,
  clearL2Checkpoint,
  createL2RepairRunState,
  createL2RunState,
  pendingL2Steps,
  recordL2Step,
  reopenL2,
  RepairLimitError,
  repairAllowance,
  repairLimitSubject,
  latestRepairReason,
  humanMerge,
  recordHumanMerge,
  reopenPrProblem,
  partialStartProblems,
  repairOriginal,
  repairStatusLine,
  resolvedStopLine,
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
  reusableCheck,
  auditNeed,
  pendingDrafts,
  checkScope,
  gateOrder,
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
  type ObservedPr,
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
  else if (["--json", "--dry-run", "--write", "--pilot", "--agents", "--verbose", "--revoke-merge", "--from-findings", "--relaunch", "--abandon"].includes(arg)) flags.set(arg, true);
  else {
    const value = rest[++index];
    if (value === undefined || value.startsWith("--")) fail(`${arg} needs a value`);
    flags.set(arg, value);
  }
}
const flag = (name: string) => (typeof flags.get(name) === "string" ? (flags.get(name) as string) : undefined);
const dryRun = flags.has("--dry-run");
/** Status and reopen print long histories (every repair finding, every stop resolution) whole only on request. */
const verbose = flags.has("--verbose");
/** `refactor <command>` runs the same commands over representation refactor state. */
const refactor = first === "refactor";
/** `l2 <command>` runs L2 slice runs (docs/map-authoring/l2-authoring.md); its read-only commands live in map-author-l2.ts. */
const l2Mode = first === "l2";
const L2_READ_ONLY = new Set(["context", "cost", "territory", "check", "signals", "group-signals", "drift"]);
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

/**
 * The Worker budget (docs/map-authoring/l2-content-scale.md, sections 11 and
 * 15): the production Worker as `wrangler deploy --dry-run` sizes it, refused
 * above half of Cloudflare's 64 MiB limit, where the decision says content
 * storage must change. Builds with OpenNext, which rebuilds .next.
 */
const WORKER_BUDGET_MIB = 32;
function workerBudget(): Result & { detail: string } {
  rmSync(join(ROOT, ".open-next"), { recursive: true, force: true });
  const built = sh("npx", ["opennextjs-cloudflare", "build"]);
  if (!built.ok) return { ...built, detail: "the OpenNext build failed" };
  const dir = mkdtempSync(join(tmpdir(), "map-worker-"));
  try {
    const dry = sh("npx", ["wrangler", "deploy", "--dry-run", "--outdir", dir]);
    const kib = Number(dry.out.match(/Total Upload: ([\d.]+) KiB/)?.[1]);
    if (!dry.ok || !kib) return { ok: false, status: dry.status, out: dry.out, detail: "the dry run reported no upload size" };
    const mib = kib / 1024;
    return { ok: mib <= WORKER_BUDGET_MIB, status: mib <= WORKER_BUDGET_MIB ? 0 : 1, out: `Total Upload ${kib} KiB`, detail: `${mib.toFixed(1)} MiB of the ${WORKER_BUDGET_MIB} MiB budget` };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

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
  const write = () => writeFileSync(statePath(state.domainId), `${JSON.stringify(state, null, 2)}\n`);
  if (state.kind !== "l2") return write();
  // An L2 run's state is written under its commit journal's lock, never over a journaled commit in flight or unrecovered.
  try {
    withLock(journalPath(state.domainId), () => {
      if (existsSync(journalPath(state.domainId))) throw new JournalError(`an interrupted commit of ${state.domainId} is unrecovered (${journalPath(state.domainId)}): run any l2 command to recover it first`);
      write();
    });
  } catch (error) {
    if (error instanceof JournalError || error instanceof BudgetLockError) fail(`the run state of ${state.domainId} was not saved: ${error.message}`, 1);
    throw error;
  }
}
/** The files an L2 run's commit journal may write: the run's own state and the L2 group files. */
const journalAllows = (domainId: string) => (path: string) => path === statePath(domainId) || (dirname(path) === join(ROOT, GROUPS_DIR) && path.endsWith(".json"));

/** Every recorded run of a slice: its full-slice run, its partial runs and its repair runs. */
function sliceRuns(sliceId: string): RunState[] {
  if (!existsSync(STATE_DIR)) return [];
  return readdirSync(STATE_DIR)
    .filter((file) => file.endsWith(".json") && file !== L2_CAMPAIGN_FILE)
    .map((file) => readState(file.slice(0, -5))!)
    .filter((state) => state.l2?.slice.id === sliceId);
}

function activeState(): RunState {
  const state = selectState();
  // An interrupted commit (a v2 audit recording killed between its writes) is recovered before anything reads the run.
  if (!l2Mode || !existsSync(journalPath(state.domainId))) return state;
  let recovery: ReturnType<typeof recoverJournal>;
  try {
    recovery = recoverJournal(journalPath(state.domainId), state.domainId, journalAllows(state.domainId));
  } catch (error) {
    if (error instanceof JournalError) fail(`cannot recover the interrupted commit of ${state.domainId}: ${error.message}`, 1);
    throw error;
  }
  if (recovery.action === "refused") fail(`an interrupted commit of ${state.domainId} (${recovery.what}) cannot be recovered: ${recovery.problem}; a human decides (the journal is ${journalPath(state.domainId)})`, 1);
  const recovered = readState(state.domainId)!;
  if (recovery.action === "rolled-forward") {
    console.log(`recovered an interrupted commit (${recovery.what}): completed it${recovery.written.length ? `, writing ${recovery.written.map((file) => file.replace(`${ROOT}`, "")).join(", ")}` : ""}`);
    const stale = recoveredStaleness(recovered, recovery.tx);
    if (stale) console.log(`  the recovered ${stale.step} was decided against evidence that has since changed (${stale.changed.join(", ")}): completing the commit does not make it current; it covers nothing it judged differently, and the gates judge it as they would any stale audit`);
  }
  return recovered;
}

/** What a recovered audit judged that is no longer as it is now: its record, a neighbour's, or a group member's. */
function recoveredStaleness(state: RunState, tx: string): { step: string; changed: string[] } | undefined {
  const [kind, subject] = (tx.split("@")[0] ?? "").split(":");
  if (!state.l2 || (kind !== "audit" && kind !== "group-audit") || !subject) return undefined;
  const plans = readPlans();
  let bound: Record<string, string> = {};
  if (kind === "audit") {
    const audit = plans.map((plan) => conceptWorkOf(plan, subject)?.audit).find(Boolean);
    if (!audit) return undefined;
    bound = { ...(audit.neighbours ?? {}), [subject]: audit.recordFingerprint };
  } else {
    bound = (plans.find((plan) => plan.group === subject) as (L2GroupFile & { groupAudit?: L2GroupAudit }) | undefined)?.groupAudit?.records ?? {};
  }
  const changed = Object.entries(bound).filter(([conceptId, fingerprint]) => recordFingerprint(recordOf(conceptId)) !== fingerprint).map(([conceptId]) => conceptId);
  return changed.length ? { step: `${kind} of ${subject}`, changed } : undefined;
}

function selectState(): RunState {
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
/** Paths of tracked files changed against HEAD, staged or not (trackedChanges' lines carry a status prefix). */
const trackedPaths = () => lines(gitOut("diff", "--no-renames", "--name-only", "HEAD"));
/** A run's own content files: the data file, the registry, the generated view and its group files. */
const runContentFiles = (state: RunState) => [L2_DATA_FILE, L2_REGISTRY_FILE, L2_VIEW_FILE, ...state.l2!.slice.groups.map((group) => groupFile(group.group))];
/** Uncommitted changes a merge of main may carry past: an open repair's content, nothing else. */
const changesBlockingMerge = (state: RunState) => trackedPaths().filter((file) => !(state.l2?.repair && runContentFiles(state).includes(file)));
const remoteSha = (ref: string) => lines(gitOut("ls-remote", "origin", ref))[0]?.split(/\s+/)[0];

/**
 * Recorded run versus the actual repository; any mismatch is a stop before anything else happens.
 * remoteMayBeDeleted: the PR is merged at the pushed head, so a branch deleted on merge is expected; a moved one is not.
 */
function verifyGit(state: RunState, { remoteMayBeDeleted = false } = {}) {
  const remote = state.pushedSha ? remoteSha(`refs/heads/${state.branch}`) : undefined;
  const problems = gitProblems(state, {
    branch: currentBranch(),
    head: head(),
    baseIsAncestor: git("merge-base", "--is-ancestor", state.baseSha, "HEAD").ok,
    trackedChanges: trackedChanges(),
    remoteHead: remoteMayBeDeleted ? (remote ?? state.pushedSha) : remote,
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

/** Local campaign state: the human's merge authorization, if any, its history, and the repair exception (l2/authorization.ts). Never committed. */
const L2_CAMPAIGN_FILE = "campaign.json";
const campaignPath = () => join(STATE_ROOT, "l2", L2_CAMPAIGN_FILE);
const readCampaign = (): L2Campaign => (existsSync(campaignPath()) ? (JSON.parse(readFileSync(campaignPath(), "utf8")) as L2Campaign) : {});
function writeCampaign(campaign: L2Campaign) {
  mkdirSync(dirname(campaignPath()), { recursive: true });
  writeFileSync(campaignPath(), `${JSON.stringify(campaign, null, 2)}\n`);
}
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
  for (const line of mergeStatusLines(campaign)) console.log(line);
}

/**
 * Records a human's standing authorization, or revokes the merge
 * authorization (l2/authorization.ts): exactly one of --authorization,
 * --repair-exception, or --revoke-merge --decision "..". A revoked or replaced
 * merge authorization moves to the campaign's history; nothing is deleted.
 */
function commandL2Authorize() {
  let request: AuthorizeRequest;
  try {
    request = authorizeRequest({ authorization: flag("--authorization"), repairException: flag("--repair-exception"), revokeMerge: flags.has("--revoke-merge"), decision: flag("--decision") });
  } catch (error) {
    if (error instanceof AuthorizationError) fail(error.message);
    throw error;
  }
  const campaign = readCampaign();
  switch (request.kind) {
    case "repair-exception":
      writeCampaign({ ...campaign, repairException: { at: now(), authorization: request.authorization } });
      return console.log("recorded the campaign's standing repair exception: `resume --exception ..` may resolve a repair-limit stop once per concept");
    case "merge":
      writeCampaign(authorizeMerge(campaign, request.authorization, now()));
      return console.log(`recorded the campaign's merge authorization; runs started from now merge their own validated PRs (never the pilot)${campaign.mergeAuthorization ? `; the authorization of ${campaign.mergeAuthorization.at} moves to the history` : ""}`);
    case "revoke-merge": {
      const { campaign: revoked, revoked: was } = revokeMerge(campaign, request.decision, now());
      if (!was) return console.log("no merge authorization is active: nothing to revoke; each validated PR awaits human merge");
      writeCampaign(revoked);
      console.log(`revoked the merge authorization of ${was.at}; runs started from now end at a validated PR awaiting human merge, and a run started under it is refused at its merge stage`);
      for (const line of mergeStatusLines(revoked)) console.log(line);
    }
  }
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
  if (flags.has("--repair")) {
    if (flag("--groups")) fail("--groups selects the groups of a new run; a repair names its concepts with --repair", 1);
    return commandL2StartRepair(slice);
  }
  // A partial run takes some of the slice's groups (campaign.ts selectGroups); without --groups the run is the whole slice.
  let scope: L2RunScope | undefined;
  if (flag("--groups")) {
    if (flags.has("--pilot")) fail("--groups selects groups of a campaign slice, not of the pilot", 1);
    try {
      scope = selectGroups(slice, flag("--groups")!.split(","));
    } catch (error) {
      if (error instanceof L2ScopeError) fail(error.message, 1);
      throw error;
    }
  }
  const remaining = sliceRemaining(slice, finished);
  const id = l2RunId(slice, scope);
  const branch = l2Branch(slice, scope?.part);
  // The pipeline is chosen per slice, at its start (pipeline.ts); legacy unless asked.
  let pipeline: L2Pipeline;
  try {
    pipeline = startPipeline(flag("--pipeline"), flag("--routing"));
  } catch (error) {
    if (error instanceof PipelineError) fail(error.message, 1);
    throw error;
  }
  const existing = readState(id);
  if (existing && existing.stage !== "done") {
    console.log(`a run ${id} already exists; resuming it`);
    return commandStatus(existing);
  }
  const budget = startBudgetOrFail();
  const scoped = slice.groups.filter((group) => !scope || scope.groups.includes(group.group));
  const integrated = scope ? scoped.filter((group) => !group.concepts.some((conceptId) => remaining.includes(conceptId))).map((group) => group.group) : [];
  const problems = [
    ...(remaining.length ? [] : [`${slice.id} has nothing left to author`]),
    // A finished run's state is its record (steps, repairs, merge): a new start never overwrites it.
    ...(existing && remaining.length ? [`${id} already ran to the end (${statePath(id)}) with concepts not on main: a finished run's record is never overwritten; integrate its PR, or move the file aside to start again`] : []),
    ...(integrated.length ? [`nothing left to author in ${integrated.join(", ")}: its concepts are already integrated`] : []),
    ...partialStartProblems({ runs: sliceRuns(slice.id).filter((run) => run.domainId !== id), finished, id }),
    // A group-batched run holds at most MAX_BATCH_CONCEPTS concepts, whole groups only: refused before any branch is made.
    ...[batchStartProblem(pipeline, scoped.flatMap((group) => group.concepts).filter((conceptId) => remaining.includes(conceptId)).length, `${CLI} batches --slice ${slice.id}`)].filter((problem): problem is string => Boolean(problem)),
    ...observeStart(branch, id),
    ...budgetHookProblems(),
  ];
  for (const group of scoped) console.log(`  ${group.group.padEnd(48)} ${group.concepts.filter((conceptId) => remaining.includes(conceptId)).join(", ") || "(done)"}`);
  if (problems.length) {
    console.log(`\ncannot start ${id}:\n  ${problems.join("\n  ")}`);
    process.exit(1);
  }
  if (dryRun) return console.log(`\ndry run: would create ${branch} and author ${scoped.flatMap((group) => group.concepts).filter((conceptId) => remaining.includes(conceptId)).length} concept(s) as ${id} under the ${describePipeline(pipeline)}, capped at $${budget.capUsd.toFixed(2)}`);
  const baseSha = branchFromMain(branch);
  if (!baseSha) return;
  const pilot = slice.id === PILOT_SLICE;
  let state = createL2RunState({ slice, remaining, branch, baseSha, now: now(), pilot, pipeline, ...(scope ? { scope } : {}) });
  state = { ...state, l2: { ...state.l2!, budget } };
  // The pilot always ends at a PR for detailed human review, whatever the campaign authorizes.
  const authorization = inheritedMergeAuthorization(readCampaign(), { pilot });
  if (authorization) state = { ...state, l2: { ...state.l2!, mergeAuthorized: authorization } };
  saveState(state);
  console.log(`\nstarted ${id} on ${branch} at ${baseSha.slice(0, 7)} under the ${describePipeline(pipeline)}${scope ? ` (groups ${scope.groups.join(", ")})` : ""}${state.l2!.mergeAuthorized ? " (merge authorized)" : ""}`);
  console.log(`next: ${(nextAction(state) as { message: string }).message}`);
}

/**
 * Starts a repair run for concepts of a merged slice run (docs/map-authoring/
 * l2-authoring.md, "Repairs"): a new run and branch from main, its state in
 * its own file. Every check runs before anything is written, so a refused
 * request changes neither the campaign state nor git.
 */
function commandL2StartRepair(slice: L2Slice) {
  const concepts = (flag("--repair") ?? fail("--repair needs concept ids")).split(",").map((conceptId) => conceptId.trim()).filter(Boolean);
  const reason = flag("--reason") ?? fail("a repair run needs --reason: the finding it answers");
  // The run that drafted the concepts: the slice's full run, or one of its partial runs.
  let original: RunState;
  try {
    original = repairOriginal(sliceRuns(slice.id), concepts);
  } catch (error) {
    if (error instanceof RunStateError) fail(error.message, 1);
    throw error;
  }
  const earlier = existsSync(STATE_DIR) ? readdirSync(STATE_DIR).filter((file) => file.startsWith(`${slice.id}-repair-`) && file.endsWith(".json")).map((file) => readState(file.slice(0, -5))!) : [];
  const open = earlier.find((state) => state.stage !== "done");
  if (open) fail(`${open.domainId} is still open: finish it first (\`${CLI} status --domain ${open.domainId}\`)`, 1);
  const id = `${slice.id}-repair-${earlier.length + 1}`;
  const branch = l2RepairBranch(slice, earlier.length + 1);
  const create = (baseSha: string) => createL2RepairRunState(original, { id, concepts, reason, baseline: repairBaseline(readPlans(), concepts), branch, baseSha, now: now(), earlier });
  try {
    create("0".repeat(40));
  } catch (error) {
    if (error instanceof RepairLimitError) fail(`repair limit: ${error.conceptIds.join(", ")} used every repair cycle allowed, in ${slice.id} and its repair runs; a human decides`, 1);
    // Any other refusal (a concept no plan owns, say) is reported the same way: nothing has been written.
    fail((error as Error).message, 1);
  }
  const budget = startBudgetOrFail();
  const problems = [...observeStart(branch, id), ...budgetHookProblems()];
  if (problems.length) {
    console.log(`cannot start ${id}:\n  ${problems.join("\n  ")}`);
    process.exit(1);
  }
  if (dryRun) return console.log(`dry run: would create ${branch} and repair ${concepts.join(", ")} of ${slice.id} (merged in ${original.l2!.merged!.sha.slice(0, 7)})`);
  const baseSha = branchFromMain(branch);
  if (!baseSha) return;
  let state = create(baseSha);
  state = { ...state, l2: { ...state.l2!, budget } };
  const authorization = inheritedMergeAuthorization(readCampaign());
  if (authorization) state = { ...state, l2: { ...state.l2!, mergeAuthorized: authorization } };
  saveState(state);
  console.log(`started ${id} on ${branch} at ${baseSha.slice(0, 7)}: repair cycle ${state.l2!.repair!.cycle} of ${concepts.join(", ")}${state.l2!.mergeAuthorized ? " (merge authorized)" : ""}`);
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
  // A group-batched run records audits only from the auditors' submitted findings, all or nothing.
  if ((kind === "audit" || kind === "group-audit") && isBatched(pipelineOf(record))) return recordBatchedAudit(state, kind, subject, group);
  // A tracked run's draft or repair is recorded with the attempt that produced it, for exactly its inputs.
  const authorAttempt = kind === "author" ? draftAttempt(state, subject) : undefined;
  // An audit given as a file is written first, so validation reads the audit as now bound to the records.
  const auditFile = flag("--audit-file");
  if (auditFile && (kind === "audit" || kind === "group-audit")) writeAudit(kind, subject, group, auditFile);
  const plans = readPlans();
  const plan = planOf(group);
  const refuse = (problems: string[]) => problems.length && fail(`cannot record ${kind} ${subject}:\n  ${problems.join("\n  ")}`, 1);
  const repair = record.repair;
  // A repair stays within the territory, models and designs it was reopened with, except what it re-records.
  const scope = (extra: { redesigned?: string[]; replanned?: string[]; territoryOnly?: boolean } = {}) =>
    repair
      ? repairScopeProblems({
          baseline: repair.baseline,
          reopened: repair.concepts,
          plans,
          redesigned: new Set([...repair.concepts.filter((conceptId) => (state.l2!.steps[`design:${conceptId}`]?.at ?? "") >= repair.at), ...(extra.redesigned ?? [])]),
          replanned: new Set([...repair.groups.filter((entry) => (state.l2!.steps[`plan:${entry}`]?.at ?? "") >= repair.at), ...(extra.replanned ?? [])]),
          territoryOnly: extra.territoryOnly,
        })
      : [];
  let blocks = false;
  let fingerprint: string | undefined;
  switch (kind) {
    case "plan":
      refuse([pipelineMismatchProblem(group, groupFile(group), pipelineOf(plan), pipelineOf(record))].filter((problem): problem is string => !!problem));
      refuse([...planProblems(plan, mapKnowledge), ...staleProblems(plan, mapKnowledge).map((problem) => `stale: ${problem}`), ...crossPlanProblems(plans, inventoryL2(mapKnowledge)).filter((problem) => problem.includes(group) || plan.members.some((member) => problem.startsWith(`${member.conceptId}:`))), ...scope({ replanned: [group], territoryOnly: true })]);
      break;
    case "design":
      refuse([...staleProblems(plan, mapKnowledge).map((problem) => `the plan is stale: ${problem}`), ...workProblems(plan, subject, mapKnowledge, "designed"), ...scope({ redesigned: [subject] })]);
      blocks = conceptWorkOf(plan, subject)?.design?.decision === "block";
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
      // An overlap with a neighbour counts as resolved once any audit recorded against both current records resolves it.
      const signals = signalsOf(subject, plans);
      refuse([...workProblems(plan, subject, mapKnowledge, "audited", signals, coverageFor(plans, signals)), ...scope()]);
      break;
    }
    case "group-audit":
      refuse([...groupAuditProblems(plan as L2GroupFile & { groupAudit?: L2GroupAudit }, mapKnowledge, groupSignalsOf(plan)), ...scope()]);
      break;
    default:
      fail("record needs <plan|design|author|audit|group-audit> <subject>");
  }
  try {
    state = recordL2Step(state, { kind, subject }, now(), { blocks, note: flag("--note"), fingerprint, ...(authorAttempt ? { attempts: [authorAttempt.id] } : {}) });
  } catch (error) {
    if (error instanceof RunStateError) fail(error.message, 1);
    throw error;
  }
  saveState(state);
  if (authorAttempt) commitAttempts(state, [authorAttempt.id], `recorded author ${subject}`, { kind: "record", ref: fingerprint!, key: authorAttempt.inputKey, at: now() });
  console.log(`recorded ${kind} ${subject}; ${pendingL2Steps(state).length} step(s) to go`);
  if (blocks) {
    const design = conceptWorkOf(plan, subject)?.design as L2Design;
    stop(state, {
      subject: `representation gap: ${subject}`,
      evidence: `${design.gap?.structure}: ${design.gap?.reason}`,
      why: "a relationship the concept needs has no primitive and prose cannot carry it accurately",
      decision: `leave ${subject} unauthored in this run (\`${CLI} resume --decision ..\`), or change its design`,
    });
  }
  commandNext(state);
}

/** The attempt a tracked run's draft is recorded with (`record author --attempt <id>`); none in an untracked run. */
function draftAttempt(state: RunState, subject: string): L2Attempt | undefined {
  const id = flag("--attempt");
  if (!tracksAttempts(state)) {
    if (id) fail(`${state.domainId} does not track attempts: record without --attempt`, 1);
    return undefined;
  }
  if (!id) fail(`${state.domainId} tracks attempts: record the draft with --attempt <id> (\`${CLI} attempt begin author ${subject}\`)`, 1);
  const attempt = readAttemptLog(attemptsPath(state.domainId), state.domainId).attempts.find((entry) => entry.id === id) ?? fail(`no attempt ${id} in ${state.domainId}`, 1);
  const problem = draftAttemptProblem(state, attempt, subject);
  if (problem) fail(problem, 1);
  return attempt;
}

/** Why a draft of `subject` is not recorded with `attempt` (`record author --attempt`); `l2 next --json` reports the same. */
function draftAttemptProblem(state: RunState, attempt: L2Attempt, subject: string): string | undefined {
  if (attempt.step.kind !== "author" || attempt.step.subject !== subject) return `attempt ${attempt.id} is ${stepId(attempt.step)}, not a draft of ${subject}`;
  if (attempt.status === "committed") return `attempt ${attempt.id} is already committed: a duplicate commit`;
  if (!["running", "interrupted"].includes(attempt.status)) return `attempt ${attempt.id} is ${attempt.status}: only a launched attempt's draft is recorded`;
  if (currentInputKey(state, attempt.step) !== attempt.inputKey) return `the inputs of attempt ${attempt.id} (its territory, repair cycle or pre-repair record) changed since it began: its draft is not recorded`;
  return undefined;
}

/**
 * Writes an audit into its group file, bound to exactly the records as they
 * are now: a concept audit to its record's fingerprint and to each authored
 * neighbour's (the other side of its relational signals), a group audit to
 * every owned member's. The file holds { note, resolutions }. Recording
 * then validates it like any audit.
 */
function writeAudit(kind: "audit" | "group-audit", subject: string, group: string, file: string) {
  const input = JSON.parse(readFileSync(file, "utf8")) as { note?: string; resolutions?: { id: string; resolution: string }[] };
  writeAuditEntry(kind, subject, group, { note: input.note ?? "", resolutions: input.resolutions ?? [] });
}

/**
 * Writes an audit into its group file. A concept audit binds the record as it
 * is now and the authored neighbours it was judged against (`neighbours`, or
 * as they are now); a group audit binds every owned member's record.
 */
function writeAuditEntry(kind: "audit" | "group-audit", subject: string, group: string, input: { note: string; resolutions: { id: string; resolution: string }[] }, neighbours?: Record<string, string>) {
  const path = join(ROOT, groupFile(group));
  const plan = JSON.parse(readFileSync(path, "utf8")) as L2GroupFile & { groupAudit?: L2GroupAudit };
  const audit = { at: now(), note: input.note, resolutions: input.resolutions };
  // A simplified plan holds no concept work until its first audit is recorded: the audit creates the entry.
  if (kind === "audit") Object.assign(plan, withConceptAudit(plan, subject, { ...audit, recordFingerprint: recordFingerprint(recordOf(subject)), neighbours: neighbours ?? neighbourBasis(mapKnowledge, readPlans(), subject) }));
  else plan.groupAudit = { ...audit, records: ownedRecords(plan) };
  writeFileSync(path, `${JSON.stringify(plan, null, 2)}\n`);
}

// ---------------------------------------------------------------- audit artifacts (simplified v2)

/** A run's audit work directory: its auditors' private inboxes and the published artifacts (l2/audit-artifacts.ts); never read as a run state. */
const runWorkDir = (state: RunState) => join(STATE_DIR, "work", state.domainId);
/** Where a run's auditors publish their findings artifacts. */
const auditWorkDir = (state: RunState) => join(runWorkDir(state), "audits");
/** Each owned member's record fingerprint, as a group audit binds them. */
const ownedRecords = (plan: L2GroupFile) => Object.fromEntries(plan.members.filter((member) => member.standing === "owned").map((member) => [member.conceptId, recordFingerprint(recordOf(member.conceptId))]));
/** Everything a record shows, for checking quoted evidence. */
const recordText = (conceptId: string) => {
  const record = recordOf(conceptId);
  return record ? recordLines(record).map((line) => line.text).join(" ") : undefined;
};
/** The records an audit of `subject` judges now, and the artifacts submitted against exactly them. */
function currentArtifacts(state: RunState, kind: "audit" | "group-audit", subject: string, group: string) {
  return readArtifacts(auditWorkDir(state), { run: state.domainId, subject, binding: currentBinding(state, kind, subject, group), concepts: auditedConcepts(kind, subject, group), textOf: recordText });
}
/** What an audit of `subject` judges now: the concept's record and its authored neighbours' records, or every owned member's for a group. */
function currentBinding(_state: RunState, kind: "audit" | "group-audit", subject: string, group: string) {
  return kind === "audit" ? { records: { [subject]: recordFingerprint(recordOf(subject)) }, neighbours: neighbourBasis(mapKnowledge, readPlans(), subject) } : { records: ownedRecords(planOf(group)) };
}
/** The concepts an audit's findings may name: the concept, or a group's owned members with records. */
const auditedConcepts = (kind: "audit" | "group-audit", subject: string, group: string) =>
  kind === "audit" ? [subject] : planOf(group).members.filter((member) => member.standing === "owned" && recordOf(member.conceptId)).map((member) => member.conceptId);

/** A subject's current artifacts, or a clean refusal when any is malformed, mismatched or incomplete. */
function checkedArtifacts(state: RunState, kind: "audit" | "group-audit", subject: string, group: string, what: string) {
  try {
    return currentArtifacts(state, kind, subject, group);
  } catch (error) {
    if (error instanceof AuditArtifactError) fail(`cannot ${what}: ${error.message}; an artifact is never rewritten: inspect it and remove it by hand, then have its auditor submit again`, 1);
    throw error;
  }
}

/**
 * The findings an audit of `subject` verifies now, numbered F1, F2, ... (audit-artifacts.ts repairItems): a
 * re-audit's are its concept's own findings in the open repair cycle; a group audit's, the group-audit findings on
 * its members that the cycle repairs. None for a first audit, or when the cycle predates repair evidence.
 */
function verificationItems(state: RunState, kind: "audit" | "group-audit", subject: string, group: string): L2RepairItem[] {
  const repair = state.l2?.repair;
  if (!repair?.evidence) return [];
  if (kind === "audit") return repair.concepts.includes(subject) && auditNeed(state, "audit", subject) === "re-audit" ? repairItems(repair.evidence[subject] ?? []) : [];
  if (!repair.groups.includes(group)) return [];
  const members = state.l2!.slice.groups.find((entry) => entry.group === group)?.concepts ?? [];
  return repairItems(members.flatMap((conceptId) => (repair.concepts.includes(conceptId) ? (repair.evidence![conceptId] ?? []) : [])), { groupAudit: true });
}
const verificationIds = (state: RunState, kind: "audit" | "group-audit", subject: string, group: string) => verificationItems(state, kind, subject, group).map((item) => item.id);
/** Each finding whose source artifact is missing or changed: its provenance is then unknown. */
const provenanceProblems = (state: RunState, items: readonly L2RepairItem[]) =>
  items.flatMap((item) => (item.finding ? [provenanceProblem(auditWorkDir(state), item.finding)].filter(Boolean).map((problem) => `${item.id}: ${problem}`) : []));
/** Refuses when any finding's source artifact is missing or changed. */
function checkedProvenance(state: RunState, items: readonly L2RepairItem[], what: string) {
  const problems = provenanceProblems(state, items);
  if (problems.length) fail(`cannot ${what}: the findings' provenance cannot be confirmed:\n  ${problems.join("\n  ")}\nartifacts are never rewritten: a human inspects them`, 1);
  return items;
}
/** A recordable outcome stays recordable only while the findings it verifies are confirmed; else it is inconsistent (read-only views). */
function confirmedOutcome(state: RunState, outcome: L2AuditOutcome, kind: "audit" | "group-audit", subject: string, group: string): L2AuditOutcome {
  if (outcome.kind !== "record") return outcome;
  const problems = provenanceProblems(state, verificationItems(state, kind, subject, group));
  return problems.length ? { kind: "inconsistent", problem: `the findings its repair answered cannot be confirmed: ${problems.join("; ")}; artifacts are never rewritten: a human inspects them` } : outcome;
}

/** What the artifacts of a subject's current records support for recording, or a refusal: missing, stale, inconsistent or blocking. */
function acceptedAudit(state: RunState, kind: "audit" | "group-audit", subject: string, group: string) {
  const artifacts = checkedArtifacts(state, kind, subject, group, `record ${kind} ${subject}`);
  const verified = verificationItems(state, kind, subject, group);
  const outcome = auditOutcome(artifacts, auditNeed(state, kind, subject), verified.map((item) => item.id));
  if (outcome.kind === "missing") {
    const binding = currentBinding(state, kind, subject, group);
    const stale = staleArtifacts(auditWorkDir(state), subject, bindingKey(binding, subject));
    fail(`cannot record ${kind} ${subject} yet: waiting for ${outcome.missing.join(" and ")} of its records and neighbours as they are now (\`${CLI} submit-audit\`)${stale ? `; ${stale} earlier artifact(s) judged records that have since changed and no longer count` : ""}`, 1);
  }
  if (outcome.kind === "inconsistent") fail(`cannot record ${kind} ${subject}: ${outcome.problem}`, 1);
  if (outcome.kind === "blocking") {
    const concepts = [...new Set(outcome.findings.map((finding) => finding.concept))];
    fail(`cannot record ${kind} ${subject}: ${outcome.findings.length} blocking finding(s):\n  ${outcome.findings.map((finding) => findingsReason([finding])).join("\n  ")}\nreopen ${concepts.join(", ")} to repair it (\`${CLI} reopen ${concepts.join(",")} --from-findings\`)`, 1);
  }
  // A resolution is accepted only against findings whose source artifacts are still the files they were at the reopening.
  checkedProvenance(state, verified, `record ${kind} ${subject}`);
  return outcome as Extract<typeof outcome, { kind: "record" }>;
}

/** The attempts behind the artifacts an audit is recorded from: each completed, for this step, with exactly the current inputs. */
function acceptedAttempts(state: RunState, artifacts: readonly { attempt?: string; role: string; auditor: string; subject: string; key: string; seq: number }[]): string[] {
  const accepted = attemptsOf(state, artifacts);
  if ("problem" in accepted) fail(accepted.problem, 1);
  return accepted.ids;
}

/**
 * The attempts an audit would be recorded from, or why recording refuses them; `reconcilable` when `l2 reconcile`
 * settles it (an attempt whose published findings were not yet marked completed). `l2 next --json` reports the same.
 */
function attemptsOf(state: RunState, artifacts: readonly { attempt?: string; role: string; auditor: string; subject: string; key: string; seq: number }[]): { ids: string[] } | { problem: string; reconcilable: boolean } {
  const log = readAttemptLog(attemptsPath(state.domainId), state.domainId);
  const ids: string[] = [];
  for (const artifact of artifacts) {
    const label = `${artifact.role} ${artifact.auditor}`;
    const refuse = (problem: string, reconcilable = false) => ({ problem: `cannot record ${artifact.subject}: ${problem}`, reconcilable });
    if (!artifact.attempt) return refuse(`its ${label} artifact names no attempt, and ${state.domainId} records only attempt-backed findings`);
    const attempt = log.attempts.find((entry) => entry.id === artifact.attempt);
    if (!attempt) return refuse(`its ${label} artifact names attempt ${artifact.attempt}, which is not in the log`);
    if (attempt.status === "committed") return refuse(`attempt ${attempt.id} (${label}) is already committed: a duplicate commit`);
    if (attempt.status !== "completed") return refuse(`attempt ${attempt.id} (${label}) is ${attempt.status}, not completed (\`${CLI} reconcile\`)`, attempt.status === "running" || attempt.status === "interrupted");
    if (attempt.step.role !== artifact.role || attempt.step.auditor !== artifact.auditor || attempt.step.subject !== artifact.subject) return refuse(`attempt ${attempt.id} is ${stepId(attempt.step)}, not the artifact's ${label}`);
    if (currentInputKey(state, attempt.step) !== attempt.inputKey) return refuse(`the inputs of attempt ${attempt.id} (${label}) have changed since it began`, true);
    // The artifact recorded is exactly the output the attempt captured: never another submission naming it.
    const problem = artifactAttemptProblem(attempt, artifact, artifactRef(artifact));
    if (problem) return refuse(problem);
    ids.push(attempt.id);
  }
  return { ids };
}

/** Marks recorded attempts committed; a crash before it is reconciled from the run state's step (l2 reconcile). */
function commitAttempts(state: RunState, ids: readonly string[], reason: string, output?: L2Attempt["output"]) {
  try {
    updateAttemptLog(attemptsPath(state.domainId), state.domainId, (log) => {
      let next = log;
      for (const id of ids) {
        let attempt = attemptIn(next, id);
        if (attempt.status === "running" || attempt.status === "interrupted") attempt = transition(attempt, "completed", now(), "its output was recorded", output ? { output } : {});
        if (attempt.status === "completed") attempt = transition(attempt, "committed", now(), reason);
        next = withAttempt(next, attempt);
      }
      return { log: next, result: undefined };
    });
  } catch (error) {
    console.log(`  note: the step is recorded, but its attempts could not be marked committed (${(error as Error).message}); \`${CLI} reconcile\` completes it`);
  }
}

/**
 * Records a group-batched run's audit from its auditors' artifacts, all or
 * nothing (audit-artifacts.ts commitAuditRecording): the artifacts are read
 * and revalidated against the current records and neighbours, the new group
 * file is built in memory and validated as the l2-check gate would, the run
 * state's step is taken, and only then are the group file and the state
 * written. A refusal at any point writes nothing.
 */
function recordBatchedAudit(state: RunState, kind: "audit" | "group-audit", subject: string, group: string) {
  if (flag("--audit-file")) fail(`${state.domainId} runs group-batched (simplified v2): audits are recorded from submitted findings (\`${CLI} submit-audit\`), never from --audit-file`, 1);
  const record = l2Records(state);
  // The run state this recording is computed from: if another command changes it before the commit, the commit is refused (journaledCommit `expect`).
  const stateBefore = readFileSync(statePath(state.domainId), "utf8");
  if (JSON.stringify(JSON.parse(stateBefore)) !== JSON.stringify(state)) fail(`the run state of ${state.domainId} changed while this command ran: run it again`, 1);
  const accepted = acceptedAudit(state, kind, subject, group);
  const fingerprint = kind === "audit" ? recordFingerprint(recordOf(subject)) : undefined;
  // A tracked run records only artifacts of completed attempts whose inputs are still exactly the current ones.
  const attemptIds = tracksAttempts(state) ? acceptedAttempts(state, accepted.from) : [];
  const at = now();
  const path = join(ROOT, groupFile(group));
  const nextPlan = (text: string) => {
    const plan = JSON.parse(text) as L2GroupFile & { groupAudit?: L2GroupAudit };
    const audit = { at, note: accepted.note, resolutions: accepted.resolutions };
    if (kind === "audit") return withConceptAudit(plan, subject, { ...audit, recordFingerprint: fingerprint!, neighbours: accepted.neighbours ?? {} });
    return { ...plan, groupAudit: { ...audit, records: accepted.from[0].binding.records } };
  };
  const repair = record.repair;
  let result: ReturnType<typeof commitAuditRecording<RunState>>;
  try {
    result = commitAuditRecording<RunState>({
      readGroup: () => readFileSync(path, "utf8"),
      next: (before) => `${JSON.stringify(nextPlan(before), null, 2)}\n`,
      validate: (text) => {
        const plan = JSON.parse(text) as L2GroupFile & { groupAudit?: L2GroupAudit };
        const plans = readPlans().map((entry) => (entry.group === group ? plan : entry));
        const scope = repair
          ? repairScopeProblems({
              baseline: repair.baseline,
              reopened: repair.concepts,
              plans,
              redesigned: new Set(repair.concepts.filter((conceptId) => (record.steps[`design:${conceptId}`]?.at ?? "") >= repair.at)),
              replanned: new Set(repair.groups.filter((entry) => (record.steps[`plan:${entry}`]?.at ?? "") >= repair.at)),
            })
          : [];
        if (kind === "group-audit") return [...groupAuditProblems(plan, mapKnowledge, groupSignalsOf(plan)), ...scope];
        const drafted = record.steps[`author:${subject}`]?.fingerprint;
        if (drafted && drafted !== fingerprint) return [`${subject}'s record changed since it was drafted: an audit that finds a defect reopens it (\`${CLI} reopen ${subject} --from-findings\`), then it is drafted and audited again`];
        const signals = signalsOf(subject, plans);
        return [...workProblems(plan, subject, mapKnowledge, "audited", signals, coverageFor(plans, signals)), ...scope];
      },
      step: () => recordL2Step(state, { kind, subject }, at, { note: flag("--note"), ...(fingerprint ? { fingerprint } : {}), ...(attemptIds.length ? { attempts: attemptIds } : {}) }),
      writeGroup: (text) => {
        const temporary = `${path}.${process.pid}.tmp`;
        writeFileSync(temporary, text);
        renameSync(temporary, path);
      },
      saveState,
      // Both files through the journal: a termination between them is completed on the next command (activeState).
      persist: (text, next, before) =>
        journaledCommit(journalPath(state.domainId), { run: state.domainId, tx: `${kind}:${subject}@${at}`, at, what: `record ${kind} ${subject}`, files: [{ path, text, expect: sha(before) }, { path: statePath(state.domainId), text: `${JSON.stringify(next, null, 2)}\n`, expect: sha(stateBefore) }] }),
    });
  } catch (error) {
    if (error instanceof RunStateError || error instanceof JournalError) fail(`cannot record ${kind} ${subject}: ${error.message}`, 1);
    throw error;
  }
  if (!result.ok) fail(`cannot record ${kind} ${subject}:\n  ${result.problems.join("\n  ")}`, 1);
  if (attemptIds.length) commitAttempts(state, attemptIds, `recorded ${kind} ${subject}`);
  console.log(`recorded ${kind} ${subject} from ${accepted.from.map((artifact) => `${artifact.role} ${artifact.auditor}#${artifact.seq}`).join(" and ")}; ${pendingL2Steps(result.state).length} step(s) to go`);
  commandNext(result.state);
}

/**
 * An auditor submits its findings (`l2 submit-audit <concept|group> --role
 * first-audit|re-audit|group-audit --auditor A|B|R|G --file <json>`): they are
 * checked, bound to the records judged and published as an immutable
 * artifact. Nothing else is written: only the orchestrator records audits.
 */
function commandL2SubmitAudit() {
  const state = activeState();
  if (state.stop) return printStop(state);
  const record = l2Records(state);
  if (!isBatched(pipelineOf(record))) fail(`${state.domainId} runs the ${describePipeline(pipelineOf(record))}: its auditors record with \`${CLI} record audit .. --audit-file\``, 1);
  const subject = positional[0] ?? fail("submit-audit needs the audited concept or group");
  const role = flag("--role") as L2AuditRole;
  if (!(AUDIT_ROLES as readonly string[]).includes(role)) fail(`--role must be one of ${AUDIT_ROLES.join(", ")}`);
  const auditor = flag("--auditor") ?? fail("submit-audit needs --auditor (A or B for a first audit, R for a re-audit, G for a group audit)");
  const file = flag("--file") ?? fail("submit-audit needs --file <findings json>");
  const kind = role === "group-audit" ? "group-audit" : "audit";
  const group = kind === "group-audit" ? subject : record.slice.groups.find((entry) => entry.concepts.includes(subject))?.group;
  const sliceGroup = record.slice.groups.find((entry) => entry.group === group);
  if (!group || !sliceGroup) fail(`${subject} is not a ${kind === "group-audit" ? "group" : "concept"} of this run`, 1);
  // Every draft of the group comes before any of its audits: the auditors judge each record with its siblings in place.
  const undrafted = pendingDrafts(state, group);
  if (undrafted.length) fail(`${group}'s drafts come before its audits: ${undrafted.join(", ")} not drafted yet`, 1);
  const need = auditNeed(state, kind, subject);
  if (role !== need) fail(`${subject} needs a ${need} now, not a ${role}`, 1);
  // Each auditor writes and submits only its own private file: two auditors can never submit each other's findings.
  const misfiled = inboxProblem(file, auditorInbox(runWorkDir(state), subject, role, auditor));
  if (misfiled) fail(misfiled, 1);
  let input: L2FindingsInput;
  try {
    input = JSON.parse(readFileSync(file, "utf8")) as L2FindingsInput;
  } catch (error) {
    fail(`cannot read the findings in ${file}: ${(error as Error).message}`, 1);
  }
  const verified = checkedProvenance(state, verificationItems(state, kind, subject, group), `submit ${subject}'s ${role}`);
  const problems = findingsProblems(input, { role, auditor, concepts: auditedConcepts(kind, subject, group), textOf: recordText, verify: verified.map((item) => item.id) });
  if (problems.length) fail(`the findings are not a valid ${role}:\n  ${problems.join("\n  ")}`, 1);
  const binding = currentBinding(state, kind, subject, group);
  const attemptId = flag("--attempt");
  if (attemptId && !tracksAttempts(state)) fail(`${state.domainId} does not track attempts: submit without --attempt`, 1);
  if (tracksAttempts(state) && !attemptId) fail(`${state.domainId} tracks attempts: submit with --attempt <id> (the attempt \`${CLI} audit-task\` began)`, 1);
  const publish = () => submitArtifact(auditWorkDir(state), { run: state.domainId, subject, role, auditor, at: now(), binding, verdict: input.verdict, note: input.note, findings: input.findings, ...(input.resolutions ? { resolutions: input.resolutions } : {}), ...(Array.isArray(input.verifications) ? { verifications: input.verifications } : {}), ...(attemptId ? { attempt: attemptId } : {}) });
  // A tracked run's findings belong to the auditor's attempt, and only for exactly the evidence the attempt began with. The
  // check, the publication and the attempt's completion happen under the attempt log's lock: one attempt publishes one artifact,
  // however many submissions race. Published first, then completed: a crash between them is reconciled from the artifact.
  let submitted: ReturnType<typeof publish>;
  try {
    submitted = !attemptId
      ? publish()
      : updateAttemptLog(attemptsPath(state.domainId), state.domainId, (log) => {
        const attempt = log.attempts.find((entry) => entry.id === attemptId) ?? attemptFailure(`no attempt ${attemptId} in ${state.domainId}`);
        if (attempt.step.kind !== kind || attempt.step.subject !== subject || attempt.step.role !== role || attempt.step.auditor !== auditor) attemptFailure(`attempt ${attemptId} is ${stepId(attempt.step)}, not ${kind}:${subject}:${role}:${auditor}`);
        if (attempt.status !== "running" && attempt.status !== "interrupted") attemptFailure(`attempt ${attemptId} is ${attempt.status}: only a launched attempt submits its findings${attempt.output ? ` (its output is ${attempt.output.ref})` : ""}`);
        if (!attempt.binding || bindingKey(attempt.binding, subject) !== bindingKey(binding, subject)) attemptFailure(`the records or neighbours have changed since attempt ${attemptId} began: its findings judged other evidence and are not submitted; fail it (\`${CLI} attempt fail ${attemptId} --reason ..\`) and audit again`);
        const published = publish();
        const completed = transition(attempt, "completed", now(), "its findings were submitted", { output: { kind: "artifact", ref: artifactRef(published.artifact), key: published.artifact.key, at: now() } });
        return { log: withAttempt(log, completed), result: published };
      });
  } catch (error) {
    // Refused inside the lock by throwing, so the lock is released before the process exits.
    if (error instanceof AttemptError) fail(error.message, 1);
    throw error;
  }
  const { path, artifact } = submitted;
  console.log(`submitted ${role} ${artifact.seq} of ${subject} by auditor ${auditor}: ${artifact.verdict}, ${artifact.findings.filter((finding) => finding.severity === "blocking").length} blocking, ${artifact.findings.filter((finding) => finding.severity === "advisory").length} advisory (${path}); nothing recorded: the orchestrator records it`);
}

/**
 * One auditor's own task (`l2 audit-task <concept|group> --role <r> --auditor <x>`): a separate prompt for each
 * auditor, naming only its private findings file. The orchestrator gives each to its own fresh agent.
 */
function commandL2AuditTask() {
  const state = activeState();
  const record = l2Records(state);
  if (!isBatched(pipelineOf(record))) fail(`${state.domainId} runs the ${describePipeline(pipelineOf(record))}: its audits follow ${PIPELINES[pipelineOf(record).mode].instructions}audit.md`, 1);
  const subject = positional[0] ?? fail("audit-task needs the concept or group to audit");
  const role = flag("--role") as L2AuditRole;
  if (!(AUDIT_ROLES as readonly string[]).includes(role)) fail(`--role must be one of ${AUDIT_ROLES.join(", ")}`);
  const auditor = flag("--auditor") ?? fail("audit-task needs --auditor (A or B for a first audit, R for a re-audit, G for a group audit)");
  if (!AUDITORS[role].includes(auditor)) fail(`a ${role} is performed by auditor ${AUDITORS[role].join(" or ")}, not ${auditor}`, 1);
  const inbox = auditorInbox(runWorkDir(state), subject, role, auditor);
  mkdirSync(dirname(inbox), { recursive: true });
  const kind = role === "group-audit" ? "group-audit" : "audit";
  // A repair's verifier gets exactly the findings its repair answered, their provenance confirmed first; a first auditor gets none.
  const group = kind === "group-audit" ? subject : groupOfConcept(state, subject);
  const repairs = group && role !== "first-audit" ? checkedProvenance(state, verificationItems(state, kind, subject, group), `give ${subject}'s ${role} its findings`) : [];
  // A tracked run begins the auditor's attempt here, its inputs persisted before any launch.
  const attempt = record.attempts ? beginRunAttempt(state, { kind, subject, role, auditor }) : undefined;
  if (attempt) console.log(`attempt ${attempt.id} begun; launch this prompt as a new agent described \`${taskDescription(attempt)}\`\n`);
  console.log(auditTaskPrompt({ run: state.domainId, subject, role, auditor, inbox, instructions: PIPELINES[pipelineOf(record).mode].instructions, ...(attempt ? { attempt: attempt.id } : {}), ...(repairs.length ? { repairs } : {}) }));
}

/** The orchestrator's view of a subject's findings against its current records (`l2 findings <concept|group>`). Auditors never read it. */
function commandL2Findings() {
  const state = activeState();
  const record = l2Records(state);
  const subject = positional[0] ?? fail("findings needs a concept or group of the run");
  const isGroup = record.slice.groups.some((entry) => entry.group === subject);
  const group = isGroup ? subject : record.slice.groups.find((entry) => entry.concepts.includes(subject))?.group;
  if (!group) fail(`${subject} is not a concept or group of this run`, 1);
  const kind = isGroup ? "group-audit" : "audit";
  const need = isGroup ? "group-audit" : auditNeed(state, "audit", subject);
  const all = checkedArtifacts(state, kind, subject, group, `read the findings of ${subject}`);
  // Independence: neither first audit's findings are shown, by this command, before both first audits are in.
  const withheld = need === "first-audit" && auditOutcome(all, "first-audit").kind === "missing" ? all.filter((artifact) => artifact.role === "first-audit") : [];
  const artifacts = all.filter((artifact) => !withheld.includes(artifact));
  if (flags.has("--json")) return console.log(JSON.stringify(artifacts, null, 2));
  if (withheld.length) console.log(`first audits submitted by ${[...new Set(withheld.map((artifact) => artifact.auditor))].join(", ")}; their findings are withheld until both first audits are in`);
  // Older evidence is named apart from the current artifacts, and never counts: a repair's own findings, and artifacts bound to changed records.
  const stale = staleArtifacts(auditWorkDir(state), subject, bindingKey(currentBinding(state, kind, subject, group), subject));
  const history = [
    ...(!isGroup && state.l2?.repair?.evidence?.[subject] ? [`historical: ${subject}'s own findings in repair cycle ${state.l2.repair.cycle}, which judged its record before the repair: \`${CLI} repair-findings ${subject}\` (never current evidence)`] : []),
    ...(stale ? [`stale: ${stale} earlier artifact(s) of ${subject} judged records (its own or a neighbour's) that have since changed; they never count`] : []),
  ];
  if (!all.length) return console.log([`no findings submitted for ${subject} as its records are now`, ...history].join("\n"));
  if (!artifacts.length) return console.log([`outcome: waiting for ${(auditOutcome(all, "first-audit") as { missing: string[] }).missing.join(" and ")}`, ...history].join("\n"));
  for (const artifact of artifacts) {
    console.log(`${artifact.role} ${artifact.auditor} #${artifact.seq} ${artifact.verdict} (${artifact.at})`);
    for (const finding of artifact.findings) console.log(`  ${finding.severity} ${findingsReason([{ ...finding, auditor: artifact.auditor, role: artifact.role }])}`);
  }
  const outcome = confirmedOutcome(state, auditOutcome(artifacts, need, verificationIds(state, kind, subject, group)), kind, subject, group);
  console.log(`outcome: ${outcome.kind === "record" ? `ready to record (\`${CLI} record ${isGroup ? "group-audit" : "audit"} ${subject}\`)` : outcome.kind === "missing" ? `waiting for ${outcome.missing.join(" and ")}` : outcome.kind === "blocking" ? `${outcome.findings.length} blocking finding(s): reopen (\`${CLI} reopen <id> --from-findings\`)` : outcome.problem}`);
  for (const line of history) console.log(line);
}

/**
 * A reopened concept's own findings in the open repair cycle (`l2 repair-findings <concept> [--json]`), for its
 * repairer and the orchestrator: exactly what each reopening answered, with the source artifact of each finding,
 * whose provenance is confirmed (present, unchanged) or the command refuses. Historical evidence: it judged the
 * record before the repair, stays readable after any sibling's repair, and is never a current audit. Reads only.
 */
function commandL2RepairFindings() {
  const state = activeState();
  const subject = positional[0] ?? fail("repair-findings needs a reopened concept");
  const repair = state.l2?.repair;
  if (!repair?.concepts.includes(subject)) fail(`${subject} is not reopened in an open repair cycle of ${state.domainId}`, 1);
  const evidence = repair.evidence?.[subject];
  if (!evidence?.length) fail(`${subject} was reopened before repair evidence was kept: its findings exist only in the cycle's combined reason, so the orchestrator gives its repairer and re-auditor ${subject}'s findings by hand`, 1);
  const items = checkedProvenance(state, repairItems(evidence), `show ${subject}'s repair findings`);
  if (flags.has("--json")) return console.log(JSON.stringify({ run: state.domainId, concept: subject, cycle: repair.cycle, status: "historical", current: false, items: items.map((item) => ({ id: item.id, at: item.at, ...(item.finding ? { finding: item.finding } : { reason: item.reason }) })) }, null, 2));
  console.log(`${subject}: ${items.length} finding(s) to answer in repair cycle ${repair.cycle}. HISTORICAL: they judged ${subject}'s record before the repair; they are not current audit evidence and never an approval: its re-audit verifies each in the record as repaired.`);
  for (const item of items) console.log(`${item.id} ${item.text}${item.finding ? `\n    from ${item.finding.artifact.path} (judged record ${item.finding.artifact.judged?.slice(0, 12) ?? "?"}, provenance confirmed)` : ""}`);
}

/**
 * The blocking findings against reopened concepts' current records, as a repair reason (`l2 reopen --from-findings`),
 * and as each concept's own repair evidence: its findings, each with its source artifact (path, binding key, the
 * file's sha256) and the record it judged, so they stay retrievable once a sibling's repair has made them stale.
 */
function reasonFromFindings(state: RunState, concepts: readonly string[], at: string): { reason: string; evidence: Record<string, L2RepairEvidence> } {
  const record = l2Records(state);
  const findings = concepts.flatMap((conceptId) => {
    const group = record.slice.groups.find((entry) => entry.concepts.includes(conceptId))?.group;
    if (!group) fail(`${conceptId} is not a concept of this slice`, 1);
    const own = auditOutcome(checkedArtifacts(state, "audit", conceptId, group, `reopen ${conceptId} from its findings`), auditNeed(state, "audit", conceptId));
    const ofGroup = auditOutcome(checkedArtifacts(state, "group-audit", group, group, `reopen ${conceptId} from its findings`), "group-audit");
    return [...(own.kind === "blocking" ? own.findings : []), ...(ofGroup.kind === "blocking" ? ofGroup.findings.filter((finding) => finding.concept === conceptId) : [])];
  });
  if (!findings.length) fail(`no blocking finding is submitted against ${concepts.join(", ")} as recorded now: give --reason`, 1);
  const dir = auditWorkDir(state);
  const evidence = Object.fromEntries(concepts.map((conceptId) => [conceptId, {
    at,
    findings: findings.filter((finding) => finding.concept === conceptId).map(({ source, ...finding }) => {
      const path = artifactPath(dir, { ...source, role: finding.role, auditor: finding.auditor });
      return { ...finding, artifact: { path: relative(dir, path), key: source.key, sha256: createHash("sha256").update(readFileSync(path)).digest("hex"), judged: recordFingerprint(recordOf(conceptId)) } };
    }),
  }]));
  return { reason: findingsReason(findings), evidence };
}

/** What a repair changed: the record its failing audit judged against the record now (`l2 repair-diff <concept>`). */
function commandL2RepairDiff() {
  const state = activeState();
  const conceptId = positional[0] ?? fail("repair-diff needs a reopened concept");
  const before = state.l2?.repair?.records?.[conceptId] as MapConceptContent | undefined;
  if (!before) fail(`${conceptId} has no pre-repair record in the open repair cycle (it is not reopened, or was reopened before snapshots were kept)`, 1);
  if (flags.has("--json")) return console.log(JSON.stringify(recordDiff(before, recordOf(conceptId)), null, 2));
  console.log(formatRecordDiff(before, recordOf(conceptId)));
}

// ---------------------------------------------------------------- attempts (l2/attempts.ts)

/** A refusal inside a lock: thrown, never `fail` (which exits holding the lock), and reported once the lock is released. */
const attemptFailure = (message: string): never => {
  throw new AttemptError(message);
};
/** An artifact's reference, as an attempt's output names it. */
const artifactRef = (artifact: { role: string; auditor: string; seq: number }) => `${artifact.role}-${artifact.auditor}-${String(artifact.seq).padStart(3, "0")}`;
/** Whether a run tracks attempts: group-batched runs started since attempts existed. */
const tracksAttempts = (state: RunState) => Boolean(state.l2?.attempts) && isBatched(pipelineOf(state.l2!));
const groupOfConcept = (state: RunState, conceptId: string) => state.l2!.slice.groups.find((entry) => entry.concepts.includes(conceptId))?.group;
/** The task description an attempt's agent is launched with: its role, subject and marker. */
const taskDescription = (attempt: L2Attempt) => `${{ author: "Author", repair: "Repair", "first-audit": `First audit ${attempt.step.auditor ?? ""}`.trim(), "re-audit": "Re-audit", "group-audit": "Group audit" }[attempt.step.role]} ${attempt.step.subject} ${attemptMarker(attempt.id)}`;

/** The role a step of `kind` has for `subject` now: drafting or repair, a first audit or a re-audit, a group audit. */
function expectedRole(state: RunState, kind: L2AttemptStep["kind"], subject: string): L2AttemptRole {
  if (kind === "group-audit") return "group-audit";
  if (kind === "author") return state.l2!.repair?.concepts.includes(subject) ? "repair" : "author";
  return auditNeed(state, "audit", subject) as L2AttemptRole;
}

/**
 * An attempt's input identity as the repository holds it now. A draft or repair
 * judges its group's territory (the group file without its audits), its repair
 * cycle and the record its failing audit judged; an audit judges its complete
 * binding: the records and every neighbour's (or every member's for a group).
 */
function attemptInputs(state: RunState, step: L2AttemptStep): { inputs: Record<string, string>; binding?: L2AuditBinding } {
  const group = step.kind === "group-audit" ? step.subject : groupOfConcept(state, step.subject);
  if (!group) throw new AttemptError(`${step.subject} is not a ${step.kind === "group-audit" ? "group" : "concept"} of ${state.domainId}`);
  if (step.kind === "author") {
    const repair = state.l2!.repair;
    const repairing = repair?.concepts.includes(step.subject);
    const before = repairing ? (repair!.records?.[step.subject] as MapConceptContent | undefined) : undefined;
    return { inputs: { plan: sha(groupFileWithoutAudits(readFileSync(join(ROOT, groupFile(group)), "utf8"))), cycle: String(repairing ? repair!.cycle : 0), before: before ? recordFingerprint(before) : "none" } };
  }
  const binding = currentBinding(state, step.kind, step.subject, group);
  return { inputs: { binding: bindingKey(binding, step.subject) }, binding };
}
const currentInputKey = (state: RunState, step: L2AttemptStep) => {
  try {
    return inputKeyOf(state.domainId, step, pipelineOf(state.l2!), attemptInputs(state, step).inputs);
  } catch {
    return undefined;
  }
};
const attemptStepKey = (step: L2AttemptStep) => `${step.kind}:${step.subject}`;

/** What durable evidence says about an attempt now (attempts.ts L2AttemptEvidence). */
function attemptEvidence(state: RunState, attempt: L2Attempt, sessions: readonly L2SpendSession[]): L2AttemptEvidence {
  const recorded = state.l2!.steps[attemptStepKey(attempt.step)];
  const committed = Boolean(recorded?.attempts?.includes(attempt.id));
  const inputKey = currentInputKey(state, attempt.step);
  const marker = attemptMarker(attempt.id);
  const own = sessions.filter((session) => session.description.includes(marker));
  let output: L2AttemptEvidence["output"] = { state: "missing" };
  if (attempt.step.kind === "author") {
    if (committed && recorded?.fingerprint) output = { state: "valid", ref: recorded.fingerprint, key: attempt.inputKey };
    else if (recordOf(attempt.step.subject)) output = { state: "missing", detail: "a draft is in data.ts but was never recorded with this attempt" };
  } else if (attempt.binding) {
    const group = attempt.step.kind === "group-audit" ? attempt.step.subject : groupOfConcept(state, attempt.step.subject)!;
    const stale = inputKey !== attempt.inputKey;
    try {
      const named = readArtifacts(auditWorkDir(state), { run: state.domainId, subject: attempt.step.subject, binding: attempt.binding, concepts: auditedConcepts(attempt.step.kind, attempt.step.subject, group), textOf: recordText }).filter((artifact) => artifact.attempt === attempt.id);
      // An attempt's output is one artifact of its own step, the one it captured: another naming it is not its output.
      const problems = named.map((artifact) => artifactAttemptProblem(attempt, artifact, artifactRef(artifact))).filter(Boolean);
      const found = named.find((artifact) => !artifactAttemptProblem(attempt, artifact, artifactRef(artifact)));
      if (problems.length && (!attempt.output || named.length > 1)) output = { state: "invalid", detail: problems.join("; ") };
      else if (found) output = { state: stale ? "stale" : "valid", ref: artifactRef(found), key: found.key, ...(stale ? { detail: "the records or neighbours it judged have changed" } : {}) };
    } catch (error) {
      if (!(error instanceof AuditArtifactError)) throw error;
      // An artifact for older evidence is read against the current record text, so it may no longer validate: stale before invalid.
      output = stale ? { state: "stale", detail: "the records or neighbours it judged have changed" } : { state: "invalid", detail: (error as Error).message };
    }
  }
  return { ...(inputKey ? { inputKey } : {}), output, committed, sessions: own };
}

/** Every attempt of the run reconciled against its evidence: applied under the log's lock, or only reported. */
function reconcileAttempts(state: RunState, apply: boolean) {
  const sessions = measure(state);
  const path = attemptsPath(state.domainId);
  const run = (log: L2AttemptLog) => {
    const results = log.attempts.map((attempt) => reconcile(attempt, attemptEvidence(state, attempt, sessions), now()));
    return { log: { ...log, attempts: results.map((result) => result.attempt) }, result: results };
  };
  return apply ? updateAttemptLog(path, state.domainId, run) : run(readAttemptLog(path, state.domainId)).result;
}

/** Begins an attempt for a step of a tracked run (reconciling first), or refuses why it must not start. */
function beginRunAttempt(state: RunState, step: L2AttemptStep): L2Attempt {
  if (!tracksAttempts(state)) fail(`${state.domainId} does not track attempts (${state.l2?.attempts ? describePipeline(pipelineOf(state.l2)) : "it predates attempt tracking, or is not a simplified v2 run"}): its steps run as before, without attempt records`, 1);
  const expected = expectedRole(state, step.kind, step.subject);
  if (step.role !== expected) fail(`${step.subject} needs a ${expected} attempt now, not a ${step.role}`, 1);
  // Every tracked model launch begins here: a run outside the batch limit it was started under launches nothing.
  const overLimit = batchLimitProblem(state);
  if (overLimit) fail(overLimit, 1);
  if (step.kind !== "author") {
    const group = step.kind === "group-audit" ? step.subject : groupOfConcept(state, step.subject);
    const undrafted = group ? pendingDrafts(state, group) : [];
    if (undrafted.length) fail(`${group}'s drafts come before its audits: ${undrafted.join(", ")} not drafted yet`, 1);
    if (!(AUDITORS[step.role as L2AuditRole] ?? []).includes(step.auditor ?? "")) fail(`a ${step.role} is performed by auditor ${AUDITORS[step.role as L2AuditRole].join(" or ")}`, 1);
  }
  reconcileAttempts(state, true);
  try {
    const { inputs, binding } = attemptInputs(state, step);
    return updateAttemptLog(attemptsPath(state.domainId), state.domainId, (log) => {
      const begun = beginAttempt(log, { step, pipeline: { mode: pipelineOf(state.l2!).mode, version: pipelineOf(state.l2!).version }, inputs, ...(binding ? { binding } : {}), ...(flag("--model") ? { model: flag("--model") } : {}), now: now() });
      return { log: begun.log, result: begun.attempt };
    });
  } catch (error) {
    if (error instanceof AttemptError) fail(error.message, 1);
    throw error;
  }
}

/** `l2 attempts [--json]`: every attempt, what its evidence says, and the decision it waits for. Writes nothing. */
function commandL2Attempts() {
  const state = activeState();
  if (!tracksAttempts(state)) return console.log(`${state.domainId} does not track attempts: ${state.l2?.attempts ? "it is not group-batched" : "it was started before attempt tracking, or is a legacy or simplified v1 run"}; its steps run as before`);
  const results = reconcileAttempts(state, false);
  if (flags.has("--json")) return console.log(JSON.stringify(results.map((result) => ({ attempt: result.attempt, wouldChange: result.changed, explanation: result.explanation, ...(result.decision ? { decision: result.decision } : {}) })), null, 2));
  if (!results.length) return console.log(`no attempts in ${state.domainId}`);
  for (const result of results) {
    const attempt = result.attempt;
    console.log(`${attempt.id} ${stepId(attempt.step).padEnd(48)} ${attempt.status}${result.changed ? " (reconcile would update it)" : ""}${attempt.usage ? ` $${attempt.usage.usd.toFixed(2)}` : ""}: ${result.explanation}`);
    if (result.decision) console.log(`  DECISION NEEDED: ${result.decision}`);
  }
}

/** `l2 reconcile [--json]`: recovers an interrupted commit (on load) and moves each attempt as its evidence requires. Idempotent. */
function commandL2Reconcile() {
  const state = activeState();
  if (!tracksAttempts(state)) return console.log(`${state.domainId} does not track attempts: nothing to reconcile beyond its commit journal (none pending)`);
  const results = reconcileAttempts(state, true);
  if (flags.has("--json")) return console.log(JSON.stringify(results.map((result) => ({ id: result.attempt.id, status: result.attempt.status, changed: result.changed, explanation: result.explanation, ...(result.decision ? { decision: result.decision } : {}) })), null, 2));
  const changed = results.filter((result) => result.changed);
  for (const result of changed) console.log(`${result.attempt.id} ${stepId(result.attempt.step)} -> ${result.attempt.status}: ${result.explanation}`);
  for (const result of results.filter((entry) => entry.decision)) console.log(`DECISION NEEDED ${result.attempt.id}: ${result.decision}`);
  console.log(`${changed.length} of ${results.length} attempt(s) updated; ${results.filter((entry) => entry.decision).length} wait for a decision`);
}

/**
 * `l2 attempt begin <author|audit|group-audit> <subject> --role <r> [--auditor X] [--model m]`,
 * `launch <id> --ref <launch reference>` (a launcher other than the hook), `fail <id> --reason ..`,
 * `interrupt <id> --reason ..` (its process is gone), `decide <id> --relaunch|--abandon --reason ..`,
 * `release <id> --reason ..` (a resolved attempt's unmeasured reserve), `show <id>`.
 */
function commandL2Attempt() {
  const state = activeState();
  const sub = positional[0];
  if (sub === "begin") {
    const kind = positional[1] as L2AttemptStep["kind"];
    if (!["author", "audit", "group-audit"].includes(kind)) fail("attempt begin <author|audit|group-audit> <subject> --role <role> [--auditor X]");
    const subject = positional[2] ?? fail("attempt begin needs the subject");
    const role = (flag("--role") ?? expectedRole(state, kind, subject)) as L2AttemptRole;
    const attempt = beginRunAttempt(state, { kind, subject, role, ...(flag("--auditor") ? { auditor: flag("--auditor") } : {}) });
    if (flags.has("--json")) return console.log(JSON.stringify(attempt, null, 2));
    console.log(`attempt ${attempt.id} begun (pending) for ${stepId(attempt.step)}; launch its agent described \`${taskDescription(attempt)}\`${kind === "author" ? `, and record its draft with \`${CLI} record author ${subject} --attempt ${attempt.id}\`` : ""}`);
    // A draft's or repair's prompt, ready to give unedited (an audit's comes from \`l2 audit-task\`).
    if (kind === "author") console.log(`\n${draftTaskPrompt({ run: state.domainId, subject, group: groupOfConcept(state, subject)!, role: attempt.step.role === "repair" ? "repair" : "author", instructions: PIPELINES[pipelineOf(state.l2!).mode].instructions, attempt: attempt.id, ...(state.l2!.repair ? { cycle: state.l2!.repair.cycle } : {}) })}`);
    return;
  }
  if (!tracksAttempts(state)) fail(`${state.domainId} does not track attempts`, 1);
  const id = positional[1] ?? fail(`attempt ${sub ?? "<command>"} needs an attempt id`);
  const change = (make: (attempt: L2Attempt) => L2Attempt) => {
    try {
      return updateAttemptLog(attemptsPath(state.domainId), state.domainId, (log) => {
        const next = make(attemptIn(log, id));
        return { log: withAttempt(log, next), result: next };
      });
    } catch (error) {
      if (error instanceof AttemptError) fail(error.message, 1);
      throw error;
    }
  };
  const reason = () => flag("--reason") ?? fail("give --reason \"..\"");
  switch (sub) {
    case "show": {
      const log = readAttemptLog(attemptsPath(state.domainId), state.domainId);
      const attempt = log.attempts.find((entry) => entry.id === id) ?? fail(`no attempt ${id}`, 1);
      const evidence = attemptEvidence(state, attempt, measure(state));
      return console.log(JSON.stringify({ attempt, evidence: { ...evidence, sessions: evidence.sessions.length }, reconciliation: reconcile(attempt, evidence, now()) }, null, 2));
    }
    case "launch": {
      // A launcher other than the Claude Code hook reserves under the same cap: the launch is refused, and the attempt stays pending, when it does not fit.
      const ref = flag("--ref") ?? fail("attempt launch needs --ref <the launcher's reference for the session>");
      const budget = state.l2?.budget ?? fail(`${state.domainId} has no budget: every L2 run is capped`, 1);
      const attempt = readAttemptLog(attemptsPath(state.domainId), state.domainId).attempts.find((entry) => entry.id === id) ?? fail(`no attempt ${id} in ${state.domainId}`, 1);
      let launched: ReturnType<typeof launchAttempt>;
      try {
        launched = launchAttempt({ attemptsPath: attemptsPath(state.domainId), ledgerPath: ledgerPath(state.domainId), run: state.domainId, budget, measure: () => measure(state), id, ref, description: taskDescription(attempt), now: now() });
      } catch (error) {
        if (error instanceof AttemptError || error instanceof BudgetLockError) fail(`attempt ${id} was not launched: ${error.message}`, 1);
        throw error;
      }
      if (!launched.ok) fail(`attempt ${id} was not launched: ${launched.problem}${launched.status ? `. ${describeBudget(launched.status)}` : ""}`, 1);
      return console.log(`${id} running (launch ${ref} reserved; it holds until its session is measured or a human releases it: \`${CLI} budget release ${ref} --reason ..\`)`);
    }
    case "release": {
      // A resolved attempt whose spend was never measured keeps its reserve until a human says what it cost is accounted for.
      const next = change((attempt) => releaseHold(attempt, flag("--reason"), now()));
      return console.log(`${next.id}: its reserve is released (${next.holdReleased!.reason}); its spend is no longer held against the cap`);
    }
    case "fail":
      return console.log(`${change((attempt) => transition(attempt, "failed", now(), reason())).id} failed`);
    case "interrupt":
      return console.log(`${change((attempt) => transition(attempt, "interrupted", now(), reason())).id} interrupted: decide it before beginning another (\`${CLI} attempt decide ${id} --relaunch|--abandon --reason ..\`)`);
    case "decide": {
      const kind = flags.has("--relaunch") ? "relaunch" : flags.has("--abandon") ? "abandon" : fail("attempt decide needs --relaunch or --abandon");
      if (flags.has("--relaunch") && flags.has("--abandon")) fail("attempt decide takes --relaunch or --abandon, not both");
      const next = change((attempt) => decide(attempt, kind, flag("--reason"), now()));
      return console.log(`${next.id} failed by decision (${kind})${kind === "relaunch" ? `; begin a new attempt for ${stepId(next.step)}` : ""}`);
    }
    default:
      fail("attempt begin|launch|fail|interrupt|decide|release|show");
  }
}

// ---------------------------------------------------------------- budget

/** The run's hard spending cap from `--budget-usd` (and `--reserve`, `--headroom-usd`), or a refusal: every L2 run is capped. */
function startBudgetOrFail(): L2Budget {
  try {
    return startBudget(flag("--budget-usd"), flag("--reserve"), now(), flag("--headroom-usd"));
  } catch (error) {
    if (error instanceof BudgetError) fail(error.message, 1);
    throw error;
  }
}

/** A cap nobody enforces is no cap: a run starts only where the launch hook is registered. */
const budgetHookProblems = () =>
  hookInstalled()
    ? []
    : [`the L2 budget hook is not registered, so nothing would enforce the cap before an Agent launch: add this to .claude/settings.local.json (or settings.json), then start again:\n${JSON.stringify(HOOK_SETTINGS, null, 2)}`];

/** `l2 status`'s budget line: measured spend, open reservations and what is available. */
function budgetLine(state: RunState): string {
  const budget = state.l2?.budget;
  if (!budget) return `budget: none (the run predates spending caps; \`${CLI} budget set --usd <n> --decision ".."\` sets one)`;
  const sessions = measure(state);
  const ledger = readLedger(ledgerPath(state.domainId), state.domainId);
  const status = budgetStatus(budget, sessions, ledger, state.l2?.attempts ? attemptsAdapter.extra(state.domainId, sessions, ledger, budget) : {});
  const exhausted = launchProblem(budget, status, Object.entries(budget.reserves).sort((a, b) => a[1] - b[1])[0][0]);
  return `${describeBudget(status)}${exhausted ? `\nBUDGET: ${exhausted}; no model work starts until a human decides (\`${CLI} budget set|release\`)` : ""}`;
}

/**
 * The run's spending cap (l2/budget.ts): its status; `hook` (the settings
 * entry that registers the launch hook); `reserve --role <r>` (for a launcher
 * other than the Agent hook: refuses, exit 1, when the budget does not allow
 * it); `release <id> --reason ".."` (a launch whose session will not report
 * finishing); `set --usd <n> --decision ".."` (a human's new cap).
 */
function commandL2Budget() {
  const sub = positional[0] ?? "status";
  if (sub === "hook") return console.log(JSON.stringify(HOOK_SETTINGS, null, 2));
  let state = activeState();
  const path = ledgerPath(state.domainId);
  const fromBudget = (run: () => void) => {
    try {
      run();
    } catch (error) {
      if (error instanceof BudgetError || error instanceof BudgetLockError) fail(error.message, 1);
      throw error;
    }
  };
  switch (sub) {
    case "status": {
      const budget = state.l2?.budget;
      if (!budget) return console.log(budgetLine(state));
      const sessions = measure(state);
      const ledger = readLedger(path, state.domainId);
      const status = budgetStatus(budget, sessions, ledger, state.l2?.attempts ? attemptsAdapter.extra(state.domainId, sessions, ledger, budget) : {});
      if (flags.has("--json")) return console.log(JSON.stringify({ budget, status }, null, 2));
      console.log(budgetLine(state));
      for (const entry of status.open) console.log(`  open ${entry.id} ${entry.role}: holds $${entry.heldUsd.toFixed(2)} (spent $${entry.spentUsd.toFixed(2)}), since ${entry.at}${entry.reporting ? "" : ", no session reporting yet"}${entry.description ? ` (${entry.description})` : ""}`);
      for (const change of budget.changes ?? []) console.log(`  cap set to $${change.capUsd.toFixed(2)} at ${change.at}: ${change.decision}`);
      return;
    }
    case "reserve":
      return fromBudget(() => {
        const budget = state.l2?.budget ?? fail("this run has no spending cap: nothing to reserve against");
        const role = flag("--role") ?? fail("budget reserve needs --role <plan|author|first-audit|repair|re-audit|group-audit|...>");
        const result = reserveUnderLock({ ledgerPath: path, run: state.domainId, budget, measure: () => measure(state), launch: { id: flag("--id") ?? `launch-${Date.now()}-${process.pid}`, role, at: now(), ...(flag("--description") ? { description: flag("--description") } : {}) } });
        if (!result.ok) {
          console.error(`refused: ${result.problem}\n${describeBudget(result.status)}`);
          process.exit(1);
        }
        console.log(`reserved a ${role} launch; ${describeBudget(result.status)}`);
      });
    case "release":
      return fromBudget(() => {
        const id = positional[1] ?? fail('budget release needs the reservation id: l2 budget release <id> --reason ".."');
        withLock(path, () => writeLedger(path, releaseLaunch(readLedger(path, state.domainId), id, flag("--reason"), now())));
        console.log(`released ${id}`);
      });
    case "set":
      return fromBudget(() => {
        const decision = flag("--decision");
        const budget = state.l2?.budget ? changeCap(state.l2.budget, flag("--usd"), decision, now()) : changeCap(startBudget(flag("--usd"), flag("--reserve"), now(), flag("--headroom-usd")), flag("--usd"), decision, now());
        state = { ...state, l2: { ...state.l2!, budget } };
        saveState(state);
        console.log(budgetLine(state));
      });
    default:
      fail(`unknown budget command ${sub}: status, hook, reserve, release, set`);
  }
}

/**
 * Reopens drafted concepts for repair (reopenL2): after their audit, their
 * group's audit, or a human review of the run's PR. A concept past its
 * repair allowance stops the run for a human.
 */
function commandL2Reopen() {
  let state = activeState();
  if (state.stop) return printStop(state);
  // A run whose PR exists is reopened only while that PR is known to be unmerged; refused before anything is recorded.
  if (state.pr) {
    const viewed = sh("gh", ["pr", "view", String(state.pr.number), "--json", "state"]);
    const problem = reopenPrProblem(state, viewed.ok ? (JSON.parse(viewed.out) as { state: string }) : undefined);
    if (problem) fail(problem, 1);
  }
  verifyGit(state);
  const concepts = (positional[0] ?? fail(`reopen needs concept ids: ${CLI} reopen <id>[,<id>..] --reason ".."`)).split(",").map((conceptId) => conceptId.trim()).filter(Boolean);
  if (flag("--reason") && flags.has("--from-findings")) fail("reopen takes --reason or --from-findings, not both");
  const at = now();
  const batched = isBatched(pipelineOf(l2Records(state)));
  const fromFindings = flags.has("--from-findings") ? reasonFromFindings(state, concepts, at) : undefined;
  const reason = fromFindings?.reason ?? flag("--reason") ?? fail("reopen needs --reason: the finding the repair answers (or --from-findings in a group-batched run)");
  // Each concept's own findings (or the human's reason) stay with the cycle for its repairer and re-auditor (`l2 repair-findings`).
  const evidence = !batched ? undefined : fromFindings?.evidence ?? Object.fromEntries(concepts.map((conceptId) => [conceptId, { at, findings: [], reason }]));
  try {
    // The records as the failing audit judged them: what `repair-diff` compares the repair against.
    state = reopenL2(state, { concepts, reason, baseline: repairBaseline(readPlans(), concepts), now: at, records: Object.fromEntries(concepts.map((conceptId) => [conceptId, recordOf(conceptId) ?? null])), ...(evidence ? { evidence } : {}) });
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
  console.log(`reopened ${concepts.join(", ")} in repair cycle ${state.l2!.repair!.cycle}: ${verbose ? state.l2!.repair!.reason : latestRepairReason(state.l2!.repair!.reason)}`);
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
    trackedChanges: changesBlockingMerge(state),
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
  // An open repair's uncommitted content may stay: main is refused below if it touches any of the run's files.
  if (changesBlockingMerge(state).length) fail(`sync merges main past an open repair's content only; uncommitted: ${changesBlockingMerge(state).join(", ")}`, 1);
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
          `slice ${state.l2.slice.id}: ${state.l2.slice.groups.map((group) => group.group).join(", ")}${state.l2.scope ? ` (partial run, part ${state.l2.scope.part}: ${state.l2.scope.groups.length} of the slice's ${state.l2.scope.sliceGroups.length} groups)` : ""}`,
          `pipeline: ${pipelineStatus(state.l2)}`,
          budgetLine(state),
          `steps recorded: ${Object.keys(state.l2.steps).length}; next steps: ${pendingL2Steps(state).slice(0, 4).map((step) => `${step.kind} ${step.subject}`).join(", ") || "none"}`,
          `blocked: ${state.l2.blocked.join(", ") || "none"}; repair cycles: ${Object.entries(state.l2.repairs).map(([conceptId, count]) => `${conceptId} ${count}`).join(", ") || "none"}`,
          ...(state.l2.repair ? [repairStatusLine(state.l2.repair, verbose)] : []),
          ...(state.l2.history ?? []).map((entry) => (entry.kind === "repair" ? `history: repair cycle ${entry.cycle} (${entry.concepts.join(", ")}) closed ${entry.closedAt}` : `history: merged main ${entry.from.slice(0, 7)} → ${entry.to.slice(0, 7)} at ${entry.merge.slice(0, 7)}`)),
          ...staleL2Steps(state, observedAudits(state)).map((entry) => `STALE ${entry.step}: ${entry.reason}; reopen the concept to repair and re-audit it`),
          ...neighbourStaleLines(state),
          ...(state.l2.checkpoint ? [`checkpoint: ${state.l2.checkpoint.clearedAt ? `cleared ${state.l2.checkpoint.clearedAt}: ${state.l2.checkpoint.decision}` : "holds drafting until a human review"}`] : []),
          `merging: ${state.l2.mergeAuthorized ? (revocationOf(readCampaign(), state.l2.mergeAuthorized) ? `started under an authorization since revoked; awaits human merge` : `authorized (${state.l2.mergeAuthorized.authorization})`) : "awaits human merge"}${state.l2.merged ? `; merged ${state.l2.merged.sha.slice(0, 7)}${state.l2.merged.byHand ? " by hand" : ""}` : state.stage === "done" && state.pr ? `; once #${state.pr.number} is merged, \`${CLI} run --domain ${state.domainId}\` records the merge` : ""}`,
        ]
      : []),
    `already authored: ${state.plan.authored.join(", ") || "none"}`,
    `deferred: ${state.plan.deferred.map((entry) => `${entry.conceptId} (${entry.reason})`).join("; ") || "none"}`,
    `fixes: ${state.fixes.map((fix) => fix.message).join("; ") || "none"}`,
    `checks passed: ${Object.entries(state.checks).filter(([, check]) => check.ok).map(([name]) => name).join(", ") || "none"}`,
    `stages remaining: ${STAGES.slice(stageIndex).filter((stage) => stage !== "done").join(", ") || "none"}`,
  ];
  console.log(report.join("\n"));
  for (const resolved of state.resolvedStops ?? []) console.log(resolvedStopLine(resolved, verbose));
  if (state.stop) printStop(state);
  else commandNext(state);
}

function commandNext(state = activeState()) {
  const action = nextAction(state);
  if (action.kind === "done") console.log(state.l2?.merged ? `next: nothing; merged as ${state.l2.merged.sha.slice(0, 7)}; \`${CLI} campaign\` names the next slice` : `next: nothing; the PR awaits human merge`);
  else if (action.kind === "stop") printStop(state);
  else console.log(`next: ${action.message}`);
}

// ---------------------------------------------------------------- the driver view (l2/orchestration.ts)

/** What the run's recorded drafts and audits were bound to, and what they would bind now. Reads only. */
function freshnessInput(state: RunState): L2FreshnessInput {
  const record = state.l2!;
  const plans = readPlans();
  const fingerprint = (conceptId: string) => recordFingerprint(recordOf(conceptId));
  const concepts = record.slice.groups.flatMap((group) => group.concepts);
  const drafts = Object.fromEntries(
    concepts.filter((conceptId) => record.steps[`author:${conceptId}`]).map((conceptId) => {
      const bound = record.steps[`author:${conceptId}`].fingerprint;
      return [conceptId, { ...(bound ? { bound } : {}), current: fingerprint(conceptId) }];
    }),
  );
  const audits = Object.fromEntries(
    concepts.flatMap((conceptId) => {
      const audit = record.steps[`audit:${conceptId}`] ? plans.map((plan) => conceptWorkOf(plan, conceptId)?.audit).find(Boolean) : undefined;
      if (!audit) return [];
      return [[conceptId, { record: { bound: audit.recordFingerprint, current: fingerprint(conceptId) }, ...(audit.neighbours ? { neighbours: { bound: audit.neighbours, current: neighbourBasis(mapKnowledge, plans, conceptId) } } : {}) }]];
    }),
  );
  const groupAudits = Object.fromEntries(
    record.slice.groups.flatMap((group) => {
      const plan = record.steps[`group-audit:${group.group}`] ? (plans.find((candidate) => candidate.group === group.group) as (L2GroupFile & { groupAudit?: L2GroupAudit }) | undefined) : undefined;
      return plan ? [[group.group, { bound: plan.groupAudit?.records ?? {}, current: ownedRecords(plan) }]] : [];
    }),
  );
  return { drafts, audits, groupAudits };
}

/** `l2 status`: recorded audits that bound records since changed, beyond what staleL2Steps already reports (their own record). */
function neighbourStaleLines(state: RunState): string[] {
  const listed = new Set(staleL2Steps(state, observedAudits(state)).map((entry) => entry.step));
  const input = freshnessInput(state);
  const keys = [...Object.keys(input.audits).map((conceptId) => `audit:${conceptId}`), ...Object.keys(input.groupAudits).map((group) => `group-audit:${group}`)];
  return keys.flatMap((key) => {
    const stale = stepFreshness(key, input).stale;
    return stale.length && !listed.has(key) ? [`STALE ${key}: records it was bound to have changed since it was recorded: ${staleSummary(stale)}; it is not current evidence (\`${CLI} next --json\` gives its resolution)`] : [];
  });
}

/** What each ready audit step's current artifacts support, in a group-batched run. Reads only. */
function submittedAudits(state: RunState): Record<string, L2SubmittedAudit> {
  if (!isBatched(pipelineOf(state.l2!))) return {};
  const submitted: Record<string, L2SubmittedAudit> = {};
  for (const step of pendingL2Steps(state)) {
    if ((step.kind !== "audit" && step.kind !== "group-audit") || pendingDrafts(state, step.group).length) continue;
    try {
      const artifacts = currentArtifacts(state, step.kind, step.subject, step.group);
      const outcome = confirmedOutcome(state, auditOutcome(artifacts, auditNeed(state, step.kind, step.subject), verificationIds(state, step.kind, step.subject, step.group)), step.kind, step.subject, step.group);
      // A recordable outcome of a tracked run is checked as `l2 record` checks its attempts (attemptsOf).
      const attempts = outcome.kind === "record" && tracksAttempts(state) ? attemptsOf(state, outcome.from) : undefined;
      submitted[stepKey(step)] = {
        submitted: artifacts.map((artifact) => ({ role: artifact.role, auditor: artifact.auditor })),
        outcome: outcome.kind,
        ...(outcome.kind === "blocking" ? { concepts: [...new Set(outcome.findings.map((finding) => finding.concept))].sort() } : {}),
        ...(outcome.kind === "inconsistent" ? { problem: outcome.problem } : {}),
        ...(attempts && "problem" in attempts ? { attempts: { problem: attempts.problem, reconcilable: attempts.reconcilable } } : {}),
      };
    } catch (error) {
      if (!(error instanceof AuditArtifactError)) throw error;
      submitted[stepKey(step)] = { submitted: [], outcome: "invalid" };
    }
  }
  return submitted;
}

/** The run's spending cap as measured now, and why it refuses a launch of each role. Reads only. */
function budgetView(state: RunState): L2NextInput["budget"] {
  const budget = state.l2?.budget;
  if (!budget) return undefined;
  const sessions = measure(state);
  const ledger = readLedger(ledgerPath(state.domainId), state.domainId);
  const status = budgetStatus(budget, sessions, ledger, state.l2?.attempts ? attemptsAdapter.extra(state.domainId, sessions, ledger, budget) : {});
  const roles = [...new Set([...Object.keys(budget.reserves), "plan", "design", "author", "repair", "first-audit", "re-audit", "group-audit"])].sort();
  return { status, refused: Object.fromEntries(roles.map((role) => [role, launchProblem(budget, status, role)])) };
}

/**
 * `l2 next --json`: the run's orchestration view (l2/orchestration.ts), for a driver. Strictly read-only: it never
 * recovers a commit journal (it reports one), reconciles, begins or launches an attempt, reserves budget, or writes
 * any file; selecting the run reads the state files without the recovery every other command performs on load.
 */
function commandL2NextJson() {
  const print = (value: unknown) => console.log(JSON.stringify(value, null, 2));
  const domainId = flag("--domain");
  let state: RunState | undefined;
  if (domainId) state = readState(domainId);
  else {
    const active = existsSync(STATE_DIR)
      ? readdirSync(STATE_DIR).filter((file) => file.endsWith(".json") && file !== L2_CAMPAIGN_FILE).map((file) => readState(file.slice(0, -5))!).filter((candidate) => candidate.stage !== "done")
      : [];
    if (active.length !== 1) return print(l2NoRun(active.map((candidate) => candidate.domainId)));
    state = active[0];
  }
  if (!state) return print(l2NoRun([]));
  const journal = existsSync(journalPath(state.domainId));
  const tracked = tracksAttempts(state);
  const governance = { mergeAuthorized: Boolean(state.l2?.mergeAuthorized && !revocationOf(readCampaign(), state.l2.mergeAuthorized)), hookRegistered: hookInstalled() };
  const common = { state, journal, tracked, governance, taskOf: taskDescription, inboxOf: (subject: string, role: L2AuditRole, auditor: string) => relative(ROOT, auditorInbox(runWorkDir(state!), subject, role, auditor)) };
  // An unrecovered journal means the state may be half of a commit: nothing more is read from it.
  if (journal) return print(l2Next({ ...common, freshness: { drafts: {}, audits: {}, groupAudits: {} }, attempts: [], inputsCurrent: {}, drafts: {}, plans: {}, designs: {}, audits: {} }));
  const attempts = tracked ? readAttemptLog(attemptsPath(state.domainId), state.domainId).attempts : [];
  const plans = readPlans();
  const concepts = state.l2!.slice.groups.flatMap((group) => group.concepts);
  print(
    l2Next({
      ...common,
      freshness: freshnessInput(state),
      attempts,
      // Each attempt's inputs against the current ones: what `record` and `submit-audit` require of it.
      inputsCurrent: Object.fromEntries(attempts.map((attempt) => [attempt.id, currentInputKey(state!, attempt.step) === attempt.inputKey])),
      drafts: Object.fromEntries(concepts.map((conceptId) => [conceptId, Boolean(recordOf(conceptId))])),
      plans: Object.fromEntries(state.l2!.slice.groups.map((group) => [group.group, plans.some((plan) => plan.group === group.group)])),
      designs: Object.fromEntries(concepts.map((conceptId) => [conceptId, Boolean(plans.map((plan) => conceptWorkOf(plan, conceptId)?.design).find(Boolean))])),
      audits: submittedAudits(state),
      budget: budgetView(state),
    }),
  );
}

/** `l2 batches --slice <id> [--json] [--pipeline <spec>]`: the slice's remaining work as runs of at most 12 concepts, whole groups only. Reads only. */
function commandL2Batches() {
  const { slices, finished } = campaignSlices();
  const id = flag("--slice") ?? fail(`batches needs --slice <id>; see \`${CLI} campaign\``);
  const slice = slices.find((candidate) => candidate.id === id) ?? fail(`unknown slice ${id}; see \`${CLI} campaign\``, 1);
  // A run of the slice that would refuse a new start (open, or finished and not integrated) holds its groups.
  const holding = sliceRuns(slice.id).filter((run) => !run.l2?.repairOf && partialStartProblems({ runs: [run], finished, id: "batch" }).length > 0);
  const claimed = Object.fromEntries(holding.flatMap((run) => run.l2!.slice.groups.map((group) => [group.group, run.domainId])));
  const plan = planBatches({ slice, remaining: new Set(sliceRemaining(slice, finished)), claimed, openRuns: holding.map((run) => run.domainId), pipeline: flag("--pipeline") ?? "simplified" });
  if (flags.has("--json")) return console.log(JSON.stringify(plan, null, 2));
  console.log(`${plan.slice}: ${plan.batches.length} batch(es) of at most ${plan.maxConcepts} concepts, whole groups in the slice's order`);
  for (const batch of plan.batches) {
    console.log(`  ${batch.index}. ${batch.groups.map((group) => `${group.group} (${group.concepts})`).join(", ")}: ${batch.concepts} concept(s)`);
    console.log(`     ${batch.problems.length ? `PROBLEM: ${batch.problems.join("; ")}` : `npm run map:author -- ${batch.command}`}`);
  }
  if (plan.claimed.length) console.log(`held by runs of the slice: ${plan.claimed.map((entry) => `${entry.group} (${entry.run})`).join(", ")}`);
  if (plan.integrated.length) console.log(`integrated: ${plan.integrated.join(", ")}`);
  console.log(plan.startable ? "the first batch may start now; each later one once the previous run is finished and integrated" : plan.openRuns.length ? `no batch starts until ${plan.openRuns.join(", ")} is finished and integrated` : "nothing to start");
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
  if (l2Mode && stage === "audit" && state.stage === "audit") {
    // What the l2-check gate would refuse (an unresolved signal, a missing or stale audit, a stale plan) is refused
    // here, while the agent's stage is still open, rather than after the run has started building.
    const problems = l2CheckProblems(state);
    if (problems.length) fail(`cannot complete the audit; the l2-check gate would refuse:\n  ${problems.join("\n  ")}`, 1);
  }
  if (l2Mode && stage === "audit") {
    // A convergence signal across the whole slice pauses the campaign for calibration, once; a long median is only reported.
    const drift = sliceDrift(state);
    for (const signal of drift.signals.filter((entry) => !sliceStopSignals(drift.signals).includes(entry))) console.log(`attention: ${signal.detail}`);
    if (sliceStopSignals(drift.signals).length && !(state.resolvedStops ?? []).some((resolved) => resolved.subject === "slice drift")) {
      stop(state, { subject: "slice drift", evidence: sliceStopSignals(drift.signals).map((signal) => signal.detail).join("\n"), why: "the slice's records converge on one opening, opener, paragraph shape or form: precedent may be standing in for decisions", decision: "review the flagged records against their designs, correct any that copied precedent, then resume with the calibration decision" });
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
  const exception = flag("--exception");
  if (exception !== undefined) {
    const standing = readCampaign().repairException ?? fail("no standing repair exception is recorded (`l2 authorize --repair-exception ..`)");
    const problem = repairExceptionProblem(state);
    if (problem || !exception.trim()) fail(problem ?? "--exception needs the justification: why the remaining defect is a narrow wording or qualification fix");
    const resumed = resumeRun(state, `${REPAIR_EXCEPTION} (${standing.at}: ${standing.authorization}): ${exception}`, now());
    saveState(resumed);
    console.log(`resumed at ${resumed.stage} under the standing repair exception`);
    return commandNext(resumed);
  }
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

/**
 * The tree the site is built from: treeFingerprint without the L2 group
 * files, which only the tooling reads (plans, audits; no application or build
 * input imports them). The build, browser, render, expansion and Worker checks
 * are bound to it, so an audit note re-recorded in a group file does not
 * rebuild the site or rerun its browser suite (run-state.ts reusableCheck).
 */
function runtimeFingerprint(state: RunState): string {
  const groups = `${GROUPS_DIR}/`;
  const hash = createHash("sha256").update(gitOut("diff", "--no-renames", "--binary", state.baseSha, "--", ".", `:(exclude)${groups}`));
  for (const file of untrackedFixFiles(state).filter((path) => !path.startsWith(groups)).sort()) hash.update(`\0${file}\0`).update(readFileSync(join(ROOT, file)));
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
    // An L2 run's audit also judged its group files: plans, models and designs (the audits are validated on their own).
    .update(state.l2 ? state.l2.slice.groups.map((group) => groupFileWithoutAudits(existsSync(join(ROOT, groupFile(group.group))) ? readFileSync(join(ROOT, groupFile(group.group)), "utf8") : "")).join("\0") : "")
    .digest("hex");

/** contentFingerprint as tooling before audit-free group fingerprints computed it, so an audit completed then still matches. */
const legacyContentFingerprint = (state: RunState) =>
  createHash("sha256")
    .update(JSON.stringify(state.plan.eligible.map((conceptId) => mapKnowledge.content.find((record) => record.conceptId === conceptId) ?? null)))
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
  {
    name: "build",
    label: "build",
    run: () => {
      // tsconfig includes a dev server's generated route types; left by a dev server on another branch, they
      // name routes this tree lacks and fail the type-check. They are regenerated, never source.
      rmSync(join(ROOT, ".next/dev/types"), { recursive: true, force: true });
      return sh("npm", ["run", "build"]);
    },
    detail: () => "succeeded",
  },
];
/**
 * Everything wrong with an L2 run's plans and concept work: every plan valid
 * and current, every signal resolved, and every concept the run drafted
 * audited. The l2-check gate, and `complete audit` before it.
 */
function l2CheckProblems(state: RunState): string[] {
  const groups = state.l2!.slice.groups.map((group) => group.group);
  const missing = groups.filter((group) => !existsSync(join(ROOT, groupFile(group))));
  if (missing.length) return [`no plan for ${missing.join(", ")}`];
  const plans = readPlans();
  const report = planReport(plans, groups);
  return [
    ...report.flatMap((entry) => [...entry.problems, ...entry.stale.map((problem) => `stale: ${problem}`)].map((problem) => `${entry.group}: ${problem}`)),
    // Every concept the run drafted has a recorded audit: planReport checks only the entries a file holds.
    ...auditCoverageProblems(plans, state.l2!.slice.groups, state.l2!.blocked),
  ];
}

/** An L2 run's own gate: every plan valid and current, and each run group's work complete and audited. */
const L2_GATE: Gate = {
  name: "l2-check",
  label: "L2 plans and concept work",
  run: (state) => {
    const problems = l2CheckProblems(state);
    return { ok: problems.length === 0, status: problems.length ? 1 : 0, out: problems.length ? problems.join("\n") : `${state.l2!.slice.groups.length} group(s) valid, current and audited` };
  },
  detail: (result) => result.out,
};

async function runStage(state: RunState): Promise<RunState> {
  const stage = state.stage;
  const at = now();
  const tree = treeFingerprint(state);
  const runtime = runtimeFingerprint(state);
  // A check bound to the runtime tree (and, where it ran against one, the production build) is reused while both hold.
  const reusable = (current: RunState, name: string) => reusableCheck(current, name, { runtime, buildId: buildId() });
  const reused = (current: RunState, name: string, what: string) => {
    console.log(`  ok  ${what}: ${current.checks[name].detail} (unchanged since it passed: reused)`);
    return current;
  };
  const check = (current: RunState, name: string, result: Result, detail: string, what: string, why: string): RunState => {
    const scope = checkScope(name, runtime, buildId());
    const recorded = recordCheck(current, name, result.ok, result.ok ? detail : `FAILED: ${detail}`, at, tree, scope);
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
      for (const gate of gateOrder(GATES, l2Mode ? L2_GATE : undefined)) {
        if (reusable(current, gate.name)) {
          current = reused(current, gate.name, gate.label);
          continue;
        }
        const result = gate.run(current);
        current = check(current, gate.name, result, gate.detail(result), gate.label, `the ${gate.label} gate failed`);
      }
      // The browser and render checks must run against exactly this build.
      return completeStage({ ...current, buildId: buildId() }, "gates", at);
    }
    case "browser": {
      if (reusable(state, "browser")) return completeStage(reused(state, "browser", "browser suite"), "browser", at);
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
      if (reusable(state, "render") && (!l2Mode || reusable(state, "expansion"))) {
        const kept = reused(state, "render", "render verification");
        return completeStage(l2Mode ? reused(kept, "expansion", "L2 expansion") : kept, "render", at);
      }
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
      if (l2Mode) {
        // The corpus grows the production Worker; checked here, once the browser and render checks no longer need .next.
        let budgeted: RunState;
        if (reusable(state, "worker-budget")) budgeted = reused(state, "worker-budget", "Worker budget");
        else {
          const budget = workerBudget();
          budgeted = check(state, "worker-budget", budget, budget.detail, "Worker budget", `the production Worker passes the ${WORKER_BUDGET_MIB} MiB budget, half Cloudflare's limit, at which storage must change (l2-content-scale.md)`);
        }
        return completeStage(await diffL2(budgeted, base, files, check, at, tree), "diff", at);
      }
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
  const signals = Object.fromEntries(authored.filter((conceptId) => recordOf(conceptId)).map((conceptId) => [conceptId, signalsOf(conceptId, headPlans)]));
  const groupSignals = Object.fromEntries(headPlans.filter((plan) => groups.includes(plan.group)).map((plan) => [plan.group, groupSignalsOf(plan)]));
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
    signals,
    groupSignals,
    coverage: coverageFor(headPlans, [...Object.values(signals).flat(), ...Object.values(groupSignals).flat()]),
    ...(state.l2!.repairOf ? { repaired: authored } : {}),
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
    current = commitStaged(current, contentFiles, groupCommitMessage(groups[index], state.attribution?.trailer, pipelineOf(state.l2).mode));
  }
  assertComposition(current);
  return current;
}

/** After the first commits: the open repair, one commit per repaired group; without one, HEAD must already be the validated tree. */
function commitL2Repair(state: RunState): RunState {
  const record = state.l2!;
  const changed = trackedPaths();
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
    ...(record.repairOf ? { repairOf: record.repairOf } : {}),
    ...(record.scope ? { scope: record.scope, run: state.domainId } : {}),
    footer: state.attribution?.footer,
    mode: pipelineOf(record).mode,
  });
}

/** After a merge: main fast-forwarded to origin, and the run's pushed head in it. */
function syncMainAfterMerge(state: RunState) {
  gitOut("fetch", "--quiet", "origin", MAIN);
  gitOut("switch", "--quiet", MAIN);
  gitOut("merge", "--quiet", "--ff-only", `origin/${MAIN}`);
  if (!git("merge-base", "--is-ancestor", state.pushedSha!, "HEAD").ok || head() !== remoteSha(`refs/heads/${MAIN}`)) throw new ToolFailure("synchronizing main after the merge", `HEAD ${head()}, origin/${MAIN} ${remoteSha(`refs/heads/${MAIN}`)}`);
}

/**
 * Merges the run's own PR, only under a human's recorded campaign
 * authorization, and only when it is exactly the validated run: open against
 * main at the pushed commit, cleanly mergeable, CI passing and its files the
 * validated set. Then main is synchronized and must contain the pushed head.
 * A PR a human already merged at the pushed head is recorded instead.
 */
/**
 * The run's PR as merged by a human, if it is (humanMerge): main is fetched
 * first, so the merge commit and the pushed head are looked for on origin.
 */
function observeHumanMerge(state: RunState): ReturnType<typeof humanMerge> {
  const viewed = sh("gh", ["pr", "view", String(state.pr!.number), "--json", "number,state,mergeCommit,headRefOid,headRefName,baseRefName"]);
  if (!viewed.ok) throw new ToolFailure("gh pr view", viewed.out);
  const pr = JSON.parse(viewed.out) as ObservedPr;
  if (pr.state !== "MERGED" || !pr.mergeCommit) return undefined;
  gitOut("fetch", "--quiet", "origin", MAIN);
  const onMain = (sha: string) => git("merge-base", "--is-ancestor", sha, `origin/${MAIN}`).ok;
  return humanMerge(state, pr, now(), { main: MAIN, integration: { mergeOnMain: onMain(pr.mergeCommit.oid), headOnMain: Boolean(state.pushedSha) && onMain(state.pushedSha!) } });
}

/**
 * `l2 run` on a finished run without a recorded merge: records the human merge
 * of its PR once it is exactly the validated head on main (humanMerge), then
 * synchronizes main. An unmerged PR changes nothing; any mismatch is refused
 * and nothing is recorded.
 */
function reconcileL2(state: RunState) {
  const outcome = observeHumanMerge(state);
  if (!outcome) return console.log(`${state.title}: PR #${state.pr!.number} is not merged; it awaits human merge, then \`${CLI} run --domain ${state.domainId}\` records the merge`);
  if ("problem" in outcome) fail(`refused to record the merge of PR #${state.pr!.number}: ${outcome.problem}; nothing was recorded, reconcile by hand`, 1);
  const changes = trackedChanges();
  if (changes.length) fail(`tracked changes present (${changes.join(", ")}): recording the merge switches to ${MAIN}; commit or restore them first`, 1);
  syncMainAfterMerge(state);
  const recorded = recordHumanMerge(state, outcome.merged);
  saveState(recorded);
  console.log(`recorded the human merge of #${state.pr!.number} as ${outcome.merged.sha.slice(0, 7)}; ${MAIN} is at ${head().slice(0, 7)}`);
}

function mergeL2(state: RunState): RunState {
  // A PR a human merged by hand is recorded, never merged again: only if it is exactly the validated, pushed head.
  if (state.pr) {
    const outcome = observeHumanMerge(state);
    if (outcome && "problem" in outcome) stop(state, { subject: `merged PR #${state.pr.number}`, evidence: outcome.problem, why: "a run records only the merge of exactly what it validated", decision: "reconcile the merge by hand" });
    if (outcome && "merged" in outcome) {
      verifyGit(state, { remoteMayBeDeleted: true });
      syncMainAfterMerge(state);
      console.log(`  ok  #${state.pr.number} was merged by hand as ${outcome.merged.sha.slice(0, 7)}; recorded`);
      return { ...state, l2: { ...state.l2!, merged: outcome.merged } };
    }
  }
  if (!state.l2?.mergeAuthorized) stop(state, { subject: "merge", evidence: "no recorded authorization", why: "a run merges only under a human's explicit campaign authorization", decision: "merge by hand, or record the authorization" });
  // A run started under an authorization a human has since revoked does not merge on it.
  const revocation = revocationOf(readCampaign(), state.l2.mergeAuthorized);
  if (revocation) stop(state, { subject: "merge", evidence: `the authorization of ${revocation.authorization.at} that this run started under was revoked ${revocation.revokedAt}: ${revocation.decision}`, why: "a run merges only under an authorization that is still in force", decision: "merge the validated PR by hand, then `l2 run` records the merge" });
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
  syncMainAfterMerge(state);
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
  const title = refactor ? refactorPrTitle(state) : l2Mode ? l2PrTitle(state.l2!.slice, Boolean(state.l2!.repairOf), state.l2!.scope) : prTitle(state);
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
  // A finished run awaiting human merge: `run` records the merge once a human has made it.
  if (l2Mode && state.stage === "done" && state.l2 && !state.l2.merged && state.pr) return reconcileL2(state);
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
  const invalidated = invalidate(state, { tree: treeFingerprint(state), runtime: runtimeFingerprint(state), content: contentFingerprint(state), legacyContent: legacyContentFingerprint(state), buildId: buildId() });
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
    `${state.title}: ${record.merged ? `merged as ${record.merged.sha.slice(0, 7)}` : `validated PR awaiting human merge; once merged, \`${CLI} run --domain ${state.domainId}\` records the merge`}${state.pr ? ` (${state.pr.url})` : ""}`,
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
      // `l2 next --json` is the read-only driver view; every other form keeps its text output.
      if (l2Mode && flags.has("--json")) commandL2NextJson();
      else commandNext();
      break;
    case "batches":
      if (!l2Mode) fail("batches is an l2 command: map:author -- l2 batches --slice <id>");
      commandL2Batches();
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
    case "submit-audit":
      if (!l2Mode) fail("submit-audit is an l2 command");
      commandL2SubmitAudit();
      break;
    case "attempts":
      if (!l2Mode) fail("attempts is an l2 command");
      commandL2Attempts();
      break;
    case "attempt":
      if (!l2Mode) fail("attempt is an l2 command");
      commandL2Attempt();
      break;
    case "reconcile":
      if (!l2Mode) fail("reconcile is an l2 command");
      commandL2Reconcile();
      break;
    case "audit-task":
      if (!l2Mode) fail("audit-task is an l2 command");
      commandL2AuditTask();
      break;
    case "findings":
      if (!l2Mode) fail("findings is an l2 command");
      commandL2Findings();
      break;
    case "repair-findings":
      if (!l2Mode) fail("repair-findings is an l2 command");
      commandL2RepairFindings();
      break;
    case "repair-diff":
      if (!l2Mode) fail("repair-diff is an l2 command");
      commandL2RepairDiff();
      break;
    case "budget":
      if (!l2Mode) fail("budget is an l2 command: map:author -- l2 budget");
      commandL2Budget();
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
