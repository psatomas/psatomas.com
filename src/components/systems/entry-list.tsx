import type { SystemSectionEntry } from "@/types";

// A term/detail pair, e.g. "IntentRegistry" / "Defines and validates
// registered execution intents." Distinct from the private EntryList in
// the generic [slug]/page.tsx renderer (that one isn't exported, and
// still serves Provenance Registry unchanged) — this is the shared
// version used by bespoke per-system pages that have their own literal
// route.
export function EntryList({ entries }: { entries: SystemSectionEntry[] }) {
  return (
    <dl className="flex flex-col gap-3">
      {entries.map((entry) => (
        <div key={entry.term} className="flex flex-col gap-0.5">
          <dt className="font-mono text-sm font-medium text-foreground">
            {entry.term}
          </dt>
          <dd className="text-sm text-muted">{entry.detail}</dd>
        </div>
      ))}
    </dl>
  );
}
