import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/container";
import { MonoLabel } from "@/components/ui/mono-label";
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

      {/* The publication-identity object: one bordered, non-interactive
          object in two attached planes — a bg-surface identity plane
          (category, date/read time, title) over a bg-background excerpt
          plane, split by exactly one internal divider. Not a Link (unlike
          the /research index cards this deliberately echoes): this object
          states what the article is, it doesn't navigate anywhere, so it
          gets no hover/focus treatment at all. text-accent on the
          category line (rather than the text-dim used for the same field
          on the index) is what marks it as the primary identifying
          coordinate here; text-muted (not text-dim) on the date/read-time
          row is the same bg-surface-contrast fix already applied to
          About's own identity planes — dim reads too low against surface. */}
      <div className="border border-border">
        <div className="flex flex-col gap-3 bg-surface px-6 py-5 sm:px-8 sm:py-6">
          {/* Not MonoLabel here, deliberately: MonoLabel's own base
              classString hardcodes text-muted, and Tailwind v4 emits
              utility rules in alphabetical-by-class-name order — .text-
              accent lands before .text-muted in the compiled stylesheet,
              so as two equal-specificity single-class selectors on the
              same element, .text-muted (later) always won the cascade
              regardless of prop/DOM order. A className override can only
              beat MonoLabel's built-in color when the override's class
              name sorts alphabetically after "muted" (e.g. text-warn) —
              text-accent never could. Reproducing MonoLabel's exact
              typographic classes directly here, with no competing color
              utility on the element, is what actually fixes it. */}
          <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-accent">
            RESEARCH / {article.category}
          </span>
          <div className="flex flex-wrap items-center gap-3">
            <MonoLabel className="text-muted">
              {formatArticleDate(article.publishedAt)}
            </MonoLabel>
            <span className="text-muted">·</span>
            <MonoLabel className="text-muted">{article.readingMinutes} MIN READ</MonoLabel>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {article.title}
          </h1>
        </div>
        <div className="border-t border-border bg-background px-6 py-6 sm:px-8 sm:py-8">
          <p className="max-w-xl text-lg text-muted">{article.description}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <MonoLabel>ARTICLE</MonoLabel>
        <div className="max-w-xl">
          <Content />
        </div>
      </div>

      {/* The connected tags grid — TAGS is the bg-surface identity cell,
          each tag its own bg-background cell, all one border with
          divide-x/divide-y (no gap utility) as the only lines between
          cells, so nothing reads as a separate pill/chip/button. Reuses
          MonoLabel as-is for both the identity label and every tag cell:
          MonoLabel's default text-muted is already the "subordinate,
          non-interactive" voice this needs — no accent, no hover, no
          className override anywhere in this block. Stacks to one column
          below sm (each cell full-width, divide-y draws the horizontal
          seams) and becomes one row at sm+ (divide-x draws the vertical
          seams instead); TAGS stays content-sized (sm:shrink-0) while tag
          cells share the remaining row width evenly (sm:flex-1). sm:min-w-0
          on those cells is what actually makes "no overflow" hold for any
          tag count/length: a flex item's default min-width is its own
          content's min-content size, so without this a long multi-word tag
          (e.g. "State Transition Model") could refuse to shrink past that
          and force the whole row wider than the container — same fix
          Hero already applies to its own flex row for the same reason.
          With it, the cell shrinks to its flex-basis and the MonoLabel
          text wraps inside its own cell instead. */}
      <div className="flex flex-col divide-y divide-border border border-border sm:flex-row sm:divide-x sm:divide-y-0">
        <div className="flex items-center bg-surface px-5 py-4 sm:shrink-0">
          <MonoLabel>TAGS</MonoLabel>
        </div>
        {article.tags.map((tag) => (
          <div key={tag} className="flex items-center bg-background px-5 py-4 sm:min-w-0 sm:flex-1">
            <MonoLabel>{tag}</MonoLabel>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-6">
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
