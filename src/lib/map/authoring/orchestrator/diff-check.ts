/**
 * Validates a domain run's working diff against its base, as the orchestrator
 * requires before committing: only the run's own content, its registration,
 * and the resulting hasContent flags may change, plus any declared general
 * fix. Pure: the CLI loads both sides from git and passes them in.
 */
import type { MapKnowledgeModel } from "../../types.ts";

export const CONTENT_FILES = [
  "src/lib/map/data.ts",
  "src/lib/map/authoring/content-registry.ts",
  "src/components/map/explorer-view.generated.json",
] as const;

/**
 * The continuation exception for general fixes (domain-runbook.md#stops), made
 * mechanical: a declared fix is a test fix (test files and the browser suite)
 * or an authoring-tooling fix, never MAP runtime or product code, never
 * content, and small. Anything else is a stop, not a fix.
 */
export const FIX_KINDS = ["test", "fix"] as const;
export type FixKind = (typeof FIX_KINDS)[number];
export const MAX_FIX_LINES = 120;
const TEST_FILE = /(^|\/)[^/]+\.test\.tsx?$|^e2e\/map\//;
const TOOLING_FILE = /^(scripts\/|e2e\/map\/|src\/lib\/map\/authoring\/|docs\/map-authoring\/)/;

export type DeclaredFix = { kind: string; message: string; files: readonly string[] };

/** Problems with a set of declared fixes; `changedLines` is their added plus deleted lines. */
export function validateFixes(fixes: readonly DeclaredFix[], changedLines = 0): string[] {
  const problems: string[] = [];
  const owners = new Map<string, string>();
  for (const fix of fixes) {
    if (!(FIX_KINDS as readonly string[]).includes(fix.kind)) problems.push(`fix "${fix.message}": kind must be ${FIX_KINDS.join(" or ")}`);
    if (!fix.message.startsWith(`${fix.kind}(map): `) || fix.message.length <= `${fix.kind}(map): `.length) problems.push(`fix "${fix.message}": the message must be "${fix.kind}(map): <what>"`);
    if (fix.files.length === 0) problems.push(`fix "${fix.message}": no files`);
    for (const file of fix.files) {
      if ((CONTENT_FILES as readonly string[]).includes(file)) problems.push(`fix "${fix.message}": ${file} is a content file`);
      else if (!(fix.kind === "test" ? TEST_FILE : new RegExp(`${TEST_FILE.source}|${TOOLING_FILE.source}`)).test(file)) {
        problems.push(`fix "${fix.message}": ${file} is outside what a ${fix.kind}(map) fix may change (${fix.kind === "test" ? "test files" : "tests and authoring tooling"})`);
      }
      if (owners.has(file)) problems.push(`${file} belongs to two fixes: "${owners.get(file)}" and "${fix.message}"`);
      owners.set(file, fix.message);
    }
  }
  if (changedLines > MAX_FIX_LINES) problems.push(`declared fixes change ${changedLines} lines (limit ${MAX_FIX_LINES}): materially larger than a domain run's general fix`);
  return problems;
}

type ViewNode = { placementId: string; hasContent: boolean; children: readonly ViewNode[] } & Record<string, unknown>;
type View = { roots: readonly ViewNode[] };
type FileDiff = { added: readonly string[]; deleted: number };

export type DiffInput = {
  base: MapKnowledgeModel;
  head: MapKnowledgeModel;
  baseView: View;
  headView: View;
  baseRegistry: readonly string[];
  headRegistry: readonly string[];
  /** Files that differ from the base: tracked changes, plus untracked files a fix declares. */
  changedFiles: readonly string[];
  /** Lines added to and deleted from data.ts relative to the base. */
  data: FileDiff;
  /** Lines added to and deleted from the registry relative to the base. */
  registry: FileDiff;
  /** Concepts the run recorded as authored. */
  expectedConcepts: readonly string[];
  fixes: readonly DeclaredFix[];
  /** Added plus deleted lines across the declared fixes' files. */
  fixLines: number;
};

export type DiffReport = {
  ok: boolean;
  problems: string[];
  addedConcepts: string[];
  registryAdded: string[];
  /** Placements whose hasContent flag flipped from false to true. */
  flipped: string[];
};

const sorted = (values: Iterable<string>) => [...values].sort();
const same = (a: Iterable<string>, b: Iterable<string>) => JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));
const duplicates = (values: readonly string[]) => [...new Set(values.filter((value, index) => values.indexOf(value) !== index))];
/** Paths that belong to the local machine, never to a commit. */
const LOCAL_ONLY = /^(\.worktrees|\.map-authoring)\//;
const REGISTRY_ENTRY = /^\s*"([a-z0-9-]+)",\s*$/;
/** Lines that would add code rather than content records to data.ts. */
const DATA_CODE = /^\s*(export|import|const|let|var|function|class|async)\b/;

/** Every node in traversal order, each with its own fields and its children's ids. */
function flatten(view: View): Map<string, string> {
  const nodes = new Map<string, string>();
  const visit = (node: ViewNode) => {
    nodes.set(node.placementId, JSON.stringify({ ...node, children: node.children.map((child) => child.placementId) }));
    node.children.forEach(visit);
  };
  view.roots.forEach(visit);
  return nodes;
}

export function validateContentDiff(input: DiffInput): DiffReport {
  const problems: string[] = [...validateFixes(input.fixes, input.fixLines)];
  const fixFiles = input.fixes.flatMap((fix) => fix.files);
  const allowed = new Set<string>([...CONTENT_FILES, ...fixFiles]);
  for (const file of input.changedFiles) {
    if (LOCAL_ONLY.test(file)) problems.push(`local-only path in the diff: ${file}`);
    else if (!allowed.has(file)) problems.push(`unexpected changed file: ${file}`);
  }
  const unchangedFixFiles = fixFiles.filter((file) => !input.changedFiles.includes(file));
  if (unchangedFixFiles.length) problems.push(`declared fix files without changes: ${unchangedFixFiles.join(", ")}`);
  if (input.data.deleted > 0) problems.push(`data.ts deletes ${input.data.deleted} line(s); a content run only adds`);
  const code = input.data.added.filter((line) => DATA_CODE.test(line));
  if (code.length) problems.push(`data.ts adds code, not content records: ${code.map((line) => line.trim()).join(" | ")}`);
  if (input.registry.deleted > 0) problems.push(`the registry file deletes ${input.registry.deleted} line(s)`);
  const registryLines = input.registry.added.filter((line) => line.trim() !== "");
  const strayRegistryLines = registryLines.filter((line) => !REGISTRY_ENTRY.test(line));
  if (strayRegistryLines.length) problems.push(`the registry file adds lines that are not entries: ${strayRegistryLines.map((line) => line.trim()).join(" | ")}`);

  const headIds = input.head.content.map((record) => record.conceptId);
  if (duplicates(headIds).length) problems.push(`several content records for: ${duplicates(headIds).join(", ")}`);
  if (duplicates(input.head.content.map((record) => record.id)).length) problems.push(`duplicate content record ids: ${duplicates(input.head.content.map((record) => record.id)).join(", ")}`);
  const baseContent = new Map(input.base.content.map((record) => [record.conceptId, JSON.stringify(record)]));
  const headContent = new Map(input.head.content.map((record) => [record.conceptId, JSON.stringify(record)]));
  for (const [conceptId, record] of baseContent) {
    if (!headContent.has(conceptId)) problems.push(`existing content removed: ${conceptId}`);
    else if (headContent.get(conceptId) !== record) problems.push(`existing content changed: ${conceptId}`);
  }
  const addedConcepts = [...headContent.keys()].filter((conceptId) => !baseContent.has(conceptId));
  if (!same(addedConcepts, input.expectedConcepts)) {
    problems.push(`added content ${JSON.stringify(sorted(addedConcepts))} differs from the run's authored concepts ${JSON.stringify(sorted(input.expectedConcepts))}`);
  }

  for (const key of ["concepts", "placements", "relationships", "mechanisms", "knowledgePaths"] as const) {
    if (JSON.stringify(input.base[key]) !== JSON.stringify(input.head[key])) problems.push(`${key} changed; a content run changes none`);
  }

  const baseRegistry = new Set(input.baseRegistry);
  const registryRemoved = input.baseRegistry.filter((conceptId) => !input.headRegistry.includes(conceptId));
  const registryAdded = input.headRegistry.filter((conceptId) => !baseRegistry.has(conceptId));
  if (registryRemoved.length > 0) problems.push(`registry entries removed: ${registryRemoved.join(", ")}`);
  if (duplicates(input.headRegistry).length) problems.push(`duplicate registry entries: ${duplicates(input.headRegistry).join(", ")}`);
  if (!same(registryAdded, input.expectedConcepts)) problems.push(`registry additions ${JSON.stringify(sorted(registryAdded))} differ from the run's authored concepts`);

  const baseNodes = flatten(input.baseView);
  const headNodes = flatten(input.headView);
  if (JSON.stringify([...baseNodes.keys()]) !== JSON.stringify([...headNodes.keys()])) problems.push("generated view placements or their order changed");
  const flipped: string[] = [];
  for (const [placementId, head] of headNodes) {
    const base = baseNodes.get(placementId);
    if (base === undefined || base === head) continue;
    const before = JSON.parse(base) as ViewNode;
    const after = JSON.parse(head) as ViewNode;
    if (before.hasContent || !after.hasContent || JSON.stringify({ ...before, hasContent: true }) !== head) {
      problems.push(`generated view changed beyond a hasContent flip at ${placementId}`);
    } else {
      flipped.push(placementId);
    }
  }
  const expectedFlips = input.head.placements
    .filter((placement) => input.expectedConcepts.includes(placement.conceptId) && baseNodes.has(placement.id) && !(JSON.parse(baseNodes.get(placement.id)!) as ViewNode).hasContent)
    .map((placement) => placement.id);
  if (!same(flipped, expectedFlips)) {
    problems.push(`hasContent flips ${JSON.stringify(sorted(flipped))} differ from every placement of the authored concepts ${JSON.stringify(sorted(expectedFlips))}`);
  }
  return { ok: problems.length === 0, problems, addedConcepts, registryAdded, flipped: sorted(flipped) };
}
