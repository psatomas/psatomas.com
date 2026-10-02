import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { relative } from "node:path";
import test from "node:test";

/**
 * Production UI code never loads the MAP knowledge model, which carries every
 * exposition, except the one route that serves exposition: the prerendered
 * content API. Everything else reads generated projections (the explorer view,
 * the homepage's L0 entries) or imports types only, so no request path
 * evaluates the corpus as L2 grows (docs/map-authoring/l2-content-scale.md).
 */
const ROOT = new URL("../../../", import.meta.url);
const ALLOWED = new Set(["src/app/api/map/content/[conceptId]/route.ts"]);

const sources = ["src/app", "src/components"].flatMap((dir) =>
  readdirSync(new URL(`${dir}/`, ROOT), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name))
    .map((entry) => relative(ROOT.pathname, `${entry.parentPath}/${entry.name}`)),
);

/** Imports and re-exports of the MAP model module that bring values, not only types. */
function modelValueImports(source: string): string[] {
  const found: string[] = [];
  for (const match of source.matchAll(/(?:^|\n)\s*(import|export)\s+([\s\S]*?)\s+from\s+["']([^"']+)["']/g)) {
    const [, , clause, specifier] = match;
    if (!/(^@\/lib\/map(\/|$))|(\/lib\/map(\/|$))/.test(specifier)) continue;
    if (/^type\s/.test(clause)) continue;
    const names = clause.match(/\{([\s\S]*)\}/)?.[1].split(",").map((name) => name.trim()).filter(Boolean);
    if (names && !/^\s*\w+\s*,/.test(clause) && names.every((name) => name.startsWith("type "))) continue;
    found.push(`${clause.replace(/\s+/g, " ")} from "${specifier}"`);
  }
  for (const match of source.matchAll(/import\(\s*["']([^"']*lib\/map[^"']*)["']\s*\)/g)) found.push(`import("${match[1]}")`);
  return found;
}

test("only the content route loads the MAP knowledge model; UI code reads projections or types", () => {
  assert.ok(sources.length > 0);
  const violations = sources.filter((file) => !ALLOWED.has(file)).flatMap((file) => modelValueImports(readFileSync(new URL(file, ROOT), "utf8")).map((found) => `${file}: ${found}`));
  assert.deepEqual(violations, []);
  // The allowance is real: the content route does load the model.
  assert.ok(modelValueImports(readFileSync(new URL([...ALLOWED][0], ROOT), "utf8")).length > 0);
});

test("the boundary check tells value imports from type-only imports", () => {
  assert.deepEqual(modelValueImports('import type { MapContentBlock } from "@/lib/map";'), []);
  assert.deepEqual(modelValueImports('import { type MapContentBlock, type MapFlowElement } from "@/lib/map";'), []);
  assert.deepEqual(modelValueImports('import { mapResolver } from "@/lib/map";'), ['{ mapResolver } from "@/lib/map"']);
  assert.deepEqual(modelValueImports('import { type MapResolver, mapKnowledge } from "@/lib/map/data";'), ['{ type MapResolver, mapKnowledge } from "@/lib/map/data"']);
  assert.deepEqual(modelValueImports('import * as map from "../../lib/map";'), ['* as map from "../../lib/map"']);
  assert.deepEqual(modelValueImports('export { mapResolver } from "@/lib/map";'), ['{ mapResolver } from "@/lib/map"']);
  assert.deepEqual(modelValueImports('const m = await import("@/lib/map");'), ['import("@/lib/map")']);
  assert.deepEqual(modelValueImports('import { getMapL0Entries } from "@/components/map/explorer-model";'), []);
});
