import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { auditOutcome, bindingKey, findingsProblems, findingsReason, latest, readArtifacts, submitArtifact, type L2AuditArtifact, type L2Finding, type L2FindingsInput } from "./audit-artifacts.ts";

const RECORD = "Alpha is how a sequence starts. A start prepares before it commits, and committing twice breaks the sequence.";
const context = { role: "first-audit" as const, auditor: "A", concepts: ["a"], textOf: (id: string) => (id === "a" ? RECORD : undefined) };
const blocking: L2Finding = { severity: "blocking", concept: "a", criterion: "accuracy", evidence: { quote: "committing twice breaks   the sequence" }, action: "condition the claim on designs without idempotent commits" };
const advisory: L2Finding = { severity: "advisory", concept: "a", evidence: { location: "paragraph 1" }, action: "tighten the opening" };
const pass = (extra: Partial<L2FindingsInput> = {}): L2FindingsInput => ({ verdict: "pass", note: "checked accuracy, territory, overlap. Advisory: tighten the opening", findings: [advisory], resolutions: [{ id: "dated:1", resolution: "no date" }], ...extra });

test("structured findings: verdict, note, severity, concept, evidence found in the record, and a required action", () => {
  assert.deepEqual(findingsProblems(pass(), context), []);
  assert.deepEqual(findingsProblems({ verdict: "fail", note: "one blocking", findings: [blocking, advisory] }, context), []);
  const problems = (input: unknown, extra = {}) => findingsProblems(input, { ...context, ...extra }).join("\n");
  assert.match(problems(pass({ findings: [blocking] })), /a passing audit has no blocking finding; this one lists 1/);
  assert.match(problems({ verdict: "fail", note: "n", findings: [advisory] }), /a failing audit lists at least one blocking finding/);
  assert.match(problems({ verdict: "maybe", note: "n", findings: [] }), /verdict must be "pass" or "fail"/);
  assert.match(problems({ verdict: "pass", note: " ", findings: [] }), /needs its note/);
  assert.match(problems({ verdict: "pass", note: "n" }), /findings must be an array/);
  assert.match(problems(pass({ findings: [{ ...advisory, severity: "minor" as never }] })), /severity must be blocking or advisory/);
  assert.match(problems(pass({ findings: [{ ...advisory, concept: "b" }] })), /concept b is not one this audit judges \(a\)/);
  assert.match(problems(pass({ findings: [{ ...advisory, action: "" }] })), /say what action the finding requires/);
  assert.match(problems(pass({ findings: [{ ...advisory, evidence: {} }] })), /give its evidence/);
  assert.match(problems({ verdict: "fail", note: "n", findings: [{ ...blocking, evidence: { quote: "a sentence the record never had" } }] }), /quoted evidence is not in a's record as it is now/);
  assert.match(problems(pass({ resolutions: [{ id: "dated:1", resolution: "" }] })), /resolution 1 needs its signal id/);
  assert.match(problems(pass(), { auditor: "C" }), /a first-audit is submitted by auditor A or B, not C/);
  assert.match(problems(pass(), { role: "re-audit", auditor: "A" }), /submitted by auditor R/);
  assert.match(problems("not an object"), /not a JSON object/);
});

const binding = { records: { a: "fp-a1" }, neighbours: { b: "fp-b1" } };
const artifact = (auditor: string, input: L2FindingsInput, extra: Partial<L2AuditArtifact> = {}) => ({ run: "r", subject: "a", role: "first-audit" as const, auditor, at: "t", binding, ...input, ...extra });
const scratch = () => mkdtempSync(join(tmpdir(), "l2-artifacts-"));

test("artifacts are published whole and never replaced: a resubmission is a new artifact, and recording reads the latest", () => {
  const dir = scratch();
  try {
    const first = submitArtifact(dir, artifact("A", { verdict: "fail", note: "n", findings: [blocking] }));
    const original = readFileSync(first.path, "utf8");
    const second = submitArtifact(dir, artifact("A", pass()));
    assert.deepEqual([first.artifact.seq, second.artifact.seq], [1, 2]);
    assert.equal(readFileSync(first.path, "utf8"), original);
    // A stray temporary file (a submission that died mid-write) is never read.
    writeFileSync(join(dir, "a", "fp-a1", ".first-audit-A-003.json.1.x.tmp"), "{ partial");
    const read = readArtifacts(dir, "a", bindingKey(binding.records, "a"));
    assert.deepEqual(read.map((entry) => [entry.auditor, entry.seq, entry.verdict]), [["A", 1, "fail"], ["A", 2, "pass"]]);
    assert.equal(latest(read, "first-audit", "A")!.seq, 2);
    // Artifacts bound to other records are not this record's.
    assert.deepEqual(readArtifacts(dir, "a", "fp-a2"), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a first audit is recorded only from both independent auditors; one blocking finding refuses it", () => {
  const a = { version: 1 as const, key: "fp-a1", seq: 1, ...artifact("A", pass()) };
  const b = { version: 1 as const, key: "fp-a1", seq: 1, ...artifact("B", pass({ note: "second opinion. Advisory: none", findings: [], resolutions: [{ id: "dated:1", resolution: "B's own words" }, { id: "math:2", resolution: "none" }] })) };
  assert.deepEqual(auditOutcome([a], "first-audit"), { kind: "missing", missing: ["first-audit by auditor B"] });
  const outcome = auditOutcome([a, b], "first-audit");
  assert.equal(outcome.kind, "record");
  if (outcome.kind === "record") {
    // A's resolution wins for a shared signal; B adds what A left; notes are kept apart; neighbours are what both judged.
    assert.deepEqual(outcome.resolutions, [{ id: "dated:1", resolution: "no date" }, { id: "math:2", resolution: "none" }]);
    assert.equal(outcome.note, "A: checked accuracy, territory, overlap. Advisory: tighten the opening\nB: second opinion. Advisory: none");
    assert.deepEqual(outcome.neighbours, { b: "fp-b1" });
  }
  const failing = { ...b, verdict: "fail" as const, findings: [blocking] };
  const blocked = auditOutcome([a, failing], "first-audit");
  assert.equal(blocked.kind, "blocking");
  if (blocked.kind === "blocking") assert.equal(findingsReason(blocked.findings), 'a [first-audit B, accuracy]: condition the claim on designs without idempotent commits ("committing twice breaks   the sequence")');
  // The two auditors must have judged the same neighbours' records.
  assert.equal(auditOutcome([a, { ...b, binding: { ...binding, neighbours: { b: "fp-b2" } } }], "first-audit").kind, "inconsistent");
  // A repaired record needs its re-audit, a group its group audit.
  assert.deepEqual(auditOutcome([a, b], "re-audit"), { kind: "missing", missing: ["re-audit by auditor R"] });
  assert.equal(auditOutcome([{ ...a, role: "re-audit", auditor: "R" }], "re-audit").kind, "record");
  assert.deepEqual(auditOutcome([], "group-audit"), { kind: "missing", missing: ["group-audit by auditor G"] });
});

test("concurrent submissions from separate processes each publish one complete artifact and write nothing else", async () => {
  const dir = scratch();
  try {
    const store = new URL("./audit-artifacts.ts", import.meta.url).pathname;
    const script = join(dir, "submit.mts");
    writeFileSync(
      script,
      `const { submitArtifact } = await import(${JSON.stringify(store)});
const [dir, subject, auditor, n] = process.argv.slice(2);
const note = "note " + n + " " + "x".repeat(20000);
submitArtifact(dir, { run: "r", subject, role: "first-audit", auditor, at: "t", binding: { records: { [subject]: "fp-" + subject } }, verdict: "pass", note, findings: [] });`,
    );
    const submit = (subject: string, auditor: string, n: number) =>
      new Promise<number>((resolve, reject) => {
        const child = spawn(process.execPath, ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", script, join(dir, "work"), subject, auditor, String(n)]);
        child.on("error", reject);
        child.on("close", (code) => resolve(code ?? 1));
      });
    // Eight submissions by the same auditor for one concept, and four each by A and B for two others, all at once.
    const jobs = [...Array.from({ length: 8 }, (_, n) => submit("a", "A", n)), ...Array.from({ length: 4 }, (_, n) => submit("b", "A", n)), ...Array.from({ length: 4 }, (_, n) => submit("b", "B", n)), ...Array.from({ length: 4 }, (_, n) => submit("c", "B", n))];
    assert.deepEqual([...new Set(await Promise.all(jobs))], [0]);
    const of = (subject: string) => readArtifacts(join(dir, "work"), subject, `fp-${subject}`);
    assert.deepEqual(of("a").map((entry) => entry.seq), [1, 2, 3, 4, 5, 6, 7, 8]);
    assert.deepEqual(of("b").map((entry) => `${entry.auditor}${entry.seq}`), ["A1", "A2", "A3", "A4", "B1", "B2", "B3", "B4"]);
    assert.equal(of("c").length, 4);
    // Every artifact is whole, each note distinct, and nothing but artifacts was left behind.
    assert.equal(new Set(of("a").map((entry) => entry.note)).size, 8);
    for (const subject of ["a", "b", "c"]) assert.deepEqual(readdirSync(join(dir, "work", subject, `fp-${subject}`)).filter((name) => !/^first-audit-[AB]-\d{3}\.json$/.test(name)), []);
    assert.deepEqual(readdirSync(join(dir, "work")).sort(), ["a", "b", "c"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
