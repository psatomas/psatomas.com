"use client";

import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { components as mdxComponents } from "../../../../mdx-components";

/**
 * The live preview pane — deliberately the exact same remark-gfm +
 * component mapping as src/lib/research/markdown-content.tsx, which is
 * what a published D1-backed article actually renders through. That
 * module wraps this in a ComponentType closed over a fixed source string
 * (fine for a page that renders once per request); the editor needs the
 * source to be a normal prop that changes on every keystroke, so this
 * uses <Markdown> directly rather than importing that wrapper. Same
 * plugin, same components object, same output — never a second
 * rendering pipeline to keep in sync with the first.
 */
export function MarkdownPreview({ content }: { content: string }) {
  return <Markdown remarkPlugins={[remarkGfm]} components={mdxComponents as Components}>{content}</Markdown>;
}
