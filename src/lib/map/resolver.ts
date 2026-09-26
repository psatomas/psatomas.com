import type {
  MapConcept,
  MapConceptContent,
  MapKnowledgeModel,
  MapKnowledgePath,
  MapMechanism,
  MapPlacement,
  MapRelationship,
} from "./types.ts";
import { assertValidMapKnowledge } from "./validation.ts";

/**
 * Pure, bounded lookup layer. It exposes only the records relevant to a
 * requested concept or placement; it does not prepare a browser-wide graph.
 * The model is immutable, so its lookup indexes (children by parent,
 * placements by concept, roots) are built once, already in sibling order, and
 * every query is a keyed read rather than a scan of all placements.
 */
export function createMapResolver(model: MapKnowledgeModel) {
  assertValidMapKnowledge(model);

  const concepts = new Map(model.concepts.map((concept) => [concept.id, concept]));
  const placements = new Map(model.placements.map((placement) => [placement.id, placement]));
  const content = new Map(model.content.map((entry) => [entry.conceptId, entry]));
  const paths = new Map(model.knowledgePaths.map((path) => [path.id, path]));

  const sortPlacements = (entries: readonly MapPlacement[]) =>
    [...entries].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  const group = (key: (placement: MapPlacement) => string | undefined) => {
    const groups = new Map<string | undefined, MapPlacement[]>();
    for (const placement of model.placements) {
      const k = key(placement);
      const list = groups.get(k);
      if (list) list.push(placement);
      else groups.set(k, [placement]);
    }
    for (const [k, list] of groups) groups.set(k, sortPlacements(list));
    return groups;
  };
  const childrenByParent = group((placement) => placement.parentPlacementId);
  const placementsByConcept = group((placement) => placement.conceptId);
  // Callers receive their own arrays, as with a fresh filter.
  const read = (groups: Map<string | undefined, MapPlacement[]>, key: string | undefined) => [...(groups.get(key) ?? [])];

  return {
    getConcept(id: string): MapConcept | undefined {
      return concepts.get(id);
    },
    getPlacement(id: string): MapPlacement | undefined {
      return placements.get(id);
    },
    getPlacementsForConcept(conceptId: string): MapPlacement[] {
      return read(placementsByConcept, conceptId);
    },
    getPreferredPlacementForConcept(conceptId: string): MapPlacement | undefined {
      const concept = concepts.get(conceptId);
      if (!concept) return undefined;
      return concept.preferredPlacementId
        ? placements.get(concept.preferredPlacementId)
        : this.getPlacementsForConcept(conceptId)[0];
    },
    getRootPlacements(): MapPlacement[] {
      return read(childrenByParent, undefined);
    },
    getChildren(placementId: string): MapPlacement[] {
      return read(childrenByParent, placementId);
    },
    /** Ancestors are returned root-first and exclude the requested placement. */
    getAncestors(placementId: string): MapPlacement[] {
      const ancestors: MapPlacement[] = [];
      let current = placements.get(placementId);
      while (current?.parentPlacementId) {
        const parent = placements.get(current.parentPlacementId);
        if (!parent) break;
        ancestors.unshift(parent);
        current = parent;
      }
      return ancestors;
    },
    getRelationshipsFrom(conceptId: string): MapRelationship[] {
      return model.relationships.filter((relationship) => relationship.sourceConceptId === conceptId);
    },
    getRelationshipsTo(conceptId: string): MapRelationship[] {
      return model.relationships.filter((relationship) => relationship.targetConceptId === conceptId);
    },
    getContentForConcept(conceptId: string): MapConceptContent | undefined {
      return content.get(conceptId);
    },
    getMechanismsForConcept(conceptId: string): MapMechanism[] {
      return model.mechanisms.filter((mechanism) => mechanism.conceptId === conceptId);
    },
    getKnowledgePath(id: string): MapKnowledgePath | undefined {
      return paths.get(id);
    },
  };
}

export type MapResolver = ReturnType<typeof createMapResolver>;
