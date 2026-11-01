// Claude Code PreToolUse hook: enforces an L2 run's hard spending cap before any Agent launch
// (docs/map-authoring/l2-authoring.md, "Budget"; the gate itself is budget-io.ts launchGate). Register it for the
// Agent tool: `npm run map:author -- l2 budget hook` prints the settings entry.
//
// With no capped L2 run unfinished in the repository it allows everything. On a capped run's branch, from a session
// whose spend the run measures, the launch is reserved, or refused with exit 2 and the reason on stderr, which Claude
// Code shows the session; a launch whose spend the run would not see (another branch, checkout or transcript
// directory) is refused. A failure to check refuses. Claude Code lets a launch through when a hook exits with any
// other code, so the registered command ends in `|| exit 2`: a hook that cannot even start refuses too.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { launchGate, type LaunchInput } from "../src/lib/map/authoring/l2/budget-io.ts";
import { roleOf } from "../src/lib/map/authoring/l2/cost.ts";
import { L2_STATE_DIR, ledgerPath, measure, otherCheckouts, ROOT, transcriptsDir } from "./map-l2-budget.ts";

let input: LaunchInput;
try {
  input = JSON.parse(readFileSync(0, "utf8")) as LaunchInput;
} catch {
  // Not a hook invocation this script understands: nothing to gate.
  process.exit(0);
}
let branch: string | undefined;
try {
  branch = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() || undefined;
} catch {
  branch = undefined;
}
let outcome: ReturnType<typeof launchGate>;
try {
  outcome = launchGate(input, { stateDir: L2_STATE_DIR, branch, ledgerPath, measure, transcripts: transcriptsDir(), elsewhere: otherCheckouts(), now: new Date().toISOString(), role: roleOf });
} catch (error) {
  outcome = { allow: false, reason: `the budget check failed (${(error as Error).message}); no model work starts until it can run` };
}
if (!outcome.allow) {
  process.stderr.write(`L2 budget: ${outcome.reason}\n`);
  process.exit(2);
}
