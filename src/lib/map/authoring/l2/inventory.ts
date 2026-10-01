/**
 * Read-only facts about MAP's L2 layer, derived from the taxonomy: which
 * concepts it holds, where each is placed, who owns its authoring, and how
 * sibling groups share concepts. Development tooling for the L2 analysis
 * (docs/map-authoring/l2-analysis.md), never imported by the MAP runtime and
 * never writing anything.
 *
 * Concept identity and placement identity stay apart throughout: a concept
 * placed several times is one fact with several placements, and owning its
 * authoring is a workflow assignment, not a second meaning.
 */
import type { MapKnowledgeModel } from "../../types.ts";
import { AUTHORED_CONTENT_CONCEPTS } from "../content-registry.ts";

/** One appearance of an L2 concept. */
export type L2Placement = {
  placementId: string;
  depth: number;
  /** The enclosing L1 placement (the sibling group); absent above L2. */
  groupPlacementId?: string;
  domainPlacementId: string;
  /** Explorer wording when it differs from the concept title. */
  label?: string;
};

export type L2ConceptFacts = {
  conceptId: string;
  title: string;
  /** "dual-role": also placed at L1, so its exposition is owned by L1 authoring. */
  role: "l2-only" | "dual-role";
  placements: L2Placement[];
  /** Number of distinct sibling groups and L0 domains among the L2 placements. */
  groups: number;
  domains: number;
  /** The preferred placement and its group and domain: who authors an l2-only concept. Absent for dual-role concepts. */
  owner?: { placementId: string; groupPlacementId: string; domainPlacementId: string };
  hasContent: boolean;
  registered: boolean;
  /** Other concepts whose title equals one of this concept's contextual labels. */
  labelHomonyms: string[];
};

export type L2MemberStanding = "owned" | "owned-elsewhere" | "dual-role";

/** One L1 placement and the L2 placements beneath it. */
export type L2GroupFacts = {
  groupPlacementId: string;
  conceptId: string;
  domainPlacementId: string;
  members: { placementId: string; conceptId: string; standing: L2MemberStanding }[];
  owned: number;
};

export type L2Inventory = {
  counts: {
    placements: number;
    concepts: number;
    l2Only: number;
    dualRole: number;
    dualRolePlacements: number;
    multiPlacement: number;
    crossDomain: number;
    groups: number;
    ownershipGroups: number;
    withContent: number;
  };
  concepts: L2ConceptFacts[];
  groups: L2GroupFacts[];
  /** Sizes of the sets of groups linked through shared concepts, largest first. */
  linkedGroupSets: number[];
  /** Topology the L2 architecture assumes and does not handle. */
  problems: string[];
};

export function inventoryL2(model: MapKnowledgeModel, { authoredContent = AUTHORED_CONTENT_CONCEPTS }: { authoredContent?: readonly string[] } = {}): L2Inventory {
  const placementById = new Map(model.placements.map((placement) => [placement.id, placement]));
  const conceptById = new Map(model.concepts.map((concept) => [concept.id, concept]));
  const withContent = new Set(model.content.map((content) => content.conceptId));
  const registry = new Set(authoredContent);
  const ancestry = (placementId: string) => {
    const chain = [placementById.get(placementId)!];
    while (chain[0].parentPlacementId) chain.unshift(placementById.get(chain[0].parentPlacementId)!);
    return chain;
  };
  const position = new Map(
    model.placements.map((placement) => {
      const chain = ancestry(placement.id);
      return [placement.id, { depth: chain.length - 1, domainPlacementId: chain[0].id, groupPlacementId: chain.length > 2 ? chain[1].id : undefined }];
    }),
  );
  const placementsOf = new Map<string, string[]>();
  for (const placement of model.placements) placementsOf.set(placement.conceptId, [...(placementsOf.get(placement.conceptId) ?? []), placement.id]);
  const titleIds = new Map<string, string[]>();
  for (const concept of model.concepts) titleIds.set(concept.title.toLowerCase(), [...(titleIds.get(concept.title.toLowerCase()) ?? []), concept.id]);

  const problems: string[] = [];
  const l2Placements = model.placements.filter((placement) => position.get(placement.id)!.depth === 2);
  for (const placement of model.placements) {
    if (position.get(placement.id)!.depth > 2) problems.push(`${placement.id} is deeper than L2`);
  }
  for (const placement of l2Placements) {
    if (model.placements.some((child) => child.parentPlacementId === placement.id)) problems.push(`L2 placement ${placement.id} carries children`);
  }

  const conceptIds = [...new Set(l2Placements.map((placement) => placement.conceptId))];
  const concepts = conceptIds.map((conceptId): L2ConceptFacts => {
    const concept = conceptById.get(conceptId)!;
    const placements = placementsOf.get(conceptId)!.map((placementId): L2Placement => {
      const placement = placementById.get(placementId)!;
      const { depth, domainPlacementId, groupPlacementId } = position.get(placementId)!;
      return { placementId, depth, ...(groupPlacementId ? { groupPlacementId } : {}), domainPlacementId, ...(placement.contextualLabel ? { label: placement.contextualLabel } : {}) };
    });
    const atL2 = placements.filter((placement) => placement.depth === 2);
    const role = placements.some((placement) => placement.depth < 2) ? "dual-role" : "l2-only";
    let owner: L2ConceptFacts["owner"];
    if (role === "l2-only") {
      const preferred = concept.preferredPlacementId ?? (placements.length === 1 ? placements[0].placementId : undefined);
      const at = atL2.find((placement) => placement.placementId === preferred);
      if (at) owner = { placementId: at.placementId, groupPlacementId: at.groupPlacementId!, domainPlacementId: at.domainPlacementId };
      else problems.push(`${conceptId} has ${placements.length} placements but no preferred L2 placement: ownership is unclear`);
    }
    const labelHomonyms = [...new Set(placements.flatMap((placement) => (placement.label ? titleIds.get(placement.label.toLowerCase()) ?? [] : [])))].filter((id) => id !== conceptId);
    return {
      conceptId,
      title: concept.title,
      role,
      placements,
      groups: new Set(atL2.map((placement) => placement.groupPlacementId)).size,
      domains: new Set(atL2.map((placement) => placement.domainPlacementId)).size,
      ...(owner ? { owner } : {}),
      hasContent: withContent.has(conceptId),
      registered: registry.has(conceptId),
      labelHomonyms,
    };
  });
  const factsOf = new Map(concepts.map((facts) => [facts.conceptId, facts]));

  const groups = model.placements
    .filter((placement) => position.get(placement.id)!.depth === 1)
    .map((group): L2GroupFacts => {
      const members = l2Placements
        .filter((placement) => placement.parentPlacementId === group.id)
        .sort((a, b) => a.order - b.order)
        .map((placement) => {
          const facts = factsOf.get(placement.conceptId)!;
          const standing: L2MemberStanding = facts.role === "dual-role" ? "dual-role" : facts.owner?.groupPlacementId === group.id ? "owned" : "owned-elsewhere";
          return { placementId: placement.id, conceptId: placement.conceptId, standing };
        });
      return { groupPlacementId: group.id, conceptId: group.conceptId, domainPlacementId: position.get(group.id)!.domainPlacementId, members, owned: members.filter((member) => member.standing === "owned").length };
    });

  // Groups are linked when they share an L2 concept, or when one holds a
  // dual-role concept whose L1 placement is another group.
  const link = new Map(groups.map((group) => [group.groupPlacementId, group.groupPlacementId]));
  const find = (id: string): string => {
    const parent = link.get(id)!;
    if (parent === id) return id;
    const root = find(parent);
    link.set(id, root);
    return root;
  };
  for (const facts of concepts) {
    const linked = facts.placements.map((placement) => (placement.depth === 1 ? placement.placementId : placement.groupPlacementId)).filter((id): id is string => !!id && link.has(id));
    for (const id of linked.slice(1)) link.set(find(id), find(linked[0]));
  }
  const setSizes = new Map<string, number>();
  for (const group of groups) setSizes.set(find(group.groupPlacementId), (setSizes.get(find(group.groupPlacementId)) ?? 0) + 1);

  for (const facts of concepts) {
    if (facts.hasContent !== facts.registered) problems.push(`${facts.conceptId}: content and registry disagree`);
  }

  const l2Only = concepts.filter((facts) => facts.role === "l2-only");
  return {
    counts: {
      placements: l2Placements.length,
      concepts: concepts.length,
      l2Only: l2Only.length,
      dualRole: concepts.length - l2Only.length,
      dualRolePlacements: concepts.filter((facts) => facts.role === "dual-role").reduce((sum, facts) => sum + facts.placements.filter((placement) => placement.depth === 2).length, 0),
      multiPlacement: concepts.filter((facts) => facts.placements.length > 1).length,
      crossDomain: concepts.filter((facts) => new Set(facts.placements.map((placement) => placement.domainPlacementId)).size > 1).length,
      groups: groups.length,
      ownershipGroups: groups.filter((group) => group.owned > 0).length,
      withContent: concepts.filter((facts) => facts.hasContent).length,
    },
    concepts,
    groups,
    linkedGroupSets: [...setSizes.values()].sort((a, b) => b - a),
    problems,
  };
}
