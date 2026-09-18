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
 * Resting dividers are real 1px borders (right + bottom on every cell),
 * not `gap-px` gaps: a gap is an ordinary CSS length, so at any device
 * pixel ratio below 1 (browser zoom under 100%) Chrome snaps individual
 * 1px gaps to 0 device pixels depending on the fractional column
 * positions, and seams silently disappear. Borders are the one thing the
 * browser never lets collapse below 1 device pixel. The grid is offset
 * -1px right/bottom inside an overflow-hidden wrapper so the outermost
 * right/bottom borders are clipped, leaving only true internal seams at
 * any responsive column count.
 *
 * The active indicator is an inset ring (a box-shadow drawn inside the
 * padding box) rather than an outline or a border: it never participates
 * in box layout, and because it sits inside the padding box it can never
 * paint over, thicken, or replace the neutral seam next to it. No
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
      className="overflow-hidden"
    >
      <div className={`-mr-px -mb-px grid ${columnClassName}`}>
        {stages.map((stage, i) => {
          const isActive = i === active;
          return (
            <div
              key={stage.label}
              aria-hidden="true"
              className={`flex min-h-[6.5rem] flex-col items-center justify-center gap-0.5 border-r border-b border-border bg-background p-3 text-center font-mono text-[11px] uppercase tracking-[0.08em] ring-2 ring-inset transition-[box-shadow,color] ${
                isActive
                  ? "text-accent ring-accent motion-reduce:text-muted motion-reduce:ring-transparent"
                  : "text-muted ring-transparent"
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
    </div>
  );
}
