import type { ComponentType } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { components as mdxComponents } from "../../../mdx-components";

/**
 * Compiles a D1-stored Markdown/MDX string into a renderable component,
 * reusing the exact same element mappings as the build-time .mdx pipeline
 * (mdx-components.tsx) — see the comment there for why they're shared.
 *
 * This deliberately does NOT use @mdx-js/mdx's evaluate() the way you
 * might expect for "runtime MDX." Confirmed empirically under real
 * workerd that evaluate() throws
 * `EvalError: Code generation from strings disallowed for this context`
 * — Cloudflare Workers' isolate sandbox blocks the dynamic code
 * generation (new Function/eval) that compiling-and-running arbitrary JS
 * at request time requires. react-markdown takes a different approach
 * that sidesteps this entirely: it parses Markdown into a syntax tree
 * (via remark, the same GFM plugin already used for the file-based
 * pipeline) and walks that tree straight into React elements — no code
 * string is ever generated or executed, so there's nothing for the
 * sandbox to block.
 *
 * The real cost of this choice: content authored through D1 gets GFM
 * Markdown (headings, lists, tables, fenced code, etc.) but not true
 * MDX's signature feature — arbitrary embedded JSX components inline in
 * the prose. The three build-time seed files keep that capability via
 * the unchanged file-based pipeline; D1-authored content does not, until
 * a future step finds a sandbox-safe way to support it.
 */
export function createMarkdownContent(source: string): ComponentType {
  return function ArticleContent() {
    return (
      <Markdown remarkPlugins={[remarkGfm]} components={mdxComponents as Components}>
        {source}
      </Markdown>
    );
  };
}
