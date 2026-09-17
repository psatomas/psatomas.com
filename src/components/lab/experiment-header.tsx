import { MonoLabel } from "@/components/ui/mono-label";

/**
 * The shared identity object every Lab experiment detail page opens
 * with — one bordered, two-plane object (bg-surface identity directly
 * attached to a bg-background excerpt, single divider, zero gap), the
 * same shape /lab's own index and Systems' ObjectCard already use for
 * "this is one complete object." Rendered once from the shared
 * /lab/[id] shell rather than duplicated per experiment, so a future
 * experiment inherits this identity by adding registry fields, not by
 * reimplementing markup.
 *
 * `excerpt` is optional: an experiment without one (e.g. EVM, for now)
 * renders as a single identity plane with its own closing border — not
 * an empty black plane underneath it.
 */
export function ExperimentHeader({
  index,
  title,
  subtitle,
  designation,
  excerpt,
}: {
  index: string;
  title: string;
  subtitle: string;
  designation: string;
  excerpt?: string;
}) {
  return (
    <div className="border border-border">
      <div className="flex flex-col gap-3 bg-surface p-6 sm:p-8">
        <div className="flex flex-col gap-1">
          {/* Not MonoLabel here, deliberately: MonoLabel's own base
              classString hardcodes text-muted, and Tailwind v4 emits
              utility rules in alphabetical-by-class-name order — .text-
              accent lands before .text-muted in the compiled stylesheet,
              so as two equal-specificity single-class selectors on the
              same element, .text-muted (later) always won the cascade
              regardless of prop/DOM order (see src/app/research/[slug]/
              page.tsx for the same fix on the article category line).
              Reproducing MonoLabel's exact typographic classes directly
              here, with no competing color utility on the element, is
              what actually fixes it. */}
          <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-accent">
            {index}
          </span>
          <h1 className="font-mono text-3xl font-semibold tracking-tight sm:text-4xl">
            {title}
          </h1>
          <MonoLabel className="text-dim">{subtitle}</MonoLabel>
        </div>
        <MonoLabel className="text-dim">{designation}</MonoLabel>
      </div>

      {excerpt ? (
        <div className="border-t border-border bg-background p-6 sm:p-8">
          <p className="max-w-xl text-sm text-muted">{excerpt}</p>
        </div>
      ) : null}
    </div>
  );
}
