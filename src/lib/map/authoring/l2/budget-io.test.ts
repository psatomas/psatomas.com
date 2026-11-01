import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { startBudget, type L2Budget } from "./budget.ts";
import { launchGate, measureRun, readLedger, withLock, BudgetLockError, type LaunchInput } from "./budget-io.ts";
import { roleOf } from "./cost.ts";

const BRANCH = "feat/map-state-data-l2-1-g3";
const STARTED = "2026-11-01T00:00:00.000Z";
const AT = "2026-11-01T02:00:00.000Z";
/** One Opus call: 50,000 output tokens is $1.00 at list price. */
const call = (id: string, { branch = BRANCH, timestamp = "2026-11-01T01:00:00.000Z", usage = true, model = "claude-opus-5-5", dollars = 1 } = {}) =>
  JSON.stringify({ type: "assistant", timestamp, gitBranch: branch, message: { id, model, ...(usage ? { usage: { input_tokens: 0, output_tokens: dollars * 50_000, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } } : {}) } });

/** A scratch world: a transcript directory, a run state directory and a ledger directory. */
function world(budget: L2Budget | null = startBudget("20", undefined, STARTED)) {
  const root = mkdtempSync(join(tmpdir(), "l2-budget-"));
  const transcripts = join(root, "transcripts");
  const stateDir = join(root, "state");
  mkdirSync(transcripts, { recursive: true });
  mkdirSync(stateDir, { recursive: true });
  const run = { version: 1, kind: "l2", domainId: "state-data-1-g3", branch: BRANCH, createdAt: STARTED, stage: "author", l2: budget ? { budget } : {} };
  writeFileSync(join(stateDir, "state-data-1-g3.json"), JSON.stringify(run));
  writeFileSync(join(stateDir, "campaign.json"), "{}");
  const orchestrator = (lines: string[]) => writeFileSync(join(transcripts, "s1.jsonl"), `${lines.join("\n")}\n`);
  const subagent = (name: string, lines: string[], meta: Record<string, unknown>) => {
    mkdirSync(join(transcripts, "s1", "subagents"), { recursive: true });
    writeFileSync(join(transcripts, "s1", "subagents", `agent-${name}.jsonl`), `${lines.join("\n")}\n`);
    writeFileSync(join(transcripts, "s1", "subagents", `agent-${name}.meta.json`), JSON.stringify(meta));
  };
  const ledger = (run: string) => join(root, "ledgers", `${run}.json`);
  /** A launch from the run's own session (its transcript in the measured directory) unless the input names another. */
  const gate = (input: LaunchInput, branch: string | null = BRANCH, elsewhere: Parameters<typeof launchGate>[1]["elsewhere"] = []) =>
    launchGate("transcript_path" in input ? input : { ...input, transcript_path: join(transcripts, "s1.jsonl") }, { stateDir, branch: branch ?? undefined, ledgerPath: ledger, measure: (r) => measureRun(transcripts, { branch: r.branch, since: r.createdAt }), transcripts, elsewhere, now: AT, role: roleOf });
  return { root, transcripts, stateDir, orchestrator, subagent, ledger, gate, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}
const launch = (id: string, description = "First audit A computation-integrity"): LaunchInput => ({ tool_name: "Agent", tool_use_id: id, session_id: "s1", tool_input: { description } });

test("a run's spend is measured from its branch's calls since it started, each subagent with its launch and whether it finished", () => {
  const w = world();
  try {
    w.orchestrator([call("o1"), call("o1"), call("o2", { branch: "main" }), call("o3", { timestamp: "2026-10-31T23:00:00.000Z" }), "not json"]);
    w.subagent("a", [call("a1", { dollars: 2 })], { description: "Author x", toolUseId: "toolu_a", finished: true });
    w.subagent("b", [], { description: "First audit B x", toolUseId: "toolu_b", finished: false });
    const sessions = measureRun(w.transcripts, { branch: BRANCH, since: STARTED });
    // o1 is one call however often it is logged; o2 is another branch, o3 is before the run.
    assert.deepEqual(sessions.map((session) => [session.description, session.toolUseId, session.finished, session.usd]), [
      ["orchestrator s1", undefined, undefined, 1],
      ["Author x", "toolu_a", true, 2],
      ["First audit B x", "toolu_b", false, 0],
    ]);
    w.subagent("c", [call("c1", { usage: false }), call("c2", { model: "claude-mystery-1" })], { description: "Repair y", toolUseId: "toolu_c" });
    const c = measureRun(w.transcripts, { branch: BRANCH, since: STARTED }).find((session) => session.toolUseId === "toolu_c")!;
    assert.deepEqual([c.unmeasured, c.unpriced], [1, ["claude-mystery-1"]]);
    assert.deepEqual(measureRun(join(w.root, "absent"), { branch: BRANCH, since: STARTED }), []);
  } finally {
    w.cleanup();
  }
});

test("the gate passes what is not an Agent launch, launches when no run is unfinished, and a run started before caps", () => {
  const w = world();
  try {
    assert.deepEqual(w.gate({ tool_name: "Bash" }), { allow: true });
    // A finished run binds nothing, whatever the branch.
    const state = join(w.stateDir, "state-data-1-g3.json");
    const unfinished = readFileSync(state, "utf8");
    writeFileSync(state, JSON.stringify({ ...JSON.parse(unfinished), stage: "done" }));
    assert.deepEqual(w.gate(launch("toolu_1"), "main"), { allow: true });
    assert.deepEqual(w.gate(launch("toolu_1")), { allow: true });
    writeFileSync(state, unfinished);
    assert.equal(existsSync(w.ledger("state-data-1-g3")), false);
    const legacy = world(null);
    try {
      assert.deepEqual(legacy.gate(launch("toolu_1")), { allow: true, run: "state-data-1-g3" });
      assert.equal(existsSync(legacy.ledger("state-data-1-g3")), false);
    } finally {
      legacy.cleanup();
    }
  } finally {
    w.cleanup();
  }
});

test("on a capped run the gate reserves each launch until spent, reserved and headroom reach the cap, then refuses without writing", () => {
  const w = world();
  try {
    w.orchestrator([call("o1", { dollars: 3 })]);
    // $20 cap: $3 spent, $5 headroom, $3 per audit: four launches fit, the fifth does not.
    for (const id of ["t1", "t2", "t3", "t4"]) assert.equal(w.gate(launch(id)).allow, true, id);
    const before = readFileSync(w.ledger("state-data-1-g3"), "utf8");
    const refused = w.gate(launch("t5"));
    assert.equal(refused.allow, false);
    assert.match((refused as { reason: string }).reason, /a first-audit launch reserves \$3\.00, but only \$0\.00 of the \$20\.00 cap is available.*No model work starts on state-data-1-g3 until a human decides/);
    assert.equal(readFileSync(w.ledger("state-data-1-g3"), "utf8"), before);
    assert.deepEqual(readLedger(w.ledger("state-data-1-g3"), "state-data-1-g3").reservations.map((entry) => [entry.id, entry.role, entry.usd, entry.session]), [
      ["t1", "first-audit", 3, "s1"],
      ["t2", "first-audit", 3, "s1"],
      ["t3", "first-audit", 3, "s1"],
      ["t4", "first-audit", 3, "s1"],
    ]);
    // Two launches finish having spent $1 each: their reserves are settled by the measured spend, and room returns.
    w.subagent("t1", [call("t1a")], { toolUseId: "t1", finished: true });
    w.subagent("t2", [call("t2a")], { toolUseId: "t2", finished: true });
    assert.equal(w.gate(launch("t5")).allow, true);
  } finally {
    w.cleanup();
  }
});

test("an interrupted launch keeps holding its reserve: its session never reports finishing", () => {
  const w = world();
  try {
    for (const id of ["t1", "t2", "t3", "t4", "t5"]) assert.equal(w.gate(launch(id)).allow, true, id);
    // t1 was killed mid-session after spending $0.50; nothing says it finished.
    w.subagent("t1", [call("t1a", { dollars: 0.5 })], { toolUseId: "t1", finished: false });
    const refused = w.gate(launch("t6"));
    assert.equal(refused.allow, false);
    assert.match((refused as { reason: string }).reason, /only \$0\.00 .*spent \$0\.50 measured, \$14\.50 reserved for 5 launch/);
  } finally {
    w.cleanup();
  }
});

test("the gate refuses when spend cannot be measured, the branch is unknown, the ledger is foreign, or two runs share a branch", () => {
  const unpriced = world();
  try {
    unpriced.orchestrator([call("o1", { model: "claude-mystery-1" })]);
    assert.match((unpriced.gate(launch("t1")) as { reason: string }).reason, /spend cannot be measured.*claude-mystery-1/);
  } finally {
    unpriced.cleanup();
  }
  const w = world();
  try {
    assert.match((w.gate(launch("t1"), null) as { reason: string }).reason, /cannot tell the current branch/);
    mkdirSync(join(w.root, "ledgers"), { recursive: true });
    writeFileSync(w.ledger("state-data-1-g3"), JSON.stringify({ version: 1, run: "another-run", reservations: [] }));
    assert.match((w.gate(launch("t1")) as { reason: string }).reason, /could not be checked .*not the budget ledger of state-data-1-g3/);
    writeFileSync(join(w.stateDir, "second.json"), JSON.stringify({ kind: "l2", domainId: "second", branch: BRANCH, createdAt: STARTED, stage: "author", l2: {} }));
    assert.match((w.gate(launch("t1")) as { reason: string }).reason, /several unfinished L2 runs are on/);
  } finally {
    w.cleanup();
  }
});

test("a lock left by a dead process is taken over once stale; a live one makes a waiting launch fail rather than pass", () => {
  const w = world();
  try {
    const path = join(w.root, "ledgers", "x.json");
    mkdirSync(`${path}.lock`, { recursive: true });
    assert.throws(() => withLock(path, () => "ran", { timeoutMs: 200, staleMs: 60_000 }), BudgetLockError);
    const old = new Date(Date.now() - 120_000);
    utimesSync(`${path}.lock`, old, old);
    assert.equal(withLock(path, () => "ran", { timeoutMs: 200, staleMs: 60_000 }), "ran");
    assert.equal(existsSync(`${path}.lock`), false);
  } finally {
    w.cleanup();
  }
});

test("launches racing from separate processes never reserve more than the budget holds", async () => {
  const w = world();
  try {
    w.orchestrator([call("o1", { dollars: 6 })]);
    // $20 cap - $6 spent - $5 headroom = $9: exactly three $3 launches fit, however the twelve below interleave.
    const script = join(w.root, "racer.mts");
    const gateModule = new URL("./budget-io.ts", import.meta.url).pathname;
    const cost = new URL("./cost.ts", import.meta.url).pathname;
    writeFileSync(
      script,
      `const { launchGate, measureRun } = await import(${JSON.stringify(gateModule)});
const { roleOf } = await import(${JSON.stringify(cost)});
const [stateDir, transcripts, ledgers, id] = process.argv.slice(2);
const outcome = launchGate({ tool_name: "Agent", tool_use_id: id, transcript_path: transcripts + "/s1.jsonl", tool_input: { description: "First audit " + id } }, { stateDir, branch: ${JSON.stringify(BRANCH)}, ledgerPath: (run) => ledgers + "/" + run + ".json", measure: (r) => measureRun(transcripts, { branch: r.branch, since: r.createdAt }), transcripts, now: new Date().toISOString(), role: roleOf });
process.stdout.write(outcome.allow ? "allow" : "refuse");`,
    );
    const race = (id: string) =>
      new Promise<string>((resolve, reject) => {
        const child = spawn(process.execPath, ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", script, w.stateDir, w.transcripts, join(w.root, "ledgers"), id]);
        let out = "";
        child.stdout.on("data", (chunk) => (out += chunk));
        child.on("error", reject);
        child.on("close", () => resolve(out));
      });
    const outcomes = await Promise.all(Array.from({ length: 12 }, (_, index) => race(`r${index}`)));
    assert.equal(outcomes.filter((outcome) => outcome === "allow").length, 3, outcomes.join(","));
    assert.equal(outcomes.filter((outcome) => outcome === "refuse").length, 9);
    assert.equal(readLedger(w.ledger("state-data-1-g3"), "state-data-1-g3").reservations.length, 3);
  } finally {
    w.cleanup();
  }
});

test("a launch whose spend the run would not measure is refused: a session writing transcripts elsewhere, or not saying where", () => {
  const w = world();
  try {
    // A session started in another checkout or a subdirectory writes its transcripts to another project directory.
    const outside = w.gate({ ...launch("t1"), transcript_path: join(w.root, "other-project", "s9.jsonl") });
    assert.match((outside as { reason: string }).reason, /this session's transcript .*other-project.* is not in .*transcripts, where the spend of state-data-1-g3 is measured/);
    assert.match((w.gate({ ...launch("t1"), transcript_path: undefined }) as { reason: string }).reason, /not reported/);
    assert.equal(existsSync(w.ledger("state-data-1-g3")), false);
    // A subagent's own launch reports a transcript inside its session's directory: measured, so allowed.
    assert.equal(w.gate({ ...launch("t1"), transcript_path: join(w.transcripts, "s1", "subagents", "agent-a.jsonl") }).allow, true);
    // A look-alike sibling directory is not inside the measured one.
    assert.equal(w.gate({ ...launch("t2"), transcript_path: `${w.transcripts}-2/s1.jsonl` }).allow, false);
  } finally {
    w.cleanup();
  }
});

test("while a capped run is unfinished, launches from another branch or another checkout are refused; an uncapped run elsewhere refuses nothing", () => {
  const w = world();
  try {
    // This checkout, switched to another branch: the run's spend is filtered by its branch, so this launch would not count.
    assert.match((w.gate(launch("t1"), "main") as { reason: string }).reason, /capped L2 run state-data-1-g3 \(this checkout, on feat\/map-state-data-l2-1-g3\) is unfinished/);
    // Another worktree of the repository holds a capped run: a launch here is not measured by it.
    const elsewhere = [{ root: "/elsewhere/checkout", runs: [{ domainId: "other-run", branch: "feat/other", createdAt: STARTED, stage: "author", l2: { budget: startBudget("20", undefined, STARTED) } }] }];
    const quiet = world(null);
    try {
      assert.match((quiet.gate(launch("t1"), "main", elsewhere) as { reason: string }).reason, /other-run \(in \/elsewhere\/checkout, on feat\/other\)/);
      assert.equal(quiet.gate(launch("t1"), "main", [{ root: "/elsewhere/checkout", runs: [{ ...elsewhere[0].runs[0], l2: {} }] }]).allow, true);
      assert.equal(quiet.gate(launch("t1"), "main", []).allow, true);
      assert.equal(quiet.gate({ tool_name: "Bash" }, "main", elsewhere).allow, true);
    } finally {
      quiet.cleanup();
    }
  } finally {
    w.cleanup();
  }
});
