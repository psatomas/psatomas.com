/**
 * Audit signals for L2 records (docs/map-authoring/l2-analysis.md, sections
 * 11 and 16). Tools surface candidates; the audit decides. Deterministic
 * findings are facts about the text (a positional phrase, a year, a mention of
 * another concept). Heuristic signals are measurements that suggest a problem
 * (overlap with a parent sentence, a uniform window). None of them is a
 * failure on its own: every one must be resolved by the audit with a note,
 * and none sets a target or quota for form. Development tooling only.
 */
import { createHash } from "node:crypto";
import type { MapConceptContent, MapContentBlock, MapKnowledgeModel } from "../../types.ts";
import type { L2ConceptContext } from "./context.ts";
import type { L2ConceptWork } from "./contracts.ts";

export type L2Signal = { id: string; kind: "deterministic" | "heuristic"; check: string; detail: string };

const signal = (kind: L2Signal["kind"], check: string, detail: string): L2Signal => ({
  id: `${check}:${createHash("sha256").update(detail).digest("hex").slice(0, 10)}`,
  kind,
  check,
  detail,
});

export const tokens = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter(Boolean);
const shingles = (text: string, size = 4) => {
  const words = tokens(text);
  const set = new Set<string>();
  for (let index = 0; index + size <= words.length; index++) set.add(words.slice(index, index + size).join(" "));
  return set;
};
/** Share of `a`'s word shingles that also occur in `b`; short texts use shorter shingles (at least two words). */
export function containment(a: string, b: string, size = 4): number {
  const length = tokens(a).length;
  if (length < 2) return 0;
  const n = Math.min(size, length);
  const left = shingles(a, n);
  const right = shingles(b, n);
  return [...left].filter((shingle) => right.has(shingle)).length / left.size;
}
export const sentences = (text: string) => text.split(/(?<=[.!?])\s+(?=[A-Z0-9"(])/).map((sentence) => sentence.trim()).filter(Boolean);

/** Every string a block carries. */
export function blockText(block: MapContentBlock): string[] {
  switch (block.kind) {
    case "paragraph":
    case "heading":
      return [block.text];
    case "flow":
      return [block.label, ...block.stages.flat(2)];
    case "distinction":
      return [block.left, block.right, ...(block.further ?? [])];
    case "tensions":
      return [block.label, ...block.pairs.flat()];
    case "terms":
      return [...block.terms];
    case "cycle":
      return [block.label, ...block.steps];
    case "comparison":
      return [block.label, ...block.dimensions, ...block.alternatives.flatMap((alternative) => [alternative.name, ...alternative.values])];
    case "state":
      return [block.label, ...block.states, ...block.transitions.map((transition) => transition.when)];
  }
}
const prose = (record: MapConceptContent) => [record.definition, ...(record.body ?? []).filter((block) => block.kind === "paragraph").map((block) => (block as { text: string }).text)];
const allText = (record: MapConceptContent) => [record.definition, ...(record.body ?? []).flatMap(blockText)];

const POSITIONAL = /\b(below|above|beneath|the following|as (?:shown|noted|described) (?:above|earlier|before)|the previous (?:section|paragraph)|in this (?:domain|section|branch|layer|group)|this domain)\b/i;
const DATED = /\b(19\d\d|20\d\d|currently|today|nowadays|as of|recently|at the time of writing|the latest|v\d+(?:\.\d+)*|\d+\.\d+\.\d+)\b/i;
const ABSOLUTES = /\b(always|never|guarantees?|guaranteed|cannot|impossible|ensures?|completely|entirely|every time)\b/gi;
const HEDGES = /\b(may|might|could|would|can|if|unless|where|when|typically|often|usually|tends?|proposed|proposals?|in principle|depends?)\b/gi;
const MATH = /[=×÷^≥≤√∑∏∞≈]|\b\d+\s*[*/]\s*\d+\b/;

/** Other concepts a record names, by title: mentions the audit confirms are named, not explained. */
export function mentionedConcepts(record: MapConceptContent, model: MapKnowledgeModel, conceptId: string, nearby: ReadonlySet<string>): string[] {
  const text = ` ${tokens(allText(record).join(" ")).join(" ")} `;
  const found: string[] = [];
  for (const concept of model.concepts) {
    if (concept.id === conceptId) continue;
    const title = tokens(concept.title);
    // Single-word titles ("State", "Fees") are everyday words: count them only for concepts near this one.
    if (title.length < 2 && !nearby.has(concept.id)) continue;
    const singular = title.map((word, index) => (index === title.length - 1 ? word.replace(/s$/, "") : word)).join(" ");
    if (text.includes(` ${title.join(" ")} `) || (singular.length > 3 && text.includes(` ${singular} `))) found.push(concept.id);
  }
  return found.sort();
}

export type L2SignalInput = {
  conceptId: string;
  record: MapConceptContent;
  context: L2ConceptContext;
  model: MapKnowledgeModel;
  work?: L2ConceptWork;
  /** Authored records of siblings and hazard partners. */
  neighbours: readonly MapConceptContent[];
  /** The owner domain's 0-based L0 order; 19 and later are emerging or speculative domains. */
  domainOrder: number;
};

export const SPECULATIVE_FROM = 19;

export function conceptSignals(input: L2SignalInput): L2Signal[] {
  const { record, context, model, conceptId } = input;
  const found: L2Signal[] = [];
  const texts = allText(record);
  for (const text of texts) {
    const positional = text.match(POSITIONAL);
    if (positional) found.push(signal("deterministic", "positional", `"${positional[0]}" in: ${text.slice(0, 120)}`));
    const dated = text.match(DATED);
    if (dated) found.push(signal("deterministic", "dated", `"${dated[0]}" in: ${text.slice(0, 120)}`));
  }
  const definition = tokens(record.definition);
  for (const paragraph of prose(record).slice(1)) {
    for (const sentence of sentences(paragraph)) {
      const words = new Set(tokens(sentence));
      const shared = definition.filter((word) => words.has(word)).length;
      if (definition.length >= 6 && shared / new Set([...definition, ...words]).size >= 0.6) found.push(signal("deterministic", "definition-repeated", sentence.slice(0, 160)));
    }
  }
  const title = tokens(context.concept.title).map((word) => word.replace(/s$/, ""));
  const afterSubject = tokens(record.definition.split(/\b(?:is|are)\b/)[1] ?? "").slice(0, 8).map((word) => word.replace(/s$/, ""));
  if (title.length && title.every((word) => afterSubject.includes(word))) found.push(signal("deterministic", "circular-definition", record.definition.slice(0, 160)));
  const nearby = new Set([...context.siblingTerritory.map((sibling) => sibling.conceptId), ...context.hazards.pairs.flatMap((pair) => pair.concepts), ...(context.plan?.excludes ?? [])]);
  for (const mentioned of mentionedConcepts(record, model, conceptId, nearby)) {
    const excluded = context.plan?.excludes.includes(mentioned);
    found.push(signal("deterministic", "names-concept", `${mentioned}${excluded ? " (excluded: name only)" : ""}: confirm it is named, not explained`));
  }

  const recordSentences = prose(record).flatMap(sentences);
  for (const placement of context.placements) {
    for (const premise of placement.parentMentions) {
      const best = Math.max(0, ...recordSentences.map((sentence) => Math.max(containment(premise, sentence), containment(sentence, premise))));
      if (best >= 0.4) found.push(signal("heuristic", "parent-overlap", `${(best * 100).toFixed(0)}% of a ${placement.parent.conceptId} sentence: ${premise.slice(0, 140)}`));
    }
  }
  for (const neighbour of input.neighbours) {
    const theirs = prose(neighbour).flatMap(sentences);
    for (const sentence of recordSentences) {
      const best = Math.max(0, ...theirs.map((other) => containment(sentence, other)));
      if (best >= 0.35) found.push(signal("heuristic", "neighbour-overlap", `${neighbour.conceptId}, ${(best * 100).toFixed(0)}%: ${sentence.slice(0, 140)}`));
    }
  }
  const joined = prose(record).join(" ");
  const absolutes = joined.match(ABSOLUTES) ?? [];
  if (absolutes.length >= 3) found.push(signal("heuristic", "absolutes", `${absolutes.length} unhedged absolutes (${[...new Set(absolutes.map((word) => word.toLowerCase()))].join(", ")}): check each holds unconditionally`));
  const words = tokens(joined).length;
  const hedges = (joined.match(HEDGES) ?? []).length;
  if (input.domainOrder >= SPECULATIVE_FROM && words >= 60 && hedges * 120 < words) found.push(signal("heuristic", "speculative", `${hedges} conditional words in ${words}: an emerging domain's claims must read as proposals or conditions`));
  if (texts.some((text) => MATH.test(text))) found.push(signal("heuristic", "math", "a mathematical symbol or expression: state the relation in words first, in plain text"));
  const body = record.body ?? [];
  body.forEach((block, index) => {
    if (block.kind === "paragraph" || block.kind === "heading" || block.kind === "terms") return;
    const strings = blockText(block).slice(1).filter((value) => tokens(value).length >= 2);
    const around = [body[index - 1], body[index + 1]].filter((neighbour): neighbour is MapContentBlock => neighbour?.kind === "paragraph").map((neighbour) => ` ${tokens((neighbour as { text: string }).text).join(" ")} `).join(" ");
    const restated = strings.filter((value) => around.includes(` ${tokens(value).join(" ")} `)).length;
    if (strings.length >= 2 && restated / strings.length >= 0.6) found.push(signal("heuristic", "prose-narrates-structure", `${restated} of the ${block.kind}'s ${strings.length} entries are spelled out in the prose beside it`));
  });
  const recordWords = new Set(tokens(texts.join(" ")));
  for (const [field, value] of Object.entries(input.work?.model.fields ?? {})) {
    const content = [...new Set(tokens(Array.isArray(value) ? value.join(" ") : value).filter((word) => word.length >= 5))];
    if (content.length >= 4 && content.filter((word) => recordWords.has(word)).length / content.length < 0.2) found.push(signal("heuristic", "model-unused", `the model's ${field} barely reaches the text: is the mechanism deep enough?`));
  }
  return dedupe(found);
}

/** Group-level signals: siblings' text overlapping each other, and members sharing one opening or one form. */
export function groupSignals(records: readonly { conceptId: string; title: string; record: MapConceptContent }[]): L2Signal[] {
  const found: L2Signal[] = [];
  for (const [index, left] of records.entries()) {
    for (const right of records.slice(index + 1)) {
      for (const sentence of prose(left.record).flatMap(sentences)) {
        const best = Math.max(0, ...prose(right.record).flatMap(sentences).map((other) => containment(sentence, other)));
        if (best >= 0.35) found.push(signal("heuristic", "sibling-overlap", `${left.conceptId} and ${right.conceptId}, ${(best * 100).toFixed(0)}%: ${sentence.slice(0, 140)}`));
      }
    }
  }
  const openings = new Map<string, string[]>();
  for (const entry of records) {
    const frame = definitionFrame(entry.title, entry.record);
    if (frame) openings.set(frame, [...(openings.get(frame) ?? []), entry.conceptId]);
  }
  for (const [frame, members] of openings) if (members.length >= 3) found.push(signal("heuristic", "shared-opening", `"${frame} …" opens ${members.join(", ")}`));
  const forms = new Set(records.map((entry) => sequenceOf(entry.record)));
  if (records.length >= 4 && forms.size === 1 && recordsStructured(records.map((entry) => entry.record))) found.push(signal("heuristic", "shared-form", `every member has the form ${[...forms][0]}: is each form decided for its concept?`));
  return dedupe(found);
}
const recordsStructured = (records: readonly MapConceptContent[]) => records.some((record) => (record.body ?? []).some((block) => !["paragraph", "heading", "terms"].includes(block.kind)));

/** The definition's opening after its subject: "is the …", "are rules that …". */
export function definitionFrame(title: string, record: MapConceptContent): string | undefined {
  const words = tokens(record.definition);
  const subject = tokens(title).length;
  return words.length > subject + 3 ? words.slice(subject, subject + 3).join(" ") : undefined;
}
export const sequenceOf = (record: MapConceptContent) => ["def", ...(record.body ?? []).map((block) => block.kind)].join("+");

export type L2DriftReport = {
  window: number;
  topSequence: { sequence: string; share: number };
  topOpening: { frame: string; share: number };
  topParagraphOpener: { opener: string; share: number };
  paragraphLengthVariation: number;
  signals: L2Signal[];
};

/**
 * Convergence across a window of records in authoring order: one form, one
 * opening, one paragraph opener, or uniform paragraph lengths. Descriptive
 * only. A flag asks the audit to look again at whether each form and phrasing
 * was decided for its concept; it never asks for more or fewer structures.
 */
export function driftReport(records: readonly { title: string; record: MapConceptContent }[]): L2DriftReport {
  const share = <T>(values: readonly T[]) => {
    const counts = new Map<T, number>();
    for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
    const [top, count] = [...counts].sort((a, b) => b[1] - a[1])[0] ?? [undefined, 0];
    return { top, share: values.length ? count / values.length : 0 };
  };
  const sequence = share(records.map((entry) => sequenceOf(entry.record)));
  const opening = share(records.flatMap((entry) => definitionFrame(entry.title, entry.record) ?? []));
  const openers = records.flatMap((entry) => prose(entry.record).slice(1).map((paragraph) => tokens(paragraph).slice(0, 2).join(" ")));
  const opener = share(openers);
  const lengths = records.flatMap((entry) => prose(entry.record).slice(1).map((paragraph) => tokens(paragraph).length));
  const mean = lengths.reduce((sum, value) => sum + value, 0) / (lengths.length || 1);
  const variation = lengths.length ? Math.sqrt(lengths.reduce((sum, value) => sum + (value - mean) ** 2, 0) / lengths.length) / (mean || 1) : 0;
  const signals: L2Signal[] = [];
  if (records.length >= 10) {
    if (sequence.share > 0.85 && recordsStructured(records.map((entry) => entry.record))) signals.push(signal("heuristic", "drift-form", `${(sequence.share * 100).toFixed(0)}% of ${records.length} records share the form ${sequence.top}`));
    if (opening.share > 0.5) signals.push(signal("heuristic", "drift-opening", `${(opening.share * 100).toFixed(0)}% of definitions open "${opening.top} …"`));
    if (openers.length >= 20 && opener.share > 0.25) signals.push(signal("heuristic", "drift-opener", `${(opener.share * 100).toFixed(0)}% of paragraphs open "${opener.top} …"`));
    if (lengths.length >= 20 && variation < 0.15) signals.push(signal("heuristic", "drift-uniform-length", `paragraph lengths vary by only ${(variation * 100).toFixed(0)}%`));
  }
  return {
    window: records.length,
    topSequence: { sequence: String(sequence.top ?? ""), share: +sequence.share.toFixed(2) },
    topOpening: { frame: String(opening.top ?? ""), share: +opening.share.toFixed(2) },
    topParagraphOpener: { opener: String(opener.top ?? ""), share: +opener.share.toFixed(2) },
    paragraphLengthVariation: +variation.toFixed(2),
    signals,
  };
}

const dedupe = (signals: L2Signal[]) => [...new Map(signals.map((entry) => [entry.id, entry])).values()];
