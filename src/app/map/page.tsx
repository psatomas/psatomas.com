import { MonoLabel } from "@/components/ui/mono-label";
import { buildMapExplorerView } from "@/components/map/explorer-model";
import { RecursiveMapExplorer } from "@/components/map/recursive-explorer";
import { createMapResolver, mapKnowledge } from "@/lib/map";
import { staticSocial } from "@/lib/social/content";
import { buildSocialMetadata } from "@/lib/social/metadata";

// Request-rendered so the explorer's `?context=` (read with useSearchParams)
// is present in the server render: refresh and direct entry arrive with the
// active placement, breadcrumb, and revealed ancestors already in the HTML.
export const dynamic = "force-dynamic";

// Canonical identity is always /map; the context query never becomes canonical.
export const metadata = buildSocialMetadata(staticSocial.map);

export default function MapPage() {
  // Keep canonical MAP data and resolution server-side. The client receives
  // only this route's serializable placement taxonomy, not graph/content/path
  // records or the raw knowledge model.
  const resolver = createMapResolver(mapKnowledge);
  const explorerView = buildMapExplorerView(
    resolver,
    resolver.getRootPlacements().map((placement) => placement.id),
  );

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-12 px-6 py-16 md:gap-16">
      <header className="flex max-w-3xl flex-col gap-4">
        <MonoLabel>Map / Protocol Engineering</MonoLabel>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Map</h1>
        <p className="text-lg text-muted">
          A structured knowledge environment for the foundations of
          programmable and increasingly autonomous digital systems.
        </p>
      </header>

      <section aria-labelledby="exploration-surface-heading" className="flex flex-col gap-8">
        {/* Plain intro rather than a graphite plane: inside the explorer,
            graphite is reserved for structural region identity. */}
        <div className="flex max-w-2xl flex-col gap-3">
          <h2 id="exploration-surface-heading" className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Protocol Engineering
          </h2>
          <p className="text-muted">
            Explore the systems, mechanisms, trust models, economics,
            coordination structures, and intelligent agents behind them.
            Open as many regions and branches as you like; select a concept
            to set your context.
          </p>
        </div>
        <RecursiveMapExplorer view={explorerView} />
      </section>
    </main>
  );
}
