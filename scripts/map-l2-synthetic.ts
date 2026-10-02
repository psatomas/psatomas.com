// Synthetic L2 corpus for scale measurement only, never MAP content
// (docs/map-authoring/l2-content-scale.md). Adds one record per l2-only
// concept, in the real record shape, to the data.ts of a separate checkout
// such as a git worktree. Text is drawn deterministically from the existing
// corpus's own words, so compression behaves like real exposition. Refuses to
// write into this repository.
//
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/map-l2-synthetic.ts <low|expected|high> <other checkout>
import { readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { mapKnowledge } from "../src/lib/map/data.ts";
import { inventoryL2 } from "../src/lib/map/authoring/l2/inventory.ts";

const [scenario, root] = process.argv.slice(2);
const repository = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), ".."));
if (root && realpathSync(resolve(root)) === repository) throw new Error("refusing to write synthetic content into this repository; pass a separate checkout (git worktree add)");
type Mix = { kind: string; share: number }[];
const SCENARIOS: Record<string, { definition: [number, number]; paragraphs: [number, number]; paragraphWords: [number, number]; structured: Mix; second: number }> = {
  // Compact, mostly prose: definition plus two short paragraphs; 10% one distinction.
  low: { definition: [20, 30], paragraphs: [2, 2], paragraphWords: [35, 55], structured: [{ kind: "distinction", share: 0.1 }], second: 0 },
  // The L2 analysis: about the dual-role records' scale (median ~225 words), about
  // 30% with one structure, distinction commonest, flow next, the rest occasional.
  expected: {
    definition: [25, 35], paragraphs: [3, 3], paragraphWords: [50, 70],
    structured: [{ kind: "distinction", share: 0.15 }, { kind: "flow", share: 0.08 }, { kind: "comparison", share: 0.03 }, { kind: "state", share: 0.02 }, { kind: "cycle", share: 0.01 }, { kind: "tensions", share: 0.01 }],
    second: 0,
  },
  // Conservative: four or five long paragraphs (~350 words); half structured, a tenth with two structures.
  high: {
    definition: [30, 40], paragraphs: [4, 5], paragraphWords: [60, 80],
    structured: [{ kind: "distinction", share: 0.2 }, { kind: "flow", share: 0.15 }, { kind: "comparison", share: 0.07 }, { kind: "state", share: 0.04 }, { kind: "cycle", share: 0.02 }, { kind: "tensions", share: 0.02 }],
    second: 0.1,
  },
};
const plan = SCENARIOS[scenario];
if (!plan || !root) throw new Error("usage: map-l2-synthetic.ts low|expected|high <other checkout>");

// Deterministic PRNG (mulberry32), seeded per scenario.
let seed = { low: 1, expected: 2, high: 3 }[scenario as "low"]!;
const rand = () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const between = ([lo, hi]: [number, number]) => lo + Math.floor(rand() * (hi - lo + 1));
const words = mapKnowledge.content.flatMap((record) => (record.body ?? []).flatMap((block) => (block.kind === "paragraph" ? block.text.split(/\s+/) : []))).map((word) => word.replace(/[^A-Za-z0-9'-]/g, "")).filter(Boolean);
const phrase = (count: number) => Array.from({ length: count }, () => words[Math.floor(rand() * words.length)]).join(" ");
const sentence = (count: number) => { const text = phrase(count); return `${text[0].toUpperCase()}${text.slice(1)}.`; };
const prose = (count: number) => { const out: string[] = []; let left = count; while (left > 0) { const n = Math.min(left, between([12, 24])); out.push(sentence(n)); left -= n; } return out.join(" "); };
const label = () => { const text = phrase(between([3, 6])); return `${text[0].toUpperCase()}${text.slice(1)}`; };
const distinct = (count: number, size: [number, number]) => { const set = new Set<string>(); while (set.size < count) set.add(label().split(" ").slice(0, between(size)).join(" ")); return [...set]; };

function structure(kind: string): object {
  switch (kind) {
    case "distinction": { const [left, right] = distinct(2, [2, 4]); return { kind, left, right }; }
    case "flow": return { kind, label: label(), stages: distinct(between([3, 5]), [2, 4]).map((step) => [step]) };
    case "comparison": { const dims = distinct(3, [1, 3]); return { kind, label: label(), dimensions: dims, alternatives: distinct(3, [1, 3]).map((name) => ({ name, values: dims.map(() => phrase(between([2, 5]))) })) }; }
    case "state": { const states = distinct(3, [1, 2]); return { kind, label: label(), states, transitions: [[0, 1], [1, 2], [1, 0], [2, 0]].map(([from, to]) => ({ from: states[from], to: states[to], when: phrase(between([4, 8])) })) }; }
    case "cycle": return { kind, label: label(), steps: distinct(4, [2, 4]) };
    case "tensions": { const parts = distinct(6, [1, 2]); return { kind, label: label(), pairs: [[parts[0], parts[1]], [parts[2], parts[3]], [parts[4], parts[5]]] }; }
  }
  throw new Error(kind);
}
const pick = () => { let r = rand(); for (const { kind, share } of plan.structured) { if (r < share) return kind; r -= share; } return undefined; };

const ids = inventoryL2(mapKnowledge).concepts.filter((facts) => facts.role === "l2-only").map((facts) => facts.conceptId);
const records = ids.map((conceptId) => {
  const body: object[] = Array.from({ length: between(plan.paragraphs) }, () => ({ kind: "paragraph", text: prose(between(plan.paragraphWords)) }));
  const kinds = [pick(), ...(rand() < plan.second ? [plan.structured[Math.floor(rand() * plan.structured.length)].kind] : [])].filter((kind): kind is string => !!kind);
  kinds.forEach((kind, index) => body.splice(1 + index * 2, 0, structure(kind)));
  return { id: `${conceptId}-content`, conceptId, definition: prose(between(plan.definition)), body };
});

// Formatted like data.ts: two-space indentation, unquoted keys.
const source = (value: unknown, indent: string): string => {
  if (Array.isArray(value)) return value.length ? `[\n${value.map((item) => `${indent}  ${source(item, `${indent}  `)},`).join("\n")}\n${indent}]` : "[]";
  if (value && typeof value === "object") return `{\n${Object.entries(value).map(([key, item]) => `${indent}  ${key}: ${source(item, `${indent}  `)},`).join("\n")}\n${indent}}`;
  return JSON.stringify(value);
};
const file = join(root, "src/lib/map/data.ts");
const data = readFileSync(file, "utf8");
const marker = "\n  content: [\n";
if (!data.includes(marker)) throw new Error("content marker not found");
writeFileSync(file, data.replace(marker, `${marker}${records.map((record) => `    ${source(record, "    ")},`).join("\n")}\n`));
const prose_ = (record: (typeof records)[number]) => [record.definition, ...record.body.map((block) => ("text" in block ? String(block.text) : ""))].join(" ");
const words_ = records.map((record) => prose_(record).split(/\s+/).length).sort((a, b) => a - b);
const structured = records.filter((record) => record.body.some((block) => (block as { kind: string }).kind !== "paragraph")).length;
console.log(JSON.stringify({ scenario, records: records.length, medianWords: words_[words_.length >> 1], structuredRecords: structured, recordJsonBytesMean: Math.round(records.reduce((sum, record) => sum + JSON.stringify(record).length, 0) / records.length) }));
