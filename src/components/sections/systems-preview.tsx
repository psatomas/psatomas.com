import Link from "next/link";
import { MonoLabel } from "@/components/ui/mono-label";
import { getAllSystems } from "@/lib/systems";

const HOMEPAGE_LIMIT = 6;

/**
 * Systems is a curated, growing portfolio, not an accumulating stream —
 * unlike Research, it should never scroll, and a new entry is significant
 * enough to reshape the grid rather than disappear into a viewport. Six
 * is a homepage ceiling, not a claim about how many will ever exist:
 * getAllSystems() (the same source /systems and /systems/[slug] read) is
 * still the complete catalog, and this is the only place that decides how
 * much of it appears here — /systems itself is unaffected.
 */
function getHomepageSystems() {
  return getAllSystems().slice(0, HOMEPAGE_LIMIT);
}

/**
 * The container's column count for a given number of displayed systems.
 * Below the `sm` breakpoint everything is a single column regardless (see
 * the base `grid-cols-1` on the <ul>); this only decides the desktop/
 * tablet layout. 1/2/3/4/6 all divide evenly into same-size cells that
 * CSS Grid's own auto-wrap already lays out correctly (e.g. 6 items in 3
 * columns wraps to two full rows of 3 with no extra logic needed) — 5 is
 * the one count with no even division, handled separately below via
 * per-item spans on a 6-column base instead of a dedicated 5-column mode.
 */
function systemsGridClassName(count: number): string {
  switch (count) {
    case 1:
      return "";
    case 2:
    case 4:
      return "sm:grid-cols-2";
    case 5:
      return "sm:grid-cols-6";
    default:
      return "sm:grid-cols-3"; // 3 or 6
  }
}

/**
 * Only the 5-system case needs a per-card override: on the 6-column base
 * grid above, the first three cards span 2 columns each (three equal
 * cards filling one row) and the last two span 3 columns each (two
 * equal, wider cards filling the next row) — a balanced 3-then-2
 * composition using plain column spans, not a one-off positioned card or
 * a fragile nth-child hack. Every other count leaves cards at their
 * default span of 1 column-track, which is already correct once the
 * container's own column count (above) is right.
 */
function systemCardSpanClassName(count: number, index: number): string {
  if (count !== 5) return "";
  return index < 3 ? "sm:col-span-2" : "sm:col-span-3";
}

// Reads the same getAllSystems() the full /systems page reads — no
// homepage-specific systems list or duplicated metadata.
export function SystemsPreview() {
  const systems = getHomepageSystems();

  return (
    <section
      aria-labelledby="systems-heading"
      className="mx-auto flex max-w-6xl flex-col gap-8 border-t border-border px-6 pt-14 md:pt-16"
    >
      {/* One outer Systems environment, the same family as Research/Lab:
          the identity region is one ordinary block-level <Link> to
          /systems (role, heading, description as plain non-interactive
          children), and the system grid below is that Link's sibling,
          not its descendant — no overlay, no nested anchor possible. A
          plain `group` on this Link is safe for the same structural
          reason it is on Research/Lab: the grid lives entirely outside
          this Link, so hovering/focusing it can never reach a card, and
          hovering a card (each with its own independent `group`) can
          never reach back up into this Link's heading. */}
      <div className="border border-border bg-background">
        <Link
          href="/systems"
          className="group flex flex-col gap-3 p-6 transition-colors hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent sm:p-8"
        >
          <MonoLabel>What I build</MonoLabel>
          <h2
            id="systems-heading"
            className="text-2xl font-semibold tracking-tight text-foreground transition-colors group-hover:text-accent group-focus-visible:text-accent sm:text-3xl"
          >
            Systems
          </h2>
          <p className="max-w-xl text-muted">
            Protocols and infrastructure developed through concrete
            problems in execution, state, coordination, security, and
            verification.
          </p>
        </Link>

        {/* The system grid — no scroll viewport, unlike Research: a new
            System is meant to visibly reshape this composition, not
            accumulate behind a scrollbar. border-t is the one fixed
            divider between the identity block and the grid; gap-px +
            bg-border (with bg-background on each cell) draws the
            internal hairlines between systems, exactly as Lab's
            experiment grid already does. */}
        <ul
          className={`grid grid-cols-1 gap-px border-t border-border bg-border ${systemsGridClassName(systems.length)}`}
        >
          {systems.map((system, index) => (
            <li
              key={system.slug}
              className={`bg-background ${systemCardSpanClassName(systems.length, index)}`}
            >
              <Link
                href={`/systems/${system.slug}`}
                className="group flex h-full flex-col gap-2 p-6 transition-colors hover:bg-surface-hover"
              >
                <span className="font-mono text-base font-semibold tracking-tight text-foreground transition-colors group-hover:text-accent">
                  {system.name}
                </span>
                <MonoLabel className="text-dim">{system.tagline}</MonoLabel>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
