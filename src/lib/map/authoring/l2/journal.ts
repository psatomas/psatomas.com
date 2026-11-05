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
 * Development tooling only.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

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

/** The boundaries a commit crosses, in order: a test hook may stop the process at any of them. */
export type JournalBoundary = "journal-written" | `file-${number}-written` | "journal-removed";

/**
 * Commits `files` (path and new text, in write order) through the journal at
 * `journalPath`. A journal already there is an unrecovered commit: refused,
 * since recovering it comes first. `boundary` is called after each step; a
 * test throws from it to simulate a termination there (nothing below runs).
 */
export function journaledCommit(journalPath: string, input: { run: string; tx: string; at: string; what: string; files: readonly { path: string; text: string }[] }, boundary: (at: JournalBoundary) => void = () => {}): void {
  if (existsSync(journalPath)) throw new JournalError(`an earlier commit of ${input.run} is unrecovered (${journalPath}): recover it first (\`l2 reconcile\`)`);
  const journal: L2Journal = { version: JOURNAL_VERSION, run: input.run, tx: input.tx, at: input.at, what: input.what, files: input.files.map((file) => ({ path: file.path, before: hashOf(file.path), after: sha(file.text), text: file.text })) };
  atomicWrite(journalPath, `${JSON.stringify(journal)}\n`);
  boundary("journal-written");
  journal.files.forEach((file, index) => {
    atomicWrite(file.path, file.text);
    boundary(`file-${index}-written`);
  });
  rmSync(journalPath, { force: true });
  boundary("journal-removed");
}

export class JournalError extends Error {}

export type JournalRecovery =
  | { action: "none" }
  | { action: "rolled-forward"; tx: string; what: string; written: string[] }
  | { action: "refused"; tx: string; what: string; problem: string };

/**
 * Recovers an interrupted commit, if `journalPath` holds one: rolls the
 * remaining files forward and removes the journal, or, when the files are not
 * in a state the protocol can leave, refuses and writes nothing. Running it
 * again after a recovery finds no journal and does nothing.
 */
export function recoverJournal(journalPath: string, run: string): JournalRecovery {
  if (!existsSync(journalPath)) return { action: "none" };
  let journal: L2Journal;
  try {
    journal = JSON.parse(readFileSync(journalPath, "utf8")) as L2Journal;
  } catch {
    return { action: "refused", tx: "?", what: "?", problem: `${journalPath} does not parse: inspect it` };
  }
  if (journal.version !== JOURNAL_VERSION || journal.run !== run || !Array.isArray(journal.files)) return { action: "refused", tx: journal.tx ?? "?", what: journal.what ?? "?", problem: `${journalPath} is not a version-${JOURNAL_VERSION} journal of ${run}` };
  const states = journal.files.map((file) => {
    if (sha(file.text) !== file.after) return "corrupt" as const;
    const now = hashOf(file.path);
    return now === file.after ? ("after" as const) : now === file.before ? ("before" as const) : ("other" as const);
  });
  const firstBefore = states.indexOf("before");
  const prefix = states.every((entry, index) => (firstBefore < 0 || index < firstBefore ? entry === "after" : entry === "before"));
  if (states.includes("corrupt") || states.includes("other") || !prefix) {
    const detail = journal.files.map((file, index) => `${file.path}: ${states[index]}`).join(", ");
    return { action: "refused", tx: journal.tx, what: journal.what, problem: `the files are not where an interrupted commit leaves them (${detail}); something else changed them: nothing was written` };
  }
  const written: string[] = [];
  journal.files.forEach((file, index) => {
    if (states[index] === "before") {
      atomicWrite(file.path, file.text);
      written.push(file.path);
    }
  });
  rmSync(journalPath, { force: true });
  return { action: "rolled-forward", tx: journal.tx, what: journal.what, written };
}
