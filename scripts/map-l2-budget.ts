// Where this checkout keeps what the L2 budget reads and writes (src/lib/map/authoring/l2/budget.ts):
// the Claude Code transcripts of this checkout, each run's reservation ledger, and the settings that register the
// launch hook. Shared by `map:author -- l2 budget` and scripts/map-l2-budget-hook.ts; it imports nothing heavy, since
// the hook runs before every Agent launch in this repository.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { budgetHookInstalled } from "../src/lib/map/authoring/l2/budget.ts";
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
