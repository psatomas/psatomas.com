import type { ReactNode } from "react";

export function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-sm font-medium uppercase tracking-wide text-muted">
      {children}
    </h2>
  );
}
