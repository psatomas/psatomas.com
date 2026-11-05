/**
 * The file side of the L2 budget (budget.ts): measuring a run's sessions from
 * the Claude Code transcripts, and reserving launches in the run's ledger
 * under an exclusive lock, so concurrent launches (parallel agents, several
 * sessions on one run) each see the others' reservations. Paths are passed in;
 * the CLI and the launch hook (scripts/map-l2-budget-hook.ts) pass the
 * repository's. Development tooling only.
 */
import { closeSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, readSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { markerIn } from "./attempts.ts";
import { budgetStatus, describeBudget, emptyLedger, reserveLaunch, type L2Budget, type L2BudgetExtra, type L2BudgetLedger, type L2BudgetStatus, type L2Reservation, type L2SpendSession } from "./budget.ts";
import { sessionCost } from "./cost.ts";

/** Transcript lines, read in chunks so a long session's transcript is never held whole. */
function* linesOf(path: string): Generator<string> {
  const fd = openSync(path, "r");
  const buffer = Buffer.alloc(1 << 20);
  let rest = "";
  try {
    for (let read; (read = readSync(fd, buffer, 0, buffer.length, null)) > 0; ) {
      const lines = (rest + buffer.toString("utf8", 0, read)).split("\n");
      rest = lines.pop()!;
      yield* lines;
    }
    if (rest) yield rest;
  } finally {
    closeSync(fd);
  }
}

const json = <T>(path: string): T | undefined => {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return undefined;
  }
};

/**
 * Every session in `transcripts` (a Claude Code project's transcript
 * directory) with a model call on `branch` since `since`: each orchestrator
 * session, and each subagent with its launch's tool-use id and whether it
 * reports having finished. A subagent with no call yet is listed too, so a
 * finished launch that never called a model still settles its reservation.
 */
export function measureRun(transcripts: string, filter: { branch: string; since: string }): L2SpendSession[] {
  if (!existsSync(transcripts)) return [];
  const fresh = (path: string) => statSync(path).mtime.toISOString() >= filter.since;
  const sessions: L2SpendSession[] = [];
  const measured = (path: string, description: string) => {
    const cost = sessionCost(linesOf(path), description, filter);
    return { usd: cost.usd, unpriced: cost.unpriced, unmeasured: cost.unmeasured ?? 0, calls: cost.calls };
  };
  // A session is its transcript and, beside it, a directory of its subagents' transcripts; either may exist alone.
  const ids = [...new Set(readdirSync(transcripts).map((name) => name.replace(/\.jsonl$/, "")))].sort();
  for (const id of ids) {
    const path = join(transcripts, `${id}.jsonl`);
    if (existsSync(path) && fresh(path)) {
      const { calls, ...cost } = measured(path, `orchestrator ${id}`);
      if (calls || cost.unmeasured) sessions.push({ description: `orchestrator ${id}`, ...cost });
    }
    const subagents = join(transcripts, id, "subagents");
    if (!existsSync(subagents)) continue;
    for (const agent of readdirSync(subagents).filter((name) => name.endsWith(".jsonl")).sort()) {
      const agentPath = join(subagents, agent);
      const metaPath = agentPath.replace(/\.jsonl$/, ".meta.json");
      if (!fresh(agentPath) && !(existsSync(metaPath) && fresh(metaPath))) continue;
      const meta = json<{ description?: string; toolUseId?: string; finished?: boolean }>(metaPath) ?? {};
      const { calls, ...cost } = measured(agentPath, meta.description ?? agent);
      if (!calls && !cost.unmeasured && !meta.toolUseId) continue;
      sessions.push({ description: meta.description ?? agent, ...(meta.toolUseId ? { toolUseId: meta.toolUseId } : {}), ...(meta.finished !== undefined ? { finished: meta.finished } : {}), ...cost, calls });
    }
  }
  return sessions;
}

/** Waits synchronously: the lock is taken inside a short-lived hook process with nothing else to do. */
const pause = (ms: number) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

export class BudgetLockError extends Error {}

/**
 * Runs `fn` holding an exclusive lock (a directory beside `path`; creating one
 * is atomic). A lock older than `staleMs` was left by a process that died
 * holding it, since a reservation takes seconds: it is removed. Waiting longer
 * than `timeoutMs` throws, and the caller refuses the launch.
 */
export function withLock<T>(path: string, fn: () => T, { timeoutMs = 30_000, staleMs = 120_000 } = {}): T {
  const lock = `${path}.lock`;
  mkdirSync(dirname(lock), { recursive: true });
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      mkdirSync(lock);
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      try {
        if (Date.now() - statSync(lock).mtimeMs > staleMs) {
          rmSync(lock, { recursive: true, force: true });
          continue;
        }
      } catch {
        continue;
      }
      if (Date.now() > deadline) throw new BudgetLockError(`the budget ledger ${path} stayed locked for ${timeoutMs / 1000}s`);
      pause(50);
    }
  }
  try {
    return fn();
  } finally {
    rmSync(lock, { recursive: true, force: true });
  }
}

/** The run's reservation ledger, or an empty one. A ledger that does not parse, or names another run, is an error: reservations are never silently lost. */
export function readLedger(path: string, run: string): L2BudgetLedger {
  if (!existsSync(path)) return emptyLedger(run);
  const ledger = json<L2BudgetLedger>(path);
  if (!ledger || ledger.version !== 1 || ledger.run !== run || !Array.isArray(ledger.reservations)) throw new Error(`${path} is not the budget ledger of ${run}; inspect it`);
  return ledger;
}

/** Writes the ledger whole or not at all. */
export function writeLedger(path: string, ledger: L2BudgetLedger): void {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(ledger, null, 2)}\n`);
  renameSync(temporary, path);
}

/**
 * Reserves one launch under the ledger's lock: the spend is measured and the
 * ledger read inside it, so two launches can never both take the last of the
 * budget. A refused launch writes nothing.
 */
export function reserveUnderLock(input: { ledgerPath: string; run: string; budget: L2Budget; measure: () => L2SpendSession[]; launch: Omit<L2Reservation, "usd">; extra?: (sessions: readonly L2SpendSession[], ledger: L2BudgetLedger) => L2BudgetExtra }): { ok: true; status: L2BudgetStatus } | { ok: false; problem: string; status: L2BudgetStatus } {
  return withLock(input.ledgerPath, () => {
    const ledger = readLedger(input.ledgerPath, input.run);
    const sessions = input.measure();
    const status = budgetStatus(input.budget, sessions, ledger, input.extra?.(sessions, ledger));
    const reserved = reserveLaunch(input.budget, status, ledger, input.launch);
    if ("problem" in reserved) return { ok: false as const, problem: reserved.problem, status };
    writeLedger(input.ledgerPath, reserved.ledger);
    return { ok: true as const, status: budgetStatus(input.budget, sessions, reserved.ledger, input.extra?.(sessions, reserved.ledger)) };
  });
}

/** Unfinished L2 runs in `stateDir` on `branch` (every unfinished run when the branch is unknown), as their state files record them. */
export function activeRunsOn(stateDir: string, branch: string | undefined): { domainId: string; branch: string; createdAt: string; stage: string; l2?: { budget?: L2Budget; attempts?: { version: number } } }[] {
  if (!existsSync(stateDir)) return [];
  return readdirSync(stateDir)
    .filter((file) => file.endsWith(".json") && file !== "campaign.json")
    .map((file) => json<{ kind?: string; domainId: string; branch: string; createdAt: string; stage: string; l2?: { budget?: L2Budget; attempts?: { version: number } } }>(join(stateDir, file)))
    .filter((state): state is NonNullable<typeof state> => !!state && state.kind === "l2" && state.stage !== "done" && (branch === undefined || state.branch === branch));
}

/** What the launch hook receives (Claude Code PreToolUse input) and the outcome it reports. */
export type LaunchInput = { session_id?: string; transcript_path?: string; cwd?: string; tool_name?: string; tool_use_id?: string; tool_input?: { description?: string; subagent_type?: string } };
export type LaunchOutcome = { allow: true; run?: string; status?: L2BudgetStatus } | { allow: false; reason: string };
type ActiveRun = ReturnType<typeof activeRunsOn>[number];

/** Whether `path` lies inside directory `dir`. */
const inside = (path: string, dir: string) => resolve(path).startsWith(`${resolve(dir)}${sep}`);

/**
 * The launch gate: whether an Agent launch may start, reserving it if so.
 *
 * A launch counts toward a run's cap only if its spend can be measured: it is
 * made on the run's branch, in the run's checkout, by a session whose
 * transcript is in the directory the run's spend is read from (`transcripts`).
 * So, while a capped run is unfinished anywhere in the repository (this
 * checkout on another branch, or another checkout or worktree, `elsewhere`),
 * a launch that would escape its accounting is refused rather than let through
 * uncounted.
 *
 * Anything that is not an Agent launch passes, and so does every launch when
 * no capped run is unfinished; a run started before caps existed is not
 * enforced. Every failure to check refuses.
 */
export function launchGate(
  input: LaunchInput,
  where: {
    stateDir: string;
    branch: string | undefined;
    ledgerPath: (run: string) => string;
    measure: (run: { branch: string; createdAt: string }) => L2SpendSession[];
    /** The transcript directory every run of this checkout is measured from. */
    transcripts: string;
    /** Unfinished runs in the repository's other checkouts. */
    elsewhere?: readonly { root: string; runs: readonly ActiveRun[] }[];
    now: string;
    role: (description: string) => string;
    /**
     * A run that tracks attempts (attempts.ts): a launch must name a pending attempt (its marker in the task
     * description), which `claim` marks running once the launch is reserved; `extra` is what the run's attempts add
     * to its budget. Provided by the launcher's adapter; absent, attempts are not checked.
     */
    attempts?: {
      pending: (run: string, marker: string | undefined) => string | undefined;
      claim: (run: string, marker: string, launchRef: string, now: string) => void;
      extra: (run: string, sessions: readonly L2SpendSession[], ledger: L2BudgetLedger, budget: L2Budget) => L2BudgetExtra;
    };
  },
): LaunchOutcome {
  if (input.tool_name !== "Agent" && input.tool_name !== "Task") return { allow: true };
  let here: ActiveRun[];
  try {
    here = activeRunsOn(where.stateDir, undefined);
  } catch (error) {
    return { allow: false, reason: `cannot read the L2 run states (${(error as Error).message}); no model work starts until they can be read` };
  }
  // Without a branch no run can be matched to the launch: every unfinished run could be the one it belongs to.
  if (!where.branch && here.length) return { allow: false, reason: `cannot tell the current branch, so cannot tell whether the budget of ${here.map((run) => run.domainId).join(", ")} applies` };
  const runs = here.filter((run) => run.branch === where.branch);
  if (runs.length > 1) return { allow: false, reason: `several unfinished L2 runs are on ${where.branch} (${runs.map((run) => run.domainId).join(", ")}): resolve that before launching model work` };
  if (runs.length === 0) {
    // No run here on this branch: a capped run on another branch or in another checkout would not see this launch's spend.
    const capped = [
      ...here.filter((run) => run.l2?.budget).map((run) => `${run.domainId} (this checkout, on ${run.branch})`),
      ...(where.elsewhere ?? []).flatMap((checkout) => checkout.runs.filter((run) => run.l2?.budget).map((run) => `${run.domainId} (in ${checkout.root}, on ${run.branch})`)),
    ];
    if (capped.length) return { allow: false, reason: `the capped L2 run ${capped.join(", ")} is unfinished, and this launch's spend (another branch or checkout) would not count toward its cap: launch from the run's checkout on its branch, or finish or stop the run first` };
    return { allow: true };
  }
  const run = runs[0];
  const budget = run.l2?.budget;
  if (!budget) return { allow: true, run: run.domainId };
  if (!input.transcript_path || !inside(input.transcript_path, where.transcripts)) {
    return { allow: false, reason: `this session's transcript (${input.transcript_path ?? "not reported"}) is not in ${where.transcripts}, where the spend of ${run.domainId} is measured, so its launches would not count toward the cap: run the session from the run's checkout root` };
  }
  const description = input.tool_input?.description ?? input.tool_input?.subagent_type ?? "agent";
  const tracked = Boolean(run.l2?.attempts) && where.attempts;
  const marker = markerIn(description);
  const launchRef = input.tool_use_id ?? `launch-${where.now}-${process.pid}`;
  try {
    // Every model launch of an attempt-tracked run is begun as an attempt first, its inputs persisted.
    if (tracked) {
      const problem = where.attempts!.pending(run.domainId, marker);
      if (problem) return { allow: false, reason: problem };
    }
    const result = reserveUnderLock({
      ledgerPath: where.ledgerPath(run.domainId),
      run: run.domainId,
      budget,
      measure: () => where.measure(run),
      launch: { id: launchRef, role: where.role(description), at: where.now, description, ...(input.session_id ? { session: input.session_id } : {}) },
      ...(tracked ? { extra: (sessions: readonly L2SpendSession[], ledger: L2BudgetLedger) => where.attempts!.extra(run.domainId, sessions, ledger, budget) } : {}),
    });
    if (!result.ok) {
      return {
        allow: false,
        reason: `${result.problem}. No model work starts on ${run.domainId} until a human decides: raise the cap (\`npm run map:author -- l2 budget set --usd <n> --decision ".."\`), release a launch that will not finish (\`l2 budget release <id> --reason ".."\`), or stop the run (\`l2 stop\`). ${describeBudget(result.status)}`,
      };
    }
    // The reservation is made; a failure to mark the attempt running now refuses the launch, and the reservation holds.
    if (tracked) where.attempts!.claim(run.domainId, marker!, launchRef, where.now);
    return { allow: true, run: run.domainId, status: result.status };
  } catch (error) {
    return { allow: false, reason: `the budget of ${run.domainId} could not be checked (${(error as Error).message}); no model work starts until it can` };
  }
}
