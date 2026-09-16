import Image from "next/image";
import { MonoLabel } from "@/components/ui/mono-label";
import { SystemMap } from "@/components/sections/system-map";
import portrait from "@/assets/portrait.jpg";

// The technical territory this work currently occupies — deliberately not
// a skills list or a tool/tech stack: no TypeScript/Next.js/Foundry/viem
// here, and deliberately not an aspirational one either (no ZK/rollups/
// account abstraction) — only the concepts genuinely demonstrated by the
// Systems/Research/Lab work this site documents. Order is the fixed,
// curated reading order for the stream; not alphabetized, not grouped.
const TECH_TERRITORY_TERMS = [
  "EVM",
  "SOLIDITY",
  "EXECUTION",
  "STATE",
  "GAS",
  "INTENTS",
  "SCORING",
  "MEV",
  "DAO",
  "GOVERNANCE",
  "STAKING",
  "ORACLES",
  "ATTESTATIONS",
  "ACCESS CONTROL",
  "ACCOUNTING",
  "INDEXING",
  "FUZZING",
  "INVARIANTS",
  "SECURITY",
  "PROTOCOL DESIGN",
] as const;

/**
 * One pass of the vocabulary, term-then-separator for every entry
 * (including the last) so that two copies placed back to back — which is
 * what makes the loop below seamless — read as one continuous rhythm
 * across the seam ("...PROTOCOL DESIGN · EVM · SOLIDITY...") instead of
 * two terms running together. Purely decorative: the real, single-read
 * copy of this vocabulary lives in the sr-only span in TechnicalStream
 * below, so this is marked aria-hidden at its call site rather than here.
 */
function TechTerritoryPass({ className = "" }: { className?: string }) {
  return (
    <div className={`flex shrink-0 items-center ${className}`}>
      {TECH_TERRITORY_TERMS.map((term) => (
        <span key={term} className="flex items-center">
          <span className="font-mono text-xs uppercase tracking-[0.1em] text-accent">
            {term}
          </span>
          <span className="px-3 font-mono text-xs text-dim">·</span>
        </span>
      ))}
    </div>
  );
}

/**
 * Replaces the old static tag line and the VIEW SYSTEMS / Research Hero
 * CTAs with a single continuously moving technical-territory stream — not
 * navigation (the navbar and the four homepage environments already own
 * that), just a restrained, informational read on the breadth of current
 * protocol/EVM territory. Two back-to-back copies of the same pass inside
 * one flex row, animated from translateX(0) to translateX(-50%): because
 * the row is exactly twice the width of a single pass, -50% is exactly
 * one pass's width, so the instant the animation loops back to 0% the
 * pixels on screen are identical to the frame before — no visible seam,
 * no pause, no reverse. `linear` keeps the speed constant rather than
 * easing in/out at the loop point, which is what would otherwise make the
 * seam perceptible as a stutter.
 * Both passes are aria-hidden (this is the same content rendered twice
 * purely so the animation has something to scroll into); the sr-only
 * span below carries the one, single-read copy for assistive tech.
 * `motion-reduce:` removes the animation and hides the second pass
 * entirely, leaving one static, non-duplicated, clipped line — content
 * stays visible and meaningful, nothing is hidden outright, and nothing
 * can overflow the viewport either way since the outer wrapper stays
 * `overflow-hidden` regardless of motion preference.
 */
// mt-auto: when this sits inside a stretched flex-col column (see the
// photo+text row in Hero below), it consumes whatever leftover height
// that column has rather than sitting directly under the paragraph —
// which is what pins the stream's own bottom edge to the row's bottom
// instead of just to the end of the preceding text.
function TechnicalStream() {
  return (
    <div className="mt-auto flex flex-col gap-1">
      {/* The clipping viewport itself owns the accent border rather than
          an added wrapper: it already exists purely to define this
          object's edges (overflow-hidden), so a border on the same
          element reads as one structural rectangle, not a box drawn
          around a box. py-2 (vertical only — horizontal spacing still
          comes from the stream's own term/separator gaps, not container
          padding) keeps the border from looking like it was drawn flush
          against the existing text baseline. */}
      <div className="w-full overflow-hidden border border-accent py-2">
        <div
          aria-hidden="true"
          className="flex w-max animate-[tech-stream_48s_linear_infinite] motion-reduce:animate-none"
        >
          <TechTerritoryPass />
          <TechTerritoryPass className="motion-reduce:hidden" />
        </div>
      </div>
      <span className="sr-only">
        Technical territory: {TECH_TERRITORY_TERMS.join(", ")}
      </span>
    </div>
  );
}

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
    // pt/pb split rather than one py-*: the bottom value now matches
    // About's own top padding (pt-14/md:pt-16, see about-preview.tsx)
    // exactly, so the homepage's Hero -> separator -> About transition
    // divides into two equal gaps instead of the old py-20/28's larger,
    // unrelated bottom value leaving far more room above the separator
    // than About's own padding leaves below it. The top value is
    // untouched — nothing about the navbar relationship changed.
    <section className="mx-auto max-w-6xl px-6 pt-20 md:pt-28 pb-14 md:pb-16">
      {/* lg:items-end (not lg:items-start): the person column (photo +
          text, ending in the technical-territory stream) and the
          territory column (SystemMap + its TECHNICAL TERRITORY caption)
          aren't the same height — the caption's own line adds height
          below the map that the person column has no equivalent for —
          so top-aligning them left the two columns' closing lines
          sitting at different Y positions. Bottom-aligning the row
          instead makes both columns' actual last lines land on the same
          baseline, which is what the person column's own internal
          photo/text alignment already assumes implicitly (see the photo
          aspect-ratio comment below). */}
      <div className="flex flex-col gap-12 lg:flex-row lg:items-end lg:justify-between">
        {/* Person: the photograph beside the name and everything that
            follows it. A plain rectangular crop (no circular avatar, no
            card, no border) whose near-black backdrop matches
            --background exactly (see src/assets/portrait.jpg), so it sits
            directly on the page canvas rather than in a box beside the
            text. object-position is pushed toward the top of the source
            photo to favor the face over headroom. At lg, where this column
            sits beside the name's own content instead of stacking above
            it, the crop switches from square to a taller ratio, originally
            measured against the old static tag line's baseline so the
            photo's bottom edge lined up with it instead of ending well
            above it. The technical-territory stream that replaced that
            tag line sits at roughly the same position, but this ratio was
            not re-tuned against it specifically as part of that change. */}
        {/* min-w-0 here and on the text column below: without it, a flex
            item's default min-width is auto (effectively its content's
            max-content width), so the technical-territory stream's very
            wide animated track — intrinsically as wide as two full passes
            of the vocabulary — would force this column, and the row
            containing it, to grow to fit that width instead of clipping
            it, producing real page overflow rather than a contained
            marquee. min-w-0 lets both flex items shrink to the space the
            row actually has, so the stream's own overflow-hidden viewport
            is what clips it, as intended. */}
        {/* sm:items-stretch (not items-start): the photo and the text
            column don't have the same natural height, and which one is
            taller flips depending on viewport width (the text column
            wraps to fewer lines as it gets more room). items-start left
            whichever column was shorter ending above this row's own
            bottom edge — at some widths that was the text column, so the
            stream (its last child) stopped short of the row's actual
            bottom instead of reaching it. Stretching both columns to the
            row's full height, combined with mt-auto on TechnicalStream
            (see above), pins the stream to the bottom of its column
            regardless of which column is naturally taller — which is
            what makes it reliably reach the same row-bottom line the
            outer lg:items-end already aligns with Technical Territory's
            caption. The photo itself is unaffected: it stays sized by
            its own aspect-ratio and top-anchored; only its wrapper's
            unused, background-colored height (if any) grows. */}
        <div className="flex min-w-0 flex-col gap-8 sm:flex-row sm:items-stretch">
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

          <div className="flex min-w-0 flex-col gap-8">
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

            {/* Navigation to Systems/Research lives in the navbar and in
                each domain's own homepage preview further down the page —
                this region isn't a second navigation surface. See
                TechnicalStream above: it replaces both the old CTA row
                and the old static tag line with one continuously moving
                read on current technical territory. */}
            <TechnicalStream />
          </div>
        </div>

        {/* Territory: SystemMap, sized down to share the row with the
            photo. The caption is what turns the diagram from "a technical
            graphic placed beside the Hero" into an annotated map of this
            person's own territory — it names explicitly what the tag line
            above already lists, pointing back at the same six domains.
            gap-4 (not gap-3): matches the other MonoLabel-directly-under-
            its-referent spacing already used above (the role line above
            the name, also gap-4) — the map's own caption was sitting
            closer to it than that established rhythm, which read as
            tighter/more cramped than the rest of the Hero rather than a
            deliberate caption-tightness choice. */}
        <div className="flex flex-col items-center gap-4 lg:shrink-0 lg:items-end">
          <div className="w-full max-w-[300px]">
            <SystemMap />
          </div>
          <MonoLabel className="text-dim">TECHNICAL TERRITORY</MonoLabel>
        </div>
      </div>
    </section>
  );
}
