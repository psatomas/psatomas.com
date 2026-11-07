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
  draftTaskPrompt,
  inboxProblem,
  readArtifacts,
  repairItems,
  staleArtifacts,
  submitArtifact,
  verificationProblems,
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
    assert.match(text, /Never run `l2 record`, `l2 reopen`, `l2 findings`, `l2 repair-findings` or `l2 status`/);
    // A first auditor is never given findings, and reports back without repeating its own.
    assert.ok(!/verifications|F1:/.test(text));
    assert.match(text, /Report back in one line.*Do not repeat your findings/);
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
  // Repair items reach only a repair's verifier: passed to a first audit's prompt by mistake, they are dropped.
  const items = [{ id: "F1", text: "a [first-audit B, accuracy]: condition it", at: "t" }];
  assert.ok(!auditTaskPrompt({ run: "run-1", subject: "a", role: "first-audit", auditor: "A", inbox: "/x", instructions: "d/", repairs: items }).includes("condition it"));
  assert.match(auditTaskPrompt({ run: "run-1", subject: "a", role: "re-audit", auditor: "R", inbox: "/x", instructions: "d/", repairs: items }), /F1: a \[first-audit B, accuracy\]: condition it[\s\S]*"verifications"/);
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

// ---------------------------------------------------------------- 5. repair verification

test("repair verification: a re-audit is recordable only when it accounts for every finding its repair answered", () => {
  const evidence = [
    { at: "t1", findings: [{ ...blocking, auditor: "A", role: "first-audit" as const, artifact: { path: "a/k/first-audit-A-001.json", key: "k", sha256: "s" } }] },
    { at: "t2", findings: [], reason: "a human's note" },
  ];
  const items = repairItems(evidence);
  assert.deepEqual(items.map((item) => item.id), ["F1", "F2"]);
  assert.match(items[0].text, /^a \[first-audit A\]: condition it/);
  assert.equal(items[1].text, "a human's reason: a human's note");
  // A group audit verifies only the group audit's own findings.
  assert.deepEqual(repairItems(evidence, { groupAudit: true }), []);
  const dir = scratch();
  try {
    const repaired: L2AuditBinding = { records: { a: "fp-a2" }, neighbours: NOW.neighbours };
    const reAudit = (extra: Record<string, unknown>) => submitArtifact(dir, { run: "r", subject: "a", role: "re-audit", auditor: "R", at: "t", binding: repaired, verdict: "pass", note: "R: checked. Advisory: none", findings: [], ...extra });
    // Published without verifications (by hand, past submit-audit): read back, it does not record.
    reAudit({});
    const outcome = auditOutcome(read(dir, repaired), "re-audit", ["F1", "F2"]);
    assert.equal(outcome.kind, "inconsistent");
    assert.match((outcome as { problem: string }).problem, /does not verify the findings its repair answered: verifications must list each finding/);
    // The latest re-audit verifies both: recordable. Without findings to verify, nothing more is asked.
    reAudit({ verifications: [{ id: "F1", status: "resolved", evidence: "now conditioned" }, { id: "F2", status: "resolved", evidence: "addressed in paragraph 2" }] });
    assert.equal(auditOutcome(read(dir, repaired), "re-audit", ["F1", "F2"]).kind, "record");
    assert.equal(auditOutcome(read(dir, repaired), "re-audit").kind, "record");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  assert.deepEqual(verificationProblems({ verdict: "fail", findings: [blocking], verifications: [{ id: "F1", status: "unresolved", evidence: "unchanged" }] }, ["F1"]), []);
  assert.deepEqual(verificationProblems({ verdict: "pass", findings: [], verifications: [{ id: "F1", status: "resolved", evidence: "x" }, { id: "F1", status: "resolved", evidence: "y" }] }, ["F1"]), ["F1 is verified more than once"]);
  assert.match(verificationProblems({ verdict: "pass", findings: [], verifications: [{ id: "F1", status: "resolved", evidence: " " }] }, ["F1"])[0], /give the evidence/);
});

test("draft and repair prompts: a repairer reads only its own concept's findings, and agents report back briefly", () => {
  const repair = draftTaskPrompt({ run: "run-1", subject: "a", group: "g1", role: "repair", instructions: "d/", attempt: "att-1", cycle: 2 });
  assert.match(repair, /REPAIR of a \(repair cycle 2\)/);
  assert.match(repair, /only these: `npm run map:author -- l2 repair-findings a`/);
  assert.match(repair, /Never use `l2 status` or `l2 findings` for them/);
  assert.match(repair, /l2 record author a --attempt att-1/);
  assert.match(repair, /Report back in at most 3 lines.*re-auditor verifies them independently/);
  const author = draftTaskPrompt({ run: "run-1", subject: "a", group: "g1", role: "author", instructions: "d/", attempt: "att-2" });
  assert.match(author, /DRAFT of a/);
  assert.match(author, /l2 context a/);
  assert.ok(!author.includes("repair-findings"));
});
