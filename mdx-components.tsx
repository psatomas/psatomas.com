import type { MDXComponents } from "mdx/types";

/**
 * Required by @next/mdx for the App Router — maps Markdown's plain HTML
 * elements onto the site's own visual language instead of a generic
 * "prose" theme, so a Research article reads as part of the Protocol Lab
 * rather than a bolted-on blog.
 *
 * Two distinct visual layers on purpose: page chrome (MonoLabel — small,
 * monospace, uppercase, tracked — used for labels like ARTICLE/TAGS/
 * LATEST that describe the page's own structure) versus article content
 * headings (h1/h2/h3 below — sans-serif, normal case, sized by weight of
 * argument) that are part of the author's actual writing. They must not
 * look like the same kind of text, or a reader can't tell page structure
 * from article structure at a glance. Table headers (`th`) are the one
 * exception — a column label genuinely is metadata, not argument, so it
 * intentionally borrows the MonoLabel voice instead.
 */
const components: MDXComponents = {
  // Guardrail, not an invitation: the article page already renders the
  // real title as its own H1. An H1 inside the MDX body would be a
  // mistake, not a normal case — styled distinctly from both the page's
  // title and from h2/h3 so a stray one doesn't blend into either.
  h1: ({ children }) => (
    <h1 className="mt-10 mb-4 text-2xl font-semibold text-foreground">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-10 mb-3 text-xl font-semibold text-foreground">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-8 mb-2 text-base font-semibold text-foreground">{children}</h3>
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
  // Fenced code blocks compile to <pre><code>…</code></pre> — the [&>code]
  // overrides below undo the standalone `code` styling above so a fenced
  // block doesn't end up with a border-in-a-border look. No syntax
  // highlighting here on purpose (would mean a new dependency); that can
  // be layered on later without touching this structure.
  pre: ({ children }) => (
    <pre className="mb-4 overflow-x-auto rounded border border-border bg-surface p-4 font-mono text-sm [&>code]:border-0 [&>code]:bg-transparent [&>code]:p-0">
      {children}
    </pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-border-strong pl-4 italic text-muted">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-8 border-border" />,
  // GFM pipe tables — requires remark-gfm (see next.config.ts); the
  // default CommonMark compiler doesn't parse `| a | b |` into a table at
  // all. The wrapping div is the same overflow-x-auto pattern used
  // elsewhere on the site for wide content, so a table wider than the
  // reading column scrolls its own container instead of breaking the
  // page on mobile.
  table: ({ children }) => (
    <div className="mb-4 overflow-x-auto">
      <table className="w-full min-w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead>{children}</thead>,
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => <tr className="border-b border-border">{children}</tr>,
  th: ({ children }) => (
    <th className="px-3 py-2 text-left font-mono text-xs uppercase tracking-[0.06em] text-dim">
      {children}
    </th>
  ),
  td: ({ children }) => <td className="px-3 py-2 align-top text-foreground">{children}</td>,
};

export function useMDXComponents(): MDXComponents {
  return components;
}
