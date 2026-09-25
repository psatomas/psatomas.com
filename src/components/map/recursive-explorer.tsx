"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { Ref } from "react";
import { useSearchParams } from "next/navigation";
import { MonoLabel } from "@/components/ui/mono-label";
import {
  getInitialMapExplorerState,
  getMapContextHref,
  getMapExplorerContext,
  getNextMapContext,
  getVisibleMapExplorerRegions,
  indexMapExplorerView,
  MAP_CONTEXT_PARAM,
  resolveMapContextParam,
  revealMapExplorerContext,
  toggleMapExplorerPlacement,
} from "./explorer-model";
import type { MapExplorerContextStep, MapExplorerRow, MapExplorerView } from "./explorer-model";

// Visual semantics are deliberately separate: graphite planes mark structural
// regions, the inset accent bar marks the reader's current context, and the
// +/− cell marks disclosure state. None of them derive geometry from depth.
const FOCUSED_ROW = "shadow-[inset_2px_0_0_0_var(--color-accent)]";
const LABEL_TEXT = "font-mono text-[11px] uppercase tracking-[0.12em] sm:text-xs";
const CONTROL_FOCUS = "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent";

/**
 * One source of truth per concern: the URL's `?context=` owns the active
 * placement (so refresh, sharing, and Back/Forward reconstruct it), while
 * disclosure is local state that no context change ever closes.
 */
export function RecursiveMapExplorer({ view }: { view: MapExplorerView }) {
  const index = useMemo(() => indexMapExplorerView(view), [view]);
  const focusedPlacementId = resolveMapContextParam(index, useSearchParams().getAll(MAP_CONTEXT_PARAM));
  const [expandedPlacementIds, setExpandedPlacementIds] = useState(
    () => getInitialMapExplorerState(view, focusedPlacementId).expandedPlacementIds,
  );
  // When the URL context changes (a selection, Back/Forward), reveal its
  // ancestors during render, before paint; open branches stay open.
  const [revealedFor, setRevealedFor] = useState(focusedPlacementId);
  if (revealedFor !== focusedPlacementId) {
    setRevealedFor(focusedPlacementId);
    setExpandedPlacementIds((current) => revealMapExplorerContext(current, index, focusedPlacementId));
  }
  const regions = getVisibleMapExplorerRegions(view, expandedPlacementIds);
  const context = getMapExplorerContext(index, focusedPlacementId);
  const focusHintId = useId();
  const contextRef = useRef<HTMLElement>(null);
  // Where keyboard focus goes once a breadcrumb move or Clear has rendered,
  // since both remove the control that was activated.
  const pendingFocusRef = useRef<{ target: string | null } | null>(null);

  useEffect(() => {
    const pending = pendingFocusRef.current;
    if (!pending) return;
    pendingFocusRef.current = null;
    const control = pending.target
      ? document.querySelector<HTMLElement>(`[data-placement-id="${CSS.escape(pending.target)}"] button[aria-pressed]`)
      : null;
    (control ?? contextRef.current)?.focus();
  }, [focusedPlacementId]);

  const toggle = (placementId: string) =>
    setExpandedPlacementIds((current) => toggleMapExplorerPlacement(current, placementId));
  // Each explicit context change is its own history entry; Clear returns to /map.
  const navigate = (placementId: string | null) =>
    window.history.pushState(null, "", getMapContextHref(placementId));
  const toggleFocus = (placementId: string) => navigate(getNextMapContext(focusedPlacementId, placementId));
  const navigateFromTrail = (placementId: string | null) => {
    pendingFocusRef.current = { target: placementId };
    navigate(placementId);
  };

  function renderFocusControl(row: MapExplorerRow, region: boolean) {
    const focused = row.placementId === focusedPlacementId;
    // A row's own parent is only shown below region level; the region plane
    // already names the parent of its first-level rows.
    const parentLabel = row.depth >= 2 ? row.parentLabel : undefined;

    return (
      <button
        type="button"
        aria-pressed={focused}
        aria-describedby={focusHintId}
        onClick={() => toggleFocus(row.placementId)}
        className={`group min-w-0 flex-1 px-5 text-left [overflow-wrap:anywhere] sm:px-6 ${
          region ? "py-4" : "py-3.5"
        } ${CONTROL_FOCUS}`}
      >
        {/* L0 ordinal: secondary to the title, muted rather than cyan (cyan
            marks the current context here); the ordered list already
            announces position to assistive technology. */}
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
        {parentLabel ? <span className="sr-only"> in {parentLabel}</span> : null}
      </button>
    );
  }

  function renderDisclosureControl(row: MapExplorerRow) {
    return row.hasChildren ? (
      <button
        type="button"
        aria-expanded={row.isExpanded}
        aria-label={`${row.label} subtopics`}
        onClick={() => toggle(row.placementId)}
        className={`flex w-12 shrink-0 items-center justify-center border-l border-border font-mono text-base leading-none text-muted transition-colors hover:text-accent ${CONTROL_FOCUS}`}
      >
        <span aria-hidden="true">{row.isExpanded ? "−" : "+"}</span>
      </button>
    ) : (
      <span aria-hidden="true" className="w-12 shrink-0 border-l border-border" />
    );
  }

  return (
    <div className="flex flex-col gap-10 sm:gap-12">
      {/* Description only (via aria-describedby); hidden from reading order. */}
      <p id={focusHintId} hidden>
        Sets this concept as the current context.
      </p>
      <ContextTrail ref={contextRef} context={context} onNavigate={navigateFromTrail} />

      {/* Regions are separated by whitespace; rows inside a region stay
          connected. Every row shares the region's full width at any depth. */}
      <ol aria-label="Protocol Engineering regions" className="flex flex-col gap-10 sm:gap-14">
        {regions.map(({ header, rows }) => (
          <li key={header.placementId} className="border border-border">
            <div
              data-placement-id={header.placementId}
              data-concept-id={header.conceptId}
              data-depth={header.depth}
              className={`flex min-w-0 items-stretch bg-surface ${
                header.placementId === focusedPlacementId ? FOCUSED_ROW : ""
              }`}
            >
              <h3 className="flex min-w-0 flex-1">{renderFocusControl(header, true)}</h3>
              {renderDisclosureControl(header)}
            </div>

            {rows.length > 0 ? (
              <ol className="border-t border-border">
                {rows.map((row) => (
                  <li
                    key={row.placementId}
                    data-placement-id={row.placementId}
                    data-concept-id={row.conceptId}
                    data-depth={row.depth}
                    className={`flex min-w-0 items-stretch border-t border-border first:border-t-0 ${
                      row.placementId === focusedPlacementId ? FOCUSED_ROW : ""
                    }`}
                  >
                    {/* Hierarchy stays available to assistive technology without visible depth markers. */}
                    <span className="sr-only">Level {row.depth + 1}: </span>
                    {renderFocusControl(row, false)}
                    {renderDisclosureControl(row)}
                  </li>
                ))}
              </ol>
            ) : null}
          </li>
        ))}
      </ol>
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
          <ol className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2">
            {context.map((step, index) => (
              <li key={step.placementId} className="flex min-w-0 items-baseline gap-2">
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
              </li>
            ))}
          </ol>
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
