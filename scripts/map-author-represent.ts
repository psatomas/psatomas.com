// `map:author -- represent ...`: the read-only representation audit
// (docs/map-authoring/representation-design.md). Analysis and design come
// first, then the audit reports them. Nothing here creates a branch, edits
// content, commits, pushes, opens a PR, merges or deploys: every command
// snapshots HEAD, the branch and the content files before it runs and fails
// if any of them differs afterwards. Designs are local state under
// .map-authoring/representation/ (git-ignored).
//
//   represent catalog                                   structures and what the content model can express
//   represent context <concept-id>                      analysis inputs for one concept
//   represent record [<concept-id>] --file <design.json> validate designs (one, or an array) and store them against the current content
//   represent audit [--concept <id> | --domain <id>] [--json] [--report <file.md>]
//   represent export-accepted                           write the audit's improvement designs as the
//                                                       repository-owned spec (refactor runs read it)
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { mapKnowledge } from "../src/lib/map/data.ts";
import { createMapAuthoringInspector } from "../src/lib/map/authoring/context.ts";
import { formatMapConceptAuthoringContext } from "../src/lib/map/authoring/format.ts";
import { CONTENT_FILES } from "../src/lib/map/authoring/orchestrator/diff-check.ts";
import { REPRESENTATION_CATALOG } from "../src/lib/map/authoring/representation/catalog.ts";
import { ACCEPTED_DESIGNS_FILE, exportAcceptedDesigns, specProblems, type AcceptedDesignSpec } from "../src/lib/map/authoring/representation/refactor.ts";
import { emptyStore, placementsOf, profileOf, recordDesign, type DesignStore, type RepresentationDesign } from "../src/lib/map/authoring/representation/design.ts";
import { acceptedContentProblems, aggregate, auditRepresentation, conceptsAtLevel, mutations, usageOf, type ConceptAuditEntry, type RepositorySnapshot } from "../src/lib/map/authoring/representation/audit.ts";

const ROOT = new URL("..", import.meta.url).pathname;
const STORE_DIR = join(ROOT, ".map-authoring", "representation");

function git(...args: string[]): string {
  const result = spawnSync("git", args, { cwd: ROOT, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
  return result.stdout.trim();
}

function snapshot(): RepositorySnapshot {
  return {
    head: git("rev-parse", "HEAD"),
    branch: git("rev-parse", "--abbrev-ref", "HEAD"),
    contentFiles: Object.fromEntries(CONTENT_FILES.map((file) => [file, createHash("sha256").update(readFileSync(join(ROOT, file))).digest("hex")])),
  };
}

const storePath = (domainId: string) => join(STORE_DIR, `${domainId}.json`);
function readStores(): DesignStore[] {
  if (!existsSync(STORE_DIR)) return [];
  return readdirSync(STORE_DIR)
    .filter((file) => file.endsWith(".json"))
    .map((file) => {
      const store = JSON.parse(readFileSync(join(STORE_DIR, file), "utf8")) as DesignStore;
      if (store.version !== 1 || `${store.domainId}.json` !== file) throw new Error(`${file} is not a version-1 design store for its domain; inspect it`);
      return store;
    });
}

/** The placement whose context an analysis starts from: the concept's own child layer if it has one. */
function primaryPlacement(conceptId: string): string | undefined {
  const context = createMapAuthoringInspector(mapKnowledge).inspectConcept(conceptId);
  const carriers = context.childLayers.carriers;
  return (carriers.find((carrier) => carrier.isPreferred) ?? carriers[0])?.placementId;
}

function commandCatalog() {
  for (const entry of REPRESENTATION_CATALOG) {
    console.log(`${entry.structure.padEnd(13)} ${entry.fit.padEnd(11)} ${(entry.block ?? "-").padEnd(12)} ${entry.expresses}${entry.limits ? ` (limit: ${entry.limits})` : ""}`);
  }
}

function commandContext(conceptId: string) {
  const record = mapKnowledge.content.find((candidate) => candidate.conceptId === conceptId);
  if (!record) throw new Error(`${conceptId} has no content to analyse`);
  const facts = placementsOf(mapKnowledge, conceptId);
  const profile = profileOf(record);
  const stored = readStores().find((store) => store.domainId === facts.ownerDomainId)?.designs[conceptId];
  const placement = primaryPlacement(conceptId);
  process.stdout.write(formatMapConceptAuthoringContext(createMapAuthoringInspector(mapKnowledge).inspectConcept(conceptId, placement ? { contextPlacementId: placement } : {})));
  console.log(
    [
      "",
      "Representation",
      `  current: ${profile.sequence}, ${profile.words} words, ${profile.proseOnly ? "prose only" : `structured: ${profile.structured.join(", ")}`}`,
      `  owner: ${facts.ownerDomainId}; placements: ${facts.placements.map((entry) => `${entry.placementId} (${entry.level})`).join(", ")}${facts.carriers > 1 ? `; ${facts.carriers} child-carrying placements (facet note required)` : ""}`,
      `  design: ${stored ? `${stored.classification}, recorded ${stored.recordedAt}` : "none"}`,
      "",
      "Analyse the concept into a model, then decide its representation (`represent catalog`); prose-only is valid when prose communicates it best.",
    ].join("\n"),
  );
}

function commandRecord(conceptId: string | undefined, file: string) {
  const problems = acceptedContentProblems(git("status", "--porcelain", "--untracked-files=no").split("\n").map((line) => line.slice(3)).filter(Boolean), [...CONTENT_FILES]);
  if (problems.length) throw new Error(problems.join("\n"));
  const parsed = JSON.parse(readFileSync(file, "utf8")) as RepresentationDesign | RepresentationDesign[];
  // A batch is validated in full before anything is stored.
  const designs = Array.isArray(parsed) ? parsed : [parsed];
  if (conceptId && (designs.length !== 1 || designs[0].conceptId !== conceptId)) throw new Error(`${file} is not a single design for ${conceptId}`);
  const failures: string[] = [];
  for (const design of designs) {
    try {
      recordOne(design, new Date().toISOString(), true);
    } catch (error) {
      failures.push((error as Error).message);
    }
  }
  if (failures.length) throw new Error(`nothing recorded:\n${failures.join("\n")}`);
  for (const design of designs) recordOne(design, new Date().toISOString(), false);
}

function recordOne(design: RepresentationDesign, now: string, dryRun: boolean) {
  const conceptId = design.conceptId;
  const record = mapKnowledge.content.find((candidate) => candidate.conceptId === conceptId);
  const facts = placementsOf(mapKnowledge, conceptId);
  if (!conceptsAtLevel(mapKnowledge, 1).includes(conceptId)) throw new Error(`${conceptId} is not an L1 concept with content`);
  const store = readStores().find((candidate) => candidate.domainId === facts.ownerDomainId) ?? emptyStore(facts.ownerDomainId);
  const updated = recordDesign(store, design, record, facts, now);
  if (dryRun) return;
  mkdirSync(STORE_DIR, { recursive: true });
  writeFileSync(storePath(store.domainId), `${JSON.stringify(updated, null, 2)}\n`);
  console.log(`recorded ${conceptId}: ${design.classification} (${facts.ownerDomainId})`);
}

const count = (map: Record<string, number | undefined>) =>
  Object.entries(map)
    .filter(([, value]) => value)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    .map(([key, value]) => `${key} ${value}`)
    .join(", ") || "none";

function entryLines(entry: ConceptAuditEntry): string[] {
  const design = entry.design;
  const head = `${entry.conceptId} — ${entry.status === "designed" ? design!.classification.toUpperCase() : entry.status.toUpperCase()}`;
  const lines = [
    `### ${head}`,
    `- current: ${entry.current.sequence}, ${entry.current.words} words, ${entry.current.proseOnly ? "prose only" : entry.current.structured.join(", ")}`,
    `- placements: ${entry.facts.placements.map((placement) => `${placement.placementId} (${placement.level}, ${placement.domainId})`).join("; ")}`,
  ];
  for (const problem of entry.problems) lines.push(`- problem: ${problem}`);
  if (!design) return lines;
  const model = design.model;
  const modelLines = Object.entries(model)
    .filter(([key]) => key !== "purpose")
    .map(([key, value]) => `  - ${key}: ${Array.isArray(value) ? value.join("; ") : value}`);
  lines.push(`- model: ${model.purpose}`, ...modelLines);
  lines.push(`- recommended: ${design.representation.map((choice) => `${choice.structure} (${choice.purpose})`).join("; ")}`);
  lines.push(`- reasoning: ${design.reasoning}`);
  if (design.rewriteJustification) lines.push(`- rewrite justification: ${design.rewriteJustification}`);
  if (design.canonicalNote) lines.push(`- across placements: ${design.canonicalNote}`);
  if (design.facetNote) lines.push(`- facets: ${design.facetNote}`);
  lines.push(`- new capability needed: ${entry.capabilityGaps.join(", ") || "none"}`);
  return lines;
}

function commandAudit(scope: { conceptId: string } | { domainId: string } | { all: true }, json: boolean, report?: string) {
  const entries = auditRepresentation(mapKnowledge, readStores(), scope);
  const totals = aggregate(entries);
  if (json) return console.log(JSON.stringify({ aggregate: totals, entries }, null, 2));
  const roots = mapKnowledge.placements.filter((placement) => !placement.parentPlacementId).sort((a, b) => a.order - b.order);
  const lines: string[] = ["# MAP L1 representation audit", "", "Read-only. Counts describe the corpus; they are not targets.", ""];
  if (!("conceptId" in scope)) {
    const l0 = usageOf(mapKnowledge, roots.map((root) => root.conceptId));
    const l1 = usageOf(mapKnowledge, entries.map((entry) => entry.conceptId));
    lines.push("## Usage", "", `- L0: ${l0.records} records, ${l0.proseOnly} prose-only; blocks: ${count(l0.kinds)}`, `- L1 in scope: ${l1.records} records, ${l1.proseOnly} prose-only; records using: ${count(l1.recordsUsing)}`, "");
    lines.push("## Decisions", "", `- status: ${count(totals.status)}`, `- classification: ${count(totals.classification)}`, `- recommended structures (concepts using each): ${count(totals.recommended)}`, `- capability gaps (concepts needing each): ${count(totals.capabilityGaps)}`, "");
    lines.push("## By domain", "", "| Domain | L1 | prose-only now | keep | refactor | enhance | rewrite | pending/stale/invalid |", "|---|---|---|---|---|---|---|---|");
    for (const root of roots) {
      const own = entries.filter((entry) => entry.facts.ownerDomainId === root.id);
      if (!own.length) continue;
      const agg = aggregate(own);
      const c = agg.classification;
      lines.push(`| ${root.conceptId} | ${own.length} | ${own.filter((entry) => entry.current.proseOnly).length} | ${c.keep ?? 0} | ${c.refactor ?? 0} | ${c.enhance ?? 0} | ${c.rewrite ?? 0} | ${(agg.status.pending ?? 0) + (agg.status.stale ?? 0) + (agg.status.invalid ?? 0)} |`);
    }
    lines.push("");
  }
  lines.push("## Concepts", "");
  for (const entry of entries) lines.push(...entryLines(entry), "");
  const text = lines.join("\n");
  if (report) {
    // The report is local output, never inside the repository's tracked tree.
    if (!report.startsWith("/") || report.startsWith(ROOT) && !report.startsWith(join(ROOT, ".map-authoring"))) throw new Error("--report must be an absolute path outside the tracked tree (e.g. under .map-authoring/)");
    writeFileSync(report, `${text}\n`);
    console.log(`wrote ${report}: ${count(totals.status)}; ${count(totals.classification)}`);
  } else console.log(text);
}

/**
 * Writes the audit's improvement designs as the accepted-design spec. Content
 * files are untouched; the spec is the one file written, and it is reviewed
 * and accepted by merging. A spec that already records resolutions is never
 * overwritten: a refactor campaign's history is not regenerated.
 */
function commandExportAccepted() {
  const target = join(ROOT, ACCEPTED_DESIGNS_FILE);
  if (existsSync(target)) {
    const existing = JSON.parse(readFileSync(target, "utf8")) as AcceptedDesignSpec;
    if (existing.designs.some((design) => design.resolution)) throw new Error(`${ACCEPTED_DESIGNS_FILE} records resolutions from refactor runs; it is not regenerated`);
  }
  const stores = readStores();
  const spec = exportAcceptedDesigns(stores, mapKnowledge);
  const problems = specProblems(spec, mapKnowledge);
  const designed = stores.reduce((sum, store) => sum + Object.keys(store.designs).length, 0);
  const expected = conceptsAtLevel(mapKnowledge, 1).length;
  if (designed !== expected) problems.push(`the local audit designs ${designed} concepts, the L1 corpus has ${expected}; finish the audit first`);
  if (problems.length) throw new Error(`not exported:\n  ${problems.join("\n  ")}`);
  writeFileSync(target, `${JSON.stringify(spec, null, 2)}\n`);
  const blocked = spec.designs.filter((design) => design.status === "blocked").length;
  console.log(`wrote ${ACCEPTED_DESIGNS_FILE}: ${spec.designs.length - blocked} actionable, ${blocked} blocked; every other L1 concept is KEEP`);
}

export function commandRepresent(positional: readonly string[], flag: (name: string) => string | undefined, has: (name: string) => boolean) {
  const before = snapshot();
  const [sub, conceptId] = positional;
  switch (sub) {
    case "catalog":
      commandCatalog();
      break;
    case "context":
      commandContext(conceptId ?? fail("represent context needs a concept id"));
      break;
    case "record":
      commandRecord(conceptId, flag("--file") ?? fail("represent record needs --file <design.json>"));
      break;
    case "export-accepted":
      commandExportAccepted();
      break;
    case "audit": {
      const concept = flag("--concept");
      const domain = flag("--domain");
      commandAudit(concept ? { conceptId: concept } : domain ? { domainId: domain } : { all: true }, has("--json"), flag("--report"));
      break;
    }
    default:
      fail(`unknown represent command ${sub ?? "(none)"}; see the header of scripts/map-author-represent.ts`);
  }
  const changed = mutations(before, snapshot());
  if (changed.length) throw new Error(`the representation audit must be read-only, but: ${changed.join("; ")}`);
}

function fail(message: string): never {
  throw new Error(message);
}
