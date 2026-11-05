import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import test from "node:test";
import {
  AuditArtifactError,
  auditorInbox,
  auditOutcome,
  auditTaskPrompt,
  bindingKey,
  commitAuditRecording,
  inboxProblem,
  readArtifacts,
  staleArtifacts,
  submitArtifact,
  type L2AuditBinding,
  type L2Finding,
} from "./audit-artifacts.ts";

const RECORD = "Alpha is how a sequence starts. Committing twice breaks the sequence.";
const blocking: L2Finding = { severity: "blocking", concept: "a", evidence: { quote: "Committing twice breaks the sequence." }, action: "condition it" };
const NOW: L2AuditBinding = { records: { a: "fp-a1" }, neighbours: { b: "fp-b1", c: "fp-c1" } };
const scratch = () => mkdtempSync(join(tmpdir(), "l2-integrity-"));
const submit = (dir: string, auditor: string, binding: L2AuditBinding, extra: Record<string, unknown> = {}) =>
  submitArtifact(dir, { run: "r", subject: "a", role: "first-audit", auditor, at: "t", binding, verdict: "pass", note: `${auditor}: checked. Advisory: none`, findings: [], ...extra });
const read = (dir: string, binding: L2AuditBinding = NOW, textOf: (id: string) => string | undefined = (id) => (id === "a" ? RECORD : undefined)) => readArtifacts(dir, { run: "r", subject: "a", binding, concepts: ["a"], textOf });

// ---------------------------------------------------------------- 1. freshness

test("freshness: an artifact counts only for the exact record and neighbour fingerprints it judged, even when the concept itself is unchanged", () => {
  const dir = scratch();
  try {
    submit(dir, "A", NOW);
    submit(dir, "B", NOW);
    assert.equal(auditOutcome(read(dir), "first-audit").kind, "record");
    // Neighbour b is repaired; a's own record is unchanged. Both artifacts judged the old b: neither counts.
    const bChanged = { ...NOW, neighbours: { ...NOW.neighbours, b: "fp-b2" } };
    assert.deepEqual(read(dir, bChanged), []);
    assert.deepEqual(auditOutcome(read(dir, bChanged), "first-audit"), { kind: "missing", missing: ["first-audit by auditor A", "first-audit by auditor B"] });
    assert.equal(staleArtifacts(dir, "a", bindingKey(bChanged, "a")), 2);
    // A neighbour authored since (the set grew) or removed counts as a change too.
    assert.deepEqual(read(dir, { ...NOW, neighbours: { ...NOW.neighbours, d: "fp-d1" } }), []);
    assert.deepEqual(read(dir, { ...NOW, neighbours: { b: "fp-b1" } }), []);
    // Only one auditor resubmits against the new b: the first audit still waits for the other; A and B never mix bindings.
    submit(dir, "A", bChanged);
    assert.deepEqual(auditOutcome(read(dir, bChanged), "first-audit"), { kind: "missing", missing: ["first-audit by auditor B"] });
    submit(dir, "B", bChanged);
    const outcome = auditOutcome(read(dir, bChanged), "first-audit");
    assert.equal(outcome.kind, "record");
    if (outcome.kind === "record") assert.deepEqual(outcome.neighbours, bChanged.neighbours);
    // The key is order-insensitive and covers the subject: the same fingerprints in another order are the same binding.
    assert.equal(bindingKey({ records: NOW.records, neighbours: { c: "fp-c1", b: "fp-b1" } }, "a"), bindingKey(NOW, "a"));
    assert.notEqual(bindingKey(NOW, "a"), bindingKey(NOW, "z"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------- 2. integrity at the recording boundary

/** Publishes a valid artifact, then overwrites it on disk with `tamper`'s result, as a hand edit or a corrupt write would. */
function tampered(tamper: (artifact: Record<string, unknown>) => unknown, rename?: string) {
  const dir = scratch();
  const { path } = submit(dir, "A", NOW, { verdict: "fail", note: "n", findings: [blocking] });
  const artifact = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  const changed = tamper(artifact);
  const target = rename ? join(path, "..", rename) : path;
  if (rename) rmSync(path);
  writeFileSync(target, typeof changed === "string" ? changed : JSON.stringify(changed));
  return dir;
}

test("integrity: every artifact is revalidated when read; malformed, mismatched or invalid ones refuse the reading, never pass silently", () => {
  const cases: [string, ReturnType<typeof tampered>, RegExp][] = [
    ["truncated JSON", tampered(() => '{"version":1,"run":'), /not complete JSON/],
    ["another run", tampered((a) => ({ ...a, run: "other" })), /does not match the current run/],
    ["another subject", tampered((a) => ({ ...a, subject: "z" })), /does not match/],
    ["another key", tampered((a) => ({ ...a, key: "0".repeat(64) })), /does not match/],
    ["a binding other than the one now", tampered((a) => ({ ...a, binding: { records: { a: "fp-a1" }, neighbours: { b: "fp-b9", c: "fp-c1" } } })), /complete record-and-neighbour binding/],
    ["the auditor in the content differs from the file name", tampered((a) => ({ ...a, auditor: "B" })), /does not match/],
    ["the sequence differs from the file name", tampered((a) => ({ ...a, seq: 7 })), /does not match/],
    ["an unknown role", tampered((a) => ({ ...a, role: "self-audit" })), /does not match/],
    ["a pass that lists a blocking finding", tampered((a) => ({ ...a, verdict: "pass" })), /not a valid first-audit: a passing audit has no blocking finding/],
    ["a finding without its action", tampered((a) => ({ ...a, findings: [{ ...blocking, action: "" }] })), /say what action/],
    ["findings that are not a list", tampered((a) => ({ ...a, findings: "none" })), /findings must be an array/],
    ["an auditor no first audit has", tampered((a) => ({ ...a, auditor: "C" }), "first-audit-C-001.json"), /submitted by auditor A or B, not C/],
  ];
  for (const [what, dir, message] of cases) {
    try {
      assert.throws(() => read(dir), (error: unknown) => error instanceof AuditArtifactError && message.test((error as Error).message), what);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
  // Evidence is checked against the record as it is read, not only as it was submitted.
  const dir = tampered((a) => a);
  try {
    assert.equal(read(dir).length, 1);
    assert.throws(() => read(dir, NOW, () => "Alpha is how a sequence starts."), /quoted evidence is not in a's record as it is now/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------- 3. atomicity

/** An in-memory group file and run state, and a log of every write. */
function store() {
  const disk = { group: '{"group":"g1"}\n', state: "state-0" };
  const writes: string[] = [];
  return {
    disk,
    writes,
    io: (overrides: Partial<Parameters<typeof commitAuditRecording<string>>[0]> = {}) => ({
      readGroup: () => disk.group,
      next: (before: string) => before.replace("}", ',"concepts":{"a":{"audit":{}}}}'),
      validate: () => [],
      step: () => "state-1",
      writeGroup: (text: string) => {
        writes.push("group");
        disk.group = text;
      },
      saveState: (state: string) => {
        writes.push("state");
        disk.state = state;
      },
      ...overrides,
    }),
  };
}

test("atomicity: a recording that fails at any step after its intermediate checks leaves the group file and run state as they were", () => {
  const original = store().disk;
  // Validation refuses (an unresolved signal, say): nothing is written, and the run state's step is never taken.
  let steps = 0;
  const refused = store();
  const result = commitAuditRecording(refused.io({ validate: () => ["a: signal dated:1 is unresolved"], step: () => (steps++, "state-1") }));
  assert.deepEqual([result, refused.writes, steps, refused.disk], [{ ok: false, problems: ["a: signal dated:1 is unresolved"] }, [], 0, original]);
  // Validation itself crashes (a signal computation throwing): nothing is written.
  const crashing = store();
  assert.throws(() => commitAuditRecording(crashing.io({ validate: () => { throw new Error("signals failed"); } })), /signals failed/);
  assert.deepEqual([crashing.writes, crashing.disk], [[], original]);
  // The run state refuses the step (an earlier step pending), after every check passed: nothing is written.
  const outOfOrder = store();
  assert.throws(() => commitAuditRecording(outOfOrder.io({ step: () => { throw new Error("record author:b first"); } })), /author:b first/);
  assert.deepEqual([outOfOrder.writes, outOfOrder.disk], [[], original]);
  // Saving the run state fails after the group file was replaced: the group file is put back, byte for byte.
  const unsaved = store();
  assert.throws(() => commitAuditRecording(unsaved.io({ saveState: () => { throw new Error("disk full"); } })), /disk full/);
  assert.deepEqual([unsaved.writes, unsaved.disk], [["group", "group"], original]);
  // Success: the group file first, then the state, once each.
  const ok = store();
  assert.deepEqual(commitAuditRecording(ok.io()), { ok: true, state: "state-1" });
  assert.deepEqual([ok.writes, ok.disk.state, ok.disk.group], [["group", "state"], "state-1", '{"group":"g1","concepts":{"a":{"audit":{}}}}\n']);
});

test("atomicity: the checks judge the new group file in memory, so a refused recording never leaves a partial audit entry on disk", () => {
  const s = store();
  let judged = "";
  commitAuditRecording(s.io({ validate: (text) => ((judged = text), ["refused"]) }));
  assert.match(judged, /"audit"/);
  assert.equal(s.disk.group, '{"group":"g1"}\n');
});

// ---------------------------------------------------------------- 4. independence

test("independence: each auditor gets its own prompt naming only its own private findings file, and may submit only that file", () => {
  const work = "/repo/.map-authoring/l2/work/run-1";
  const inboxA = auditorInbox(work, "a", "first-audit", "A");
  const inboxB = auditorInbox(work, "a", "first-audit", "B");
  assert.notEqual(inboxA, inboxB);
  const prompt = (auditor: string, inbox: string) => auditTaskPrompt({ run: "run-1", subject: "a", role: "first-audit", auditor, inbox, instructions: "docs/map-authoring/l2-simplified/" });
  const a = prompt("A", inboxA);
  const b = prompt("B", inboxB);
  assert.notEqual(a, b);
  assert.ok(a.includes(inboxA) && !a.includes(inboxB));
  assert.ok(b.includes(inboxB) && !b.includes(inboxA));
  for (const text of [a, b]) {
    assert.match(text, /independent FIRST audit/);
    assert.match(text, /Never run `l2 record`, `l2 reopen` or `l2 findings`/);
    // The prompt never names the published artifacts' directory: auditors have no reason to look there.
    assert.ok(!text.includes(`${work}/audits`));
  }
  assert.match(a, /--auditor A --file /);
  assert.match(b, /--auditor B --file /);
  // submit-audit accepts only the auditor's own inbox, however the path is spelled.
  assert.equal(inboxProblem(inboxA, inboxA), undefined);
  assert.equal(inboxProblem(`${work}/inbox/a/first-audit-A/../first-audit-A/findings.json`, inboxA), undefined);
  assert.match(inboxProblem(inboxB, inboxA)!, /submits only its own findings file/);
  assert.match(inboxProblem("/tmp/shared/a.json", inboxA)!, /is not it/);
  const cwd = process.cwd();
  assert.equal(inboxProblem(relative(cwd, join(cwd, "x", "findings.json")), join(cwd, "x", "findings.json")), undefined);
  // A re-audit and a group audit get their own inboxes too.
  assert.notEqual(auditorInbox(work, "a", "re-audit", "R"), inboxA);
  assert.match(auditTaskPrompt({ run: "run-1", subject: "a", role: "re-audit", auditor: "R", inbox: "/x", instructions: "d/" }), /repair-diff a/);
});

test("independence: concurrent auditors of one concept publish to one binding without reading or replacing each other's artifacts", () => {
  const dir = scratch();
  try {
    submit(dir, "A", NOW);
    submit(dir, "B", NOW, { verdict: "fail", note: "B: one blocking", findings: [blocking] });
    const names = readdirSync(join(dir, "a", bindingKey(NOW, "a").slice(0, 16))).sort();
    assert.deepEqual(names, ["first-audit-A-001.json", "first-audit-B-001.json"]);
    const outcome = auditOutcome(read(dir), "first-audit");
    assert.equal(outcome.kind, "blocking");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
