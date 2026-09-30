/**
 * Plain-text rendering of MAP authoring contexts for `npm run map:inspect`.
 * Formatting only: every fact comes from ./context.ts, and the output is a
 * deterministic function of it.
 */
import type {
  MapAuthoringPlacementContext,
  MapAuthoringPlacementRef,
  MapConceptAuthoringContext,
  MapDomainAuthoringStatus,
} from "./context.ts";

const INDENT = "    ";

function refList(refs: readonly (MapAuthoringPlacementRef & { conceptPlacementCount?: number })[], current?: string): string[] {
  const width = Math.max(0, ...refs.map((entry) => entry.placementId.length));
  return refs.map((entry) => {
    const flags = [
      entry.conceptId !== entry.placementId ? `concept ${entry.conceptId}` : undefined,
      entry.hasContent ? "has content" : undefined,
      entry.conceptPlacementCount && entry.conceptPlacementCount > 1 ? `${entry.conceptPlacementCount} placements` : undefined,
    ].filter(Boolean);
    const marker = entry.placementId === current ? "> " : "  ";
    return `${marker}${entry.placementId.padEnd(width)}  ${entry.label}${flags.length ? `  [${flags.join("; ")}]` : ""}`;
  });
}

const trailText = (context: MapAuthoringPlacementContext) =>
  `${context.domainOrdinal} ${context.trail.map((step) => step.label).join(" / ")}`;

function placementBlock(context: MapAuthoringPlacementContext): string[] {
  const roles = [context.isPrimary ? "primary authoring context" : "also served", context.isPreferred ? "preferred" : undefined]
    .filter(Boolean)
    .join(", ");
  const lines = [`${context.level}  ${context.placementId}  (${roles})`, `${INDENT}trail:    ${trailText(context)}`];
  if (context.contextualLabel) lines.push(`${INDENT}label:    "${context.contextualLabel}" (contextual; concept title "${context.title}")`);
  if (context.contextualNote) lines.push(`${INDENT}note:     ${context.contextualNote}`);
  lines.push(`${INDENT}domain:   ${context.domain.label} (${context.domain.placementId})`);
  lines.push(
    context.parent
      ? `${INDENT}parent:   ${context.parent.label} (${context.parent.placementId}${context.parent.conceptId !== context.parent.placementId ? `, concept ${context.parent.conceptId}` : ""}) — ${context.parent.hasContent ? "has content" : "no content"}`
      : `${INDENT}parent:   none (root placement)`,
  );
  lines.push(`${INDENT}siblings (${context.siblings.length}, in order; > marks this placement):`);
  lines.push(...refList(context.siblings, context.placementId).map((line) => INDENT + INDENT + line));
  if (context.children.length === 0) lines.push(`${INDENT}children: none (leaf)`);
  else {
    lines.push(`${INDENT}children (${context.children.length}, in order):`);
    lines.push(...refList(context.children).map((line) => INDENT + INDENT + line));
  }
  return lines;
}

function authoringConstraints(context: MapConceptAuthoringContext): string[] {
  const placements = context.placements.length;
  return [
    `Content is one record in mapKnowledge.content (src/lib/map/data.ts): { id: "${context.concept.id}-content", conceptId: "${context.concept.id}", definition, body? }.`,
    `Register "${context.concept.id}" in CONTENT_CONCEPTS (src/lib/map/map.test.ts) when its exposition is intentionally authored.`,
    `The exposition opens at every placement listed above (${placements}); it is canonical, not placement-specific.`,
    "The definition leads; body blocks are paragraph, heading, flow, distinction, tensions and terms. Use only the blocks the explanation needs.",
    "All text is plain: no HTML, markdown or line breaks. Strings within one terms strip, distinction chain, tension list or flow stage/branch must be unique.",
    "Flows need at least two stages, never two parallel sets in a row, a branch only inside a parallel set, and at most six parallel elements.",
    "Terms strips need at least two terms; they are plain vocabulary, not navigation.",
    "Adding or removing content flips hasContent: run npm run map:generate, then the gates in docs/map-authoring/authoring-workflow.md.",
  ];
}

export function formatMapConceptAuthoringContext(context: MapConceptAuthoringContext): string {
  const lines: string[] = [];
  const kinds = Object.entries(context.content.blockKinds)
    .map(([kind, count]) => `${kind} ${count}`)
    .join(", ");
  lines.push(`MAP authoring context: ${context.concept.title} (${context.concept.id})`);
  lines.push("");
  lines.push(`Canonical content:  ${context.content.exists ? `${context.content.contentId}${kinds ? ` (body: ${kinds})` : " (definition only, no body)"}` : "none"}`);
  lines.push(`Placements:         ${context.placements.length} at ${context.levels.join(", ") || "no level"}`);
  lines.push(`Preferred:          ${context.preferredPlacementId ?? (context.placements.length ? "none declared (single placement)" : "none")}`);
  lines.push(
    `Primary context:    ${context.primaryPlacementId ?? "none"}${
      context.primarySource === "explicit" ? " (selected with --context)" : context.primarySource === "preferred" ? " (preferred-placement policy)" : ""
    }`,
  );

  lines.push("", "Attention");
  lines.push(...(context.attention.length ? context.attention.map((note) => `  - ${note}`) : ["  - none"]));

  lines.push("", `Placements (${context.placements.length})`);
  for (const placement of context.placements) lines.push("", ...placementBlock(placement).map((line) => `  ${line}`));

  const primary = context.placements.find((placement) => placement.isPrimary);
  lines.push("", "Parent exposition around the primary context");
  if (!primary?.parent) lines.push("  none (root placement or no placement)");
  else if (!primary.parent.hasContent) lines.push(`  ${primary.parent.label} (${primary.parent.conceptId}) has no exposition.`);
  else if (primary.parent.section) {
    lines.push(`  ${primary.parent.label}, section ${primary.parent.section.index + 1}${primary.parent.section.heading ? ` "${primary.parent.section.heading}"` : " (before the first heading)"}:`);
    lines.push(...primary.parent.section.lines.map((line) => `${INDENT}${line}`));
  } else {
    lines.push(`  No single section of ${primary.parent.label}'s exposition was located. Its headings:`);
    lines.push(...primary.parent.headings.map((heading) => `${INDENT}## ${heading}`));
  }

  lines.push("", "Existing canonical exposition");
  lines.push(...(context.content.exists ? context.content.lines.map((line) => `${INDENT}${line}`) : ["  none"]));

  lines.push("", "Relationships");
  lines.push(
    ...(context.relationships.length
      ? context.relationships.map((relation) => `  - ${context.concept.title} ${relation.label} ${relation.title} (${relation.conceptId}; ${relation.id})`)
      : ["  none"]),
  );
  lines.push("", "Mechanisms and knowledge paths");
  const references = [
    ...context.mechanisms.map((mechanism) => `  - mechanism ${mechanism.id} "${mechanism.title}" (${mechanism.role})`),
    ...context.knowledgePaths.map((path) => `  - path ${path.id} "${path.title}"`),
  ];
  lines.push(...(references.length ? references : ["  none"]));

  lines.push("", "Authoring constraints");
  lines.push(...authoringConstraints(context).map((constraint) => `  - ${constraint}`));
  return `${lines.join("\n")}\n`;
}

export function formatMapDomainAuthoringStatus(status: MapDomainAuthoringStatus): string {
  const authored = status.l1.filter((entry) => entry.hasContent).length;
  const width = Math.max(...status.l1.map((entry) => entry.placementId.length));
  const lines = [
    `MAP authoring status: ${status.domainOrdinal} ${status.domain.label} (${status.domain.placementId}) — domain exposition: ${status.domain.hasContent ? "yes" : "no"}`,
    `L1 topics with canonical content: ${authored} of ${status.l1.length}`,
    "",
    ...status.l1.map((entry, index) => {
      const flags = [
        entry.conceptId !== entry.placementId ? `concept ${entry.conceptId}` : undefined,
        entry.levels.length > 1 ? `also ${entry.levels.filter((level) => level !== "L1").join("/")}` : undefined,
        entry.conceptPlacementCount > 1 ? `${entry.conceptPlacementCount} placements` : undefined,
        entry.preferredElsewhere ? `preferred at ${entry.preferredElsewhere}` : undefined,
      ].filter(Boolean);
      return `  ${String(index + 1).padStart(2)}. ${entry.hasContent ? "[content]" : "[ -     ]"} ${entry.placementId.padEnd(width)}  ${entry.label}  (children ${entry.childrenWithContent}/${entry.childCount} with content${flags.length ? `; ${flags.join("; ")}` : ""})`;
    }),
  ];
  return `${lines.join("\n")}\n`;
}
