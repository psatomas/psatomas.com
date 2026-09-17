import type { ReactNode } from "react";

// One independent bordered object: a dark-gray identity plane (title)
// directly attached to a black content plane (children) with a single
// divider between them — the same two-plane shape as each system object
// on /systems, reused across system detail pages for any content that
// should read as its own independent technical object rather than a row
// in one enclosing table.
export function ObjectCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border border-border">
      <div className="bg-surface p-6 sm:p-8">
        <span className="font-mono text-sm font-semibold uppercase tracking-wide text-foreground">
          {title}
        </span>
      </div>
      <div className="border-t border-border bg-background p-6 sm:p-8">
        {children}
      </div>
    </div>
  );
}
