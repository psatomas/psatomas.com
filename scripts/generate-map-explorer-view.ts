// Writes the /map explorer's taxonomy view as static data: the exact output of
// buildMapExplorerView for the canonical L0 roots. The taxonomy is immutable, so
// it is derived once here instead of being rebuilt and re-serialized into every
// /map response. Run after changing the ontology: `npm run map:generate`.
// A unit test fails if the committed file drifts from the ontology.
import { writeFileSync } from "node:fs";
import { mapResolver } from "../src/lib/map/index.ts";
import { buildMapExplorerView } from "../src/components/map/explorer-model.ts";

const OUTPUT = new URL("../src/components/map/explorer-view.generated.json", import.meta.url);
const view = buildMapExplorerView(
  mapResolver,
  mapResolver.getRootPlacements().map((placement) => placement.id),
);
writeFileSync(OUTPUT, `${JSON.stringify(view)}\n`);
console.log(`Wrote ${OUTPUT.pathname} (${view.roots.length} roots)`);
