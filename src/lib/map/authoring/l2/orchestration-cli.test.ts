/**
 * `l2 next --json` from the real CLI, against a fixture run in a copy of the repository (its own git repository and
 * Claude configuration directory): deterministic, read-only output for the interrupted-attempt, missing-hook,
 * journal-present and stale-neighbour cases, and the operations it advertises executed by the CLI itself. No model
 * is called: the fixture's attempt was "interrupted" by writing its log.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import type { L2Next } from "./orchestration.ts";

const ROOT = new URL("../../../../../", import.meta.url).pathname;
const GROUP = "transitions-in-state-data";
const RUN = "fixture-1";
let dir = "";
let scratch = "";

const git = (...args: string[]) => {
  const result = spawnSync("git", ["-c", "user.name=fixture", "-c", "user.email=fixture@example.invalid", "-c", "commit.gpgsign=false", ...args], { cwd: dir, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
};
const cli = (...args: string[]) => spawnSync(process.execPath, ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", join(dir, "scripts/map-author.ts"), "l2", ...args], { cwd: dir, encoding: "utf8", env: { ...process.env, CLAUDE_CONFIG_DIR: join(scratch, "claude") } });
function next(): { text: string; view: L2Next } {
  const result = cli("next", "--json");
  assert.equal(result.status, 0, result.stderr);
  return { text: result.stdout, view: JSON.parse(result.stdout) as L2Next };
}
/** Every file the run's state and content are made of, hashed: what `next --json` must never change. */
function snapshot(): string {
  const hash = createHash("sha256");
  const walk = (path: string) => {
    if (!existsSync(path)) return;
    if (statSync(path).isDirectory()) for (const name of readdirSync(path).sort()) walk(join(path, name));
    else hash.update(`${path}\0`).update(readFileSync(path));
  };
  walk(join(dir, ".map-authoring"));
  walk(join(dir, "src/lib/map"));
  hash.update(git("status", "--porcelain"));
  return hash.digest("hex");
}
const statePath = () => join(dir, ".map-authoring/l2", `${RUN}.json`);
const stepOf = (view: L2Next, key: string) => view.steps.find((step) => step.key === key);

/** Builds, inside the fixture and with its own modules, a version-2 run over a committed group: drafts recorded, four audits recorded and bound to their neighbours, the fifth's auditor A interrupted. */
const BUILDER = `
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const [root, base] = process.argv.slice(2);
const load = (path) => import(join(root, path));
const { mapKnowledge } = await load("src/lib/map/data.ts");
const { readPlans } = await load("scripts/map-author-l2.ts");
const { neighbourBasis } = await load("src/lib/map/authoring/l2/coverage.ts");
const { contentFingerprint } = await load("src/lib/map/authoring/representation/design.ts");
const { createL2RunState, recordL2Step } = await load("src/lib/map/authoring/orchestrator/run-state.ts");
const { DEFAULT_RESERVES } = await load("src/lib/map/authoring/l2/budget.ts");
const file = join(root, "src/lib/map/authoring/l2/groups/${GROUP}.json");
const plan = JSON.parse(readFileSync(file, "utf8"));
plan.pipeline = { mode: "simplified", version: 2 };
writeFileSync(file, JSON.stringify(plan, null, 2) + "\\n");
const concepts = plan.members.filter((member) => member.standing === "owned").map((member) => member.conceptId);
const plans = readPlans();
const record = (id) => mapKnowledge.content.find((entry) => entry.conceptId === id);
for (const id of concepts.slice(0, 4)) plan.concepts[id].audit = { ...plan.concepts[id].audit, recordFingerprint: contentFingerprint(record(id)), neighbours: neighbourBasis(mapKnowledge, plans, id) };
writeFileSync(file, JSON.stringify(plan, null, 2) + "\\n");
const at = "2026-11-06T10:00:00.000Z";
const slice = { id: "${RUN}", domain: "state-data", domainTitle: "State Data", ordinal: "9", index: 1, groups: [{ group: "${GROUP}", title: "${GROUP}", concepts }] };
let state = createL2RunState({ slice, remaining: concepts, branch: "fixture", baseSha: base, now: at, pipeline: { mode: "simplified", version: 2 } });
state = { ...state, l2: { ...state.l2, budget: { capUsd: 20, reserves: { ...DEFAULT_RESERVES }, headroomUsd: 5, setAt: at } } };
state = recordL2Step(state, { kind: "plan", subject: "${GROUP}" }, at);
for (const id of concepts) state = recordL2Step(state, { kind: "author", subject: id }, at, { fingerprint: contentFingerprint(record(id)) });
for (const id of concepts.slice(0, 4)) state = recordL2Step(state, { kind: "audit", subject: id }, at);
const l2 = join(root, ".map-authoring/l2");
for (const sub of ["attempts", "journal", "budget"]) mkdirSync(join(l2, sub), { recursive: true });
writeFileSync(join(l2, "${RUN}.json"), JSON.stringify(state, null, 2) + "\\n");
const step = { kind: "audit", subject: concepts[4], role: "first-audit", auditor: "A" };
const history = [{ to: "pending", at, reason: "begun" }, { from: "pending", to: "running", at, reason: "launched" }, { from: "running", to: "interrupted", at, reason: "no session reported it" }];
writeFileSync(join(l2, "attempts/${RUN}.json"), JSON.stringify({ version: 1, run: "${RUN}", attempts: [{ version: 1, id: "att-f1xture-001", run: "${RUN}", step, pipeline: { mode: "simplified", version: 2 }, inputs: { binding: "older" }, inputKey: "older", status: "interrupted", createdAt: at, updatedAt: at, history, launch: { ref: "r", at } }] }, null, 2) + "\\n");
console.log(concepts.join(" "));
`;

before(() => {
  scratch = mkdtempSync(join(tmpdir(), "l2-next-cli-"));
  dir = join(scratch, "repo");
  mkdirSync(dir);
  for (const part of ["src", "scripts"]) cpSync(join(ROOT, part), join(dir, part), { recursive: true });
  symlinkSync(join(ROOT, "node_modules"), join(dir, "node_modules"));
  writeFileSync(join(dir, ".gitignore"), "/node_modules\n/.map-authoring/\n/.claude/\n");
  const init = spawnSync("git", ["init", "-q", "-b", "fixture"], { cwd: dir, encoding: "utf8" });
  assert.equal(init.status, 0, init.stderr);
  git("add", "-A");
  git("commit", "-q", "-m", "base");
  const builder = join(scratch, "build-fixture.mjs");
  writeFileSync(builder, BUILDER);
  const built = spawnSync(process.execPath, ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", builder, dir, git("rev-parse", "HEAD")], { cwd: dir, encoding: "utf8" });
  assert.equal(built.status, 0, built.stderr);
});
after(() => rmSync(scratch, { recursive: true, force: true }));

test("CLI: deterministic and read-only; an interrupted attempt and a missing hook block for a human", () => {
  const before = snapshot();
  const one = next();
  const two = next();
  assert.equal(one.text, two.text);
  assert.equal(snapshot(), before);
  const view = one.view;
  assert.deepEqual([view.schema, view.version, view.run.id, view.state, view.governance], ["map-l2-next", 1, RUN, "blocked", { merge: "human-only", hookRegistered: false, paidExecution: "attended-only" }]);
  assert.deepEqual(view.blockers.map((blocker) => [blocker.code, blocker.subject, blocker.actor]), [
    ["attempt-interrupted", "att-f1xture-001", "human"],
    ["hook-unregistered", "audit:atomic-state-transitions", "human"],
  ]);
  assert.equal(stepOf(view, "audit:transition-effects")?.status, "blocked");
  // With no hook to enforce the cap, nothing leads to paid work; only reconciling is the driver's.
  assert.deepEqual([view.permitted, view.attended], [["reconcile"], []]);
  assert.deepEqual(view.freshness, { stale: [], unbound: [] });
});

test("CLI: with the hook registered, the advertised begin-attempt is accepted and its launch is offered attended", () => {
  const hook = cli("budget", "hook");
  assert.equal(hook.status, 0, hook.stderr);
  mkdirSync(join(dir, ".claude"), { recursive: true });
  writeFileSync(join(dir, ".claude/settings.local.json"), hook.stdout);
  const { view } = next();
  const step = stepOf(view, "audit:atomic-state-transitions")!;
  assert.deepEqual(step.operations?.map((op) => [op.op, op.actor, op.command]), [
    ["begin-attempt", "driver", "l2 audit-task atomic-state-transitions --role first-audit --auditor A"],
    ["begin-attempt", "driver", "l2 audit-task atomic-state-transitions --role first-audit --auditor B"],
  ]);
  const begun = cli(...step.operations![0].command!.split(" ").slice(1));
  assert.equal(begun.status, 0, begun.stderr);
  const after = next().view;
  const unit = stepOf(after, "audit:atomic-state-transitions")!.units!.find((entry) => entry.auditor === "A")!;
  assert.equal(unit.attempt?.status, "pending");
  const launch = stepOf(after, "audit:atomic-state-transitions")!.operations!.find((op) => op.op === "launch-agent")!;
  assert.deepEqual([launch.actor, launch.paid, launch.task?.includes(`#${unit.attempt!.id}`)], ["attended", true, true]);
  assert.deepEqual(after.attended, ["launch-agent"]);
});

test("CLI: an unrecovered journal is reported and left exactly as it is", () => {
  const journal = join(dir, ".map-authoring/l2/journal", `${RUN}.json`);
  writeFileSync(journal, `${JSON.stringify({ version: 1, run: RUN, tx: "audit:transition-effects@x", what: "simulated", files: [] })}\n`);
  const before = snapshot();
  const { view } = next();
  assert.deepEqual([view.state, view.steps, view.permitted, view.operations.map((op) => op.command)], ["recovery-required", [], ["recover-journal"], ["l2 reconcile"]]);
  assert.equal(snapshot(), before);
  assert.ok(existsSync(journal));
  rmSync(journal);
});

test("CLI: a neighbour change makes exactly its bound audits stale; after commits the CLI accepts the reopen it advertises", () => {
  const data = join(dir, "src/lib/map/data.ts");
  const text = readFileSync(data, "utf8");
  const at = text.indexOf('id: "global-state-content"');
  const definition = text.indexOf('definition: "', at);
  writeFileSync(data, `${text.slice(0, definition)}definition: "(edited) ${text.slice(definition + 'definition: "'.length)}`);
  let { view } = next();
  const stale = view.freshness.stale.map((entry) => [entry.step, entry.resolution, entry.actor, entry.reasons]);
  const reasons = [{ kind: "neighbour-changed", concept: "global-state" }];
  assert.deepEqual(stale, [
    ["audit:transition-functions", "re-audit", "attended", reasons],
    ["audit:valid-transitions", "re-audit", "attended", reasons],
    ["audit:invalid-transitions", "re-audit", "attended", reasons],
  ]);
  assert.equal(stepOf(view, "audit:transition-preconditions"), undefined);

  // The change lands with the run's commits (as a sync would bring it): an audit can no longer be replaced.
  git("commit", "-q", "-am", "content");
  const state = JSON.parse(readFileSync(statePath(), "utf8"));
  writeFileSync(statePath(), `${JSON.stringify({ ...state, stage: "gates", commits: [{ sha: git("rev-parse", "HEAD"), message: "content", files: [] }] }, null, 2)}\n`);
  view = next().view;
  assert.deepEqual(view.freshness.stale.map((entry) => [entry.resolution, entry.actor]), [["reopen", "human"], ["reopen", "human"], ["reopen", "human"]]);
  // The gates would refuse the stale audits: no tool stage is offered, only reconciling the run's open attempts.
  assert.deepEqual([view.state, view.operations.map((op) => op.op), view.permitted, view.attended], ["blocked", ["reconcile"], ["reconcile"], []]);
  const advised = view.freshness.stale[0].command;
  assert.equal(advised, 'l2 reopen transition-functions --reason ".."');
  const reopened = cli(...advised.split(" --reason")[0].split(" ").slice(1), "--reason", "global-state changed");
  assert.equal(reopened.status, 0, `${advised}: ${reopened.stdout}${reopened.stderr}`);
  view = next().view;
  assert.deepEqual([view.run.stage, view.run.repair], ["author", { cycle: 1, concepts: ["transition-functions"] }]);
  assert.deepEqual(stepOf(view, "author:transition-functions")?.operations?.map((op) => op.command), ["l2 attempt begin author transition-functions --role repair"]);
});
