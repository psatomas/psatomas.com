// `map:author -- l2 ...`: L2 authoring tooling (docs/map-authoring/l2-authoring.md).
// Read-only except `territory --write`, which creates a plan skeleton for a
// group that has none. Group files (territory plans with the group's concept
// work) are repository-owned under src/lib/map/authoring/l2/groups/.
//
//   l2 context <concept-id> [--json]          the bounded L2 authoring context of one concept
//   l2 territory <group> [--write]            the group's plan, or its skeleton; --write creates the skeleton file
//   l2 check [--group <group>] [--json]       validate plans: completeness, claims, hazards, staleness, cross-plan
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { mapKnowledge } from "../src/lib/map/data.ts";
import { assembleL2Context, formatL2Context } from "../src/lib/map/authoring/l2/context.ts";
import { inventoryL2 } from "../src/lib/map/authoring/l2/inventory.ts";
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

/** Every problem with the plans: each on its own terms, staleness, and consistency across plans. */
export function planReport(plans: readonly L2GroupFile[], only?: string): { group: string; problems: string[]; stale: string[] }[] {
  const inventory = inventoryL2(mapKnowledge);
  const cross = crossPlanProblems(plans, inventory);
  return plans
    .filter((plan) => !only || plan.group === only)
    .map((plan) => ({
      group: plan.group,
      problems: [...planProblems(plan, mapKnowledge), ...cross.filter((problem) => problem.includes(plan.group) || plan.members.some((member) => problem.startsWith(`${member.conceptId}:`)))],
      stale: staleProblems(plan, mapKnowledge),
    }));
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
      const report = planReport(readPlans(), flag("--group"));
      if (json) console.log(JSON.stringify(report, null, 2));
      else {
        for (const entry of report) {
          console.log(`${entry.problems.length || entry.stale.length ? "FAIL" : "ok  "}  ${entry.group}`);
          for (const problem of entry.problems) console.log(`      ${problem}`);
          for (const problem of entry.stale) console.log(`      stale: ${problem}`);
        }
        console.log(`${report.length} plan(s), ${report.filter((entry) => entry.problems.length || entry.stale.length).length} with problems`);
      }
      if (report.some((entry) => entry.problems.length || entry.stale.length)) process.exitCode = 1;
      return;
    }
    default:
      throw new Error(`unknown l2 command ${command ?? "(none)"}: context, territory, check`);
  }
}
