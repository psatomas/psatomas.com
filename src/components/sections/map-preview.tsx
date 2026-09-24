import Link from "next/link";
import { MonoLabel } from "@/components/ui/mono-label";

// This is homepage presentation copy, not MAP taxonomy data. It communicates
// the environment's intended intellectual range without claiming that the
// Phase 1 proof fixture is the ontology or that this sequence is canonical.
const TERRITORY_PREVIEW = [
  "Foundations",
  "Distributed Systems",
  "Protocols",
  "Computation / Execution",
  "Cryptography / Security",
  "Economics / Markets",
  "Intents / Coordination",
  "Intelligent Agents",
  "Machine Economy",
  "Autonomous Systems",
] as const;

/**
 * MAP's homepage introduction. The identity plane links to the actual /map
 * environment. The connected full-width rows preview the future environment's
 * structural language without representing taxonomy depth or imposing a
 * canonical learning sequence.
 */
export function MapPreview() {
  return (
    <section
      aria-labelledby="map-heading"
      className="mx-auto flex max-w-6xl flex-col gap-8 px-6 pt-14 md:pt-16"
    >
      <div className="border border-border bg-background">
        <Link
          href="/map"
          className="group flex flex-col gap-3 bg-surface p-6 transition-colors hover:bg-[#737982] focus-visible:bg-[#737982] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent sm:p-8"
        >
          <MonoLabel className="transition-colors group-hover:text-background group-focus-visible:text-background">
            A structured knowledge environment
          </MonoLabel>
          <h2
            id="map-heading"
            className="text-2xl font-semibold tracking-tight transition-colors group-hover:text-accent group-focus-visible:text-accent sm:text-3xl"
          >
            Map
          </h2>
          <p className="max-w-xl text-muted transition-colors group-hover:text-background group-focus-visible:text-background">
            Explore Protocol Engineering through the systems, mechanisms,
            trust models, economics, and coordination layers behind
            programmable digital systems.
          </p>
          <span className="font-mono text-xs tracking-[0.1em] text-muted transition-colors group-hover:text-background group-focus-visible:text-background">
            EXPLORE MAP →
          </span>
        </Link>

        <div className="border-t border-border">
          <div className="bg-background px-5 py-4 sm:px-6">
            <MonoLabel>Map / Protocol Engineering</MonoLabel>
          </div>

          {/* A single bordered stack rather than nested or indented boxes:
              every territory row retains the same left/right boundaries.
              It is an illustrative progression, not a taxonomy projection
              or an interactive disclosure control. */}
          <ol className="border-t border-border">
            {TERRITORY_PREVIEW.map((territory, index) => (
              <li
                key={territory}
                className="flex min-w-0 items-center gap-3 border-t border-border px-5 py-3.5 first:border-t-0 sm:px-6"
              >
                <span aria-hidden="true" className="font-mono text-xs text-dim">
                  {index === 0 ? "·" : "↓"}
                </span>
                <span className="min-w-0 font-mono text-[11px] uppercase tracking-[0.12em] text-foreground sm:text-xs">
                  {territory}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
