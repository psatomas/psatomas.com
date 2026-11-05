/**
 * What a repair changed in a record (`l2 repair-diff`): the record its failing
 * audit judged, snapshotted when the concept was reopened, against the record
 * as it is now. Each record is rendered as labelled lines (every sentence of
 * the definition and of each paragraph, each heading, each entry of a
 * structured block) and the lines are compared by a longest-common-
 * subsequence diff, so a re-auditor sees exactly which statements were
 * removed, added or kept, and where. Deterministic and pure; development
 * tooling only.
 */
import type { MapConceptContent, MapContentBlock } from "../../types.ts";
import { blockText, sentences } from "./signals.ts";

export type RecordLine = { where: string; text: string };
export type RecordDiffLine = { op: "=" | "-" | "+"; where: string; text: string };

/** The record as labelled lines, in order. */
export function recordLines(record: MapConceptContent | undefined): RecordLine[] {
  if (!record) return [];
  const lines: RecordLine[] = sentences(record.definition).map((text) => ({ where: "definition", text }));
  let paragraph = 0;
  (record.body ?? []).forEach((block: MapContentBlock, index) => {
    if (block.kind === "paragraph") {
      paragraph++;
      for (const text of sentences(block.text)) lines.push({ where: `paragraph ${paragraph}`, text });
    } else if (block.kind === "heading") lines.push({ where: `heading (block ${index + 1})`, text: block.text });
    else for (const text of blockText(block)) lines.push({ where: `${block.kind} (block ${index + 1})`, text });
  });
  return lines;
}

/** The line diff of two records: every line of either, in order, marked kept (=), removed (-) or added (+). */
export function recordDiff(before: MapConceptContent | undefined, after: MapConceptContent | undefined): RecordDiffLine[] {
  const a = recordLines(before);
  const b = recordLines(after);
  const same = (x: RecordLine, y: RecordLine) => x.text === y.text;
  // Longest common subsequence table, filled from the end so the walk below is forward.
  const table = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) table[i][j] = same(a[i], b[j]) ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
  const out: RecordDiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (same(a[i], b[j])) {
      out.push({ op: "=", where: b[j].where, text: b[j].text });
      i++;
      j++;
    }
    // Ties remove before they add, so a replaced sentence reads as its old text, then its new one.
    else if (table[i + 1][j] >= table[i][j + 1]) out.push({ op: "-", where: a[i].where, text: a[i++].text });
    else out.push({ op: "+", where: b[j].where, text: b[j++].text });
  }
  while (i < a.length) out.push({ op: "-", where: a[i].where, text: a[i++].text });
  while (j < b.length) out.push({ op: "+", where: b[j].where, text: b[j++].text });
  return out;
}

/** The block sequence of a record (its form), to report a change of form apart from changed text. */
export const formOf = (record: MapConceptContent | undefined) => (record ? ["definition", ...(record.body ?? []).map((block) => block.kind)].join(" + ") : "(none)");

/** The diff as text: the changed lines with one kept line of context around each change, and a summary. */
export function formatRecordDiff(before: MapConceptContent | undefined, after: MapConceptContent | undefined): string {
  const diff = recordDiff(before, after);
  const changed = diff.map((line, index) => (line.op !== "=" ? index : -1)).filter((index) => index >= 0);
  const shown = new Set(changed.flatMap((index) => [index - 1, index, index + 1]).filter((index) => index >= 0 && index < diff.length));
  const lines: string[] = [];
  let last = -2;
  diff.forEach((line, index) => {
    if (!shown.has(index)) return;
    if (index !== last + 1 && lines.length) lines.push("  …");
    lines.push(`${line.op === "=" ? " " : line.op} [${line.where}] ${line.text}`);
    last = index;
  });
  const removed = diff.filter((line) => line.op === "-").length;
  const added = diff.filter((line) => line.op === "+").length;
  const form = formOf(before) === formOf(after) ? `form unchanged (${formOf(after)})` : `form changed: ${formOf(before)} → ${formOf(after)}`;
  return [`${removed} line(s) removed, ${added} added, ${diff.length - removed - added} kept; ${form}`, ...lines].join("\n");
}
