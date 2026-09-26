"use client";

import { RecursiveMapExplorer } from "./recursive-explorer";
import type { MapExplorerView } from "./explorer-model";
import generatedView from "./explorer-view.generated.json";

// The canonical taxonomy view, generated from the ontology at authoring time
// (scripts/generate-map-explorer-view.ts). It is taxonomy only: no graph,
// content, mechanism, or path records. As static data it ships once in a
// cacheable client chunk instead of being rebuilt and re-serialized into every
// /map response; the server render reads the same module.
const explorerView = generatedView as MapExplorerView;

export function MapExplorer() {
  return <RecursiveMapExplorer view={explorerView} />;
}
