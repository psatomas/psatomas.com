"use client";

import { useEffect, useState } from "react";

// Exact wrapping the design calls for, independent of container width —
// natural text-wrap would reflow differently per breakpoint/column count,
// so each stage's line breaks are fixed here rather than left to the
// browser. Falls back to a single line for any stage not listed, so an
// unrecognized/renamed stage degrades gracefully instead of disappearing.
const STAGE_LINES: Record<string, string[]> = {
  INTENT: ["INTENT"],
  "ELIGIBLE MODULES": ["ELIGIBLE", "MODULES"],
  SIMULATION: ["SIMULATION"],
  "SCORE POLICY": ["SCORE", "POLICY"],
  "HIGHEST-SCORING MODULE": ["HIGHEST-", "SCORING", "MODULE"],
  EXECUTION: ["EXECUTION"],
};

const STAGE_MS = 2000;

/**
 * The six-stage execution pipeline from ExeKPro's own Execution Model
 * data (system.sections Execution Model .flow), rendered as equal-width
 * attached cells with a cyan boundary cycling through them one at a time.
 *
 * Resting dividers use the same gap-px/bg-border + bg-background technique
 * already established elsewhere on the site (Systems index, Lab preview)
 * for hairline seams that stay correct across any responsive column
 * count. The active indicator is a per-cell inset `outline` rather than a
 * `border`: a real border on top of those gap-px seams would double up
 * with the adjacent seam into a visibly thicker line at every boundary an
 * active cell touches. An outline never participates in box layout —
 * regardless of color or offset — so it can highlight one cell with zero
 * risk of doubled width, seam misalignment, or layout shift, and no
 * background fill/glow/movement is used, only this boundary color change.
 */
export function ExecutionPipeline({ stages }: { stages: string[] }) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (query.matches) return;

    const id = setInterval(() => {
      setActive((i) => (i + 1) % stages.length);
    }, STAGE_MS);
    return () => clearInterval(id);
  }, [stages.length]);

  return (
    <div
      role="img"
      aria-label={`Execution pipeline: ${stages.join(" → ")}`}
      className="grid grid-cols-2 gap-px bg-border sm:grid-cols-3 lg:grid-cols-6"
    >
      {stages.map((stage, i) => {
        const isActive = i === active;
        return (
          <div
            key={stage}
            aria-hidden="true"
            className={`flex min-h-[6.5rem] flex-col items-center justify-center gap-0.5 bg-background p-3 text-center font-mono text-[11px] uppercase tracking-[0.08em] outline-2 outline-offset-[-2px] transition-[outline-color,color] ${
              isActive
                ? "text-accent outline-accent motion-reduce:text-muted motion-reduce:outline-transparent"
                : "text-muted outline-transparent"
            }`}
          >
            {(STAGE_LINES[stage] ?? [stage]).map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </div>
        );
      })}
    </div>
  );
}
