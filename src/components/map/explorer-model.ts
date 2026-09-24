import type { MapResolver } from "@/lib/map";

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
  /** Immediate parent placement, absent for region (root) rows. */
  parentPlacementId?: string;
  parentLabel?: string;
  hasChildren: boolean;
  isExpanded: boolean;
};

/** A root placement presented as a structural region with its visible rows. */
export type MapExplorerRegion = {
  header: MapExplorerRow;
  rows: MapExplorerRow[];
};

/**
 * Disclosure and context are independent reader intentions: many placements
 * may be expanded while at most one placement is the focused context.
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
  return {
    roots: rootPlacementIds.map((placementId) => resolveNode(resolver, placementId)),
  };
}

/**
 * Root regions begin open so the explorer signals its affordance immediately.
 * Descendant branches remain closed until the reader chooses to inspect them.
 */
export function getInitialExpandedPlacementIds(view: MapExplorerView): string[] {
  return view.roots.filter((root) => root.children.length > 0).map((root) => root.placementId);
}

export function getInitialMapExplorerState(view: MapExplorerView): MapExplorerState {
  return {
    expandedPlacementIds: new Set(getInitialExpandedPlacementIds(view)),
    focusedPlacementId: null,
  };
}

/** Disclosure only: never changes the focused context. */
export function toggleMapExplorerPlacement(state: MapExplorerState, placementId: string): MapExplorerState {
  const expandedPlacementIds = new Set(state.expandedPlacementIds);
  if (expandedPlacementIds.has(placementId)) expandedPlacementIds.delete(placementId);
  else expandedPlacementIds.add(placementId);
  return { ...state, expandedPlacementIds };
}

/** Context only: never opens or closes any branch. `null` clears the context. */
export function focusMapExplorerPlacement(
  state: MapExplorerState,
  placementId: string | null,
): MapExplorerState {
  return { ...state, focusedPlacementId: placementId };
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
    const isExpanded = hasChildren && expandedPlacementIds.has(node.placementId);

    rows.push({
      placementId: node.placementId,
      conceptId: node.conceptId,
      label: node.label,
      depth,
      parentPlacementId: parent?.placementId,
      parentLabel: parent?.label,
      hasChildren,
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
