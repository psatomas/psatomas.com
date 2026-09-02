import Link from "next/link";
import { MonoLabel } from "@/components/ui/mono-label";
import { SectionIntro, SectionLink } from "@/components/sections/section-intro";
import { getResearchRepository } from "@/lib/research";

const PREVIEW_COUNT = 3;

// Reads the same repository /research itself reads — getPublishedArticles()
// already returns published-only, newest-first (see
// src/lib/research/{d1,mdx}-repository.ts), so "latest 3" is just a slice,
// not a second query or a duplicated data source. Async because the
// repository is (it resolves the current Cloudflare D1 binding per call —
// see src/lib/research/index.ts's lifecycle comment).
export async function ResearchPreview() {
  const repository = await getResearchRepository();
  const articles = (await repository.getPublishedArticles()).slice(0, PREVIEW_COUNT);

  if (articles.length === 0) return null;

  return (
    <section aria-labelledby="research-heading" className="mx-auto max-w-6xl px-6 py-16 md:py-20">
      <div className="flex flex-col gap-8 border-t border-border pt-16 md:pt-20">
        <SectionIntro
          id="research-heading"
          role="How I think"
          heading="Research"
        />

        <ul className="flex flex-col">
          {articles.map((article) => (
            <li key={article.slug} className="border-t border-border first:border-t-0">
              <Link
                href={`/research/${article.slug}`}
                className="group flex flex-col gap-2 py-5"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <MonoLabel className="text-dim">{article.publishedAt}</MonoLabel>
                  <span className="text-dim">·</span>
                  <MonoLabel className="text-dim">{article.category}</MonoLabel>
                  <span className="text-dim">·</span>
                  <MonoLabel className="text-dim">
                    {article.readingMinutes} MIN READ
                  </MonoLabel>
                </div>
                <span className="font-medium text-foreground group-hover:text-accent transition-colors">
                  {article.title}
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <SectionLink href="/research">View all research</SectionLink>
      </div>
    </section>
  );
}
