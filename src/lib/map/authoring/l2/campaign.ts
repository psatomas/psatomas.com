/**
 * The L2 campaign (docs/map-authoring/l2-analysis.md, sections 12, 17 and
 * 19; docs/map-authoring/l2-authoring.md): slices of about thirty concepts,
 * the agent's steps within a slice, one commit per ownership group, and the
 * text of commits and PRs. Pure; the CLI (scripts/map-author.ts) performs
 * every side effect. Development tooling only.
 */
import type { MapKnowledgeModel } from "../../types.ts";
import { AUTHORED_CONTENT_CONCEPTS } from "../content-registry.ts";
import type { L2ConceptWork } from "./contracts.ts";
import { inventoryL2 } from "./inventory.ts";
import type { L2GroupFile } from "./territory.ts";

/** About thirty concepts per PR: whole groups, in canonical order, never split. */
export const L2_SLICE_LIMIT = 30;
export const PILOT_SLICE = "pilot";

export type L2SliceGroup = { group: string; title: string; concepts: string[] };
export type L2Slice = { id: string; domain: string; domainTitle: string; ordinal: string; index: number; groups: L2SliceGroup[] };

const titleOf = (model: MapKnowledgeModel, placementId: string) => {
  const placement = model.placements.find((candidate) => candidate.id === placementId)!;
  return placement.contextualLabel ?? model.concepts.find((concept) => concept.id === placement.conceptId)!.title;
};

/**
 * Every slice of the campaign: for each domain in canonical order, its
 * ownership groups in L1 order, packed into the fewest slices of at most
 * `limit` owned concepts, balanced so no slice is a small remainder. The
 * partition counts every owned concept, authored or not, so a slice keeps its
 * identity as the campaign progresses.
 */
export function l2Slices(model: MapKnowledgeModel, { registry = AUTHORED_CONTENT_CONCEPTS, limit = L2_SLICE_LIMIT }: { registry?: readonly string[]; limit?: number } = {}): L2Slice[] {
  const inventory = inventoryL2(model, { authoredContent: registry });
  const roots = model.placements.filter((placement) => !placement.parentPlacementId).sort((a, b) => a.order - b.order);
  const slices: L2Slice[] = [];
  for (const [position, root] of roots.entries()) {
    const groups = model.placements
      .filter((placement) => placement.parentPlacementId === root.id)
      .sort((a, b) => a.order - b.order)
      .map((placement) => inventory.groups.find((group) => group.groupPlacementId === placement.id)!)
      .filter((group) => group && group.owned > 0)
      .map((group): L2SliceGroup => ({ group: group.groupPlacementId, title: titleOf(model, group.groupPlacementId), concepts: group.members.filter((member) => member.standing === "owned").map((member) => member.conceptId) }));
    const total = groups.reduce((sum, group) => sum + group.concepts.length, 0);
    const target = Math.min(limit, Math.ceil(total / Math.max(1, Math.ceil(total / limit))));
    let current: L2SliceGroup[] = [];
    const flush = () => {
      if (!current.length) return;
      const index = slices.filter((slice) => slice.domain === root.id).length + 1;
      slices.push({ id: `${root.id}-${index}`, domain: root.id, domainTitle: titleOf(model, root.id), ordinal: String(position + 1).padStart(2, "0"), index, groups: current });
      current = [];
    };
    for (const group of groups) {
      const size = current.reduce((sum, entry) => sum + entry.concepts.length, 0);
      if (current.length && (size + group.concepts.length > limit || size >= target)) flush();
      current.push(group);
    }
    flush();
  }
  return slices;
}

/** The pilot: named groups, run out of canonical order, with the human checkpoint before drafting. */
export function pilotSlice(model: MapKnowledgeModel, groups: readonly string[], registry: readonly string[] = AUTHORED_CONTENT_CONCEPTS): L2Slice {
  const inventory = inventoryL2(model, { authoredContent: registry });
  return {
    id: PILOT_SLICE,
    domain: PILOT_SLICE,
    domainTitle: "L2 pilot",
    ordinal: "--",
    index: 0,
    groups: groups.map((id) => {
      const group = inventory.groups.find((candidate) => candidate.groupPlacementId === id);
      if (!group || group.owned === 0) throw new Error(`${id} is not an ownership group`);
      return { group: id, title: titleOf(model, id), concepts: group.members.filter((member) => member.standing === "owned").map((member) => member.conceptId) };
    }),
  };
}

/** A concept is finished when it has content, or its group's plan records a design that blocks it. */
export function finishedConcepts(model: MapKnowledgeModel, plans: readonly L2GroupFile[]): Set<string> {
  const finished = new Set(model.content.map((record) => record.conceptId));
  for (const plan of plans) for (const [conceptId, work] of Object.entries(plan.concepts ?? {})) if ((work as L2ConceptWork).design?.decision === "block") finished.add(conceptId);
  return finished;
}

export const sliceRemaining = (slice: L2Slice, finished: ReadonlySet<string>) => slice.groups.flatMap((group) => group.concepts).filter((conceptId) => !finished.has(conceptId));

export const l2Branch = (slice: Pick<L2Slice, "id" | "domain" | "index">) => (slice.id === PILOT_SLICE ? "feat/map-l2-pilot" : `feat/map-${slice.domain}-l2-${slice.index}`);

// ---------------------------------------------------------------- the agent's steps

export type L2StepKind = "plan" | "design" | "author" | "audit" | "group-audit";
export type L2Step = { kind: L2StepKind; subject: string; group: string };

/**
 * The order of a slice's judgment steps. Territory comes first for every
 * group, so claims and reservations are settled across the slice before any
 * concept is modelled; then every concept's model and design; then each
 * concept is drafted and audited in turn (each in its own fresh context); the
 * group audits close the slice. The pilot's checkpoint sits between design
 * and drafting.
 */
export function sliceSteps(groups: readonly { group: string; concepts: readonly string[] }[]): L2Step[] {
  const concepts = groups.flatMap((group) => group.concepts.map((conceptId) => ({ conceptId, group: group.group })));
  return [
    ...groups.map((group): L2Step => ({ kind: "plan", subject: group.group, group: group.group })),
    ...concepts.map(({ conceptId, group }): L2Step => ({ kind: "design", subject: conceptId, group })),
    ...concepts.flatMap(({ conceptId, group }): L2Step[] => [
      { kind: "author", subject: conceptId, group },
      { kind: "audit", subject: conceptId, group },
    ]),
    ...groups.map((group): L2Step => ({ kind: "group-audit", subject: group.group, group: group.group })),
  ];
}
export const stepKey = (step: Pick<L2Step, "kind" | "subject">) => `${step.kind}:${step.subject}`;

// ---------------------------------------------------------------- group commits

const RECORD_START = /^ {4}\{$/;
const RECORD_ID = /^ {6}id: "([a-z0-9-]+)-content",/;
const RECORD_END = /^ {4}\},$/;

/** Each content record's line span in data.ts, by concept: from its opening brace to its closing one. */
export function recordSpans(text: string): Map<string, { start: number; end: number }> {
  const lines = text.split("\n");
  const spans = new Map<string, { start: number; end: number }>();
  for (let index = 0; index + 1 < lines.length; index++) {
    if (!RECORD_START.test(lines[index])) continue;
    const id = lines[index + 1].match(RECORD_ID)?.[1];
    if (!id) continue;
    let end = index + 2;
    while (end < lines.length && !RECORD_END.test(lines[end])) end++;
    spans.set(id, { start: index, end });
  }
  return spans;
}

/** data.ts without the given concepts' records. */
export function withoutRecords(text: string, conceptIds: readonly string[]): string {
  const spans = recordSpans(text);
  const drop = new Set<number>();
  for (const conceptId of conceptIds) {
    const span = spans.get(conceptId);
    if (!span) throw new Error(`no record block for ${conceptId}`);
    for (let line = span.start; line <= span.end; line++) drop.add(line);
  }
  return text.split("\n").filter((_, index) => !drop.has(index)).join("\n");
}

/**
 * `text` with the given concepts' records taken from `from`: a repair
 * commit's data.ts, which carries one group's repaired records and leaves
 * every other record as committed. Both must hold each record.
 */
export function withRecordsFrom(text: string, from: string, conceptIds: readonly string[]): string {
  const target = recordSpans(text);
  const source = recordSpans(from);
  const sourceLines = from.split("\n");
  let lines = text.split("\n");
  // From the last span to the first, so earlier spans keep their line numbers.
  const spans = conceptIds.map((conceptId) => {
    const span = target.get(conceptId);
    const replacement = source.get(conceptId);
    if (!span || !replacement) throw new Error(`no record block for ${conceptId}`);
    return { span, replacement: sourceLines.slice(replacement.start, replacement.end + 1) };
  });
  for (const { span, replacement } of spans.sort((a, b) => b.span.start - a.span.start)) lines = [...lines.slice(0, span.start), ...replacement, ...lines.slice(span.end + 1)];
  return lines.join("\n");
}

/** The registry file without the given concepts' entries. */
export function withoutRegistryEntries(text: string, conceptIds: readonly string[]): string {
  const drop = new Set(conceptIds.map((conceptId) => `  "${conceptId}",`));
  return text.split("\n").filter((line) => !drop.has(line)).join("\n");
}

type ViewNode = { placementId: string; hasContent: boolean; children: ViewNode[] } & Record<string, unknown>;

/** The generated view with hasContent cleared at the given placements, serialized as map:generate writes it. */
export function viewWithout(text: string, placementIds: readonly string[]): string {
  const view = JSON.parse(text) as { roots: ViewNode[] };
  const clear = new Set(placementIds);
  const visit = (node: ViewNode) => {
    if (clear.has(node.placementId)) node.hasContent = false;
    node.children.forEach(visit);
  };
  view.roots.forEach(visit);
  return `${JSON.stringify(view)}\n`;
}

export const DATA_FILE = "src/lib/map/data.ts";
export const REGISTRY_FILE = "src/lib/map/authoring/content-registry.ts";
export const VIEW_FILE = "src/components/map/explorer-view.generated.json";

export type GroupCommitInput = {
  model: MapKnowledgeModel;
  groups: readonly { group: string; authored: readonly string[]; file: string }[];
  /** Files as validated (the final tree) and as on the base (undefined: absent on the base). */
  final: Readonly<Record<string, string>>;
  base: Readonly<Record<string, string | undefined>>;
};

/**
 * The tree after each group's commit, built from the validated final tree by
 * removing every later group's records, registry entries, hasContent flips
 * and group file. Removing every group's must reproduce the base exactly,
 * which proves each intermediate tree holds whole records and nothing else.
 */
export function groupCommitTrees(input: GroupCommitInput): { problems: string[]; trees: Record<string, string | undefined>[] } {
  const placementsOf = (conceptIds: readonly string[]) => input.model.placements.filter((placement) => conceptIds.includes(placement.conceptId)).map((placement) => placement.id);
  const treeAfter = (count: number): Record<string, string | undefined> => {
    const later = input.groups.slice(count).flatMap((group) => group.authored);
    const tree: Record<string, string | undefined> = {
      [DATA_FILE]: withoutRecords(input.final[DATA_FILE], later),
      [REGISTRY_FILE]: withoutRegistryEntries(input.final[REGISTRY_FILE], later),
      [VIEW_FILE]: viewWithout(input.final[VIEW_FILE], placementsOf(later)),
    };
    input.groups.forEach((group, index) => (tree[group.file] = index < count ? input.final[group.file] : input.base[group.file]));
    return tree;
  };
  const problems: string[] = [];
  let origin: Record<string, string | undefined>;
  try {
    origin = treeAfter(0);
  } catch (error) {
    return { problems: [(error as Error).message], trees: [] };
  }
  for (const [file, text] of Object.entries(origin)) if (text !== input.base[file]) problems.push(`${file}: removing the run's records does not give back the base, so the records are not whole additions`);
  const last = treeAfter(input.groups.length);
  for (const [file, text] of Object.entries(last)) if (text !== input.final[file]) problems.push(`${file}: the last group's tree is not the validated tree`);
  return { problems, trees: input.groups.map((_, index) => treeAfter(index + 1)) };
}

// ---------------------------------------------------------------- text

export function groupCommitMessage(group: { title: string; authored: readonly string[]; blocked: readonly string[] }, trailer?: string): string {
  const lines = [`feat(map): author ${group.title} L2 topics`, "", `Authored: ${group.authored.join(", ") || "none"}.`];
  if (group.blocked.length) lines.push(`Blocked by a missing representation, unauthored: ${group.blocked.join(", ")}.`);
  lines.push("", "Territory plan, concept models, designs and audits are in the group file.");
  return [...lines, ...(trailer ? ["", trailer] : [])].join("\n");
}

export function repairCommitMessage(group: { title: string; repaired: readonly string[] }, repair: { cycle: number; reason: string }, trailer?: string): string {
  const lines = [`fix(map): repair ${group.title} L2 topics`, "", `Repair cycle ${repair.cycle}: ${repair.reason}`, "", `Repaired and re-audited: ${group.repaired.join(", ")}.`, "", "The concept audits and the group audit in the group file are bound to the repaired records."];
  return [...lines, ...(trailer ? ["", trailer] : [])].join("\n");
}

export const l2PrTitle = (slice: Pick<L2Slice, "id" | "domainTitle" | "index">) => (slice.id === PILOT_SLICE ? "feat(map): author the L2 pilot" : `feat(map): author ${slice.domainTitle} L2 topics, part ${slice.index}`);

export function l2PrBody(input: {
  slice: L2Slice;
  groups: readonly { group: string; title: string; authored: readonly string[]; blocked: readonly string[] }[];
  checks: Readonly<Record<string, { ok: boolean; detail: string }>>;
  fixes: readonly { message: string; reason: string }[];
  auditNotes: readonly string[];
  history?: readonly ({ kind: "repair"; cycle: number; reason: string; concepts: readonly string[] } | { kind: "sync"; from: string; to: string })[];
  footer?: string;
}): string {
  const authored = input.groups.flatMap((group) => group.authored);
  const lines = [
    `L2 exposition for ${input.slice.id === PILOT_SLICE ? "the L2 pilot" : `${input.slice.ordinal} ${input.slice.domainTitle}, part ${input.slice.index}`}: ${authored.length} concept(s) in ${input.groups.length} ownership group(s), one commit per group (docs/map-authoring/l2-authoring.md).`,
    "",
    "## Groups",
    "",
    ...input.groups.map((group) => `- **${group.title}** (\`${group.group}\`): ${group.authored.join(", ") || "none"}${group.blocked.length ? `; blocked: ${group.blocked.join(", ")}` : ""}`),
    "",
    "Each group file holds its territory plan, every concept's model and design, the concept audits with every signal resolved, and the group audit.",
    "",
    "## Verification",
    "",
    ...Object.entries(input.checks).map(([name, check]) => `- ${name}: ${check.ok ? check.detail : `FAILED ${check.detail}`}`),
    "",
    "## Diff boundary",
    "",
    "Only the authored records, their registry entries, hasContent flips at every placement of them, and the run's group files changed; every existing record, taxonomy, other group files and the L0 projection are byte-identical (validateL2Diff).",
  ];
  if (input.fixes.length) lines.push("", "## General fixes", "", ...input.fixes.map((fix) => `- ${fix.message}: ${fix.reason}`));
  if (input.auditNotes.length) lines.push("", "## Audit notes", "", ...input.auditNotes.map((note) => `- ${note}`));
  if (input.history?.length) {
    lines.push("", "## Repairs and base updates", "", ...input.history.map((entry) => (entry.kind === "repair" ? `- Repair cycle ${entry.cycle} (${entry.concepts.join(", ")}): ${entry.reason}` : `- Merged main: base ${entry.from.slice(0, 7)} → ${entry.to.slice(0, 7)}`)));
  }
  return [...lines, ...(input.footer ? ["", input.footer] : [])].join("\n");
}
