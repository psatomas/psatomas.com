// Prints the bounded authoring context of one canonical MAP concept, or a
// domain's L1 authoring status. See docs/map-authoring/README.md.
//
//   npm run map:inspect -- <concept-id> [--context <placement-id>] [--json]
//   npm run map:inspect -- --domain <l0-domain-id> [--json]
import { mapKnowledge } from "../src/lib/map/data.ts";
import { createMapAuthoringInspector, MapAuthoringContextError } from "../src/lib/map/authoring/context.ts";
import { formatMapConceptAuthoringContext, formatMapDomainAuthoringStatus } from "../src/lib/map/authoring/format.ts";

const USAGE = [
  "Usage:",
  "  npm run map:inspect -- <concept-id> [--context <placement-id>] [--json]",
  "  npm run map:inspect -- --domain <l0-domain-id> [--json]",
].join("\n");

function fail(message: string, code: number): never {
  console.error(`map:inspect: ${message}`);
  process.exit(code);
}

const args = process.argv.slice(2);
const json = args.includes("--json");
const positional: string[] = [];
const options = new Map<string, string>();
for (let index = 0; index < args.length; index++) {
  const arg = args[index];
  if (arg === "--json") continue;
  if (arg === "--context" || arg === "--domain") {
    const value = args[++index];
    if (!value || value.startsWith("--")) fail(`${arg} needs a value.\n${USAGE}`, 2);
    if (options.has(arg)) fail(`${arg} given more than once.\n${USAGE}`, 2);
    options.set(arg, value);
  } else if (arg.startsWith("--")) fail(`unknown option ${arg}.\n${USAGE}`, 2);
  else positional.push(arg);
}
const domain = options.get("--domain");
if (domain ? positional.length > 0 || options.has("--context") : positional.length !== 1) fail(USAGE, 2);

try {
  const inspector = createMapAuthoringInspector(mapKnowledge);
  if (domain) {
    const status = inspector.inspectDomain(domain);
    process.stdout.write(json ? `${JSON.stringify(status, null, 2)}\n` : formatMapDomainAuthoringStatus(status));
  } else {
    const context = inspector.inspectConcept(positional[0], { contextPlacementId: options.get("--context") });
    process.stdout.write(json ? `${JSON.stringify(context, null, 2)}\n` : formatMapConceptAuthoringContext(context));
  }
} catch (error) {
  if (error instanceof MapAuthoringContextError) fail(error.message, 1);
  throw error;
}
