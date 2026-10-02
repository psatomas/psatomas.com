// L2 expansion verification: `npm run test:map:expansion -- <concept-id>...`.
//
// The render check enters every placement by URL. This enters every L2
// placement the way a reader does: from its parent L1 context, by activating
// the L2 row (docs/map-authoring/l2-authoring.md). At desktop and mobile
// widths, for each L2 placement of each concept: the parent's exposition
// settles; the L2 row is closed, and activating it makes it the context
// (URL, aria-current) and opens it (aria-expanded); its exposition settles
// (waitForExposition, never a fixed wait) and opens with the concept's own
// definition; and nothing overflows. Runs against `next start` on the
// existing build, like the browser suite.
import { model, launchBrowser, startServer, waitForExposition } from "./harness.mts";

export const EXPANSION_WIDTHS = [1280, 375] as const;

export type ExpansionFailure = { conceptId: string; placementId: string; width: number; problems: string[] };
export type ExpansionReport = { ok: boolean; expansions: number; failures: ExpansionFailure[] };

const depthOf = (placementId: string) => {
  let depth = 0;
  let placement = model.placements.find((candidate) => candidate.id === placementId);
  while (placement?.parentPlacementId) {
    depth++;
    placement = model.placements.find((candidate) => candidate.id === placement!.parentPlacementId);
  }
  return depth;
};
const normalize = (text: string) => text.replace(/\s+/g, " ").trim();

export async function checkExpansion(conceptIds: readonly string[], base?: string): Promise<ExpansionReport> {
  const failures: ExpansionFailure[] = [];
  const records = new Map(model.content.map((record) => [record.conceptId, record]));
  const missing = conceptIds.filter((conceptId) => !records.has(conceptId));
  if (missing.length) return { ok: false, expansions: 0, failures: missing.map((conceptId) => ({ conceptId, placementId: "-", width: 0, problems: ["no content to expand"] })) };
  const server = base ? null : await startServer();
  const url = (base ?? server!.base).replace(/\/$/, "");
  let expansions = 0;
  try {
    const browser = await launchBrowser();
    try {
      for (const conceptId of conceptIds) {
        const placements = model.placements.filter((placement) => placement.conceptId === conceptId && depthOf(placement.id) === 2);
        if (placements.length === 0) failures.push({ conceptId, placementId: "-", width: 0, problems: ["no L2 placement"] });
        for (const placement of placements) {
          const parent = placement.parentPlacementId!;
          for (const width of EXPANSION_WIDTHS) {
            expansions++;
            const problems: string[] = [];
            const page = await browser.newPage({ viewport: { width, height: 1000 } });
            try {
              await page.goto(`${url}/map?context=${parent}`, { waitUntil: "load" });
              await waitForExposition(page, parent);
              const control = page.locator(`[data-placement-id="${placement.id}"] [data-row-control]`).first();
              if ((await control.getAttribute("aria-expanded")) === "true") problems.push("the L2 row is already open from its parent's context");
              await control.click();
              await page.waitForURL((current) => current.searchParams.get("context") === placement.id, { timeout: 15000 });
              await waitForExposition(page, placement.id);
              if ((await control.getAttribute("aria-current")) !== "true") problems.push("current: the activated row is not marked aria-current");
              if ((await control.getAttribute("aria-expanded")) !== "true") problems.push("expanded: the activated row is not aria-expanded");
              const text = normalize(await page.locator(`#map-exposition-${placement.id}`).innerText());
              if (!text.startsWith(normalize(records.get(conceptId)!.definition))) problems.push(`exposition: does not open with ${conceptId}'s definition (found "${text.slice(0, 80)}")`);
              const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
              if (overflow > 0) problems.push(`overflow: ${overflow}px horizontal overflow`);
            } catch (error) {
              problems.push(`expansion: did not complete (${(error as Error).message.split("\n")[0]})`);
            } finally {
              await page.close();
            }
            if (problems.length) failures.push({ conceptId, placementId: placement.id, width, problems });
          }
        }
      }
    } finally {
      await browser.close();
    }
  } finally {
    server?.stop();
  }
  return { ok: failures.length === 0, expansions, failures };
}

export const formatExpansionFailures = (report: ExpansionReport) =>
  report.failures.map((failure) => `${failure.conceptId} at ${failure.placementId} @${failure.width}px: ${failure.problems.join("; ")}`).join("\n");

if (import.meta.url === `file://${process.argv[1]}`) {
  const conceptIds = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
  if (conceptIds.length === 0) {
    console.error("Usage: npm run test:map:expansion -- <concept-id>... [--json]");
    process.exit(2);
  }
  const report = await checkExpansion(conceptIds, process.env.MAP_BASE_URL);
  if (process.argv.includes("--json")) console.log(JSON.stringify(report));
  else {
    if (report.failures.length) console.log(formatExpansionFailures(report).replace(/^/gm, "FAIL  "));
    console.log(`${report.expansions} expansions, ${report.failures.length} failure(s)`);
  }
  process.exit(report.ok ? 0 : 1);
}
