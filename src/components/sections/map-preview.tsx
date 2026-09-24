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

        {/* The 27 L0 domains as one surface divided by shared seams. Each
            seam is a single 1px border owned by exactly one cell (top border
            unless the cell starts a column; left border from the second
            column) rather than gap-px over a translucent bg-border: gaps
            land on fractional device pixels under display scaling and
            anti-alias unevenly, and a translucent border over a translucent
            background compounds into a brighter line. The hover plane lives
            on the inner cell, inside the borders, so seams never change.
            Mobile is one column, 01 → 27; from sm the grid flows by column
            (9 rows), reading 01–09, 10–18, 19–27 while DOM order stays 01 → 27.
            The palette is Lab's: cyan index and light label at rest; on
            hover the #737982 plane with a dark index and cyan label. */}
        <ol
          aria-label="MAP domains"
          className="grid grid-cols-1 border-t border-border sm:grid-flow-col sm:grid-cols-3 sm:grid-rows-9"
        >
          {MAP_PREVIEW_TOPICS.map(({ label, placementId }, index) => {
            const content = (
              <>
                <span aria-hidden="true" className="shrink-0 text-accent transition-colors group-hover:text-background group-focus-visible:text-background">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0 flex-1 text-foreground [overflow-wrap:anywhere] transition-colors group-hover:text-accent group-focus-visible:text-accent">
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
              "group flex h-full items-baseline gap-3 px-4 py-3 font-mono text-[11px] uppercase tracking-[0.12em] transition-colors hover:bg-[#737982] sm:text-xs";

            return (
              <li
                key={label}
                className="border-border not-first:border-t sm:[&:nth-child(9n+1)]:border-t-0 sm:[&:nth-child(n+10)]:border-l"
              >
                {/* Only a topic naming an existing placement is a link; the
                    rest are plain content with visual hover identity only. */}
                {placementId ? (
                  <Link
                    href={getMapContextHref(placementId)}
                    className={`${cell} focus-visible:bg-[#737982] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent`}
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
