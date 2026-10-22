import assert from "node:assert/strict";
import test from "node:test";
import { weighted } from "../l2v2/core.ts";
import { costByRole, projectSlug, roleOf, sessionCost } from "./cost.ts";

const call = (id: string, usage: Record<string, number>, extra: Record<string, unknown> = {}) =>
  JSON.stringify({ type: "assistant", timestamp: "2026-10-20T01:00:00.000Z", gitBranch: "feat/x", message: { id, model: "claude-opus-5-5", usage }, ...extra });

test("a session counts each API call once, skips synthetic and unparseable lines, and weights the campaign's way", () => {
  const lines = [
    call("m1", { input_tokens: 10, cache_creation_input_tokens: 1000, cache_read_input_tokens: 20000, output_tokens: 300 }),
    // The same call again: one transcript line per content block.
    call("m1", { input_tokens: 10, cache_creation_input_tokens: 1000, cache_read_input_tokens: 20000, output_tokens: 300 }),
    call("m2", { input_tokens: 2, cache_read_input_tokens: 50000, output_tokens: 40 }),
    JSON.stringify({ type: "assistant", message: { id: "s1", model: "<synthetic>", usage: { input_tokens: 99, output_tokens: 99 } } }),
    JSON.stringify({ type: "user", message: { content: "usage of the assistant" } }),
    '{"type":"assistant","usage": truncated',
  ];
  const cost = sessionCost(lines, "First audit A of collusion");
  assert.equal(cost.role, "first-audit");
  assert.equal(cost.calls, 2);
  assert.deepEqual(cost.usage, { input_tokens: 12, cache_creation_input_tokens: 1000, cache_read_input_tokens: 70000, output_tokens: 340 });
  assert.equal(cost.weighted, weighted(cost.usage));
  assert.equal(cost.weighted, Math.round(12 + 0.1 * 70000 + 1.25 * 1000 + 5 * 340));
});

test("a filter counts only calls on its branch and inside its time window", () => {
  const lines = [
    call("a", { input_tokens: 1 }, { gitBranch: "main" }),
    call("b", { input_tokens: 2 }, { timestamp: "2026-10-19T00:00:00.000Z" }),
    call("c", { input_tokens: 4 }, { timestamp: "2026-10-21T00:00:00.000Z" }),
    call("d", { input_tokens: 8 }),
  ];
  const cost = sessionCost(lines, "orchestrator", { branch: "feat/x", since: "2026-10-20T00:00:00.000Z", until: "2026-10-21T00:00:00.000Z" });
  assert.equal(cost.role, "orchestrator");
  assert.equal(cost.calls, 1);
  assert.equal(cost.usage.input_tokens, 8);
  assert.equal(sessionCost(lines, "orchestrator", { branch: "other" }).weighted, 0);
});

test("roles follow the campaign's task descriptions", () => {
  const roles = {
    "Plan coordination group": "plan",
    "Model and design safety": "design",
    "Design rules (protocols)": "design",
    "Author safety record": "author",
    "First audit A of safety": "first-audit",
    "Second-opinion audit B of safety": "first-audit",
    "Audit SMR L2 (B, second opinion)": "first-audit",
    "Repair safety (cycle 1)": "repair",
    "Scoped re-review 2 of availability": "re-audit",
    "Re-audit trust-minimization repair 3": "re-audit",
    "Group audit: coordination": "group-audit",
    "Something else": "other",
  };
  assert.deepEqual(Object.fromEntries(Object.keys(roles).map((description) => [description, roleOf(description)])), roles);
});

test("totals by role leave out sessions with no counted call", () => {
  const empty = sessionCost([], "Author x record");
  const one = sessionCost([call("m", { input_tokens: 5, output_tokens: 1 })], "Author y record");
  const two = sessionCost([call("n", { input_tokens: 1 })], "Author z record");
  const totals = costByRole([empty, one, two]);
  assert.deepEqual([...totals.keys()], ["author"]);
  assert.deepEqual(totals.get("author"), { sessions: 2, calls: 2, usage: { input_tokens: 6, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 }, weighted: one.weighted + two.weighted });
  assert.equal(projectSlug("/home/tomas/projects/psatomas.com"), "-home-tomas-projects-psatomas-com");
});
