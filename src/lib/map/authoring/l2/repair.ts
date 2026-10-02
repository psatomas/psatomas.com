/**
 * The bounds of an L2 repair (docs/map-authoring/l2-authoring.md#repairs).
 * A repair reopens drafted concepts to fix what an audit or a review found,
 * within the territory, model and design they were accepted with. The
 * baseline fingerprints those when the concept is reopened; before the
 * repair is drafted again, anything that moved must have been re-recorded
 * (and so revalidated) within the repair, and only for reopened concepts.
 * Pure; development tooling only.
 */
import { createHash } from "node:crypto";
import type { L2ConceptWork } from "./contracts.ts";
import type { L2GroupFile } from "./territory.ts";

/** Fingerprints of each reopened concept's model and design, and of the territory of each group it belongs to. */
export type L2RepairBaseline = {
  /** Model and design, by concept (never its audit). */
  work: Record<string, string>;
  /** Each owned member's territory (claims, excludes, reservations, revisions), by concept, for every reopened group. */
  members: Record<string, string>;
  /** Each reopened group's hazard splits. */
  splits: Record<string, string>;
};

const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value ?? null)).digest("hex");

const workFingerprint = (work: L2ConceptWork | undefined) => hash(work ? { model: work.model, design: work.design } : null);
const memberFingerprint = (member: L2GroupFile["members"][number]) => hash({ claims: member.claims, excludes: member.excludes, reserved: member.reserved, revisions: member.revisions, standing: member.standing });

/** The baseline of the given concepts as their group files hold them now. */
export function repairBaseline(plans: readonly L2GroupFile[], conceptIds: readonly string[]): L2RepairBaseline {
  const baseline: L2RepairBaseline = { work: {}, members: {}, splits: {} };
  for (const conceptId of conceptIds) {
    const plan = plans.find((candidate) => candidate.members.some((member) => member.conceptId === conceptId && member.standing === "owned"));
    if (!plan) throw new Error(`no plan owns ${conceptId}`);
    baseline.work[conceptId] = workFingerprint(plan.concepts[conceptId] as L2ConceptWork | undefined);
    for (const member of plan.members) baseline.members[member.conceptId] = memberFingerprint(member);
    baseline.splits[plan.group] = hash(plan.splits);
  }
  return baseline;
}

/**
 * What a repair changed beyond its bounds, against the baseline:
 * - a reopened concept's model or design changed without its design being
 *   recorded again in the repair (recording it validates it);
 * - a member's territory or a group's splits changed without the plan being
 *   recorded again in the repair;
 * - the territory of a concept that was not reopened changed at all: its
 *   record and audits judged the old territory.
 * `redesigned` and `replanned` are the designs and plans recorded since the
 * repair opened. Empty when the repair stays within its bounds.
 */
export function repairScopeProblems(input: { baseline: L2RepairBaseline; reopened: readonly string[]; plans: readonly L2GroupFile[]; redesigned: ReadonlySet<string>; replanned: ReadonlySet<string> }): string[] {
  const now = repairBaseline(input.plans, Object.keys(input.baseline.work));
  const problems: string[] = [];
  for (const [conceptId, before] of Object.entries(input.baseline.work)) {
    if (now.work[conceptId] !== before && !input.redesigned.has(conceptId)) problems.push(`${conceptId}: its model or design changed without being recorded again in the repair (\`l2 record design ${conceptId}\`)`);
  }
  const groupOf = (conceptId: string) => input.plans.find((plan) => plan.members.some((member) => member.conceptId === conceptId))?.group ?? "?";
  for (const [conceptId, before] of Object.entries(input.baseline.members)) {
    if (now.members[conceptId] === before) continue;
    if (!input.reopened.includes(conceptId)) problems.push(`${conceptId}: its territory changed, but it was not reopened, so its record and audits judged the old territory`);
    else if (!input.replanned.has(groupOf(conceptId))) problems.push(`${conceptId}: its territory changed without ${groupOf(conceptId)}'s plan being recorded again in the repair`);
  }
  for (const [group, before] of Object.entries(input.baseline.splits)) {
    if (now.splits[group] !== before && !input.replanned.has(group)) problems.push(`${group}: its splits changed without its plan being recorded again in the repair`);
  }
  return problems;
}
