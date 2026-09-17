import Link from "next/link";
import { MonoLabel } from "@/components/ui/mono-label";
import { FlowBox, FlowArrow } from "@/components/lab/flow";
import { FLOW_PREVIEW } from "@/components/lab/flow-preview";
import { experiments } from "@/lib/experiments/registry";

// Splits `count` items into balanced rows of at most `maxPerRow`, biasing
// extra items toward earlier rows (5 -> [3, 2], not [2, 3]) so a trailing
// row is never the odd one out. Never leaves a final row of 1 when count
// > 1: e.g. 7 -> [3, 2, 2], not [3, 3, 1].
function balancedRowSizes(count: number, maxPerRow = 3): number[] {
  if (count <= 0) return [];
  const rows = Math.ceil(count / maxPerRow);
  const base = Math.floor(count / rows);
  const remainder = count % rows;
  return Array.from({ length: rows }, (_, i) => base + (i < remainder ? 1 : 0));
}

// Tailwind needs each grid-cols-N class to appear literally in source to
// generate its CSS — a row's size is always 1-3 (balancedRowSizes' own
// maxPerRow cap), so this fixed lookup covers every case without a
// per-total-count branch.
const ROW_GRID_COLS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-3",
};

// Reads the same registry /lab reads — no homepage-specific experiment
// list, and no cap: every `enabled` experiment appears here (matching
// /lab and /lab/[id]'s own behavior), with balancedRowSizes adapting the
// grid's row composition to however many that turns out to be.
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
  const featured = experiments.filter((experiment) => experiment.enabled);
  const rows: (typeof featured)[number][][] = [];
  let cursor = 0;
  for (const size of balancedRowSizes(featured.length)) {
    rows.push(featured.slice(cursor, cursor + size));
    cursor += size;
  }

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
          grid), hovering one can never bleed into the other.
          Active state (hover/focus-visible) inverts this Link's own
          plane to a light gray (#737982, an inline value — see
          systems-preview.tsx for why this isn't a token), dark
          supporting text, cyan heading — the same signal used across
          all four homepage previews, tuned down from an earlier,
          too-bright near-white version. The
          same sibling/descendant split above means this Link's own
          group-hover/group-focus-visible styling structurally cannot
          reach the experiment grid: those cards stay black regardless
          of this Link's state. */}
      <div className="border border-border bg-background">
        <Link
          href="/lab"
          className="group flex flex-col gap-3 bg-surface p-6 transition-colors hover:bg-[#737982] focus-visible:bg-[#737982] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent sm:p-8"
        >
          <MonoLabel className="transition-colors group-hover:text-background group-focus-visible:text-background">
            What I explore
          </MonoLabel>
          <h2
            id="lab-heading"
            className="text-2xl font-semibold tracking-tight text-foreground transition-colors group-hover:text-accent group-focus-visible:text-accent sm:text-3xl"
          >
            Lab
          </h2>
          <p className="max-w-xl text-muted transition-colors group-hover:text-background group-focus-visible:text-background">
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
            Lab surface, rather than a second, redundant outline. Each
            card's own hover/focus-visible now uses the same #737982
            "this object is targeted" treatment as the environment
            identity above, instead of the old dark surface-hover step
            — but scoped to its own `group`, so only the targeted card
            changes; sibling cards (and the identity plane) are
            untouched.

            Rows are balancedRowSizes' output rendered as one <ul> per
            row rather than a single grid for the whole set — a plain CSS
            grid can't give two rows a different column count on its own.
            The outer wrapper's own gap-px + bg-border draws the hairline
            between rows the same way each row's own gap-px + bg-border
            draws the hairlines between its cells, so the two nest into
            what still reads as one continuous grid. */}
        <div className="flex flex-col gap-px border-t border-border bg-border">
          {rows.map((row, rowIndex) => (
            <ul
              key={rowIndex}
              className={`grid gap-px bg-border ${ROW_GRID_COLS[row.length]}`}
            >
              {row.map((experiment) => {
                const [first, second, third] = FLOW_PREVIEW[experiment.id];
                return (
                  <li key={experiment.id} className="bg-background">
                    <Link
                      href={`/lab/${experiment.id}`}
                      className="group flex h-full flex-col gap-4 p-6 transition-colors hover:bg-[#737982] focus-visible:bg-[#737982]"
                    >
                      <div className="flex flex-col gap-2">
                        {/* Not MonoLabel here, deliberately: MonoLabel's own
                            base classString hardcodes text-muted, and
                            Tailwind v4 emits utility rules in alphabetical-
                            by-class-name order, so a text-accent override
                            never wins the cascade against it regardless of
                            class order (see ExperimentHeader / the Research
                            article page for the same fix). Reproducing
                            MonoLabel's exact typographic classes directly
                            here, with no competing color utility, is what
                            actually renders this cyan. */}
                        <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-accent transition-colors group-hover:text-background group-focus-visible:text-background">
                          {experiment.index}
                        </span>
                        <span className="font-mono text-base font-semibold tracking-tight text-foreground group-hover:text-accent group-focus-visible:text-accent transition-colors">
                          {experiment.title}
                        </span>
                        <MonoLabel className="text-dim transition-colors group-hover:text-background group-focus-visible:text-background">
                          {experiment.subtitle}
                        </MonoLabel>
                      </div>

                      {/* text-muted (both plain FlowBox chips) and text-dim
                          (both arrows) read too close in luminance to the
                          #737982 active card background to stay legible, so
                          they switch to the same dark/background treatment
                          as the rest of the active card's supporting text.
                          The emphasis chip stays cyan — it's the flow's own
                          accent/primary step, not supporting information,
                          so it follows the same "cyan may remain cyan" rule
                          already applied to the card's title. */}
                      <div className="flex flex-wrap items-center gap-1">
                        <FlowBox dense className="transition-colors group-hover:text-background group-focus-visible:text-background">
                          {first}
                        </FlowBox>
                        <FlowArrow dense className="transition-colors group-hover:text-background group-focus-visible:text-background" />
                        <FlowBox dense className="transition-colors group-hover:text-background group-focus-visible:text-background">
                          {second}
                        </FlowBox>
                        <FlowArrow dense className="transition-colors group-hover:text-background group-focus-visible:text-background" />
                        <FlowBox dense emphasis>{third}</FlowBox>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ))}
        </div>
      </div>
    </section>
  );
}
