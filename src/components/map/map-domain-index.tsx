"use client";

import type { MouseEvent } from "react";
import type { MapL0Entry } from "./explorer-model";

const TEXT = "font-mono text-[11px] uppercase tracking-[0.12em] sm:text-xs";
const FOCUS = "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent";
// Same boundary highlight as explorer rows: a layer 1px outside the cell's
// padding box, transparent at rest, brightening the cell's own seams to
// white/60-on-background on hover. No fill, no text change, nothing moves.
const HOVER =
  "relative before:pointer-events-none before:absolute before:-inset-px before:z-10 before:border before:border-transparent before:transition-colors hover:before:border-[color-mix(in_srgb,white_60%,var(--background))]";
const CONTAINING = "shadow-[inset_2px_0_0_0_var(--color-accent)]";

/**
 * The 27 L0 domains as an index into the explorer below: the same canonical
 * entries and column-flow grid as the homepage preview, with MAP's own
 * presentation (subtle seams, light-gray ordinals, a white boundary on hover).
 * Selecting a domain enters it as the context in place (no reload); the
 * explorer opens and reveals it. The domain containing the current context
 * carries MAP's cyan context marker.
 */
export function MapDomainIndex({
  entries,
  containingPlacementId,
  onEnter,
}: {
  entries: readonly MapL0Entry[];
  containingPlacementId: string | null;
  onEnter: (placementId: string) => void;
}) {
  const enter = (event: MouseEvent<HTMLAnchorElement>, placementId: string) => {
    // Let new-tab/window gestures follow the real /map?context= link.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onEnter(placementId);
  };

  return (
    <nav aria-label="MAP domains">
      {/* Seams as on the homepage: one border per seam, owned by one cell
          (top unless it starts a column, left from the second column). DOM
          order stays 01 → 27; from sm the grid reads down each column. */}
      <div role="list" className="grid grid-cols-1 border border-border sm:grid-flow-col sm:grid-cols-3 sm:grid-rows-9">
        {entries.map(({ placementId, label, ordinal, href }) => {
          const containing = placementId === containingPlacementId;
          return (
            <div
              role="listitem"
              key={placementId}
              className={`border-border not-first:border-t sm:[&:nth-child(9n+1)]:border-t-0 sm:[&:nth-child(n+10)]:border-l ${HOVER} ${
                containing ? CONTAINING : ""
              }`}
            >
              <a
                href={href}
                aria-current={containing ? "true" : undefined}
                onClick={(event) => enter(event, placementId)}
                className={`flex h-full items-baseline gap-3 px-4 py-3 ${TEXT} ${FOCUS}`}
              >
                <span aria-hidden="true" className="shrink-0 text-muted">
                  {ordinal}
                </span>
                <span className={`min-w-0 flex-1 [overflow-wrap:anywhere] ${containing ? "text-accent" : "text-foreground"}`}>
                  {label}
                </span>
              </a>
            </div>
          );
        })}
      </div>
    </nav>
  );
}
