// `map:author -- l2 ...`: L2 authoring tooling (docs/map-authoring/l2-authoring.md).
// Read-only except `territory --write`, which creates a plan skeleton for a
// group that has none. Group files (territory plans with the group's concept
// work) are repository-owned under src/lib/map/authoring/l2/groups/.
//
//   l2 context <concept-id> [--json]          the bounded L2 authoring context of one concept
//   l2 territory <group> [--write]            the group's plan, or its skeleton; --write creates the skeleton file
//   l2 check [--group <group>] [--json]       validate plans (completeness, claims, hazards, staleness, cross-plan)
//                                             and each owned concept's work at the stage it has reached
//   l2 signals <concept-id> [--json]          the audit signals of an authored concept, to resolve in its audit
//   l2 drift [--window <n>] [--json]          convergence across the latest authored L2 records (descriptive)
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { mapKnowledge } from "../src/lib/map/data.ts";
import { AUTHORED_CONTENT_CONCEPTS } from "../src/lib/map/authoring/content-registry.ts";
import type { MapConceptContent } from "../src/lib/map/types.ts";
import { assembleL2Context, formatL2Context } from "../src/lib/map/authoring/l2/context.ts";
import { groupAuditProblems, workProblems, type L2ConceptWork, type L2GroupAudit } from "../src/lib/map/authoring/l2/contracts.ts";
import { finishedConcepts } from "../src/lib/map/authoring/l2/campaign.ts";
import { inventoryL2 } from "../src/lib/map/authoring/l2/inventory.ts";
import { conceptSignals, driftReport, groupSignals, type L2Signal } from "../src/lib/map/authoring/l2/signals.ts";
import { crossPlanProblems, groupFile, GROUPS_DIR, planProblems, planSkeleton, staleProblems, type L2GroupFile } from "../src/lib/map/authoring/l2/territory.ts";

const ROOT = new URL("..", import.meta.url).pathname;

/** Every committed or working group file, checked to be a version-1 plan for the group it is named after. */
export function readPlans(root = ROOT): L2GroupFile[] {
  const dir = join(root, GROUPS_DIR);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => {
      const plan = JSON.parse(readFileSync(join(dir, file), "utf8")) as L2GroupFile;
      if (plan.version !== 1 || `${plan.group}.json` !== file) throw new Error(`${file} is not a version-1 plan for its group; inspect it`);
      return plan;
    });
}

const recordOf = (conceptId: string) => mapKnowledge.content.find((record) => record.conceptId === conceptId);
const titleOf = (conceptId: string) => mapKnowledge.concepts.find((concept) => concept.id === conceptId)?.title ?? conceptId;

/** An authored concept's audit signals, computed from its record, context, work and authored neighbours. */
export function signalsOf(conceptId: string, plans: readonly L2GroupFile[]): L2Signal[] {
  const record = recordOf(conceptId);
  if (!record) throw new Error(`${conceptId} has no record yet`);
  const context = assembleL2Context(conceptId, mapKnowledge, plans);
  const domain = mapKnowledge.placements.find((placement) => placement.id === (context.owner?.domain ?? ""));
  const work = plans.find((plan) => plan.group === context.owner?.group)?.concepts[conceptId] as L2ConceptWork | undefined;
  const neighbours = context.authoredNeighbours.map(recordOf).filter((entry): entry is MapConceptContent => !!entry);
  return conceptSignals({ conceptId, record, context, model: mapKnowledge, work, neighbours, domainOrder: domain?.order ?? 0 });
}

/** A group's own signals, over every owned member that has a record. */
export function groupSignalsOf(plan: L2GroupFile): L2Signal[] {
  const records = plan.members.filter((member) => member.standing === "owned" && recordOf(member.conceptId)).map((member) => ({ conceptId: member.conceptId, title: titleOf(member.conceptId), record: recordOf(member.conceptId)! }));
  return groupSignals(records);
}

/**
 * Every problem with the plans: each on its own terms, staleness, consistency
 * across plans, and each owned concept's work at its stage. A plan whose
 * owned concepts are all finished is a historical record: later legitimate
 * changes (a reserved member authored by its owner, say) would otherwise make
 * it "stale" for ever, so it is validated only when named in `only`, which a
 * run does for its own groups.
 */
export function planReport(plans: readonly L2GroupFile[], only?: readonly string[]): { group: string; problems: string[]; stale: string[]; finished?: true }[] {
  const inventory = inventoryL2(mapKnowledge);
  const cross = crossPlanProblems(plans, inventory);
  const finished = finishedConcepts(mapKnowledge, plans);
  return plans
    .filter((plan) => !only || only.includes(plan.group))
    .map((plan) => {
      const owned = plan.members.filter((member) => member.standing === "owned").map((member) => member.conceptId);
      if (!only && owned.every((conceptId) => finished.has(conceptId))) return { group: plan.group, problems: [], stale: [], finished: true as const };
      const work = Object.entries(plan.concepts ?? {}).flatMap(([conceptId, entry]) => {
        const audited = (entry as L2ConceptWork).audit;
        const stage = audited ? "audited" : recordOf(conceptId) ? "authored" : "designed";
        return workProblems(plan, conceptId, mapKnowledge, stage, audited ? signalsOf(conceptId, plans).map((signal) => signal.id) : []);
      });
      const audit = (plan as L2GroupFile & { groupAudit?: L2GroupAudit }).groupAudit ? groupAuditProblems(plan, mapKnowledge, groupSignalsOf(plan).map((signal) => signal.id)) : [];
      return {
        group: plan.group,
        problems: [...planProblems(plan, mapKnowledge), ...cross.filter((problem) => problem.includes(plan.group) || plan.members.some((member) => problem.startsWith(`${member.conceptId}:`))), ...work, ...audit],
        stale: staleProblems(plan, mapKnowledge),
      };
    });
}

export function commandL2(command: string | undefined, positional: string[], flag: (name: string) => string | undefined, has: (name: string) => boolean): void {
  const json = has("--json");
  switch (command) {
    case "context": {
      const conceptId = positional[0];
      if (!conceptId) throw new Error("usage: l2 context <concept-id> [--json]");
      const context = assembleL2Context(conceptId, mapKnowledge, readPlans());
      process.stdout.write(json ? `${JSON.stringify(context, null, 2)}\n` : formatL2Context(context));
      return;
    }
    case "territory": {
      const group = positional[0];
      if (!group) throw new Error("usage: l2 territory <group> [--write]");
      const path = join(ROOT, groupFile(group));
      if (existsSync(path)) {
        process.stdout.write(readFileSync(path, "utf8"));
        return;
      }
      const skeleton = planSkeleton(mapKnowledge, group);
      if (has("--write")) {
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, `${JSON.stringify(skeleton, null, 2)}\n`);
        console.log(`wrote the skeleton plan ${groupFile(group)}: fill the claims, reservations and splits, then \`map:author -- l2 check --group ${group}\``);
      } else process.stdout.write(`${JSON.stringify(skeleton, null, 2)}\n`);
      return;
    }
    case "check": {
      const report = planReport(readPlans(), flag("--group") ? [flag("--group")!] : undefined);
      if (json) console.log(JSON.stringify(report, null, 2));
      else {
        for (const entry of report) {
          console.log(`${entry.problems.length || entry.stale.length ? "FAIL" : entry.finished ? "done" : "ok  "}  ${entry.group}${entry.finished ? " (finished: a record, not revalidated)" : ""}`);
          for (const problem of entry.problems) console.log(`      ${problem}`);
          for (const problem of entry.stale) console.log(`      stale: ${problem}`);
        }
        console.log(`${report.length} plan(s), ${report.filter((entry) => entry.problems.length || entry.stale.length).length} with problems`);
      }
      if (report.some((entry) => entry.problems.length || entry.stale.length)) process.exitCode = 1;
      return;
    }
    case "signals": {
      const conceptId = positional[0];
      if (!conceptId) throw new Error("usage: l2 signals <concept-id> [--json]");
      const signals = signalsOf(conceptId, readPlans());
      if (json) console.log(JSON.stringify(signals, null, 2));
      else {
        for (const entry of signals) console.log(`${entry.kind === "deterministic" ? "fact  " : "signal"} ${entry.id}  ${entry.detail}`);
        console.log(`${signals.length} signal(s): resolve each in the concept audit`);
      }
      return;
    }
    case "drift": {
      const window = Number(flag("--window") ?? 30);
      const l2 = new Set(inventoryL2(mapKnowledge).concepts.filter((entry) => entry.role === "l2-only").map((entry) => entry.conceptId));
      // The registry's order is authoring order: the latest records are its tail.
      const records = AUTHORED_CONTENT_CONCEPTS.filter((conceptId) => l2.has(conceptId)).slice(-window).map((conceptId) => ({ title: titleOf(conceptId), record: recordOf(conceptId)! }));
      const report = driftReport(records);
      if (json) console.log(JSON.stringify(report, null, 2));
      else {
        console.log(`window ${report.window}: top form ${report.topSequence.sequence || "-"} (${report.topSequence.share}), top opening "${report.topOpening.frame}" (${report.topOpening.share}), top paragraph opener "${report.topParagraphOpener.opener}" (${report.topParagraphOpener.share}), paragraph length variation ${report.paragraphLengthVariation}`);
        for (const entry of report.signals) console.log(`signal ${entry.id}  ${entry.detail}`);
      }
      return;
    }
    default:
      throw new Error(`unknown l2 command ${command ?? "(none)"}: context, territory, check, signals, drift`);
  }
}
