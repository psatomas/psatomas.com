import type { MetadataRoute } from "next";
import { getAllSystems } from "@/lib/systems";
import { getResearchRepository } from "@/lib/research";
import { experiments } from "@/lib/experiments/registry";
import { siteConfig } from "@/lib/site";

// Covers every public route in the site's IA (About / Systems / Research /
// Lab). Research's entries come from the same repository the public
// /research pages read from, which means this route needs the same
// force-dynamic treatment those pages already use: D1 is only reachable
// at real request time inside a deployed Worker, not during `next build`'s
// static generation (confirmed directly — building this route without
// `dynamic` throws `D1_ERROR: no such table: articles` against next
// build's own unmigrated local emulation). /research/write and its
// children are never listed — nothing in this file even imports authoring
// code. /projects is intentionally absent too: it's a redirect-only
// compatibility path now (see next.config.ts), not a page to send
// crawlers to.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const systemEntries: MetadataRoute.Sitemap = getAllSystems().map(
    (system) => ({
      url: `${siteConfig.url}/systems/${system.slug}`,
      changeFrequency: "monthly",
      priority: 0.6,
    }),
  );

  const researchRepository = await getResearchRepository();
  const articles = await researchRepository.getPublishedArticles();
  const researchEntries: MetadataRoute.Sitemap = articles.map((article) => ({
    url: `${siteConfig.url}/research/${article.slug}`,
    lastModified: article.publishedAt,
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  const labEntries: MetadataRoute.Sitemap = experiments
    .filter((experiment) => experiment.enabled)
    .map((experiment) => ({
      url: `${siteConfig.url}/lab/${experiment.id}`,
      changeFrequency: "monthly",
      priority: 0.6,
    }));

  return [
    {
      url: siteConfig.url,
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: `${siteConfig.url}/about`,
      changeFrequency: "yearly",
      priority: 0.5,
    },
    {
      url: `${siteConfig.url}/systems`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    ...systemEntries,
    {
      url: `${siteConfig.url}/research`,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    ...researchEntries,
    {
      url: `${siteConfig.url}/lab`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    ...labEntries,
  ];
}
