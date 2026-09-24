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
 */
export function createMapResolver(model: MapKnowledgeModel) {
  assertValidMapKnowledge(model);

  const concepts = new Map(model.concepts.map((concept) => [concept.id, concept]));
  const placements = new Map(model.placements.map((placement) => [placement.id, placement]));
  const content = new Map(model.content.map((entry) => [entry.conceptId, entry]));
  const paths = new Map(model.knowledgePaths.map((path) => [path.id, path]));

  const sortPlacements = (entries: readonly MapPlacement[]) =>
    [...entries].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));

  return {
    getConcept(id: string): MapConcept | undefined {
      return concepts.get(id);
    },
    getPlacement(id: string): MapPlacement | undefined {
      return placements.get(id);
    },
    getPlacementsForConcept(conceptId: string): MapPlacement[] {
      return sortPlacements(model.placements.filter((placement) => placement.conceptId === conceptId));
    },
    getPreferredPlacementForConcept(conceptId: string): MapPlacement | undefined {
      const concept = concepts.get(conceptId);
      if (!concept) return undefined;
      return concept.preferredPlacementId
        ? placements.get(concept.preferredPlacementId)
        : this.getPlacementsForConcept(conceptId)[0];
    },
    getRootPlacements(): MapPlacement[] {
      return sortPlacements(
        model.placements.filter((placement) => placement.parentPlacementId === undefined),
      );
    },
    getChildren(placementId: string): MapPlacement[] {
      return sortPlacements(
        model.placements.filter((placement) => placement.parentPlacementId === placementId),
      );
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
