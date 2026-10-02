/**
 * The mechanical half of a domain run's editorial audit: facts the agent
 * weighs, never verdicts. For each newly authored concept it reports size and
 * block sequence, five-word phrases shared with its parent expositions, its
 * siblings in the run and every other record, sentences copied verbatim,
 * possible positional language, and definition openings shared with other
 * records. Judging which findings matter stays with the agent and the
 * quality contract (docs/map-authoring/quality-contract.md).
 */
import type { MapConceptContent, MapContentBlock, MapKnowledgeModel } from "../../types.ts";

const BLOCK_LETTER: Record<MapContentBlock["kind"], string> = { paragraph: "P", heading: "H", flow: "F", distinction: "D", tensions: "T", terms: "S", cycle: "O", comparison: "X", state: "M" };
const POSITIONAL = /\b(below|above|beneath|this domain|this section|the topics|the rows)\b/i;

function text(record: MapConceptContent): string {
  return [
    record.definition,
    record.summary,
    record.explanation,
    record.whyItMatters,
    ...(record.body ?? []).map((block) => {
      switch (block.kind) {
        case "paragraph":
        case "heading":
          return block.text;
        case "flow":
          return [block.label, ...block.stages.flat(2)].join(" ");
        case "distinction":
          return [block.left, block.right, ...(block.further ?? [])].join(" ");
        case "tensions":
          return [block.label, ...block.pairs.flat()].join(" ");
        case "terms":
          return block.terms.join(" ");
        case "cycle":
          return [block.label, ...block.steps].join(" ");
        case "comparison":
          return [block.label, ...block.dimensions, ...block.alternatives.flatMap((alternative) => [alternative.name, ...alternative.values])].join(" ");
        case "state":
          return [block.label, ...block.states, ...block.transitions.map((transition) => transition.when)].join(" ");
      }
    }),
  ]
    .filter(Boolean)
    .join(" ");
}

function grams(value: string, size: number): Set<string> {
  const words = value.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
  const result = new Set<string>();
  for (let index = 0; index + size <= words.length; index++) result.add(words.slice(index, index + size).join(" "));
  return result;
}

const sentences = (value: string) => value.split(/(?<=[.;:])\s+/).filter((sentence) => sentence.length > 30);
/** The first four words after " is " in a definition: its template, independent of the subject. */
const definitionTemplate = (definition: string) => definition.split(/\s+is\s+/)[1]?.split(/\s+/).slice(0, 4).join(" ").toLowerCase();

export type ConceptAudit = {
  conceptId: string;
  words: number;
  blocks: string;
  parentOverlap: { conceptId: string; phrases: string[] }[];
  siblingOverlap: { conceptId: string; phrases: string[] }[];
  corpusOverlap: { conceptId: string; phrases: string[] }[];
  verbatim: string[];
  positional: string[];
  sharedDefinitionTemplate: string[];
};

export function auditConcepts(model: MapKnowledgeModel, conceptIds: readonly string[]): ConceptAudit[] {
  const records = new Map(model.content.map((record) => [record.conceptId, record]));
  const texts = new Map([...records].map(([conceptId, record]) => [conceptId, text(record)]));
  const gramsOf = new Map([...texts].map(([conceptId, value]) => [conceptId, grams(value, 5)]));
  const parentsOf = (conceptId: string) =>
    new Set(
      model.placements
        .filter((placement) => placement.conceptId === conceptId && placement.parentPlacementId)
        .map((placement) => model.placements.find((parent) => parent.id === placement.parentPlacementId)!.conceptId),
    );
  const overlap = (conceptId: string, others: Iterable<string>) =>
    [...others]
      .filter((other) => other !== conceptId && gramsOf.has(other))
      .map((other) => ({ conceptId: other, phrases: [...gramsOf.get(conceptId)!].filter((phrase) => gramsOf.get(other)!.has(phrase)) }))
      .filter((entry) => entry.phrases.length > 0);

  return conceptIds.map((conceptId) => {
    const record = records.get(conceptId);
    if (!record) throw new Error(`no content for ${conceptId}`);
    const own = texts.get(conceptId)!;
    const parents = parentsOf(conceptId);
    const siblings = conceptIds.filter((other) => other !== conceptId);
    const rest = [...records.keys()].filter((other) => other !== conceptId && !parents.has(other) && !siblings.includes(other));
    const elsewhere = [...texts].filter(([other]) => other !== conceptId).map(([, value]) => value).join("\n");
    const template = definitionTemplate(record.definition);
    return {
      conceptId,
      words: own.split(/\s+/).length,
      blocks: ["def", ...(record.body ?? []).map((block) => BLOCK_LETTER[block.kind])].join("+"),
      parentOverlap: overlap(conceptId, parents),
      siblingOverlap: overlap(conceptId, siblings),
      corpusOverlap: overlap(conceptId, rest),
      verbatim: sentences(own).filter((sentence) => elsewhere.includes(sentence)),
      positional: sentences(own).filter((sentence) => POSITIONAL.test(sentence)),
      sharedDefinitionTemplate: template
        ? [...records.values()].filter((other) => other.conceptId !== conceptId && definitionTemplate(other.definition) === template).map((other) => other.conceptId)
        : [],
    };
  });
}
