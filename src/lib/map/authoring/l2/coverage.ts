/**
 * Who has judged each relational signal (docs/map-authoring/l2-authoring.md,
 * "Signals"). An overlap between two records is one finding however it is
 * reached: from either record's signals, or from their group's. It is
 * resolved once, by any review recorded against both records as they are now:
 *
 * - a concept audit, which binds its own record and, since relational signals
 *   were bound, every authored neighbour's record it was recorded against;
 * - a group audit, which binds every owned member's record.
 *
 * An audit recorded before neighbours were bound covers only the overlaps its
 * own sentences make, under the id it resolved then (the signal's legacy id),
 * exactly as it was validated when recorded. Nothing here suppresses a
 * signal: every one is still listed, and one no current review resolves is a
 * problem. Pure apart from what the caller passes; development tooling only.
 */
import type { MapConceptContent, MapKnowledgeModel } from "../../types.ts";
import { contentFingerprint } from "../representation/design.ts";
import { assembleL2Context } from "./context.ts";
import { conceptWorkOf, type L2ConceptWork, type L2Coverage, type L2GroupAudit } from "./contracts.ts";
import { isBatched } from "./pipeline.ts";
import { conceptSignals, groupSignals, mentionedConcepts, relationalId, type L2Relation, type L2Signal } from "./signals.ts";
import type { L2GroupFile } from "./territory.ts";

/** One recorded review: the records it is bound to (by fingerprint) and the signal ids it resolved. */
export type L2Review = {
  by: string;
  records: Readonly<Record<string, string>>;
  resolutions: ReadonlySet<string>;
  /** Set for a concept audit recorded before neighbours were bound: it covers only its own overlaps, under their legacy ids. */
  legacyOwner?: string;
};

const resolved = (resolutions: readonly { id: string; resolution: string }[] | undefined) => new Set((resolutions ?? []).filter((entry) => entry.resolution?.trim()).map((entry) => entry.id));

/** Every concept audit and group audit the group files hold. */
export function reviewsIn(plans: readonly L2GroupFile[]): L2Review[] {
  return plans.flatMap((plan) => {
    const concepts = Object.keys(plan.concepts ?? {}).flatMap((conceptId): L2Review[] => {
      const audit = conceptWorkOf(plan, conceptId)?.audit;
      if (!audit) return [];
      const records = { ...(audit.neighbours ?? {}), [conceptId]: audit.recordFingerprint };
      return [{ by: `the audit of ${conceptId}`, records, resolutions: resolved(audit.resolutions), ...(audit.neighbours ? {} : { legacyOwner: conceptId }) }];
    });
    const group = (plan as L2GroupFile & { groupAudit?: L2GroupAudit }).groupAudit;
    return group ? [...concepts, { by: `the group audit of ${plan.group}`, records: group.records ?? {}, resolutions: resolved(group.resolutions) }] : concepts;
  });
}

/**
 * The coverage of relational signals by `reviews`, with records as
 * `fingerprint` reports them now. `known` are the signals computed alongside
 * (the concepts' and their groups'): their legacy ids for one overlap are
 * accepted from any review bound to both records, since each names that same
 * overlap.
 */
export function coverageOf(input: { reviews: readonly L2Review[]; fingerprint: (conceptId: string) => string; known?: readonly L2Signal[] }): L2Coverage {
  const aliases = new Map<string, Set<string>>();
  const alias = (key: string, id: string | undefined) => id && (aliases.get(key) ?? aliases.set(key, new Set()).get(key)!).add(id);
  for (const entry of input.known ?? []) if (entry.relation) [entry.id, entry.legacyId].forEach((id) => alias(entry.relation!.key, id));
  return (signal) => {
    const relation: L2Relation = signal.relation;
    const [a, b] = relation.concepts;
    const ids = new Set([signal.id, ...(signal.legacyId ? [signal.legacyId] : []), relationalId("neighbour-overlap", relation.key), relationalId("sibling-overlap", relation.key), ...(aliases.get(relation.key) ?? [])]);
    return input.reviews
      .filter((review) => {
        if (review.legacyOwner !== undefined) {
          // As validated when recorded: the owner's audit, bound to the owner's record, resolving the id it was given then.
          return review.legacyOwner === relation.owner && review.records[relation.owner] === input.fingerprint(relation.owner) && !!signal.legacyId && review.resolutions.has(signal.legacyId);
        }
        return review.records[a] === input.fingerprint(a) && review.records[b] === input.fingerprint(b) && [...ids].some((id) => review.resolutions.has(id));
      })
      .map((review) => review.by);
  };
}

const recordIn = (model: MapKnowledgeModel, conceptId: string) => model.content.find((entry) => entry.conceptId === conceptId);
const titleIn = (model: MapKnowledgeModel, conceptId: string) => model.concepts.find((concept) => concept.id === conceptId)?.title ?? conceptId;
/** A concept's record fingerprint in `model`, as audits bind it. */
export const fingerprintIn = (model: MapKnowledgeModel) => (conceptId: string) => contentFingerprint(recordIn(model, conceptId));

type ContextOptions = Parameters<typeof assembleL2Context>[3];

/**
 * The authored records a concept's overlap signals compare against: its
 * context's authored neighbours (its owner group's members and its hazard
 * partners), and, so that the relation is symmetric, the owned members of
 * every other group that lists the concept among its members. Whichever of two
 * neighbours is audited later then sees their overlap, and its audit can
 * resolve it for both (coverageOf).
 */
function relationalNeighbours(model: MapKnowledgeModel, plans: readonly L2GroupFile[], conceptId: string, context: ReturnType<typeof assembleL2Context>): string[] {
  const listing = plans.filter((plan) => plan.group !== context.owner?.group && plan.members.some((member) => member.conceptId === conceptId));
  const reverse = listing.flatMap((plan) => plan.members.filter((member) => member.standing === "owned").map((member) => member.conceptId));
  const owner = plans.find((plan) => plan.group === context.owner?.group);
  // Group-batched plans (simplified v2) also compare against what the record must not explain and what it names.
  const expanded = isBatched(owner) ? expandedNeighbours(model, conceptId, context) : [];
  return [...new Set([...context.authoredNeighbours, ...reverse, ...expanded])].filter((id) => id !== conceptId && recordIn(model, id)).sort();
}

/** The most authored concepts a record's naming adds to its neighbours: a bound, so a record that names many concepts stays cheap to check. */
export const MAX_REFERENCED_NEIGHBOURS = 16;

/** Every concept above a concept's placements in the taxonomy: their texts are premises (parent overlap), not neighbours. */
function ancestorsOf(model: MapKnowledgeModel, conceptId: string): Set<string> {
  const byId = new Map(model.placements.map((placement) => [placement.id, placement]));
  const ancestors = new Set<string>();
  for (const placement of model.placements.filter((entry) => entry.conceptId === conceptId)) {
    for (let parent = placement.parentPlacementId ? byId.get(placement.parentPlacementId) : undefined; parent; parent = parent.parentPlacementId ? byId.get(parent.parentPlacementId) : undefined) ancestors.add(parent.conceptId);
  }
  return ancestors;
}

/**
 * Neighbours a group-batched plan adds, deterministically: every concept the
 * member excludes (it may be named, never explained: an overlap is the
 * leakage to look at), and the authored concepts its record names (signals.ts
 * mentionedConcepts), at most MAX_REFERENCED_NEIGHBOURS of them in id order,
 * never the concept's own ancestors.
 */
export function expandedNeighbours(model: MapKnowledgeModel, conceptId: string, context: ReturnType<typeof assembleL2Context>): string[] {
  const excludes = [...(context.plan?.excludes ?? [])].sort();
  const record = recordIn(model, conceptId);
  if (!record) return excludes;
  const ancestors = ancestorsOf(model, conceptId);
  const nearby = new Set([...context.siblingTerritory.map((sibling) => sibling.conceptId), ...context.hazards.pairs.flatMap((pair) => pair.concepts), ...excludes]);
  const named = mentionedConcepts(record, model, conceptId, nearby).filter((id) => !ancestors.has(id) && !excludes.includes(id) && recordIn(model, id));
  return [...excludes, ...named.slice(0, MAX_REFERENCED_NEIGHBOURS)];
}

/** An authored concept's audit signals, from its record, context, work and authored neighbours. */
export function l2Signals(model: MapKnowledgeModel, plans: readonly L2GroupFile[], conceptId: string, options: ContextOptions = {}): L2Signal[] {
  const record = recordIn(model, conceptId);
  if (!record) throw new Error(`${conceptId} has no record yet`);
  const context = assembleL2Context(conceptId, model, plans, options);
  const domain = model.placements.find((placement) => placement.id === (context.owner?.domain ?? ""));
  const work = conceptWorkOf(plans.find((plan) => plan.group === context.owner?.group), conceptId) as L2ConceptWork | undefined;
  const neighbours = relationalNeighbours(model, plans, conceptId, context).map((id) => recordIn(model, id)).filter((entry): entry is MapConceptContent => !!entry);
  return conceptSignals({ conceptId, record, context, model, work, neighbours, domainOrder: domain?.order ?? 0 });
}

/** A group's own signals, over every owned member that has a record. */
export function l2GroupSignals(model: MapKnowledgeModel, plan: L2GroupFile): L2Signal[] {
  const records = plan.members.filter((member) => member.standing === "owned" && recordIn(model, member.conceptId)).map((member) => ({ conceptId: member.conceptId, title: titleIn(model, member.conceptId), record: recordIn(model, member.conceptId)! }));
  return groupSignals(records);
}

/** The authored neighbours a concept audit is recorded against, by record fingerprint: the other side of its relational signals. */
export function neighbourBasis(model: MapKnowledgeModel, plans: readonly L2GroupFile[], conceptId: string, options: ContextOptions = {}): Record<string, string> {
  const fingerprint = fingerprintIn(model);
  return Object.fromEntries(relationalNeighbours(model, plans, conceptId, assembleL2Context(conceptId, model, plans, options)).map((id) => [id, fingerprint(id)]));
}

/**
 * The coverage of relational signals by every audit in `plans`, as the records
 * in `model` are now. The signals of every audited group that owns a concept
 * of `known` are added, so a group audit's resolutions under its own legacy
 * ids count for the overlaps they name.
 */
export function coverageIn(model: MapKnowledgeModel, plans: readonly L2GroupFile[], known: readonly L2Signal[] = []): L2Coverage {
  const concepts = new Set(known.flatMap((entry) => entry.relation?.concepts ?? []));
  const groups = plans.filter((plan) => (plan as L2GroupFile & { groupAudit?: L2GroupAudit }).groupAudit && plan.members.some((member) => member.standing === "owned" && concepts.has(member.conceptId)));
  return coverageOf({ reviews: reviewsIn(plans), fingerprint: fingerprintIn(model), known: [...known, ...groups.flatMap((plan) => l2GroupSignals(model, plan))] });
}
