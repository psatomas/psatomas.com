import { mapKnowledge } from "./data.ts";
import { createMapResolver } from "./resolver.ts";

export { mapKnowledge, createMapResolver };
/**
 * The canonical MAP resolver, validated and indexed once per module instance
 * (per Worker isolate), not per request: the knowledge model is immutable.
 */
export const mapResolver = createMapResolver(mapKnowledge);
export type { MapResolver } from "./resolver.ts";
export { assertValidMapKnowledge, MapKnowledgeValidationError, validateMapKnowledge } from "./validation.ts";
export { MAP_RELATIONSHIP_TYPES } from "./types.ts";
export type {
  MapConcept,
  MapConceptContent,
  MapContentBlock,
  MapFlowElement,
  MapKnowledgeModel,
  MapKnowledgePath,
  MapMechanism,
  MapMechanismStep,
  MapPlacement,
  MapRelationship,
  MapRelationshipTypeId,
} from "./types.ts";
