import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { journaledCommit, JournalError, recoverJournal, type JournalBoundary } from "./journal.ts";

/** A run's group file and run state as they are before an audit is recorded, and what recording writes. */
function setup() {
  const dir = mkdtempSync(join(tmpdir(), "l2-journal-"));
  const w = { dir, group: join(dir, "groups", "g1.json"), state: join(dir, "state", "run.json"), journal: join(dir, "journal", "run.json"), before: { group: '{"group":"g1"}\n', state: '{"steps":{}}\n' }, after: { group: '{"group":"g1","concepts":{"a":{"audit":{}}}}\n', state: '{"steps":{"audit:a":{}}}\n' } };
  for (const sub of ["groups", "state"]) mkdirSync(join(dir, sub), { recursive: true });
  writeFileSync(w.group, w.before.group);
  writeFileSync(w.state, w.before.state);
  return { ...w, read: () => ({ group: readFileSync(w.group, "utf8"), state: readFileSync(w.state, "utf8") }) };
}
const commit = (w: ReturnType<typeof setup>, boundary?: (at: JournalBoundary) => void) =>
  journaledCommit(w.journal, { run: "run", tx: "audit:a@t", at: "t", what: "record audit a", files: [{ path: w.group, text: w.after.group }, { path: w.state, text: w.after.state }] }, boundary);
class Killed extends Error {}

test("a commit with no interruption writes both files and leaves no journal", () => {
  const w = setup();
  try {
    commit(w);
    assert.deepEqual(w.read(), w.after);
    assert.equal(existsSync(w.journal), false);
    assert.deepEqual(recoverJournal(w.journal, "run"), { action: "none" });
  } finally {
    rmSync(w.dir, { recursive: true, force: true });
  }
});

test("terminated at every persistence boundary, recovery leaves both files new and consistent, and is idempotent", () => {
  const boundaries: JournalBoundary[] = ["journal-written", "file-0-written", "file-1-written", "journal-removed"];
  for (const stopAt of boundaries) {
    const w = setup();
    try {
      // The process dies right after `stopAt`: nothing after it runs, and no cleanup handler either.
      assert.throws(() => commit(w, (at) => { if (at === stopAt) throw new Killed(stopAt); }), Killed);
      const crashed = w.read();
      if (stopAt === "file-0-written") assert.deepEqual(crashed, { group: w.after.group, state: w.before.state }, "group file written, run state not: the PR-3 gap");
      const recovery = recoverJournal(w.journal, "run");
      assert.deepEqual(w.read(), w.after, stopAt);
      assert.equal(existsSync(w.journal), false, stopAt);
      assert.equal(recovery.action, stopAt === "journal-removed" ? "none" : "rolled-forward", stopAt);
      if (recovery.action === "rolled-forward") assert.deepEqual(recovery.written, stopAt === "journal-written" ? [w.group, w.state] : stopAt === "file-0-written" ? [w.state] : [], stopAt);
      // Recovering again does nothing.
      assert.deepEqual(recoverJournal(w.journal, "run"), { action: "none" }, stopAt);
      assert.deepEqual(w.read(), w.after, stopAt);
      // No temporary file is left behind.
      assert.deepEqual(readdirSync(join(w.dir, "groups")).filter((name) => name.endsWith(".tmp")), []);
    } finally {
      rmSync(w.dir, { recursive: true, force: true });
    }
  }
});

test("recovery refuses, writing nothing, when the files are not where an interrupted commit leaves them", () => {
  const w = setup();
  try {
    assert.throws(() => commit(w, (at) => { if (at === "file-0-written") throw new Killed(at); }), Killed);
    // Someone edits the group file after the crash.
    writeFileSync(w.group, '{"group":"g1","edited":true}\n');
    const recovery = recoverJournal(w.journal, "run");
    assert.equal(recovery.action, "refused");
    if (recovery.action === "refused") assert.match(recovery.problem, /g1\.json: other.*nothing was written/);
    assert.equal(readFileSync(w.state, "utf8"), w.before.state);
    assert.equal(existsSync(w.journal), true);
  } finally {
    rmSync(w.dir, { recursive: true, force: true });
  }
  // The run state new but the group file still old cannot happen in order: refused.
  const v = setup();
  try {
    assert.throws(() => commit(v, (at) => { if (at === "journal-written") throw new Killed(at); }), Killed);
    writeFileSync(v.state, v.after.state);
    assert.equal(recoverJournal(v.journal, "run").action, "refused");
    assert.deepEqual(v.read(), { group: v.before.group, state: v.after.state });
  } finally {
    rmSync(v.dir, { recursive: true, force: true });
  }
});

test("a new commit is refused while an earlier one is unrecovered; a foreign or unreadable journal is refused", () => {
  const w = setup();
  try {
    assert.throws(() => commit(w, (at) => { if (at === "journal-written") throw new Killed(at); }), Killed);
    assert.throws(() => commit(w), (error: unknown) => error instanceof JournalError && /unrecovered/.test((error as Error).message));
    assert.equal(recoverJournal(w.journal, "other-run").action, "refused");
    writeFileSync(w.journal, "{ partial");
    assert.equal(recoverJournal(w.journal, "run").action, "refused");
  } finally {
    rmSync(w.dir, { recursive: true, force: true });
  }
});
