// Where this checkout keeps what the L2 budget reads and writes (src/lib/map/authoring/l2/budget.ts):
// the Claude Code transcripts of this checkout, each run's reservation ledger, and the settings that register the
// launch hook. Shared by `map:author -- l2 budget` and scripts/map-l2-budget-hook.ts; it imports nothing heavy, since
// the hook runs before every Agent launch in this repository.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { attemptBudget, attemptIn, attemptMarker, transition, withAttempt } from "../src/lib/map/authoring/l2/attempts.ts";
import { readAttemptLog, updateAttemptLog } from "../src/lib/map/authoring/l2/attempts-io.ts";
import { budgetHookInstalled, reserveFor, type L2Budget, type L2BudgetLedger, type L2SpendSession } from "../src/lib/map/authoring/l2/budget.ts";
import { activeRunsOn, measureRun } from "../src/lib/map/authoring/l2/budget-io.ts";
import { projectSlug } from "../src/lib/map/authoring/l2/cost.ts";

export const ROOT = new URL("..", import.meta.url).pathname;
const CONFIG = process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), ".claude");
export const L2_STATE_DIR = join(ROOT, ".map-authoring", "l2");
/** Ledgers live in their own directory: a JSON file beside the run states would be read as a run. */
export const ledgerPath = (run: string) => join(L2_STATE_DIR, "budget", `${run}.json`);
export const transcriptsDir = () => join(CONFIG, "projects", projectSlug(ROOT.replace(/\/$/, "")));

/** What a run has measurably spent: every session on its branch since it started. */
export const measure = (run: { branch: string; createdAt: string }) => measureRun(transcriptsDir(), { branch: run.branch, since: run.createdAt });

/** The settings files Claude Code reads hooks from for this checkout, parsed; unreadable ones are skipped. */
export function settingsFiles(): unknown[] {
  return [join(ROOT, ".claude", "settings.json"), join(ROOT, ".claude", "settings.local.json"), join(CONFIG, "settings.json")].flatMap((path) => {
    if (!existsSync(path)) return [];
    try {
      return [JSON.parse(readFileSync(path, "utf8")) as unknown];
    } catch {
      return [];
    }
  });
}
export const hookInstalled = () => budgetHookInstalled(settingsFiles());

/**
 * Unfinished runs in the repository's other checkouts (git worktrees): a
 * launch from here would not count toward their caps. A checkout whose state
 * cannot be read has none to report.
 */
export function otherCheckouts(): { root: string; runs: ReturnType<typeof activeRunsOn> }[] {
  let listed: string;
  try {
    listed = execFileSync("git", ["-C", ROOT, "worktree", "list", "--porcelain"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return [];
  }
  const real = (path: string) => {
    try {
      return realpathSync(path);
    } catch {
      return path;
    }
  };
  const here = real(ROOT);
  return listed
    .split("\n")
    .filter((line) => line.startsWith("worktree "))
    .map((line) => line.slice("worktree ".length))
    .filter((root) => real(root) !== here)
    .map((root) => ({ root, runs: activeRunsOn(join(root, ".map-authoring", "l2"), undefined) }))
    .filter((checkout) => checkout.runs.length > 0);
}

/** `path` quoted for the shell that runs a hook command. */
const shellQuoted = (path: string) => `'${path.replace(/'/g, "'\\''")}'`;

/**
 * The settings entry that registers the hook, for `.claude/settings.local.json`
 * (git-ignored) or `.claude/settings.json`. The script is named by its absolute
 * path, never through $CLAUDE_PROJECT_DIR (a session started in a subdirectory
 * or another checkout would not find it), and the command ends in `|| exit 2`:
 * Claude Code lets a launch through when a hook fails with any code but 2.
 */
export const HOOK_SETTINGS = {
  hooks: {
    PreToolUse: [{ matcher: "Agent|Task", hooks: [{ type: "command", command: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON ${shellQuoted(join(ROOT, "scripts", "map-l2-budget-hook.ts"))} || exit 2` }] }],
  },
};

// ---------------------------------------------------------------- attempts (l2/attempts.ts)

/** A run's attempt log, and its commit journal: their own directories, never read as run states. */
export const attemptsPath = (run: string) => join(L2_STATE_DIR, "attempts", `${run}.json`);
export const journalPath = (run: string) => join(L2_STATE_DIR, "journal", `${run}.json`);

/**
 * The launch hook's view of attempts (budget-io.ts launchGate `attempts`): a launch of an attempt-tracked run must
 * carry the marker of a pending attempt, which is marked running once the launch is reserved; open attempts nothing
 * else accounts for keep their reserve, and recorded spend whose transcript is gone still counts.
 */
export const attemptsAdapter = {
  pending: (run: string, marker: string | undefined) => {
    if (!marker) return `every model launch of ${run} is begun as an attempt first (\`npm run map:author -- l2 attempt begin ..\` or \`l2 audit-task\`), and its task description carries the attempt's marker (#att-..)`;
    const attempt = readAttemptLog(attemptsPath(run), run).attempts.find((entry) => entry.id === marker);
    if (!attempt) return `${attemptMarker(marker)} is not an attempt of ${run}`;
    if (attempt.status !== "pending") return `attempt ${marker} is ${attempt.status}, not pending: a launched attempt is never launched again; begin a new one once it is resolved (\`l2 attempts\`)`;
    return undefined;
  },
  claim: (run: string, marker: string, launchRef: string, now: string) =>
    updateAttemptLog(attemptsPath(run), run, (log) => ({ log: withAttempt(log, transition(attemptIn(log, marker), "running", now, `launched (${launchRef})`, { launch: { ref: launchRef, at: now } })), result: undefined })),
  extra: (run: string, sessions: readonly L2SpendSession[], ledger: L2BudgetLedger, budget: L2Budget) => attemptBudget(readAttemptLog(attemptsPath(run), run), sessions, ledger, (role) => reserveFor(budget, role)),
};
