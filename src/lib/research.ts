import type { ResearchArticleMetadata } from "@/types";

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
 * Each article's metadata is a named export inside the .mdx file itself
 * (not YAML frontmatter — @next/mdx doesn't parse that, and a JS object
 * literal gets real TypeScript checking against ResearchArticleMetadata
 * that a parsed frontmatter string never would).
 */
async function loadMetadata(slug: string): Promise<ResearchArticleMetadata> {
  const mod = (await import(`@/content/research/${slug}.mdx`)) as {
    metadata: ResearchArticleMetadata;
  };
  return mod.metadata;
}

export async function getAllResearchArticles(): Promise<ResearchArticleMetadata[]> {
  const articles = await Promise.all(SLUGS.map(loadMetadata));
  return articles.sort((a, b) => b.date.localeCompare(a.date));
}

export async function getResearchArticleBySlug(
  slug: string,
): Promise<ResearchArticleMetadata | undefined> {
  if (!(SLUGS as readonly string[]).includes(slug)) return undefined;
  return loadMetadata(slug);
}
