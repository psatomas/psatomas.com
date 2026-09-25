"use client";

import { Fragment, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, Ref } from "react";
import { useSearchParams } from "next/navigation";
import { MonoLabel } from "@/components/ui/mono-label";
import { ConceptExposition } from "./concept-exposition";
import { MapDomainIndex } from "./map-domain-index";
import {
  activateMapExplorerRow,
  enterMapExplorerContext,
  getContainingMapL0,
  getContainingMapL0Ordinal,
  getMapL0IndexEntries,
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
// A revealed row lands 24px below the sticky navbar and, when there is a
// context, the sticky breadcrumb beneath it. Both heights are measured (the
// navbar wraps to different heights below sm) into CSS variables on the
// explorer root, so the margin is pure CSS.
const REVEAL_MARGIN = "scroll-mt-[calc(var(--map-sticky-top)+var(--map-context-h)+24px)]";

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
  // A reveal asked for by an in-page navigation, issued once its context has
  // rendered (the CONTEXT trail above can change height with it).
  const [pendingReveal, setPendingReveal] = useState<Omit<RevealRequest, "nonce"> | null>(null);
  // When the URL context changes (a row, the index, the breadcrumb,
  // Back/Forward), open the placement and its ancestors during render, before
  // paint, and bring it into view; open branches stay open.
  const [revealedFor, setRevealedFor] = useState(focusedPlacementId);
  if (revealedFor !== focusedPlacementId) {
    setRevealedFor(focusedPlacementId);
    setExpandedPlacementIds((current) => revealMapExplorerContext(current, index, focusedPlacementId, true));
    if (focusedPlacementId) {
      const behavior = pendingReveal?.placementId === focusedPlacementId ? pendingReveal.behavior : "auto";
      setReveal((current) => ({ placementId: focusedPlacementId, behavior, nonce: (current?.nonce ?? 0) + 1 }));
    }
    if (pendingReveal) setPendingReveal(null);
  }
  const regions = getVisibleMapExplorerRegions(view, expandedPlacementIds);
  const domainEntries = useMemo(() => getMapL0IndexEntries(view), [view]);
  const context = getMapExplorerContext(index, focusedPlacementId);
  const rowHintId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const trailRef = useRef<HTMLElement>(null);
  // Where keyboard focus goes once a breadcrumb move has rendered, since the
  // chosen ancestor becomes the (non-interactive) current step.
  const pendingFocusRef = useRef<string | null>(null);

  useEffect(() => {
    const target = pendingFocusRef.current;
    if (!target) return;
    pendingFocusRef.current = null;
    document
      .querySelector<HTMLElement>(`[data-placement-id="${CSS.escape(target)}"] [data-row-control]`)
      ?.focus({ preventScroll: true });
  }, [focusedPlacementId]);

  // Sticky geometry from the real layout: the site navbar's height (it wraps
  // below sm) places the breadcrumb, and the breadcrumb's own height (none
  // without a context) joins it in every row's scroll margin. Measured in a
  // layout effect, before any reveal runs, and kept current on resize.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const navbar = [...document.querySelectorAll("header")].find((el) => getComputedStyle(el).position === "sticky");
    const update = () => {
      root.style.setProperty("--map-sticky-top", `${navbar?.getBoundingClientRect().height ?? 0}px`);
      root.style.setProperty("--map-context-h", `${trailRef.current?.getBoundingClientRect().height ?? 0}px`);
    };
    update();
    const observer = new ResizeObserver(update);
    if (navbar) observer.observe(navbar);
    if (trailRef.current) observer.observe(trailRef.current);
    return () => observer.disconnect();
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

  // The latest context, for a pending reveal to tell whether it is obsolete.
  const focusedRef = useRef(focusedPlacementId);
  useLayoutEffect(() => {
    focusedRef.current = focusedPlacementId;
  }, [focusedPlacementId]);

  // Scrolling happens only for an explicit request, never on other renders.
  // A reveal is a bounded operation: the expositions it opened load after it
  // (aria-busy until they settle), and any that sit above the target push it
  // down when they appear. While any exposition in the explorer is still
  // loading, a layout change that moves the target is corrected (before
  // paint, so it never shows), and the reveal completes once none is. It is
  // abandoned as soon as the reader takes over (wheel, touch, pointer, key),
  // the context moves on, another reveal starts, or the explorer unmounts.
  useEffect(() => {
    const root = rootRef.current;
    if (!reveal || !root) return;
    const find = () => document.querySelector<HTMLElement>(`[data-placement-id="${CSS.escape(reveal.placementId)}"]`);
    const smooth = reveal.behavior === "smooth" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    find()?.scrollIntoView({ block: "start", behavior: smooth ? "smooth" : "auto" });

    const loading = () => root.querySelector('[aria-busy="true"]') !== null;
    if (!loading()) return;
    const documentTop = () => {
      const row = find();
      return row ? row.getBoundingClientRect().top + window.scrollY : null;
    };
    let anchor = documentTop();
    const observer = new ResizeObserver(() => {
      if (focusedRef.current !== reveal.placementId) return complete();
      const top = documentTop();
      // Only a shift of the target itself is corrected; content settling
      // below it, or the reveal's own scrolling, never re-scrolls.
      if (top !== null && anchor !== null && Math.abs(top - anchor) > 0.5) find()?.scrollIntoView({ block: "start" });
      anchor = top;
      if (!loading()) complete();
    });
    const TAKEOVER = ["wheel", "touchstart", "pointerdown", "keydown"] as const;
    function complete() {
      observer.disconnect();
      for (const type of TAKEOVER) window.removeEventListener(type, complete, true);
    }
    observer.observe(root);
    for (const type of TAKEOVER) window.addEventListener(type, complete, { capture: true, passive: true });
    return complete;
  }, [reveal]);

  // Each explicit context change is its own history entry.
  const navigate = (placementId: string) => window.history.pushState(null, "", getMapContextHref(placementId));
  // Moves to a placement: navigates if the context changes (the reveal then
  // follows the rendered context) or reveals at once if it does not. Short
  // in-place moves (a row, the breadcrumb) scroll smoothly; a jump from the
  // domain index lands at once, like any other entry.
  const moveTo = (placementId: string, behavior: RevealRequest["behavior"]) => {
    if (placementId !== focusedPlacementId) {
      setPendingReveal({ placementId, behavior });
      navigate(placementId);
    } else {
      setReveal((current) => ({ placementId, behavior, nonce: (current?.nonce ?? 0) + 1 }));
    }
  };
  const activate = (row: MapExplorerRow) => {
    const next = activateMapExplorerRow(row, focusedPlacementId, expandedPlacementIds);
    setExpandedPlacementIds(next.expandedPlacementIds);
    if (next.reveal && next.contextPlacementId) moveTo(next.contextPlacementId, "smooth");
  };
  // Entering from the domain index: the same context contract as a row, but
  // it never collapses an already-open domain.
  const enterDomain = (placementId: string) => {
    const next = enterMapExplorerContext(placementId, expandedPlacementIds, index);
    setExpandedPlacementIds(next.expandedPlacementIds);
    moveTo(placementId, "auto");
  };
  const navigateFromTrail = (placementId: string) => {
    pendingFocusRef.current = placementId;
    moveTo(placementId, "smooth");
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
        {/* Disclosure indicator (not a control): +/− only when there is something to
            disclose. No divider: it is state belonging to the row, not a separate cell. */}
        <span
          aria-hidden="true"
          className="flex w-12 shrink-0 items-center justify-center font-mono text-base leading-none text-muted transition-colors group-hover:text-accent"
        >
          {row.isExpandable ? (row.isExpanded ? "−" : "+") : null}
        </span>
      </button>
    );
  }

  return (
    // The sticky breadcrumb must be a direct child of this long column so it
    // stays pinned through the whole explorer. The variables default to the
    // desktop navbar until measured.
    <div
      ref={rootRef}
      className="flex flex-col"
      style={{ "--map-sticky-top": "65px", "--map-context-h": "0px" } as CSSProperties}
    >
      {/* Description only (via aria-describedby); hidden from reading order. */}
      <p id={rowHintId} hidden>
        Selects this concept as the current context and shows or hides what it contains.
      </p>
      <MapDomainIndex
        entries={domainEntries}
        containingPlacementId={getContainingMapL0(index, focusedPlacementId)}
        onEnter={enterDomain}
      />
      {/* The CONTEXT label stays at the breadcrumb's natural position and
          scrolls away; only the path below it is sticky. Neither exists
          without a context. */}
      {context.length > 0 ? (
        <>
          <p className="mt-10 sm:mt-12">
            <MonoLabel>Context</MonoLabel>
          </p>
          <ContextTrail
            ref={trailRef}
            context={context}
            ordinal={getContainingMapL0Ordinal(index, focusedPlacementId)}
            onNavigate={navigateFromTrail}
          />
        </>
      ) : null}

      {/* Regions are separated by whitespace; rows inside a region stay
          connected. Every row shares the region's full width at any depth.
          isolate keeps the rows' hover layers (z-10) below the sticky
          breadcrumb and the navbar. */}
      {/* ARIA lists rather than <ol>/<ul>: list semantics without native
          markers, so no numbering can appear even without styles. */}
      <div role="list" aria-label="Protocol Engineering regions" className="isolate mt-10 flex flex-col gap-10 sm:mt-12 sm:gap-14">
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
 * ancestry, not graph relationships or concept identity), and the page's
 * persistent orientation: it is sticky beneath the navbar while the explorer
 * scrolls. Visually text only; its backing is the opaque page background so
 * content scrolling beneath never shows through. Ancestors navigate to their
 * own placement; the current step is plain text with aria-current.
 *
 * Below sm the path is compact: ancestors share one line in which the
 * intermediate steps shrink to an ellipsis before the L0 domain does, and the
 * current concept has its own line and is never truncated. Truncation is
 * visual only; every step keeps its full text and accessible name.
 */
function ContextTrail({
  ref,
  context,
  ordinal,
  onNavigate,
}: {
  ref: Ref<HTMLElement>;
  context: MapExplorerContextStep[];
  /** The containing L0's canonical 01–27 ordinal, shown before the L0 step only. */
  ordinal: string | null;
  onNavigate: (placementId: string) => void;
}) {
  const ancestors = context.slice(0, -1);
  const current = context[context.length - 1];
  // The L0 coordinate: muted, never truncated, outside the step's control so
  // hover never recolours it, and hidden from assistive technology like every
  // other MAP ordinal (the path itself names the domain).
  const coordinate = ordinal ? (
    <span aria-hidden="true" className={`${LABEL_TEXT} mr-1 shrink-0 text-muted`}>
      {ordinal}
    </span>
  ) : null;
  return (
    <nav
      ref={ref}
      aria-label="Context"
      className="sticky top-[var(--map-sticky-top)] z-[5] mt-1 bg-background py-3"
    >
      <div role="list" className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-2">
        {ancestors.length > 0 ? (
          <div role="none" className="flex min-w-0 items-baseline gap-x-2 overflow-hidden sm:contents">
            {ancestors.map((step, index) => (
              <div
                role="listitem"
                key={step.placementId}
                className={`flex min-w-0 items-baseline gap-2 ${index === 0 ? "shrink" : "min-w-[3em] shrink-[8]"} sm:shrink-0 sm:min-w-0`}
              >
                {index === 0 ? coordinate : null}
                <button
                  type="button"
                  onClick={() => onNavigate(step.placementId)}
                  className={`${LABEL_TEXT} min-w-0 truncate py-1 text-left text-muted transition-colors hover:text-accent sm:overflow-visible sm:whitespace-normal sm:[overflow-wrap:anywhere] ${CONTROL_FOCUS}`}
                >
                  {step.label}
                </button>
                <span aria-hidden="true" className={`${LABEL_TEXT} shrink-0 text-dim`}>
                  /
                </span>
              </div>
            ))}
          </div>
        ) : null}
        <div role="listitem" className="flex min-w-0 items-baseline gap-2">
          {ancestors.length === 0 ? coordinate : null}
          <span aria-current="location" className={`${LABEL_TEXT} block min-w-0 py-1 text-accent [overflow-wrap:anywhere]`}>
            {current.label}
          </span>
        </div>
      </div>
    </nav>
  );
}
