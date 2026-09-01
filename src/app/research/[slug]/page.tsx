import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/container";
import { MonoLabel } from "@/components/ui/mono-label";
import { Tag } from "@/components/ui/tag";
import { getResearchRepository } from "@/lib/research";

// No more generateStaticParams/build-time prerendering: D1 bindings are
// only reachable at real request time inside a deployed Worker (same
// reasoning as /research/page.tsx), and publishing/editing an article
// through D1 is supposed to show up without a rebuild — the entire point
// of moving off build-time MDX files. Every request now reads the
// current published article fresh; an unknown or unpublished slug still
// 404s via the explicit check below, same as before.
export const dynamic = "force-dynamic";

function formatArticleDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default async function ResearchArticlePage(
  props: PageProps<"/research/[slug]">,
) {
  const { slug } = await props.params;
  const researchRepository = await getResearchRepository();

  // The page asks the repository for an article and either gets a fully
  // renderable one back or doesn't — it never knows or cares whether that
  // meant a slug lookup in an array, a file import, or a D1 query for a
  // row with status = 'published'.
  const article = await researchRepository.getPublishedArticleBySlug(slug);
  if (!article) notFound();

  const { Content } = article;
  const { newer, older } = await researchRepository.getAdjacentPublishedArticles(slug);

  return (
    <Container as="main" className="flex flex-1 flex-col gap-10 py-16">
      <Link
        href="/research"
        className="w-fit text-sm text-muted hover:text-accent transition-colors"
      >
        ← Research
      </Link>

      <div className="flex flex-col gap-3">
        <MonoLabel className="text-dim">
          RESEARCH / {article.category}
        </MonoLabel>
        <div className="flex flex-wrap items-center gap-3">
          <MonoLabel className="text-dim">
            {formatArticleDate(article.publishedAt)}
          </MonoLabel>
          <span className="text-dim">·</span>
          <MonoLabel className="text-dim">{article.readingMinutes} MIN READ</MonoLabel>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {article.title}
        </h1>
        <p className="max-w-xl text-lg text-muted">{article.description}</p>
      </div>

      <div className="flex flex-col gap-3 border-t border-border pt-8">
        <MonoLabel>ARTICLE</MonoLabel>
        <div className="max-w-xl">
          <Content />
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-border pt-8">
        <MonoLabel>TAGS</MonoLabel>
        <div className="flex flex-wrap gap-2">
          {article.tags.map((tag) => (
            <Tag key={tag}>{tag}</Tag>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-6 border-t border-border pt-8">
        <Link
          href="/research"
          className="w-fit text-sm text-muted hover:text-accent transition-colors"
        >
          ← All Research
        </Link>

        {older && (
          <Link href={`/research/${older.slug}`} className="group flex flex-col gap-1">
            <MonoLabel className="text-dim">← PREVIOUS RESEARCH</MonoLabel>
            <span className="font-medium text-foreground group-hover:text-accent transition-colors">
              {older.title}
            </span>
          </Link>
        )}

        {newer && (
          <Link href={`/research/${newer.slug}`} className="group flex flex-col gap-1">
            <MonoLabel className="text-dim">NEXT RESEARCH →</MonoLabel>
            <span className="font-medium text-foreground group-hover:text-accent transition-colors">
              {newer.title}
            </span>
          </Link>
        )}
      </div>
    </Container>
  );
}
