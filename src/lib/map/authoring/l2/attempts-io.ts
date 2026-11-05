/**
 * The file side of L2 attempts (attempts.ts): a run's attempt log, read and
 * changed only under an exclusive lock (budget-io.ts withLock), so concurrent
 * auditors' submissions and the launch hook never lose each other's updates,
 * and written whole (journal.ts atomicWrite). Development tooling only.
 */
import { existsSync, readFileSync } from "node:fs";
import { AttemptError, attemptBudget, attemptIn, attemptMarker, emptyLog, transition, withAttempt, ATTEMPTS_VERSION, type L2AttemptLog } from "./attempts.ts";
import { reserveFor, type L2Budget, type L2BudgetStatus, type L2SpendSession } from "./budget.ts";
import { reserveUnderLock, withLock } from "./budget-io.ts";
import { atomicWrite } from "./journal.ts";

/** The run's attempt log, or an empty one. A log that does not parse, or names another run, is an error: attempts are never silently lost. */
export function readAttemptLog(path: string, run: string): L2AttemptLog {
  if (!existsSync(path)) return emptyLog(run);
  let log: L2AttemptLog;
  try {
    log = JSON.parse(readFileSync(path, "utf8")) as L2AttemptLog;
  } catch {
    throw new Error(`${path} does not parse: inspect it`);
  }
  if (log.version !== ATTEMPTS_VERSION || log.run !== run || !Array.isArray(log.attempts)) throw new Error(`${path} is not a version-${ATTEMPTS_VERSION} attempt log of ${run}`);
  return log;
}

/** Reads, changes and writes the log under its lock; `change` returning the same log writes nothing. */
export function updateAttemptLog<T>(path: string, run: string, change: (log: L2AttemptLog) => { log: L2AttemptLog; result: T }): T {
  return withLock(path, () => {
    const before = readAttemptLog(path, run);
    const { log, result } = change(before);
    if (JSON.stringify(log) !== JSON.stringify(before)) atomicWrite(path, `${JSON.stringify(log, null, 2)}\n`);
    return result;
  });
}

/**
 * Launches a pending attempt from a launcher other than the Claude Code hook
 * (`l2 attempt launch <id> --ref <ref>`), under the same budget as the hook:
 * the launch is reserved under the ledger's lock (refused when the cap does
 * not allow it) and the attempt is marked running inside that lock, so a
 * concurrent launch of the same attempt reserves nothing. The reservation's
 * description carries the attempt's marker; its session is never measured
 * from a Claude transcript, so it holds until a human releases it.
 */
export function launchAttempt(input: { attemptsPath: string; ledgerPath: string; run: string; budget: L2Budget; measure: () => L2SpendSession[]; id: string; ref: string; description: string; now: string }): { ok: true; status: L2BudgetStatus } | { ok: false; problem: string; status?: L2BudgetStatus } {
  const attempt = attemptIn(readAttemptLog(input.attemptsPath, input.run), input.id);
  if (attempt.status !== "pending") return { ok: false, problem: `attempt ${attempt.id} is ${attempt.status}, not pending: a launched attempt is never launched again` };
  if (!input.description.includes(attemptMarker(attempt.id))) throw new AttemptError(`a launch of ${attempt.id} carries its marker ${attemptMarker(attempt.id)}`);
  return reserveUnderLock({
    ledgerPath: input.ledgerPath,
    run: input.run,
    budget: input.budget,
    measure: input.measure,
    launch: { id: input.ref, role: attempt.step.role, at: input.now, description: input.description },
    extra: (sessions, ledger) => attemptBudget(readAttemptLog(input.attemptsPath, input.run), sessions, ledger, (role) => reserveFor(input.budget, role)),
    claim: () => updateAttemptLog(input.attemptsPath, input.run, (log) => ({ log: withAttempt(log, transition(attemptIn(log, input.id), "running", input.now, `launched (${input.ref})`, { launch: { ref: input.ref, at: input.now } })), result: undefined })),
  });
}
