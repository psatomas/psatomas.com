# Social / link preview identity

Public pages use `buildSocialMetadata` with complete Open Graph and Twitter
objects. `metadataBase` and the browser title template remain in the root layout;
each public page supplies its own canonical. Missing Research content keeps the page's 404 behavior and explicitly clears
social images/canonical metadata in the article not-found boundary, because Next
rebuilds error metadata rather than retaining the throwing page's metadata.
That boundary re-exports the installed Next 16.3.1 default 404 component to
preserve its exact UI; check this internal import when upgrading Next.

`content.ts` maps the Systems catalog, enabled Lab registry, and published Research
repository records to the same descriptor used by HTML metadata and images.
Research descriptions, categories, tags, and publication dates are not copied into
a second catalog. A new published article needs no metadata route registration.
React `cache` shares the published lookup between page and metadata within one
render; it never persists a Cloudflare binding or repository between requests.
The image HTTP request performs its own published lookup.

The root `opengraph-image.tsx` and `/og/[...path]` use one 1200 × 630 PNG renderer.
The endpoint accepts only known public paths; unknown content and all query
parameters return 404. It cannot render arbitrary text or external image URLs.
Research article images return `Cache-Control: no-store`, so application/CDN
caching does not retain an image after unpublishing. Static identities use
`public, max-age=3600, s-maxage=3600`. LinkedIn, X, Slack, and other consumers may
independently cache an already fetched preview; these headers cannot revoke it.

The renderer uses the Geist Regular font already bundled with the installed
Next.js ImageResponse implementation. No custom fonts or remote font source were
added. OpenNext packages that font as a binary import for Workers. Existing
transparent mark/footer and navbar wordmark PNGs are embedded byte-for-byte in
`brand-assets.ts` (3,423 original bytes), avoiding runtime filesystem access,
asset requests, and `next/image`. A test detects drift from the original PNGs;
regenerate the base64 literals from those files if the canonical assets change.

Title wrapping is deterministic, using conservative glyph advance estimates and
explicit lines. Supporting copy is omitted at three title lines. Titles use
64/56/48 px, never smaller; unusually long future titles exceeding four lines at
48 px are abbreviated in the image only. Full HTML metadata remains intact.
Routes are secondary and very long paths are abbreviated. The renderer supports
the portfolio's current Latin-script content; new scripts should be visually
verified before relying on the bundled font's glyph coverage.

## Verification

Run the normal lint, TypeScript, test, and production build gates, then:

```sh
npx opennextjs-cloudflare build
npx opennextjs-cloudflare preview --port 8787
node scripts/verify-social-metadata.mjs http://localhost:8787 /tmp/social-images
```

The HTTP verifier reads published article links from the local Research index,
checks browser and Twitter crawler HTML, fetches each PNG, checks dimensions,
checks article cache policy, and rejects invalid image paths. It requires a
populated local Research database. It does not publish, mutate articles, or deploy.
Inspect the saved PNGs visually as well: header checks alone cannot prove layout.
Worker verification should include a local-only draft → published → edited →
unpublished lifecycle to prove D1-driven image visibility without rebuilding.
