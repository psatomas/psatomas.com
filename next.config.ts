import type { NextConfig } from "next";
import createMDX from "@next/mdx";

const nextConfig: NextConfig = {
  // Research articles live as .mdx files (src/content/research/) — see
  // mdx-components.tsx and src/lib/research.ts. No .mdx *pages* exist yet,
  // only imports, but the loader has to be configured regardless of which
  // way a given .mdx file is consumed.
  pageExtensions: ["js", "jsx", "md", "mdx", "ts", "tsx"],

  // /projects was renamed to /systems (public IA: About / Systems /
  // Research / Lab) — the route itself no longer exists under
  // src/app/projects/, only these permanent redirects do, so any
  // externally indexed or bookmarked /projects URL keeps working instead
  // of 404ing. :slug carries through unchanged via the named parameter.
  async redirects() {
    return [
      { source: "/projects", destination: "/systems", permanent: true },
      { source: "/projects/:slug", destination: "/systems/:slug", permanent: true },
    ];
  },
};

// remark-gfm specifically for table support: confirmed empirically
// (compiling a pipe-table with @mdx-js/mdx directly) that the default
// CommonMark-only compiler renders `| a | b |` as a literal paragraph of
// pipe characters, not a <table> — GFM tables are an extension, not part
// of base Markdown. Without this, mdx-components.tsx's table mapping
// would just never fire.
//
// Passed as a package-name string, not an imported function reference —
// Turbopack requires MDX loader options to be serializable (a function
// can't cross that boundary) and resolves plugins named this way itself.
// Confirmed by hitting the actual build error the other way first.
const withMDX = createMDX({
  options: { remarkPlugins: ["remark-gfm"] },
});

export default withMDX(nextConfig);

import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
