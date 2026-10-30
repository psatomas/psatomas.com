import assert from "node:assert/strict";
import test from "node:test";
import { createL2RunState, humanMerge, type RunState } from "../orchestrator/run-state.ts";
import { pilotSlice } from "./campaign.ts";
import { model, REGISTRY } from "./fixtures.ts";

// The merge stage of a run without a campaign merge authorization: a PR a human merged is recorded, only at exactly
// the head the run validated and pushed. Recording a merge never merges anything.

const T0 = "2026-10-30T00:00:00.000Z";
const run: RunState = { ...createL2RunState({ slice: pilotSlice(model(), ["g1"], REGISTRY), remaining: ["a", "b"], branch: "feat/map-l2-pilot", baseSha: "base", now: T0 }), stage: "merge", pushedSha: "pushed" };

test("an unmerged PR is nothing to record: the stage still needs a human merge or the campaign authorization", () => {
  assert.equal(humanMerge(run, { state: "OPEN", mergeCommit: null, headRefOid: "pushed" }, T0), undefined);
  assert.equal(humanMerge(run, { state: "CLOSED", mergeCommit: null, headRefOid: "pushed" }, T0), undefined);
  assert.equal(humanMerge(run, { state: "MERGED", mergeCommit: null, headRefOid: "pushed" }, T0), undefined);
});

test("a PR merged at the pushed head is recorded as merged by hand", () => {
  assert.deepEqual(humanMerge(run, { state: "MERGED", mergeCommit: { oid: "m1" }, headRefOid: "pushed" }, T0), { merged: { sha: "m1", at: T0, byHand: true } });
});

test("a PR merged at any other head is a stop, never recorded", () => {
  assert.deepEqual(humanMerge(run, { state: "MERGED", mergeCommit: { oid: "m1" }, headRefOid: "other00" }, T0), { problem: "the PR was merged at other00, but the run validated and pushed pushed" });
  assert.match((humanMerge({ ...run, pushedSha: undefined }, { state: "MERGED", mergeCommit: { oid: "m1" }, headRefOid: "pushed" }, T0) as { problem: string }).problem, /pushed nothing/);
});
