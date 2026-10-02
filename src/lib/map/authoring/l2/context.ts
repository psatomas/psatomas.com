/**
 * The bounded authoring context for one L2 concept (docs/map-authoring/
 * l2-analysis.md, section 13). Everything here is deterministic and always
 * provided: identity and every placement, the exact sentences in every parent
 * (and in the L0 domain prose) that mention the concept, its territory-plan
 * entry, its siblings' claims, reservations made for it elsewhere, and the
 * hazards that touch it. Full texts of parents and authored neighbours are
 * on demand, never assembled into a domain dump, and no unrelated authored
 * record is ever offered as an example. Development tooling only.
 */
import type { MapKnowledgeModel } from "../../types.ts";
import { AUTHORED_CONTENT_CONCEPTS } from "../content-registry.ts";
import { createMapAuthoringInspector } from "../context.ts";
import { inventoryL2 } from "./inventory.ts";
import { HAZARDS, hazardPairs, type L2GroupFile, type L2Hazards } from "./territory.ts";

export type L2Mention = { from: string; sentence: string };

export type L2PlacementContext = {
  placementId: string;
  trail: string;
  label?: string;
  parent: { conceptId: string; title: string };
  siblings: { conceptId: string; label: string; standing: string; hasContent: boolean }[];
  /** Sentences of this placement's parent exposition that mention the concept: premises, never to be re-taught. */
  parentMentions: string[];
};

export type L2ConceptContext = {
  concept: { id: string; title: string };
  role: "l2-only" | "dual-role";
  hasContent: boolean;
  owner?: { group: string; domain: string; placementId: string };
  placements: L2PlacementContext[];
  /** Sentences of the L0 domain prose (not its term strips) that mention the concept. */
  domainMentions: L2Mention[];
  plan?: { group: string; claims: string[]; excludes: string[]; revisions: { claim: string; reason: string }[] };
  /** Every other member of the owner group with the territory the plan gives it. */
  siblingTerritory: { conceptId: string; standing: string; claims?: string[]; reserved?: string[] }[];
  /** Territory reserved for this concept by plans of other groups that hold it. */
  reservedElsewhere: { group: string; claims: string[] }[];
  hazards: {
    pairs: { concepts: [string, string]; kind: string; note?: string }[];
    facetWatch?: string;
    multiAxisGroup?: string[];
    labelHomonyms: string[];
    sameTitle: string[];
    stateCandidate?: "strong" | "moderate";
  };
  /** Concepts in the owner group or a hazard pair that already have content: retrieve their text only to check a boundary. */
  authoredNeighbours: string[];
};

const words = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const stem = (value: string) => words(value).split(" ").map((word) => word.replace(/(ies|es|s)$/, "")).join(" ");

/** Sentences of `lines` that mention any of `names` (case- and plural-insensitive, whole words). */
export function mentionsOf(lines: readonly string[], names: readonly string[]): string[] {
  const keys = [...new Set(names.map(stem).filter((key) => key.length > 2))];
  const found: string[] = [];
  for (const line of lines) {
    if (line.startsWith("[terms]")) continue;
    for (const sentence of line.split(/(?<=[.!?])\s+(?=[A-Z[])/)) {
      const text = ` ${stem(sentence)} `;
      if (keys.some((key) => text.includes(` ${key} `)) && !found.includes(sentence)) found.push(sentence);
    }
  }
  return found;
}

export function assembleL2Context(conceptId: string, model: MapKnowledgeModel, plans: readonly L2GroupFile[], { registry = AUTHORED_CONTENT_CONCEPTS, hazards = HAZARDS }: { registry?: readonly string[]; hazards?: L2Hazards } = {}): L2ConceptContext {
  const inventory = inventoryL2(model, { authoredContent: registry });
  const facts = inventory.concepts.find((entry) => entry.conceptId === conceptId);
  if (!facts) throw new Error(`${conceptId} is not placed at L2`);
  const inspector = createMapAuthoringInspector(model, { authoredContent: registry });
  const context = inspector.inspectConcept(conceptId);
  const title = context.concept.title;
  const withContent = new Set(model.content.map((record) => record.conceptId));
  const standingOf = new Map(inventory.groups.flatMap((group) => group.members.map((member) => [`${group.groupPlacementId}/${member.placementId}`, member.standing] as const)));
  const placements = context.placements
    .filter((placement) => placement.depth === 2)
    .map((placement): L2PlacementContext => {
      const parent = placement.parent!;
      const names = [title, ...(placement.contextualLabel ? [placement.contextualLabel] : [])];
      return {
        placementId: placement.placementId,
        trail: placement.trail.map((step) => step.label).join(" / "),
        ...(placement.contextualLabel ? { label: placement.contextualLabel } : {}),
        parent: { conceptId: parent.conceptId, title: parent.label },
        siblings: placement.siblings
          .filter((sibling) => sibling.placementId !== placement.placementId)
          .map((sibling) => ({ conceptId: sibling.conceptId, label: sibling.label, standing: standingOf.get(`${parent.placementId}/${sibling.placementId}`) ?? "?", hasContent: sibling.hasContent })),
        parentMentions: mentionsOf(inspector.inspectConcept(parent.conceptId).content.lines, names),
      };
    });
  const domains = [...new Set(context.placements.filter((placement) => placement.depth === 2).map((placement) => placement.domain.conceptId))];
  const labels = [title, ...facts.placements.flatMap((placement) => (placement.label ? [placement.label] : []))];
  const domainMentions = domains.flatMap((domain) => mentionsOf(inspector.inspectConcept(domain).content.lines, labels).map((sentence) => ({ from: domain, sentence })));
  const ownerPlan = facts.owner ? plans.find((plan) => plan.group === facts.owner!.groupPlacementId) : undefined;
  const entry = ownerPlan?.members.find((member) => member.conceptId === conceptId);
  const pairs = hazardPairs(conceptId, hazards);
  const neighbours = new Set([...(ownerPlan?.members ?? []).map((member) => member.conceptId), ...pairs.flatMap((pair) => pair.concepts)]);
  neighbours.delete(conceptId);
  return {
    concept: { id: conceptId, title },
    role: facts.role,
    hasContent: facts.hasContent,
    ...(facts.owner ? { owner: { group: facts.owner.groupPlacementId, domain: facts.owner.domainPlacementId, placementId: facts.owner.placementId } } : {}),
    placements,
    domainMentions,
    ...(entry && ownerPlan ? { plan: { group: ownerPlan.group, claims: entry.claims ?? [], excludes: entry.excludes ?? [], revisions: entry.revisions ?? [] } } : {}),
    siblingTerritory: (ownerPlan?.members ?? [])
      .filter((member) => member.conceptId !== conceptId)
      .map((member) => ({ conceptId: member.conceptId, standing: member.standing, ...(member.claims ? { claims: member.claims } : {}), ...(member.reserved ? { reserved: member.reserved } : {}) })),
    reservedElsewhere: plans.filter((plan) => plan.group !== facts.owner?.groupPlacementId).flatMap((plan) => plan.members.filter((member) => member.conceptId === conceptId && member.reserved?.length).map((member) => ({ group: plan.group, claims: member.reserved! }))),
    hazards: {
      pairs,
      ...(hazards.facetWatch.find((watch) => watch.concept === conceptId) ? { facetWatch: hazards.facetWatch.find((watch) => watch.concept === conceptId)!.note } : {}),
      ...(facts.owner && hazards.multiAxisGroups.find((group) => group.group === facts.owner!.groupPlacementId) ? { multiAxisGroup: hazards.multiAxisGroups.find((group) => group.group === facts.owner!.groupPlacementId)!.axes } : {}),
      labelHomonyms: facts.labelHomonyms,
      sameTitle: context.sameTitleConcepts,
      ...(hazards.stateCandidates.strong.includes(conceptId) ? { stateCandidate: "strong" as const } : hazards.stateCandidates.moderate.includes(conceptId) ? { stateCandidate: "moderate" as const } : {}),
    },
    authoredNeighbours: [...neighbours].filter((id) => withContent.has(id)).sort(),
  };
}

/** The context as plain lines for an agent working in a fresh, bounded context. */
export function formatL2Context(context: L2ConceptContext): string {
  const lines = [`L2 authoring context: ${context.concept.title} (${context.concept.id})`, `Role: ${context.role}${context.hasContent ? ", has content" : ""}${context.owner ? `; owned by group ${context.owner.group} in ${context.owner.domain} (preferred placement ${context.owner.placementId})` : ""}`, ""];
  lines.push(`Placements (${context.placements.length}): the one exposition must hold at every one`);
  for (const placement of context.placements) {
    lines.push(`  ${placement.trail}${placement.label ? `  [label "${placement.label}"]` : ""}`);
    lines.push(`    siblings: ${placement.siblings.map((sibling) => `${sibling.label} (${sibling.standing}${sibling.hasContent ? ", authored" : ""})`).join("; ")}`);
    if (placement.parentMentions.length) for (const sentence of placement.parentMentions) lines.push(`    parent says: ${sentence}`);
    else lines.push("    parent says nothing about it");
  }
  if (context.domainMentions.length) {
    lines.push("", "Domain prose mentioning it:");
    for (const mention of context.domainMentions) lines.push(`  [${mention.from}] ${mention.sentence}`);
  }
  lines.push("", "Territory:");
  if (context.plan) {
    lines.push(`  claims (explain only these): ${context.plan.claims.join("; ") || "none yet"}`);
    lines.push(`  excludes (name, never explain): ${context.plan.excludes.join(", ") || "none"}`);
    for (const revision of context.plan.revisions) lines.push(`  revises a reservation: "${revision.claim}" because ${revision.reason}`);
  } else lines.push("  no territory plan yet: write the group's plan first");
  for (const sibling of context.siblingTerritory) {
    lines.push(`  ${sibling.conceptId} (${sibling.standing}): ${sibling.claims ? `claims ${sibling.claims.join("; ")}` : sibling.reserved ? `reserved ${sibling.reserved.join("; ")}` : "fixed by its record"}`);
  }
  for (const reserved of context.reservedElsewhere) lines.push(`  reserved for it by ${reserved.group}: ${reserved.claims.join("; ")}`);
  const hazards = context.hazards;
  const notes = [
    ...hazards.pairs.map((pair) => `${pair.kind} ${pair.concepts.join(" ~ ")}${pair.note ? `: ${pair.note}` : ""}`),
    ...(hazards.facetWatch ? [`facet watch: ${hazards.facetWatch}`] : []),
    ...(hazards.multiAxisGroup ? [`the group splits along several axes (${hazards.multiAxisGroup.join(", ")}): the axes are the parent's`] : []),
    ...(hazards.labelHomonyms.length ? [`a contextual label is another concept's title: ${hazards.labelHomonyms.join(", ")}`] : []),
    ...(hazards.sameTitle.length ? [`same title as: ${hazards.sameTitle.join(", ")}`] : []),
    ...(hazards.stateCandidate ? [`${hazards.stateCandidate} state candidate: consider \`state\` only if returns or persistent modes carry the meaning`] : []),
  ];
  if (notes.length) lines.push("", "Hazards:", ...notes.map((note) => `  ${note}`));
  if (context.authoredNeighbours.length) lines.push("", `Authored neighbours (read only to check a boundary): ${context.authoredNeighbours.join(", ")}`);
  return `${lines.join("\n")}\n`;
}
