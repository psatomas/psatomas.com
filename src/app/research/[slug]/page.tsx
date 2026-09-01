import Link from "next/link";
import { notFound } from "next/navigation";
import type { ComponentType } from "react";
import { Container } from "@/components/ui/container";
import { MonoLabel } from "@/components/ui/mono-label";
import { Tag } from "@/components/ui/tag";
import {
  getAdjacentResearchArticles,
  getAllResearchArticles,
  getResearchArticleBySlug,
} from "@/lib/research";
import type { ResearchArticleMetadata } from "@/types";

// Prerenders every known article at build time — same as
// /projects/[slug]. Deliberately NOT setting `dynamicParams = false` here:
// confirmed empirically under real workerd that it throws
// `Internal: NoFallbackError` for every slug, known or not, because this
// project's OpenNext/Cloudflare config has no incremental-cache backend
// configured (see open-next.config.ts). Leaving `dynamicParams` at its
// default and checking the slug explicitly below — exactly what
// /projects/[slug]/page.tsx already does successfully in production — is
// the pattern actually proven to work on this stack.
export async function generateStaticParams() {
  const articles = await getAllResearchArticles();
  return articles.map((article) => ({ slug: article.slug }));
}

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

  const known = await getResearchArticleBySlug(slug);
  if (!known) notFound();

  const { default: Article, metadata } = (await import(
    `@/content/research/${slug}.mdx`
  )) as {
    default: ComponentType;
    metadata: ResearchArticleMetadata;
  };

  const { newer, older } = await getAdjacentResearchArticles(slug);

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
          RESEARCH / {metadata.category}
        </MonoLabel>
        <div className="flex flex-wrap items-center gap-3">
          <MonoLabel className="text-dim">
            {formatArticleDate(metadata.date)}
          </MonoLabel>
          <span className="text-dim">·</span>
          <MonoLabel className="text-dim">{metadata.readingMinutes} MIN READ</MonoLabel>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {metadata.title}
        </h1>
        <p className="max-w-xl text-lg text-muted">{metadata.description}</p>
      </div>

      <div className="flex flex-col gap-3 border-t border-border pt-8">
        <MonoLabel>ARTICLE</MonoLabel>
        <div className="max-w-xl">
          <Article />
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-border pt-8">
        <MonoLabel>TAGS</MonoLabel>
        <div className="flex flex-wrap gap-2">
          {metadata.tags.map((tag) => (
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
