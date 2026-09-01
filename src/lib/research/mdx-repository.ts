import type { ComponentType } from "react";
import type {
  AdjacentArticles,
  ResearchArticleMetadata,
  ResearchCategory,
} from "./domain";
import type { PublicResearchRepository } from "./repository";

/**
 * The known Research article slugs — one entry per .mdx file under
 * src/content/research/. Deliberately NOT discovered via fs.readdirSync:
 * this site deploys to Cloudflare Workers, and confirmed empirically
 * (opennextjs-cloudflare preview, not just `next build`'s static
 * classification) that raw source files under src/content/ are not part
 * of the deployed Worker's bundle filesystem — `readdirSync` throws
 * ENOENT there even though the page renders statically otherwise. A
 * dynamic `import()` of a specific .mdx file IS bundler-resolved (the
 * compiled module ships in the Worker bundle just fine) — only scanning
 * the directory at runtime is unsafe. Adding an article means adding its
 * slug here alongside creating the file; both are one-line, deliberate
 * edits rather than something worth automating away yet.
 */
const SLUGS = [
  "when-an-oracle-cache-becomes-part-of-the-consistency-model",
  "why-intent-based-execution-needs-a-scoring-model",
  "modeling-the-evm-as-a-state-transition-system",
] as const;

/**
 * The shape a .mdx file's `metadata` export actually has today — every
 * article was written before `publishedAt` existed as a domain concept,
 * so the files still say `date`. This type describes that raw, on-disk
 * shape; mapping it onto the real ResearchArticleMetadata (below) is this
 * adapter's job, not something worth going back and renaming three
 * content files for.
 */
type MdxArticleMetadata = {
  slug: string;
  title: string;
  description: string;
  category: ResearchCategory;
  date: string;
  tags: string[];
  readingMinutes: number;
};

async function importArticleModule(slug: string) {
  return (await import(`@/content/research/${slug}.mdx`)) as {
    default: ComponentType;
    metadata: MdxArticleMetadata;
  };
}

function toMetadata(raw: MdxArticleMetadata): ResearchArticleMetadata {
  return {
    slug: raw.slug,
    title: raw.title,
    description: raw.description,
    category: raw.category,
    tags: raw.tags,
    readingMinutes: raw.readingMinutes,
    publishedAt: raw.date,
  };
}

/**
 * Every MDX-backed article is implicitly published — the file-based
 * content model predates drafts entirely, so there's nothing to filter.
 * `getPublishedArticles()` returning "all of them" is correct here, not
 * a shortcut; a D1 adapter would need a real `WHERE status = 'published'`
 * in the same method.
 */
export function createMdxResearchRepository(): PublicResearchRepository {
  async function loadMetadata(slug: string): Promise<ResearchArticleMetadata> {
    const mod = await importArticleModule(slug);
    return toMetadata(mod.metadata);
  }

  async function getAllSorted(): Promise<ResearchArticleMetadata[]> {
    const articles = await Promise.all(SLUGS.map(loadMetadata));
    return articles.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  }

  return {
    getPublishedArticles: getAllSorted,

    async getPublishedArticleBySlug(slug) {
      if (!(SLUGS as readonly string[]).includes(slug)) return undefined;
      const mod = await importArticleModule(slug);
      return { ...toMetadata(mod.metadata), Content: mod.default };
    },

    async getAdjacentPublishedArticles(slug): Promise<AdjacentArticles> {
      const articles = await getAllSorted();
      const index = articles.findIndex((article) => article.slug === slug);
      if (index === -1) return { newer: null, older: null };

      return {
        newer: index > 0 ? articles[index - 1] : null,
        older: index < articles.length - 1 ? articles[index + 1] : null,
      };
    },
  };
}
