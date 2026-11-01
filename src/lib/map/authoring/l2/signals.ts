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

/**
 * A relational signal is about two records at once: an overlap between the
 * concept's text and a neighbour's. `concepts` is the pair (sorted), `owner`
 * the concept whose sentence overlaps, and `key` the overlap's identity: the
 * pair, the owner and the owner's sentence. The key holds whichever record's
 * audit or group audit computes it, so one overlap is one judgment however it
 * is reached (contracts.ts L2Coverage).
 */
export type L2Relation = { concepts: [string, string]; owner: string; key: string };
/**
 * `legacyId` is the id the same signal had before relational identities were
 * stable (it hashed the detail, overlap percentage included): audits recorded
 * then resolve it under that id. For a relational signal it is the id the
 * owner's own audit would have resolved.
 */
export type L2Signal = { id: string; kind: "deterministic" | "heuristic"; check: string; detail: string; legacyId?: string; relation?: L2Relation };

const hash = (text: string) => createHash("sha256").update(text).digest("hex").slice(0, 10);
const signal = (kind: L2Signal["kind"], check: string, detail: string): L2Signal => ({ id: `${check}:${hash(detail)}`, kind, check, detail });

/** An overlap's identity: the pair, the concept whose sentence it is, and that sentence. Never the percentage, which moves with the other record. */
export const overlapKey = (a: string, b: string, owner: string, sentence: string) => hash(["overlap", ...[a, b].sort(), owner, sentence].join("\0"));

/** The id an overlap signal of `check` carries: the same key under either check, so a concept audit and a group audit name one overlap alike. */
export const relationalId = (check: "neighbour-overlap" | "sibling-overlap", key: string) => `${check}:${key}`;

function overlap(check: "neighbour-overlap" | "sibling-overlap", detail: string, legacyDetail: string, pair: [string, string], owner: string, sentence: string): L2Signal {
  const key = overlapKey(pair[0], pair[1], owner, sentence);
  return { id: relationalId(check, key), kind: "heuristic", check, detail, legacyId: `${check}:${hash(legacyDetail)}`, relation: { concepts: [...pair].sort() as [string, string], owner, key } };
}

export const tokens = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter(Boolean);
// Overlap checks compare every sentence with every other: each text's words and shingles are computed once, not per
// pair. Bounded, so a long-lived process never grows it without limit; a cleared cache only costs recomputation.
const CACHE_LIMIT = 50_000;
const wordCache = new Map<string, string[]>();
const shingleCache = new Map<string, Set<string>>();
const remember = <T>(cache: Map<string, T>, key: string, make: () => T): T => {
  const hit = cache.get(key);
  if (hit) return hit;
  if (cache.size >= CACHE_LIMIT) cache.clear();
  const made = make();
  cache.set(key, made);
  return made;
};
const words = (text: string) => remember(wordCache, text, () => tokens(text));
const shingles = (text: string, size = 4) =>
  remember(shingleCache, `${size}\0${text}`, () => {
    const list = words(text);
    const set = new Set<string>();
    for (let index = 0; index + size <= list.length; index++) set.add(list.slice(index, index + size).join(" "));
    return set;
  });
/** Share of `a`'s word shingles that also occur in `b`; short texts use shorter shingles (at least two words). */
export function containment(a: string, b: string, size = 4): number {
  const length = words(a).length;
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
/** Every word a record shows, blocks included. */
export const recordWords = (record: MapConceptContent) => allText(record).join(" ").split(/\s+/).filter(Boolean).length;
const paragraphCount = (record: MapConceptContent) => (record.body ?? []).filter((block) => block.kind === "paragraph").length;

/**
 * The depth policy's diagnostic thresholds (docs/map-authoring/l2-authoring.md#depth),
 * set from the refined pilot (22 records: median 984 words, maximum 1,201).
 * They ask the audit to look again; none is a limit or a target.
 */
export const DEPTH = { longRecord: 1300, shortRecord: 400, sliceMedian: 1150, sharedParagraphCount: 0.6 } as const;

// "above" and "below" before a quantity compare values ("a threshold above one"); they point at text only otherwise.
const POSITIONAL = /\b((?:below|above)(?!\s+(?:\d|zero|one|two|three|four|five|six|seven|eight|nine|ten|half|a (?:half|third|quarter)|its threshold|the threshold))|beneath|the following|as (?:shown|noted|described) (?:above|earlier|before)|the previous (?:section|paragraph)|in this (?:domain|section|branch|layer|group)|this domain)\b/i;
const DATED = /\b(19\d\d|20\d\d|currently|today|nowadays|as of|recently|at the time of writing|(?<!\bat )the latest|v\d+(?:\.\d+)*|\d+\.\d+\.\d+)\b/i;
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
/** Model fields that say what to avoid rather than what to explain. */
const GUARD_FIELDS: ReadonlySet<string> = new Set(["datedFacts"]);

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
  // Overlap is measured both ways: this record's sentences inside the neighbour's text, and the neighbour's inside this
  // one. Containment is not symmetric, so a one-way check let an overlap surface only on the earlier-drafted record,
  // after its audit. Each overlap carries the identity and legacy id its owner computes, wherever it is computed.
  for (const neighbour of input.neighbours) {
    const pair: [string, string] = [conceptId, neighbour.conceptId];
    const theirs = prose(neighbour).flatMap(sentences);
    for (const sentence of recordSentences) {
      const best = Math.max(0, ...theirs.map((other) => containment(sentence, other)));
      const detail = `${neighbour.conceptId}, ${(best * 100).toFixed(0)}%: ${sentence.slice(0, 140)}`;
      if (best >= 0.35) found.push(overlap("neighbour-overlap", detail, detail, pair, conceptId, sentence));
    }
    for (const other of theirs) {
      const best = Math.max(0, ...recordSentences.map((sentence) => containment(other, sentence)));
      const percent = (best * 100).toFixed(0);
      if (best >= 0.35) found.push(overlap("neighbour-overlap", `a sentence of ${neighbour.conceptId}, ${percent}% in this record: ${other.slice(0, 140)}`, `${conceptId}, ${percent}%: ${other.slice(0, 140)}`, pair, neighbour.conceptId, other));
    }
  }
  const joined = prose(record).join(" ");
  // The concept's own words are not claims about it ("guarantee" in Atomicity Guarantees).
  const own = new Set(tokens(context.concept.title).map((word) => word.replace(/s$/, "")));
  const absolutes = (joined.match(ABSOLUTES) ?? []).filter((word) => !own.has(word.toLowerCase().replace(/s$/, "")));
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
  const length = recordWords(record);
  if (length > DEPTH.longRecord) found.push(signal("heuristic", "depth-long", `${length} words, more than ${DEPTH.longRecord}: tie each paragraph to a claim, and condense repetition, background and examples the claims do not need`));
  if (length < DEPTH.shortRecord && (context.plan?.claims.length ?? 0) >= 3) found.push(signal("heuristic", "depth-short", `${length} words for ${context.plan!.claims.length} claims: is each claim explained, not only named?`));
  const shownWords = new Set(tokens(texts.join(" ")));
  for (const [field, value] of Object.entries(input.work?.model?.fields ?? {})) {
    // A guard field lists what the text must avoid, so it never reaches the text.
    if (GUARD_FIELDS.has(field)) continue;
    const content = [...new Set(tokens(Array.isArray(value) ? value.join(" ") : value).filter((word) => word.length >= 5))];
    if (content.length >= 4 && content.filter((word) => shownWords.has(word)).length / content.length < 0.2) found.push(signal("heuristic", "model-unused", `the model's ${field} barely reaches the text: is the mechanism deep enough?`));
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
        const detail = `${left.conceptId} and ${right.conceptId}, ${(best * 100).toFixed(0)}%: ${sentence.slice(0, 140)}`;
        if (best >= 0.35) found.push(overlap("sibling-overlap", detail, detail, [left.conceptId, right.conceptId], left.conceptId, sentence));
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
  /** The median record length in words, and the most common paragraph count and its share. */
  medianWords: number;
  topParagraphCount: { count: number; share: number };
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
  const lengthsByRecord = records.map((entry) => recordWords(entry.record)).sort((a, b) => a - b);
  const medianWords = lengthsByRecord.length ? lengthsByRecord[Math.floor(lengthsByRecord.length / 2)] : 0;
  const counts = share(records.map((entry) => paragraphCount(entry.record)));
  const signals: L2Signal[] = [];
  if (records.length >= 10) {
    if (medianWords > DEPTH.sliceMedian) signals.push(signal("heuristic", "drift-depth", `the median record is ${medianWords} words, more than ${DEPTH.sliceMedian}: is depth following the claims, or padding?`));
    if (counts.share > DEPTH.sharedParagraphCount) signals.push(signal("heuristic", "drift-paragraph-count", `${(counts.share * 100).toFixed(0)}% of ${records.length} records have ${counts.top} paragraphs: is each record's shape decided for its concept?`));
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
    medianWords,
    topParagraphCount: { count: Number(counts.top ?? 0), share: +counts.share.toFixed(2) },
    signals,
  };
}

/**
 * The drift signals that pause a slice for calibration: convergence of form,
 * opening, opener or paragraph shape. A long median (drift-depth) is reported
 * but never stops a slice on its own: each record's depth is judged against its
 * claims by its own audit (depth-long).
 */
export const sliceStopSignals = (signals: readonly L2Signal[]) => signals.filter((entry) => entry.check !== "drift-depth");

const dedupe = (signals: L2Signal[]) => [...new Map(signals.map((entry) => [entry.id, entry])).values()];
