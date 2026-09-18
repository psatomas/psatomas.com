import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { articleSocial, experimentSocial, systemSocial, resolveSocialPath, staticSocial } from "./content.ts";
import { titleLayout, wrapText, supportingLine } from "./image-layout.ts";
import { brandMark, brandWordmark } from "./brand-assets.ts";
import type { System, ExperimentDefinition } from "../../types/index.ts";
import type { ResearchArticleMetadata } from "../research/domain.ts";

const system: System = { slug: "future-system", name: "Future System", formalName: "Formal Name",
  summary: "Canonical summary", tagline: "Canonical tagline", description: [], stack: [] };
const experiment: ExperimentDefinition & { enabled: boolean } = { id: "oracle", index: "03", title: "ORACLES",
  subtitle: "ON-CHAIN × OFF-CHAIN DATA", description: "Substantive description", designation: "Experiment 03",
  Component: () => null, enabled: true };
const article: ResearchArticleMetadata = { slug: "newly-published", title: "A newly published article",
  description: "Actual excerpt", category: "Distributed Systems", publishedAt: "2026-09-18T12:34:56.000Z",
  tags: ["Consistency"], readingMinutes: 5 };
const sources = {
  system: (slug: string) => slug === system.slug ? system : undefined,
  experiment: (id: string) => id === experiment.id ? experiment : undefined,
  publishedArticle: async (slug: string) => slug === article.slug ? article : undefined,
};

test("Systems mapping preserves canonical fields and website type for future entries", async () => {
  const descriptor = systemSocial(system);
  assert.deepEqual(descriptor, { path: "/systems/future-system", title: system.name, description: system.summary,
    supporting: system.tagline, category: system.formalName, environment: "SYSTEMS", type: "website" });
  assert.deepEqual(await resolveSocialPath(["systems", system.slug], sources), descriptor);
});

test("Lab mapping uses substantive description and registry identity", async () => {
  const descriptor = experimentSocial(experiment);
  assert.equal(descriptor.description, experiment.description);
  assert.equal(descriptor.category, experiment.subtitle);
  assert.equal(descriptor.environment, "LAB / EXP. 03");
  assert.equal(descriptor.type, "website");
  assert.deepEqual(await resolveSocialPath(["lab", "oracle"], sources), descriptor);
});

test("published Research resolves without a hardcoded slug list and retains its data", async () => {
  const descriptor = await resolveSocialPath(["research", article.slug], sources);
  assert.deepEqual(descriptor, articleSocial(article));
  assert.equal(descriptor?.publishedAt, article.publishedAt);
  assert.equal(descriptor?.category, article.category);
  assert.deepEqual(descriptor?.tags, article.tags);
});

test("missing and unpublished Research never resolve to a fallback identity", async () => {
  const requested: string[] = [];
  const publicOnly = { ...sources, publishedArticle: async (slug: string) => {
    requested.push(slug);
    return undefined; // The public repository returns undefined for drafts and missing rows.
  } };
  for (const slug of ["missing", "draft"]) assert.equal(await resolveSocialPath(["research", slug], publicOnly), undefined);
  assert.deepEqual(requested, ["missing", "draft"]);
});

test("missing/disabled Lab and unknown Systems reject", async () => {
  assert.equal(await resolveSocialPath(["lab", "missing"], sources), undefined);
  assert.equal(await resolveSocialPath(["lab", "oracle"], { ...sources, experiment: () => ({ ...experiment, enabled: false }) }), undefined);
  assert.equal(await resolveSocialPath(["systems", "missing"], sources), undefined);
});

test("only known public paths resolve; hostile paths never trigger source reads", async () => {
  const fail = () => { throw new Error("Unexpected source read"); };
  for (const path of [[], ["home"], ["https://evil.test"], ["research", ".."], ["research", "%2e%2e"],
    ["research", "slug?title=evil"], ["systems", "x/y"], ["lab", "evm", "extra"], ["research", "<script>"], ["api", "oracle"]]) {
    assert.equal(await resolveSocialPath(path, { system: fail, experiment: fail, publishedArticle: fail }), undefined);
  }
  for (const key of ["about", "systems", "research", "lab"] as const) {
    assert.deepEqual(await resolveSocialPath([key], sources), staticSocial[key]);
  }
});

test("long real title fits without abbreviation, while pathological titles stay readable", () => {
  const title = "When an Oracle Cache Becomes Part of the Consistency Model";
  const layout = titleLayout(title);
  assert.equal(layout.lines.join(" "), title);
  assert.ok(layout.lines.length <= 4);
  assert.ok(layout.fontSize >= 48);
  const enormous = titleLayout("W".repeat(1000));
  assert.equal(enormous.lines.length, 4);
  assert.equal(enormous.fontSize, 48);
  assert.ok(enormous.lines[3].endsWith("…"));
  assert.ok(wrapText("W".repeat(100), 64, 1040).every((line) => line.length <= 16));
  assert.equal(supportingLine(undefined), "");
  assert.ok(supportingLine("Support ".repeat(100)).endsWith("…"));
});

test("embedded brand PNGs are byte-for-byte copies of existing transparent assets", () => {
  for (const [embedded, file] of [[brandMark, "psat-mark-footer.png"], [brandWordmark, "psatomas-wordmark-navbar.png"]]) {
    assert.deepEqual(Buffer.from(embedded.split(",")[1], "base64"), readFileSync(new URL(`../../assets/${file}`, import.meta.url)));
  }
});
