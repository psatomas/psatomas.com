/**
 * The composition root for Research's content access — the one place
 * that decides where article data actually comes from. Both public pages
 * call `getResearchRepository()` and only ever see
 * PublicResearchRepository; which concrete adapter answers is decided
 * here, once per warm isolate, exactly the same lazy-memoized pattern
 * already proven in src/app/api/oracle/route.ts for reaching a Cloudflare
 * binding from a Next.js route.
 *
 * D1 is preferred whenever the RESEARCH_DB binding is reachable — that's
 * true in production once provisioned, and true locally too, since
 * `next dev` (via initOpenNextCloudflareForDev in next.config.ts) and
 * `opennextjs-cloudflare preview` both emulate D1 the same way they
 * already emulate KV. The MDX adapter is the fallback for the one case
 * that's neither: no Cloudflare context reachable at all. It's kept
 * deliberately, not as dead code — it's what the migration script reads
 * from, and a safety net if D1 is ever unreachable.
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createD1ResearchRepository } from "./d1-repository";
import { createMdxResearchRepository } from "./mdx-repository";
import type { PublicResearchRepository } from "./repository";

let cached: Promise<PublicResearchRepository> | null = null;

export async function getResearchRepository(): Promise<PublicResearchRepository> {
  if (!cached) {
    cached = (async () => {
      try {
        const { env } = await getCloudflareContext({ async: true });
        if (env.RESEARCH_DB) return createD1ResearchRepository(env.RESEARCH_DB);
      } catch {
        // No Cloudflare context reachable at all — fall through to MDX
        // rather than taking the route down.
      }
      return createMdxResearchRepository();
    })();
  }
  return cached;
}

export { createMdxResearchRepository } from "./mdx-repository";
export { createD1ResearchRepository } from "./d1-repository";

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
