import Image from "next/image";
import Link from "next/link";
import { MonoLabel } from "@/components/ui/mono-label";
import { SectionLink } from "@/components/sections/section-intro";
import { SystemMap } from "@/components/sections/system-map";
import portrait from "@/assets/portrait.jpg";

// The identity anchor for the whole homepage — the one place the name
// itself, not just the work, is the headline. One row at the widest
// breakpoint: photo + everything about the person on the left, SystemMap
// pinned to the right via justify-between so it fills the space that would
// otherwise sit empty beside a name that doesn't need the full row width —
// not a second row stacked below it, which left a visible gap above the
// map. SystemMap is deliberately smaller here than it was pre-photo (see
// the max-w-[300px] wrapper) — the tradeoff for sharing the row with a
// photo now claiming its own width. Not duplicated into
// About/Systems/Research/Lab previews further down the page.
export function Hero() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20 md:py-28">
      <div className="flex flex-col gap-12 lg:flex-row lg:items-start lg:justify-between">
        {/* Person: the photograph beside the name and everything that
            follows it. A plain rectangular crop (no circular avatar, no
            card, no border) whose near-black backdrop matches
            --background exactly (see src/assets/portrait.jpg), so it sits
            directly on the page canvas rather than in a box beside the
            text. object-position is pushed toward the top of the source
            photo to favor the face over headroom. At lg, where this column
            sits beside the name's own content instead of stacking above
            it, the crop switches from square to a taller ratio (measured
            against the actual rendered tag line below, "EVM · SOLIDITY ·
            PROTOCOL DESIGN · DISTRIBUTED SYSTEMS") so the photo's bottom
            edge lines up with that line's baseline instead of ending well
            above it. */}
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start">
          <div className="w-full max-w-[220px] shrink-0 overflow-hidden sm:max-w-[260px]">
            <Image
              src={portrait}
              alt="Tomás Araújo"
              placeholder="blur"
              className="h-auto w-full object-cover aspect-square lg:aspect-[260/302]"
              style={{ objectPosition: "50% 25%" }}
              sizes="(min-width: 640px) 260px, 220px"
              priority
            />
          </div>

          <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-4">
              <MonoLabel>PROTOCOL ENGINEER / 2026</MonoLabel>
              <h1 className="text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
                TOMÁS ARAÚJO
              </h1>
            </div>

            <p className="max-w-md text-lg text-muted">
              I build and investigate blockchain protocols, execution
              environments, and distributed infrastructure.
            </p>

            {/* One primary path (Systems — concrete, shipped work) plus
                one quiet secondary one (Research), not a row of
                equal-weight buttons. Lab isn't given its own Hero-level
                CTA: it's the homepage's own closing section, already
                reachable from there and from nav, and doesn't need a
                shortcut competing with Research for the same visual
                weight. */}
            <div className="flex flex-wrap items-center gap-6">
              <Link
                href="/systems"
                className="border border-accent bg-accent px-5 py-2.5 font-mono text-xs tracking-[0.1em] text-accent-foreground transition-colors hover:bg-transparent hover:text-accent"
              >
                VIEW SYSTEMS
              </Link>
              <SectionLink href="/research">Research</SectionLink>
            </div>

            <MonoLabel className="text-dim">
              EVM · SOLIDITY · PROTOCOL DESIGN · DISTRIBUTED SYSTEMS
            </MonoLabel>
          </div>
        </div>

        {/* Territory: SystemMap, sized down to share the row with the
            photo. The caption is what turns the diagram from "a technical
            graphic placed beside the Hero" into an annotated map of this
            person's own territory — it names explicitly what the tag line
            above already lists, pointing back at the same six domains. */}
        <div className="flex flex-col items-center gap-3 lg:shrink-0 lg:items-end">
          <div className="w-full max-w-[300px]">
            <SystemMap />
          </div>
          <MonoLabel className="text-dim">TECHNICAL TERRITORY</MonoLabel>
        </div>
      </div>
    </section>
  );
}
