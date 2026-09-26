// Ontology coverage: every L0 domain, every L1 topic (rendering every L2 row) and
// every placement of every multiply-placed concept, entered by deep link and
// checked for reveal, breadcrumb, ordinal and layout. Expectations are derived
// from the canonical model, so the suite follows the ontology without edits.
import type { Page } from "playwright-core";
import { WIDTHS, model, ordinalOf, resolver, roots, trailOf, type Check, type Section } from "./harness.mts";

async function open(page: Page, base: string, id: string) {
  await page.goto(`${base}/map?context=${id}`, { waitUntil: "load" });
  await page.waitForSelector(`[data-placement-id="${id}"] [data-row-control][aria-current="true"]`, { timeout: 15000 });
  await page.waitForTimeout(250);
}

// Layout of every row rendered in the context's region: viewport, clipping, mid-word breaks.
const inspect = (page: Page, id: string) =>
  page.evaluate((id) => {
    const vw = document.documentElement.clientWidth;
    const header = document.querySelector("header")!.getBoundingClientRect();
    const row = document.querySelector(`[data-placement-id="${id}"]`)!;
    const rr = row.getBoundingClientRect();
    const region = row.closest('[role="list"]')?.closest('[role="listitem"]') ?? document.body;
    const problems: string[] = [];
    for (const el of region.querySelectorAll("[data-placement-id]")) {
      const rect = el.getBoundingClientRect();
      const pid = (el as HTMLElement).dataset.placementId;
      if (rect.left < -0.5 || rect.right > vw + 0.5) problems.push(`${pid} outside viewport`);
      const inner = el.querySelector("[data-row-control] > span")!;
      for (const span of inner.querySelectorAll("span")) {
        const cs = getComputedStyle(span);
        if (cs.overflow !== "visible" && span.scrollWidth > span.clientWidth + 1) problems.push(`${pid} clipped`);
      }
      // A word (between spaces, slashes or hyphens) must not break across lines.
      const walker = document.createTreeWalker(inner, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const text = node.textContent ?? "";
        const re = /[^\s\-‐–—/›]+/g;
        for (let m = re.exec(text); m; m = re.exec(text)) {
          const range = document.createRange();
          range.setStart(node, m.index);
          range.setEnd(node, m.index + m[0].length);
          const tops = new Set([...range.getClientRects()].filter((q) => q.width > 0.5).map((q) => Math.round(q.top)));
          if (tops.size > 1) problems.push(`${pid} breaks "${m[0]}" mid-word`);
        }
      }
    }
    const nav = document.querySelector('nav[aria-label="Context"]')!;
    const current = nav.querySelector('[aria-current="location"]')!;
    return {
      overflow: document.documentElement.scrollWidth - vw,
      visible: rr.top >= header.bottom - 1 && rr.bottom <= window.innerHeight + 0.5,
      current: [...document.querySelectorAll('[data-row-control][aria-current="true"]')].map(
        (b) => (b.closest("[data-placement-id]") as HTMLElement).dataset.placementId,
      ),
      trail: [...nav.querySelectorAll('[role="listitem"]')]
        .map((li) => [...li.querySelectorAll("button, [aria-current]")].map((e) => e.textContent).join(""))
        .join(" / "),
      ordinal: nav.querySelector('[role="listitem"] span[aria-hidden="true"]')?.textContent ?? "",
      currentTruncated: current.scrollWidth > current.clientWidth + 1,
      problems,
    };
  }, id);

async function verifyContext(page: Page, base: string, check: Check, id: string, where: string) {
  await open(page, base, id);
  const s = await inspect(page, id);
  check(JSON.stringify(s.current) === JSON.stringify([id]), `${where} ${id}: context row is the current one (${s.current})`);
  check(s.visible, `${where} ${id}: context row revealed and scrolled into view`);
  check(s.overflow <= 0, `${where} ${id}: no horizontal overflow (${s.overflow})`);
  check(s.trail === trailOf(id), `${where} ${id}: breadcrumb "${s.trail}" = "${trailOf(id)}"`);
  check(s.ordinal === ordinalOf(id), `${where} ${id}: ordinal ${s.ordinal} = ${ordinalOf(id)}`);
  check(!s.currentTruncated, `${where} ${id}: current breadcrumb shown in full`);
  for (const problem of s.problems) check(false, `${where} ${id}: ${problem}`);
}

const l1 = roots.flatMap((root) => resolver.getChildren(root.id)).map((placement) => placement.id);
const multiPlaced = model.concepts.filter((concept) => resolver.getPlacementsForConcept(concept.id).length > 1);

export const coverageSections: Section[] = [
  {
    name: "domains",
    title: `${roots.length} L0 domains × ${WIDTHS.length} widths`,
    async run({ browser, base, check }) {
      for (const width of WIDTHS) {
        const page = await browser.newPage({ viewport: { width, height: 900 } });
        for (const root of roots) await verifyContext(page, base, check, root.id, `@${width}`);
        await page.close();
      }
    },
  },
  {
    name: "topics",
    title: `${l1.length} L1 contexts × 2 widths (every L2 row rendered)`,
    async run({ browser, base, check }) {
      for (const width of [320, 1280]) {
        const page = await browser.newPage({ viewport: { width, height: 900 } });
        for (const id of l1) await verifyContext(page, base, check, id, `@${width}`);
        await page.close();
      }
    },
  },
  {
    // Direct entry resolves to the preferred placement; every placement reveals
    // and scrolls to its own row with its own breadcrumb.
    name: "placements",
    title: `${multiPlaced.length} multiply-placed concepts, every placement`,
    async run({ browser, base, check }) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      for (const concept of multiPlaced) {
        const preferred = resolver.getPreferredPlacementForConcept(concept.id)!;
        check(preferred.id === concept.preferredPlacementId, `${concept.id}: direct entry resolves to its preferred placement`);
        for (const placement of resolver.getPlacementsForConcept(concept.id)) {
          await verifyContext(page, base, check, placement.id, `@1280 [${concept.id}]`);
        }
      }
      await page.close();
    },
  },
  {
    name: "sticky",
    title: "sticky breadcrumb and ordinals after scrolling",
    async run({ browser, base, check }) {
      for (const width of [375, 1280]) {
        const page = await browser.newPage({ viewport: { width, height: 800 } });
        for (const id of ["agent-identity", "agent-identity-in-ai-agents", "agent-identity-in-machine-economy", "finality-in-rollups", "self-owning-agents", "contagion"]) {
          await open(page, base, id);
          await page.evaluate(() => window.scrollBy(0, 2500));
          await page.waitForTimeout(200);
          const s = await page.evaluate(() => {
            const header = document.querySelector("header")!.getBoundingClientRect();
            const nav = document.querySelector('nav[aria-label="Context"]')!.getBoundingClientRect();
            return {
              stuck: nav.top >= header.bottom - 1 && nav.top <= header.bottom + 8,
              ordinal: document.querySelector('nav[aria-label="Context"] [role="listitem"] span[aria-hidden="true"]')?.textContent,
            };
          });
          check(s.stuck, `@${width} ${id}: breadcrumb stays pinned below the header after scrolling`);
          check(s.ordinal === ordinalOf(id), `@${width} ${id}: ordinal ${s.ordinal} = ${ordinalOf(id)} after scrolling`);
        }
        await page.close();
      }
    },
  },
];
