import Link from "next/link";
import { MonoLabel } from "@/components/ui/mono-label";
import { getMapContextHref } from "@/components/map/explorer-model";
import { MAP_PREVIEW_TOPICS } from "./map-preview-topics";

/**
 * MAP's homepage introduction. As with Systems/Research/Lab, the identity
 * plane is the environment's single gateway link and uses the same active
 * plane treatment. The territory preview below is its sibling, informational
 * except for topics that name an existing placement, which are targeted entry
 * links into /map. No tree, no disclosure, no internal scrolling. The
 * ontology grows at /map, never here.
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

        <ul
          aria-label="Selected territory"
          className="grid grid-cols-1 gap-x-8 gap-y-3 border-t border-border px-5 py-5 sm:grid-cols-2 sm:px-6 lg:grid-cols-3"
        >
          {MAP_PREVIEW_TOPICS.map(({ label, placementId }) => (
            <li
              key={label}
              className="min-w-0 font-mono text-[11px] uppercase tracking-[0.12em] text-foreground sm:text-xs"
            >
              {/* Targeted entry: opens /map at this placement. The persistent
                  arrow marks it as a link without relying on hover. */}
              {placementId ? (
                <Link
                  href={getMapContextHref(placementId)}
                  className="group inline-flex items-baseline gap-2 transition-colors hover:text-accent focus-visible:text-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
                >
                  {label}
                  <span aria-hidden="true" className="text-muted transition-colors group-hover:text-accent group-focus-visible:text-accent">
                    →
                  </span>
                </Link>
              ) : (
                label
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
