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
  className = "",
}: {
  children: string;
  emphasis?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`whitespace-nowrap border px-2.5 py-1.5 font-mono text-[11px] tracking-[0.05em] ${
        emphasis ? "border-accent text-accent" : "border-border-strong text-muted"
      } ${className}`}
    >
      {children}
    </span>
  );
}

export function FlowArrow({ className = "" }: { className?: string }) {
  return <span className={`text-dim ${className}`}>→</span>;
}
