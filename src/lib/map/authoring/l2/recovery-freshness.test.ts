import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { coverageOf, reviewsIn } from "./coverage.ts";
import { journaledCommit, recoverJournal } from "./journal.ts";
import { relationalId, type L2Relation, type L2Signal } from "./signals.ts";
import type { L2GroupFile } from "./territory.ts";

/**
 * Completing an interrupted commit is not accepting its audit as current: the
 * audit was decided against the records as they were, and a neighbour that
 * changed between the interruption and the recovery leaves the recovered
 * audit covering nothing it judged differently.
 */
test("a neighbour changing between interruption and recovery: the commit is completed as decided, and its audit no longer covers that overlap", () => {
  const dir = mkdtempSync(join(tmpdir(), "l2-recovery-freshness-"));
  try {
    const group = join(dir, "g1.json");
    const state = join(dir, "run.json");
    const journal = join(dir, "journal", "run.json");
    const key = "overlap-a-n";
    const overlap: L2Signal & { relation: L2Relation } = { id: relationalId("neighbour-overlap", key), kind: "heuristic", check: "neighbour-overlap", detail: "a and n share a sentence", relation: { concepts: ["a", "n"], owner: "a", key } };
    const plan = { group: "g1", members: [], concepts: {} } as unknown as L2GroupFile;
    const audited = { ...plan, concepts: { a: { audit: { at: "t", note: "", resolutions: [{ id: overlap.id, resolution: "distinct: a defines, n applies" }], recordFingerprint: "a1", neighbours: { n: "n1" } } } } } as unknown as L2GroupFile;
    mkdirSync(join(dir, "journal"), { recursive: true });
    writeFileSync(group, `${JSON.stringify(plan)}\n`);
    writeFileSync(state, '{"steps":{}}\n');
    // The recording is decided against n's record n1, and killed after writing the group file.
    assert.throws(() => journaledCommit(journal, { run: "run", tx: "audit:a@t", at: "t", what: "record audit a", files: [{ path: group, text: `${JSON.stringify(audited)}\n` }, { path: state, text: '{"steps":{"audit:a":{}}}\n' }] }, (at) => { if (at === "file-0-written") throw new Error("killed"); }), /killed/);
    // Before the next command, n's record changes (n1 -> n2).
    const fingerprints: Record<string, string> = { a: "a1", n: "n2" };
    const recovery = recoverJournal(journal, "run");
    assert.equal(recovery.action, "rolled-forward");
    // The transaction is completed exactly as decided: both files hold the audit and its step.
    const recovered = JSON.parse(readFileSync(group, "utf8")) as L2GroupFile;
    assert.deepEqual(recovered, audited);
    assert.equal(readFileSync(state, "utf8"), '{"steps":{"audit:a":{}}}\n');
    // But the gates judge it against the records as they are now: bound to n1, it does not cover the overlap with n2.
    const reviews = reviewsIn([recovered]);
    assert.deepEqual(coverageOf({ reviews, fingerprint: (id) => fingerprints[id] })(overlap), []);
    // Had n not changed, the same audit would cover it.
    assert.deepEqual(coverageOf({ reviews, fingerprint: (id) => ({ a: "a1", n: "n1" })[id]! })(overlap), ["the audit of a"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
