/**
 * The diff boundary of an L2 run (docs/map-authoring/l2-analysis.md, section
 * 17), checked before anything is committed. Pure: the CLI loads both sides
 * from git and computes each record's signals, and passes them in.
 *
 * It extends the domain run's content diff (orchestrator/diff-check.ts) with
 * the group layer. What may be authored is derived from the run's group files,
 * never supplied: every owned member whose design does not block it. Only the
 * run's group files may change; every other plan is byte-identical. Each run
 * group must be valid, current and consistent with every plan, each authored
 * concept audited with every signal resolved, and each group audited.
 */
import { validateContentDiff, type DiffInput, type DiffReport } from "../orchestrator/diff-check.ts";
import { groupAuditProblems, workProblems, type L2ConceptWork, type L2GroupAudit } from "./contracts.ts";
import { inventoryL2 } from "./inventory.ts";
import { crossPlanProblems, groupFile, planProblems, staleProblems, type L2GroupFile, type L2Hazards } from "./territory.ts";

export type L2DiffInput = Omit<DiffInput, "expectedConcepts"> & {
  /** The run's groups, in commit order. */
  groups: readonly string[];
  basePlans: readonly L2GroupFile[];
  headPlans: readonly L2GroupFile[];
  /** Each authored concept's signal ids, and each run group's group-signal ids. */
  signals: Readonly<Record<string, readonly string[]>>;
  groupSignals: Readonly<Record<string, readonly string[]>>;
  hazards?: L2Hazards;
};

export type L2DiffReport = DiffReport & { groups: string[]; authored: string[]; blocked: string[] };

const blocks = (plan: L2GroupFile, conceptId: string) => (plan.concepts[conceptId] as L2ConceptWork | undefined)?.design?.decision === "block";

export function validateL2Diff(input: L2DiffInput): L2DiffReport {
  const problems: string[] = [];
  const runFiles = new Set(input.groups.map(groupFile));
  const plans = new Map(input.headPlans.map((plan) => [plan.group, plan]));
  const runPlans = input.groups.map((group) => plans.get(group)).filter((plan): plan is L2GroupFile => !!plan);
  for (const group of input.groups) if (!plans.has(group)) problems.push(`the run's group ${group} has no plan`);
  for (const group of input.groups) if (!input.changedFiles.includes(groupFile(group))) problems.push(`the run's group file ${groupFile(group)} is unchanged`);
  const basePlans = new Map(input.basePlans.map((plan) => [plan.group, JSON.stringify(plan)]));
  for (const plan of input.headPlans) {
    if (input.groups.includes(plan.group)) continue;
    if (basePlans.get(plan.group) !== JSON.stringify(plan)) problems.push(`another group's plan changed: ${plan.group}`);
  }
  for (const group of basePlans.keys()) if (!plans.has(group)) problems.push(`a plan was removed: ${group}`);

  const owned = runPlans.flatMap((plan) => plan.members.filter((member) => member.standing === "owned").map((member) => ({ plan, conceptId: member.conceptId })));
  const blocked = owned.filter(({ plan, conceptId }) => blocks(plan, conceptId)).map(({ conceptId }) => conceptId);
  const expected = owned.filter(({ plan, conceptId }) => !blocks(plan, conceptId) && !input.base.content.some((record) => record.conceptId === conceptId)).map(({ conceptId }) => conceptId);

  const content = validateContentDiff({ ...input, changedFiles: input.changedFiles.filter((file) => !runFiles.has(file)), expectedConcepts: expected });
  problems.push(...content.problems);

  const inventory = inventoryL2(input.head, { authoredContent: input.headRegistry });
  const l2Only = new Set(inventory.concepts.filter((entry) => entry.role === "l2-only").map((entry) => entry.conceptId));
  for (const conceptId of content.addedConcepts) if (!l2Only.has(conceptId)) problems.push(`${conceptId} is not an L2-only concept`);
  const options = { registry: input.headRegistry, ...(input.hazards ? { hazards: input.hazards } : {}) };
  for (const plan of runPlans) {
    problems.push(...planProblems(plan, input.head, options).map((problem) => `${plan.group}: ${problem}`));
    problems.push(...staleProblems(plan, input.head, options).map((problem) => `${plan.group} is stale: ${problem}`));
    for (const conceptId of expected.filter((id) => plan.members.some((member) => member.conceptId === id))) {
      problems.push(...workProblems(plan, conceptId, input.head, "audited", input.signals[conceptId] ?? []));
    }
    for (const conceptId of blocked.filter((id) => plan.members.some((member) => member.conceptId === id))) {
      if (input.head.content.some((record) => record.conceptId === conceptId)) problems.push(`${conceptId}: its design blocks it, yet it has a record`);
    }
    problems.push(...groupAuditProblems(plan as L2GroupFile & { groupAudit?: L2GroupAudit }, input.head, input.groupSignals[plan.group] ?? []).map((problem) => `${plan.group}: ${problem}`));
  }
  problems.push(...crossPlanProblems(input.headPlans, inventory));
  return { ...content, ok: problems.length === 0, problems, groups: [...input.groups], authored: content.addedConcepts, blocked };
}
