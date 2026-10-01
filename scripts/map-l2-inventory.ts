// Prints read-only facts about MAP's L2 layer: counts, ownership per domain,
// sibling-group ownership and topology problems. See
// docs/map-authoring/l2-analysis.md. Writes nothing.
//
//   npm run map:l2 [-- --json]
import { mapKnowledge } from "../src/lib/map/data.ts";
import { inventoryL2 } from "../src/lib/map/authoring/l2/inventory.ts";

const args = process.argv.slice(2);
const unknown = args.filter((arg) => arg !== "--json");
if (unknown.length) {
  console.error(`map:l2: unknown argument ${unknown[0]}.\nUsage: npm run map:l2 [-- --json]`);
  process.exit(2);
}

const inventory = inventoryL2(mapKnowledge);
if (args.includes("--json")) {
  process.stdout.write(`${JSON.stringify(inventory, null, 2)}\n`);
} else {
  const { counts } = inventory;
  const title = (placementId: string) => {
    const placement = mapKnowledge.placements.find((candidate) => candidate.id === placementId)!;
    return mapKnowledge.concepts.find((concept) => concept.id === placement.conceptId)!.title;
  };
  const lines = [
    "MAP L2 inventory",
    `L2 placements:          ${counts.placements}`,
    `L2 concepts:            ${counts.concepts} (${counts.l2Only} l2-only, ${counts.dualRole} dual-role over ${counts.dualRolePlacements} L2 placements)`,
    `With several placements: ${counts.multiPlacement}; across domains: ${counts.crossDomain}`,
    `With content:           ${counts.withContent}`,
    `Sibling groups:         ${counts.groups} (${counts.ownershipGroups} own at least one concept)`,
    `Linked group sets:      ${inventory.linkedGroupSets.length} (largest ${inventory.linkedGroupSets.slice(0, 3).join(", ")}; ${inventory.linkedGroupSets.filter((size) => size === 1).length} standalone)`,
    "",
    "Owned l2-only concepts per domain",
  ];
  for (const domain of mapKnowledge.placements.filter((placement) => !placement.parentPlacementId).sort((a, b) => a.order - b.order)) {
    const owned = inventory.concepts.filter((facts) => facts.owner?.domainPlacementId === domain.id).length;
    const placed = inventory.concepts.filter((facts) => facts.placements.some((placement) => placement.depth === 2 && placement.domainPlacementId === domain.id)).length;
    lines.push(`  ${String(domain.order + 1).padStart(2, "0")} ${title(domain.id).padEnd(36)} owned ${String(owned).padStart(3)} of ${String(placed).padStart(3)} placed`);
  }
  const mixed = inventory.groups.filter((group) => group.owned < group.members.length);
  lines.push("", `Groups not owning every member: ${mixed.length}; owning none: ${inventory.groups.filter((group) => group.owned === 0).map((group) => title(group.groupPlacementId)).join(", ") || "none"}`);
  lines.push("", inventory.problems.length ? `Problems (${inventory.problems.length})\n${inventory.problems.map((problem) => `  - ${problem}`).join("\n")}` : "Problems: none");
  process.stdout.write(`${lines.join("\n")}\n`);
}
