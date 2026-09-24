"use client";

import { useId, useMemo, useState } from "react";
import { MonoLabel } from "@/components/ui/mono-label";
import {
  focusMapExplorerPlacement,
  getInitialMapExplorerState,
  getMapExplorerContext,
  getVisibleMapExplorerRegions,
  indexMapExplorerView,
  toggleMapExplorerPlacement,
} from "./explorer-model";
import type { MapExplorerContextStep, MapExplorerRow, MapExplorerView } from "./explorer-model";

// Visual semantics are deliberately separate: graphite planes mark structural
// regions, the inset accent bar marks the reader's current context, and the
// +/− cell marks disclosure state. None of them derive geometry from depth.
const FOCUSED_ROW = "shadow-[inset_2px_0_0_0_var(--color-accent)]";
const LABEL_TEXT = "font-mono text-[11px] uppercase tracking-[0.12em] sm:text-xs";
const CONTROL_FOCUS = "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent";

export function RecursiveMapExplorer({
  view,
  initialContextPlacementId = null,
}: {
  view: MapExplorerView;
  /** Entry context from the URL; unknown placements fall back to the default state. */
  initialContextPlacementId?: string | null;
}) {
  const [state, setState] = useState(() => getInitialMapExplorerState(view, initialContextPlacementId));
  const index = useMemo(() => indexMapExplorerView(view), [view]);
  const regions = getVisibleMapExplorerRegions(view, state.expandedPlacementIds);
  const context = getMapExplorerContext(index, state.focusedPlacementId);
  const focusHintId = useId();

  const toggle = (placementId: string) => setState((current) => toggleMapExplorerPlacement(current, placementId));
  const focus = (placementId: string | null) =>
    setState((current) => focusMapExplorerPlacement(current, placementId));
  const toggleFocus = (placementId: string) =>
    setState((current) =>
      focusMapExplorerPlacement(current, current.focusedPlacementId === placementId ? null : placementId),
    );

  function renderFocusControl(row: MapExplorerRow, region: boolean) {
    const focused = row.placementId === state.focusedPlacementId;
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
      <ContextTrail context={context} onFocus={focus} />

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
                header.placementId === state.focusedPlacementId ? FOCUSED_ROW : ""
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
                      row.placementId === state.focusedPlacementId ? FOCUSED_ROW : ""
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
 * The focused placement's taxonomy ancestry. Ancestors re-focus their own
 * placement; the trail wraps rather than overflowing at any depth.
 */
function ContextTrail({
  context,
  onFocus,
}: {
  context: MapExplorerContextStep[];
  onFocus: (placementId: string | null) => void;
}) {
  return (
    <nav
      aria-label="Context"
      className="flex min-w-0 flex-col gap-3 border border-border px-5 py-4 sm:flex-row sm:items-baseline sm:gap-6 sm:px-6"
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
                    ›
                  </span>
                ) : null}
                {index === context.length - 1 ? (
                  <span aria-current="location" className={`${LABEL_TEXT} py-1.5 text-accent [overflow-wrap:anywhere]`}>
                    {step.label}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onFocus(step.placementId)}
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
            onClick={() => onFocus(null)}
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
