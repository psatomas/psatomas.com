"use client";

import { useEffect, useState } from "react";

export type PipelineStage = {
  label: string;
  /** Pre-split display lines — forced line breaks, independent of
   * container width, since natural text-wrap would reflow differently
   * per breakpoint/column count. Each caller supplies its own stage set
   * with its own wrapping, so this component carries no assumptions
   * about any one system's stage names. */
  lines: string[];
};

const STAGE_MS = 2000;

/**
 * A restrained, sequential protocol-state pipeline: equal-width attached
 * cells with a cyan boundary cycling through them one at a time — first
 * established by ExeKPro's Execution Model, generalized here so any
 * system's own lifecycle (StakeVerse's Governance Execution and Staking
 * Model, for instance) can reuse the same grammar instead of a second
 * bespoke implementation.
 *
 * Resting dividers use the gap-px/bg-border + bg-background technique
 * already established elsewhere on the site (Systems index, Lab preview)
 * for hairline seams that stay correct across any responsive column
 * count. The active indicator is a per-cell inset `outline` rather than a
 * `border`: a real border on top of those gap-px seams would double up
 * with the adjacent seam into a visibly thicker line at every boundary an
 * active cell touches. An outline never participates in box layout —
 * regardless of color or offset — so it can highlight one cell with zero
 * risk of doubled width, seam misalignment, or layout shift, and no
 * background fill/glow/movement is used, only this boundary color change.
 *
 * `columnClassName` lets a caller override the responsive column count
 * (default matches ExeKPro's original locked six-cell desktop grid); a
 * four-stage lifecycle like Staking Model passes its own.
 */
export function SequencePipeline({
  stages,
  columnClassName = "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6",
}: {
  stages: PipelineStage[];
  columnClassName?: string;
}) {
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
      aria-label={`Sequence: ${stages.map((s) => s.label).join(" → ")}`}
      className={`grid gap-px bg-border ${columnClassName}`}
    >
      {stages.map((stage, i) => {
        const isActive = i === active;
        return (
          <div
            key={stage.label}
            aria-hidden="true"
            className={`flex min-h-[6.5rem] flex-col items-center justify-center gap-0.5 bg-background p-3 text-center font-mono text-[11px] uppercase tracking-[0.08em] outline-2 outline-offset-[-2px] transition-[outline-color,color] ${
              isActive
                ? "text-accent outline-accent motion-reduce:text-muted motion-reduce:outline-transparent"
                : "text-muted outline-transparent"
            }`}
          >
            {stage.lines.map((line) => (
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
