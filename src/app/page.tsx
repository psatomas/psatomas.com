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
      <AboutPreview />
      <SystemsPreview />
      <ResearchPreview />
      <LabPreview />
    </main>
  );
}
