import Link from "next/link";
import { Container } from "@/components/ui/container";
import { MonoLabel } from "@/components/ui/mono-label";
import { getResearchRepository } from "@/lib/research";

// D1 bindings are only reachable at real request time inside a deployed
// Worker (confirmed by how the Oracle API already works) — not during
// `next build`'s static generation, which runs as a plain Node process
// with no live Worker/binding available. Forcing this route dynamic
// means it always reads fresh from D1 on each request, which is also
// exactly what a real publishing flow needs: a new or edited article
// should show up without a full site rebuild and redeploy.
export const dynamic = "force-dynamic";

export default async function ResearchPage() {
  const researchRepository = await getResearchRepository();
  const articles = await researchRepository.getPublishedArticles();

  return (
    <Container as="main" className="flex flex-1 flex-col gap-10 py-16">
      <div className="flex flex-col gap-4">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Research
        </h1>
        <p className="max-w-xl text-muted">
          Technical research, experiments, and engineering notes from the
          Protocol Lab.
        </p>
      </div>

      <MonoLabel>LATEST</MonoLabel>

      {/* Each article is one bordered object with two planes, not a
          conventional card: a bg-surface identity/context plane (date +
          category as subordinate metadata, then the title as the primary
          identity element) over a bg-background content plane (summary +
          READ →). The whole card is a single Link — one interactive unit,
          not two nested anchors — so hover/focus feedback is restrained to
          exactly two signals: the outer border steps up from the default
          border to the solid `muted` gray (never accent — accent is
          reserved for the title text itself), and the title turns accent.
          Neither plane's background changes on interaction; metadata and
          the READ → cue stay at their resting, subordinate color in every
          state. aria-label keeps the link's accessible name to just the
          title rather than the full card's text (date, category,
          description, and "READ →" all concatenated), since screen
          readers announce a link's full text content by default. */}
      <ul className="flex flex-col gap-6">
        {articles.map((article) => (
          <li key={article.slug}>
            <Link
              href={`/research/${article.slug}`}
              aria-label={article.title}
              className="group flex flex-col border border-border transition-colors hover:border-muted focus-visible:border-muted focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
            >
              <div className="flex flex-col gap-3 bg-surface px-6 py-5 sm:px-8 sm:py-6">
                <div className="flex items-center gap-3">
                  <MonoLabel className="text-dim">{article.publishedAt}</MonoLabel>
                  <span className="text-dim">·</span>
                  <MonoLabel className="text-dim">{article.category}</MonoLabel>
                </div>
                <span className="text-xl font-semibold text-foreground transition-colors group-hover:text-accent group-focus-visible:text-accent">
                  {article.title}
                </span>
              </div>

              <div className="flex flex-col gap-4 border-t border-border bg-background px-6 py-6 sm:px-8 sm:py-8">
                <p className="max-w-xl text-muted">{article.description}</p>
                <span className="font-mono text-xs tracking-[0.08em] text-muted">
                  READ →
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </Container>
  );
}
