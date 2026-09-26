// Interaction grammar: row structure and keyboard access, context vs disclosure,
// history and entry, and homepage destinations. Scenario-driven, by placement ID.
import type { Page } from "playwright-core";
import { WIDTHS, roots, settle, trailOf, type Section } from "./harness.mts";

const state = (page: Page, id: string | null) =>
  page.evaluate((id) => {
    const header = document.querySelector("header")!.getBoundingClientRect();
    const row = id ? document.querySelector(`[data-placement-id="${id}"]`) : null;
    const r = row?.getBoundingClientRect();
    const control = row?.querySelector("[data-row-control]");
    return {
      url: location.pathname + location.search,
      history: history.length,
      scrollY: Math.round(window.scrollY),
      current: [...document.querySelectorAll('[data-row-control][aria-current="true"]')].map(
        (b) => (b.closest("[data-placement-id]") as HTMLElement).dataset.placementId,
      ),
      trail: [...document.querySelectorAll('nav[aria-label="Context"] [role="listitem"]')]
        .map((li) => [...li.querySelectorAll("button, [aria-current]")].map((e) => e.textContent).join(""))
        .join(" / "),
      expanded: control?.getAttribute("aria-expanded") ?? null,
      indicator: control?.lastElementChild?.textContent ?? null,
      rowTop: r ? Math.round(r.top) : null,
      visible: r ? r.top >= header.bottom - 1 && r.bottom <= window.innerHeight : false,
      headerBottom: Math.round(header.bottom),
    };
  }, id);

const rowControl = (page: Page, id: string) => page.locator(`[data-placement-id="${id}"] [data-row-control]`);

export const interactionSections: Section[] = [
  {
    name: "structure",
    title: "row structure and keyboard access",
    async run({ browser, base, check }) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      await page.goto(`${base}/map?context=foundations`, { waitUntil: "networkidle" });
      await page.waitForSelector('[role="region"][aria-busy="false"]');
      const dom = await page.evaluate(() => {
        const rows = [...document.querySelectorAll("[data-placement-id]")];
        const interactive = "a, button, input, select, textarea, [tabindex], [role=button], [role=link]";
        return {
          rows: rows.length,
          oneControlEach: rows.every((r) => r.querySelectorAll(interactive).length === 1),
          nested: [...document.querySelectorAll("[data-row-control]")].filter((b) => b.querySelector(interactive)).length,
          leafIndicators: rows
            .filter((r) => !r.querySelector("[data-row-control]")!.hasAttribute("aria-expanded"))
            .map((r) => r.querySelector("[data-row-control]")!.lastElementChild?.textContent)
            .join(""),
        };
      });
      check(dom.oneControlEach && dom.nested === 0 && dom.leafIndicators === "", `${dom.rows} rows: exactly one control each, no nested interactive elements, leaves show no +/−`);
      await page.goto(`${base}/map`, { waitUntil: "networkidle" });
      const first = rowControl(page, roots[0].id);
      await first.focus();
      await page.keyboard.press("Tab");
      const next = await page.evaluate(() => (document.activeElement?.closest("[data-placement-id]") as HTMLElement | null)?.dataset.placementId);
      check(next === roots[1].id, `Tab moves from the first domain straight to the next row (${next}): one tab stop per row`);
      await first.focus();
      await page.keyboard.press("Enter");
      await settle(page);
      let s = await state(page, "foundations");
      check(s.url === "/map?context=foundations" && s.expanded === "true" && s.current.includes("foundations"), `Enter on closed Foundations: context + open (${s.url})`);
      await page.keyboard.press("Space");
      await settle(page);
      s = await state(page, "foundations");
      check(s.url === "/map?context=foundations" && s.expanded === "false" && s.current.includes("foundations"), "Space on open Foundations: collapses, context kept");
      const outline = await first.evaluate((b) => `${getComputedStyle(b).outlineStyle} ${getComputedStyle(b).outlineWidth}`);
      check(outline === "solid 2px", `keyboard focus visible on the row control (${outline})`);
      await page.close();
    },
  },
  {
    name: "interaction",
    title: "context vs disclosure grammar",
    async run({ browser, base, check }) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      await page.goto(`${base}/map`, { waitUntil: "networkidle" });
      const row = (id: string) => rowControl(page, id);
      await row("consensus-ordering").click();
      await settle(page);
      let s = await state(page, "consensus-ordering");
      check(
        s.url === "/map?context=consensus-ordering" && s.expanded === "true" && s.indicator === "−" && s.visible && s.trail === "Consensus & Ordering",
        `closed L0 click: context + open + visible (row top ${s.rowTop}, header ${s.headerBottom})`,
      );
      const beforeCollapse = s;
      await row("consensus-ordering").click();
      await settle(page);
      s = await state(page, "consensus-ordering");
      check(
        s.url === beforeCollapse.url && s.history === beforeCollapse.history && s.expanded === "false" && s.indicator === "+" &&
          s.current.includes("consensus-ordering") && s.scrollY === beforeCollapse.scrollY && s.rowTop === beforeCollapse.rowTop,
        "collapse active L0: URL and history unchanged, context kept (cyan + '+'), no scroll jump",
      );
      await row("consensus-ordering").click();
      await settle(page);
      s = await state(page, "consensus-ordering");
      check(s.url === beforeCollapse.url && s.history === beforeCollapse.history && s.expanded === "true", "reopen active L0: opens, no new history entry");
      // A leaf is exercised with an L2 topic.
      await row("validators").click();
      await settle(page);
      await row("validator-selection").click();
      await settle(page);
      s = await state(page, "validator-selection");
      check(
        s.url === "/map?context=validator-selection" && s.expanded === null && s.indicator === "" && s.visible && JSON.stringify(s.current) === '["validator-selection"]',
        "switch to leaf L2 Validator Selection: context + visible, no fabricated disclosure",
      );
      check((await state(page, "consensus-ordering")).expanded === "true", "the enclosing open branch stays open");
      await row("consensus").click();
      await settle(page);
      s = await state(page, "consensus");
      check(s.url === "/map?context=consensus" && s.expanded === "true" && s.visible && s.trail === "Consensus & Ordering / Consensus", `nested closed row: ${s.trail}, open, visible`);
      await row("finality-in-consensus").click();
      await settle(page);
      s = await state(page, "finality-in-consensus");
      const exposition = await page.locator("#map-exposition-finality-in-consensus").count();
      check(s.url === "/map?context=finality-in-consensus" && s.expanded === "true" && exposition === 1 && s.visible, "nested Finality: context + open with its exposition + visible");
      const hist = s.history;
      await row("finality-in-consensus").click();
      await settle(page);
      s = await state(page, "finality-in-consensus");
      check(
        s.url === "/map?context=finality-in-consensus" && s.history === hist && s.expanded === "false" && s.current.includes("finality-in-consensus"),
        "collapse active nested row: context kept, URL unchanged",
      );
      await row("consensus").click();
      await settle(page);
      s = await state(page, "consensus");
      check(s.url === "/map?context=finality-in-consensus" && s.expanded === "false", "click open non-active Consensus: collapses, context stays on Finality");
      await row("consensus").click();
      await settle(page);
      await page.locator('nav[aria-label="Context"] button', { hasText: /^Consensus & Ordering$/ }).click();
      await settle(page);
      s = await state(page, "consensus-ordering");
      check(s.url === "/map?context=consensus-ordering" && s.expanded === "true" && s.visible && s.trail === "Consensus & Ordering", "breadcrumb ancestor: context, open, visible");
      // The same grammar deep in a later domain, entered by deep link.
      await page.goto(`${base}/map?context=self-healing`, { waitUntil: "networkidle" });
      await settle(page);
      await row("protocol-autonomy").click();
      await settle(page);
      s = await state(page, "protocol-autonomy");
      check(s.url === "/map?context=protocol-autonomy", "deep-linked domain: click a closed row, it becomes the context");
      await row("self-healing").click();
      await settle(page);
      s = await state(page, "self-healing");
      check(s.url === "/map?context=protocol-autonomy" && s.expanded === "false", "deep-linked domain: click an open non-active row, it collapses, context unchanged");
      await page.close();
    },
  },
  {
    name: "history",
    title: "history, refresh, deep entry and invalid context",
    async run({ browser, base, check }) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      await page.goto(`${base}/map`, { waitUntil: "networkidle" });
      const row = (id: string) => rowControl(page, id);
      await row("foundations").click();
      await settle(page);
      await row("state-data").click();
      await settle(page);
      await row("ai-intelligent-systems").click();
      await settle(page);
      let s = await state(page, "ai-intelligent-systems");
      check(s.url === "/map?context=ai-intelligent-systems" && s.visible, "Foundations → State & Data → AI & Intelligent Systems");
      await page.goBack();
      await settle(page);
      s = await state(page, "state-data");
      check(s.url === "/map?context=state-data" && JSON.stringify(s.current) === '["state-data"]' && s.trail === "State & Data" && s.visible, `Back → State & Data restored and visible (row top ${s.rowTop})`);
      await page.goBack();
      await settle(page);
      s = await state(page, "foundations");
      check(s.url === "/map?context=foundations" && s.trail === "Foundations" && s.expanded === "true" && s.visible, `Back → Foundations restored, open, visible (row top ${s.rowTop})`);
      await page.goForward();
      await settle(page);
      s = await state(page, "state-data");
      check(s.url === "/map?context=state-data" && s.visible, "Forward → State & Data visible");
      await page.goto(`${base}/map?context=ai-intelligent-systems`, { waitUntil: "networkidle" });
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.reload({ waitUntil: "networkidle" });
      await settle(page);
      s = await state(page, "ai-intelligent-systems");
      check(s.expanded === "true" && s.visible && s.trail === "AI & Intelligent Systems", `refresh: context reconstructed, open, visible (row top ${s.rowTop})`);
      await page.goto(`${base}/map?context=finality-in-rollups`, { waitUntil: "networkidle" });
      await settle(page);
      s = await state(page, "finality-in-rollups");
      check(
        s.expanded === "true" && s.visible && s.trail === trailOf("finality-in-rollups") && s.trail === "Scaling & Modular Systems / Rollups / Finality",
        `direct deep entry: ancestors open, placement open and visible (${s.trail})`,
      );
      const response = await page.goto(`${base}/map?context=nope`, { waitUntil: "networkidle" });
      await settle(page);
      s = await state(page, null);
      check(response?.status() === 200 && s.current.length === 0 && s.scrollY === 0, "invalid context: default state, no scroll");
      await page.close();
    },
  },
  {
    name: "home",
    title: "homepage domain cells → MAP destinations at every width",
    async run({ browser, base, check }) {
      for (const width of WIDTHS) {
        for (const n of [1, 4, 20, roots.length]) {
          const id = roots[n - 1].id;
          const page = await browser.newPage({ viewport: { width, height: 800 } });
          await page.goto(`${base}/`, { waitUntil: "networkidle" });
          const cell = page.locator('ol[aria-label="MAP domains"] > li > a').nth(n - 1);
          await cell.scrollIntoViewIfNeeded();
          await cell.click();
          await page.waitForURL(`**/map?context=${id}`);
          await page.waitForLoadState("networkidle");
          await settle(page);
          const s = await state(page, id);
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
          check(
            s.visible && s.current.includes(id) && overflow === 0,
            `@${width} home ${String(n).padStart(2, "0")} → ${s.url}: row visible (top ${s.rowTop}, header ${s.headerBottom}, scrollY ${s.scrollY}), overflow ${overflow}`,
          );
          await page.close();
        }
      }
    },
  },
];
