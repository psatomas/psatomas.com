import assert from "node:assert/strict";
import test from "node:test";
import { budgetHookInstalled, BudgetError, budgetStatus, changeCap, DEFAULT_HEADROOM_USD, emptyLedger, launchProblem, releaseLaunch, reserveFor, reserveLaunch, startBudget, type L2BudgetLedger, type L2SpendSession } from "./budget.ts";

const T0 = "2026-11-01T00:00:00.000Z";
const T1 = "2026-11-01T01:00:00.000Z";
/** A $20 cap: $3 per launch (group audits $4), $5 headroom. */
const budget = () => startBudget("20", undefined, T0);
const orchestrator = (usd: number): L2SpendSession => ({ description: "orchestrator s1", usd, unpriced: [], unmeasured: 0 });
const agent = (toolUseId: string, usd: number, finished?: boolean): L2SpendSession => ({ toolUseId, description: `agent ${toolUseId}`, usd, unpriced: [], unmeasured: 0, ...(finished === undefined ? {} : { finished }) });
const reserved = (ledger: L2BudgetLedger, id: string, role = "first-audit") => {
  const result = reserveLaunch(budget(), budgetStatus(budget(), [], ledger), ledger, { id, role, at: T0 });
  assert.ok("ledger" in result, "problem" in result ? result.problem : "");
  return result.ledger;
};

test("a run's budget needs a positive cap with room for one launch; reserves can be set per role", () => {
  assert.throws(() => startBudget(undefined, undefined, T0), /needs a hard spending cap: --budget-usd/);
  assert.throws(() => startBudget("0", undefined, T0), /not a positive amount/);
  assert.throws(() => startBudget("lots", undefined, T0), /not a positive amount/);
  assert.throws(() => startBudget("8", undefined, T0), /leaves no room for one launch/);
  const custom = startBudget("50", "author=1.5,first-audit=2", T0, "2");
  assert.deepEqual([custom.capUsd, custom.reserves.author, custom.reserves["first-audit"], custom.reserves["group-audit"], custom.headroomUsd], [50, 1.5, 2, 4, 2]);
  assert.throws(() => startBudget("50", "author=-1", T0), BudgetError);
  assert.throws(() => startBudget("50", "author", T0), /not role=usd/);
  assert.equal(budget().headroomUsd, DEFAULT_HEADROOM_USD);
  // A role the budget does not name holds the largest reserve.
  assert.equal(reserveFor(budget(), "Explore something"), 4);
});

test("spend is only what was measured; reservations are reported apart and never counted as spent", () => {
  const ledger = reserved(emptyLedger("run"), "toolu_a");
  const status = budgetStatus(budget(), [orchestrator(2), agent("toolu_a", 1)], ledger);
  assert.equal(status.spentUsd, 3);
  // The running launch holds its reserve less what it has measurably spent.
  assert.equal(status.reservedUsd, 2);
  assert.deepEqual(status.open.map((entry) => [entry.id, entry.heldUsd, entry.spentUsd, entry.reporting]), [["toolu_a", 2, 1, true]]);
  assert.equal(status.availableUsd, 20 - 3 - 2 - DEFAULT_HEADROOM_USD);
  // Spending past its reserve holds nothing more: the overrun is all measured.
  assert.equal(budgetStatus(budget(), [agent("toolu_a", 4.5)], ledger).reservedUsd, 0);
});

test("a launch is refused once spent, reserved, headroom and its own reserve would pass the cap", () => {
  let ledger = emptyLedger("run");
  // $20 cap - $5 headroom leaves room for five $3 reserves; the sixth is refused.
  for (const id of ["a", "b", "c", "d", "e"]) ledger = reserved(ledger, id);
  const status = budgetStatus(budget(), [], ledger);
  assert.equal(status.availableUsd, 0);
  const refused = reserveLaunch(budget(), status, ledger, { id: "f", role: "first-audit", at: T0 });
  assert.ok("problem" in refused);
  assert.match(refused.problem, /a first-audit launch reserves \$3\.00, but only \$0\.00 of the \$20\.00 cap is available \(spent \$0\.00 measured, \$15\.00 reserved for 5 launch\(es\) still running, \$5\.00 headroom\)/);
  // A launch id is reserved once.
  assert.match((reserveLaunch(budget(), budgetStatus(budget(), [], emptyLedger("run")), reserved(emptyLedger("run"), "a"), { id: "a", role: "author", at: T0 }) as { problem: string }).problem, /already reserved/);
  // Measured spend counts the same way: $13 spent leaves room for none.
  assert.match(launchProblem(budget(), budgetStatus(budget(), [orchestrator(13)], emptyLedger("run")), "author")!, /only \$2\.00/);
  assert.equal(launchProblem(budget(), budgetStatus(budget(), [orchestrator(12)], emptyLedger("run")), "author"), undefined);
});

test("a finished launch is settled by its measured spend; an interrupted one stays reserved until a human releases it", () => {
  const ledger = reserved(reserved(emptyLedger("run"), "done"), "lost");
  const sessions = [agent("done", 1.2, true), agent("lost", 0.4, false)];
  const status = budgetStatus(budget(), sessions, ledger);
  assert.deepEqual(status.open.map((entry) => entry.id), ["lost"]);
  assert.equal(status.reservedUsd, 3 - 0.4);
  // A launch whose session never started reports nothing: its whole reserve is held.
  assert.equal(budgetStatus(budget(), [], reserved(emptyLedger("run"), "never")).open[0].reporting, false);
  assert.throws(() => releaseLaunch(ledger, "lost", " ", T1), /needs the human's reason/);
  assert.throws(() => releaseLaunch(ledger, "nope", "r", T1), /no reservation nope/);
  const released = releaseLaunch(ledger, "lost", "session killed at the weekly limit; its work was discarded", T1);
  assert.deepEqual(released.reservations.find((entry) => entry.id === "lost")!.released, { at: T1, reason: "session killed at the weekly limit; its work was discarded" });
  assert.equal(budgetStatus(budget(), sessions, released).reservedUsd, 0);
  // Released spend that was measured still counts as spent.
  assert.equal(budgetStatus(budget(), sessions, released).spentUsd, 1.6);
  assert.throws(() => releaseLaunch(released, "lost", "again", T1), /already released/);
});

test("spend that cannot be measured refuses every launch", () => {
  const unpriced = budgetStatus(budget(), [{ ...orchestrator(1), unpriced: ["claude-unknown-9"] }], emptyLedger("run"));
  assert.match(launchProblem(budget(), unpriced, "author")!, /cannot be measured.*claude-unknown-9 has no list price/);
  const unmeasured = budgetStatus(budget(), [{ ...agent("a", 0), unmeasured: 2 }], emptyLedger("run"));
  assert.match(launchProblem(budget(), unmeasured, "author")!, /2 model call\(s\) of agent a carry no usage/);
});

test("a new cap is a recorded human decision", () => {
  assert.throws(() => changeCap(budget(), "40", undefined, T1), /needs the human decision/);
  assert.throws(() => changeCap(budget(), "-4", "more", T1), /positive/);
  const raised = changeCap(budget(), "40", "Group 3 needs a second repair round", T1);
  assert.deepEqual([raised.capUsd, raised.changes], [40, [{ at: T1, capUsd: 40, decision: "Group 3 needs a second repair round" }]]);
});

test("the budget hook counts as installed only when a PreToolUse entry runs it for Agent launches", () => {
  const entry = (matcher: string | undefined, command: string) => ({ hooks: { PreToolUse: [{ ...(matcher === undefined ? {} : { matcher }), hooks: [{ type: "command", command }] }] } });
  const hook = 'node "$CLAUDE_PROJECT_DIR/scripts/map-l2-budget-hook.ts"';
  assert.equal(budgetHookInstalled([entry("Agent|Task", hook)]), true);
  assert.equal(budgetHookInstalled([entry(undefined, hook)]), true);
  assert.equal(budgetHookInstalled([entry("*", hook)]), true);
  assert.equal(budgetHookInstalled([entry("Bash", hook)]), false);
  assert.equal(budgetHookInstalled([entry("Agent", "echo something else")]), false);
  assert.equal(budgetHookInstalled([{ permissions: {} }, undefined, entry("Agent", hook)]), true);
  assert.equal(budgetHookInstalled([entry("(", hook)]), false);
  assert.equal(budgetHookInstalled([]), false);
});
