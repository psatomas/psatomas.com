import { MonoLabel } from "@/components/ui/mono-label";
import { buildMapExplorerView } from "@/components/map/explorer-model";
import { RecursiveMapExplorer } from "@/components/map/recursive-explorer";
import { createMapResolver, mapKnowledge } from "@/lib/map";
import { staticSocial } from "@/lib/social/content";
import { buildSocialMetadata } from "@/lib/social/metadata";

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
          A structured knowledge environment for understanding the systems,
          mechanisms, trust models, economics, and coordination layers behind
          programmable digital systems.
        </p>
      </header>

      <section aria-labelledby="exploration-surface-heading" className="flex flex-col gap-6">
        <div className="flex flex-col gap-3 bg-surface p-6 sm:p-8">
          <MonoLabel>Exploration environment</MonoLabel>
          <h2 id="exploration-surface-heading" className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Protocol Engineering
          </h2>
          <p className="max-w-2xl text-muted">
            Explore the pedagogical taxonomy directly. Each row is a placement
            of one canonical MAP concept; branches can be opened independently
            without changing the width of the reading surface.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <MonoLabel>Conceptual territory</MonoLabel>
          <RecursiveMapExplorer view={explorerView} />
        </div>
      </section>
    </main>
  );
}
