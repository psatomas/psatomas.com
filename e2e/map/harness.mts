// Shared harness for the MAP browser regression: browser launch, the production
// server lifecycle, check accounting and model-derived expectations.
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import { chromium, type Browser, type Page } from "playwright-core";
import { mapKnowledge, mapResolver } from "../../src/lib/map/index.ts";

/** Viewport widths every responsive check runs at: phone to desktop. */
export const WIDTHS = [320, 375, 640, 768, 1280];

// Expectations come from the canonical model, never from hard-coded copies of it.
export const model = mapKnowledge;
export const resolver = mapResolver;
export const roots = resolver.getRootPlacements();
const label = (id: string) => {
  const placement = resolver.getPlacement(id)!;
  return placement.contextualLabel ?? resolver.getConcept(placement.conceptId)!.title;
};
/** The breadcrumb text for a placement context: its ancestors, then itself. */
export const trailOf = (id: string) => [...resolver.getAncestors(id).map((a) => a.id), id].map(label).join(" / ");
/** The two-digit ordinal of the L0 domain enclosing a placement. */
export const ordinalOf = (id: string) =>
  String(roots.findIndex((root) => root.id === (resolver.getAncestors(id)[0]?.id ?? id)) + 1).padStart(2, "0");

export type Check = (ok: boolean, message: string) => void;
export type SuiteContext = { browser: Browser; base: string; check: Check };
export type Section = { name: string; title: string; run: (context: SuiteContext) => Promise<void> };

/**
 * Lets client-side reveal and scroll finish after an interaction. A smooth
 * reveal across long expositions can outlast the fixed wait, so it then also
 * waits (up to 4s) until the scroll position stops changing.
 */
export async function settle(page: Page) {
  await page.waitForTimeout(700);
  let last = -1;
  for (let poll = 0; poll < 40; poll++) {
    const y = await page.evaluate(() => window.scrollY);
    if (y === last) return;
    last = y;
    await page.waitForTimeout(100);
  }
}

/**
 * Waits until a placement's exposition has settled, before anything reads it.
 * The region is aria-busy until its content has loaded or failed; content
 * selectors alone cannot tell, because the Loading placeholder is itself a
 * paragraph and is already in the server-rendered page. A failed load (the
 * only state with a retry control) rejects rather than being read as content.
 */
export async function waitForExposition(page: Page, placementId: string, timeout = 15000) {
  const region = page.locator(`#map-exposition-${placementId}[aria-busy="false"]`);
  await region.waitFor({ timeout });
  if (await region.locator("button").count()) throw new Error("the exposition failed to load");
}

/**
 * CHROME_PATH wins; otherwise installed stable Google Chrome, which is what the
 * baseline was validated in; otherwise Playwright's own Chromium
 * (`npx playwright-core install chromium`). Engines differ in text layout, so
 * the runner prints which browser ran.
 */
export async function launchBrowser(): Promise<Browser> {
  if (process.env.CHROME_PATH) return chromium.launch({ executablePath: process.env.CHROME_PATH });
  try {
    return await chromium.launch({ channel: "chrome" });
  } catch {
    try {
      return await chromium.launch();
    } catch {
      throw new Error("No browser found: install Google Chrome, run `npx playwright-core install chromium`, or set CHROME_PATH.");
    }
  }
}

const freePort = () =>
  new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, () => {
      const address = server.address();
      server.close(() => (typeof address === "object" && address ? resolve(address.port) : reject(new Error("no port"))));
    });
  });

/** Starts `next start` on the existing production build and waits for /map. */
/**
 * The homepage renders ResearchPreview, which reads the local D1 database at
 * request time (wrangler's git-ignored `.wrangler/state`). A checkout whose
 * local D1 was never migrated, such as a fresh clone or worktree, answers `/`
 * with a 500 ("no such table: articles"), and the homepage checks then time
 * out waiting for the MAP domain cells. Apply the committed migrations to the
 * local database first: the same idempotent, local-only step as
 * `npm run db:migrate:local`. Nothing is seeded and no remote database is used.
 */
function migrateLocalD1() {
  const result = spawnSync("node_modules/.bin/wrangler", ["d1", "migrations", "apply", "RESEARCH_DB", "--local"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 120_000 });
  if (result.status !== 0) throw new Error(`could not apply the local D1 migrations (\`npm run db:migrate:local\`):\n${result.stdout ?? ""}${result.stderr ?? ""}`);
}

export async function startServer(): Promise<{ base: string; stop: () => void }> {
  if (!existsSync(".next/BUILD_ID")) throw new Error("No production build: run `npm run build` first (or pass --base-url).");
  migrateLocalD1();
  const port = await freePort();
  const child: ChildProcess = spawn("node_modules/.bin/next", ["start", "-p", String(port)], { stdio: "ignore", detached: true });
  const stop = () => {
    try {
      process.kill(-child.pid!, "SIGTERM");
    } catch {
      // Already gone.
    }
  };
  const base = `http://localhost:${port}`;
  for (let attempt = 0; attempt < 120; attempt++) {
    if (child.exitCode !== null) break;
    let serving = false;
    try {
      serving = (await fetch(`${base}/map`)).ok;
    } catch {
      // Not listening yet.
    }
    if (serving) {
      // The homepage is checked too: a server that serves /map but fails / would otherwise surface as a locator timeout.
      const home = await fetch(`${base}/`);
      if (home.ok) return { base, stop };
      stop();
      throw new Error(`next start serves ${base}/map but ${base}/ answers ${home.status}: the homepage cannot render (for "no such table", the local D1 is not migrated: \`npm run db:migrate:local\`)`);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  stop();
  throw new Error(`next start did not serve ${base}/map`);
}
