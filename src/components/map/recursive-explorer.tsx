"use client";

import { useState } from "react";
import {
  getInitialExpandedPlacementIds,
  getVisibleMapExplorerRows,
} from "./explorer-model";
import type { MapExplorerView } from "./explorer-model";

export function RecursiveMapExplorer({ view }: { view: MapExplorerView }) {
  const [expandedPlacementIds, setExpandedPlacementIds] = useState(
    () => new Set(getInitialExpandedPlacementIds(view)),
  );
  const rows = getVisibleMapExplorerRows(view, expandedPlacementIds);

  function toggle(placementId: string) {
    setExpandedPlacementIds((current) => {
      const next = new Set(current);
      if (next.has(placementId)) next.delete(placementId);
      else next.add(placementId);
      return next;
    });
  }

  return (
    <ol className="border border-border" aria-label="Protocol Engineering taxonomy">
      {rows.map((row, index) => (
        <li
          key={row.placementId}
          data-depth={row.depth}
          data-placement-id={row.placementId}
          className={`flex min-w-0 w-full items-center gap-3 px-5 py-4 sm:px-6 ${
            index === 0 ? "" : "border-t border-border"
          }`}
        >
          {/* Fixed-size level marker communicates context without cumulative indentation. */}
          <span aria-hidden="true" className="w-8 shrink-0 font-mono text-[10px] tracking-[0.08em] text-dim sm:text-[11px]">
            L{row.depth}
          </span>
          <span className="min-w-0 flex-1 font-mono text-[11px] uppercase tracking-[0.12em] text-foreground sm:text-xs">
            {/* The flat row plane must still announce hierarchy; levels are 1-based as in aria-level. */}
            <span className="sr-only">Level {row.depth + 1}: </span>
            {row.label}
          </span>
          {row.hasChildren ? (
            <button
              type="button"
              aria-expanded={row.isExpanded}
              aria-label={`${row.isExpanded ? "Collapse" : "Expand"} ${row.label}`}
              onClick={() => toggle(row.placementId)}
              className="shrink-0 px-1 font-mono text-base leading-none text-muted transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
            >
              <span aria-hidden="true">{row.isExpanded ? "−" : "+"}</span>
            </button>
          ) : (
            <span aria-hidden="true" className="w-5 shrink-0" />
          )}
        </li>
      ))}
    </ol>
  );
}
