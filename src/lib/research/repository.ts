import type {
  AdjacentArticles,
  DraftInput,
  ResearchArticle,
  ResearchArticleMetadata,
  ResearchArticleRecord,
} from "./domain";

/**
 * What the public Research pages depend on — and the *only* thing they
 * depend on. Neither /research nor /research/[slug] imports an MDX path,
 * calls fs, or knows a database exists; they call these three methods and
 * render what comes back. Swapping the implementation behind this
 * interface (MDX today, D1 eventually) requires zero changes to either
 * page — that's the seam this refactor exists to create.
 */
export interface PublicResearchRepository {
  getPublishedArticles(): Promise<ResearchArticleMetadata[]>;
  getPublishedArticleBySlug(slug: string): Promise<ResearchArticle | undefined>;
  getAdjacentPublishedArticles(slug: string): Promise<AdjacentArticles>;
}

/**
 * The eventual authoring contract — create/update/publish/unpublish/
 * delete a draft. Defined now so its shape is settled before the editor
 * and D1 work starts; nothing implements this yet.
 *
 * The MDX adapter deliberately does NOT implement this. It's not an
 * oversight — this site deploys to Cloudflare Workers, which has no
 * writable filesystem at runtime (the same constraint documented on the
 * MDX adapter's read side: it can import known .mdx files at build time,
 * but can't create new ones, or persist an edit to an existing one, once
 * deployed). A real authoring backend needs real persistence — D1, when
 * that step happens — not a workaround bolted onto file-based content.
 */
export interface ResearchAuthoringRepository {
  createDraft(input: DraftInput): Promise<ResearchArticleRecord>;
  updateDraft(slug: string, input: Partial<DraftInput>): Promise<ResearchArticleRecord>;
  publish(slug: string): Promise<ResearchArticleRecord>;
  unpublish(slug: string): Promise<ResearchArticleRecord>;
  deleteArticle(slug: string): Promise<void>;
}
