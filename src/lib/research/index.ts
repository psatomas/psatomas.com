/**
 * The composition root for Research's content access — the one place
 * that decides where article data actually comes from. Both public pages
 * call `getResearchRepository()` and only ever see
 * PublicResearchRepository; which concrete adapter answers is decided
 * here, fresh on every call.
 *
 * D1 is preferred whenever the RESEARCH_DB binding is reachable — that's
 * true in production once provisioned, and true locally too, since
 * `next dev` (via initOpenNextCloudflareForDev in next.config.ts) and
 * `opennextjs-cloudflare preview` both emulate D1 the same way they
 * already emulate KV. The MDX adapter is the fallback for the one case
 * that's neither: no Cloudflare context reachable at all. It's kept
 * deliberately, not as dead code — it's what the migration script reads
 * from, and a safety net if D1 is ever unreachable.
 *
 * This deliberately does NOT memoize the resolved repository across
 * calls the way earlier versions of this function did. `env.RESEARCH_DB`
 * is a Miniflare-issued stub under `next dev` / `opennextjs-cloudflare
 * preview`, and Miniflare invalidates ("poisons") every previously issued
 * stub whenever it reloads its runtime options — which can happen
 * mid-dev-server-lifetime, well after a module-scope cache variable
 * would already have captured one. A D1Database obtained on one call
 * must never be reused on a later one, so the repository is rebuilt from
 * a freshly resolved binding every time instead of being cached. The
 * per-call cost is negligible — `getCloudflareContext()` reads context
 * already established for the request, and `createD1ResearchRepository`
 * itself does no I/O, just closes over the binding it's given — and this
 * stays correct under a real deployed Worker isolate too, where nothing
 * about "resolve on every call" behaves differently than "resolve once
 * and cache" since the binding never changes for the isolate's lifetime.
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createD1ResearchRepository } from "./d1-repository";
import { createMdxResearchRepository } from "./mdx-repository";
import type { PublicResearchRepository, ResearchAuthoringRepository } from "./repository";

export async function getResearchRepository(): Promise<PublicResearchRepository> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    if (env.RESEARCH_DB) return createD1ResearchRepository(env.RESEARCH_DB);
  } catch {
    // No Cloudflare context reachable at all — fall through to MDX
    // rather than taking the route down.
  }
  return createMdxResearchRepository();
}

/**
 * The authoring-side counterpart to getResearchRepository() above — same
 * lifecycle-safe shape (resolved fresh on every call, never memoized; see
 * getResearchRepository's own comment for why), but with no MDX fallback.
 * There's nothing to fall back to: the MDX adapter can't write (see
 * repository.ts), so if RESEARCH_DB isn't reachable, authoring genuinely
 * cannot function right now and this says so plainly instead of quietly
 * handing back something that would fail in a more confusing way three
 * calls later.
 *
 * Deliberately exported separately from getResearchRepository rather than
 * widening its return type — the public repository is used from
 * completely unauthenticated pages, and nothing about resolving *that*
 * binding should ever need to know authoring exists. See
 * ./authoring-service.ts for the layer that actually gates access to
 * this with RESEARCH_AUTHOR_EMAIL.
 */
export async function getResearchAuthoringRepository(): Promise<ResearchAuthoringRepository> {
  const { env } = await getCloudflareContext({ async: true });
  if (!env.RESEARCH_DB) {
    throw new Error(
      "Research authoring requires the RESEARCH_DB binding, which isn't reachable in this environment.",
    );
  }
  return createD1ResearchRepository(env.RESEARCH_DB);
}

export { createMdxResearchRepository } from "./mdx-repository";
export { createD1ResearchRepository, SlugTakenError } from "./d1-repository";
export { slugify } from "./slug";
export { estimateReadingMinutes } from "./reading-time";

export { RESEARCH_CATEGORIES } from "./domain";
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
