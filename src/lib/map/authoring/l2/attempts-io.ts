/**
 * The file side of L2 attempts (attempts.ts): a run's attempt log, read and
 * changed only under an exclusive lock (budget-io.ts withLock), so concurrent
 * auditors' submissions and the launch hook never lose each other's updates,
 * and written whole (journal.ts atomicWrite). Development tooling only.
 */
import { existsSync, readFileSync } from "node:fs";
import { emptyLog, ATTEMPTS_VERSION, type L2AttemptLog } from "./attempts.ts";
import { withLock } from "./budget-io.ts";
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
