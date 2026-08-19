import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// No incremental cache override (e.g. R2) yet — every route on this site is
// currently static or prerendered at build time, so there's nothing to
// revalidate. Add one here if a future stage (e.g. Blog) introduces ISR.
export default defineCloudflareConfig();
