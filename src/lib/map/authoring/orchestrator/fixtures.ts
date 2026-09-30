/**
 * A small synthetic ontology exercising every ownership case the orchestrator
 * plans for. Test support only.
 *
 * Domain One: c (facet, preferred in Domain Two), single (one layer, here),
 *   done (authored), t-in-d1 (t's preferred placement, a leaf).
 * Domain Two: c-in-d2 (c's preferred facet), t (t's only child layer).
 * Domain Three: k (authored).
 * With `ambiguous`, m carries children in Domain Two and Three while its
 * preferred placement is a leaf in Domain One: ownership is unclear.
 */
import type { MapKnowledgeModel } from "../../types.ts";

export function orchestratorModel({ ambiguous = false, authored = [] as string[] } = {}): MapKnowledgeModel {
  const titles: Record<string, string> = {
    d1: "Domain One", d2: "Domain Two", d3: "Domain Three & More",
    c: "Concept", single: "Single", done: "Done", t: "Transit", k: "Kilo", m: "Mixed",
    a: "Alpha", b: "Beta", x: "Xray", y: "Yankee", q: "Quebec", r: "Romeo", w: "Whiskey", u: "Uniform", v: "Victor", m1: "Mike One", m2: "Mike Two",
  };
  const preferred: Record<string, string> = { c: "c-in-d2", t: "t-in-d1", m: "m-leaf" };
  const placements = [
    { id: "d1", conceptId: "d1", order: 0 },
    { id: "d2", conceptId: "d2", order: 1 },
    { id: "d3", conceptId: "d3", order: 2 },
    ...["c", "single", "done", "t-in-d1"].map((id, order) => ({ id, conceptId: id === "t-in-d1" ? "t" : id, parentPlacementId: "d1", order })),
    ...["c-in-d2", "t"].map((id, order) => ({ id, conceptId: id === "c-in-d2" ? "c" : id, parentPlacementId: "d2", order })),
    { id: "k", conceptId: "k", parentPlacementId: "d3", order: 0 },
    ...[["a", "c"], ["b", "c"], ["x", "c-in-d2"], ["y", "c-in-d2"], ["q", "single"], ["r", "single"], ["w", "done"], ["u", "t"], ["v", "t"]].map(([id, parent], index) => ({
      id,
      conceptId: id,
      parentPlacementId: parent,
      order: index % 2,
    })),
    ...(ambiguous
      ? [
          { id: "m-leaf", conceptId: "m", parentPlacementId: "d1", order: 4 },
          { id: "m-in-d2", conceptId: "m", parentPlacementId: "d2", order: 2 },
          { id: "m", conceptId: "m", parentPlacementId: "d3", order: 1 },
          { id: "m1", conceptId: "m1", parentPlacementId: "m-in-d2", order: 0 },
          { id: "m2", conceptId: "m2", parentPlacementId: "m", order: 0 },
        ]
      : []),
  ];
  const conceptIds = [...new Set(placements.map((placement) => placement.conceptId))];
  const content = ["d1", "d2", "d3", "done", "k", ...authored].map((conceptId) => ({
    id: `${conceptId}-content`,
    conceptId,
    definition: `${titles[conceptId]} is a synthetic concept used by the orchestrator tests.`,
  }));
  return {
    concepts: conceptIds.map((id) => ({ id, slug: id, title: titles[id], ...(preferred[id] ? { preferredPlacementId: preferred[id] } : {}) })),
    placements,
    relationships: [],
    content,
    mechanisms: [],
    knowledgePaths: [],
  };
}

/** The registry that matches a model's content exactly. */
export const registryOf = (model: MapKnowledgeModel) => model.content.map((record) => record.conceptId);

type Node = { placementId: string; conceptId: string; label: string; hasContent: boolean; children: Node[] };

/** A stand-in for the generated explorer view: the placement tree with hasContent flags. */
export function viewOf(model: MapKnowledgeModel): { roots: Node[] } {
  const withContent = new Set(model.content.map((record) => record.conceptId));
  const build = (placement: MapKnowledgeModel["placements"][number]): Node => ({
    placementId: placement.id,
    conceptId: placement.conceptId,
    label: model.concepts.find((concept) => concept.id === placement.conceptId)!.title,
    hasContent: withContent.has(placement.conceptId),
    children: model.placements.filter((child) => child.parentPlacementId === placement.id).sort((a, b) => a.order - b.order).map(build),
  });
  return { roots: model.placements.filter((placement) => !placement.parentPlacementId).sort((a, b) => a.order - b.order).map(build) };
}
