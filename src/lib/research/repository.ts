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
 * The authoring contract — list/retrieve/create/update/publish/unpublish/
 * delete. Identified by `id` rather than `slug`: unlike the public read
 * side (where the slug *is* the identity a URL carries), the authoring
 * side needs an identifier that survives a slug edit — a draft's slug can
 * change before it's ever public, and `id` is what makes that a plain
 * field update instead of a rename of the lookup key itself. See
 * ./authoring-service.ts for the layer that adds the authorization check
 * in front of every one of these.
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
  /** Every article regardless of status, newest-updated first — the
   * source for the /research/write list. Single-author, so this is
   * simply "all of them"; there's no per-author filter to apply. */
  listArticles(): Promise<ResearchArticleRecord[]>;
  /** Any status, unlike the public repository's slug lookup — the editor
   * needs to reopen a draft that was never published. */
  getArticleById(id: string): Promise<ResearchArticleRecord | null>;
  createDraft(input: DraftInput): Promise<ResearchArticleRecord>;
  updateDraft(id: string, input: Partial<DraftInput>): Promise<ResearchArticleRecord>;
  publish(id: string): Promise<ResearchArticleRecord>;
  unpublish(id: string): Promise<ResearchArticleRecord>;
  deleteArticle(id: string): Promise<void>;
}
