import type { ComponentType } from "react";

/**
 * Research's domain model — storage-independent on purpose. Nothing here
 * knows about .mdx files or D1; both are just implementations of the
 * repository interface in ./repository.ts. This is what lets the public
 * pages depend on a shape instead of a source.
 */

/**
 * The known Research categories — a closed union rather than a free
 * string now that there's real content to base it on. Add a new one here
 * deliberately, in the same commit as the article that needs it, rather
 * than letting near-duplicate strings ("Protocol engineering" vs
 * "Protocol Engineering") accumulate silently. Tags stay a free string[]
 * — there's no fixed set of those, and no filtering feature yet that
 * would need one.
 */
export type ResearchCategory = "EVM" | "Protocol Engineering" | "Distributed Systems";

export type ArticleStatus = "draft" | "published";

/**
 * What the public UI actually consumes — always a published article, so
 * `publishedAt` is never null here (contrast ResearchArticleRecord below,
 * where a draft genuinely has no publish date yet). This is intentionally
 * the same shape the MDX-backed content already had, just with `date`
 * renamed to `publishedAt` to match the eventual stored record — the
 * public pages don't need `status` or timestamps they never display.
 */
export type ResearchArticleMetadata = {
  slug: string;
  title: string;
  description: string;
  category: ResearchCategory;
  tags: string[];
  readingMinutes: number;
  /** ISO date string, e.g. "2026-08-29" — sortable as-is. */
  publishedAt: string;
};

/** Metadata plus the actual renderable body. `Content` is a component
 * regardless of where the article came from: the MDX adapter gets it from
 * a build-time file import, a future D1 adapter would get it by compiling
 * the stored Markdown/MDX string into a component at read time. Either
 * way, the page just renders `<Content />` and never knows which. */
export type ResearchArticle = ResearchArticleMetadata & {
  Content: ComponentType;
};

export type AdjacentArticles = {
  newer: ResearchArticleMetadata | null;
  older: ResearchArticleMetadata | null;
};

/**
 * The full authoring-side record — every field a draft-to-published
 * article needs, independent of MDX and D1. Not consumed by the public
 * pages at all; exists so the eventual write operations (see
 * ResearchAuthoringRepository) have a settled shape to work with before
 * anything actually implements them. `content` is raw Markdown/MDX
 * source — the editable, storable form — as distinct from `Content`
 * above, which is that source already compiled into something renderable.
 */
export type ResearchArticleRecord = {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: ResearchCategory;
  tags: string[];
  content: string;
  readingMinutes: number;
  status: ArticleStatus;
  /** Null until the article is published for the first time. */
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Fields an author actually provides when writing or editing a draft —
 * everything on ResearchArticleRecord except what the system assigns
 * itself (id, status, timestamps). */
export type DraftInput = {
  title: string;
  description: string;
  category: ResearchCategory;
  tags: string[];
  content: string;
  readingMinutes: number;
};
