import { Hero } from "@/components/sections/hero";
import { AboutPreview } from "@/components/sections/about-preview";
import { SystemsPreview } from "@/components/sections/systems-preview";
import { ResearchPreview } from "@/components/sections/research-preview";
import { LabPreview } from "@/components/sections/lab-preview";

// The narrative is deliberate and matches the site's own conceptual model
// — person, then work, then thinking, then exploration — not an order to
// rebalance by content volume: Hero (who) -> About (who, in more words)
// -> Systems (what I build) -> Research (how I think) -> Lab (what I
// explore). Every section below Hero reads from its own domain's existing
// source (systems.ts, the Research repository, the experiment registry)
// with no homepage-specific data file duplicating any of it.
//
// force-dynamic for the same reason /research/page.tsx already needs it:
// ResearchPreview reads the same D1-backed repository, which is only
// reachable at real request time inside a deployed Worker. Without this,
// `next build` prerenders `/` once using the MDX fallback content (the
// only thing reachable at build time) and a newly published article would
// never appear on the homepage without a full rebuild+redeploy — exactly
// the staleness D1 was adopted to avoid on /research itself.
export const dynamic = "force-dynamic";

export default async function Home() {
  return (
    <main className="flex-1">
      <Hero />

      {/* The one structural transition line on the homepage: it marks
          the shift from the introductory region (Hero, including
          Technical Territory) into the content environments below —
          not "About's top border." Each environment below already owns
          its own outer border (see About/Systems/Research/LabPreview),
          so this lives here, at the page-composition level, rather
          than being baked into whichever preview happens to render
          first. Its own vertical rhythm comes from its neighbors —
          Hero's bottom padding above, AboutPreview's own top padding
          below — reproducing the exact spacing the old
          border-t-on-AboutPreview had, without that border being
          conceptually About's.
          The outer/inner split matters for width, not just structure:
          border-t on the same element as px-6 draws the line at that
          element's full border-box width, since padding sits inside
          the border and never insets it — that's what made the line
          wider than every environment's own box below it, each of
          which nests its border on a child *inside* a px-6 wrapper.
          Mirroring that same outer-wrapper/inner-border split here is
          what makes the line's endpoints land exactly where those
          environment borders do. */}
      <div aria-hidden="true" className="mx-auto max-w-6xl px-6">
        <div className="border-t border-border" />
      </div>

      <AboutPreview />
      <SystemsPreview />
      <ResearchPreview />
      <LabPreview />
    </main>
  );
}
