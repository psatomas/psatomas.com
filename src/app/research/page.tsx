import Link from "next/link";
import { Container } from "@/components/ui/container";
import { MonoLabel } from "@/components/ui/mono-label";
import { researchRepository } from "@/lib/research";

export default async function ResearchPage() {
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

      <div className="border-t border-border pt-8">
        <MonoLabel>LATEST</MonoLabel>
      </div>

      <ul className="flex flex-col">
        {articles.map((article) => (
          <li
            key={article.slug}
            className="flex flex-col gap-2 border-t border-border py-8 first:border-t-0 first:pt-0"
          >
            <div className="flex items-center gap-3">
              <MonoLabel className="text-dim">{article.publishedAt}</MonoLabel>
              <span className="text-dim">·</span>
              <MonoLabel className="text-dim">{article.category}</MonoLabel>
            </div>

            <Link
              href={`/research/${article.slug}`}
              className="w-fit text-xl font-semibold text-foreground hover:text-accent transition-colors"
            >
              {article.title}
            </Link>

            <p className="max-w-xl text-muted">{article.description}</p>

            <Link
              href={`/research/${article.slug}`}
              className="w-fit font-mono text-xs tracking-[0.08em] text-muted hover:text-accent transition-colors"
            >
              READ →
            </Link>
          </li>
        ))}
      </ul>
    </Container>
  );
}
