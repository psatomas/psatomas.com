import type { ReactNode } from "react";

/**
 * Small uppercase monospace technical metadata text — used for node
 * descriptors, stat labels, and the tech-stack line under the hero.
 * Not decorative: this is the typographic voice for "system information."
 */
export function MonoLabel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`font-mono text-[11px] uppercase tracking-[0.12em] text-muted ${className}`}
    >
      {children}
    </span>
  );
}
