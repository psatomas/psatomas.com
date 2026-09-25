import type { MapConceptContent, MapContentBlock, MapResolver } from "@/lib/map";

/**
 * Serializable, taxonomy-only data for the interactive client boundary.
 * Canonical graph, content, mechanisms, and paths deliberately remain on the
 * server/build side of MAP; a node records its placement identity separately
 * from the canonical concept it resolves to.
 */
export type MapExplorerNode = {
  placementId: string;
  conceptId: string;
  label: string;
  /** Two-digit L0 ordinal ("01"…) from the canonical root order; roots only. */
  ordinal?: string;
  /** Whether the canonical concept has exposition; the exposition itself stays server-side. */
  hasContent: boolean;
  children: readonly MapExplorerNode[];
};

export type MapExplorerView = {
  roots: readonly MapExplorerNode[];
};

export type MapExplorerRow = {
  placementId: string;
  conceptId: string;
  label: string;
  depth: number;
  /** Two-digit L0 ordinal, present on root rows only. */
  ordinal?: string;
  /** Immediate parent placement, absent for region (root) rows. */
  parentPlacementId?: string;
  parentLabel?: string;
  hasChildren: boolean;
  hasContent: boolean;
  /** Disclosure reveals knowledge: a concept opens if it has exposition or a next layer. */
  isExpandable: boolean;
  isExpanded: boolean;
};

/** A root placement presented as a structural region with its visible rows. */
export type MapExplorerRegion = {
  header: MapExplorerRow;
  rows: MapExplorerRow[];
};

/**
 * Disclosure and context are independent reader intentions: many placements
 * may be expanded (local state) while at most one placement is the focused
 * context, which is owned by the URL's `?context=` value.
 */
export type MapExplorerState = {
  expandedPlacementIds: ReadonlySet<string>;
  focusedPlacementId: string | null;
};

/** One step of a focused placement's ancestry, root-first. */
export type MapExplorerContextStep = {
  placementId: string;
  conceptId: string;
  label: string;
};

/** Query parameter carrying the active pedagogical placement (MAP spec §14). */
export const MAP_CONTEXT_PARAM = "context";

/**
 * `/map` at one placement context, or plain `/map` without one. Built from
 * placement identity, never display text; disclosure is never encoded.
 */
export function getMapContextHref(placementId: string | null): string {
  return placementId ? `/map?${new URLSearchParams({ [MAP_CONTEXT_PARAM]: placementId })}` : "/map";
}

/** Two-digit ordinal for a 1-based L0 position. */
export function formatMapL0Ordinal(position: number): string {
  return String(position).padStart(2, "0");
}

/** Where a concept's canonical exposition is served (prerendered, one document per concept). */
export function getMapConceptContentHref(conceptId: string): string {
  return `/api/map/content/${encodeURIComponent(conceptId)}`;
}

/** A concept's canonical exposition as the client receives it: ordered blocks, lead first. */
export type MapConceptExposition = {
  conceptId: string;
  blocks: readonly MapContentBlock[];
};

/**
 * Normalizes canonical content into one ordered exposition: the definition
 * leads, any legacy prose fields follow as paragraphs (never as labelled
 * scaffolding), then the structured body.
 */
export function toMapConceptExposition(content: MapConceptContent): MapConceptExposition {
  const prose = [content.definition, content.summary, content.explanation, content.whyItMatters]
    .filter((text): text is string => Boolean(text))
    .map((text): MapContentBlock => ({ kind: "paragraph", text }));
  return { conceptId: content.conceptId, blocks: [...prose, ...(content.body ?? [])] };
}

/** One L0 domain as an entry point into /map, derived from canonical root placements. */
export type MapL0Entry = {
  placementId: string;
  conceptId: string;
  label: string;
  ordinal: string;
  href: string;
};

export function getMapL0Entries(resolver: MapResolver): MapL0Entry[] {
  return resolver.getRootPlacements().map((placement, index) => {
    const concept = resolver.getConcept(placement.conceptId);
    if (!concept) throw new Error(`MAP L0 placement "${placement.id}" has no concept "${placement.conceptId}"`);
    return {
      placementId: placement.id,
      conceptId: concept.id,
      label: placement.contextualLabel ?? concept.title,
      ordinal: formatMapL0Ordinal(index + 1),
      href: getMapContextHref(placement.id),
    };
  });
}

type IndexedPlacement = { node: MapExplorerNode; parentPlacementId?: string };
export type MapExplorerIndex = ReadonlyMap<string, IndexedPlacement>;

function resolveNode(resolver: MapResolver, placementId: string): MapExplorerNode {
  const placement = resolver.getPlacement(placementId);
  if (!placement) throw new Error(`MAP explorer could not resolve placement "${placementId}"`);

  const concept = resolver.getConcept(placement.conceptId);
  if (!concept) throw new Error(`MAP explorer could not resolve concept "${placement.conceptId}"`);

  return {
    placementId: placement.id,
    conceptId: concept.id,
    label: placement.contextualLabel ?? concept.title,
    hasContent: resolver.getContentForConcept(concept.id) !== undefined,
    children: resolver.getChildren(placement.id).map((child) => resolveNode(resolver, child.id)),
  };
}

/**
 * Builds a selected taxonomy surface without exposing the full MAP model to
 * the client. Callers choose the roots, leaving a future route-level resolver
 * free to send one bounded branch without changing explorer presentation.
 */
export function buildMapExplorerView(
  resolver: MapResolver,
  rootPlacementIds: readonly string[],
): MapExplorerView {
  // Ordinals follow the canonical root sequence, not the selection, so a
  // bounded view of some roots still shows each domain's own number.
  const canonicalRoots = resolver.getRootPlacements().map((placement) => placement.id);
  return {
    roots: rootPlacementIds.map((placementId) => {
      const position = canonicalRoots.indexOf(placementId);
      const node = resolveNode(resolver, placementId);
      return position < 0 ? node : { ...node, ordinal: formatMapL0Ordinal(position + 1) };
    }),
  };
}

/**
 * Domains begin collapsed: a collapsed concept is its identity only, and the
 * reader opens the knowledge they want. An entry context reveals itself.
 */
export function getInitialExpandedPlacementIds(): string[] {
  return [];
}

const isExpandableNode = (node: MapExplorerNode | undefined) =>
  Boolean(node && (node.children.length > 0 || node.hasContent));

/**
 * The URL's context value as a known placement, or null. Anything other than
 * exactly one value naming a placement in this view (unknown, empty,
 * repeated, or a concept rather than a placement identifier) is ignored.
 */
export function resolveMapContextParam(
  index: MapExplorerIndex,
  values: readonly string[] | string | null | undefined,
): string | null {
  const list = typeof values === "string" ? [values] : (values ?? []);
  return list.length === 1 && index.has(list[0]) ? list[0] : null;
}

/**
 * Opens the ancestors of a context placement (and, with `includeSelf`, the
 * placement itself when it has children) so it is visible. It only ever
 * adds to disclosure: no unrelated branch is closed.
 */
export function revealMapExplorerContext(
  expandedPlacementIds: ReadonlySet<string>,
  index: MapExplorerIndex,
  placementId: string | null,
  includeSelf = false,
): ReadonlySet<string> {
  const context = getMapExplorerContext(index, placementId);
  const steps = includeSelf ? context : context.slice(0, -1);
  const missing = steps.filter(
    ({ placementId: id }) => isExpandableNode(index.get(id)?.node) && !expandedPlacementIds.has(id),
  );
  if (missing.length === 0) return expandedPlacementIds;
  return new Set([...expandedPlacementIds, ...missing.map((step) => step.placementId)]);
}

/**
 * Initial state for an entry context (e.g. `/map?context=<placementId>`): the
 * context is focused and revealed, its ancestors and the placement itself
 * open so its immediate children are visible, and nothing deeper expands.
 * An unknown context yields the default state.
 */
export function getInitialMapExplorerState(
  view: MapExplorerView,
  contextPlacementId: string | null = null,
): MapExplorerState {
  const index = indexMapExplorerView(view);
  const focusedPlacementId = resolveMapContextParam(index, contextPlacementId);
  const expandedPlacementIds = revealMapExplorerContext(
    new Set(getInitialExpandedPlacementIds()),
    index,
    focusedPlacementId,
    true,
  );
  return { expandedPlacementIds, focusedPlacementId };
}

/** Disclosure only: a pure change to the expanded set; context lives in the URL. */
export function toggleMapExplorerPlacement(
  expandedPlacementIds: ReadonlySet<string>,
  placementId: string,
): ReadonlySet<string> {
  const next = new Set(expandedPlacementIds);
  if (next.has(placementId)) next.delete(placementId);
  else next.add(placementId);
  return next;
}

/** The outcome of activating one explorer row, the row's single control. */
export type MapRowActivation = {
  /** The context after activation; a change is a navigation (new history entry). */
  contextPlacementId: string | null;
  expandedPlacementIds: ReadonlySet<string>;
  /** Whether the row should be brought into view. */
  reveal: boolean;
};

/**
 * One interaction per row, over two independent state dimensions. An open
 * row collapses and nothing else changes: context stays (even when another
 * placement is the context) and there is nothing to reveal. A closed or leaf
 * row becomes the context and opens if it has anything to disclose, then is
 * brought into view. Disclosure never clears context.
 */
export function activateMapExplorerRow(
  row: Pick<MapExplorerRow, "placementId" | "isExpandable" | "isExpanded">,
  contextPlacementId: string | null,
  expandedPlacementIds: ReadonlySet<string>,
): MapRowActivation {
  if (row.isExpanded) {
    return {
      contextPlacementId,
      expandedPlacementIds: toggleMapExplorerPlacement(expandedPlacementIds, row.placementId),
      reveal: false,
    };
  }
  return {
    contextPlacementId: row.placementId,
    expandedPlacementIds: row.isExpandable
      ? toggleMapExplorerPlacement(expandedPlacementIds, row.placementId)
      : expandedPlacementIds,
    reveal: true,
  };
}

/** Placement lookup with parent links, derived from the view's placement tree. */
export function indexMapExplorerView(view: MapExplorerView): MapExplorerIndex {
  const index = new Map<string, IndexedPlacement>();

  function visit(node: MapExplorerNode, parentPlacementId?: string): void {
    index.set(node.placementId, { node, parentPlacementId });
    for (const child of node.children) visit(child, node.placementId);
  }

  for (const root of view.roots) visit(root);
  return index;
}

/**
 * The focused placement's ancestry, root-first and ending with the placement
 * itself. This is taxonomy context, not a curated knowledge path.
 */
export function getMapExplorerContext(
  index: MapExplorerIndex,
  placementId: string | null,
): MapExplorerContextStep[] {
  const context: MapExplorerContextStep[] = [];
  let current = placementId ? index.get(placementId) : undefined;
  while (current) {
    const { placementId: id, conceptId, label } = current.node;
    context.unshift({ placementId: id, conceptId, label });
    current = current.parentPlacementId ? index.get(current.parentPlacementId) : undefined;
  }
  return context;
}

/**
 * A recursive traversal projected into one flat visual plane. `depth` is
 * semantic/contextual metadata only; no width or indentation derives from it.
 */
export function getVisibleMapExplorerRows(
  view: MapExplorerView,
  expandedPlacementIds: ReadonlySet<string>,
): MapExplorerRow[] {
  const rows: MapExplorerRow[] = [];

  function visit(node: MapExplorerNode, depth: number, parent?: MapExplorerNode): void {
    const hasChildren = node.children.length > 0;
    const isExpandable = isExpandableNode(node);
    const isExpanded = isExpandable && expandedPlacementIds.has(node.placementId);

    rows.push({
      placementId: node.placementId,
      conceptId: node.conceptId,
      label: node.label,
      depth,
      ordinal: depth === 0 ? node.ordinal : undefined,
      parentPlacementId: parent?.placementId,
      parentLabel: parent?.label,
      hasChildren,
      hasContent: node.hasContent,
      isExpandable,
      isExpanded,
    });

    if (isExpanded) {
      for (const child of node.children) visit(child, depth + 1, node);
    }
  }

  for (const root of view.roots) visit(root, 0);
  return rows;
}

/** Splits the flat projection into one structural region per root placement. */
export function getVisibleMapExplorerRegions(
  view: MapExplorerView,
  expandedPlacementIds: ReadonlySet<string>,
): MapExplorerRegion[] {
  const regions: MapExplorerRegion[] = [];
  for (const row of getVisibleMapExplorerRows(view, expandedPlacementIds)) {
    if (row.depth === 0) regions.push({ header: row, rows: [] });
    else regions[regions.length - 1].rows.push(row);
  }
  return regions;
}
