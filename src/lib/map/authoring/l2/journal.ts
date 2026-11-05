/**
 * A write-ahead journal for the L2 run's multi-file commits
 * (docs/map-authoring/l2-simplified/v2.md, "Crash recovery"). Recording an
 * audit changes two files, the group file and the run state, and a process
 * can be killed between the writes. The protocol:
 *
 * 1. the journal is written whole (temporary file, then rename): each file's
 *    path, the hash of its current text and its complete new text, in write
 *    order. From here the commit is decided: every check has passed;
 * 2. each file is replaced in order, atomically (temporary file, then rename);
 * 3. the journal is removed.
 *
 * After a termination at any boundary, recovery reads the journal. Because
 * files are written in order, a valid crash state is a prefix of the files
 * already new and the rest still old: recovery writes the remaining new texts
 * (roll forward) and removes the journal. Any other state (a file neither old
 * nor new, or a new file after an old one) means something else changed the
 * files: nothing is written, and a human decides. Recovery is idempotent.
 *
 * A commit and a recovery hold the journal's lock (budget-io.ts withLock) from
 * their first read to their last write, so neither ever acts on the other's
 * half-written files, and a commit is refused when a file is no longer the
 * text its new content was computed from (`expect`). Recovery writes only the
 * paths its caller allows, each named once. Completing a commit is not
 * re-validating it: what the recovered files hold was checked when the commit
 * was decided, and is judged afresh, like any recorded work, by the gates.
 * Development tooling only.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { BudgetLockError, withLock } from "./budget-io.ts";

export const JOURNAL_VERSION = 1;
export type L2JournalFile = { path: string; before: string; after: string; text: string };
export type L2Journal = { version: 1; run: string; tx: string; at: string; what: string; files: L2JournalFile[] };

export const sha = (text: string) => createHash("sha256").update(text).digest("hex");
const ABSENT = "absent";
const hashOf = (path: string) => (existsSync(path) ? sha(readFileSync(path, "utf8")) : ABSENT);

/** Replaces a file whole: a reader (or a crash) sees the old text or the new one, never part of either. */
export function atomicWrite(path: string, text: string): void {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
  writeFileSync(temporary, text);
  renameSync(temporary, path);
}

/** How long a commit or recovery waits for the journal's lock (another commit or recovery of the run) before refusing. */
export type JournalOptions = { lockTimeoutMs?: number };
function locked<T>(journalPath: string, options: JournalOptions, fn: () => T): T {
  try {
    return withLock(journalPath, fn, { timeoutMs: options.lockTimeoutMs ?? 30_000 });
  } catch (error) {
    if (error instanceof BudgetLockError) throw new JournalError(`another commit or recovery of this run holds ${journalPath}.lock: nothing was written; run the command again once it finishes`);
    throw error;
  }
}

/** Why a journal's file list cannot be committed or recovered: each path absolute, named once, and allowed. */
function fileProblem(files: readonly { path?: unknown }[], allowed: (path: string) => boolean): string | undefined {
  if (!files.length) return "it names no file";
  const seen = new Set<string>();
  for (const file of files) {
    if (typeof file.path !== "string" || !isAbsolute(file.path) || resolve(file.path) !== file.path) return `${String(file.path)} is not an absolute, normalized path`;
    if (seen.has(file.path)) return `${file.path} is named twice`;
    seen.add(file.path);
    if (!allowed(file.path)) return `${file.path} is not a file this journal may write`;
  }
  return undefined;
}

/** The boundaries a commit crosses, in order: a test hook may stop the process at any of them. */
export type JournalBoundary = "journal-written" | `file-${number}-written` | "journal-removed";

/**
 * Commits `files` (path and new text, in write order) through the journal at
 * `journalPath`, holding the journal's lock throughout. A journal already
 * there is an unrecovered commit: refused, since recovering it comes first. A
 * file whose current text no longer hashes to its `expect` (the text the new
 * content was computed from) was changed by someone else since: refused,
 * nothing written. `boundary` is called after each step; a test throws from it
 * to simulate a termination there (nothing below runs).
 */
export function journaledCommit(journalPath: string, input: { run: string; tx: string; at: string; what: string; files: readonly { path: string; text: string; expect?: string }[] }, boundary: (at: JournalBoundary) => void = () => {}, options: JournalOptions = {}): void {
  const problem = fileProblem(input.files, () => true);
  if (problem) throw new JournalError(`the commit ${input.what} cannot be journaled: ${problem}`);
  locked(journalPath, options, () => {
    if (existsSync(journalPath)) throw new JournalError(`an earlier commit of ${input.run} is unrecovered (${journalPath}): recover it first (\`l2 reconcile\`)`);
    const journal: L2Journal = { version: JOURNAL_VERSION, run: input.run, tx: input.tx, at: input.at, what: input.what, files: input.files.map((file) => ({ path: file.path, before: hashOf(file.path), after: sha(file.text), text: file.text })) };
    const moved = input.files.filter((file, index) => file.expect !== undefined && file.expect !== journal.files[index].before).map((file) => file.path);
    if (moved.length) throw new JournalError(`${moved.join(", ")} changed since ${input.what} read ${moved.length > 1 ? "them" : "it"}: nothing was written; run the command again`);
    atomicWrite(journalPath, `${JSON.stringify(journal)}\n`);
    boundary("journal-written");
    journal.files.forEach((file, index) => {
      atomicWrite(file.path, file.text);
      boundary(`file-${index}-written`);
    });
    rmSync(journalPath, { force: true });
    boundary("journal-removed");
  });
}

export class JournalError extends Error {}

export type JournalRecovery =
  | { action: "none" }
  | { action: "rolled-forward"; tx: string; what: string; written: string[] }
  | { action: "refused"; tx: string; what: string; problem: string };

/**
 * Recovers an interrupted commit, if `journalPath` holds one, under the
 * journal's lock: rolls the remaining files forward and removes the journal,
 * or, when the journal is malformed, names a path `allowed` refuses or names
 * one twice, or the files are not in a state the protocol can leave, refuses
 * and writes nothing. Running it again after a recovery finds no journal and
 * does nothing; a concurrent recovery waits, then finds none.
 */
export function recoverJournal(journalPath: string, run: string, allowed: (path: string) => boolean = () => true, options: JournalOptions = {}): JournalRecovery {
  if (!existsSync(journalPath)) return { action: "none" };
  return locked(journalPath, options, () => recoverLocked(journalPath, run, allowed));
}

function recoverLocked(journalPath: string, run: string, allowed: (path: string) => boolean): JournalRecovery {
  if (!existsSync(journalPath)) return { action: "none" };
  let journal: L2Journal;
  try {
    journal = JSON.parse(readFileSync(journalPath, "utf8")) as L2Journal;
  } catch {
    return { action: "refused", tx: "?", what: "?", problem: `${journalPath} does not parse: inspect it` };
  }
  const label = { tx: typeof journal?.tx === "string" ? journal.tx : "?", what: typeof journal?.what === "string" ? journal.what : "?" };
  if (!journal || journal.version !== JOURNAL_VERSION || journal.run !== run || !Array.isArray(journal.files)) return { action: "refused", ...label, problem: `${journalPath} is not a version-${JOURNAL_VERSION} journal of ${run}` };
  const malformed = journal.files.some((file) => !file || typeof file !== "object" || typeof file.text !== "string" || typeof file.before !== "string" || typeof file.after !== "string");
  const problem = malformed ? "an entry is not a path with its old hash, new hash and new text" : fileProblem(journal.files, allowed);
  if (problem) return { action: "refused", ...label, problem: `${journalPath} cannot be recovered: ${problem}; nothing was written` };
  const states = journal.files.map((file) => {
    if (sha(file.text) !== file.after) return "corrupt" as const;
    const now = hashOf(file.path);
    // A file the commit left as it was is consistent with either side.
    if (file.before === file.after && now === file.after) return "unchanged" as const;
    return now === file.after ? ("after" as const) : now === file.before ? ("before" as const) : ("other" as const);
  });
  const firstBefore = states.indexOf("before");
  const prefix = states.every((entry, index) => entry === "unchanged" || (firstBefore < 0 || index < firstBefore ? entry === "after" : entry === "before"));
  if (states.includes("corrupt") || states.includes("other") || !prefix) {
    const detail = journal.files.map((file, index) => `${file.path}: ${states[index]}`).join(", ");
    return { action: "refused", ...label, problem: `the files are not where an interrupted commit leaves them (${detail}); something else changed them: nothing was written` };
  }
  const written: string[] = [];
  journal.files.forEach((file, index) => {
    if (states[index] === "before") {
      atomicWrite(file.path, file.text);
      written.push(file.path);
    }
  });
  rmSync(journalPath, { force: true });
  return { action: "rolled-forward", ...label, written };
}
