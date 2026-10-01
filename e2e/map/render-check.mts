// Render verification for authored MAP concepts: `npm run test:map:render -- <concept-id>...`.
//
// Expectations come from the canonical model through the MAP resolver
// (renderExpectations), never from hand-written placement lists. For every
// placement of each concept, at desktop and mobile widths: the canonical
// exposition renders; the context trail matches placement ancestry; the row is
// current and expanded; exactly the placement's own children render beneath
// it, in order (none at a leaf); no child of the concept's other carriers
// renders anywhere (no cross-facet leakage); structured blocks carry text
// alternatives; and nothing overflows horizontally. The exposition text must
// be identical at every placement and width. Nothing is read until the
// exposition has settled (waitForExposition), and a failed load fails. Runs
// against `next start` on the existing build, like the browser suite.
import { renderExpectations } from "../../src/lib/map/authoring/orchestrator/plan.ts";
import { launchBrowser, model, startServer, trailOf, waitForExposition } from "./harness.mts";

export const RENDER_WIDTHS = [1280, 375] as const;

export type RenderFailure = { conceptId: string; placementId: string; width: number; problems: string[] };
export type RenderReport = { ok: boolean; renders: number; failures: RenderFailure[] };

export async function checkRender(conceptIds: readonly string[], base?: string): Promise<RenderReport> {
  const failures: RenderFailure[] = [];
  const unknown = conceptIds.filter((conceptId) => !model.concepts.some((concept) => concept.id === conceptId));
  if (unknown.length) return { ok: false, renders: 0, failures: unknown.map((conceptId) => ({ conceptId, placementId: "-", width: 0, problems: ["unknown concept"] })) };
  const server = base ? null : await startServer();
  const url = (base ?? server!.base).replace(/\/$/, "");
  let renders = 0;
  try {
    const browser = await launchBrowser();
    try {
      for (const { conceptId, placements } of renderExpectations(model, conceptIds)) {
        if (placements.length === 0) failures.push({ conceptId, placementId: "-", width: 0, problems: ["no placements"] });
        let reference: { at: string; text: string } | undefined;
        for (const { placementId, children, foreignChildren } of placements) {
          for (const width of RENDER_WIDTHS) {
            renders++;
            const problems: string[] = [];
            const page = await browser.newPage({ viewport: { width, height: 1000 } });
            try {
              await page.goto(`${url}/map?context=${placementId}`, { waitUntil: "load" });
              await waitForExposition(page, placementId);
              await page.locator(`#map-exposition-${placementId} p`).first().waitFor({ timeout: 15000 });
              await page.waitForTimeout(800);
              const facts = await page.evaluate((placementId) => {
                const rows = [...document.querySelectorAll("[data-placement-id]")] as HTMLElement[];
                const ids = rows.map((row) => row.dataset.placementId!);
                const at = ids.indexOf(placementId);
                const depth = Number(rows[at].dataset.depth);
                const beneath: string[] = [];
                for (let index = at + 1; index < rows.length; index++) {
                  const rowDepth = Number(rows[index].dataset.depth);
                  if (rowDepth <= depth) break;
                  if (rowDepth === depth + 1) beneath.push(ids[index]);
                }
                const control = rows[at].querySelector("[data-row-control]")!;
                const nav = document.querySelector('nav[aria-label="Context"]')!;
                const exposition = document.querySelector(`#map-exposition-${placementId}`) as HTMLElement;
                return {
                  ids,
                  trail: [...nav.querySelectorAll('[role="listitem"]')]
                    .map((item) => [...item.querySelectorAll("button, [aria-current]")].map((node) => node.textContent).join(""))
                    .join(" / "),
                  current: control.getAttribute("aria-current"),
                  expanded: control.getAttribute("aria-expanded"),
                  beneath,
                  unlabeled: [...exposition.querySelectorAll('[role="img"], [role="table"]')].filter((node) => (node.getAttribute("aria-label") ?? "").trim().length < 4).length,
                  overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
                  text: exposition.innerText,
                };
              }, placementId);
              if (facts.trail !== trailOf(placementId)) problems.push(`trail: rendered "${facts.trail}", expected "${trailOf(placementId)}"`);
              if (facts.current !== "true") problems.push("current: the row is not marked aria-current");
              if (facts.expanded !== "true") problems.push("expanded: the row is not aria-expanded");
              if (JSON.stringify(facts.beneath) !== JSON.stringify(children)) {
                problems.push(`children: rendered ${JSON.stringify(facts.beneath)}, expected ${children.length ? JSON.stringify(children) : "none (leaf)"}`);
              }
              const leaked = foreignChildren.filter((child) => facts.ids.includes(child));
              if (leaked.length) problems.push(`facet leakage: other carriers' children rendered: ${leaked.join(", ")}`);
              if (facts.unlabeled) problems.push(`accessibility: ${facts.unlabeled} structured block(s) without a text alternative`);
              if (facts.overflow > 0) problems.push(`overflow: ${facts.overflow}px horizontal overflow`);
              // Layout may change where lines break, never what the exposition says.
              const text = facts.text.replace(/\s+/g, " ").trim();
              if (!reference) reference = { at: `${placementId}@${width}`, text };
              else if (text !== reference.text) problems.push(`canonical text: differs from ${reference.at}`);
            } catch (error) {
              problems.push(`exposition: did not render (${(error as Error).message.split("\n")[0]})`);
            } finally {
              await page.close();
            }
            if (problems.length) failures.push({ conceptId, placementId, width, problems });
          }
        }
      }
    } finally {
      await browser.close();
    }
  } finally {
    server?.stop();
  }
  return { ok: failures.length === 0, renders, failures };
}

/** One line per failed render: concept, placement, viewport, and each failed invariant. */
export const formatRenderFailures = (report: RenderReport) =>
  report.failures.map((failure) => `${failure.conceptId} at ${failure.placementId} @${failure.width}px: ${failure.problems.join("; ")}`).join("\n");

if (import.meta.url === `file://${process.argv[1]}`) {
  const conceptIds = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
  const json = process.argv.includes("--json");
  if (conceptIds.length === 0) {
    console.error("Usage: npm run test:map:render -- <concept-id>... [--json]");
    process.exit(2);
  }
  const report = await checkRender(conceptIds, process.env.MAP_BASE_URL);
  if (json) console.log(JSON.stringify(report));
  else {
    if (report.failures.length) console.log(formatRenderFailures(report).replace(/^/gm, "FAIL  "));
    console.log(`${report.renders} renders, ${report.failures.length} failure(s)`);
  }
  process.exit(report.ok ? 0 : 1);
}
