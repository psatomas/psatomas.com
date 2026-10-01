/**
 * The diff boundary of a representation refactor run
 * (docs/map-authoring/representation-design.md#refactor-mode), checked by
 * `map:author -- refactor run` before anything is committed. Pure.
 *
 * What may change is derived, never supplied: the run's accepted actionable
 * designs and the decision recorded for each. A record changes only when its
 * decision is execute or reduce, and only within its design; every other
 * record, including KEEP concepts, kept designs and blocked designs, is
 * byte-identical. Nothing is added or removed, the registry, taxonomy and
 * generated view are untouched, and the spec changes only by resolving this
 * run's designs. Declared general fixes are the one other file class.
 */
import type { MapKnowledgeModel } from "../../types.ts";
import { validateFixes, type DeclaredFix } from "../orchestrator/diff-check.ts";
import { contentFingerprint } from "./design.ts";
import { ACCEPTED_DESIGNS_FILE, decisionProblems, resolveSpec, specDiffProblems, type AcceptedDesign, type AcceptedDesignSpec, type Decision } from "./refactor.ts";

export const REFACTOR_CONTENT_FILES = ["src/lib/map/data.ts", ACCEPTED_DESIGNS_FILE] as const;
const LOCAL_ONLY = /^(\.worktrees|\.map-authoring)\//;

export type RefactorDiffInput = {
  base: MapKnowledgeModel;
  head: MapKnowledgeModel;
  baseRegistry: readonly string[];
  headRegistry: readonly string[];
  baseView: unknown;
  headView: unknown;
  baseSpec: AcceptedDesignSpec;
  headSpec: AcceptedDesignSpec;
  /** The run's actionable designs, as accepted on the base. */
  designs: readonly AcceptedDesign[];
  /** The decision recorded for each of them. */
  decisions: Readonly<Record<string, Decision>>;
  changedFiles: readonly string[];
  fixes?: readonly DeclaredFix[];
  fixLines?: number;
};

export type RefactorDiffReport = { ok: boolean; problems: string[]; changed: string[]; kept: string[] };

export function validateRefactorDiff(input: RefactorDiffInput): RefactorDiffReport {
  const problems: string[] = [...validateFixes(input.fixes ?? [], input.fixLines ?? 0)];
  const fixFiles = (input.fixes ?? []).flatMap((fix) => fix.files);
  for (const file of input.changedFiles) {
    if (LOCAL_ONLY.test(file)) problems.push(`local-only path in the diff: ${file}`);
    else if (!(REFACTOR_CONTENT_FILES as readonly string[]).includes(file) && !fixFiles.includes(file)) problems.push(`unexpected changed file: ${file}`);
  }

  const base = new Map(input.base.content.map((record) => [record.conceptId, record]));
  const head = new Map(input.head.content.map((record) => [record.conceptId, record]));
  for (const conceptId of base.keys()) if (!head.has(conceptId)) problems.push(`content removed: ${conceptId}`);
  for (const conceptId of head.keys()) if (!base.has(conceptId)) problems.push(`content added: ${conceptId}; a refactor only changes existing records`);
  for (const record of input.head.content) if (record.id !== `${record.conceptId}-content`) problems.push(`content id changed: ${record.id}`);

  const designs = new Map(input.designs.map((design) => [design.conceptId, design]));
  for (const conceptId of designs.keys()) if (!input.decisions[conceptId]) problems.push(`${conceptId}: no decision recorded`);
  for (const conceptId of Object.keys(input.decisions)) if (!designs.has(conceptId)) problems.push(`${conceptId}: a decision without an accepted actionable design in this run`);
  const changed = [...head.keys()].filter((conceptId) => base.has(conceptId) && contentFingerprint(base.get(conceptId)) !== contentFingerprint(head.get(conceptId))).sort();
  for (const conceptId of changed) {
    const decision = input.decisions[conceptId];
    if (!designs.has(conceptId)) problems.push(`${conceptId} changed without an accepted actionable design in this run (KEEP, blocked or another domain's concept)`);
    else if (decision === "keep") problems.push(`${conceptId} changed although it was reconsidered as keep`);
  }
  for (const [conceptId, design] of designs) {
    const decision = input.decisions[conceptId];
    if (decision) problems.push(...decisionProblems(design, base.get(conceptId), head.get(conceptId), decision));
  }

  if (JSON.stringify([...input.baseRegistry].sort()) !== JSON.stringify([...input.headRegistry].sort())) problems.push("the content registry changed");
  for (const key of ["concepts", "placements", "relationships", "mechanisms", "knowledgePaths"] as const) {
    if (JSON.stringify(input.base[key]) !== JSON.stringify(input.head[key])) problems.push(`${key} changed; a refactor changes none`);
  }
  if (JSON.stringify(input.baseView) !== JSON.stringify(input.headView)) problems.push("the generated explorer view changed; refactoring existing content flips no hasContent flag");

  const decided = Object.keys(input.decisions);
  problems.push(...specDiffProblems(input.baseSpec, input.headSpec, decided));
  const notes = Object.fromEntries(input.headSpec.designs.filter((design) => decided.includes(design.conceptId)).map((design) => [design.conceptId, { decision: input.decisions[design.conceptId], note: design.resolution?.note ?? "" }]));
  if (JSON.stringify(resolveSpec(input.baseSpec, notes, input.head)) !== JSON.stringify(input.headSpec)) {
    problems.push("the spec's resolutions do not match the recorded decisions and the resulting records");
  }
  return { ok: problems.length === 0, problems, changed, kept: decided.filter((conceptId) => input.decisions[conceptId] === "keep").sort() };
}
