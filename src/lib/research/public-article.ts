import { cache } from "react";
import { getResearchRepository } from "./index";

// React scopes this memoization to a server render, sharing the page and
// generateMetadata read. Bindings/repositories never survive the request.
export const getPublishedArticle = cache(async (slug: string) => {
  const repository = await getResearchRepository();
  return repository.getPublishedArticleBySlug(slug);
});
