"use client";

import { useEffect, useState } from "react";
import { MonoLabel } from "@/components/ui/mono-label";

// Tested at 1000-1500ms per the requested range; 1200ms is fast enough
// that an 8-stage Intent cycle (~9.6s) doesn't feel inert, slow enough
// that each stage name is still individually readable.
const STAGE_MS = 1200;

/**
 * The Lab "system visualization" primitive: one connected, seamless grid
 * of pipeline stages under a bg-surface path-name plane, with a cyan
 * boundary that owns its own progression through the stages — one cell
 * active at a time, looping back to the first on completion. Deliberately
 * NOT the arrow-based FlowBox/FlowArrow chips used elsewhere in Lab
 * (src/components/lab/flow.tsx) — those represent discrete steps joined
 * by "then," while this represents one continuous execution/observation
 * path: a single system moving through connected states, so the cells
 * share borders (seams) rather than sitting apart with arrows between
 * them.
 *
 * Structure mirrors ExperimentHeader's own two-plane shape (one outer
 * border, bg-surface plane directly attached to a bordered content
 * plane, zero gap): the path label plane has no border of its own, and
 * the stage grid supplies the single dividing border-t.
 *
 * The active indicator is `ring-1 ring-inset` (a box-shadow, not a
 * border/margin) so moving it from cell to cell never changes any cell's
 * box size — no layout shift, no doubled seam. Text color never changes
 * between active/inactive: only the boundary signals position, following
 * the same "boundary-only, not text-color" rule this experiment's own
 * ExperimentHeader/hover language already uses elsewhere in Lab.
 *
 * The interval mirrors the reduced-motion/cleanup convention already
 * established by src/components/systems/sequence-pipeline.tsx: a
 * `prefers-reduced-motion` check before ever starting the timer (stage 0
 * then stays active permanently, no alternate flashing), and a plain
 * `document.visibilityState` guard inside the tick rather than tearing
 * the interval down/up on every visibility change.
 */
export function SystemVisualization({
  pathLabel,
  stages,
}: {
  pathLabel: string;
  stages: string[];
}) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (query.matches) return;

    const id = setInterval(() => {
      if (document.visibilityState === "visible") {
        setActiveIndex((i) => (i + 1) % stages.length);
      }
    }, STAGE_MS);
    return () => clearInterval(id);
  }, [stages.length]);

  return (
    <div className="border border-border">
      <div className="bg-surface px-4 py-2">
        <MonoLabel>{pathLabel}</MonoLabel>
      </div>
      <div className="grid grid-cols-1 border-t border-border sm:grid-flow-col sm:auto-cols-fr">
        {stages.map((stage, i) => (
          <div
            key={stage}
            className={`border-t border-border p-3 text-center first:border-t-0 sm:border-t-0 sm:border-l sm:first:border-l-0 ${
              i === activeIndex ? "ring-1 ring-accent ring-inset" : ""
            }`}
          >
            <span className="font-mono text-[11px] uppercase tracking-[0.05em] text-muted">
              {stage}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
