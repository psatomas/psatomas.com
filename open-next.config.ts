import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

// Prerendered routes (/about, /systems/*, /lab/*, robots.txt, icons, the
// homepage OG image) must be served from their build output, not rendered
// again. OpenNext only serves prerendered output through an incremental
// cache: without one (the default "dummy" cache) the Worker re-renders every
// "static" page on every request, which kept them at ~15–20 ms of CPU each
// against the Workers Free 10 ms limit (Cloudflare 1102 errors, issue #44).
//
// The static-assets cache is read-only: `opennextjs-cloudflare deploy` copies
// the build's prerendered output into Worker assets and the Worker reads it
// from there. That fits this site, which has no ISR/revalidation; request-time
// routes (force-dynamic) are unaffected. Choose R2/KV instead if revalidation
// is ever introduced.
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
});
