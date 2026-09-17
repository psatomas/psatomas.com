/**
 * Shared Protocol Lab visualization primitive — a small bordered mono box
 * plus arrow separator, used to render pipeline/flow diagrams. Identical
 * across all three experiments (EVM, Intent×MEV, Oracle), so it lives here
 * rather than being duplicated per experiment.
 * Optional `className` lets a specific caller layer on state-dependent
 * classes (e.g. the homepage Lab preview's group-hover/group-focus-visible
 * color overrides for its #737982 active card) without baking that
 * homepage-only concern into this otherwise context-free primitive —
 * every other caller omits it and renders exactly as before.
 */

export function FlowBox({
  children,
  emphasis = false,
  dense = false,
  className = "",
}: {
  children: string;
  emphasis?: boolean;
  dense?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`whitespace-nowrap border font-mono tracking-[0.05em] ${
        dense ? "px-1.5 py-1 text-[10px]" : "px-2.5 py-1.5 text-[11px]"
      } ${emphasis ? "border-accent text-accent" : "border-border-strong text-muted"} ${className}`}
    >
      {children}
    </span>
  );
}

export function FlowArrow({ dense = false, className = "" }: { dense?: boolean; className?: string }) {
  return <span className={`font-mono text-dim ${dense ? "text-[10px]" : "text-[11px]"} ${className}`}>→</span>;
}
