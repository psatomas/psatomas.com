"use client";

import { Fragment, useEffect, useId, useMemo, useRef, useState } from "react";
import type { Ref } from "react";
import { useSearchParams } from "next/navigation";
import { MonoLabel } from "@/components/ui/mono-label";
import { ConceptExposition } from "./concept-exposition";
import {
  activateMapExplorerRow,
  getInitialMapExplorerState,
  getMapContextHref,
  getMapExplorerContext,
  getVisibleMapExplorerRegions,
  indexMapExplorerView,
  MAP_CONTEXT_PARAM,
  resolveMapContextParam,
  revealMapExplorerContext,
} from "./explorer-model";
import type { MapExplorerContextStep, MapExplorerRow, MapExplorerView } from "./explorer-model";

// Visual semantics are deliberately separate: graphite planes mark structural
// regions, the inset accent bar marks the reader's current context, and the
// +/− cell marks disclosure state. None of them derive geometry from depth.
const FOCUSED_ROW = "shadow-[inset_2px_0_0_0_var(--color-accent)]";
const LABEL_TEXT = "font-mono text-[11px] uppercase tracking-[0.12em] sm:text-xs";
const CONTROL_FOCUS = "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent";
// Hover identifies the whole interactive row with the site's grid-cell
// treatment (/systems, /lab: the cell boundary brightens to white/60 over the
// page background). MAP rows share 1px seams instead of owning borders, so a
// layer, transparent at rest, sits 1px outside the row's padding box: exactly
// over its top seam (its own, or the one above the first row), the seam below,
// and the region's side borders. The colour is that same white/60-on-background
// result, opaque, so seams brighten to the identical tone rather than stacking.
// Nothing moves; the inset cyan context bar lies inside the layer, and keyboard
// focus keeps its own outline.
const ROW_HOVER =
  "relative before:pointer-events-none before:absolute before:-inset-px before:z-10 before:border before:border-transparent before:transition-colors hover:before:border-[color-mix(in_srgb,white_60%,var(--background))]";
// A revealed row lands just below the sticky navbar with 24px of room above
// it: the navbar is up to 117px while its items wrap below sm (three lines at
// 320px) and 65px from sm.
const REVEAL_MARGIN = "scroll-mt-[141px] sm:scroll-mt-[89px]";

/** A request to bring a placement's row into view; the nonce makes each request distinct. */
type RevealRequest = { placementId: string; behavior: "auto" | "smooth"; nonce: number };

/**
 * One source of truth per concern: the URL's `?context=` owns the active
 * placement (so refresh, sharing, and Back/Forward reconstruct it), while
 * disclosure is local state that no context change ever closes. Each row is
 * one control whose activation combines the two (activateMapExplorerRow);
 * bringing a row into view is a separate, explicit request.
 */
export function RecursiveMapExplorer({ view }: { view: MapExplorerView }) {
  const index = useMemo(() => indexMapExplorerView(view), [view]);
  const focusedPlacementId = resolveMapContextParam(index, useSearchParams().getAll(MAP_CONTEXT_PARAM));
  const [expandedPlacementIds, setExpandedPlacementIds] = useState(
    () => getInitialMapExplorerState(view, focusedPlacementId).expandedPlacementIds,
  );
  // An entry context (direct link, homepage, refresh) is brought into view once.
  const [reveal, setReveal] = useState<RevealRequest | null>(() =>
    focusedPlacementId ? { placementId: focusedPlacementId, behavior: "auto", nonce: 0 } : null,
  );
  // When the URL context changes (a row, the breadcrumb, Back/Forward), open
  // the placement and its ancestors during render, before paint, and bring it
  // into view unless that was already requested; open branches stay open.
  const [revealedFor, setRevealedFor] = useState(focusedPlacementId);
  if (revealedFor !== focusedPlacementId) {
    setRevealedFor(focusedPlacementId);
    setExpandedPlacementIds((current) => revealMapExplorerContext(current, index, focusedPlacementId, true));
    if (focusedPlacementId) {
      setReveal((current) =>
        current?.placementId === focusedPlacementId
          ? current
          : { placementId: focusedPlacementId, behavior: "auto", nonce: (current?.nonce ?? 0) + 1 },
      );
    }
  }
  const regions = getVisibleMapExplorerRegions(view, expandedPlacementIds);
  const context = getMapExplorerContext(index, focusedPlacementId);
  const rowHintId = useId();
  const contextRef = useRef<HTMLElement>(null);
  // Where keyboard focus goes once a breadcrumb move or Clear has rendered,
  // since both remove the control that was activated.
  const pendingFocusRef = useRef<{ target: string | null } | null>(null);

  useEffect(() => {
    const pending = pendingFocusRef.current;
    if (!pending) return;
    pendingFocusRef.current = null;
    const control = pending.target
      ? document.querySelector<HTMLElement>(`[data-placement-id="${CSS.escape(pending.target)}"] [data-row-control]`)
      : null;
    (control ?? contextRef.current)?.focus({ preventScroll: true });
  }, [focusedPlacementId]);

  // The URL's context decides what is brought into view, so the browser's own
  // scroll restoration (a remembered offset for each history entry) must not
  // override it on Back/Forward. Restored to its previous value on unmount.
  useEffect(() => {
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    return () => {
      window.history.scrollRestoration = previous;
    };
  }, []);

  // Scrolling happens only for an explicit request, never on other renders.
  useEffect(() => {
    if (!reveal) return;
    const row = document.querySelector<HTMLElement>(`[data-placement-id="${CSS.escape(reveal.placementId)}"]`);
    const smooth = reveal.behavior === "smooth" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    row?.scrollIntoView({ block: "start", behavior: smooth ? "smooth" : "auto" });
  }, [reveal]);

  const requestReveal = (placementId: string) =>
    setReveal((current) => ({ placementId, behavior: "smooth", nonce: (current?.nonce ?? 0) + 1 }));
  // Each explicit context change is its own history entry; Clear returns to /map.
  const navigate = (placementId: string | null) =>
    window.history.pushState(null, "", getMapContextHref(placementId));
  const activate = (row: MapExplorerRow) => {
    const next = activateMapExplorerRow(row, focusedPlacementId, expandedPlacementIds);
    setExpandedPlacementIds(next.expandedPlacementIds);
    if (next.reveal) requestReveal(row.placementId);
    if (next.contextPlacementId !== focusedPlacementId) navigate(next.contextPlacementId);
  };
  const navigateFromTrail = (placementId: string | null) => {
    pendingFocusRef.current = { target: placementId };
    if (placementId) requestReveal(placementId);
    navigate(placementId);
  };

  // Opening a concept reveals its canonical explanation first, then its next
  // conceptual layer; the exposition panel sits between the two.
  const expositionId = (row: MapExplorerRow) => `map-exposition-${row.placementId}`;
  const showsExposition = (row: MapExplorerRow) => row.isExpanded && row.hasContent;

  /**
   * The row's single control. It carries both state dimensions: disclosure
   * (aria-expanded, only when there is something to disclose) and context
   * (aria-current). The +/− cell is a decorative indicator inside it.
   */
  function renderRowControl(row: MapExplorerRow, region: boolean) {
    const focused = row.placementId === focusedPlacementId;
    // A row's own parent is only shown below region level; the region plane
    // already names the parent of its first-level rows.
    const parentLabel = row.depth >= 2 ? row.parentLabel : undefined;

    return (
      <button
        type="button"
        data-row-control=""
        aria-expanded={row.isExpandable ? row.isExpanded : undefined}
        aria-controls={showsExposition(row) ? expositionId(row) : undefined}
        aria-current={focused ? "true" : undefined}
        aria-describedby={rowHintId}
        // Hierarchy and parent context are spoken via the accessible name, never
        // as hidden text that could surface when styles are unavailable.
        aria-label={region ? undefined : `${row.label}${parentLabel ? ` in ${parentLabel}` : ""}, level ${row.depth + 1}`}
        onClick={() => activate(row)}
        className={`group flex min-w-0 flex-1 items-stretch text-left ${CONTROL_FOCUS}`}
      >
        <span className={`min-w-0 flex-1 px-5 [overflow-wrap:anywhere] sm:px-6 ${region ? "py-4" : "py-3.5"}`}>
          {/* L0 ordinal: secondary to the title, muted rather than cyan (cyan
              marks the current context here); the list already announces
              position to assistive technology. */}
          {row.ordinal ? (
            <span aria-hidden="true" className={`${LABEL_TEXT} mr-3 text-muted`}>
              {row.ordinal}
            </span>
          ) : null}
          {parentLabel ? (
            <span aria-hidden="true" className={`${LABEL_TEXT} text-dim`}>
              {parentLabel} ›{" "}
            </span>
          ) : null}
          <span
            className={`${LABEL_TEXT} transition-colors group-hover:text-accent ${region ? "font-semibold" : ""} ${
              focused ? "text-accent" : "text-foreground"
            }`}
          >
            {row.label}
          </span>
        </span>
        {/* Disclosure indicator (not a control): +/− only when there is something to disclose. */}
        <span
          aria-hidden="true"
          className="flex w-12 shrink-0 items-center justify-center border-l border-border font-mono text-base leading-none text-muted transition-colors group-hover:text-accent"
        >
          {row.isExpandable ? (row.isExpanded ? "−" : "+") : null}
        </span>
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-10 sm:gap-12">
      {/* Description only (via aria-describedby); hidden from reading order. */}
      <p id={rowHintId} hidden>
        Selects this concept as the current context and shows or hides what it contains.
      </p>
      <ContextTrail ref={contextRef} context={context} onNavigate={navigateFromTrail} />

      {/* Regions are separated by whitespace; rows inside a region stay
          connected. Every row shares the region's full width at any depth. */}
      {/* ARIA lists rather than <ol>/<ul>: list semantics without native
          markers, so no numbering can appear even without styles. */}
      <div role="list" aria-label="Protocol Engineering regions" className="flex flex-col gap-10 sm:gap-14">
        {regions.map(({ header, rows }) => (
          <div role="listitem" key={header.placementId} className="border border-border">
            <div
              data-placement-id={header.placementId}
              data-concept-id={header.conceptId}
              data-depth={header.depth}
              className={`flex min-w-0 items-stretch bg-surface ${ROW_HOVER} ${REVEAL_MARGIN} ${
                header.placementId === focusedPlacementId ? FOCUSED_ROW : ""
              }`}
            >
              <h3 className="flex min-w-0 flex-1">{renderRowControl(header, true)}</h3>
            </div>
            {showsExposition(header) ? (
              <ConceptExposition id={expositionId(header)} conceptId={header.conceptId} label={header.label} />
            ) : null}

            {rows.length > 0 ? (
              <div role="list" className="border-t border-border">
                {rows.map((row) => (
                  <Fragment key={row.placementId}>
                    <div
                      role="listitem"
                      data-placement-id={row.placementId}
                      data-concept-id={row.conceptId}
                      data-depth={row.depth}
                      className={`flex min-w-0 items-stretch border-t border-border first:border-t-0 ${ROW_HOVER} ${REVEAL_MARGIN} ${
                        row.placementId === focusedPlacementId ? FOCUSED_ROW : ""
                      }`}
                    >
                      {renderRowControl(row, false)}
                    </div>
                    {showsExposition(row) ? (
                      <div role="listitem">
                        <ConceptExposition id={expositionId(row)} conceptId={row.conceptId} label={row.label} />
                      </div>
                    ) : null}
                  </Fragment>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Breadcrumb of the focused placement's taxonomy ancestry (placement
 * ancestry, not graph relationships or concept identity). Ancestors navigate
 * to their own placement; the trail wraps rather than overflowing.
 */
function ContextTrail({
  ref,
  context,
  onNavigate,
}: {
  ref: Ref<HTMLElement>;
  context: MapExplorerContextStep[];
  onNavigate: (placementId: string | null) => void;
}) {
  return (
    <nav
      ref={ref}
      tabIndex={-1}
      aria-label="Context"
      className="flex min-w-0 flex-col gap-3 border border-border px-5 py-4 outline-none sm:flex-row sm:items-baseline sm:gap-6 sm:px-6"
    >
      <MonoLabel className="shrink-0">Context</MonoLabel>
      {context.length === 0 ? (
        <p className={`${LABEL_TEXT} flex-1 text-dim`}>Select a concept to set context</p>
      ) : (
        <>
          {/* Segments wrap onto further lines (and long labels wrap within
              themselves) so any depth stays inside the reading width. */}
          <div role="list" className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2">
            {context.map((step, index) => (
              <div role="listitem" key={step.placementId} className="flex min-w-0 items-baseline gap-2">
                {index > 0 ? (
                  <span aria-hidden="true" className={`${LABEL_TEXT} text-dim`}>
                    /
                  </span>
                ) : null}
                {index === context.length - 1 ? (
                  <span aria-current="location" className={`${LABEL_TEXT} py-1.5 text-accent [overflow-wrap:anywhere]`}>
                    {step.label}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onNavigate(step.placementId)}
                    className={`${LABEL_TEXT} py-1.5 text-left text-muted [overflow-wrap:anywhere] transition-colors hover:text-accent ${CONTROL_FOCUS}`}
                  >
                    {step.label}
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => onNavigate(null)}
            aria-label="Clear context"
            className={`${LABEL_TEXT} self-start py-1.5 text-dim transition-colors hover:text-accent sm:self-auto ${CONTROL_FOCUS}`}
          >
            Clear
          </button>
        </>
      )}
    </nav>
  );
}
