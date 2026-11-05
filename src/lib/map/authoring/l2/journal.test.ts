import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { journaledCommit, JournalError, recoverJournal, sha, type JournalBoundary } from "./journal.ts";

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

// ---------------------------------------------------------------- adversarial review of PR-4: locking, ownership, malformed journals

const crashedAt = (w: ReturnType<typeof setup>, stopAt: JournalBoundary) => assert.throws(() => commit(w, (at) => { if (at === stopAt) throw new Killed(at); }), Killed);

test("a commit and a recovery hold the journal's lock: while another commit or recovery holds it, neither reads or writes anything", () => {
  const w = setup();
  try {
    crashedAt(w, "file-0-written");
    const crashed = w.read();
    // Another process is mid-commit or mid-recovery of this run: it holds the lock.
    mkdirSync(`${w.journal}.lock`);
    assert.throws(() => recoverJournal(w.journal, "run", () => true, { lockTimeoutMs: 100 }), (error: unknown) => error instanceof JournalError && /holds .*\.lock: nothing was written/.test((error as Error).message));
    assert.deepEqual(w.read(), crashed);
    assert.equal(existsSync(w.journal), true);
    rmSync(`${w.journal}.lock`, { recursive: true });
    assert.equal(recoverJournal(w.journal, "run").action, "rolled-forward");
    assert.deepEqual(w.read(), w.after);
    // A new commit waits for the lock too, and writes nothing when it cannot take it.
    mkdirSync(`${w.journal}.lock`);
    assert.throws(() => journaledCommit(w.journal, { run: "run", tx: "t2", at: "t", what: "record audit b", files: [{ path: w.state, text: "{}\n" }] }, undefined, { lockTimeoutMs: 100 }), JournalError);
    assert.deepEqual(w.read(), w.after);
    assert.equal(existsSync(w.journal), false);
  } finally {
    rmSync(w.dir, { recursive: true, force: true });
  }
});

test("concurrent recoveries in separate processes: exactly one completes the commit, the others find nothing to do", async () => {
  const w = setup();
  try {
    crashedAt(w, "journal-written");
    const journalModule = new URL("./journal.ts", import.meta.url).href;
    const script = `import { recoverJournal } from ${JSON.stringify(journalModule)}; process.stdout.write(recoverJournal(${JSON.stringify(w.journal)}, "run").action);`;
    const { spawn } = await import("node:child_process");
    const run = () => new Promise<string>((done, failed) => {
      const child = spawn(process.execPath, ["--disable-warning=ExperimentalWarning", "--input-type=module", "-e", script], { stdio: ["ignore", "pipe", "pipe"] });
      let out = "";
      let err = "";
      child.stdout.on("data", (chunk) => (out += chunk));
      child.stderr.on("data", (chunk) => (err += chunk));
      child.on("close", (code) => (code === 0 ? done(out) : failed(new Error(err))));
    });
    const actions = await Promise.all(Array.from({ length: 6 }, run));
    assert.deepEqual(actions.filter((action) => action === "rolled-forward").length, 1, actions.join(","));
    assert.deepEqual(actions.filter((action) => action === "none").length, 5, actions.join(","));
    assert.deepEqual(w.read(), w.after);
    assert.equal(existsSync(w.journal), false);
  } finally {
    rmSync(w.dir, { recursive: true, force: true });
  }
});

test("a commit computed from files someone else has since changed is refused, writing nothing (`expect`)", () => {
  const w = setup();
  try {
    // The recording read the run state, then another command saved a newer one: committing would lose that change.
    writeFileSync(w.state, '{"steps":{"author:b":{}}}\n');
    assert.throws(
      () => journaledCommit(w.journal, { run: "run", tx: "audit:a@t", at: "t", what: "record audit a", files: [{ path: w.group, text: w.after.group, expect: sha(w.before.group) }, { path: w.state, text: w.after.state, expect: sha(w.before.state) }] }),
      (error: unknown) => error instanceof JournalError && /state[/\\]run\.json changed since record audit a read it: nothing was written/.test((error as Error).message),
    );
    assert.deepEqual(w.read(), { group: w.before.group, state: '{"steps":{"author:b":{}}}\n' });
    assert.equal(existsSync(w.journal), false);
    // Read as they are, the commit goes through.
    journaledCommit(w.journal, { run: "run", tx: "audit:a@t", at: "t", what: "record audit a", files: [{ path: w.group, text: w.after.group, expect: sha(w.before.group) }, { path: w.state, text: w.after.state, expect: sha('{"steps":{"author:b":{}}}\n') }] });
    assert.deepEqual(w.read(), w.after);
  } finally {
    rmSync(w.dir, { recursive: true, force: true });
  }
});

test("a malformed journal is refused, writing nothing: a path not allowed, relative or named twice, or an entry without its text", () => {
  const w = setup();
  try {
    const outside = join(w.dir, "elsewhere.txt");
    const allowed = (path: string) => path === w.group || path === w.state;
    const forge = (files: unknown[]) => writeFileSync(w.journal, JSON.stringify({ version: 1, run: "run", tx: "x", at: "t", what: "forged", files }));
    mkdirSync(join(w.dir, "journal"), { recursive: true });
    const entry = (path: string, text = "new\n") => ({ path, before: sha(""), after: sha(text), text });
    for (const [files, problem] of [
      [[entry(w.group), entry(outside)], /elsewhere\.txt is not a file this journal may write/],
      [[entry("groups/g1.json")], /is not an absolute, normalized path/],
      [[entry(`${w.dir}/groups/../groups/g1.json`)], /is not an absolute, normalized path/],
      [[entry(w.state), entry(w.state, "other\n")], /named twice/],
      [[{ path: w.state, before: sha("") }], /not a path with its old hash, new hash and new text/],
      [[], /names no file/],
    ] as const) {
      forge([...files]);
      const recovery = recoverJournal(w.journal, "run", allowed);
      assert.equal(recovery.action, "refused", String(problem));
      if (recovery.action === "refused") assert.match(recovery.problem, problem);
      assert.deepEqual(w.read(), w.before, String(problem));
      assert.equal(existsSync(outside), false);
      assert.equal(existsSync(w.journal), true);
    }
    rmSync(w.journal);
    // A commit naming one file twice is refused before anything is written.
    assert.throws(() => journaledCommit(w.journal, { run: "run", tx: "x", at: "t", what: "twice", files: [{ path: w.state, text: "a\n" }, { path: w.state, text: "b\n" }] }), /named twice/);
    assert.equal(existsSync(w.journal), false);
    assert.deepEqual(w.read(), w.before);
  } finally {
    rmSync(w.dir, { recursive: true, force: true });
  }
});

test("a file the commit leaves unchanged does not make a valid crash state look foreign", () => {
  const w = setup();
  try {
    // The run state changes; the group file, written after it, keeps its current text. Killed before either is written:
    // the state is still old and the group file both old and new, a valid crash state.
    assert.throws(() => journaledCommit(w.journal, { run: "run", tx: "x", at: "t", what: "same group", files: [{ path: w.state, text: w.after.state }, { path: w.group, text: w.before.group }] }, (at) => { if (at === "journal-written") throw new Killed(at); }), Killed);
    const recovery = recoverJournal(w.journal, "run");
    assert.equal(recovery.action, "rolled-forward");
    assert.deepEqual(w.read(), { group: w.before.group, state: w.after.state });
  } finally {
    rmSync(w.dir, { recursive: true, force: true });
  }
});
