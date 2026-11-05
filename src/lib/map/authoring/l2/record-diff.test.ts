import assert from "node:assert/strict";
import test from "node:test";
import type { MapConceptContent } from "../../types.ts";
import { formatRecordDiff, recordDiff, recordLines } from "./record-diff.ts";

const before: MapConceptContent = {
  id: "a-content",
  conceptId: "a",
  definition: "Alpha is how a sequence starts.",
  body: [
    { kind: "paragraph", text: "A start prepares before it commits. Committing twice always breaks the sequence. Retries are common." },
    { kind: "distinction", left: "A start opens the sequence.", right: "A restart reopens it." },
    { kind: "paragraph", text: "Starts are cheap." },
  ],
};

test("a record is rendered as labelled lines: definition, each paragraph's sentences, each structured entry", () => {
  assert.deepEqual(recordLines(before), [
    { where: "definition", text: "Alpha is how a sequence starts." },
    { where: "paragraph 1", text: "A start prepares before it commits." },
    { where: "paragraph 1", text: "Committing twice always breaks the sequence." },
    { where: "paragraph 1", text: "Retries are common." },
    { where: "distinction (block 2)", text: "A start opens the sequence." },
    { where: "distinction (block 2)", text: "A restart reopens it." },
    { where: "paragraph 2", text: "Starts are cheap." },
  ]);
  assert.deepEqual(recordLines(undefined), []);
});

test("the diff shows exactly the replaced sentence, the cut one and the added one, and keeps the rest", () => {
  const after: MapConceptContent = {
    ...before,
    body: [
      { kind: "paragraph", text: "A start prepares before it commits. In designs without idempotent commits, committing twice breaks the sequence." },
      before.body![1],
      { kind: "paragraph", text: "Starts are cheap. A start that fails can be retried." },
    ],
  };
  const changed = recordDiff(before, after).filter((line) => line.op !== "=");
  assert.deepEqual(changed, [
    { op: "-", where: "paragraph 1", text: "Committing twice always breaks the sequence." },
    { op: "-", where: "paragraph 1", text: "Retries are common." },
    { op: "+", where: "paragraph 1", text: "In designs without idempotent commits, committing twice breaks the sequence." },
    { op: "+", where: "paragraph 2", text: "A start that fails can be retried." },
  ]);
  assert.equal(recordDiff(before, after).filter((line) => line.op === "=").length, 5);
  const text = formatRecordDiff(before, after);
  assert.match(text, /^2 line\(s\) removed, 2 added, 5 kept; form unchanged \(definition \+ paragraph \+ distinction \+ paragraph\)/);
  assert.match(text, /\n- \[paragraph 1\] Committing twice always breaks the sequence\.\n/);
  assert.match(text, /\n\+ \[paragraph 2\] A start that fails can be retried\./);
});

test("an unchanged record has no changes; a change of form is reported apart from changed text", () => {
  assert.ok(recordDiff(before, structuredClone(before)).every((line) => line.op === "="));
  assert.match(formatRecordDiff(before, before), /^0 line\(s\) removed, 0 added, 7 kept; form unchanged/);
  const prose: MapConceptContent = { ...before, body: [before.body![0], before.body![2]] };
  const text = formatRecordDiff(before, prose);
  assert.match(text, /form changed: definition \+ paragraph \+ distinction \+ paragraph → definition \+ paragraph \+ paragraph/);
  assert.match(text, /- \[distinction \(block 2\)\] A restart reopens it\./);
  // Deterministic: the same records give the same diff.
  assert.deepEqual(recordDiff(before, prose), recordDiff(before, prose));
});
