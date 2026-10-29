// `map:author -- l2 ...`: L2 authoring tooling (docs/map-authoring/l2-authoring.md).
// Read-only except `territory --write`, which creates a plan skeleton for a
// group that has none. Group files (territory plans with the group's concept
// work) are repository-owned under src/lib/map/authoring/l2/groups/.
//
//   l2 context <concept-id> [--json]          the bounded L2 authoring context of one concept
//   l2 cost [--branch <b>] [--since <iso>] [--until <iso>] [--session <id>] [--agents] [--json]
//                                             model spend of the orchestrator and its subagents, from the local transcripts
//   l2 territory <group> [--write]            the group's plan, or its skeleton; --write creates the skeleton file
//   l2 check [--group <group>] [--json]       validate plans (completeness, claims, hazards, staleness, cross-plan)
//                                             and each owned concept's work at the stage it has reached
//   l2 signals <concept-id> [--json]          the audit signals of an authored concept, to resolve in its audit
//   l2 group-signals <group> [--json]         the signals of a group's audit, over its owned members' records
//   l2 drift [--window <n>] [--json]          convergence across the latest authored L2 records (descriptive)
import { execFileSync } from "node:child_process";
import { closeSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, readSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { mapKnowledge } from "../src/lib/map/data.ts";
import { AUTHORED_CONTENT_CONCEPTS } from "../src/lib/map/authoring/content-registry.ts";
import type { MapConceptContent } from "../src/lib/map/types.ts";
import { assembleL2Context, formatL2Context } from "../src/lib/map/authoring/l2/context.ts";
import { costByRole, PRICES_AS_OF, priceOf, projectSlug, sessionCost, type CostFilter, type CostTotals, type SessionCost } from "../src/lib/map/authoring/l2/cost.ts";
import { weighted } from "../src/lib/map/authoring/l2v2/core.ts";
import { conceptWorkOf, groupAuditProblems, workProblems, type L2ConceptWork, type L2GroupAudit } from "../src/lib/map/authoring/l2/contracts.ts";
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
  const work = conceptWorkOf(plans.find((plan) => plan.group === context.owner?.group), conceptId) as L2ConceptWork | undefined;
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

/** Transcript lines, read in chunks so a long session's transcript is never held whole. */
function* linesOf(path: string): Generator<string> {
  const fd = openSync(path, "r");
  const buffer = Buffer.alloc(1 << 20);
  let rest = "";
  try {
    for (let read; (read = readSync(fd, buffer, 0, buffer.length, null)) > 0; ) {
      const lines = (rest + buffer.toString("utf8", 0, read)).split("\n");
      rest = lines.pop()!;
      yield* lines;
    }
    if (rest) yield rest;
  } finally {
    closeSync(fd);
  }
}

/**
 * Every orchestrator session of this checkout and its subagents, costed under
 * the filter. Transcripts last written before `since` are not read.
 */
export function campaignCost(filter: CostFilter, { session, dir = join(process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), ".claude"), "projects", projectSlug(ROOT.replace(/\/$/, ""))) }: { session?: string; dir?: string } = {}): SessionCost[] {
  if (!existsSync(dir)) throw new Error(`no transcripts at ${dir}`);
  const fresh = (path: string) => !filter.since || statSync(path).mtime.toISOString() >= filter.since;
  const costs: SessionCost[] = [];
  for (const file of readdirSync(dir).filter((name) => name.endsWith(".jsonl") && (!session || name === `${session}.jsonl`)).sort()) {
    if (fresh(join(dir, file))) costs.push(sessionCost(linesOf(join(dir, file)), "orchestrator", filter));
    const subagents = join(dir, file.replace(/\.jsonl$/, ""), "subagents");
    if (!existsSync(subagents)) continue;
    for (const agent of readdirSync(subagents).filter((name) => name.endsWith(".jsonl")).sort()) {
      if (!fresh(join(subagents, agent))) continue;
      const meta = join(subagents, agent.replace(/\.jsonl$/, ".meta.json"));
      const description = existsSync(meta) ? ((JSON.parse(readFileSync(meta, "utf8")) as { description?: string }).description ?? agent) : agent;
      costs.push(sessionCost(linesOf(join(subagents, agent)), description, filter));
    }
  }
  return costs.filter((cost) => cost.calls > 0);
}

const thousands = (value: number) => Math.round(value).toLocaleString("en-US");

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
    case "cost": {
      const filter: CostFilter = {
        branch: flag("--branch") ?? execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim(),
        ...(flag("--since") ? { since: flag("--since") } : {}),
        ...(flag("--until") ? { until: flag("--until") } : {}),
      };
      const sessions = campaignCost(filter, { session: flag("--session") });
      const roles = costByRole(sessions);
      if (json) {
        console.log(JSON.stringify({ filter, roles: Object.fromEntries(roles), ...(has("--agents") ? { sessions } : {}) }, null, 2));
        return;
      }
      console.log(`model spend on ${filter.branch}${filter.since ? ` since ${filter.since}` : ""}${filter.until ? ` until ${filter.until}` : ""} (weighted = input + 0.1 cache read + 1.25 cache write + 5 output; usd = list price as of ${PRICES_AS_OF}, an estimate)`);
      console.log(`${"role".padEnd(13)} ${"sessions".padStart(8)} ${"calls".padStart(6)} ${"input".padStart(9)} ${"cache write".padStart(12)} ${"cache read".padStart(13)} ${"output".padStart(10)} ${"weighted".padStart(12)} ${"usd".padStart(9)}  models`);
      const dollars = (entry: { usd: number; unpriced: string[] }) => `$${entry.usd.toFixed(2)}${entry.unpriced.length ? "+?" : ""}`;
      const row = (name: string, entry: CostTotals) =>
        console.log(`${name.padEnd(13)} ${String(entry.sessions).padStart(8)} ${String(entry.calls).padStart(6)} ${thousands(entry.usage.input_tokens).padStart(9)} ${thousands(entry.usage.cache_creation_input_tokens).padStart(12)} ${thousands(entry.usage.cache_read_input_tokens).padStart(13)} ${thousands(entry.usage.output_tokens).padStart(10)} ${thousands(entry.weighted).padStart(12)} ${dollars(entry).padStart(9)}  ${Object.keys(entry.models).sort().join(", ")}`);
      for (const [role, entry] of [...roles].sort((a, b) => b[1].weighted - a[1].weighted)) row(role, entry);
      const total = costByRole(sessions.map((session) => ({ ...session, role: "total" }))).get("total");
      if (total) {
        row("total", total);
        for (const [model, usage] of Object.entries(total.models).sort()) {
          const price = priceOf(model, usage);
          console.log(`  by model: ${model.padEnd(20)} ${thousands(weighted(usage)).padStart(12)} weighted  ${price === undefined ? "unpriced (no list price in cost.ts PRICES)" : `$${price.toFixed(2)}`}`);
        }
      }
      if (has("--agents")) for (const session of sessions) console.log(`  ${session.role.padEnd(12)} ${thousands(session.weighted).padStart(10)} weighted ${dollars(session).padStart(9)}, ${String(session.calls).padStart(3)} calls  ${Object.keys(session.models).join(", ").padEnd(18)} ${session.description}`);
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
    case "group-signals": {
      const group = positional[0];
      if (!group) throw new Error("usage: l2 group-signals <group> [--json]");
      const plan = readPlans().find((entry) => entry.group === group);
      if (!plan) throw new Error(`no plan for ${group}`);
      const signals = groupSignalsOf(plan);
      if (json) console.log(JSON.stringify(signals, null, 2));
      else {
        for (const entry of signals) console.log(`signal ${entry.id}  ${entry.detail}`);
        console.log(`${signals.length} group signal(s): resolve each in the group audit`);
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
        console.log(`window ${report.window}: top form ${report.topSequence.sequence || "-"} (${report.topSequence.share}), top opening "${report.topOpening.frame}" (${report.topOpening.share}), top paragraph opener "${report.topParagraphOpener.opener}" (${report.topParagraphOpener.share}), paragraph length variation ${report.paragraphLengthVariation}, median ${report.medianWords} words, ${report.topParagraphCount.count} paragraphs in ${report.topParagraphCount.share} of records`);
        for (const entry of report.signals) console.log(`signal ${entry.id}  ${entry.detail}`);
      }
      return;
    }
    default:
      throw new Error(`unknown l2 command ${command ?? "(none)"}: context, cost, territory, check, signals, group-signals, drift`);
  }
}
