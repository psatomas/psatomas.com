/**
 * L2 territory plans (docs/map-authoring/l2-analysis.md, sections 7 and 12).
 * One repository-owned file per ownership group, written before any member is
 * drafted: every member of the sibling group, whoever owns it, with the claims
 * it alone may explain; reservations for members owned elsewhere and not yet
 * authored; and a recorded split for every hazard pair that touches the group.
 * The file also carries the group's concept models and designs (contracts.ts)
 * and is committed with the group's content. Development tooling only.
 *
 * Validation here is deterministic: completeness, ownership, one owner per
 * claim, reservations honoured across plans, hazards answered, and the basis
 * the plan was written against. Whether a claim is well chosen is judgment.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { MapKnowledgeModel } from "../../types.ts";
import { AUTHORED_CONTENT_CONCEPTS } from "../content-registry.ts";
import { contentFingerprint } from "../representation/design.ts";
import { inventoryL2, type L2Inventory, type L2MemberStanding } from "./inventory.ts";

export const GROUPS_DIR = "src/lib/map/authoring/l2/groups";
export const groupFile = (groupPlacementId: string) => `${GROUPS_DIR}/${groupPlacementId}.json`;

export type L2Hazards = {
  nearSynonyms: { concepts: string[]; note: string }[];
  categoryMembers: { category: string; members: string[]; scope: string; note?: string }[];
  multiAxisGroups: { group: string; axes: string[] }[];
  facetWatch: { concept: string; note: string }[];
  stateCandidates: { strong: string[]; moderate: string[] };
  verticalBoundary: { l1Concept: string; l2Territory: string[]; note: string }[];
};
export const HAZARDS: L2Hazards = JSON.parse(readFileSync(new URL("./hazards.json", import.meta.url), "utf8"));

/** Owned members carry claims; unauthored members owned elsewhere carry reservations; authored ones are fixed. */
export type L2PlanMember = {
  conceptId: string;
  placementId: string;
  standing: L2MemberStanding;
  /** What only this concept explains (owned members). */
  claims?: string[];
  /** Concepts this one may name but never explain. */
  excludes?: string[];
  /** Territory held for a member owned by another group and not yet authored. */
  reserved?: string[];
  /** Reservations made for this concept elsewhere that its owner revises, each with its reason. */
  revisions?: { claim: string; reason: string }[];
};

/** Fingerprints of everything the plan was written against; any change makes it stale. */
export type L2PlanBasis = { membership: string; parents: Record<string, string>; fixed: Record<string, string>; hazards: string };

export type L2GroupFile = {
  version: 1;
  group: string;
  domain: string;
  parentConceptId: string;
  basis: L2PlanBasis;
  members: L2PlanMember[];
  /** A recorded split for every hazard pair touching an owned member: near-synonyms and category/member relations. */
  splits: { concepts: [string, string]; split: string }[];
  /** Concept models, designs and audits of owned members (contracts.ts). */
  concepts: Record<string, unknown>;
};

const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const normalize = (claim: string) => claim.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const blank = (value: unknown) => typeof value !== "string" || !value.trim();

/** The L0 domains a concept is placed under. */
function domainsOf(model: MapKnowledgeModel, conceptId: string): Set<string> {
  const byId = new Map(model.placements.map((placement) => [placement.id, placement]));
  const root = (placementId: string): string => {
    const placement = byId.get(placementId)!;
    return placement.parentPlacementId ? root(placement.parentPlacementId) : placement.id;
  };
  return new Set(model.placements.filter((placement) => placement.conceptId === conceptId).map((placement) => root(placement.id)));
}

/**
 * Unauthored concepts of the plan's own domain that an owned member's claims
 * name by a multi-word title, though they are neither members of the group
 * nor excluded. Such a claim takes territory a later plan of the same domain
 * will claim: the EVM's "message calls" was one, invisible to cross-plan
 * checks until both plans exist. Each is excluded (named only) or the claim
 * is reworded. Single-word titles are everyday words and are not matched.
 */
export function claimCollisions(plan: L2GroupFile, model: MapKnowledgeModel): { conceptId: string; named: string }[] {
  const words = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter(Boolean);
  const authored = new Set(model.content.map((record) => record.conceptId));
  const members = new Set((plan.members ?? []).map((member) => member.conceptId));
  const found: { conceptId: string; named: string }[] = [];
  for (const member of (plan.members ?? []).filter((entry) => entry.standing === "owned")) {
    const text = ` ${words((member.claims ?? []).join(" ")).join(" ")} `;
    for (const concept of model.concepts) {
      if (members.has(concept.id) || authored.has(concept.id) || (member.excludes ?? []).includes(concept.id)) continue;
      const title = words(concept.title);
      if (title.length < 2) continue;
      const singular = title.map((word, index) => (index === title.length - 1 ? word.replace(/s$/, "") : word)).join(" ");
      if (!text.includes(` ${title.join(" ")} `) && !(singular.length > 3 && text.includes(` ${singular} `))) continue;
      if (domainsOf(model, concept.id).has(plan.domain)) found.push({ conceptId: member.conceptId, named: concept.id });
    }
  }
  return found;
}

/** Registry and hazards a plan is judged against; the repository's by default, synthetic ones in tests. */
export type L2PlanOptions = { registry?: readonly string[]; hazards?: L2Hazards };

/** Hazard pairs (unordered) that involve a concept: near-synonyms and category/member relations. */
export function hazardPairs(conceptId: string, hazards: L2Hazards = HAZARDS): { concepts: [string, string]; kind: "near-synonym" | "category"; note?: string }[] {
  return [
    ...hazards.nearSynonyms.filter((pair) => pair.concepts.includes(conceptId)).map((pair) => ({ concepts: [pair.concepts[0], pair.concepts[1]] as [string, string], kind: "near-synonym" as const, note: pair.note })),
    ...hazards.categoryMembers.flatMap((entry) => (entry.category === conceptId ? entry.members : entry.members.includes(conceptId) ? [conceptId] : []).map((member) => ({ concepts: [entry.category, member] as [string, string], kind: "category" as const, note: entry.note }))),
  ];
}
const pairKey = ([a, b]: readonly string[]) => [a, b].sort().join("~");

/** The basis a plan for this group is written against, from the model as it is now. */
export function planBasis(model: MapKnowledgeModel, groupPlacementId: string, { registry = AUTHORED_CONTENT_CONCEPTS, hazards = HAZARDS }: L2PlanOptions = {}): L2PlanBasis {
  const inventory = inventoryL2(model, { authoredContent: registry });
  const group = inventory.groups.find((candidate) => candidate.groupPlacementId === groupPlacementId);
  if (!group) throw new Error(`${groupPlacementId} is not an L1 sibling group`);
  const records = new Map(model.content.map((record) => [record.conceptId, record]));
  const placementById = new Map(model.placements.map((placement) => [placement.id, placement]));
  const facts = new Map(inventory.concepts.map((entry) => [entry.conceptId, entry]));
  const owned = group.members.filter((member) => member.standing === "owned");
  const parents: Record<string, string> = {};
  for (const member of owned) {
    for (const placement of facts.get(member.conceptId)!.placements) {
      for (const id of [placement.groupPlacementId, placement.domainPlacementId]) {
        if (!id) continue;
        const conceptId = placementById.get(id)!.conceptId;
        parents[conceptId] = contentFingerprint(records.get(conceptId));
      }
    }
  }
  const fixed = Object.fromEntries(group.members.filter((member) => member.standing !== "owned" && records.has(member.conceptId)).map((member) => [member.conceptId, contentFingerprint(records.get(member.conceptId))]));
  const pairs = owned.flatMap((member) => hazardPairs(member.conceptId, hazards).map((pair) => pairKey(pair.concepts))).sort();
  return {
    membership: hash(group.members.map((member) => [member.placementId, member.conceptId, member.standing])),
    parents: Object.fromEntries(Object.entries(parents).sort()),
    fixed: Object.fromEntries(Object.entries(fixed).sort()),
    hazards: hash([...new Set(pairs)]),
  };
}

/**
 * A plan with every deterministic fact filled in and every judgment left empty:
 * members with their standing, empty claims for owned members, empty
 * reservations for unauthored members owned elsewhere, and an empty split for
 * each hazard pair. The agent fills the judgments.
 */
export function planSkeleton(model: MapKnowledgeModel, groupPlacementId: string, options: L2PlanOptions = {}): L2GroupFile {
  const inventory = inventoryL2(model, { authoredContent: options.registry ?? AUTHORED_CONTENT_CONCEPTS });
  const group = inventory.groups.find((candidate) => candidate.groupPlacementId === groupPlacementId);
  if (!group) throw new Error(`${groupPlacementId} is not an L1 sibling group`);
  const authored = new Set(model.content.map((record) => record.conceptId));
  const members: L2PlanMember[] = group.members.map((member) => ({
    conceptId: member.conceptId,
    placementId: member.placementId,
    standing: member.standing,
    ...(member.standing === "owned" ? { claims: [], excludes: [] } : member.standing === "owned-elsewhere" && !authored.has(member.conceptId) ? { reserved: [] } : {}),
  }));
  const pairs = new Map<string, [string, string]>();
  for (const member of group.members.filter((entry) => entry.standing === "owned")) for (const pair of hazardPairs(member.conceptId, options.hazards)) pairs.set(pairKey(pair.concepts), pair.concepts);
  return {
    version: 1,
    group: groupPlacementId,
    domain: group.domainPlacementId,
    parentConceptId: group.conceptId,
    basis: planBasis(model, groupPlacementId, options),
    members,
    splits: [...pairs.values()].map((concepts) => ({ concepts, split: "" })),
    concepts: {},
  };
}

/** Why a plan is not valid on its own terms against the model; empty when it is. */
export function planProblems(plan: L2GroupFile, model: MapKnowledgeModel, { registry = AUTHORED_CONTENT_CONCEPTS, hazards = HAZARDS }: L2PlanOptions = {}): string[] {
  const problems: string[] = [];
  if (plan.version !== 1) problems.push("version must be 1");
  const inventory = inventoryL2(model, { authoredContent: registry });
  const group = inventory.groups.find((candidate) => candidate.groupPlacementId === plan.group);
  if (!group) return [`${plan.group} is not an L1 sibling group`];
  if (plan.domain !== group.domainPlacementId || plan.parentConceptId !== group.conceptId) problems.push(`group ${plan.group} belongs to ${group.domainPlacementId} under ${group.conceptId}`);
  if (group.owned === 0) problems.push(`${plan.group} owns no concept: it has no territory plan`);
  const concepts = new Set(model.concepts.map((concept) => concept.id));
  const authored = new Set(model.content.map((record) => record.conceptId));
  const expected = group.members.map((member) => `${member.placementId}:${member.conceptId}:${member.standing}`);
  const listed = (plan.members ?? []).map((member) => `${member.placementId}:${member.conceptId}:${member.standing}`);
  if (JSON.stringify(listed) !== JSON.stringify(expected)) problems.push(`members must be the group's placements in order with their standing: expected ${expected.join(", ")}`);
  const seen = new Map<string, string>();
  for (const member of plan.members ?? []) {
    const at = member.conceptId;
    if (member.standing === "owned") {
      if (!member.claims?.length || member.claims.some(blank)) problems.push(`${at}: an owned member needs at least one non-empty claim`);
      for (const claim of member.claims ?? []) {
        const key = normalize(claim);
        if (seen.has(key) && seen.get(key) !== at) problems.push(`${at}: claim "${claim}" is also ${seen.get(key)}'s`);
        seen.set(key, at);
      }
      for (const excluded of member.excludes ?? []) {
        if (!concepts.has(excluded)) problems.push(`${at}: excludes unknown concept ${excluded}`);
        if (excluded === at) problems.push(`${at}: excludes itself`);
      }
      if (member.reserved?.length) problems.push(`${at}: an owned member holds claims, not reservations`);
    } else if (member.standing === "owned-elsewhere" && !authored.has(at)) {
      if (!member.reserved?.length || member.reserved.some(blank)) problems.push(`${at}: an unauthored member owned elsewhere needs its reserved territory`);
      if (member.claims?.length) problems.push(`${at}: owned elsewhere, so it holds reservations, not claims`);
    } else if (member.claims?.length || member.reserved?.length) {
      problems.push(`${at}: already authored, so its record is its fixed territory`);
    }
  }
  for (const collision of claimCollisions(plan, model)) {
    problems.push(`${collision.conceptId}: a claim names ${collision.named}, an unplanned concept of this domain: exclude it (named only), or reword the claim if it is not that concept's territory`);
  }
  for (const member of plan.members ?? []) {
    for (const claim of member.reserved ?? []) {
      const owner = seen.get(normalize(claim));
      if (owner) problems.push(`${member.conceptId}: reserved claim "${claim}" is claimed by ${owner} in the same plan`);
    }
  }
  const owned = (plan.members ?? []).filter((member) => member.standing === "owned");
  const needed = new Set(owned.flatMap((member) => hazardPairs(member.conceptId, hazards).map((pair) => pairKey(pair.concepts))));
  const answered = new Map((plan.splits ?? []).map((entry) => [pairKey(entry.concepts), entry.split]));
  for (const key of needed) if (blank(answered.get(key))) problems.push(`hazard ${key.replace("~", " ~ ")}: record how the territory is split, or stop if it cannot be`);
  for (const key of answered.keys()) if (!needed.has(key)) problems.push(`split ${key.replace("~", " ~ ")} answers no hazard of this group's owned members`);
  for (const conceptId of Object.keys(plan.concepts ?? {})) {
    if (!owned.some((member) => member.conceptId === conceptId)) problems.push(`concept work for ${conceptId}, which this group does not own`);
  }
  return problems;
}

/** Why a plan no longer describes the model it was written against. */
export function staleProblems(plan: L2GroupFile, model: MapKnowledgeModel, options: L2PlanOptions = {}): string[] {
  const now = planBasis(model, plan.group, options);
  const problems: string[] = [];
  if (now.membership !== plan.basis.membership) problems.push("the group's membership or ownership changed");
  if (now.hazards !== plan.basis.hazards) problems.push("the hazards touching the group changed");
  for (const [conceptId, fingerprint] of Object.entries(now.parents)) if (plan.basis.parents[conceptId] !== fingerprint) problems.push(`parent ${conceptId} changed`);
  for (const conceptId of Object.keys(plan.basis.parents)) if (!(conceptId in now.parents)) problems.push(`parent ${conceptId} no longer applies`);
  for (const [conceptId, fingerprint] of Object.entries(now.fixed)) if (plan.basis.fixed[conceptId] !== fingerprint) problems.push(`${conceptId} ${conceptId in plan.basis.fixed ? "changed" : "was authored"} since the plan`);
  return problems;
}

/**
 * Consistency across every plan: one owner per claim corpus-wide, and every
 * reservation made for a concept honoured (or explicitly revised) by the plan
 * of the group that owns it, once that plan exists.
 */
export function crossPlanProblems(plans: readonly L2GroupFile[], inventory: L2Inventory): string[] {
  const problems: string[] = [];
  const claimOwner = new Map<string, string>();
  for (const plan of plans) {
    for (const member of plan.members.filter((entry) => entry.standing === "owned")) {
      for (const claim of member.claims ?? []) {
        const key = normalize(claim);
        const owner = claimOwner.get(key);
        if (owner && owner !== member.conceptId) problems.push(`claim "${claim}" is owned by both ${owner} and ${member.conceptId}`);
        claimOwner.set(key, member.conceptId);
      }
    }
  }
  const ownerGroup = new Map(inventory.concepts.filter((entry) => entry.owner).map((entry) => [entry.conceptId, entry.owner!.groupPlacementId]));
  const byGroup = new Map(plans.map((plan) => [plan.group, plan]));
  for (const plan of plans) {
    for (const member of plan.members.filter((entry) => entry.reserved?.length)) {
      for (const claim of member.reserved!) {
        const owner = claimOwner.get(normalize(claim));
        if (owner && owner !== member.conceptId) problems.push(`${plan.group}: "${claim}" is reserved for ${member.conceptId} but owned by ${owner}`);
        const ownerPlan = byGroup.get(ownerGroup.get(member.conceptId) ?? "");
        const entry = ownerPlan?.members.find((candidate) => candidate.conceptId === member.conceptId && candidate.standing === "owned");
        if (entry && owner !== member.conceptId && !(entry.revisions ?? []).some((revision) => normalize(revision.claim) === normalize(claim) && !blank(revision.reason))) {
          problems.push(`${member.conceptId}: reserved by ${plan.group} as "${claim}", but its owner's plan (${ownerPlan!.group}) neither claims nor revises it`);
        }
      }
    }
  }
  return problems;
}
