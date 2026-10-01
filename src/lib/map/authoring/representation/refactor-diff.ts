/**
 * The diff boundary for a future representation refactor run
 * (docs/map-authoring/representation-design.md#refactor-mode). Designed and
 * tested ahead of use; no run applies it yet. Pure.
 *
 * A refactor run changes existing records only: those of concepts whose
 * recorded design classifies them for improvement and still matches the
 * content it judged. Nothing is added or removed, the registry and taxonomy
 * are untouched, and since every changed concept keeps its content, the
 * generated explorer view must not change at all.
 */
import type { MapKnowledgeModel } from "../../types.ts";
import { contentFingerprint, type StoredDesign } from "./design.ts";

export type RefactorDiffInput = {
  base: MapKnowledgeModel;
  head: MapKnowledgeModel;
  baseRegistry: readonly string[];
  headRegistry: readonly string[];
  baseView: unknown;
  headView: unknown;
  /** Designs the run applies: accepted, for concepts in its scope. */
  designs: readonly StoredDesign[];
  changedFiles: readonly string[];
};

export type RefactorDiffReport = { ok: boolean; problems: string[]; changed: string[] };

const ALLOWED_FILES = new Set(["src/lib/map/data.ts"]);

export function validateRefactorDiff(input: RefactorDiffInput): RefactorDiffReport {
  const problems: string[] = [];
  for (const file of input.changedFiles) if (!ALLOWED_FILES.has(file)) problems.push(`unexpected changed file: ${file}`);
  const base = new Map(input.base.content.map((record) => [record.conceptId, record]));
  const head = new Map(input.head.content.map((record) => [record.conceptId, record]));
  for (const conceptId of base.keys()) if (!head.has(conceptId)) problems.push(`content removed: ${conceptId}`);
  for (const conceptId of head.keys()) if (!base.has(conceptId)) problems.push(`content added: ${conceptId}; a refactor only changes existing records`);
  for (const record of input.head.content) if (record.id !== `${record.conceptId}-content`) problems.push(`content id changed: ${record.id}`);

  const allowed = new Map<string, StoredDesign>();
  for (const design of input.designs) {
    if (design.classification === "keep") continue;
    if (design.contentFingerprint !== contentFingerprint(base.get(design.conceptId))) {
      problems.push(`${design.conceptId}: its design judged different content than the base; analyse it again before refactoring`);
      continue;
    }
    allowed.set(design.conceptId, design);
  }
  const changed = [...head.keys()].filter((conceptId) => base.has(conceptId) && JSON.stringify(base.get(conceptId)) !== JSON.stringify(head.get(conceptId)));
  for (const conceptId of changed) if (!allowed.has(conceptId)) problems.push(`${conceptId} changed without an accepted improvement design`);

  if (JSON.stringify([...input.baseRegistry].sort()) !== JSON.stringify([...input.headRegistry].sort())) problems.push("the content registry changed");
  for (const key of ["concepts", "placements", "relationships", "mechanisms", "knowledgePaths"] as const) {
    if (JSON.stringify(input.base[key]) !== JSON.stringify(input.head[key])) problems.push(`${key} changed; a refactor changes none`);
  }
  if (JSON.stringify(input.baseView) !== JSON.stringify(input.headView)) problems.push("the generated explorer view changed; refactoring existing content flips no hasContent flag");
  return { ok: problems.length === 0, problems, changed: changed.sort() };
}
