import Link from "next/link";
import { MonoLabel } from "@/components/ui/mono-label";
import { getMapContextHref } from "@/components/map/explorer-model";
import { MAP_PREVIEW_TOPICS } from "./map-preview-topics";

/**
 * MAP's homepage introduction. As with Systems/Research/Lab, the identity
 * plane is the environment's single gateway link and uses the same active
 * plane treatment. Below it, its sibling previews MAP's breadth through the 27
 * L0 domains; a domain becomes a targeted entry link into /map only once it
 * names an existing placement. No tree, no disclosure, no internal scrolling.
 * The ontology grows at /map, never here.
 */
export function MapPreview() {
  return (
    <section
      aria-labelledby="map-heading"
      className="mx-auto flex max-w-6xl flex-col gap-8 px-6 pt-14 md:pt-16"
    >
      <div className="border border-border bg-background">
        <Link
          href="/map"
          className="group flex flex-col gap-3 bg-surface p-6 transition-colors hover:bg-[#737982] focus-visible:bg-[#737982] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent sm:p-8"
        >
          <div className="flex items-baseline justify-between gap-4">
            <MonoLabel className="transition-colors group-hover:text-background group-focus-visible:text-background">
              Map / Protocol Engineering
            </MonoLabel>
            {/* Internal navigation cue; the link's name comes from its text. */}
            <span
              aria-hidden="true"
              className="font-mono text-base leading-none text-muted transition-colors group-hover:text-accent group-focus-visible:text-accent"
            >
              →
            </span>
          </div>
          <h2
            id="map-heading"
            className="text-2xl font-semibold tracking-tight text-foreground transition-colors group-hover:text-accent group-focus-visible:text-accent sm:text-3xl"
          >
            Map
          </h2>
          <p className="max-w-xl text-muted transition-colors group-hover:text-background group-focus-visible:text-background">
            A knowledge environment for exploring the foundations of
            programmable and increasingly autonomous digital systems.
          </p>
        </Link>

        {/* The 27 L0 domains as one connected surface, in the same hairline
            grid language as Systems/Lab (gap-px over bg-border, black
            cells). The whole cell reacts to hover with a faint cyan tint and
            cyan label; the #737982 "targeted object" plane is reserved for
            real links, so non-actionable cells never imply navigation. One
            column below 360px (the longest word would not fit two), two
            from 360px (the last cell spans both so no empty slot shows),
            three from sm: 27 = 9 full rows. */}
        <ol
          aria-label="MAP domains"
          className="grid grid-cols-1 gap-px border-t border-border bg-border min-[360px]:grid-cols-2 sm:grid-cols-3"
        >
          {MAP_PREVIEW_TOPICS.map(({ label, placementId }, index) => {
            // Number, label, and (for links) arrow sit on one line; only
            // the two-column range stacks the number above the label, where
            // inline numbering would force mid-word breaks.
            const content = (
              <>
                <span aria-hidden="true" className="shrink-0 text-dim transition-colors group-hover:text-accent group-focus-visible:text-accent">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0 flex-1 text-muted [overflow-wrap:anywhere] transition-colors group-hover:text-accent group-focus-visible:text-accent">
                  {label}
                </span>
                {placementId ? (
                  <span aria-hidden="true" className="shrink-0 text-muted transition-colors group-hover:text-accent group-focus-visible:text-accent">
                    →
                  </span>
                ) : null}
              </>
            );
            const cell =
              "group flex h-full items-baseline gap-3 px-3 py-3 font-mono text-[11px] uppercase tracking-[0.12em] transition-colors hover:bg-accent/[0.06] min-[360px]:max-sm:flex-col min-[360px]:max-sm:items-stretch min-[360px]:max-sm:gap-1 sm:px-4 sm:text-xs";

            return (
              <li
                key={label}
                className="bg-background min-[360px]:last:col-span-2 sm:last:col-span-1"
              >
                {/* Only a topic naming an existing placement is a link; the
                    rest are plain content with visual hover identity only. */}
                {placementId ? (
                  <Link
                    href={getMapContextHref(placementId)}
                    className={`${cell} focus-visible:bg-accent/[0.06] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent`}
                  >
                    {content}
                  </Link>
                ) : (
                  <div className={cell}>{content}</div>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
