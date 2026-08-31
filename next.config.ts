import type { NextConfig } from "next";
import createMDX from "@next/mdx";

const nextConfig: NextConfig = {
  // Research articles live as .mdx files (src/content/research/) — see
  // mdx-components.tsx and src/lib/research.ts. No .mdx *pages* exist yet,
  // only imports, but the loader has to be configured regardless of which
  // way a given .mdx file is consumed.
  pageExtensions: ["js", "jsx", "md", "mdx", "ts", "tsx"],
};

const withMDX = createMDX({});

export default withMDX(nextConfig);

import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
