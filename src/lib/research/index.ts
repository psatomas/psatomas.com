/**
 * The composition root for Research's content access. This is the one
 * line that decides where article data actually comes from — everything
 * else (both public pages) imports `researchRepository` and the types
 * below, never a concrete adapter. Switching to D1 later means changing
 * this one line to `createD1ResearchRepository(...)`, not touching
 * /research or /research/[slug] at all.
 */
import { createMdxResearchRepository } from "./mdx-repository";

export const researchRepository = createMdxResearchRepository();

export type {
  AdjacentArticles,
  ArticleStatus,
  DraftInput,
  ResearchArticle,
  ResearchArticleMetadata,
  ResearchArticleRecord,
  ResearchCategory,
} from "./domain";
export type { PublicResearchRepository, ResearchAuthoringRepository } from "./repository";
