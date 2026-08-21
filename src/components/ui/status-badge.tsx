type Variant = "neutral" | "accent" | "warn";

const variantClasses: Record<Variant, string> = {
  neutral: "border-border-strong text-muted",
  accent: "border-accent text-accent",
  warn: "border-warn text-warn",
};

export function StatusBadge({
  children,
  variant = "neutral",
}: {
  children: string;
  variant?: Variant;
}) {
  return (
    <span
      className={`whitespace-nowrap border px-2 py-0.5 font-mono text-[10px] tracking-[0.08em] ${variantClasses[variant]}`}
    >
      {children}
    </span>
  );
}
