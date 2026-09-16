import Link from "next/link";
import { MonoLabel } from "@/components/ui/mono-label";
import { getResearchRepository } from "@/lib/research";

// Reads the same repository /research itself reads — getPublishedArticles()
// already returns published-only, newest-first (see
// src/lib/research/{d1,mdx}-repository.ts) — and renders every one of
// them, not a homepage-specific slice: the article list below is a
// scrollable viewport precisely so the homepage's own footprint stays
// fixed regardless of how many articles exist. Async because the
// repository is (it resolves the current Cloudflare D1 binding per call —
// see src/lib/research/index.ts's lifecycle comment).
export async function ResearchPreview() {
  const repository = await getResearchRepository();
  const articles = await repository.getPublishedArticles();

  if (articles.length === 0) return null;

  return (
    <section
      aria-labelledby="research-heading"
      className="mx-auto flex max-w-6xl flex-col gap-8 px-6 pt-14 md:pt-16"
    >
      {/* One outer Research environment, same shape as Lab's: the upper
          identity region is itself one ordinary block-level <Link> to
          /research (role, heading, and description as plain
          non-interactive children of it), and the scrollable article
          <ul> below is that Link's sibling, not its descendant — not an
          overlay, and nothing here could ever produce a nested anchor. A
          plain `group` on this Link is safe for the same reason it was
          safe on Lab's: the article grid lives outside this Link
          entirely, so `group-hover:`/`group-focus-visible:` on the
          heading below can never bleed into or be triggered by an
          article row, and hovering a row can never reach back up into
          this Link's own descendants.
          Active state (hover/focus-visible) inverts this Link's own
          plane to a light gray (#737982, an inline value — see
          systems-preview.tsx for why this isn't a token), dark
          supporting text, cyan heading — the same signal used across
          all four homepage previews, tuned down from an earlier,
          too-bright near-white version. Same DOM guarantee protects the
          article index below: it's a sibling, not a descendant, so this
          Link's group-hover/group-focus-visible styling structurally
          cannot reach it — article rows stay black regardless. */}
      <div className="border border-border bg-background">
        <Link
          href="/research"
          className="group flex flex-col gap-3 bg-surface p-6 transition-colors hover:bg-[#737982] focus-visible:bg-[#737982] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent sm:p-8"
        >
          <MonoLabel className="transition-colors group-hover:text-background group-focus-visible:text-background">
            How I think
          </MonoLabel>
          <h2
            id="research-heading"
            className="text-2xl font-semibold tracking-tight text-foreground transition-colors group-hover:text-accent group-focus-visible:text-accent sm:text-3xl"
          >
            Research
          </h2>
          <p className="max-w-xl text-muted transition-colors group-hover:text-background group-focus-visible:text-background">
            Technical questions worked through from implementation,
            failure cases, and the underlying protocol mechanics.
          </p>
        </Link>

        {/* The scrollable article index. max-h is chosen deliberately, not
            arbitrarily: at today's ~96-97px row height, 256px shows the
            first two articles in full and roughly two-thirds of the
            third — a genuine partial row, not an accidental one- or
            two-pixel sliver — so the environment communicates "more
            below, scroll for it" with today's real three articles rather
            than only once a fourth is ever published. border-t here (not
            on an inner scrolled child) is what stays put as the one fixed
            divider between the identity block and the index, since
            borders belong to the scroll container's own box, not to the
            content that moves inside it. `thin-scrollbar` (globals.css)
            restyles the native scrollbar to match the site's thin-border
            language instead of showing a default OS-styled bar; it changes
            appearance only; the browser's own vertical scrollbar still
            renders on the right, and wheel/trackpad/touch/keyboard
            scrolling all keep working exactly as native overflow
            provides. Each row's own hover/focus-visible now uses the
            same #737982 "this object is targeted" treatment as the
            environment identity above, instead of the old dark
            surface-hover step — but scoped to its own `group`, so only
            the targeted row changes; sibling rows (and the identity
            plane) are untouched. */}
        <ul className="thin-scrollbar max-h-[256px] overflow-y-auto border-t border-border">
          {articles.map((article) => (
            <li key={article.slug} className="border-t border-border first:border-t-0">
              <Link
                href={`/research/${article.slug}`}
                className="group flex flex-col gap-2 px-6 py-5 transition-colors hover:bg-[#737982] focus-visible:bg-[#737982]"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <MonoLabel className="text-dim transition-colors group-hover:text-background group-focus-visible:text-background">
                    {article.publishedAt}
                  </MonoLabel>
                  <span className="text-dim transition-colors group-hover:text-background group-focus-visible:text-background">
                    ·
                  </span>
                  <MonoLabel className="text-dim transition-colors group-hover:text-background group-focus-visible:text-background">
                    {article.category}
                  </MonoLabel>
                  <span className="text-dim transition-colors group-hover:text-background group-focus-visible:text-background">
                    ·
                  </span>
                  <MonoLabel className="text-dim transition-colors group-hover:text-background group-focus-visible:text-background">
                    {article.readingMinutes} MIN READ
                  </MonoLabel>
                </div>
                <span className="font-medium text-foreground transition-colors group-hover:text-accent group-focus-visible:text-accent">
                  {article.title}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
