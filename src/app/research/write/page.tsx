import Link from "next/link";
import { Container } from "@/components/ui/container";
import { MonoLabel } from "@/components/ui/mono-label";
import { authoringService } from "@/lib/research/authoring-service";

// Reads through next-auth's session cookie (via authoringService's own
// authorization check) on every request, so this page is already dynamic
// in practice; explicit for the same reason /research/page.tsx is: a
// newly created or edited draft should show up immediately, never served
// from a cached render.
export const dynamic = "force-dynamic";

function formatUpdatedAt(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default async function ResearchWritePage() {
  const result = await authoringService.listArticles();

  return (
    <Container as="main" className="flex flex-1 flex-col gap-10 py-16">
      <div className="flex flex-col gap-4">
        <MonoLabel className="text-dim">RESEARCH / WRITE</MonoLabel>
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Articles</h1>
          <Link
            href="/research/write/new"
            className="shrink-0 rounded border border-border-strong px-3 py-1.5 font-mono text-xs uppercase tracking-[0.08em] text-foreground hover:border-accent hover:text-accent transition-colors"
          >
            + New Article
          </Link>
        </div>
      </div>

      {!result.ok ? (
        <p className="text-warn">{result.message}</p>
      ) : result.data.length === 0 ? (
        <p className="text-muted">No articles yet — start with “+ New Article” above.</p>
      ) : (
        <ul className="flex flex-col border-t border-border">
          {result.data.map((article) => (
            <li key={article.id}>
              <Link
                href={`/research/write/${article.id}`}
                className="group flex flex-col gap-2 border-b border-border py-6 hover:bg-surface-hover transition-colors"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <MonoLabel
                    className={article.status === "published" ? "text-accent" : "text-warn"}
                  >
                    {article.status.toUpperCase()}
                  </MonoLabel>
                  <span className="text-dim">·</span>
                  <MonoLabel className="text-dim">{article.category}</MonoLabel>
                  <span className="text-dim">·</span>
                  <MonoLabel className="text-dim">
                    UPDATED {formatUpdatedAt(article.updatedAt)}
                  </MonoLabel>
                </div>
                <span className="font-medium text-foreground group-hover:text-accent transition-colors">
                  {article.title}
                </span>
                <span className="font-mono text-xs text-dim">/research/{article.slug}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Container>
  );
}
