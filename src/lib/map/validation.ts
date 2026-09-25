import { MAP_RELATIONSHIP_TYPES } from "./types.ts";
import type { MapContentBlock, MapKnowledgeModel } from "./types.ts";

const IDENTIFIER = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class MapKnowledgeValidationError extends Error {
  readonly errors: readonly string[];

  constructor(errors: readonly string[]) {
    super(`Invalid MAP knowledge model:\n${errors.map((error) => `- ${error}`).join("\n")}`);
    this.name = "MapKnowledgeValidationError";
    this.errors = errors;
  }
}

function duplicateValues(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates].sort();
}

function validateIdentifiers(errors: string[], label: string, ids: readonly string[]) {
  for (const id of ids) {
    if (!IDENTIFIER.test(id)) errors.push(`${label} has invalid identifier "${id}"`);
  }
  for (const id of duplicateValues(ids)) errors.push(`Duplicate ${label} identifier "${id}"`);
}

const blank = (text: string) => text.trim().length === 0;

function contentBlockProblems(block: MapContentBlock): string[] {
  switch (block.kind) {
    case "paragraph":
      return blank(block.text) ? ["is empty"] : [];
    case "flow":
      if (blank(block.label)) return ["has no label"];
      if (block.stages.length < 2) return ["must contain at least two stages"];
      return block.stages.some((stage) => stage.length === 0 || stage.some(blank)) ? ["has an empty stage or element"] : [];
    case "distinction":
      return blank(block.left) || blank(block.right) ? ["must name both sides"] : [];
    case "tensions":
      if (blank(block.label)) return ["has no label"];
      if (block.pairs.length === 0) return ["must contain at least one pair"];
      return block.pairs.some((pair) => pair.length !== 2 || pair.some(blank)) ? ["has an incomplete pair"] : [];
    default:
      return [`is an unknown block kind`];
  }
}

/** Returns deterministic validation errors without mutating or repairing input. */
export function validateMapKnowledge(model: MapKnowledgeModel): string[] {
  const errors: string[] = [];
  const conceptIds = new Set(model.concepts.map((concept) => concept.id));
  const placementIds = new Set(model.placements.map((placement) => placement.id));

  validateIdentifiers(errors, "concept", model.concepts.map((concept) => concept.id));
  validateIdentifiers(errors, "concept slug", model.concepts.map((concept) => concept.slug));
  validateIdentifiers(errors, "placement", model.placements.map((placement) => placement.id));
  validateIdentifiers(errors, "relationship", model.relationships.map((relationship) => relationship.id));
  validateIdentifiers(errors, "content", model.content.map((content) => content.id));
  validateIdentifiers(errors, "mechanism", model.mechanisms.map((mechanism) => mechanism.id));
  validateIdentifiers(errors, "knowledge path", model.knowledgePaths.map((path) => path.id));
  validateIdentifiers(errors, "knowledge path slug", model.knowledgePaths.map((path) => path.slug));

  for (const concept of model.concepts) {
    if (concept.id !== concept.slug) {
      errors.push(`Concept "${concept.id}" must use the same initial id and slug`);
    }
    if (concept.preferredPlacementId) {
      const placement = model.placements.find(({ id }) => id === concept.preferredPlacementId);
      if (!placement) {
        errors.push(`Concept "${concept.id}" references missing preferred placement "${concept.preferredPlacementId}"`);
      } else if (placement.conceptId !== concept.id) {
        errors.push(`Concept "${concept.id}" preferred placement "${placement.id}" belongs to "${placement.conceptId}"`);
      }
    }
  }

  const siblingOrders = new Map<string, Set<number>>();
  for (const placement of model.placements) {
    if (!conceptIds.has(placement.conceptId)) {
      errors.push(`Placement "${placement.id}" references missing concept "${placement.conceptId}"`);
    }
    if (placement.parentPlacementId && !placementIds.has(placement.parentPlacementId)) {
      errors.push(`Placement "${placement.id}" references missing parent "${placement.parentPlacementId}"`);
    }
    if (!Number.isInteger(placement.order) || placement.order < 0) {
      errors.push(`Placement "${placement.id}" has invalid order "${placement.order}"`);
      continue;
    }
    const siblingKey = placement.parentPlacementId ?? "<root>";
    const orders = siblingOrders.get(siblingKey) ?? new Set<number>();
    if (orders.has(placement.order)) {
      errors.push(`Placements under "${siblingKey}" duplicate order "${placement.order}"`);
    }
    orders.add(placement.order);
    siblingOrders.set(siblingKey, orders);
  }

  for (const placement of model.placements) {
    const visited = new Set<string>([placement.id]);
    let parentId = placement.parentPlacementId;
    while (parentId) {
      if (visited.has(parentId)) {
        errors.push(`Placement hierarchy contains cycle at "${placement.id}"`);
        break;
      }
      visited.add(parentId);
      parentId = model.placements.find(({ id }) => id === parentId)?.parentPlacementId;
    }
  }

  const semanticEdges = new Set<string>();
  for (const relationship of model.relationships) {
    if (!conceptIds.has(relationship.sourceConceptId)) {
      errors.push(`Relationship "${relationship.id}" references missing source concept "${relationship.sourceConceptId}"`);
    }
    if (!conceptIds.has(relationship.targetConceptId)) {
      errors.push(`Relationship "${relationship.id}" references missing target concept "${relationship.targetConceptId}"`);
    }
    const type = MAP_RELATIONSHIP_TYPES[relationship.typeId];
    if (!type) {
      errors.push(`Relationship "${relationship.id}" uses unregistered type "${relationship.typeId}"`);
    } else if (relationship.sourceConceptId === relationship.targetConceptId && !type.allowsSelfEdge) {
      errors.push(`Relationship "${relationship.id}" prohibits self-edge for type "${relationship.typeId}"`);
    }
    const edgeKey = `${relationship.sourceConceptId}\u0000${relationship.targetConceptId}\u0000${relationship.typeId}`;
    if (semanticEdges.has(edgeKey)) {
      errors.push(`Duplicate semantic relationship edge "${relationship.sourceConceptId}" -> "${relationship.targetConceptId}" (${relationship.typeId})`);
    }
    semanticEdges.add(edgeKey);
  }

  const contentOwners = new Set<string>();
  for (const content of model.content) {
    if (!conceptIds.has(content.conceptId)) {
      errors.push(`Content "${content.id}" references missing concept "${content.conceptId}"`);
    }
    if (contentOwners.has(content.conceptId)) {
      errors.push(`Concept "${content.conceptId}" has duplicate canonical content ownership`);
    }
    contentOwners.add(content.conceptId);
    content.body?.forEach((block, index) => {
      for (const problem of contentBlockProblems(block)) {
        errors.push(`Content "${content.id}" block ${index} (${block.kind}) ${problem}`);
      }
    });
  }

  for (const mechanism of model.mechanisms) {
    if (!conceptIds.has(mechanism.conceptId)) {
      errors.push(`Mechanism "${mechanism.id}" references missing owner concept "${mechanism.conceptId}"`);
    }
    if (mechanism.steps.length < 2) {
      errors.push(`Mechanism "${mechanism.id}" must contain at least two steps`);
    }
    for (const step of mechanism.steps) {
      if (!conceptIds.has(step.conceptId)) {
        errors.push(`Mechanism "${mechanism.id}" references missing step concept "${step.conceptId}"`);
      }
    }
  }

  for (const path of model.knowledgePaths) {
    if (path.id !== path.slug) {
      errors.push(`Knowledge path "${path.id}" must use the same initial id and slug`);
    }
    if (path.conceptIds.length < 2) {
      errors.push(`Knowledge path "${path.id}" must contain at least two concepts`);
    }
    for (const conceptId of path.conceptIds) {
      if (!conceptIds.has(conceptId)) {
        errors.push(`Knowledge path "${path.id}" references missing concept "${conceptId}"`);
      }
    }
  }

  return errors.sort();
}

export function assertValidMapKnowledge(model: MapKnowledgeModel): void {
  const errors = validateMapKnowledge(model);
  if (errors.length > 0) throw new MapKnowledgeValidationError(errors);
}
