import { MonoLabel } from "@/components/ui/mono-label";
import { staticSocial } from "@/lib/social/content";
import { buildSocialMetadata } from "@/lib/social/metadata";

// This is an environment shell, not an early explorer implementation. The
// territory statements establish MAP's intellectual range without claiming to
// be canonical taxonomy records or exposing Phase 1's proof fixture.
const TERRITORY_BANDS = [
  "Foundations · Distributed Systems · Protocol Mechanics",
  "Execution · Cryptography · Security · Economics",
  "Coordination · Intelligent Agents · Machine Economy · Autonomous Systems",
] as const;

export const metadata = buildSocialMetadata(staticSocial.map);

export default function MapPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-12 px-6 py-16 md:gap-16">
      <header className="flex max-w-3xl flex-col gap-4">
        <MonoLabel>Map / Protocol Engineering</MonoLabel>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Map</h1>
        <p className="text-lg text-muted">
          A structured knowledge environment for understanding the systems,
          mechanisms, trust models, economics, and coordination layers behind
          programmable digital systems.
        </p>
      </header>

      <section aria-labelledby="exploration-surface-heading" className="border border-border bg-background">
        <div className="flex flex-col gap-3 bg-surface p-6 sm:p-8">
          <MonoLabel>Exploration environment</MonoLabel>
          <h2 id="exploration-surface-heading" className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Protocol Engineering
          </h2>
          <p className="max-w-2xl text-muted">
            This surface is the future home for conceptual exploration: a
            navigable hierarchy, connected knowledge, mechanisms, and guided
            paths through the territory.
          </p>
        </div>

        <div className="border-t border-border">
          <div className="bg-background px-5 py-4 sm:px-6">
            <MonoLabel>Conceptual territory</MonoLabel>
          </div>

          {/* Full-width, connected bands establish the explorer's future
              geometry without presenting inactive disclosure controls or a
              taxonomy projection. Their shared boundaries are intentional:
              arbitrary recursive depth must retain these same edges. */}
          <div className="border-t border-border">
            {TERRITORY_BANDS.map((band) => (
              <div key={band} className="border-t border-border px-5 py-5 first:border-t-0 sm:px-6">
                <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-foreground sm:text-xs">
                  {band}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid border-t border-border sm:grid-cols-4">
          {[
            ["Hierarchy", "Teaches"],
            ["Graph", "Connects"],
            ["Content", "Explains"],
            ["Paths", "Guide"],
          ].map(([term, role]) => (
            <div
              key={term}
              className="flex min-w-0 flex-col gap-1 border-t border-border px-5 py-4 first:border-t-0 sm:border-t-0 sm:border-l sm:first:border-l-0 sm:px-6"
            >
              <MonoLabel>{term}</MonoLabel>
              <span className="text-sm text-foreground">{role}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
