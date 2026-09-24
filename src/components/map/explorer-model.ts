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
  hasChildren: boolean;
  isExpanded: boolean;
};

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

/**
 * A recursive traversal projected into one flat visual plane. `depth` is
 * semantic/contextual metadata only; no width or indentation derives from it.
 */
export function getVisibleMapExplorerRows(
  view: MapExplorerView,
  expandedPlacementIds: ReadonlySet<string>,
): MapExplorerRow[] {
  const rows: MapExplorerRow[] = [];

  function visit(node: MapExplorerNode, depth: number): void {
    const hasChildren = node.children.length > 0;
    const isExpanded = hasChildren && expandedPlacementIds.has(node.placementId);

    rows.push({
      placementId: node.placementId,
      conceptId: node.conceptId,
      label: node.label,
      depth,
      hasChildren,
      isExpanded,
    });

    if (isExpanded) {
      for (const child of node.children) visit(child, depth + 1);
    }
  }

  for (const root of view.roots) visit(root, 0);
  return rows;
}
