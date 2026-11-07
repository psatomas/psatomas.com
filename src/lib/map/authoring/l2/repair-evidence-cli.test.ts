/**
 * Repair evidence from the real CLI (the first v2 pilot's two evidence defects), against a fixture version-2 run in a
 * copy of the repository: two concepts of one group fail their first audits and are reopened; one is repaired, which
 * changes its sibling's neighbour fingerprint. The sibling's findings must stay retrievable as historical evidence and
 * never count as current; each repair and re-audit gets only its own concept's findings; first audits stay
 * independent; a re-audit must verify each finding it was given. No model is called: the auditors' findings are
 * written by the test. The run does not track attempts, so no budget hook is involved; the evidence paths are the same.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";

const ROOT = new URL("../../../../../", import.meta.url).pathname;
const GROUP = "transitions-in-state-data";
const RUN = "fixture-1";
const X = "transition-functions";
const Y = "valid-transitions";
let dir = "";
let scratch = "";
let quotes: Record<string, string> = {};

const git = (...args: string[]) => {
  const result = spawnSync("git", ["-c", "user.name=fixture", "-c", "user.email=fixture@example.invalid", "-c", "commit.gpgsign=false", ...args], { cwd: dir, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
};
const cli = (...args: string[]) => spawnSync(process.execPath, ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", join(dir, "scripts/map-author.ts"), "l2", ...args], { cwd: dir, encoding: "utf8", env: { ...process.env, CLAUDE_CONFIG_DIR: join(scratch, "claude") } });
const ok = (...args: string[]) => {
  const result = cli(...args);
  assert.equal(result.status, 0, `l2 ${args.join(" ")}: ${result.stdout}${result.stderr}`);
  return result.stdout;
};
const refused = (pattern: RegExp, ...args: string[]) => {
  const result = cli(...args);
  assert.notEqual(result.status, 0, `l2 ${args.join(" ")} should be refused: ${result.stdout}`);
  assert.match(`${result.stdout}${result.stderr}`, pattern);
};
const inbox = (subject: string, role: string, auditor: string) => join(dir, ".map-authoring/l2/work", RUN, "inbox", subject, `${role}-${auditor}`, "findings.json");
/** Writes an auditor's findings to its own inbox (as its prompt names it), then submits them. */
function submit(subject: string, role: string, auditor: string, findings: Record<string, unknown>) {
  writeFileSync(inbox(subject, role, auditor), JSON.stringify(findings));
  return cli("submit-audit", subject, "--role", role, "--auditor", auditor, "--file", inbox(subject, role, auditor));
}
const failing = (subject: string, auditor: string) => ({ verdict: "fail", note: `${auditor}: checked accuracy. Advisory: none`, findings: [{ severity: "blocking", concept: subject, criterion: "accuracy", evidence: { quote: quotes[subject] }, action: `condition the ${subject} definition (${auditor})` }] });
const passing = (auditor: string) => ({ verdict: "pass", note: `${auditor}: checked overlap, territory, representation, accuracy and depth. Advisory: none`, findings: [] });

/** Run inside the fixture with its own modules. `plan`: the group file runs v2. `state`: the run, every draft recorded. `author <ids>`: records drafts as they are now. */
const BUILDER = `
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
const [root, mode, base, ...ids] = process.argv.slice(2);
const load = (path) => import(join(root, path));
const file = join(root, "src/lib/map/authoring/l2/groups/${GROUP}.json");
const plan = JSON.parse(readFileSync(file, "utf8"));
const concepts = plan.members.filter((member) => member.standing === "owned").map((member) => member.conceptId);
if (mode === "plan") {
  plan.pipeline = { mode: "simplified", version: 2 };
  writeFileSync(file, JSON.stringify(plan, null, 2) + "\\n");
  process.exit(0);
}
const { mapKnowledge } = await load("src/lib/map/data.ts");
const { contentFingerprint } = await load("src/lib/map/authoring/representation/design.ts");
const { createL2RunState, recordL2Step } = await load("src/lib/map/authoring/orchestrator/run-state.ts");
const record = (id) => mapKnowledge.content.find((entry) => entry.conceptId === id);
const path = join(root, ".map-authoring/l2/${RUN}.json");
const at = "2026-11-07T10:00:00.000Z";
if (mode === "state") {
  const slice = { id: "${RUN}", domain: "state-data", domainTitle: "State Data", ordinal: "9", index: 1, groups: [{ group: "${GROUP}", title: "${GROUP}", concepts }] };
  let state = createL2RunState({ slice, remaining: concepts, branch: "fixture", baseSha: base, now: at, pipeline: { mode: "simplified", version: 2 } });
  delete state.l2.attempts;
  state = recordL2Step(state, { kind: "plan", subject: "${GROUP}" }, at);
  for (const id of concepts) state = recordL2Step(state, { kind: "author", subject: id }, at, { fingerprint: contentFingerprint(record(id)) });
  mkdirSync(join(root, ".map-authoring/l2"), { recursive: true });
  writeFileSync(path, JSON.stringify(state, null, 2) + "\\n");
  console.log(JSON.stringify(Object.fromEntries(concepts.map((id) => [id, record(id).definition.split(". ")[0]]))));
} else {
  let state = JSON.parse(readFileSync(path, "utf8"));
  for (const id of ids) state = recordL2Step(state, { kind: "author", subject: id }, at, { fingerprint: contentFingerprint(record(id)) });
  writeFileSync(path, JSON.stringify(state, null, 2) + "\\n");
}
`;
const build = (mode: string, ...rest: string[]) => {
  const built = spawnSync(process.execPath, ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", join(scratch, "build.mjs"), dir, mode, ...rest], { cwd: dir, encoding: "utf8" });
  assert.equal(built.status, 0, built.stderr);
  return built.stdout;
};

before(() => {
  scratch = mkdtempSync(join(tmpdir(), "l2-evidence-cli-"));
  dir = join(scratch, "repo");
  mkdirSync(dir);
  for (const part of ["src", "scripts"]) cpSync(join(ROOT, part), join(dir, part), { recursive: true });
  symlinkSync(join(ROOT, "node_modules"), join(dir, "node_modules"));
  writeFileSync(join(dir, ".gitignore"), "/node_modules\n/.map-authoring/\n/.claude/\n");
  const init = spawnSync("git", ["init", "-q", "-b", "fixture"], { cwd: dir, encoding: "utf8" });
  assert.equal(init.status, 0, init.stderr);
  writeFileSync(join(scratch, "build.mjs"), BUILDER);
  build("plan");
  git("add", "-A");
  git("commit", "-q", "-m", "base");
  quotes = JSON.parse(build("state", git("rev-parse", "HEAD")));
});
after(() => rmSync(scratch, { recursive: true, force: true }));

test("CLI: first audits stay independent; both concepts are reopened from their findings", () => {
  for (const subject of [X, Y]) {
    const promptA = ok("audit-task", subject, "--role", "first-audit", "--auditor", "A");
    assert.ok(promptA.includes(inbox(subject, "first-audit", "A")) && !/F1:|verifications/.test(promptA));
    assert.equal(submit(subject, "first-audit", "A", failing(subject, "A")).status, 0);
    // Before B has submitted, the tool shows nobody A's findings (nor its verdict).
    const early = ok("findings", subject);
    assert.match(early, /withheld until both first audits are in/);
    assert.ok(!early.includes(quotes[subject]) && !early.includes("fail"));
    assert.deepEqual(JSON.parse(ok("findings", subject, "--json")), []);
    ok("audit-task", subject, "--role", "first-audit", "--auditor", "B");
    assert.equal(submit(subject, "first-audit", "B", passing("B")).status, 0);
    const both = ok("findings", subject);
    assert.match(both, /blocking finding\(s\): reopen/);
    assert.ok(both.includes(quotes[subject]));
  }
  // Reopened one at a time, as in the pilot: each keeps only its own findings, with their source artifacts.
  ok("reopen", X, "--from-findings");
  ok("reopen", Y, "--from-findings");
  const state = JSON.parse(readFileSync(join(dir, ".map-authoring/l2", `${RUN}.json`), "utf8"));
  const evidence = state.l2.repair.evidence;
  assert.deepEqual(Object.keys(evidence).sort(), [X, Y].sort());
  for (const subject of [X, Y]) {
    assert.equal(evidence[subject].length, 1);
    const [finding] = evidence[subject][0].findings;
    assert.deepEqual([finding.concept, finding.role, finding.auditor, finding.evidence.quote], [subject, "first-audit", "A", quotes[subject]]);
    const artifact = readFileSync(join(dir, ".map-authoring/l2/work", RUN, "audits", finding.artifact.path));
    assert.equal(createHash("sha256").update(artifact).digest("hex"), finding.artifact.sha256);
  }
});

test("CLI: after a sibling's repair, a concept's findings stay retrievable as historical evidence and never count as current", () => {
  // The repair step names the concept's own findings, not the cycle's latest reopening (which was Y's).
  const next = ok("next");
  assert.match(next, new RegExp(`repair ${X} \\(cycle 1: its own findings: \`map:author -- l2 repair-findings ${X}\`\\)`));
  assert.ok(!next.includes(quotes[Y]));
  // X is repaired: its record changes, so every artifact bound to X as Y's neighbour stops counting.
  const data = join(dir, "src/lib/map/data.ts");
  const text = readFileSync(data, "utf8");
  const at = text.indexOf(`id: "${X}-content"`);
  const definition = text.indexOf('definition: "', at);
  writeFileSync(data, `${text.slice(0, definition)}definition: "(repaired) ${text.slice(definition + 'definition: "'.length)}`);
  build("author", "", X, Y);

  // `l2 findings` no longer lists Y's artifacts as current (they judged the old X), and says where its findings are.
  const findings = ok("findings", Y);
  assert.match(findings, new RegExp(`no findings submitted for ${Y} as its records are now`));
  assert.match(findings, new RegExp(`historical: ${Y}'s own findings in repair cycle 1.*repair-findings ${Y}.*never current evidence`));
  assert.match(findings, /stale: 2 earlier artifact\(s\)/);
  assert.deepEqual(JSON.parse(ok("findings", Y, "--json")), []);

  // Y's repairer reads exactly Y's findings, labelled historical, provenance confirmed; never X's.
  const forY = ok("repair-findings", Y);
  assert.match(forY, /HISTORICAL: they judged .* not current audit evidence and never an approval/);
  assert.ok(forY.includes(quotes[Y]) && !forY.includes(quotes[X]));
  assert.match(forY, /provenance confirmed/);
  const json = JSON.parse(ok("repair-findings", Y, "--json"));
  assert.deepEqual([json.status, json.current, json.items.map((item: { id: string }) => item.id)], ["historical", false, ["F1"]]);
  const forX = ok("repair-findings", X);
  assert.ok(forX.includes(quotes[X]) && !forX.includes(quotes[Y]));
  refused(/not reopened in an open repair cycle/, "repair-findings", "invalid-transitions");
});

test("CLI: a re-audit is given exactly its concept's findings and must verify each in the record as repaired", () => {
  const prompt = ok("audit-task", X, "--role", "re-audit", "--auditor", "R");
  assert.match(prompt, /The repair answered exactly these findings \(F1\)/);
  assert.match(prompt, new RegExp(`F1: ${X} \\[first-audit A, accuracy\\]`));
  assert.ok(prompt.includes(quotes[X]) && !prompt.includes(quotes[Y]));
  assert.match(prompt, /a claim that a finding is fixed is never evidence/);

  // A pass that does not verify F1, or that leaves it unresolved, is refused; nothing is published.
  assert.match(submit(X, "re-audit", "R", passing("R")).stderr, /verifications must list each finding the repair answered \(F1\)/);
  assert.match(submit(X, "re-audit", "R", { ...passing("R"), verifications: [{ id: "F1", status: "unresolved", evidence: "unchanged" }] }).stderr, /F1 unresolved: a finding the repair did not resolve is still blocking/);
  assert.match(submit(X, "re-audit", "R", { ...passing("R"), verifications: [{ id: "F1", status: "resolved", evidence: "x" }, { id: "F2", status: "resolved", evidence: "y" }] }).stderr, /F2 is not a finding this repair answered/);
  assert.match(ok("findings", X), /no findings submitted/);
  // Verified: accepted, and recordable as far as the artifacts go.
  const verified = submit(X, "re-audit", "R", { ...passing("R"), verifications: [{ id: "F1", status: "resolved", evidence: "the definition now reads '(repaired) ...'" }] });
  assert.equal(verified.status, 0, verified.stderr);
  assert.match(ok("findings", X), /outcome: ready to record/);
});

test("CLI: evidence whose source artifact changed or vanished is refused, never shown or handed to a re-auditor", () => {
  const { items } = JSON.parse(ok("repair-findings", Y, "--json"));
  const source = join(dir, ".map-authoring/l2/work", RUN, "audits", items[0].finding.artifact.path);
  const original = readFileSync(source);
  appendFileSync(source, " ");
  try {
    refused(/provenance cannot be confirmed[\s\S]*changed since the concept was reopened/, "repair-findings", Y);
    refused(/provenance cannot be confirmed/, "audit-task", Y, "--role", "re-audit", "--auditor", "R");
    rmSync(source);
    refused(/is missing/, "repair-findings", Y);
  } finally {
    writeFileSync(source, original);
  }
  assert.match(ok("repair-findings", Y), /provenance confirmed/);
});
