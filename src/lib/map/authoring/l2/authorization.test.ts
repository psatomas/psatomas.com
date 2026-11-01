import assert from "node:assert/strict";
import test from "node:test";
import { completeStage, createL2RunState, mayMerge, nextAction, recordL2Step, STAGES, type RunState } from "../orchestrator/run-state.ts";
import { AuthorizationError, authorizeMerge, authorizeRequest, inheritedMergeAuthorization, mergeStatusLines, revocationOf, revokeMerge, type L2Campaign } from "./authorization.ts";
import { pilotSlice } from "./campaign.ts";
import { model, REGISTRY } from "./fixtures.ts";

const T0 = "2026-10-07T21:01:59.731Z";
const T1 = "2026-11-02T10:00:00.000Z";
const T2 = "2026-11-02T11:00:00.000Z";
const DECISION = "Human approval is required for each L2 PR merge. Standing campaign-wide merge authorization is revoked.";
/** The campaign file as this checkout holds it: a merge authorization and a repair exception. */
const campaign = (): L2Campaign => ({
  mergeAuthorization: { at: T0, authorization: "User, 2026-10-07: 'Go ahead with the full L2 campaign. You may merge successful slice PRs. Do not deploy.'" },
  repairException: { at: "2026-10-08T15:53:39.112Z", authorization: "User, 2026-10-08: allow one additional repair cycle..." },
});

test("authorize takes exactly one of its three requests, with exactly its own arguments", () => {
  assert.deepEqual(authorizeRequest({ revokeMerge: true, decision: DECISION }), { kind: "revoke-merge", decision: DECISION });
  assert.deepEqual(authorizeRequest({ authorization: "go", revokeMerge: false }), { kind: "merge", authorization: "go" });
  assert.deepEqual(authorizeRequest({ repairException: "one more", revokeMerge: false }), { kind: "repair-exception", authorization: "one more" });
  assert.throws(() => authorizeRequest({ authorization: "go", revokeMerge: true, decision: DECISION }), /not --authorization and --revoke-merge/);
  assert.throws(() => authorizeRequest({ repairException: "x", revokeMerge: true, decision: DECISION }), /not --repair-exception and --revoke-merge/);
  assert.throws(() => authorizeRequest({ authorization: "go", repairException: "x", revokeMerge: false }), /not --authorization and --repair-exception/);
  assert.throws(() => authorizeRequest({ revokeMerge: false }), /authorize needs/);
  assert.throws(() => authorizeRequest({ revokeMerge: true }), /needs the human decision/);
  assert.throws(() => authorizeRequest({ revokeMerge: true, decision: "  " }), AuthorizationError);
  assert.throws(() => authorizeRequest({ authorization: "go", revokeMerge: false, decision: DECISION }), /--decision belongs to --revoke-merge/);
  assert.throws(() => authorizeRequest({ authorization: " ", revokeMerge: false }), /needs the human's explicit/);
});

test("revoking removes the active merge authorization, keeps it in the history with its revocation, and keeps everything else", () => {
  const before = { ...campaign(), somethingElse: { kept: true } };
  const { campaign: after, revoked } = revokeMerge(before, DECISION, T1);
  assert.deepEqual(revoked, before.mergeAuthorization);
  assert.equal(after.mergeAuthorization, undefined);
  assert.equal("mergeAuthorization" in after, false);
  assert.deepEqual(after.mergeAuthorizationHistory, [{ kind: "revoked", authorization: before.mergeAuthorization, revokedAt: T1, decision: DECISION }]);
  assert.deepEqual(after.repairException, before.repairException);
  assert.deepEqual(after.somethingElse, { kept: true });
  // The input is never mutated.
  assert.ok(before.mergeAuthorization);
});

test("revoking with no active authorization changes nothing, however often it is repeated", () => {
  const once = revokeMerge(campaign(), DECISION, T1).campaign;
  const twice = revokeMerge(once, DECISION, T2);
  assert.equal(twice.revoked, undefined);
  assert.equal(twice.campaign, once);
  assert.deepEqual(revokeMerge({}, DECISION, T1), { campaign: {} });
  assert.throws(() => revokeMerge(campaign(), " ", T1), /needs the human decision/);
});

test("the history is append-only: a later authorization, its replacement and its revocation are all kept in order", () => {
  const revoked = revokeMerge(campaign(), DECISION, T1).campaign;
  const again = authorizeMerge(revoked, "User, 2026-11-03: merge slice x only", T2);
  assert.deepEqual(again.mergeAuthorization, { at: T2, authorization: "User, 2026-11-03: merge slice x only" });
  const replaced = authorizeMerge(again, "User, 2026-11-04: merge slice y too", "2026-11-04T00:00:00.000Z");
  const final = revokeMerge(replaced, "back to per-PR approval", "2026-11-05T00:00:00.000Z").campaign;
  assert.deepEqual(final.mergeAuthorizationHistory!.map((change) => [change.kind, change.authorization.at]), [
    ["revoked", T0],
    ["superseded", T2],
    ["revoked", "2026-11-04T00:00:00.000Z"],
  ]);
  // Earlier entries are exactly as first written.
  assert.deepEqual(final.mergeAuthorizationHistory![0], revoked.mergeAuthorizationHistory![0]);
  assert.deepEqual(final.repairException, campaign().repairException);
});

test("l2 campaign shows the active status and every change in the history", () => {
  assert.match(mergeStatusLines(campaign())[0], /^merging: authorized 2026-10-07T21:01:59\.731Z: User, 2026-10-07/);
  const lines = mergeStatusLines(revokeMerge(campaign(), DECISION, T1).campaign);
  assert.equal(lines[0], "merging: not authorized; each validated PR awaits human merge");
  assert.match(lines[1], /^  revoked 2026-11-02T10:00:00\.000Z: the authorization of 2026-10-07T21:01:59\.731Z \("User, 2026-10-07: 'Go ahead.*decision: Human approval is required for each L2 PR merge/);
  assert.deepEqual(mergeStatusLines({}), ["merging: not authorized; each validated PR awaits human merge"]);
});

/** A run started now: it inherits what the campaign authorizes, as `l2 start` records it. */
function startedRun(fromCampaign: L2Campaign): RunState {
  const state = createL2RunState({ slice: pilotSlice(model(), ["g1"], REGISTRY), remaining: ["a", "b"], branch: "feat/map-x-l2-1", baseSha: "base", now: T1 });
  const authorization = inheritedMergeAuthorization(fromCampaign);
  return authorization ? { ...state, l2: { ...state.l2!, mergeAuthorized: authorization } } : state;
}
/** The run carried through its judgment steps and its tool stages up to and including CI. */
function throughCi(state: RunState): RunState {
  let run = recordL2Step(state, { kind: "plan", subject: "g1" }, T1);
  for (const conceptId of ["a", "b"]) run = recordL2Step(run, { kind: "design", subject: conceptId }, T1);
  for (const conceptId of ["a", "b"]) {
    run = recordL2Step(run, { kind: "author", subject: conceptId }, T1, { fingerprint: `${conceptId}-v1` });
    run = recordL2Step(run, { kind: "audit", subject: conceptId }, T1, { fingerprint: `${conceptId}-v1` });
  }
  run = recordL2Step(run, { kind: "group-audit", subject: "g1" }, T1);
  for (const stage of STAGES.slice(STAGES.indexOf("audit"), STAGES.indexOf("ci") + 1)) run = completeStage(run, stage, T1, stage === "audit" ? "audited" : undefined);
  return run;
}

test("a run started after the revocation inherits no merge authorization and ends at CI, awaiting human merge", () => {
  const revoked = revokeMerge(campaign(), DECISION, T1).campaign;
  assert.equal(inheritedMergeAuthorization(revoked), undefined);
  const run = startedRun(revoked);
  assert.equal(run.l2!.mergeAuthorized, undefined);
  assert.equal(mayMerge(run), false);
  const done = throughCi(run);
  assert.equal(done.stage, "done");
  assert.equal(done.completed.merge?.detail, "awaiting human merge");
  assert.deepEqual(nextAction(done), { kind: "done", stage: "done" });
});

test("only an active authorization is inherited, and never by the pilot", () => {
  const authorized = throughCi(startedRun(campaign()));
  assert.equal(authorized.stage, "merge");
  assert.equal(inheritedMergeAuthorization(campaign(), { pilot: true }), undefined);
});

test("a run started before the revocation is refused at its merge stage; a finished run's record is untouched", () => {
  const before = campaign();
  const inFlight = startedRun(before);
  const revoked = revokeMerge(before, DECISION, T1).campaign;
  // The run still records what it started under, but the merge stage finds it revoked (the CLI stops there).
  assert.deepEqual(revocationOf(revoked, inFlight.l2!.mergeAuthorized), revoked.mergeAuthorizationHistory![0]);
  // A later, different authorization does not revive the revoked one, nor is it mistaken for it.
  const reauthorized = authorizeMerge(revoked, "User, 2026-11-03: merge slice x only", T2);
  assert.ok(revocationOf(reauthorized, inFlight.l2!.mergeAuthorized));
  assert.equal(revocationOf(reauthorized, reauthorized.mergeAuthorization), undefined);
  assert.equal(revocationOf(revoked, undefined), undefined);
  // A finished, merged run is a record: revocation reads it and changes nothing in it.
  const finished: RunState = { ...throughCi(inFlight), stage: "done", l2: { ...inFlight.l2!, merged: { sha: "m1", at: T0 } } };
  const snapshot = JSON.stringify(finished);
  revocationOf(revoked, finished.l2!.mergeAuthorized);
  assert.equal(JSON.stringify(finished), snapshot);
  assert.deepEqual(nextAction(finished), { kind: "done", stage: "done" });
});
