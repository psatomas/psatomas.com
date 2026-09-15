import Link from "next/link";
import { MonoLabel } from "@/components/ui/mono-label";
import { FlowBox, FlowArrow } from "@/components/lab/flow";
import { experiments } from "@/lib/experiments/registry";
import type { ExperimentId } from "@/types";

const PREVIEW_COUNT = 3;

/** A short, hand-picked excerpt of each experiment's own real flow
 * diagram (see src/experiments/{id}/component.tsx) — not new content,
 * just fewer steps of it. This is homepage-only curation, deliberately
 * kept out of the registry: it's an editorial choice about which three
 * steps hint at an experiment best on a small preview, not a fact about
 * the experiment itself the way index/title/subtitle are. Keyed by the
 * same ExperimentId the registry already uses, so TypeScript forces a
 * deliberate choice here whenever a new experiment is added, rather than
 * silently rendering nothing. */
const FLOW_PREVIEW: Record<ExperimentId, readonly [string, string, string]> = {
  evm: ["TX 01", "STATE", "TX 02"],
  "intent-mev": ["INTENT", "SOLVERS", "SELECTED"],
  oracle: ["COINGECKO", "ORACLE SERVICE", "PROTOCOL LAB"],
};

// Reads the same registry /lab reads — no homepage-specific experiment
// list. `enabled` is respected (a disabled experiment never appears here,
// matching /lab and /lab/[id]'s own behavior), and the slice is a fixed
// cap independent of how large the registry grows: adding a 21st
// experiment should not automatically bump it onto the homepage, only
// into /lab's own full index.
//
// Deliberately not interactive here — the accordion that used to live at
// this spot on the homepage now lives at /lab and /lab/[id], where an
// experiment can be linked to, shared, and indexed on its own. This keeps
// the homepage server-rendered and stops Lab from being most of the page.
// The flow-chip row reuses FlowBox/FlowArrow (src/components/lab/flow.tsx)
// — the same static, stateless presentational primitive the experiments
// themselves use for their own diagrams — so the preview hints at "a
// technical environment lives behind this" without embedding any
// experiment's actual logic, state, or live data.
export function LabPreview() {
  const featured = experiments.filter((experiment) => experiment.enabled).slice(0, PREVIEW_COUNT);

  return (
    // Lab is the closing section, not just the fourth one — a taller top
    // gap than About/Systems/Research (pt-20/24 vs. their pt-14/16) marks
    // that shift deliberately, and a real bottom gap (pb-16/20) keeps it
    // from butting straight into the footer's own border/padding.
    <section
      aria-labelledby="lab-heading"
      className="mx-auto flex max-w-6xl flex-col gap-8 px-6 pt-20 pb-16 md:pt-24 md:pb-20"
    >
      {/* One outer border for the whole Lab environment. Its open upper
          area — role, heading, description — is itself a single,
          ordinary <Link> to /lab, not an overlay stretched behind other
          content: just a block-level link whose children are plain text,
          so there's nothing here that could ever produce a nested anchor.
          The experiment grid below is that Link's sibling, not its
          descendant, so the two live in entirely separate subtrees. A
          plain `group` on the Lab link and a plain `group` on each card's
          own Link never collide, because Tailwind's `group-hover:` only
          reaches descendants of the hovered `.group` — with the grid
          outside the Lab link (and each card independent inside the
          grid), hovering one can never bleed into the other. */}
      <div className="border border-border bg-background">
        <Link
          href="/lab"
          className="group flex flex-col gap-3 p-6 transition-colors hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent sm:p-8"
        >
          <MonoLabel>What I explore</MonoLabel>
          <h2
            id="lab-heading"
            className="text-2xl font-semibold tracking-tight text-foreground transition-colors group-hover:text-accent group-focus-visible:text-accent sm:text-3xl"
          >
            Lab
          </h2>
          <p className="max-w-xl text-muted">
            Bounded technical experiments — each one built to test a
            single idea about how a protocol behaves, not to
            demonstrate a finished product.
          </p>
        </Link>

        {/* The inner, experiment-only bordered grid. It carries just a
            top divider (border-t) and internal hairlines between cells
            (gap-px + bg-border) — no border of its own on the other three
            sides, since it sits flush inside the outer border above, which
            already draws those edges. That's what keeps this reading as
            one bordered box for the experiments nested inside the larger
            Lab surface, rather than a second, redundant outline. */}
        <ul className="grid grid-cols-1 gap-px border-t border-border bg-border sm:grid-cols-3">
          {featured.map((experiment) => {
            const [first, second, third] = FLOW_PREVIEW[experiment.id];
            return (
              <li key={experiment.id} className="bg-background">
                <Link
                  href={`/lab/${experiment.id}`}
                  className="group flex h-full flex-col gap-4 p-6 transition-colors hover:bg-surface-hover"
                >
                  <div className="flex flex-col gap-2">
                    <MonoLabel className="text-accent">{experiment.index}</MonoLabel>
                    <span className="font-mono text-base font-semibold tracking-tight text-foreground group-hover:text-accent transition-colors">
                      {experiment.title}
                    </span>
                    <MonoLabel className="text-dim">{experiment.subtitle}</MonoLabel>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <FlowBox>{first}</FlowBox>
                    <FlowArrow />
                    <FlowBox>{second}</FlowBox>
                    <FlowArrow />
                    <FlowBox emphasis>{third}</FlowBox>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
