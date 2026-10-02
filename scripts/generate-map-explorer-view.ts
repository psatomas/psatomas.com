// Writes MAP's static taxonomy projections. The taxonomy is immutable, so they
// are derived once here instead of being rebuilt per request:
// - the /map explorer's taxonomy view, the exact output of buildMapExplorerView
//   for the canonical L0 roots;
// - the 27 L0 entries the homepage preview lists, so the homepage never loads
//   the knowledge model (docs/map-authoring/l2-content-scale.md).
// Run after changing the ontology: `npm run map:generate`. Unit tests fail if
// a committed file drifts from the ontology.
import { writeFileSync } from "node:fs";
import { mapResolver } from "../src/lib/map/index.ts";
import { buildMapExplorerView, getMapL0Entries } from "../src/components/map/explorer-model.ts";

const OUTPUT = new URL("../src/components/map/explorer-view.generated.json", import.meta.url);
const L0_OUTPUT = new URL("../src/components/map/map-l0.generated.json", import.meta.url);
const view = buildMapExplorerView(
  mapResolver,
  mapResolver.getRootPlacements().map((placement) => placement.id),
);
writeFileSync(OUTPUT, `${JSON.stringify(view)}\n`);
console.log(`Wrote ${OUTPUT.pathname} (${view.roots.length} roots)`);
const l0 = getMapL0Entries(mapResolver);
writeFileSync(L0_OUTPUT, `${JSON.stringify(l0, null, 2)}\n`);
console.log(`Wrote ${L0_OUTPUT.pathname} (${l0.length} L0 entries)`);
