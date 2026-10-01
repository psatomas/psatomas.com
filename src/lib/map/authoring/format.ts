/**
 * Plain-text rendering of MAP authoring contexts for `npm run map:inspect`.
 * Formatting only: every fact comes from ./context.ts, and the output is a
 * deterministic function of it.
 */
import type {
  MapAuthoringPlacementContext,
  MapAuthoringPlacementRef,
  MapConceptAuthoringContext,
  MapContentRegistration,
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

const REGISTRY = "AUTHORED_CONTENT_CONCEPTS (src/lib/map/authoring/content-registry.ts)";

const REGISTRATION_LABEL: Record<MapContentRegistration, string> = {
  unregistered: "not registered (no content yet)",
  registered: "registered as intentionally authored",
  "registered-without-content": "INCONSISTENT: registered, but owns no content",
  "content-not-registered": "INCONSISTENT: owns content that is not registered",
};

function parentSection(placement: MapAuthoringPlacementContext | undefined): string[] {
  if (!placement?.parent) return ["  none (root placement or no placement)"];
  const parent = placement.parent;
  if (!parent.hasContent) return [`  ${parent.label} (${parent.conceptId}) has no exposition.`];
  if (parent.section?.whole) return [`  ${parent.label}, whole exposition (it has no sections):`, ...parent.section.lines.map((line) => `${INDENT}${line}`)];
  if (parent.section) {
    return [
      `  ${parent.label}, section ${parent.section.index + 1}${parent.section.heading ? ` "${parent.section.heading}"` : " (before the first heading)"}:`,
      ...parent.section.lines.map((line) => `${INDENT}${line}`),
    ];
  }
  return [`  No single section of ${parent.label}'s exposition was located. Its headings:`, ...parent.headings.map((heading) => `${INDENT}## ${heading}`)];
}

function authoringConstraints(context: MapConceptAuthoringContext): string[] {
  const id = context.concept.id;
  const placements = context.placements.length;
  switch (context.registration) {
    // Content and registry disagree: npm test already fails, and authoring on
    // top would hide which of the two is wrong.
    case "registered-without-content":
      return [
        `Do not author yet: "${id}" is registered in ${REGISTRY} but mapKnowledge.content has no record for it.`,
        "Either the content was removed without unregistering it or the registration was added without content; establish which, and resolve it (docs/map-authoring/authoring-workflow.md, Stop and escalate).",
      ];
    case "content-not-registered":
      return [
        `Do not author yet: "${id}" owns content "${context.content.contentId}" that is not registered in ${REGISTRY}.`,
        "Either the content was added unintentionally or its registration is missing; establish which, and resolve it (docs/map-authoring/authoring-workflow.md, Stop and escalate).",
      ];
    case "registered":
      return [
        `Revising edits the existing record "${context.content.contentId}" in mapKnowledge.content (src/lib/map/data.ts).`,
        `"${id}" is already registered in ${REGISTRY}; revising its exposition needs no new registry entry.`,
        ...exposureConstraints(placements),
        "Revising existing content leaves hasContent unchanged; still run the gates in docs/map-authoring/authoring-workflow.md.",
      ];
    case "unregistered":
      return [
        `New exposition is one record in mapKnowledge.content (src/lib/map/data.ts): { id: "${id}-content", conceptId: "${id}", definition, body? }.`,
        `Intentionally authored exposition must also register "${id}" in ${REGISTRY}, as step 5 of docs/map-authoring/authoring-workflow.md describes.`,
        ...exposureConstraints(placements),
        "Adding content flips hasContent at every placement: run npm run map:generate, then the gates in docs/map-authoring/authoring-workflow.md.",
      ];
  }
}

function exposureConstraints(placements: number): string[] {
  return [
    `The exposition opens at every placement listed above (${placements}); it is canonical, not placement-specific.`,
    "The definition leads; body blocks are paragraph, heading, flow, distinction, tensions and terms. Use only the blocks the explanation needs.",
    "All text is plain: no HTML, markdown or line breaks. Strings within one terms strip, distinction chain, tension list or flow stage/branch must be unique.",
    "Flows need at least two stages, never two parallel sets in a row, a branch only inside a parallel set, and at most six parallel elements.",
    "Terms strips need at least two terms; they are plain vocabulary, not navigation.",
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
  lines.push(`Registration:       ${REGISTRATION_LABEL[context.registration]}`);
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
  lines.push(...parentSection(primary));
  // Every other placement that carries a layer of children has its own parent
  // section to respect, whichever placement is primary.
  const otherCarriers = context.childLayers.carriers.filter((carrier) => carrier.placementId !== primary?.placementId);
  if (otherCarriers.length > 0) {
    lines.push("", "Parent exposition around the other child-carrying placements");
    for (const carrier of otherCarriers) {
      lines.push(`  [${carrier.placementId}] ${carrier.trail}`);
      lines.push(...parentSection(context.placements.find((placement) => placement.placementId === carrier.placementId)));
    }
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
        entry.otherChildLayers.length ? `children also at ${entry.otherChildLayers.join(", ")}` : undefined,
      ].filter(Boolean);
      return `  ${String(index + 1).padStart(2)}. ${entry.hasContent ? "[content]" : "[ -     ]"} ${entry.placementId.padEnd(width)}  ${entry.label}  (children ${entry.childrenWithContent}/${entry.childCount} with content${flags.length ? `; ${flags.join("; ")}` : ""})`;
    }),
  ];
  return `${lines.join("\n")}\n`;
}
