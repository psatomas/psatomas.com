import type { MDXComponents } from "mdx/types";

/**
 * Required by @next/mdx for the App Router — maps Markdown's plain HTML
 * elements onto the site's own visual language instead of a generic
 * "prose" theme, so a Research article reads as part of the Protocol Lab
 * rather than a bolted-on blog. Not yet consumed by any route (the article
 * page is a later step) — this exists now because @next/mdx requires it
 * to be present at all, even just to import a .mdx file for its metadata.
 */
const components: MDXComponents = {
  h2: ({ children }) => (
    <h2 className="mt-10 mb-3 font-mono text-sm uppercase tracking-[0.08em] text-foreground">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-8 mb-2 font-mono text-xs uppercase tracking-[0.08em] text-muted">
      {children}
    </h3>
  ),
  p: ({ children }) => <p className="mb-4 leading-relaxed text-foreground">{children}</p>,
  ul: ({ children }) => (
    <ul className="mb-4 flex list-inside list-disc flex-col gap-2 text-foreground">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-4 flex list-inside list-decimal flex-col gap-2 text-foreground">
      {children}
    </ol>
  ),
  a: ({ children, href }) => (
    <a href={href} className="text-accent hover:underline">
      {children}
    </a>
  ),
  code: ({ children }) => (
    <code className="rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-[0.85em]">
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="mb-4 overflow-x-auto rounded border border-border bg-surface p-4 font-mono text-sm">
      {children}
    </pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-border-strong pl-4 italic text-muted">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-8 border-border" />,
};

export function useMDXComponents(): MDXComponents {
  return components;
}
