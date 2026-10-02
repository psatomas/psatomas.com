// Exposition models that no authored record may use yet are still exercised in
// the real production components: the content API response for one placement is
// replaced by a fixture, so the explorer renders it exactly as it would render
// canonical content. Nothing here changes the product.
import { describeCycle, describeState, finalStates, transitionDirection } from "../../src/components/map/exposition-text.ts";
import type { MapContentBlock } from "../../src/lib/map/index.ts";
import { settle, waitForExposition, type Section } from "./harness.mts";

const PLACEMENT = "consensus";
const CYCLE = { kind: "cycle", label: "A feedback loop", steps: ["Measure the system", "Compare with the target", "Adjust a parameter", "Effect appears after a delay"] } as const;
const COMPARISON = {
  kind: "comparison",
  label: "How verification methods differ",
  dimensions: ["Cost to check", "Delay", "Trusted party"],
  alternatives: [
    { name: "Light client", values: ["Moderate, recurring", "Source finality", "None beyond the source's consensus"] },
    { name: "Validity proof", values: ["Low", "Proving time", "The proof system"] },
    { name: "Committee", values: ["Low", "Short", "A threshold of committee members"] },
  ],
} as const;
// Synthetic state models: asymmetric entry and exit between two modes, and a
// machine that branches, returns, stays and ends.
const MODES = {
  kind: "state",
  label: "Operating modes",
  states: ["Normal", "Defensive"],
  transitions: [
    { from: "Normal", to: "Defensive", when: "the signal rises above the entry threshold" },
    { from: "Defensive", to: "Normal", when: "the signal stays below a lower exit threshold for a full window" },
  ],
} as const;
const RETRIES = {
  kind: "state",
  label: "Retrying an action",
  states: ["Attempting", "Waiting", "Done", "Abandoned"],
  transitions: [
    { from: "Attempting", to: "Done", when: "the effect is confirmed" },
    { from: "Attempting", to: "Waiting", when: "it fails and retries remain" },
    { from: "Waiting", to: "Attempting", when: "the backoff delay elapses" },
    { from: "Waiting", to: "Waiting", when: "another failure is reported during the delay" },
    { from: "Waiting", to: "Abandoned", when: "no retries remain" },
  ],
} as const;
const STATES = [MODES, RETRIES];
const BLOCKS: MapContentBlock[] = [{ kind: "paragraph", text: "A fixture exposition exercising cycle, comparison and state models." }, CYCLE, COMPARISON, ...STATES];
const CONTENT = /\/api\/map\/content\/consensus$/;

export const expositionSections: Section[] = [
  {
    name: "readiness",
    title: "an exposition is read only once it has settled",
    async run({ browser, base, check }) {
      // The content response is held until released, so the loading state lasts
      // as long as the check needs it: no outcome depends on how fast anything is.
      const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
      let release!: () => void;
      const held = new Promise<void>((resolve) => (release = resolve));
      await page.route(CONTENT, async (route) => {
        await held;
        await route.fulfill({ json: { conceptId: "consensus", blocks: BLOCKS } });
      });
      await page.goto(`${base}/map?context=${PLACEMENT}`, { waitUntil: "load" });
      const exposition = page.locator(`#map-exposition-${PLACEMENT}`);
      await exposition.locator("p", { hasText: "Loading" }).waitFor({ timeout: 15000 });
      check((await exposition.getAttribute("aria-busy")) === "true" && (await exposition.locator("p").count()) > 0, "while loading, the placeholder alone satisfies a wait for a paragraph");
      // Bounded only so the check ends: the content is held, so no wait can see it settle.
      const early = await waitForExposition(page, PLACEMENT, 1000).then(
        () => "settled",
        (error: Error) => error.name,
      );
      check(early === "TimeoutError", `the readiness wait does not settle on the loading state (${early})`);
      release();
      await waitForExposition(page, PLACEMENT);
      const text = (await exposition.innerText()).replace(/\s+/g, " ").trim();
      check(text.startsWith((BLOCKS[0] as { text: string }).text) && !text.includes("Loading"), "once settled, the loaded exposition is what is read");
      await page.close();

      const failing = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
      await failing.route(CONTENT, (route) => route.fulfill({ status: 500 }));
      await failing.goto(`${base}/map?context=${PLACEMENT}`, { waitUntil: "load" });
      const failed = await waitForExposition(failing, PLACEMENT).then(
        () => "settled",
        (error: Error) => error.message,
      );
      check(failed === "the exposition failed to load", `a failed load is reported, never read as content (${failed})`);
      await failing.close();
    },
  },
  {
    name: "models",
    title: "cycle, comparison and state models at desktop and 375px",
    async run({ browser, base, check }) {
      const texts: string[] = [];
      for (const width of [1280, 375]) {
        const page = await browser.newPage({ viewport: { width, height: 1000 } });
        await page.route(CONTENT, (route) => route.fulfill({ json: { conceptId: "consensus", blocks: BLOCKS } }));
        await page.goto(`${base}/map?context=${PLACEMENT}`, { waitUntil: "load" });
        await page.locator(`#map-exposition-${PLACEMENT} [role="table"]`).waitFor({ timeout: 15000 });
        await settle(page);
        const facts = await page.evaluate((placement) => {
          const exposition = document.querySelector(`#map-exposition-${placement}`) as HTMLElement;
          const box = (element: Element) => element.getBoundingClientRect();
          const cycle = [...exposition.querySelectorAll('[role="img"]')].find((node) => node.querySelector("[data-cycle-return]"))!;
          const nodes = [...cycle.querySelectorAll(":scope > span.border")];
          const rails = [...cycle.querySelectorAll("[data-cycle-return] > span.w-px")].map(box);
          const entry = box(cycle.querySelector("[data-cycle-entry]")!);
          const centre = (rect: DOMRect) => rect.top + rect.height / 2;
          const table = exposition.querySelector('[role="table"]')!;
          const rows = [...table.querySelectorAll('[role="rowgroup"]:last-child > [role="row"]')];
          const headerGroup = table.querySelector('[role="rowgroup"]')!;
          const clipped = [...table.querySelectorAll('[role="cell"], [role="rowheader"], [role="columnheader"]')].filter((cell) => box(cell).width > 1 && cell.scrollWidth > cell.clientWidth + 1).length;
          return {
            cycleLabel: cycle.getAttribute("aria-label"),
            steps: nodes.map((node) => node.textContent),
            railTop: Math.min(...rails.map((rect) => rect.top)) - centre(box(nodes[0])),
            railBottom: Math.max(...rails.map((rect) => rect.bottom)) - centre(box(nodes.at(-1)!)),
            railContinuous: rails.every((rect, index) => index === 0 || Math.abs(rect.top - rails[index - 1].bottom) <= 1),
            entryMeetsFirst: Math.abs(entry.right - box(nodes[0]).left) <= 1 && Math.abs(centre(entry) - centre(box(nodes[0]))) <= 2,
            tableLabel: table.getAttribute("aria-label"),
            columnHeaders: [...table.querySelectorAll('[role="columnheader"]')].map((cell) => cell.textContent),
            rowHeaders: [...table.querySelectorAll('[role="rowheader"]')].map((cell) => cell.textContent),
            cells: rows.map((row) => [...row.querySelectorAll('[role="cell"]')].length),
            headerVisible: box(headerGroup).width > 1,
            rowDisplay: getComputedStyle(rows[0]).display,
            cellLabelVisible: box(rows[0].querySelector('[role="cell"] [aria-hidden="true"]')!).width > 1,
            clipped,
            states: [...exposition.querySelectorAll('[role="img"]')]
              .filter((node) => node.querySelector("[data-state-node]"))
              .map((model) => ({
                label: model.getAttribute("aria-label"),
                nodes: [...model.querySelectorAll("[data-state-node]")].map((node) => node.textContent),
                finals: [...model.querySelectorAll("[data-state-final]")].map((node) => node.textContent),
                entries: model.querySelectorAll("[data-state-entry]").length,
                entryMeetsFirst: (() => {
                  const entry = box(model.querySelector("[data-state-entry]")!);
                  const first = box(model.querySelector("[data-state-node]")!);
                  return Math.abs(entry.right - first.left) <= 1 && Math.abs(centre(entry) - centre(first)) <= 2;
                })(),
                transitions: [...model.querySelectorAll("[data-state-transition]")].map((row) => [row.getAttribute("data-state-transition"), (row as HTMLElement).innerText.replace(/\s+/g, " ").trim()]),
                clipped: [...model.querySelectorAll("[data-state-node], [data-state-transition]")].filter((node) => node.scrollWidth > node.clientWidth + 1).length,
              })),
            overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
            text: exposition.innerText.replace(/\s+/g, " ").trim(),
          };
        }, PLACEMENT);
        const at = `@${width}`;
        check(facts.cycleLabel === describeCycle(CYCLE.label, CYCLE.steps), `${at} cycle: text alternative states every step and the return`);
        check(JSON.stringify(facts.steps) === JSON.stringify(CYCLE.steps), `${at} cycle: steps render in order`);
        check(Math.abs(facts.railTop) <= 2 && Math.abs(facts.railBottom) <= 2 && facts.railContinuous, `${at} cycle: the return rail runs unbroken from the last step to the first (${facts.railTop}, ${facts.railBottom})`);
        check(facts.entryMeetsFirst, `${at} cycle: the return enters the first step`);
        check(facts.tableLabel === COMPARISON.label, `${at} comparison: the table is labelled`);
        check(JSON.stringify(facts.columnHeaders) === JSON.stringify(["", ...COMPARISON.dimensions]), `${at} comparison: dimensions are column headers`);
        check(JSON.stringify(facts.rowHeaders) === JSON.stringify(COMPARISON.alternatives.map((alternative) => alternative.name)), `${at} comparison: alternatives are row headers`);
        check(facts.cells.every((count) => count === COMPARISON.dimensions.length), `${at} comparison: one cell per dimension in every row`);
        const wide = width >= 640;
        check(facts.headerVisible === wide && (facts.rowDisplay === "grid") === wide && facts.cellLabelVisible === !wide, `${at} comparison: ${wide ? "grid with a visible header row" : "stacked rows with dimension names beside values"}`);
        check(facts.clipped === 0, `${at} comparison: no clipped cells`);
        check(facts.states.length === STATES.length, `${at} state: every state model renders (${facts.states.length})`);
        for (const [index, model] of STATES.entries()) {
          const rendered = facts.states[index];
          if (!rendered) continue;
          const name = `${at} state "${model.label}"`;
          check(rendered.label === describeState(model.label, model.states, model.transitions), `${name}: the text alternative states every transition, its direction and its condition`);
          check(JSON.stringify(rendered.nodes) === JSON.stringify(model.states), `${name}: states render in the listed order`);
          check(JSON.stringify(rendered.finals) === JSON.stringify(finalStates(model.states, model.transitions)), `${name}: exactly the final states are marked final`);
          check(rendered.entries === 1 && rendered.entryMeetsFirst, `${name}: the entry marker enters the first state`);
          const expected = model.states.flatMap((state) =>
            model.transitions
              .filter((transition) => transition.from === state)
              .map((transition) => {
                const direction = transitionDirection(model.states, transition.from, transition.to);
                const target = (direction === "return" ? `back to ${transition.to}` : direction === "stay" ? `stays in ${transition.to}` : transition.to).toUpperCase();
                return [direction, `${transition.when} ${direction === "return" ? "↩" : direction === "stay" ? "↻" : "→"} ${target}`];
              }),
          );
          check(JSON.stringify(rendered.transitions) === JSON.stringify(expected), `${name}: each transition shows its condition, direction and target (${JSON.stringify(rendered.transitions)})`);
          check(rendered.clipped === 0, `${name}: no clipped state or transition`);
        }
        check(facts.overflow <= 0, `${at}: no horizontal overflow (${facts.overflow})`);
        texts.push(facts.text);
        await page.close();
      }
      check(texts[0] === texts[1], "the same exposition text at desktop and 375px");
    },
  },
];
