import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import type { MapConceptContent } from "../../types.ts";
import { contentFingerprint } from "../representation/design.ts";
import { conceptWorkOf, resolutionProblems, withConceptAudit, workProblems, type L2Audit } from "./contracts.ts";
import { coverageIn, l2GroupSignals, l2Signals, neighbourBasis } from "./coverage.ts";
import { filledG1, model, options } from "./fixtures.ts";
import type { L2Signal } from "./signals.ts";
import type { L2GroupFile } from "./territory.ts";

const T0 = "2026-11-01T00:00:00.000Z";
const SIMPLIFIED = { mode: "simplified" as const, version: 1 };
const hash = (text: string) => createHash("sha256").update(text).digest("hex").slice(0, 10);

// a and b are siblings in g1. Each overlaps the other: a's sentence sits inside b's, and b's inside a's.
const SHARED = "A start prepares the ledger before it commits the batch to every honest node.";
const A: MapConceptContent = { id: "a-content", conceptId: "a", definition: "Alpha is how a sequence starts.", body: [{ kind: "paragraph", text: SHARED }] };
const B: MapConceptContent = { id: "b-content", conceptId: "b", definition: "Beta is what comes after the opening move.", body: [{ kind: "paragraph", text: `${SHARED.slice(0, -1)}, and only then does the next phase begin.` }] };
/** b revised so it shares less of a's sentence: the overlap remains, but its percentage moves. */
const B_REVISED: MapConceptContent = { ...B, body: [{ kind: "paragraph", text: "A start prepares the ledger before it seals the batch to every honest node, and only then does the next phase begin." }] };

function simplifiedG1(): L2GroupFile {
  const plan = { ...filledG1(model()), pipeline: SIMPLIFIED };
  delete plan.concepts;
  return plan;
}
const resolveAll = (signals: readonly L2Signal[]) => signals.map((entry) => ({ id: entry.id, resolution: "judged" }));
/** The audit `l2 record audit` writes now: bound to the record and to the authored neighbours as they are. */
const boundAudit = (m: ReturnType<typeof model>, plans: readonly L2GroupFile[], conceptId: string, resolutions: L2Audit["resolutions"]): L2Audit => ({
  at: T0,
  note: "judged",
  resolutions,
  recordFingerprint: contentFingerprint(m.content.find((entry) => entry.conceptId === conceptId)),
  neighbours: neighbourBasis(m, plans, conceptId, options),
});
const overlaps = (signals: readonly L2Signal[]) => signals.filter((entry) => entry.check === "neighbour-overlap");
const problemsOf = (plan: L2GroupFile, m: ReturnType<typeof model>, conceptId: string, plans: readonly L2GroupFile[] = [plan]) => {
  const signals = l2Signals(m, plans, conceptId, options);
  return workProblems(plan, conceptId, m, "audited", signals, coverageIn(m, plans, signals));
};

test("an overlap keeps its id when only the other record moves, and keeps the id the owner's audit resolved before", () => {
  const before = overlaps(l2Signals(model([A, B]), [simplifiedG1()], "a", options)).find((entry) => entry.relation!.owner === "a")!;
  const after = overlaps(l2Signals(model([A, B_REVISED]), [simplifiedG1()], "a", options)).find((entry) => entry.relation!.owner === "a")!;
  assert.ok(before && after);
  // The detail carries the percentage, which moves with b's text; the identity does not.
  assert.notEqual(before.detail, after.detail);
  assert.equal(before.id, after.id);
  // The legacy id is exactly the id earlier tooling gave the same signal: the hash of its detail.
  assert.equal(before.legacyId, `neighbour-overlap:${hash(before.detail)}`);
  assert.notEqual(before.legacyId, after.legacyId);
});

test("signals that depend only on the record keep the ids earlier tooling gave them", () => {
  const dated: MapConceptContent = { ...A, body: [{ kind: "paragraph", text: "Since 2024 a start prepares before it commits." }] };
  const signal = l2Signals(model([dated]), [simplifiedG1()], "a", options).find((entry) => entry.check === "dated")!;
  assert.equal(signal.id, `dated:${hash(signal.detail)}`);
  assert.equal(signal.legacyId, undefined);
  assert.equal(signal.relation, undefined);
});

test("overlap is measured both ways, and the two records name each overlap alike", () => {
  const m = model([A, B]);
  const fromA = overlaps(l2Signals(m, [simplifiedG1()], "a", options));
  const fromB = overlaps(l2Signals(m, [simplifiedG1()], "b", options));
  // Each side sees both overlaps: its own sentence in the other record, and the other's in its own.
  assert.deepEqual(fromA.map((entry) => entry.relation!.owner).sort(), ["a", "b"]);
  assert.deepEqual(fromA.map((entry) => entry.id).sort(), fromB.map((entry) => entry.id).sort());
  // A reverse overlap carries the legacy id its owner computes, so the owner's earlier audit still names it.
  const ownedByA = fromA.find((entry) => entry.relation!.owner === "a")!;
  assert.equal(fromB.find((entry) => entry.id === ownedByA.id)!.legacyId, ownedByA.legacyId);
  // The group signal for the same overlap shares its key under its own check.
  const sibling = l2GroupSignals(m, simplifiedG1()).find((entry) => entry.relation?.key === ownedByA.relation!.key)!;
  assert.equal(sibling.id, `sibling-overlap:${ownedByA.relation!.key}`);
  assert.equal(sibling.legacyId, `sibling-overlap:${hash(sibling.detail)}`);
});

test("an audit recorded before its sibling was drafted is not reopened: the sibling's audit, bound to both records, resolves their overlap", () => {
  // a is drafted and audited while b does not exist yet: its audit sees no overlap.
  const alone = model([A]);
  const afterA = withConceptAudit(simplifiedG1(), "a", boundAudit(alone, [simplifiedG1()], "a", resolveAll(l2Signals(alone, [simplifiedG1()], "a", options))));
  assert.deepEqual(problemsOf(afterA, alone, "a"), []);
  // b is drafted: a's record and audit are unchanged, but a now has overlap signals no audit has judged.
  const both = model([A, B]);
  assert.match(problemsOf(afterA, both, "a").join("\n"), /unresolved: no audit recorded against the current records of both a and b/);
  // Without coverage (a caller blind to other audits) a's own audit must resolve them, as before.
  assert.match(workProblems(afterA, "a", both, "audited", l2Signals(both, [afterA], "a", options)).join("\n"), /neighbour-overlap:.* is unresolved/);
  // b's audit is recorded against both records and resolves every overlap it sees, which are both directions.
  const afterB = withConceptAudit(afterA, "b", boundAudit(both, [afterA], "b", resolveAll(l2Signals(both, [afterA], "b", options))));
  assert.deepEqual(conceptWorkOf(afterB, "b")!.audit!.neighbours, { a: contentFingerprint(A), u: contentFingerprint(both.content.find((entry) => entry.conceptId === "u")) });
  assert.deepEqual(problemsOf(afterB, both, "a"), []);
  assert.deepEqual(problemsOf(afterB, both, "b"), []);
});

test("coverage needs a review bound to both current records; one judged against an older record does not count", () => {
  const both = model([A, B]);
  const afterA = withConceptAudit(simplifiedG1(), "a", boundAudit(model([A]), [simplifiedG1()], "a", []));
  const afterB = withConceptAudit(afterA, "b", boundAudit(both, [afterA], "b", resolveAll(l2Signals(both, [afterA], "b", options))));
  // b's audit judged a as it was; a changing would reopen a's own audit anyway, and b's resolution no longer covers the pair.
  const stale = withConceptAudit(afterA, "b", { ...conceptWorkOf(afterB, "b")!.audit!, neighbours: { a: "an older record of a" } });
  assert.match(problemsOf(stale, both, "a").join("\n"), /no audit recorded against the current records of both a and b/);
  // b's record moving after its audit: its own audit is stale, and it covers no overlap either.
  const moved = model([A, B_REVISED]);
  assert.match(problemsOf(afterB, moved, "b").join("\n"), /record changed after its audit/);
  assert.ok(problemsOf(afterB, moved, "a").some((problem) => /unresolved/.test(problem)));
});

test("a group audit bound to both records covers a concept's overlap with its sibling", () => {
  const both = model([A, B]);
  const audited = withConceptAudit(simplifiedG1(), "a", boundAudit(model([A]), [simplifiedG1()], "a", []));
  const group = l2GroupSignals(both, audited);
  const records = { a: contentFingerprint(A), b: contentFingerprint(B) };
  const withGroup = { ...audited, groupAudit: { at: T0, note: "side by side", resolutions: resolveAll(group), records } } as L2GroupFile;
  // Only a's sentences in b are group signals (one direction): b's sentence in a still needs a review that saw it.
  const owners = overlaps(l2Signals(both, [withGroup], "a", options));
  const coverage = coverageIn(both, [withGroup], owners);
  const byOwner = (owner: string) => coverage({ ...owners.find((entry) => entry.relation!.owner === owner)!, relation: owners.find((entry) => entry.relation!.owner === owner)!.relation! });
  assert.deepEqual(byOwner("a"), ["the group audit of g1"]);
  assert.deepEqual(byOwner("b"), []);
  // A group audit bound to an older record of a member covers nothing.
  const staleGroup = { ...withGroup, groupAudit: { ...(withGroup as L2GroupFile & { groupAudit: { records: Record<string, string> } }).groupAudit, records: { ...records, b: "older" } } } as L2GroupFile;
  assert.deepEqual(coverageIn(both, [staleGroup], owners)({ ...owners[0], relation: owners[0].relation! }), []);
});

test("an audit recorded before neighbours were bound is validated exactly as it was: its own overlaps, under their legacy ids", () => {
  const both = model([A, B]);
  const signals = overlaps(l2Signals(both, [simplifiedG1()], "a", options));
  const own = signals.find((entry) => entry.relation!.owner === "a")!;
  const theirs = signals.find((entry) => entry.relation!.owner === "b")!;
  // a's legacy audit resolved its own overlap under the id it had then, and carries no neighbour basis.
  const legacy = withConceptAudit(simplifiedG1(), "a", { at: T0, note: "judged", resolutions: [{ id: own.legacyId!, resolution: "named only" }, { id: theirs.id, resolution: "named only" }], recordFingerprint: contentFingerprint(A) });
  const coverage = coverageIn(both, [legacy], signals);
  assert.deepEqual(coverage({ ...own, relation: own.relation! }), ["the audit of a"]);
  // It never saw b's sentence as its own signal, and it is bound to no record of b: it cannot cover b's overlap, whatever it lists.
  assert.deepEqual(coverage({ ...theirs, relation: theirs.relation! }), []);
});

test("a resolution recorded under a signal's legacy id resolves it; a bare id must match exactly", () => {
  const signal = { id: "sibling-overlap:new", legacyId: "sibling-overlap:old" };
  assert.deepEqual(resolutionProblems([signal], [{ id: "sibling-overlap:old", resolution: "judged" }]), []);
  assert.deepEqual(resolutionProblems([signal], [{ id: "sibling-overlap:new", resolution: "judged" }]), []);
  assert.deepEqual(resolutionProblems([signal], [{ id: "sibling-overlap:old", resolution: " " }]), ["signal sibling-overlap:new is unresolved: say how the audit judged it"]);
  assert.deepEqual(resolutionProblems(["dated:1"], [{ id: "dated:2", resolution: "judged" }]), ["signal dated:1 is unresolved: say how the audit judged it"]);
});


test("in the committed corpus, every overlap between two records whose audits are bound to them is resolved by an audit bound to both", async () => {
  const { readdirSync, readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const { mapKnowledge } = await import("../../data.ts");
  const { GROUPS_DIR } = await import("./territory.ts");
  const dir = join(new URL("../../../../..", import.meta.url).pathname, GROUPS_DIR);
  const plans = readdirSync(dir).filter((file) => file.endsWith(".json")).map((file) => JSON.parse(readFileSync(join(dir, file), "utf8")) as L2GroupFile);
  const fingerprint = (conceptId: string) => contentFingerprint(mapKnowledge.content.find((entry) => entry.conceptId === conceptId));
  // Concepts whose recorded audit judged the record as it is now.
  const current = new Set(plans.flatMap((plan) => Object.entries(plan.concepts ?? {}).filter(([conceptId, work]) => (work as { audit?: L2Audit }).audit?.recordFingerprint === fingerprint(conceptId)).map(([conceptId]) => conceptId)));
  assert.ok(current.size > 50, `expected the committed L2 corpus, found ${current.size} audited records`);
  const uncovered: string[] = [];
  for (const conceptId of current) {
    const signals = l2Signals(mapKnowledge, plans, conceptId).filter((entry) => entry.relation && entry.relation.concepts.every((id) => current.has(id)));
    const coverage = coverageIn(mapKnowledge, plans, signals);
    for (const entry of signals) if (!coverage({ ...entry, relation: entry.relation! }).length) uncovered.push(`${conceptId}: ${entry.id} ${entry.detail}`);
  }
  assert.deepEqual(uncovered, []);
});
