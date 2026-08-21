/**
 * Shared Protocol Lab visualization primitive — a small bordered mono box
 * plus arrow separator, used to render pipeline/flow diagrams. Identical
 * across all three experiments (EVM×SVM, Intent×MEV, Oracle), so it lives
 * here rather than being duplicated per experiment.
 */

export function FlowBox({
  children,
  emphasis = false,
}: {
  children: string;
  emphasis?: boolean;
}) {
  return (
    <span
      className={`whitespace-nowrap border px-2.5 py-1.5 font-mono text-[11px] tracking-[0.05em] ${
        emphasis ? "border-accent text-accent" : "border-border-strong text-muted"
      }`}
    >
      {children}
    </span>
  );
}

export function FlowArrow() {
  return <span className="text-dim">→</span>;
}
