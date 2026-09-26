import { buildMapExplorerView } from "@/components/map/explorer-model";
import { RecursiveMapExplorer } from "@/components/map/recursive-explorer";
import { mapResolver } from "@/lib/map";
import { staticSocial } from "@/lib/social/content";
import { buildSocialMetadata } from "@/lib/social/metadata";

// Request-rendered so the explorer's `?context=` (read with useSearchParams)
// is present in the server render: refresh and direct entry arrive with the
// active placement, breadcrumb, and revealed ancestors already in the HTML.
export const dynamic = "force-dynamic";

// Canonical identity is always /map; the context query never becomes canonical.
export const metadata = buildSocialMetadata(staticSocial.map);

// Keep canonical MAP data and resolution server-side. The client receives only
// this route's serializable placement taxonomy, not graph/content/path records
// or the raw knowledge model. The taxonomy is immutable, so it is built once per
// isolate rather than on every request.
const explorerView = buildMapExplorerView(
  mapResolver,
  mapResolver.getRootPlacements().map((placement) => placement.id),
);

export default function MapPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-12 px-6 py-16 md:gap-16">
      <header className="flex max-w-3xl flex-col gap-4">
        {/* Not MonoLabel: its hardcoded text-muted wins the cascade over a
            colour override (see lab-preview.tsx), so its classes are used
            directly with the accent colour. */}
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-accent">Map / Protocol Engineering</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Map</h1>
        <p className="text-lg text-muted">
          A structured knowledge environment for the foundations of
          programmable and increasingly autonomous digital systems.
        </p>
      </header>

      <RecursiveMapExplorer view={explorerView} />
    </main>
  );
}
